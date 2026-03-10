from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List


def build_paper_review_stub(result: Dict[str, Any], paper_rows: List[Dict[str, Any]] | None = None, trade_date: str | None = None) -> str:
    market = result.get("market_overview", {})
    sectors = result.get("sector_analysis", [])
    paper_rows = paper_rows or []

    main_watch = [s for s in sectors if s.get("action") in {"重点跟踪", "可择机参与"}]
    trial_watch = [s for s in sectors if s.get("action") in {"小仓试错", "观察"}]
    avoid_watch = [s for s in sectors if s.get("action") in {"回避", "减仓", "退出"}]

    lines: List[str] = []
    lines.append(f"# Master Day 1 指数复盘记录｜{trade_date or 'YYYY-MM-DD'}")
    lines.append("")
    lines.append("## 今日复盘判断（固定 5 句）")
    lines.append(f"1. **今天环境判断：** 待复盘（系统输出：{market.get('environment_label', '')} / {market.get('emotion_cycle', '')}）")
    lines.append(f"2. **今天主线识别：** 待复盘（系统输出：{market.get('main_theme', '')}；次主线：{market.get('secondary_theme', '')}；退潮方向：{market.get('retreat_theme', '')}）")
    lines.append(f"3. **今天最有效信号：** 待复盘（系统输出：{market.get('recommended_style', '')}）")
    lines.append(f"4. **今天最大风险：** 待复盘（系统输出：{(market.get('risk_flags') or [''])[0]}）")
    lines.append("5. **明天最该修的规则点：** ")
    lines.append("")

    lines.append("## Day 1 总评")
    lines.append("- **环境判断是否准确：** 准确 / 一般 / 偏差较大")
    lines.append("- **主线识别是否准确：** 准确 / 一般 / 偏差较大")
    lines.append("- **板块动作映射是否合理：** 合理 / 偏激进 / 偏保守")
    lines.append("- **本地 fallback 是否可用：** 可用 / 勉强可用 / 需要重修")
    lines.append("- **今日一句话结论：** ")
    lines.append("")

    lines.append("## 主线板块复盘")
    lines.append("### 重点盯方向")
    if main_watch:
        for s in main_watch[:3]:
            lines.append(f"- {s.get('sector_name')}｜{s.get('sector_stage')}｜{s.get('action')}｜涨停 {s.get('theme_limit_up_count', '')} / 炸板 {s.get('theme_blowup_count', '')} / 最高板 {s.get('theme_highest_board', '')}")
    else:
        lines.append("- 暂无")
    lines.append("")
    lines.append("### 最有效的板块信号")
    lines.append("- ")
    lines.append("### 一般信号")
    lines.append("- ")
    lines.append("### 最大误判")
    lines.append("- ")
    lines.append("")

    lines.append("## 次主线 / 观察方向复盘")
    lines.append("### 可继续观察")
    if trial_watch:
        for s in trial_watch[:5]:
            lines.append(f"- {s.get('sector_name')}｜{s.get('sector_stage')}｜{s.get('action')}")
    else:
        lines.append("- 暂无")
    lines.append("")
    lines.append("### 噪音过大的方向")
    lines.append("- ")
    lines.append("### 应降级的方向")
    lines.append("- ")
    lines.append("")

    lines.append("## 回避方向复盘")
    lines.append("### 今日回避对象")
    if avoid_watch:
        for s in avoid_watch[:5]:
            lines.append(f"- {s.get('sector_name')}｜{s.get('sector_stage')}｜{s.get('action_reasoning')}")
    else:
        lines.append("- 暂无")
    lines.append("")
    lines.append("### 回避有效")
    lines.append("- ")
    lines.append("### 回避过严（误杀）")
    lines.append("- ")
    lines.append("")

    lines.append("## 误判归因")
    lines.append("### 环境层误判")
    lines.append("- ")
    lines.append("### 板块层误判")
    for sector in sectors[:5]:
        lines.append(f"- 候选检查：{sector.get('sector_name')}｜{sector.get('sector_stage')}｜{sector.get('action')}")
    lines.append("### 动作映射误判")
    lines.append("- ")
    lines.append("### 数据层问题")
    lines.append("- ")
    lines.append("")

    lines.append("## 规则修正建议")
    lines.append("### 建议修改")
    lines.append("- [规则文件名]：")
    lines.append("### 暂不修改")
    lines.append("- [规则文件名]：")
    lines.append("")

    lines.append("## 次日修正重点")
    lines.append("- 明天先验证环境是否延续")
    lines.append("- 明天再验证主线是否强化还是分歧扩大")
    lines.append("- 明天最后验证今天的回避方向是否继续走弱")
    lines.append("")

    if paper_rows:
        lines.append("## 今日记录摘要")
        for row in paper_rows:
            lines.append(f"- {row.get('symbol')}｜{row.get('action')}｜{row.get('signal_type')}")
        lines.append("")

    return "\n".join(lines) + "\n"


def write_paper_review_stub(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
