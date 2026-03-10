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


def build_local_fallback_result(input_data: Dict[str, Any]) -> Dict[str, Any]:
    market = input_data.get("market_snapshot", {})
    sectors = input_data.get("theme_snapshot", [])

    limit_up = market.get("limit_up_count") or 0
    limit_down = market.get("limit_down_count") or 0
    blowup_rate = market.get("blowup_rate") or 0
    highest_board = market.get("highest_board") or 0

    if limit_up >= 60 and blowup_rate <= 0.2 and limit_down <= 3:
        environment_label = "进攻"
        emotion_cycle = "主升"
        market_score = 78
        recommended_style = "主线可积极跟随，但仍优先做核心板块"
        forbidden_style = "禁止脱离主线乱追边缘题材"
    elif limit_up >= 30 and blowup_rate <= 0.4 and limit_down <= 10:
        environment_label = "试错"
        emotion_cycle = "修复"
        market_score = 60
        recommended_style = "聚焦最强板块，先做确认，少做扩散"
        forbidden_style = "禁止追高后排、禁止把反抽当反转"
    elif limit_down >= 15 or blowup_rate >= 0.5:
        environment_label = "防守"
        emotion_cycle = "退潮"
        market_score = 28
        recommended_style = "控制节奏，以观察和回避为主"
        forbidden_style = "禁止激进试错、禁止硬接退潮反抽"
    else:
        environment_label = "混沌"
        emotion_cycle = "混沌"
        market_score = 45
        recommended_style = "只盯强辨识度方向，避免频繁出手"
        forbidden_style = "禁止预判全面主升、禁止见涨就追"

    ranked_sectors = sorted(
        sectors,
        key=lambda x: (
            x.get("theme_limit_up_count") or 0,
            -(x.get("theme_blowup_count") or 0),
            x.get("theme_highest_board") or 0,
            x.get("theme_change_pct") or 0,
        ),
        reverse=True,
    )

    def sector_stage(row: Dict[str, Any]) -> str:
        zt = row.get("theme_limit_up_count") or 0
        zb = row.get("theme_blowup_count") or 0
        hb = row.get("theme_highest_board") or 0
        chg = row.get("theme_change_pct") or 0
        if hb >= 4 and zt >= 2 and zb <= 1:
            return "主升"
        if zt >= 2 and chg >= 2:
            return "发酵"
        if zb >= max(2, zt) or chg < 0:
            return "退潮反抽"
        return "观察"

    def sector_health(row: Dict[str, Any]) -> str:
        zt = row.get("theme_limit_up_count") or 0
        zb = row.get("theme_blowup_count") or 0
        if zt >= 3 and zb == 0:
            return "健康"
        if zt >= 1 and zb <= 1:
            return "一般"
        if zb >= 2:
            return "危险"
        return "分歧"

    sector_analysis = []
    for idx, row in enumerate(ranked_sectors[:5]):
        stage = sector_stage(row)
        health = sector_health(row)
        score = min(95, 40 + (row.get("theme_limit_up_count") or 0) * 8 + (row.get("theme_highest_board") or 0) * 5 - (row.get("theme_blowup_count") or 0) * 6)
        is_main = idx == 0 and score >= 55
        if stage in {"退潮反抽"} or health == "危险":
            action = "回避"
        elif is_main:
            action = "重点跟踪"
        elif score >= 55:
            action = "小仓试错"
        else:
            action = "观察"

        sector_analysis.append(
            {
                "sector_name": row.get("theme_name") or f"板块{idx+1}",
                "sector_reasoning": f"先看结论：该方向当前{action}。理由是涨停 {row.get('theme_limit_up_count') or 0} 家、炸板 {row.get('theme_blowup_count') or 0} 家、最高板 {row.get('theme_highest_board') or 0}。",
                "sector_stage_reasoning": f"先看阶段：当前更像{stage}。理由是板块强度、连板高度和炸板情况共同决定。",
                "sector_stage": stage if stage in {"启动", "发酵", "主升", "强分歧", "高位震荡", "退潮", "退潮反抽", "一日游"} else "发酵",
                "sector_score_reasoning": f"先看分数：综合涨停密度、炸板压力、连板高度后，板块分数为 {score}。",
                "sector_score": score,
                "leader_stock": row.get("theme_leader_stock") or "",
                "core_midcap_stock": "",
                "follow_strength": "较强" if (row.get("theme_limit_up_count") or 0) >= 3 else "一般",
                "health_reasoning": f"先看健康度：当前为{health}。核心依据是涨停密度与炸板压力的对比。",
                "health_status": health if health in {"健康", "一般", "分歧", "危险"} else "一般",
                "is_main_theme_reasoning": f"先看主线资格：{'具备' if is_main else '暂不具备'}当前主线特征。",
                "is_main_theme": is_main,
                "allow_level_3_reasoning": "当前运行在指数模式，不下钻个股层。",
                "allow_level_3": False,
                "anti_fraud_flags": ["炸板偏多"] if (row.get("theme_blowup_count") or 0) >= 2 else [],
                "action_reasoning": f"先看动作：{action}。优先根据板块强度、炸板压力和连板延续性做处理。",
                "action": action,
            }
        )

    main_theme = sector_analysis[0]["sector_name"] if sector_analysis else "无明确主线"
    secondary_theme = sector_analysis[1]["sector_name"] if len(sector_analysis) > 1 else "无"
    retreat_candidates = [s for s in sector_analysis if s.get("action") == "回避"]
    retreat_theme = retreat_candidates[0]["sector_name"] if retreat_candidates else "无明显退潮方向"

    risk_flags = []
    if blowup_rate >= 0.35:
        risk_flags.append("炸板率偏高，追高容错差")
    if limit_down >= 5:
        risk_flags.append("跌停家数偏多，退潮压力仍在")
    if highest_board >= 5 and blowup_rate >= 0.25:
        risk_flags.append("高标仍在，但高位分歧开始放大")
    if not risk_flags:
        risk_flags.append("当前无极端风险，但仍应只围绕强板块行动")

    return {
        "market_overview": {
            "environment_reasoning": f"先看结论：当前环境定性为{environment_label}。理由是涨停 {limit_up}、跌停 {limit_down}、炸板率 {blowup_rate}、最高板 {highest_board}。",
            "environment_label": environment_label,
            "emotion_cycle_reasoning": f"先看周期：当前更像{emotion_cycle}。主要依据是连板延续、炸板压力和跌停反馈。",
            "emotion_cycle": emotion_cycle,
            "market_score_reasoning": f"先看分数：当前市场分数为 {market_score}，核心依据是情绪强弱与风险反馈并存。",
            "market_score": market_score,
            "turnover_total": float(market.get("market_turnover_total") or 0),
            "up_count": float(market.get("up_count") or 0),
            "down_count": float(market.get("down_count") or 0),
            "limit_up_count": float(limit_up),
            "limit_down_count": float(limit_down),
            "blowup_rate": float(blowup_rate),
            "highest_board": float(highest_board),
            "northbound_net_inflow": float(market.get("northbound_net_inflow") or 0),
            "main_theme": main_theme,
            "secondary_theme": secondary_theme,
            "retreat_theme": retreat_theme,
            "recommended_style_reasoning": f"先看打法：当前更适合{recommended_style}。",
            "recommended_style": recommended_style,
            "forbidden_style_reasoning": f"先看禁区：当前最该避免的是{forbidden_style}。",
            "forbidden_style": forbidden_style,
            "allow_level_2_reasoning": "指数模式下继续做板块层分析是必要的。",
            "allow_level_2": True,
            "risk_flags": risk_flags,
        },
        "sector_analysis": sector_analysis,
        "stock_analysis": [],
    }


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
    parser.add_argument("--watchlist", type=Path, default=None, help="watchlist file path for live collectors (currently ignored in index-only mode)")
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
                    watchlist_path=str(args.watchlist) if args.watchlist else None,
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
                    print("[Master] falling back to local rule engine", file=sys.stderr)
                    result = build_local_fallback_result(input_data)
                    input_warnings.append("model_call_failed_fallback_to_local_rules")
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
