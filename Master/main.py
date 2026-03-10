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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Master minimal runner")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT, help="input JSON path")
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT, help="output directory")
    parser.add_argument("--model", default=os.getenv("MASTER_MODEL", "gpt-4o-mini"), help="LLM model")
    parser.add_argument("--source", default="file", choices=["file", "example", "live"], help="input source mode")
    parser.add_argument("--use-example-output", action="store_true", help="skip API call and use examples/output-example.json")
    parser.add_argument("--max-retries", type=int, default=2, help="max retries for model call / JSON extraction")
    parser.add_argument("--fallback-example-output-on-fail", action="store_true", help="fallback to examples/output-example.json if model path fails")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    ensure_dir(args.out_dir)

    try:
        if args.source == "file":
            input_data = load_and_build(args.input)
        else:
            collected = collect_input(CollectorConfig(source=args.source))
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
