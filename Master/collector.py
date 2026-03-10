from __future__ import annotations

import importlib.util
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional


ROOT = Path(__file__).resolve().parent
EXAMPLE_INPUT = ROOT / "examples" / "input-example.json"
DEFAULT_WATCHLIST = ROOT / "watchlist.txt"


class CollectorError(Exception):
    pass


@dataclass
class CollectorConfig:
    trade_date: Optional[str] = None
    source: str = "example"
    use_example_fallback: bool = True
    watchlist_path: Optional[str] = None


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

    def _load_watchlist(self, config: CollectorConfig) -> List[str]:
        path = Path(config.watchlist_path) if config.watchlist_path else DEFAULT_WATCHLIST
        if not path.exists():
            return []

        if path.suffix.lower() == ".json":
            data = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(data, list):
                return [str(x).strip() for x in data if str(x).strip()]
            raise CollectorError("watchlist json must be an array of stock codes")

        items: List[str] = []
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            items.append(line)
        return items

    def _last_row(self, df):
        if df is None or len(df) == 0:
            return None
        return df.iloc[-1]

    def _last_close(self, df):
        row = self._last_row(df)
        if row is None:
            return None
        value = row.get("close")
        return float(value) if value is not None else None

    def _normalize_trade_date_ymd(self, trade_date: Optional[str]) -> str:
        if not trade_date:
            raise CollectorError("trade_date is required for akshare sentiment pools")
        return str(trade_date).replace("-", "")

    def _safe_len(self, df) -> Optional[int]:
        try:
            return int(len(df)) if df is not None else None
        except Exception:
            return None

    def collect_market_snapshot(self, config: CollectorConfig) -> Dict[str, Any]:
        try:
            idx_sh = self.ak.stock_zh_index_daily(symbol="sh000001")
            idx_sz = self.ak.stock_zh_index_daily(symbol="sz399001")
            idx_cyb = self.ak.stock_zh_index_daily(symbol="sz399006")
        except Exception as exc:
            raise CollectorError(f"akshare index fetch failed: {exc}")

        last_row = self._last_row(idx_sh)
        trade_date = config.trade_date
        if trade_date is None and last_row is not None:
            date_val = last_row.get("date")
            trade_date = str(date_val) if date_val is not None else None

        zt_pool = None
        dt_pool = None
        zb_pool = None
        strong_pool = None
        try:
            pool_date = self._normalize_trade_date_ymd(trade_date)
            zt_pool = self.ak.stock_zt_pool_em(date=pool_date)
            dt_pool = self.ak.stock_zt_pool_dtgc_em(date=pool_date)
            zb_pool = self.ak.stock_zt_pool_zbgc_em(date=pool_date)
            strong_pool = self.ak.stock_zt_pool_strong_em(date=pool_date)
        except Exception:
            pass

        zt_count = self._safe_len(zt_pool)
        dt_count = self._safe_len(dt_pool)
        zb_count = self._safe_len(zb_pool)
        highest_board = None
        if zt_pool is not None and len(zt_pool) > 0 and "连板数" in zt_pool.columns:
            try:
                highest_board = int(zt_pool["连板数"].max())
            except Exception:
                highest_board = None

        blowup_rate = None
        if zt_count is not None and zb_count is not None and (zt_count + zb_count) > 0:
            blowup_rate = zb_count / (zt_count + zb_count)

        return {
            "trade_date": trade_date,
            "sh_index_close": self._last_close(idx_sh),
            "sz_index_close": self._last_close(idx_sz),
            "cyb_index_close": self._last_close(idx_cyb),
            "hs300_close": None,
            "zz500_close": None,
            "zz1000_close": None,
            "kc50_close": None,
            "market_turnover_total": None,
            "market_turnover_change": None,
            "up_count": None,
            "down_count": None,
            "limit_up_count": zt_count,
            "limit_down_count": dt_count,
            "blowup_count": zb_count,
            "blowup_rate": blowup_rate,
            "highest_board": highest_board,
            "yesterday_limit_up_premium": None,
            "high_level_stock_drawdown_flag": None,
            "northbound_net_inflow": None,
        }

    def collect_theme_snapshot(self, config: CollectorConfig) -> List[Dict[str, Any]]:
        try:
            concept_df = self.ak.stock_board_concept_name_em().head(5)
            industry_df = self.ak.stock_board_industry_name_em().head(5)
        except Exception as exc:
            raise CollectorError(f"akshare theme fetch failed: {exc}")

        trade_date = config.trade_date or self.collect_market_snapshot(config).get("trade_date")
        zt_symbols = set()
        zb_symbols = set()
        zt_board_map: Dict[str, Any] = {}
        try:
            pool_date = self._normalize_trade_date_ymd(trade_date)
            zt_pool = self.ak.stock_zt_pool_em(date=pool_date)
            zb_pool = self.ak.stock_zt_pool_zbgc_em(date=pool_date)
            if zt_pool is not None and len(zt_pool) > 0:
                for _, row in zt_pool.iterrows():
                    code = str(row.get("代码"))
                    zt_symbols.add(code)
                    zt_board_map[code] = row.get("连板数")
            if zb_pool is not None and len(zb_pool) > 0:
                for _, row in zb_pool.iterrows():
                    zb_symbols.add(str(row.get("代码")))
        except Exception:
            pass

        rows: List[Dict[str, Any]] = []

        def convert(df, theme_type: str, cons_fetcher):
            for idx, item in enumerate(df.iterrows()):
                _, row = item
                theme_name = row.get("板块名称")
                theme_limit_up_count = None
                theme_blowup_count = None
                theme_highest_board = None
                theme_leader_board_count = None
                try:
                    cons_df = cons_fetcher(symbol=theme_name)
                    if cons_df is not None and len(cons_df) > 0 and "代码" in cons_df.columns:
                        symbols = {str(x) for x in cons_df["代码"].head(80).tolist() if x is not None}
                        theme_limit_up_count = sum(1 for s in symbols if s in zt_symbols)
                        theme_blowup_count = sum(1 for s in symbols if s in zb_symbols)
                        board_values = [zt_board_map[s] for s in symbols if s in zt_board_map and zt_board_map[s] is not None]
                        if board_values:
                            try:
                                theme_highest_board = int(max(board_values))
                            except Exception:
                                theme_highest_board = None
                        leader_name = row.get("领涨股票")
                        leader_rows = cons_df[cons_df["名称"] == leader_name] if "名称" in cons_df.columns else None
                        if leader_rows is not None and len(leader_rows) > 0:
                            leader_code = str(leader_rows.iloc[0].get("代码"))
                            if leader_code in zt_board_map:
                                theme_leader_board_count = zt_board_map.get(leader_code)
                except Exception:
                    pass

                rows.append(
                    {
                        "theme_name": theme_name,
                        "theme_type": theme_type,
                        "theme_change_pct": row.get("涨跌幅"),
                        "theme_turnover": None,
                        "theme_turnover_change": None,
                        "theme_turnover_ratio": None,
                        "theme_money_flow_ratio": None,
                        "theme_limit_up_count": theme_limit_up_count,
                        "theme_blowup_count": theme_blowup_count,
                        "theme_highest_board": theme_highest_board,
                        "theme_leader_stock": row.get("领涨股票"),
                        "theme_leader_board_count": theme_leader_board_count,
                        "theme_midcap_core_stock": None,
                        "theme_core_stock_count": None,
                        "theme_follow_count": row.get("上涨家数"),
                        "theme_health_status": None,
                        "theme_stage_label": None,
                        "theme_is_main": idx == 0,
                        "theme_is_secondary": idx == 1,
                        "theme_retreat_flag": False,
                        "theme_consensus_score": None,
                    }
                )

        convert(concept_df, "概念板块", self.ak.stock_board_concept_cons_em)
        convert(industry_df, "行业板块", self.ak.stock_board_industry_cons_em)
        return rows

    def collect_stock_snapshot(self, config: CollectorConfig) -> List[Dict[str, Any]]:
        symbols = self._load_watchlist(config)
        if not symbols:
            return []

        theme_rows = self.collect_theme_snapshot(config)
        concept_themes = [x for x in theme_rows if x.get("theme_type") == "概念板块"]
        industry_themes = [x for x in theme_rows if x.get("theme_type") == "行业板块"]

        symbol_theme_map: Dict[str, List[str]] = {}

        def attach_theme(symbol: str, theme_name: str):
            symbol_theme_map.setdefault(symbol, []).append(theme_name)

        limit_up_map: Dict[str, Dict[str, Any]] = {}
        limit_down_set = set()
        blowup_set = set()
        try:
            pool_date = self._normalize_trade_date_ymd(config.trade_date or self.collect_market_snapshot(config).get("trade_date"))
            zt_pool = self.ak.stock_zt_pool_em(date=pool_date)
            dt_pool = self.ak.stock_zt_pool_dtgc_em(date=pool_date)
            zb_pool = self.ak.stock_zt_pool_zbgc_em(date=pool_date)

            if zt_pool is not None and len(zt_pool) > 0:
                for _, row in zt_pool.iterrows():
                    limit_up_map[str(row.get("代码"))] = {
                        "board_count": row.get("连板数"),
                        "sealed_order_strength": row.get("封板资金"),
                    }
            if dt_pool is not None and len(dt_pool) > 0:
                for _, row in dt_pool.iterrows():
                    limit_down_set.add(str(row.get("代码")))
            if zb_pool is not None and len(zb_pool) > 0:
                for _, row in zb_pool.iterrows():
                    blowup_set.add(str(row.get("代码")))
        except Exception:
            pass

        for theme in concept_themes[:3]:
            try:
                df = self.ak.stock_board_concept_cons_em(symbol=theme.get("theme_name"))
                for _, row in df[["代码", "名称"]].head(50).iterrows():
                    attach_theme(str(row.get("代码")), str(theme.get("theme_name")))
            except Exception:
                continue

        for theme in industry_themes[:3]:
            try:
                df = self.ak.stock_board_industry_cons_em(symbol=theme.get("theme_name"))
                for _, row in df[["代码", "名称"]].head(50).iterrows():
                    attach_theme(str(row.get("代码")), str(theme.get("theme_name")))
            except Exception:
                continue

        rows: List[Dict[str, Any]] = []
        for symbol in symbols:
            try:
                df = self.ak.stock_zh_a_hist(symbol=symbol, period="daily", adjust="")
                info_df = self.ak.stock_individual_info_em(symbol=symbol)
                if df is None or len(df) == 0:
                    continue
                tail = df.tail(60).reset_index(drop=True)
                row = tail.iloc[-1]

                closes = tail["收盘"].tolist()
                ma5 = sum(closes[-5:]) / min(len(closes), 5) if closes else None
                ma10 = sum(closes[-10:]) / min(len(closes), 10) if closes else None
                ma20 = sum(closes[-20:]) / min(len(closes), 20) if closes else None
                ma60 = sum(closes[-60:]) / min(len(closes), 60) if closes else None

                info_map = {}
                if info_df is not None and len(info_df) > 0:
                    for _, info_row in info_df.iterrows():
                        info_map[str(info_row.get("item"))] = info_row.get("value")

                matched_themes = symbol_theme_map.get(symbol, [])
                main_theme_name = matched_themes[0] if matched_themes else None

                symbol_key = str(row.get("股票代码"))
                zt_info = limit_up_map.get(symbol_key, {})
                rows.append(
                    {
                        "symbol": symbol_key,
                        "name": info_map.get("股票简称"),
                        "close_price": row.get("收盘"),
                        "open_price": row.get("开盘"),
                        "high_price": row.get("最高"),
                        "low_price": row.get("最低"),
                        "pct_change": row.get("涨跌幅"),
                        "turnover_amount": row.get("成交额"),
                        "turnover_rate": row.get("换手率"),
                        "volume_ratio": None,
                        "circulating_market_cap": info_map.get("流通市值"),
                        "total_market_cap": info_map.get("总市值"),
                        "board_count": zt_info.get("board_count", 0),
                        "days_since_last_limit_up": 0 if symbol_key in limit_up_map else None,
                        "is_recent_high_stock": None,
                        "is_previous_cycle_core": None,
                        "ma5": ma5,
                        "ma10": ma10,
                        "ma20": ma20,
                        "ma60": ma60,
                        "limit_up_flag": symbol_key in limit_up_map,
                        "limit_down_flag": symbol_key in limit_down_set,
                        "blowup_flag": symbol_key in blowup_set,
                        "sealed_order_strength": zt_info.get("sealed_order_strength"),
                        "industry": info_map.get("行业"),
                        "concept_tags": matched_themes,
                        "main_theme_name": main_theme_name,
                    }
                )
            except Exception:
                continue
        return rows


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
