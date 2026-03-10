from __future__ import annotations

import importlib.util
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


class AkshareCollector(BaseCollector):
    name = "live-akshare"

    def __init__(self) -> None:
        if not importlib.util.find_spec("akshare"):
            raise CollectorError("akshare is not installed; cannot use live-akshare source")
        import akshare as ak  # type: ignore
        self.ak = ak

    def collect_market_snapshot(self, config: CollectorConfig) -> Dict[str, Any]:
        # 先给出最小真实入口定义。这里优先使用 AkShare 常见接口，
        # 若后续字段不足，再继续扩展，不在当前阶段硬凑伪数据。
        try:
            idx_sh = self.ak.stock_zh_index_daily(symbol="sh000001")
            idx_sz = self.ak.stock_zh_index_daily(symbol="sz399001")
            idx_cyb = self.ak.stock_zh_index_daily(symbol="sz399006")
        except Exception as exc:
            raise CollectorError(f"akshare index fetch failed: {exc}")

        def last_close(df):
            if df is None or len(df) == 0:
                return None
            row = df.iloc[-1]
            return float(row.get("close")) if row.get("close") is not None else None

        # 这里只返回能稳定拿到的基础指数字段；
        # 涨跌停、炸板、连板高度等情绪字段后续再接入专门数据源。
        return {
            "trade_date": config.trade_date,
            "sh_index_close": last_close(idx_sh),
            "sz_index_close": last_close(idx_sz),
            "cyb_index_close": last_close(idx_cyb),
            "hs300_close": None,
            "zz500_close": None,
            "zz1000_close": None,
            "kc50_close": None,
            "market_turnover_total": None,
            "market_turnover_change": None,
            "up_count": None,
            "down_count": None,
            "limit_up_count": None,
            "limit_down_count": None,
            "blowup_count": None,
            "blowup_rate": None,
            "highest_board": None,
            "yesterday_limit_up_premium": None,
            "high_level_stock_drawdown_flag": None,
            "northbound_net_inflow": None,
        }

    def collect_theme_snapshot(self, config: CollectorConfig) -> List[Dict[str, Any]]:
        raise CollectorError("live-akshare theme collection is not implemented yet; need board/theme data source")

    def collect_stock_snapshot(self, config: CollectorConfig) -> List[Dict[str, Any]]:
        raise CollectorError("live-akshare stock collection is not implemented yet; need candidate universe / watchlist")


def get_collector(source: str) -> BaseCollector:
    source = (source or "example").lower()
    if source == "example":
        return ExampleCollector()
    if source == "live":
        return PlaceholderLiveCollector()
    if source == "live-akshare":
        return AkshareCollector()
    raise CollectorError(f"unknown collector source: {source}")


def collect_input(config: CollectorConfig) -> Dict[str, Any]:
    try:
        collector = get_collector(config.source)
        return collector.collect_all(config)
    except Exception:
        if config.use_example_fallback and config.source != "example":
            return ExampleCollector().collect_all(config)
        raise


def save_collected_input(output_path: Path, data: Dict[str, Any]) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
