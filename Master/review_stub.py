from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List


def build_paper_review_stub(result: Dict[str, Any], paper_rows: List[Dict[str, Any]] | None = None, trade_date: str | None = None) -> str:
    market = result.get("market_overview", {})
    sectors = result.get("sector_analysis", [])
    stocks = result.get("stock_analysis", [])
    paper_rows = paper_rows or []

    focus = [s for s in stocks if s.get("action") == "重点跟踪"]
    trial = [s for s in stocks if s.get("action") == "小仓试错"]
    avoid = [s for s in stocks if s.get("action") == "回避"]

    lines: List[str] = []
    lines.append(f"# Master 纸面模拟盘复盘｜{trade_date or 'YYYY-MM-DD'}")
    lines.append("")
    lines.append("## 今日总评")
    lines.append(f"- **环境判断是否准确：** 待复盘（今日环境：{market.get('environment_label', '')} / {market.get('emotion_cycle', '')}）")
    lines.append(f"- **主线识别是否准确：** 待复盘（主线：{market.get('main_theme', '')}；次主线：{market.get('secondary_theme', '')}）")
    lines.append("- **个股角色识别是否准确：** 待复盘")
    lines.append("- **动作映射是否合理：** 待复盘")
    lines.append("- **今日一句话结论：** ")
    lines.append("")

    lines.append("## 重点跟踪复盘")
    lines.append("### 今日重点跟踪对象")
    if focus:
        for s in focus:
            lines.append(f"- {s.get('name')}（{s.get('symbol')}）｜{s.get('stock_role')}｜{s.get('signal_type')}｜{s.get('action_reasoning')}")
    else:
        lines.append("- 暂无")
    lines.append("")
    lines.append("### 有效信号")
    lines.append("- ")
    lines.append("### 一般信号")
    lines.append("- ")
    lines.append("### 误判信号")
    lines.append("- ")
    lines.append("")

    lines.append("## 小仓试错复盘")
    lines.append("### 今日试错对象")
    if trial:
        for s in trial:
            lines.append(f"- {s.get('name')}（{s.get('symbol')}）｜{s.get('stock_role')}｜{s.get('signal_type')}｜{s.get('action_reasoning')}")
    else:
        lines.append("- 暂无")
    lines.append("")
    lines.append("### 值得保留的试错")
    lines.append("- ")
    lines.append("### 噪音过大的试错")
    lines.append("- ")
    lines.append("### 应降级的试错")
    lines.append("- ")
    lines.append("")

    lines.append("## 回避名单复盘")
    lines.append("### 今日回避对象")
    if avoid:
        for s in avoid:
            lines.append(f"- {s.get('name')}（{s.get('symbol')}）｜{s.get('stock_role')}｜{s.get('risk_warning') or s.get('action_reasoning')}")
    else:
        lines.append("- 暂无")
    lines.append("")
    lines.append("### 回避有效")
    lines.append("- ")
    lines.append("### 回避过严（误杀）")
    lines.append("- ")
    lines.append("### 仍需观察")
    lines.append("- ")
    lines.append("")

    lines.append("## 误判归因")
    lines.append("### 环境层误判")
    lines.append("- ")
    lines.append("### 板块层误判")
    for sector in sectors[:3]:
        lines.append(f"- 候选检查：{sector.get('sector_name')}｜{sector.get('sector_stage')}｜{sector.get('action')}")
    lines.append("### 个股层误判")
    lines.append("- ")
    lines.append("### 标签层误判")
    lines.append("- ")
    lines.append("### 动作映射误判")
    lines.append("- ")
    lines.append("")

    lines.append("## 规则修正建议")
    lines.append("### 建议修改")
    lines.append("- [规则文件名]：")
    lines.append("### 暂不修改")
    lines.append("- [规则文件名]：")
    lines.append("")

    lines.append("## 次日修正重点")
    lines.append("- ")
    lines.append("- ")
    lines.append("- ")
    lines.append("")

    if paper_rows:
        lines.append("## 今日 paper trade 记录摘要")
        for row in paper_rows:
            lines.append(f"- {row.get('symbol')}｜{row.get('action')}｜{row.get('stock_role')}｜{row.get('signal_type')}")
        lines.append("")

    return "\n".join(lines) + "\n"


def write_paper_review_stub(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
