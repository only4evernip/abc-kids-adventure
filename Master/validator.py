from __future__ import annotations

from typing import Any, Dict, List


class ValidationError(Exception):
    pass


TYPE_MAP = {
    "object": dict,
    "array": list,
    "string": str,
    "number": (int, float),
    "boolean": bool,
}


def _format_path(path: str, key: str) -> str:
    if not path:
        return key
    if key.startswith("["):
        return f"{path}{key}"
    return f"{path}.{key}"


def _validate_schema_node(value: Any, schema: Dict[str, Any], path: str = "") -> List[str]:
    warnings: List[str] = []

    expected_type = schema.get("type")
    if expected_type in TYPE_MAP and not isinstance(value, TYPE_MAP[expected_type]):
        warnings.append(f"schema type mismatch at {path or '<root>'}: expected {expected_type}")
        return warnings

    enum_values = schema.get("enum")
    if enum_values is not None and value not in enum_values:
        warnings.append(f"schema enum mismatch at {path or '<root>'}: got {value!r}")

    if expected_type == "object":
        properties = schema.get("properties", {})
        required = schema.get("required", [])

        if not isinstance(value, dict):
            warnings.append(f"schema object mismatch at {path or '<root>'}")
            return warnings

        for key in required:
            if key not in value:
                warnings.append(f"missing required key at {path or '<root>'}: {key}")

        for key, child_schema in properties.items():
            if key in value:
                warnings.extend(_validate_schema_node(value[key], child_schema, _format_path(path, key)))

    elif expected_type == "array":
        if not isinstance(value, list):
            warnings.append(f"schema array mismatch at {path or '<root>'}")
            return warnings
        item_schema = schema.get("items")
        if item_schema:
            for idx, item in enumerate(value):
                warnings.extend(_validate_schema_node(item, item_schema, _format_path(path, f"[{idx}]")))

    return warnings


def validate_against_schema(result: Dict[str, Any], schema: Dict[str, Any]) -> List[str]:
    return _validate_schema_node(result, schema, "")


def validate_market_overview(result: Dict[str, Any]) -> List[str]:
    warnings: List[str] = []
    mo = result.get("market_overview", {})
    if not mo:
        warnings.append("market_overview is missing or empty")
        return warnings

    if mo.get("environment_label") == "防守" and mo.get("allow_level_2") is True:
        warnings.append("environment_label=防守 but allow_level_2=true")

    score = mo.get("market_score")
    if isinstance(score, (int, float)) and score < 35 and mo.get("environment_label") == "进攻":
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
    warnings.extend(validate_against_schema(result, schema))
    warnings.extend(validate_market_overview(result))
    warnings.extend(validate_sector_and_stock_logic(result))
    return warnings
