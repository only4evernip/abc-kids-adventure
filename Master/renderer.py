from __future__ import annotations

from typing import Any, Dict, List


def render_report(result: Dict[str, Any]) -> str:
    mo = result["market_overview"]
    sectors = result.get("sector_analysis", [])
    allocation = result.get("allocation_plan", {})

    def display(value: Any, fallback: str = "待补实时数据") -> Any:
        return fallback if value is None or value == "" else value

    def top_sectors(actions: List[str], limit: int = 3) -> List[Dict[str, Any]]:
        filtered = [x for x in sectors if x.get("action") in actions]
        return sorted(filtered, key=lambda x: x.get("sector_score", 0), reverse=True)[:limit]

    main_watch = top_sectors(["重点跟踪", "可择机参与"], 3)
    trial_watch = top_sectors(["小仓试错", "观察"], 3)
    avoid_watch = top_sectors(["回避", "减仓", "退出"], 3)

    lines = []
    lines.append(f"# Master 指数复盘｜{mo.get('main_theme', '未命名市场日')}")
    lines.append("")
    lines.append("## 当日复盘判断")
    lines.append(f"1. **今天环境判断：** {mo.get('environment_label', '')} / {mo.get('emotion_cycle', '')}")
    lines.append(f"2. **今天主线识别：** {mo.get('main_theme', '')}；次主线：{mo.get('secondary_theme', '')}；退潮方向：{mo.get('retreat_theme', '')}")
    lines.append(f"3. **今天最有效信号：** {mo.get('recommended_style', '')}")
    risk_flags = mo.get('risk_flags', []) or []
    lines.append(f"4. **今天最大风险：** {risk_flags[0] if risk_flags else mo.get('forbidden_style', '')}")
    lines.append("5. **明天最该盯的点：** 先看环境是否延续，再看主线是否强化，最后看退潮方向是否继续出清")
    lines.append("")
    lines.append("## 结论先行")
    lines.append(f"- **今日适合：** {mo.get('recommended_style', '')}")
    lines.append(f"- **今日严禁：** {mo.get('forbidden_style', '')}")
    lines.append(f"- **环境理由：** {mo.get('environment_reasoning', '')}")
    lines.append(f"- **情绪理由：** {mo.get('emotion_cycle_reasoning', '')}")
    lines.append("")
    lines.append("## 市场情绪骨架")
    lines.append(f"- **涨停数：** {mo.get('limit_up_count', '')}")
    lines.append(f"- **跌停数：** {mo.get('limit_down_count', '')}")
    lines.append(f"- **炸板率：** {mo.get('blowup_rate', '')}")
    lines.append(f"- **最高板：** {mo.get('highest_board', '')}")
    if allocation:
        lines.append("")
        lines.append("## 基金组合配置建议")
        lines.append(f"- **总权益目标仓位：** {allocation.get('total_equity_target', '')}%")
        lines.append(f"- **真防守：** {allocation.get('true_defensive_weight', '')}%")
        lines.append(f"- **权益防守：** {allocation.get('equity_defensive_weight', '')}%")
        lines.append(f"- **核心仓：** {allocation.get('core_weight', '')}%")
        lines.append(f"- **卫星仓：** {allocation.get('satellite_weight', '')}%")
        lines.append(f"- **A股 / H股：** {allocation.get('a_share_weight', '')}% / {allocation.get('h_share_weight', '')}%")
        lines.append(f"- **执行动作：** {allocation.get('rebalance_action', '')}")
        lines.append(f"- **配置理由：** {allocation.get('plan_reasoning', '')}")
        pool = allocation.get('fund_pool_focus', []) or []
        if pool:
            lines.append("- **关注基金池：**")
            for item in pool:
                lines.append(f"  - {item}")
        buckets = allocation.get('execution_buckets', []) or []
        if buckets:
            lines.append("- **执行清单：**")
            for bucket in buckets:
                funds = " / ".join(bucket.get('funds', []) or [])
                lines.append(f"  - {bucket.get('bucket_name')}：{bucket.get('bucket_weight')}%｜{funds}")
    lines.append("")
    lines.append("## 主线与轮动观察")
    for s in sectors[:5]:
        lines.append("")
        lines.append(f"### {s.get('sector_name', '')}")
        lines.append(f"- **阶段：** {s.get('sector_stage', '')}")
        lines.append(f"- **健康度：** {s.get('health_status', '')}")
        lines.append(f"- **建议动作：** {s.get('action', '')}")
        lines.append(f"- **板块情绪：** 涨停 {display(s.get('theme_limit_up_count'))} / 炸板 {display(s.get('theme_blowup_count'))} / 最高板 {display(s.get('theme_highest_board'))}")
        lines.append(f"- **判断：** {s.get('sector_reasoning', '')}")
    lines.append("")
    lines.append("## 指数模式动作清单")
    lines.append("### 重点盯")
    if main_watch:
        for s in main_watch:
            lines.append(f"- **{s.get('sector_name')}**｜{s.get('sector_stage')}｜{s.get('action')}｜{s.get('action_reasoning', '')}")
    else:
        lines.append("- 暂无")
    lines.append("")
    lines.append("### 可观察")
    if trial_watch:
        for s in trial_watch:
            lines.append(f"- **{s.get('sector_name')}**｜{s.get('sector_stage')}｜{s.get('action')}｜{s.get('action_reasoning', '')}")
    else:
        lines.append("- 暂无")
    lines.append("")
    lines.append("### 应回避")
    if avoid_watch:
        for s in avoid_watch:
            lines.append(f"- **{s.get('sector_name')}**｜{s.get('sector_stage')}｜{s.get('action')}｜{s.get('action_reasoning', '')}")
    else:
        lines.append("- 暂无")
    return "\n".join(lines) + "\n"


def render_candidate_pool(result: Dict[str, Any]) -> str:
    sectors = result.get("sector_analysis", [])

    def display(value: Any, fallback: str = "待补实时数据") -> Any:
        return fallback if value is None or value == "" else value

    def by_actions(actions: List[str], limit: int = 10) -> List[Dict[str, Any]]:
        filtered = [x for x in sectors if x.get("action") in actions]
        return sorted(filtered, key=lambda x: x.get("sector_score", 0), reverse=True)[:limit]

    focus = by_actions(["重点跟踪", "可择机参与"], 3)
    trial = by_actions(["小仓试错", "观察"], 5)
    avoid = by_actions(["回避", "减仓", "退出"], 5)
    all_ranked = sorted(sectors, key=lambda x: x.get("sector_score", 0), reverse=True)[:10]

    lines = []
    lines.append("# Master 指数模式观察清单")
    lines.append("")
    lines.append("## Top 3 主线重点盯")
    for i, s in enumerate(focus, 1):
        lines.append(f"### {i}. {s.get('sector_name')}")
        lines.append(f"- **阶段：** {s.get('sector_stage')}")
        lines.append(f"- **健康度：** {s.get('health_status')}")
        lines.append(f"- **建议动作：** {s.get('action')}")
        lines.append(f"- **板块情绪：** 涨停 {display(s.get('theme_limit_up_count'))} / 炸板 {display(s.get('theme_blowup_count'))} / 最高板 {display(s.get('theme_highest_board'))}")
        lines.append(f"- **观察理由：** {s.get('action_reasoning')}")
    if not focus:
        lines.append("- 暂无")
    lines.append("")
    lines.append("## 次主线 / 试错观察")
    for i, s in enumerate(trial, 1):
        lines.append(f"### {i}. {s.get('sector_name')}")
        lines.append(f"- **阶段：** {s.get('sector_stage')}")
        lines.append(f"- **建议动作：** {s.get('action')}")
        lines.append(f"- **板块情绪：** 涨停 {display(s.get('theme_limit_up_count'))} / 炸板 {display(s.get('theme_blowup_count'))} / 最高板 {display(s.get('theme_highest_board'))}")
        lines.append(f"- **观察理由：** {s.get('action_reasoning')}")
    if not trial:
        lines.append("- 暂无")
    lines.append("")
    lines.append("## 回避方向")
    for i, s in enumerate(avoid, 1):
        lines.append(f"### {i}. {s.get('sector_name')}")
        lines.append(f"- **阶段：** {s.get('sector_stage')}")
        lines.append(f"- **建议动作：** {s.get('action')}")
        lines.append(f"- **回避理由：** {s.get('action_reasoning')}")
    if not avoid:
        lines.append("- 暂无")
    lines.append("")
    lines.append("## Top 10 板块强度排序")
    lines.append("")
    lines.append("| 排名 | 板块 | 阶段 | 健康度 | 动作 | 分数 |")
    lines.append("|---|---|---|---|---|---|")
    for i, s in enumerate(all_ranked, 1):
        lines.append(f"| {i} | {s.get('sector_name')} | {s.get('sector_stage')} | {s.get('health_status')} | {s.get('action')} | {s.get('sector_score')} |")
    return "\n".join(lines) + "\n"
