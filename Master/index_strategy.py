#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict, List

from builder import load_and_build
from collector import CollectorConfig, collect_input

ROOT = Path(__file__).resolve().parent
DEFAULT_INPUT = ROOT / "examples" / "input-example.json"
DEFAULT_OUT = ROOT / "out-index-strategy"


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
    turnover = float(market.get("market_turnover_total") or 0)
    up_count = int(market.get("up_count") or 0)
    down_count = int(market.get("down_count") or 0)
    limit_up = int(market.get("limit_up_count") or 0)
    limit_down = int(market.get("limit_down_count") or 0)
    blowup_rate = float(market.get("blowup_rate") or 0)
    highest_board = int(market.get("highest_board") or 0)

    if turnover >= 2.0e12 and up_count >= 3500 and limit_up >= 50 and limit_down <= 10 and blowup_rate <= 0.35:
        return {
            "label": "进攻",
            "reasoning": "成交额、上涨家数、涨停跌停结构都支持较强风险偏好，市场允许提高权益暴露，但因连板高度仍有限，不宜无脑推满。",
        }
    if turnover >= 1.2e12 and up_count >= 2500 and limit_up >= 25 and limit_down <= 20 and blowup_rate <= 0.45:
        return {
            "label": "试错",
            "reasoning": "市场存在赚钱效应，但主线与高度确认仍不足，更适合中等权益仓位下的谨慎进攻。",
        }
    if limit_down >= 20 or blowup_rate >= 0.5 or up_count < down_count:
        return {
            "label": "防守",
            "reasoning": "负反馈开始主导，炸板率或跌停压力偏高，优先保护净值而不是追求弹性。",
        }
    return {
        "label": "混沌",
        "reasoning": "市场并非极弱，但风格和方向不够统一，适合降低仓位、等待更清晰的确认。",
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
        "真防守池：货币基金 / 短债基金 / 政金债指数基金 / 同业存单指数基金",
        "权益防守池：红利低波 ETF / 中证红利 ETF / 高股息 ETF / 央企价值 ETF",
        "A股核心池：沪深300 ETF / 中证A500 ETF / 中证500 ETF",
        "H股核心池：恒生指数 ETF / 恒生国企 ETF",
        "卫星池：恒生科技 ETF / 中概互联网 ETF / 中证1000增强",
    ]

    risk_flags: List[str] = []
    if not market.get("northbound_net_inflow"):
        risk_flags.append("北向资金数据缺失，权重风格强度仍需人工补证")
    if float(market.get("blowup_rate") or 0) >= 0.3:
        risk_flags.append("炸板率不低，卫星仓扩张需克制")
    if int(market.get("highest_board") or 0) <= 5:
        risk_flags.append("连板高度一般，题材进攻不可过度外推")
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

        print(f"[IndexStrategy] wrote: {args.out_dir / 'index-strategy.json'}")
        print(f"[IndexStrategy] wrote: {args.out_dir / 'index-strategy.md'}")
        return 0
    except Exception as exc:
        write_json(args.out_dir / "error.json", {"error": str(exc), "source": args.source})
        print(f"[IndexStrategy] failed: {exc}")
        print(f"[IndexStrategy] wrote: {args.out_dir / 'error.json'}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
