from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional


ROOT = Path(__file__).resolve().parent
EXAMPLE_INPUT = ROOT / "examples" / "input-example.json"


class CollectorError(Exception):
    pass


@dataclass
class CollectorConfig:
    trade_date: Optional[str] = None
    source: str = "example"
    use_example_fallback: bool = True


class BaseCollector:
    name = "base"

    def collect_market_snapshot(self, config: CollectorConfig) -> Dict[str, Any]:
        raise NotImplementedError

    def collect_theme_snapshot(self, config: CollectorConfig) -> List[Dict[str, Any]]:
        raise NotImplementedError

    def collect_stock_snapshot(self, config: CollectorConfig) -> List[Dict[str, Any]]:
        raise NotImplementedError

    def collect_all(self, config: CollectorConfig) -> Dict[str, Any]:
        return {
            "market_snapshot": self.collect_market_snapshot(config),
            "theme_snapshot": self.collect_theme_snapshot(config),
            "stock_snapshot": self.collect_stock_snapshot(config),
        }


class ExampleCollector(BaseCollector):
    name = "example"

    def _load_example(self) -> Dict[str, Any]:
        return json.loads(EXAMPLE_INPUT.read_text(encoding="utf-8"))

    def collect_market_snapshot(self, config: CollectorConfig) -> Dict[str, Any]:
        return self._load_example().get("market_snapshot", {})

    def collect_theme_snapshot(self, config: CollectorConfig) -> List[Dict[str, Any]]:
        return self._load_example().get("theme_snapshot", [])

    def collect_stock_snapshot(self, config: CollectorConfig) -> List[Dict[str, Any]]:
        return self._load_example().get("stock_snapshot", [])


class PlaceholderLiveCollector(BaseCollector):
    name = "live"

    def collect_market_snapshot(self, config: CollectorConfig) -> Dict[str, Any]:
        raise CollectorError("live market collection is not implemented yet")

    def collect_theme_snapshot(self, config: CollectorConfig) -> List[Dict[str, Any]]:
        raise CollectorError("live theme collection is not implemented yet")

    def collect_stock_snapshot(self, config: CollectorConfig) -> List[Dict[str, Any]]:
        raise CollectorError("live stock collection is not implemented yet")


def get_collector(source: str) -> BaseCollector:
    source = (source or "example").lower()
    if source == "example":
        return ExampleCollector()
    if source == "live":
        return PlaceholderLiveCollector()
    raise CollectorError(f"unknown collector source: {source}")


def collect_input(config: CollectorConfig) -> Dict[str, Any]:
    collector = get_collector(config.source)
    try:
        return collector.collect_all(config)
    except Exception:
        if config.use_example_fallback and config.source != "example":
            return ExampleCollector().collect_all(config)
        raise


def save_collected_input(output_path: Path, data: Dict[str, Any]) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
