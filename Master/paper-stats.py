#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Dict, List


def load_jsonl(path: Path) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    if not path.exists():
        raise FileNotFoundError(f"jsonl not found: {path}")
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        rows.append(json.loads(line))
    return rows


def avg(values: List[float]) -> float | None:
    if not values:
        return None
    return sum(values) / len(values)


def safe_number(value: Any) -> float | None:
    if isinstance(value, (int, float)):
        return float(value)
    return None


def compute_stats(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    total = len(rows)
    by_action = Counter()
    by_role = Counter()
    by_outcome = Counter()
    by_theme = Counter()

    returns_by_action = defaultdict(list)
    returns_by_role = defaultdict(list)
    returns_by_horizon = {"t_plus_1_return": [], "t_plus_3_return": [], "t_plus_5_return": []}

    for row in rows:
        action = row.get("action", "UNKNOWN")
        role = row.get("stock_role", "UNKNOWN")
        outcome = row.get("outcome_label", "UNREVIEWED") or "UNREVIEWED"
        theme = row.get("main_theme", "UNKNOWN")

        by_action[action] += 1
        by_role[role] += 1
        by_outcome[outcome] += 1
        by_theme[theme] += 1

        t3 = safe_number(row.get("t_plus_3_return"))
        if t3 is not None:
            returns_by_action[action].append(t3)
            returns_by_role[role].append(t3)

        for horizon in returns_by_horizon:
            value = safe_number(row.get(horizon))
            if value is not None:
                returns_by_horizon[horizon].append(value)

    action_summary = {}
    for action, count in by_action.items():
        vals = returns_by_action.get(action, [])
        action_summary[action] = {
            "count": count,
            "avg_t_plus_3_return": avg(vals),
        }

    role_summary = {}
    for role, count in by_role.items():
        vals = returns_by_role.get(role, [])
        role_summary[role] = {
            "count": count,
            "avg_t_plus_3_return": avg(vals),
        }

    reviewed_rows = [r for r in rows if (r.get("outcome_label") not in (None, "", "UNREVIEWED"))]
    reviewed_count = len(reviewed_rows)

    return {
        "total_records": total,
        "reviewed_records": reviewed_count,
        "unreviewed_records": total - reviewed_count,
        "by_action": dict(by_action),
        "by_role": dict(by_role),
        "by_outcome": dict(by_outcome),
        "by_theme": dict(by_theme),
        "action_summary": action_summary,
        "role_summary": role_summary,
        "horizon_average_returns": {
            horizon: avg(vals) for horizon, vals in returns_by_horizon.items()
        },
    }


def render_markdown(stats: Dict[str, Any]) -> str:
    lines: List[str] = []
    lines.append("# Master Paper Trading Stats")
    lines.append("")
    lines.append("## Overview")
    lines.append(f"- **Total records:** {stats['total_records']}")
    lines.append(f"- **Reviewed records:** {stats['reviewed_records']}")
    lines.append(f"- **Unreviewed records:** {stats['unreviewed_records']}")
    lines.append("")

    lines.append("## By Action")
    for action, count in stats["by_action"].items():
        avg_t3 = stats["action_summary"].get(action, {}).get("avg_t_plus_3_return")
        lines.append(f"- **{action}**: {count} | avg T+3 = {avg_t3}")
    lines.append("")

    lines.append("## By Role")
    for role, count in stats["by_role"].items():
        avg_t3 = stats["role_summary"].get(role, {}).get("avg_t_plus_3_return")
        lines.append(f"- **{role}**: {count} | avg T+3 = {avg_t3}")
    lines.append("")

    lines.append("## By Outcome")
    for outcome, count in stats["by_outcome"].items():
        lines.append(f"- **{outcome}**: {count}")
    lines.append("")

    lines.append("## Horizon Average Returns")
    for horizon, value in stats["horizon_average_returns"].items():
        lines.append(f"- **{horizon}**: {value}")
    lines.append("")

    lines.append("## By Theme")
    for theme, count in stats["by_theme"].items():
        lines.append(f"- **{theme}**: {count}")
    lines.append("")

    return "\n".join(lines) + "\n"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Master paper trading stats")
    parser.add_argument("--input", type=Path, required=True, help="paper trades jsonl path")
    parser.add_argument("--json-out", type=Path, default=None, help="optional json stats output")
    parser.add_argument("--md-out", type=Path, default=None, help="optional markdown stats output")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    rows = load_jsonl(args.input)
    stats = compute_stats(rows)

    if args.json_out:
        args.json_out.parent.mkdir(parents=True, exist_ok=True)
        args.json_out.write_text(json.dumps(stats, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"[Master] wrote stats json: {args.json_out}")
    else:
        print(json.dumps(stats, ensure_ascii=False, indent=2))

    if args.md_out:
        args.md_out.parent.mkdir(parents=True, exist_ok=True)
        args.md_out.write_text(render_markdown(stats), encoding="utf-8")
        print(f"[Master] wrote stats md: {args.md_out}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
