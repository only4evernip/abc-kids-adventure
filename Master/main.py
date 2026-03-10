#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict

from builder import load_and_build, validate_input_shape
from collector import CollectorConfig, collect_input
from judge import build_messages, call_openai_compatible, extract_json
from renderer import render_candidate_pool, render_report
from review_stub import build_paper_review_stub, write_paper_review_stub
from validator import validate_result


ROOT = Path(__file__).resolve().parent
DEFAULT_INPUT = ROOT / "examples" / "input-example.json"
DEFAULT_OUT = ROOT / "out"


def load_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def load_json(path: Path) -> Any:
    return json.loads(load_text(path))


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def load_master_context() -> Dict[str, Any]:
    return {
        "prompt": load_text(ROOT / "PROMPT.md"),
        "schema": load_json(ROOT / "SCHEMA.json"),
        "scoring": load_text(ROOT / "SCORING.md"),
        "tagging": load_text(ROOT / "TAGING_RULES.md"),
    }


def write_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def append_jsonl(path: Path, rows: list[dict[str, Any]]) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    existing_keys = set()
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
                existing_keys.add((obj.get("trade_date"), obj.get("symbol"), obj.get("action")))
            except Exception:
                continue

    appended = 0
    with path.open("a", encoding="utf-8") as f:
        for row in rows:
            key = (row.get("trade_date"), row.get("symbol"), row.get("action"))
            if key in existing_keys:
                continue
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
            existing_keys.add(key)
            appended += 1
    return appended


def build_paper_trade_rows(result: Dict[str, Any], input_data: Dict[str, Any]) -> list[dict[str, Any]]:
    trade_date = input_data.get("market_snapshot", {}).get("trade_date")
    market = result.get("market_overview", {})
    source_stocks = {s.get("symbol"): s for s in input_data.get("stock_snapshot", [])}
    rows: list[dict[str, Any]] = []
    tracked_actions = {"重点跟踪", "小仓试错", "回避", "可择机建仓"}

    for stock in result.get("stock_analysis", []):
        action = stock.get("action")
        if action not in tracked_actions:
            continue
        src = source_stocks.get(stock.get("symbol"), {})
        rows.append(
            {
                "trade_date": trade_date,
                "symbol": stock.get("symbol"),
                "name": stock.get("name"),
                "main_theme": src.get("main_theme_name") or market.get("main_theme"),
                "stock_role": stock.get("stock_role"),
                "signal_type": stock.get("signal_type"),
                "action": action,
                "signal_score": stock.get("signal_score"),
                "entry_price": src.get("close_price"),
                "entry_reasoning": stock.get("action_reasoning") or stock.get("signal_reasoning"),
                "risk_warning": stock.get("risk_warning"),
                "invalid_condition": stock.get("invalid_condition"),
                "market_environment_label": market.get("environment_label"),
                "emotion_cycle": market.get("emotion_cycle"),
                "t_plus_1_return": None,
                "t_plus_3_return": None,
                "t_plus_5_return": None,
                "outcome_label": None,
                "review_notes": "",
            }
        )
    return rows


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Master minimal runner")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT, help="input JSON path")
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT, help="output directory")
    parser.add_argument("--model", default=os.getenv("MASTER_MODEL", "gpt-4o-mini"), help="LLM model")
    parser.add_argument("--source", default="file", choices=["file", "example", "live", "live-akshare"], help="input source mode")
    parser.add_argument("--use-example-output", action="store_true", help="skip API call and use examples/output-example.json")
    parser.add_argument("--max-retries", type=int, default=2, help="max retries for model call / JSON extraction")
    parser.add_argument("--fallback-example-output-on-fail", action="store_true", help="fallback to examples/output-example.json if model path fails")
    parser.add_argument("--paper-trades-path", type=Path, default=None, help="append tracked actions to paper trades jsonl")
    parser.add_argument("--paper-review-stub-path", type=Path, default=None, help="write a paper review stub markdown")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    ensure_dir(args.out_dir)

    try:
        if args.source == "file":
            input_data = load_and_build(args.input)
        else:
            collected = collect_input(
                CollectorConfig(
                    source=args.source,
                    use_example_fallback=args.fallback_example_output_on_fail,
                )
            )
            input_data = collected
        input_warnings = validate_input_shape(input_data)
        context = load_master_context()

        if args.use_example_output:
            result = load_json(ROOT / "examples" / "output-example.json")
        else:
            messages = build_messages(input_data, context)
            result = None
            last_error = None
            for attempt in range(1, max(args.max_retries, 1) + 1):
                try:
                    raw_text = call_openai_compatible(args.model, messages)
                    result = extract_json(raw_text)
                    last_error = None
                    break
                except Exception as exc:
                    last_error = exc
                    print(f"[Master] attempt {attempt} failed: {exc}", file=sys.stderr)

            if result is None:
                if args.fallback_example_output_on_fail:
                    print("[Master] falling back to examples/output-example.json", file=sys.stderr)
                    result = load_json(ROOT / "examples" / "output-example.json")
                    input_warnings.append("model_call_failed_fallback_to_example_output")
                else:
                    raise RuntimeError(f"model path failed after retries: {last_error}")

        warnings = input_warnings + validate_result(result, context["schema"])

        write_json(args.out_dir / "decision.json", result)
        write_json(args.out_dir / "logic-warnings.json", warnings)
        (args.out_dir / "daily-report.md").write_text(render_report(result), encoding="utf-8")
        (args.out_dir / "candidate-pool.md").write_text(render_candidate_pool(result), encoding="utf-8")

        print(f"[Master] wrote: {args.out_dir / 'decision.json'}")
        print(f"[Master] wrote: {args.out_dir / 'logic-warnings.json'}")
        print(f"[Master] wrote: {args.out_dir / 'daily-report.md'}")
        print(f"[Master] wrote: {args.out_dir / 'candidate-pool.md'}")

        paper_rows = []
        if args.paper_trades_path:
            paper_rows = build_paper_trade_rows(result, input_data)
            appended = append_jsonl(args.paper_trades_path, paper_rows)
            print(f"[Master] appended paper trades: {appended} -> {args.paper_trades_path}")

        if args.paper_review_stub_path:
            trade_date = input_data.get("market_snapshot", {}).get("trade_date")
            stub = build_paper_review_stub(result, paper_rows=paper_rows, trade_date=trade_date)
            write_paper_review_stub(args.paper_review_stub_path, stub)
            print(f"[Master] wrote: {args.paper_review_stub_path}")

        if warnings:
            print(f"[Master] logic warnings: {len(warnings)}", file=sys.stderr)
            for w in warnings:
                print(f"- {w}", file=sys.stderr)
        return 0
    except Exception as exc:
        error_payload = {
            "error": str(exc),
            "input": str(args.input),
            "source": args.source,
            "model": args.model,
        }
        write_json(args.out_dir / "error.json", error_payload)
        print(f"[Master] failed: {exc}", file=sys.stderr)
        print(f"[Master] wrote: {args.out_dir / 'error.json'}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
