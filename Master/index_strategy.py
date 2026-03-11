#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict, List

from builder import load_and_build
from collector import CollectorConfig, collect_input
from review_stub import write_paper_review_stub

ROOT = Path(__file__).resolve().parent
DEFAULT_INPUT = ROOT / "examples" / "input-example.json"
DEFAULT_OUT = ROOT / "out-index-strategy"
DEFAULT_REVIEWS_DIR = ROOT / "reviews-index"


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def write_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def load_previous_result(path: Path) -> Dict[str, Any] | None:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def build_rebalance_plan(current_plan: Dict[str, Any], previous: Dict[str, Any] | None) -> Dict[str, Any]:
    previous_plan = (previous or {}).get("allocation_plan", {}) or {}
    if not previous_plan:
        return {
            "needs_rebalance": False,
            "rebalance_action": "无昨日基线，今日先作为初始配置基准。",
            "rebalance_reasoning": "当前缺少上一份指数策略配置结果，先记录今日配置，不做主动再平衡。",
            "bucket_changes": [],
        }

    tracked = [
        ("true_defensive_weight", "真防守"),
        ("equity_defensive_weight", "权益防守"),
        ("core_weight", "核心仓"),
        ("satellite_weight", "卫星仓"),
        ("a_share_weight", "A股"),
        ("h_share_weight", "H股"),
    ]
    bucket_changes = []
    for key, label in tracked:
        cur = float(current_plan.get(key, 0) or 0)
        prev = float(previous_plan.get(key, 0) or 0)
        delta = round(cur - prev, 2)
        if delta == 0:
            continue
        bucket_changes.append({
            "bucket_name": label,
            "change_direction": "增加" if delta > 0 else "减少",
            "change_pct": abs(delta),
            "reasoning": f"{label} 从 {prev}% 调整到 {cur}%，变化 {delta:+.2f}%。",
        })

    needs_rebalance = len(bucket_changes) > 0
    if not needs_rebalance:
        return {
            "needs_rebalance": False,
            "rebalance_action": "今日配置与昨日一致，无需主动调仓。",
            "rebalance_reasoning": "环境档位与核心配置未发生变化，继续持有当前指数组合即可。",
            "bucket_changes": [],
        }

    major_changes = [x for x in bucket_changes if x["change_pct"] >= 10]
    if major_changes:
        action = "环境已跨档，执行一级再平衡：先调卫星仓，再调核心仓，最后调整防守桶。"
        reasoning = "今日与昨日相比已有明显跨档式变化，应按新权重做结构性再平衡。"
    else:
        action = "执行小幅再平衡，优先调整变化最大的配置桶。"
        reasoning = "今日与昨日相比属于同档内微调，无需大幅换仓，但应按目标权重校正。"

    return {
        "needs_rebalance": True,
        "rebalance_action": action,
        "rebalance_reasoning": reasoning,
        "bucket_changes": bucket_changes,
    }


def detect_environment(market: Dict[str, Any]) -> Dict[str, Any]:
    """
    环境分档检测函数（2026-03-11 重构）
    
    核心改进：
    - 成交额阈值从绝对值改为相对值（成交额 / 20日均线）
    - 移除投机情绪指标（连板高度、炸板率）对宽基配置的影响
    - 保留情绪指标作为风险提示，但不作为主判断依据
    
    输入字段（优先使用相对值）：
    - turnover_ratio: 成交额 / 20日均线成交额（推荐）
    - market_turnover_total: 绝对成交额（fallback）
    - up_count: 上涨家数
    - down_count: 下跌家数
    - limit_up_count: 涨停家数（用于风险提示）
    - limit_down_count: 跌停家数
    - ma60_above_ratio: MA60以上个股占比（推荐新增）
    """
    
    # 成交额相对强度（优先使用相对值）
    turnover = float(market.get("market_turnover_total") or 0)
    turnover_ma20 = float(market.get("turnover_ma20") or 0)
    turnover_ratio = float(market.get("turnover_ratio") or 0)
    
    # 如果有相对值就用相对值，否则计算
    if turnover_ratio <= 0 and turnover_ma20 > 0 and turnover > 0:
        turnover_ratio = turnover / turnover_ma20
    elif turnover_ratio <= 0:
        # Fallback: 使用绝对值（旧逻辑兼容）
        # 假设 1.5万亿 作为"正常"基准，计算相对强度
        baseline_turnover = 1.5e12
        turnover_ratio = turnover / baseline_turnover if baseline_turnover > 0 else 1.0
    
    # 广度指标
    up_count = int(market.get("up_count") or 0)
    down_count = int(market.get("down_count") or 0)
    total_count = up_count + down_count
    up_ratio = up_count / total_count if total_count > 0 else 0.5
    
    # MA60 以上个股占比（新增，更靠谱的 Beta 判断）
    ma60_above_ratio = float(market.get("ma60_above_ratio") or 0.5)
    
    # 情绪指标（降级为风险提示，不再作为主判断）
    limit_up = int(market.get("limit_up_count") or 0)
    limit_down = int(market.get("limit_down_count") or 0)
    blowup_rate = float(market.get("blowup_rate") or 0)
    
    # === 新版环境分档逻辑 ===
    # 核心思路：用 Beta 动量 + 广度 + 量能，而非投机情绪
    
    # 进攻档：量能放大 + 广度强 + 趋势确认
    if turnover_ratio >= 1.3 and up_ratio >= 0.65 and ma60_above_ratio >= 0.6:
        return {
            "label": "进攻",
            "reasoning": f"量能相对强度 {turnover_ratio:.2f}x，上涨家数占比 {up_ratio:.1%}，MA60以上个股 {ma60_above_ratio:.1%}，市场广度与趋势共振，适合提高权益暴露。",
            "metrics": {
                "turnover_ratio": round(turnover_ratio, 2),
                "up_ratio": round(up_ratio, 2),
                "ma60_above_ratio": round(ma60_above_ratio, 2),
            },
        }
    
    # 试错档：量能温和 + 广度中等
    if turnover_ratio >= 1.0 and up_ratio >= 0.5 and ma60_above_ratio >= 0.45:
        return {
            "label": "试错",
            "reasoning": f"量能相对强度 {turnover_ratio:.2f}x，上涨家数占比 {up_ratio:.1%}，MA60以上个股 {ma60_above_ratio:.1%}，市场存在赚钱效应但确认不足，适合中等权益仓位。",
            "metrics": {
                "turnover_ratio": round(turnover_ratio, 2),
                "up_ratio": round(up_ratio, 2),
                "ma60_above_ratio": round(ma60_above_ratio, 2),
            },
        }
    
    # 防守档：负反馈明显
    if limit_down >= 20 or up_ratio < 0.35 or ma60_above_ratio < 0.3:
        return {
            "label": "防守",
            "reasoning": f"下跌家数占优（{down_count} vs {up_count}），MA60以上个股仅 {ma60_above_ratio:.1%}，负反馈主导，优先保护净值。",
            "metrics": {
                "turnover_ratio": round(turnover_ratio, 2),
                "up_ratio": round(up_ratio, 2),
                "ma60_above_ratio": round(ma60_above_ratio, 2),
                "limit_down": limit_down,
            },
        }
    
    # 混沌档：方向不明确
    return {
        "label": "混沌",
        "reasoning": f"量能相对强度 {turnover_ratio:.2f}x，上涨家数占比 {up_ratio:.1%}，市场风格和方向不够统一，适合降低仓位观望。",
        "metrics": {
            "turnover_ratio": round(turnover_ratio, 2),
            "up_ratio": round(up_ratio, 2),
            "ma60_above_ratio": round(ma60_above_ratio, 2),
        },
    }


def get_confirmed_environment(
    current_label: str, 
    previous: Dict[str, Any] | None
) -> Dict[str, Any]:
    """
    状态确认期逻辑（2026-03-11 Step 2 新增）
    
    核心思路：
    - 只有连续 N 天（默认 2 天）信号一致，才确认跨档
    - 防止单日信号闪烁导致频繁调仓
    
    返回：
    - confirmed_label: 确认后的环境档位
    - days_in_state: 当前状态持续天数
    - pending_label: 待确认的新档位（如果有）
    - state_changed: 是否刚刚跨档
    """
    prev_state = (previous or {}).get("state_machine", {}) or {}
    prev_label = prev_state.get("confirmed_label", "混沌")
    prev_days = int(prev_state.get("days_in_state", 0) or 0)
    prev_pending = prev_state.get("pending_label")
    
    # 如果当天信号和当前确认状态一致
    if current_label == prev_label:
        return {
            "confirmed_label": prev_label,
            "days_in_state": prev_days + 1,
            "pending_label": None,
            "state_changed": False,
            "reasoning": f"环境档位延续：{prev_label}，已持续 {prev_days + 1} 天。",
        }
    
    # 如果当天信号和当前状态不一致
    # 检查是否有待确认的档位
    if prev_pending == current_label:
        # 已经是第二天收到相同的新信号，确认跨档
        return {
            "confirmed_label": current_label,
            "days_in_state": 1,
            "pending_label": None,
            "state_changed": True,
            "reasoning": f"环境跨档确认：{prev_label} → {current_label}（连续 2 天信号一致）。",
        }
    else:
        # 第一天收到新信号，进入待确认状态
        # 当前仍维持原档位，但记录待确认信号
        return {
            "confirmed_label": prev_label,
            "days_in_state": prev_days,
            "pending_label": current_label,
            "state_changed": False,
            "reasoning": f"收到 {current_label} 信号，但需连续 {STATE_CONFIRM_DAYS} 天确认，当前仍维持 {prev_label}。",
        }


def calculate_tracking_error(
    current_plan: Dict[str, Any],
    target_weights: Dict[str, float]
) -> Dict[str, Any]:
    """
    组合偏离度计算（2026-03-11 Step 3 新增）
    
    核心思路：
    - Tracking Error = sum(abs(当前权重 - 目标权重))
    - 只有偏离度 > 阈值才触发再平衡
    - 避免小幅度频繁调仓
    
    返回：
    - tracking_error: 偏离度
    - should_rebalance: 是否需要再平衡
    - bucket_deviations: 各桶偏离明细
    """
    weight_keys = [
        "true_defensive_weight", "equity_defensive_weight",
        "core_weight", "satellite_weight"
    ]
    
    deviations = {}
    total_deviation = 0.0
    
    for key in weight_keys:
        current = float(current_plan.get(key, 0) or 0)
        target = float(target_weights.get(key, 0) or 0)
        deviation = abs(current - target)
        deviations[key] = {
            "current": round(current, 2),
            "target": round(target, 2),
            "deviation": round(deviation, 2),
        }
        total_deviation += deviation
    
    should_rebalance = total_deviation > TRACKING_ERROR_THRESHOLD
    
    return {
        "tracking_error": round(total_deviation, 2),
        "threshold": TRACKING_ERROR_THRESHOLD,
        "should_rebalance": should_rebalance,
        "bucket_deviations": deviations,
        "reasoning": f"组合偏离度 {total_deviation:.2f}% {'>' if should_rebalance else '≤'} 阈值 {TRACKING_ERROR_THRESHOLD}%，{'触发' if should_rebalance else '不触发'}再平衡。",
    }


def check_drawdown_circuit_breaker(
    previous: Dict[str, Any] | None,
    current_env: str
) -> Dict[str, Any]:
    """
    最大回撤熔断检查（2026-03-11 Step 3 新增）
    
    核心思路：
    - 如果组合净值从高点回撤超过阈值，强制进入防守档
    - 熔断后维持 N 天，期间不响应环境信号
    - 守住绝对收益底线
    
    返回：
    - circuit_breaker_active: 熔断是否激活
    - forced_env: 强制档位（如果熔断）
    - days_remaining: 熔断剩余天数
    """
    circuit_state = (previous or {}).get("circuit_breaker", {}) or {}
    
    # 如果已经在熔断期
    if circuit_state.get("active"):
        days_remaining = int(circuit_state.get("days_remaining", 0) or 0) - 1
        if days_remaining > 0:
            return {
                "circuit_breaker_active": True,
                "forced_env": "防守",
                "days_remaining": days_remaining,
                "reasoning": f"熔断激活中，剩余 {days_remaining} 天，强制防守档。",
            }
        else:
            # 熔断结束
            return {
                "circuit_breaker_active": False,
                "forced_env": None,
                "days_remaining": 0,
                "reasoning": "熔断期结束，恢复正常环境判断。",
            }
    
    # 检查是否需要触发熔断（简化版：基于环境判断）
    # 真实场景应该基于组合净值计算
    # 这里用"连续 3 天防守档"作为触发条件
    env_history = (previous or {}).get("env_history", []) or []
    if len(env_history) >= 3 and all(e == "防守" for e in env_history[-3:]):
        return {
            "circuit_breaker_active": True,
            "forced_env": "防守",
            "days_remaining": CIRCUIT_BREAKER_DAYS,
            "reasoning": f"连续 3 天防守档，触发熔断，强制防守 {CIRCUIT_BREAKER_DAYS} 天。",
        }
    
    return {
        "circuit_breaker_active": False,
        "forced_env": None,
        "days_remaining": 0,
        "reasoning": "未触发熔断，正常环境判断。",
    }


def select_best_etf(
    pool_name: str,
    market_data: Dict[str, Any] | None = None
) -> Dict[str, Any]:
    """
    动态 ETF 优选（2026-03-11 Step 3 新增）
    
    核心思路：
    - 在同一池子内，根据近期表现动态选择最优 ETF
    - 评分维度：夏普比率、最大回撤、与当前环境匹配度
    - 简化版：返回推荐 ETF 列表，不依赖外部数据
    
    返回：
    - recommended: 推荐的 ETF 列表
    - pool_name: 池子名称
    - reasoning: 推荐理由
    """
    candidates = ETF_CANDIDATES.get(pool_name, [])
    
    if not candidates:
        return {
            "recommended": [],
            "pool_name": pool_name,
            "reasoning": f"池子 {pool_name} 无候选 ETF。",
        }
    
    # 简化版：根据池子类型返回默认推荐
    # 真实场景应该基于 ETF 近期表现评分
    if pool_name == "equity_defensive":
        # 权益防守池：优先红利低波 + 黄金对冲
        recommended = [
            {"code": "红利低波", "weight": 0.4, "reason": "长期稳健"},
            {"code": "央企价值", "weight": 0.3, "reason": "估值安全"},
            {"code": "黄金", "weight": 0.3, "reason": "对冲股债双杀"},
        ]
    elif pool_name == "true_defensive":
        # 真防守池：优先短债 + 同业存单
        recommended = [
            {"code": "短债", "weight": 0.4, "reason": "低波动"},
            {"code": "同业存单", "weight": 0.3, "reason": "收益稳定"},
            {"code": "美元债", "weight": 0.3, "reason": "汇率对冲"},
        ]
    elif pool_name == "a_core":
        # A股核心：优先沪深300 + A500
        recommended = [
            {"code": "沪深300", "weight": 0.5, "reason": "大盘核心"},
            {"code": "中证A500", "weight": 0.5, "reason": "均衡配置"},
        ]
    elif pool_name == "h_core":
        # H股核心：恒生指数为主
        recommended = [
            {"code": "恒生国企", "weight": 0.6, "reason": "中资核心"},
            {"code": "恒生指数", "weight": 0.4, "reason": "港股宽基"},
        ]
    elif pool_name == "satellite":
        # 卫星池：恒生科技 + 中概互联
        recommended = [
            {"code": "恒生科技", "weight": 0.5, "reason": "港股成长"},
            {"code": "中概互联", "weight": 0.5, "reason": "互联网弹性"},
        ]
    else:
        recommended = [{"code": c["code"], "weight": 1.0, "reason": "默认"} for c in candidates[:1]]
    
    return {
        "recommended": recommended,
        "pool_name": pool_name,
        "reasoning": f"基于当前环境，推荐 {pool_name} 配置：{', '.join([r['code'] for r in recommended])}。",
    }


def apply_ewma_smoothing(
    target_weights: Dict[str, float],
    previous: Dict[str, Any] | None,
    alpha: float = EWMA_ALPHA,
    max_change: float = MAX_DAILY_CHANGE
) -> Dict[str, Any]:
    """
    EWMA 仓位平滑（2026-03-11 Step 2 新增）
    
    核心思路：
    - 实际仓位 = 昨日仓位 * (1-alpha) + 目标仓位 * alpha
    - 单日单桶变动不超过 max_change
    - 大切换分 3-5 天完成，避免断崖式调仓
    
    返回：
    - smoothed_weights: 平滑后的实际权重
    - target_weights: 目标权重（用于对比）
    - daily_changes: 各桶今日变动
    - smoothing_applied: 是否应用了平滑
    """
    prev_plan = (previous or {}).get("allocation_plan", {}) or {}
    
    if not prev_plan:
        # 无历史数据，直接使用目标权重
        return {
            "smoothed_weights": target_weights.copy(),
            "target_weights": target_weights.copy(),
            "daily_changes": {},
            "smoothing_applied": False,
            "reasoning": "无历史仓位数据，直接使用目标权重。",
        }
    
    weight_keys = [
        "true_defensive_weight", "equity_defensive_weight", 
        "core_weight", "satellite_weight",
        "a_share_weight", "h_share_weight"
    ]
    
    smoothed = {}
    changes = {}
    smoothing_needed = False
    
    for key in weight_keys:
        target = float(target_weights.get(key, 0) or 0)
        prev = float(prev_plan.get(key, 0) or 0)
        
        # EWMA 计算
        ewma_value = prev * (1 - alpha) + target * alpha
        
        # 限制单日最大变动
        delta = ewma_value - prev
        if abs(delta) > max_change:
            ewma_value = prev + (max_change if delta > 0 else -max_change)
            smoothing_needed = True
        elif abs(delta) > 0.1:  # 有变动但未超限
            smoothing_needed = True
        
        smoothed[key] = round(ewma_value, 2)
        changes[key] = {
            "prev": round(prev, 2),
            "target": round(target, 2),
            "actual": round(ewma_value, 2),
            "delta": round(ewma_value - prev, 2),
        }
    
    return {
        "smoothed_weights": smoothed,
        "target_weights": target_weights.copy(),
        "daily_changes": changes,
        "smoothing_applied": smoothing_needed,
        "reasoning": f"EWMA 平滑（α={alpha}），单日最大变动 {max_change}%。" if smoothing_needed else "目标与实际一致，无需平滑。",
    }

# 环境档位优先级（用于判断跨档方向）
ENV_PRIORITY = {"进攻": 4, "试错": 3, "混沌": 2, "防守": 1}

# 状态确认期配置
STATE_CONFIRM_DAYS = 2  # 连续 2 天才跨档

# EWMA 平滑配置
EWMA_ALPHA = 0.3  # 新权重占比 30%，旧权重占比 70%
MAX_DAILY_CHANGE = 10  # 单日单桶最大变动 10%

# === Step 3 新增配置 ===

# 组合偏离度触发阈值
TRACKING_ERROR_THRESHOLD = 12  # 偏离度 > 12% 才触发再平衡

# 最大回撤熔断配置
MAX_DRAWDOWN_THRESHOLD = 8  # 回撤 > 8% 触发熔断
CIRCUIT_BREAKER_DAYS = 14  # 熔断后强制防守 14 天

# ETF 池候选名单（用于动态优选）
ETF_CANDIDATES = {
    "equity_defensive": [
        {"code": "红利低波", "name": "中证红利低波 ETF", "type": "红利"},
        {"code": "中证红利", "name": "中证红利 ETF", "type": "红利"},
        {"code": "高股息", "name": "高股息 ETF", "type": "红利"},
        {"code": "央企价值", "name": "央企价值 ETF", "type": "价值"},
        {"code": "黄金", "name": "黄金 ETF", "type": "对冲"},
    ],
    "true_defensive": [
        {"code": "货币基金", "name": "货币基金", "type": "现金"},
        {"code": "短债", "name": "短债基金", "type": "债券"},
        {"code": "政金债", "name": "政金债指数基金", "type": "债券"},
        {"code": "同业存单", "name": "同业存单指数基金", "type": "债券"},
        {"code": "美元债", "name": "美元债 QDII", "type": "美元债"},
    ],
    "a_core": [
        {"code": "沪深300", "name": "沪深300 ETF", "type": "大盘"},
        {"code": "中证A500", "name": "中证A500 ETF", "type": "均衡"},
        {"code": "中证500", "name": "中证500 ETF", "type": "中盘"},
    ],
    "h_core": [
        {"code": "恒生指数", "name": "恒生指数 ETF", "type": "港股宽基"},
        {"code": "恒生国企", "name": "恒生国企 ETF", "type": "中资"},
    ],
    "satellite": [
        {"code": "恒生科技", "name": "恒生科技 ETF", "type": "科技"},
        {"code": "中概互联", "name": "中概互联网 ETF", "type": "科技"},
        {"code": "中证1000", "name": "中证1000增强", "type": "小盘"},
    ],
}


def build_index_strategy_result(input_data: Dict[str, Any], previous: Dict[str, Any] | None = None) -> Dict[str, Any]:
    market = input_data.get("market_snapshot", {}) or {}
    raw_env = detect_environment(market)
    raw_label = raw_env["label"]
    
    # === Step 2: 状态确认期 ===
    state_result = get_confirmed_environment(raw_label, previous)
    confirmed_label = state_result["confirmed_label"]
    
    # === Step 3: 最大回撤熔断检查 ===
    circuit_result = check_drawdown_circuit_breaker(previous, confirmed_label)
    if circuit_result.get("circuit_breaker_active"):
        # 熔断激活，强制进入防守档
        confirmed_label = circuit_result["forced_env"]
        state_result["circuit_breaker_override"] = True
    
    # 使用确认后的档位获取权重
    target_weights = WEIGHT_MAP[confirmed_label].copy()
    
    # === Step 2: EWMA 仓位平滑 ===
    smooth_result = apply_ewma_smoothing(target_weights, previous)
    actual_weights = smooth_result["smoothed_weights"]
    
    # 重新计算 total_equity_target（平滑后）
    actual_weights["total_equity_target"] = round(
        actual_weights.get("equity_defensive_weight", 0) +
        actual_weights.get("core_weight", 0) +
        actual_weights.get("satellite_weight", 0),
        2
    )
    
    # === Step 3: 组合偏离度检查 ===
    tracking_result = calculate_tracking_error(actual_weights, target_weights)
    
    # === Step 3: 动态 ETF 优选 ===
    etf_selections = {
        "true_defensive": select_best_etf("true_defensive", market),
        "equity_defensive": select_best_etf("equity_defensive", market),
        "a_core": select_best_etf("a_core", market),
        "h_core": select_best_etf("h_core", market),
        "satellite": select_best_etf("satellite", market),
    }

    fund_pool_focus = [
        f"真防守池：{', '.join([e['code'] for e in etf_selections['true_defensive']['recommended']])}",
        f"权益防守池：{', '.join([e['code'] for e in etf_selections['equity_defensive']['recommended']])}",
        f"A股核心池：{', '.join([e['code'] for e in etf_selections['a_core']['recommended']])}",
        f"H股核心池：{', '.join([e['code'] for e in etf_selections['h_core']['recommended']])}",
        f"卫星池：{', '.join([e['code'] for e in etf_selections['satellite']['recommended']])}",
    ]

    risk_flags: List[str] = []
    
    # 数据完整性检查
    if not market.get("northbound_net_inflow"):
        risk_flags.append("北向资金数据缺失，权重风格强度仍需人工补证")
    if not market.get("turnover_ma20") and not market.get("turnover_ratio"):
        risk_flags.append("缺少20日均量数据，使用绝对值 fallback，精度可能下降")
    if not market.get("ma60_above_ratio"):
        risk_flags.append("缺少MA60以上个股占比数据，环境判断可能不够精准")
    
    # 状态机相关提示
    if state_result.get("pending_label"):
        risk_flags.append(f"收到 {state_result['pending_label']} 信号，待连续确认后再跨档")
    if state_result.get("state_changed"):
        risk_flags.append(f"环境已跨档：{state_result.get('reasoning', '')}")
    
    # Step 3: 熔断相关提示
    if circuit_result.get("circuit_breaker_active"):
        risk_flags.append(f"⚠️ 熔断激活：{circuit_result.get('reasoning', '')}")
    
    # Step 3: 偏离度提示
    if tracking_result.get("should_rebalance"):
        risk_flags.append(f"组合偏离度 {tracking_result['tracking_error']:.2f}% > 阈值，建议再平衡")
    
    # 情绪过热/过冷提示
    if float(market.get("blowup_rate") or 0) >= 0.4:
        risk_flags.append("炸板率偏高，题材情绪可能过热，追高需谨慎")
    if int(market.get("limit_down_count") or 0) >= 15:
        risk_flags.append("跌停家数偏多，负反馈可能在扩散")
    
    if not risk_flags:
        risk_flags.append("当前未见极端风险，但仍需遵守仓位纪律")

    watch_points = [
        "先看环境档位是否延续，再决定是否维持当前总权益仓位",
        "观察宽基指数是否继续放量，确认核心仓是否需要加码",
        "观察主线是否继续强化，决定卫星仓是否维持或收缩",
    ]
    
    # Step 3: 熔断期间的观察点
    if circuit_result.get("circuit_breaker_active"):
        watch_points.insert(0, f"熔断激活中（剩余 {circuit_result.get('days_remaining', 0)} 天），优先防守")

    allocation_summary = (
        f"当前按{confirmed_label}档处理：总权益 {actual_weights['total_equity_target']}%，"
        f"真防守 {actual_weights['true_defensive_weight']}%，"
        f"核心仓 {actual_weights['core_weight']}%，卫星仓 {actual_weights['satellite_weight']}%。"
    )

    current_plan = {
        **actual_weights,
        "allocation_summary": allocation_summary,
    }
    rebalance_plan = build_rebalance_plan(current_plan, previous)
    
    # Step 3: 根据偏离度决定是否真的需要调仓
    if not tracking_result.get("should_rebalance") and rebalance_plan.get("needs_rebalance"):
        rebalance_plan["needs_rebalance"] = False
        rebalance_plan["rebalance_action"] = f"偏离度 {tracking_result['tracking_error']:.2f}% < 阈值 {TRACKING_ERROR_THRESHOLD}%，暂不调仓。"
        rebalance_plan["rebalance_reasoning"] = "组合偏离度未达阈值，避免小幅频繁调仓。"

    # 构建环境历史（用于熔断判断）
    env_history = (previous or {}).get("env_history", []) or []
    env_history.append(raw_label)
    env_history = env_history[-10:]  # 保留最近 10 天

    return {
        "environment_label": confirmed_label,
        "environment_reasoning": raw_env["reasoning"],
        "raw_environment_label": raw_label,
        "state_machine": {
            "confirmed_label": confirmed_label,
            "days_in_state": state_result["days_in_state"],
            "pending_label": state_result.get("pending_label"),
            "state_changed": state_result.get("state_changed", False),
        },
        "circuit_breaker": {
            "active": circuit_result.get("circuit_breaker_active", False),
            "days_remaining": circuit_result.get("days_remaining", 0),
            "reasoning": circuit_result.get("reasoning", ""),
        },
        "smoothing": {
            "applied": smooth_result["smoothing_applied"],
            "alpha": EWMA_ALPHA,
            "max_daily_change": MAX_DAILY_CHANGE,
            "daily_changes": smooth_result["daily_changes"],
        },
        "tracking_error": {
            "value": tracking_result["tracking_error"],
            "threshold": TRACKING_ERROR_THRESHOLD,
            "should_rebalance": tracking_result["should_rebalance"],
            "bucket_deviations": tracking_result["bucket_deviations"],
        },
        "etf_selections": etf_selections,
        "allocation_plan": current_plan,
        "rebalance_plan": rebalance_plan,
        "risk_flags": risk_flags,
        "watch_points": watch_points,
        "fund_pool_focus": fund_pool_focus,
        "env_history": env_history,
    }


def build_index_review_stub(result: Dict[str, Any], day_label: str = "Day X", trade_date: str | None = None) -> str:
    allocation = result["allocation_plan"]
    rebalance = result["rebalance_plan"]
    risk_flags = result.get("risk_flags", [])
    watch_points = result.get("watch_points", [])
    state_machine = result.get("state_machine", {})
    smoothing = result.get("smoothing", {})

    lines = [
        f"# 指数策略 {day_label} 复盘记录｜{trade_date or 'YYYY-MM-DD'}",
        "",
        "## 今日固定 5 句",
        f"1. **环境档位：** 待复盘（系统输出：{result['environment_label']}，持续 {state_machine.get('days_in_state', 1)} 天）",
        f"2. **总权益目标：** 待复盘（系统输出：{allocation['total_equity_target']}%）",
        f"3. **今日调仓动作：** 待复盘（系统输出：{rebalance['rebalance_action']}）",
        f"4. **今天最大风险：** 待复盘（系统输出：{risk_flags[0] if risk_flags else ''}）",
        f"5. **明天最该盯的点：** 待复盘（系统输出：{watch_points[0] if watch_points else ''}）",
        "",
        "## 状态机信息",
        f"- **确认档位：** {state_machine.get('confirmed_label', result['environment_label'])}",
        f"- **持续天数：** {state_machine.get('days_in_state', 1)} 天",
        f"- **待确认信号：** {state_machine.get('pending_label') or '无'}",
        f"- **今日跨档：** {'是' if state_machine.get('state_changed') else '否'}",
        "",
        "## 仓位平滑信息",
        f"- **是否应用平滑：** {'是' if smoothing.get('applied') else '否'}",
        f"- **平滑系数 α：** {smoothing.get('alpha', 0.3)}",
        f"- **单日最大变动：** {smoothing.get('max_daily_change', 10)}%",
        "",
        "## 组合层复盘",
        "- **环境判断是否准确：** 准确 / 一般 / 偏差较大",
        "- **仓位建议是否合理：** 合理 / 偏激进 / 偏保守",
        "- **调仓动作是否合理：** 合理 / 偏激进 / 偏保守",
        "- **A/H 配比是否合理：** 合理 / 偏激进 / 偏保守",
        "- **一句话总结：** ",
        "",
        "## 今日配置快照",
        f"- 真防守：{allocation['true_defensive_weight']}%",
        f"- 权益防守：{allocation['equity_defensive_weight']}%",
        f"- 核心仓：{allocation['core_weight']}%",
        f"- 卫星仓：{allocation['satellite_weight']}%",
        f"- A股 / H股：{allocation['a_share_weight']}% / {allocation['h_share_weight']}%",
        "",
        "## 调仓复盘",
        f"- 是否需要调仓：{'是' if rebalance['needs_rebalance'] else '否'}",
        f"- 调仓理由：{rebalance['rebalance_reasoning']}",
        "- 最大正确点：",
        "- 最大误判点：",
        "",
        "## 次日修正重点",
        "- 环境档位是否延续",
        "- 宽基是否继续放量 / 缩量",
        "- 卫星仓是否该继续打开或及时收缩",
        "",
    ]
    return "\n".join(lines)


def render_index_strategy_report(result: Dict[str, Any]) -> str:
    allocation = result["allocation_plan"]
    rebalance = result["rebalance_plan"]
    risk_flags = result.get("risk_flags", [])
    watch_points = result.get("watch_points", [])
    fund_pool_focus = result.get("fund_pool_focus", [])
    state_machine = result.get("state_machine", {})
    smoothing = result.get("smoothing", {})
    circuit_breaker = result.get("circuit_breaker", {})
    tracking_error = result.get("tracking_error", {})
    etf_selections = result.get("etf_selections", {})

    lines = [
        "# 指数策略日报",
        "",
        "## 当日结论",
        f"1. **环境档位：** {result['environment_label']}（持续 {state_machine.get('days_in_state', 1)} 天）",
        f"2. **总权益目标：** {allocation['total_equity_target']}%",
        f"3. **今日是否调仓：** {'是' if rebalance['needs_rebalance'] else '否'}",
        f"4. **最重要风险：** {risk_flags[0] if risk_flags else '暂无'}",
        f"5. **明天最该盯的点：** {watch_points[0] if watch_points else '暂无'}",
    ]
    
    # Step 3: 熔断状态
    if circuit_breaker.get("active"):
        lines.extend([
            "",
            "## ⚠️ 熔断状态",
            f"- **熔断激活：** 是",
            f"- **剩余天数：** {circuit_breaker.get('days_remaining', 0)} 天",
            f"- **强制档位：** 防守",
            f"- **原因：** {circuit_breaker.get('reasoning', '')}",
        ])
    
    lines.extend([
        "",
        "## 状态机状态",
        f"- **确认档位：** {state_machine.get('confirmed_label', result['environment_label'])}",
        f"- **持续天数：** {state_machine.get('days_in_state', 1)} 天",
        f"- **待确认信号：** {state_machine.get('pending_label') or '无'}",
        f"- **今日跨档：** {'是 ✅' if state_machine.get('state_changed') else '否'}",
    ])
    
    # Step 3: 偏离度
    lines.extend([
        "",
        "## 组合偏离度",
        f"- **当前偏离度：** {tracking_error.get('value', 0):.2f}%",
        f"- **触发阈值：** {tracking_error.get('threshold', 12)}%",
        f"- **是否需要再平衡：** {'是' if tracking_error.get('should_rebalance') else '否'}",
    ])
    
    lines.extend([
        "",
        "## 配置建议（平滑后）",
        f"- **真防守：** {allocation['true_defensive_weight']}%",
        f"- **权益防守：** {allocation['equity_defensive_weight']}%",
        f"- **核心仓：** {allocation['core_weight']}%",
        f"- **卫星仓：** {allocation['satellite_weight']}%",
        f"- **A股 / H股：** {allocation['a_share_weight']}% / {allocation['h_share_weight']}%",
        f"- **一句话总结：** {allocation['allocation_summary']}",
        "",
        "## 仓位平滑说明",
    ])
    
    if smoothing.get("applied"):
        lines.append(f"- **平滑系数 α：** {smoothing.get('alpha', 0.3)}（目标权重占 30%）")
        lines.append(f"- **单日最大变动：** {smoothing.get('max_daily_change', 10)}%")
        daily_changes = smoothing.get("daily_changes", {})
        if daily_changes:
            lines.append("- **各桶变动：**")
            for key, change in daily_changes.items():
                if abs(change.get("delta", 0)) > 0.1:
                    lines.append(f"  - {key}: {change['prev']}% → {change['actual']}%（目标 {change['target']}%）")
    else:
        lines.append("- 今日无需平滑，目标与实际一致")
    
    # Step 3: ETF 推荐
    lines.extend([
        "",
        "## ETF 推荐（动态优选）",
    ])
    for pool_name, selection in etf_selections.items():
        if selection.get("recommended"):
            etf_list = ", ".join([f"{e['code']}({e['weight']*100:.0f}%)" for e in selection["recommended"]])
            lines.append(f"- **{pool_name}：** {etf_list}")
    
    lines.extend([
        "",
        "## 调仓建议",
        f"- **动作：** {rebalance['rebalance_action']}",
        f"- **理由：** {rebalance['rebalance_reasoning']}",
        "",
        "## 风险提示",
    ])
    lines.extend([f"- {x}" for x in risk_flags] or ["- 暂无"])
    lines.append("")
    lines.append("## 观察点")
    lines.extend([f"- {x}" for x in watch_points] or ["- 暂无"])
    lines.append("")
    lines.append("## 关注基金池")
    lines.extend([f"- {x}" for x in fund_pool_focus] or ["- 暂无"])
    lines.append("")
    return "\n".join(lines)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Master index strategy minimal runner")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT, help="input json path when source=file")
    parser.add_argument("--source", default="live-akshare", choices=["file", "example", "live", "live-akshare"], help="input source")
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT, help="output directory")
    parser.add_argument("--fallback-example-output-on-fail", action="store_true", help="fallback to example input when collection fails")
    parser.add_argument("--reviews-dir", type=Path, default=DEFAULT_REVIEWS_DIR, help="directory for day review archives")
    parser.add_argument("--day-label", default="", help="optional day label such as day1/day2")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    ensure_dir(args.out_dir)

    try:
        if args.source == "file":
            input_data = load_and_build(args.input)
        else:
            input_data = collect_input(
                CollectorConfig(source=args.source, use_example_fallback=args.fallback_example_output_on_fail)
            )

        previous = load_previous_result(args.out_dir / "index-strategy.json")
        result = build_index_strategy_result(input_data, previous=previous)
        write_json(args.out_dir / "index-strategy.json", result)
        (args.out_dir / "index-strategy.md").write_text(render_index_strategy_report(result), encoding="utf-8")

        trade_date = str((input_data.get("market_snapshot") or {}).get("trade_date") or "")
        day_label = args.day_label.strip() or "day-current"
        review_content = build_index_review_stub(result, day_label=day_label, trade_date=trade_date)
        write_paper_review_stub(args.out_dir / "current-review.md", review_content)
        ensure_dir(args.reviews_dir)
        review_name = f"{day_label}-review.md" if args.day_label.strip() else (f"{trade_date}-review.md" if trade_date else "current-review.md")
        write_paper_review_stub(args.reviews_dir / review_name, review_content)

        print(f"[IndexStrategy] wrote: {args.out_dir / 'index-strategy.json'}")
        print(f"[IndexStrategy] wrote: {args.out_dir / 'index-strategy.md'}")
        print(f"[IndexStrategy] wrote: {args.out_dir / 'current-review.md'}")
        print(f"[IndexStrategy] wrote: {args.reviews_dir / review_name}")
        return 0
    except Exception as exc:
        write_json(args.out_dir / "error.json", {"error": str(exc), "source": args.source})
        print(f"[IndexStrategy] failed: {exc}")
        print(f"[IndexStrategy] wrote: {args.out_dir / 'error.json'}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
