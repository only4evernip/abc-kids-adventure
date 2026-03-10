#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.request
from pathlib import Path
from typing import Any, Dict, List


ROOT = Path(__file__).resolve().parent
DEFAULT_INPUT = ROOT / "examples" / "input-example.json"
DEFAULT_OUT = ROOT / "out"


def load_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def load_json(path: Path) -> Any:
    return json.loads(load_text(path))


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def load_input(path: Path) -> Dict[str, Any]:
    data = load_json(path)
    required = ["market_snapshot", "theme_snapshot", "stock_snapshot"]
    missing = [k for k in required if k not in data]
    if missing:
        raise ValueError(f"input missing required keys: {missing}")
    return data


def load_master_context() -> Dict[str, Any]:
    return {
        "prompt": load_text(ROOT / "PROMPT.md"),
        "schema": load_json(ROOT / "SCHEMA.json"),
        "scoring": load_text(ROOT / "SCORING.md"),
        "tagging": load_text(ROOT / "TAGING_RULES.md"),
    }


def build_messages(input_data: Dict[str, Any], context: Dict[str, Any]) -> List[Dict[str, str]]:
    user_payload = {
        "task": "Analyze the given A-share market snapshots and output only valid JSON strictly matching the provided schema.",
        "input_data": input_data,
        "schema": context["schema"],
        "supporting_rules": {
            "scoring_excerpt": context["scoring"][:16000],
            "tagging_excerpt": context["tagging"][:16000],
        },
    }
    return [
        {"role": "system", "content": context["prompt"]},
        {"role": "user", "content": json.dumps(user_payload, ensure_ascii=False)},
    ]


def call_openai_compatible(model: str, messages: List[Dict[str, str]]) -> str:
    api_key = os.getenv("OPENAI_API_KEY")
    base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set")

    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
    }

    req = urllib.request.Request(
        url=base_url.rstrip("/") + "/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=180) as resp:
        body = json.loads(resp.read().decode("utf-8"))
    return body["choices"][0]["message"]["content"]


def extract_json(text: str) -> Dict[str, Any]:
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{.*\}", text, re.S)
    if not match:
        raise ValueError("no JSON object found in model output")
    return json.loads(match.group(0))


def validate_required_keys(result: Dict[str, Any], schema: Dict[str, Any]) -> List[str]:
    warnings: List[str] = []
    top_required = schema.get("required", [])
    for key in top_required:
        if key not in result:
            warnings.append(f"missing top-level key: {key}")
    return warnings


def validate_market_overview(result: Dict[str, Any]) -> List[str]:
    warnings: List[str] = []
    mo = result.get("market_overview", {})
    if not mo:
        warnings.append("market_overview is missing or empty")
        return warnings

    if mo.get("environment_label") == "防守" and mo.get("allow_level_2") is True:
        warnings.append("environment_label=防守 but allow_level_2=true")

    score = mo.get("market_score")
    if isinstance(score, (int, float)):
        if score < 35 and mo.get("environment_label") == "进攻":
            warnings.append("market_score low but environment_label=进攻")
    return warnings


def validate_sector_and_stock_logic(result: Dict[str, Any]) -> List[str]:
    warnings: List[str] = []
    weak_sectors = {
        s.get("sector_name")
        for s in result.get("sector_analysis", [])
        if s.get("sector_stage") in {"退潮", "退潮反抽"}
    }

    for stock in result.get("stock_analysis", []):
        action = stock.get("action")
        role = stock.get("stock_role")
        anti_flags = stock.get("anti_fraud_flags", []) or []

        if role in {"跟风", "杂毛"} and action in {"重点跟踪", "可择机建仓", "可趋势持有"}:
            warnings.append(f"{stock.get('symbol')} role={role} but action too aggressive: {action}")

        if any(flag in {"退潮反抽", "老龙头自救"} for flag in anti_flags) and action in {"重点跟踪", "可择机建仓"}:
            warnings.append(f"{stock.get('symbol')} has retreat flags but aggressive action: {action}")

    for sector in result.get("sector_analysis", []):
        if sector.get("sector_stage") in {"退潮", "退潮反抽"} and sector.get("action") in {"重点跟踪", "可择机参与"}:
            warnings.append(f"sector {sector.get('sector_name')} is retreat-like but action too aggressive")

    if weak_sectors:
        for stock in result.get("stock_analysis", []):
            reasoning = " ".join([
                str(stock.get("matched_theme_reasoning", "")),
                str(stock.get("action_reasoning", "")),
            ])
            if any(name in reasoning for name in weak_sectors) and stock.get("action") in {"重点跟踪", "可择机建仓"}:
                warnings.append(f"{stock.get('symbol')} may be tied to weak sector but action too aggressive")
    return warnings


def validate_result(result: Dict[str, Any], schema: Dict[str, Any]) -> List[str]:
    warnings: List[str] = []
    warnings.extend(validate_required_keys(result, schema))
    warnings.extend(validate_market_overview(result))
    warnings.extend(validate_sector_and_stock_logic(result))
    return warnings


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


def write_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Master minimal runner")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT, help="input JSON path")
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT, help="output directory")
    parser.add_argument("--model", default=os.getenv("MASTER_MODEL", "gpt-4o-mini"), help="LLM model")
    parser.add_argument("--use-example-output", action="store_true", help="skip API call and use examples/output-example.json")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    ensure_dir(args.out_dir)

    input_data = load_input(args.input)
    context = load_master_context()

    if args.use_example_output:
        result = load_json(ROOT / "examples" / "output-example.json")
    else:
        messages = build_messages(input_data, context)
        raw_text = call_openai_compatible(args.model, messages)
        result = extract_json(raw_text)

    warnings = validate_result(result, context["schema"])

    write_json(args.out_dir / "decision.json", result)
    write_json(args.out_dir / "logic-warnings.json", warnings)
    (args.out_dir / "daily-report.md").write_text(render_report(result), encoding="utf-8")
    (args.out_dir / "candidate-pool.md").write_text(render_candidate_pool(result), encoding="utf-8")

    print(f"[Master] wrote: {args.out_dir / 'decision.json'}")
    print(f"[Master] wrote: {args.out_dir / 'logic-warnings.json'}")
    print(f"[Master] wrote: {args.out_dir / 'daily-report.md'}")
    print(f"[Master] wrote: {args.out_dir / 'candidate-pool.md'}")
    if warnings:
        print(f"[Master] logic warnings: {len(warnings)}", file=sys.stderr)
        for w in warnings:
            print(f"- {w}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
