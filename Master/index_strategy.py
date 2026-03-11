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


WEIGHT_MAP: Dict[str, Dict[str, float]] = {
    "进攻": {
        "total_equity_target": 80,
        "true_defensive_weight": 20,
        "equity_defensive_weight": 20,
        "core_weight": 45,
        "satellite_weight": 15,
        "a_share_weight": 65,
        "h_share_weight": 35,
    },
    "试错": {
        "total_equity_target": 55,
        "true_defensive_weight": 45,
        "equity_defensive_weight": 25,
        "core_weight": 25,
        "satellite_weight": 5,
        "a_share_weight": 70,
        "h_share_weight": 30,
    },
    "混沌": {
        "total_equity_target": 35,
        "true_defensive_weight": 65,
        "equity_defensive_weight": 20,
        "core_weight": 15,
        "satellite_weight": 0,
        "a_share_weight": 75,
        "h_share_weight": 25,
    },
    "防守": {
        "total_equity_target": 10,
        "true_defensive_weight": 90,
        "equity_defensive_weight": 10,
        "core_weight": 0,
        "satellite_weight": 0,
        "a_share_weight": 100,
        "h_share_weight": 0,
    },
}


def build_index_strategy_result(input_data: Dict[str, Any], previous: Dict[str, Any] | None = None) -> Dict[str, Any]:
    market = input_data.get("market_snapshot", {}) or {}
    env = detect_environment(market)
    label = env["label"]
    weights = WEIGHT_MAP[label].copy()

    fund_pool_focus = [
        "真防守池：货币基金 / 短债基金 / 政金债指数基金 / 同业存单指数基金 / 美元债 QDII",
        "权益防守池：红利低波 ETF / 中证红利 ETF / 高股息 ETF / 央企价值 ETF / 黄金 ETF",
        "A股核心池：沪深300 ETF / 中证A500 ETF / 中证500 ETF",
        "H股核心池：恒生指数 ETF / 恒生国企 ETF",
        "卫星池：恒生科技 ETF / 中概互联网 ETF / 中证1000增强",
    ]

    risk_flags: List[str] = []
    
    # 数据完整性检查
    if not market.get("northbound_net_inflow"):
        risk_flags.append("北向资金数据缺失，权重风格强度仍需人工补证")
    if not market.get("turnover_ma20") and not market.get("turnover_ratio"):
        risk_flags.append("缺少20日均量数据，使用绝对值 fallback，精度可能下降")
    if not market.get("ma60_above_ratio"):
        risk_flags.append("缺少MA60以上个股占比数据，环境判断可能不够精准")
    
    # 情绪过热/过冷提示（不作为主判断，但需要警惕）
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

    allocation_summary = (
        f"当前按{label}档处理：总权益 {weights['total_equity_target']}%，"
        f"真防守 {weights['true_defensive_weight']}%，"
        f"核心仓 {weights['core_weight']}%，卫星仓 {weights['satellite_weight']}%。"
    )

    current_plan = {
        **weights,
        "allocation_summary": allocation_summary,
    }
    rebalance_plan = build_rebalance_plan(current_plan, previous)

    return {
        "environment_label": label,
        "environment_reasoning": env["reasoning"],
        "allocation_plan": current_plan,
        "rebalance_plan": rebalance_plan,
        "risk_flags": risk_flags,
        "watch_points": watch_points,
        "fund_pool_focus": fund_pool_focus,
    }


def build_index_review_stub(result: Dict[str, Any], day_label: str = "Day X", trade_date: str | None = None) -> str:
    allocation = result["allocation_plan"]
    rebalance = result["rebalance_plan"]
    risk_flags = result.get("risk_flags", [])
    watch_points = result.get("watch_points", [])

    lines = [
        f"# 指数策略 {day_label} 复盘记录｜{trade_date or 'YYYY-MM-DD'}",
        "",
        "## 今日固定 5 句",
        f"1. **环境档位：** 待复盘（系统输出：{result['environment_label']}）",
        f"2. **总权益目标：** 待复盘（系统输出：{allocation['total_equity_target']}%）",
        f"3. **今日调仓动作：** 待复盘（系统输出：{rebalance['rebalance_action']}）",
        f"4. **今天最大风险：** 待复盘（系统输出：{risk_flags[0] if risk_flags else ''}）",
        f"5. **明天最该盯的点：** 待复盘（系统输出：{watch_points[0] if watch_points else ''}）",
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

    lines = [
        "# 指数策略日报",
        "",
        "## 当日结论",
        f"1. **环境档位：** {result['environment_label']}",
        f"2. **总权益目标：** {allocation['total_equity_target']}%",
        f"3. **今日是否调仓：** {'是' if rebalance['needs_rebalance'] else '否'}",
        f"4. **最重要风险：** {risk_flags[0] if risk_flags else '暂无'}",
        f"5. **明天最该盯的点：** {watch_points[0] if watch_points else '暂无'}",
        "",
        "## 配置建议",
        f"- **真防守：** {allocation['true_defensive_weight']}%",
        f"- **权益防守：** {allocation['equity_defensive_weight']}%",
        f"- **核心仓：** {allocation['core_weight']}%",
        f"- **卫星仓：** {allocation['satellite_weight']}%",
        f"- **A股 / H股：** {allocation['a_share_weight']}% / {allocation['h_share_weight']}%",
        f"- **一句话总结：** {allocation['allocation_summary']}",
        "",
        "## 调仓建议",
        f"- **动作：** {rebalance['rebalance_action']}",
        f"- **理由：** {rebalance['rebalance_reasoning']}",
        "",
        "## 风险提示",
    ]
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
