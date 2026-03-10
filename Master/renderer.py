from __future__ import annotations

from typing import Any, Dict, List


def render_report(result: Dict[str, Any]) -> str:
    mo = result["market_overview"]
    sectors = result.get("sector_analysis", [])
    stocks = result.get("stock_analysis", [])

    def top_by_action(items: List[Dict[str, Any]], target: str, limit: int = 3) -> List[Dict[str, Any]]:
        filtered = [x for x in items if x.get("action") == target]
        return sorted(filtered, key=lambda x: x.get("signal_score", x.get("sector_score", 0)), reverse=True)[:limit]

    focus = top_by_action(stocks, "重点跟踪") or top_by_action(stocks, "可择机建仓")
    trials = top_by_action(stocks, "小仓试错")
    avoids = top_by_action(stocks, "回避")

    lines = []
    lines.append(f"# Master 日报｜{mo.get('main_theme', '未命名市场日')}")
    lines.append("")
    lines.append("## 今日一句话结论")
    lines.append(f"{mo.get('recommended_style', '')}；{mo.get('forbidden_style', '')}。")
    lines.append("")
    lines.append("## 今日环境结论")
    lines.append(f"- **环境标签：** {mo.get('environment_label', '')}")
    lines.append(f"- **情绪周期：** {mo.get('emotion_cycle', '')}")
    lines.append(f"- **综合判断：** {mo.get('environment_reasoning', '')}")
    lines.append(f"- **今日适合：** {mo.get('recommended_style', '')}")
    lines.append(f"- **今日严禁：** {mo.get('forbidden_style', '')}")
    lines.append("")
    lines.append("## 主线与轮动")
    lines.append(f"- **当前主线：** {mo.get('main_theme', '')}")
    lines.append(f"- **次主线：** {mo.get('secondary_theme', '')}")
    lines.append(f"- **退潮方向：** {mo.get('retreat_theme', '')}")
    for s in sectors[:3]:
        lines.append("")
        lines.append(f"### {s.get('sector_name', '')}")
        lines.append(f"- **阶段：** {s.get('sector_stage', '')}")
        lines.append(f"- **健康度：** {s.get('health_status', '')}")
        lines.append(f"- **建议动作：** {s.get('action', '')}")
        lines.append(f"- **判断：** {s.get('sector_reasoning', '')}")
    lines.append("")
    lines.append("## 重点跟踪")
    for stock in focus[:3]:
        lines.append(f"- **{stock.get('name')}（{stock.get('symbol')}）**｜{stock.get('stock_role')}｜{stock.get('signal_type')}｜{stock.get('action')}")
        lines.append(f"  - 理由：{stock.get('action_reasoning', '')}")
        lines.append(f"  - 风险：{stock.get('risk_warning', '')}")
    if not focus:
        lines.append("- 暂无")
    lines.append("")
    lines.append("## 小仓试错")
    for stock in trials[:3]:
        lines.append(f"- **{stock.get('name')}（{stock.get('symbol')}）**｜{stock.get('stock_role')}｜{stock.get('signal_type')}｜{stock.get('action')}")
        lines.append(f"  - 理由：{stock.get('action_reasoning', '')}")
    if not trials:
        lines.append("- 暂无")
    lines.append("")
    lines.append("## 高风险回避")
    for stock in avoids[:3]:
        lines.append(f"- **{stock.get('name')}（{stock.get('symbol')}）**｜{stock.get('stock_role')}｜{stock.get('action')}")
        lines.append(f"  - 原因：{stock.get('risk_warning', '') or stock.get('action_reasoning', '')}")
    if not avoids:
        lines.append("- 暂无")
    return "\n".join(lines) + "\n"


def render_candidate_pool(result: Dict[str, Any]) -> str:
    stocks = result.get("stock_analysis", [])

    def by_actions(actions: List[str], limit: int = 10) -> List[Dict[str, Any]]:
        filtered = [x for x in stocks if x.get("action") in actions]
        return sorted(filtered, key=lambda x: x.get("signal_score", 0), reverse=True)[:limit]

    focus = by_actions(["重点跟踪", "可择机建仓", "可趋势持有"], 3)
    trial = by_actions(["小仓试错"], 3)
    observe = by_actions(["观察"], 5)
    avoid = by_actions(["回避", "减仓", "退出"], 5)
    all_ranked = sorted(stocks, key=lambda x: x.get("signal_score", 0), reverse=True)[:10]

    lines = []
    lines.append("# Master 候选池")
    lines.append("")
    lines.append("## Top 3 重点跟踪")
    for i, s in enumerate(focus, 1):
        lines.append(f"### {i}. {s.get('name')}（{s.get('symbol')}）")
        lines.append(f"- **角色定位：** {s.get('stock_role')}")
        lines.append(f"- **当前信号：** {s.get('signal_type')}")
        lines.append(f"- **建议动作：** {s.get('action')}")
        lines.append(f"- **入选理由：** {s.get('action_reasoning')}")
        lines.append(f"- **失效条件：** {s.get('invalid_condition', '')}")
    if not focus:
        lines.append("- 暂无")
    lines.append("")
    lines.append("## Top 3 小仓试错")
    for i, s in enumerate(trial, 1):
        lines.append(f"### {i}. {s.get('name')}（{s.get('symbol')}）")
        lines.append(f"- **角色定位：** {s.get('stock_role')}")
        lines.append(f"- **当前信号：** {s.get('signal_type')}")
        lines.append(f"- **建议动作：** {s.get('action')}")
        lines.append(f"- **试错逻辑：** {s.get('action_reasoning')}")
    if not trial:
        lines.append("- 暂无")
    lines.append("")
    lines.append("## 观察名单")
    for i, s in enumerate(observe, 1):
        lines.append(f"### {i}. {s.get('name')}（{s.get('symbol')}）")
        lines.append(f"- **角色定位：** {s.get('stock_role')}")
        lines.append(f"- **当前状态：** {s.get('signal_reasoning')}")
        lines.append(f"- **建议动作：** {s.get('action')}")
    if not observe:
        lines.append("- 暂无")
    lines.append("")
    lines.append("## 高风险回避名单")
    for i, s in enumerate(avoid, 1):
        lines.append(f"### {i}. {s.get('name')}（{s.get('symbol')}）")
        lines.append(f"- **角色定位：** {s.get('stock_role')}")
        lines.append(f"- **建议动作：** {s.get('action')}")
        lines.append(f"- **回避理由：** {s.get('risk_warning') or s.get('action_reasoning')}")
    if not avoid:
        lines.append("- 暂无")
    lines.append("")
    lines.append("## Top 10 全量候选排序")
    lines.append("")
    lines.append("| 排名 | 股票 | 角色 | 当前信号 | 动作 |")
    lines.append("|---|---|---|---|---|")
    for i, s in enumerate(all_ranked, 1):
        lines.append(f"| {i} | {s.get('name')}（{s.get('symbol')}） | {s.get('stock_role')} | {s.get('signal_type')} | {s.get('action')} |")
    return "\n".join(lines) + "\n"
