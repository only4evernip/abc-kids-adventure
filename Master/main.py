#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict

from judge import build_messages, call_openai_compatible, extract_json
from renderer import render_candidate_pool, render_report
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
