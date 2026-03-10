from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List


REQUIRED_TOP_LEVEL_KEYS = ["market_snapshot", "theme_snapshot", "stock_snapshot"]


class BuilderError(Exception):
    pass


def _ensure_dict(value: Any, name: str) -> Dict[str, Any]:
    if not isinstance(value, dict):
        raise BuilderError(f"{name} must be an object")
    return value


def _ensure_list(value: Any, name: str) -> List[Any]:
    if not isinstance(value, list):
        raise BuilderError(f"{name} must be an array")
    return value


def build_market_snapshot(raw_market: Dict[str, Any]) -> Dict[str, Any]:
    raw_market = _ensure_dict(raw_market, "raw_market")
    return {
        "trade_date": raw_market.get("trade_date"),
        "sh_index_close": raw_market.get("sh_index_close"),
        "sz_index_close": raw_market.get("sz_index_close"),
        "cyb_index_close": raw_market.get("cyb_index_close"),
        "hs300_close": raw_market.get("hs300_close"),
        "zz500_close": raw_market.get("zz500_close"),
        "zz1000_close": raw_market.get("zz1000_close"),
        "kc50_close": raw_market.get("kc50_close"),
        "market_turnover_total": raw_market.get("market_turnover_total"),
        "market_turnover_change": raw_market.get("market_turnover_change"),
        "up_count": raw_market.get("up_count"),
        "down_count": raw_market.get("down_count"),
        "limit_up_count": raw_market.get("limit_up_count"),
        "limit_down_count": raw_market.get("limit_down_count"),
        "blowup_count": raw_market.get("blowup_count"),
        "blowup_rate": raw_market.get("blowup_rate"),
        "highest_board": raw_market.get("highest_board"),
        "yesterday_limit_up_premium": raw_market.get("yesterday_limit_up_premium"),
        "high_level_stock_drawdown_flag": raw_market.get("high_level_stock_drawdown_flag"),
        "northbound_net_inflow": raw_market.get("northbound_net_inflow"),
    }


def build_theme_snapshot(raw_themes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    raw_themes = _ensure_list(raw_themes, "raw_themes")
    built: List[Dict[str, Any]] = []
    for item in raw_themes:
        item = _ensure_dict(item, "theme item")
        built.append(
            {
                "theme_name": item.get("theme_name"),
                "theme_type": item.get("theme_type"),
                "theme_change_pct": item.get("theme_change_pct"),
                "theme_turnover": item.get("theme_turnover"),
                "theme_turnover_change": item.get("theme_turnover_change"),
                "theme_turnover_ratio": item.get("theme_turnover_ratio"),
                "theme_money_flow_ratio": item.get("theme_money_flow_ratio"),
                "theme_limit_up_count": item.get("theme_limit_up_count"),
                "theme_blowup_count": item.get("theme_blowup_count"),
                "theme_highest_board": item.get("theme_highest_board"),
                "theme_leader_stock": item.get("theme_leader_stock"),
                "theme_leader_board_count": item.get("theme_leader_board_count"),
                "theme_midcap_core_stock": item.get("theme_midcap_core_stock"),
                "theme_core_stock_count": item.get("theme_core_stock_count"),
                "theme_follow_count": item.get("theme_follow_count"),
                "theme_health_status": item.get("theme_health_status"),
                "theme_stage_label": item.get("theme_stage_label"),
                "theme_is_main": item.get("theme_is_main"),
                "theme_is_secondary": item.get("theme_is_secondary"),
                "theme_retreat_flag": item.get("theme_retreat_flag"),
                "theme_consensus_score": item.get("theme_consensus_score"),
            }
        )
    return built


def build_stock_snapshot(raw_stocks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    raw_stocks = _ensure_list(raw_stocks, "raw_stocks")
    built: List[Dict[str, Any]] = []
    for item in raw_stocks:
        item = _ensure_dict(item, "stock item")
        built.append(
            {
                "symbol": item.get("symbol"),
                "name": item.get("name"),
                "close_price": item.get("close_price"),
                "open_price": item.get("open_price"),
                "high_price": item.get("high_price"),
                "low_price": item.get("low_price"),
                "pct_change": item.get("pct_change"),
                "turnover_amount": item.get("turnover_amount"),
                "turnover_rate": item.get("turnover_rate"),
                "volume_ratio": item.get("volume_ratio"),
                "circulating_market_cap": item.get("circulating_market_cap"),
                "total_market_cap": item.get("total_market_cap"),
                "board_count": item.get("board_count"),
                "days_since_last_limit_up": item.get("days_since_last_limit_up"),
                "is_recent_high_stock": item.get("is_recent_high_stock"),
                "is_previous_cycle_core": item.get("is_previous_cycle_core"),
                "ma5": item.get("ma5"),
                "ma10": item.get("ma10"),
                "ma20": item.get("ma20"),
                "ma60": item.get("ma60"),
                "limit_up_flag": item.get("limit_up_flag"),
                "limit_down_flag": item.get("limit_down_flag"),
                "blowup_flag": item.get("blowup_flag"),
                "sealed_order_strength": item.get("sealed_order_strength"),
                "industry": item.get("industry"),
                "concept_tags": item.get("concept_tags", []),
                "main_theme_name": item.get("main_theme_name"),
            }
        )
    return built


def build_input(raw_data: Dict[str, Any]) -> Dict[str, Any]:
    raw_data = _ensure_dict(raw_data, "raw_data")
    built = {
        "market_snapshot": build_market_snapshot(raw_data.get("market_snapshot", {})),
        "theme_snapshot": build_theme_snapshot(raw_data.get("theme_snapshot", [])),
        "stock_snapshot": build_stock_snapshot(raw_data.get("stock_snapshot", [])),
    }
    return built


def validate_input_shape(data: Dict[str, Any]) -> List[str]:
    warnings: List[str] = []
    for key in REQUIRED_TOP_LEVEL_KEYS:
        if key not in data:
            warnings.append(f"missing top-level key: {key}")

    if "market_snapshot" in data and not isinstance(data["market_snapshot"], dict):
        warnings.append("market_snapshot must be an object")
    if "theme_snapshot" in data and not isinstance(data["theme_snapshot"], list):
        warnings.append("theme_snapshot must be an array")
    if "stock_snapshot" in data and not isinstance(data["stock_snapshot"], list):
        warnings.append("stock_snapshot must be an array")

    return warnings


def load_and_build(path: Path) -> Dict[str, Any]:
    raw_data = json.loads(path.read_text(encoding="utf-8"))
    return build_input(raw_data)
