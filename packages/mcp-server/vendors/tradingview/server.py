# TradingView MCP Server
# Model Context Protocol server for TradingView crypto screener tools
# 
# @author nich
# @website https://x.com/nichxbt
# @github https://github.com/nirholas
# @license Apache-2.0

from __future__ import annotations

import argparse
import os
from typing import Any, Dict, List, Optional
from typing_extensions import TypedDict
from mcp.server.fastmcp import FastMCP

from tradingview_mcp.core.services.indicators import compute_metrics
from tradingview_mcp.core.services.coinlist import load_symbols
from tradingview_mcp.core.utils.validators import sanitize_timeframe, sanitize_exchange, EXCHANGE_SCREENER, ALLOWED_TIMEFRAMES

try:
    from tradingview_ta import TA_Handler, get_multiple_analysis
    TRADINGVIEW_TA_AVAILABLE = True
except ImportError:
    TRADINGVIEW_TA_AVAILABLE = False

try:
    from tradingview_screener import Query
    from tradingview_screener.column import Column
    TRADINGVIEW_SCREENER_AVAILABLE = True
except ImportError:
    TRADINGVIEW_SCREENER_AVAILABLE = False


class IndicatorMap(TypedDict, total=False):
    open: Optional[float]
    close: Optional[float]
    SMA20: Optional[float]
    BB_upper: Optional[float]
    BB_lower: Optional[float]
    EMA50: Optional[float]
    RSI: Optional[float]
    volume: Optional[float]


class Row(TypedDict):
    symbol: str
    changePercent: float
    indicators: IndicatorMap


class MultiRow(TypedDict):
    symbol: str
    changes: dict[str, Optional[float]]
    base_indicators: IndicatorMap


def _map_indicators(raw: Dict[str, Any]) -> IndicatorMap:
    return IndicatorMap(
        open=raw.get("open"),
        close=raw.get("close"),
        SMA20=raw.get("SMA20"),
        BB_upper=raw.get("BB.upper") if "BB.upper" in raw else raw.get("BB_upper"),
        BB_lower=raw.get("BB.lower") if "BB.lower" in raw else raw.get("BB_lower"),
        EMA50=raw.get("EMA50"),
        RSI=raw.get("RSI"),
        volume=raw.get("volume"),
    )


def _percent_change(o: Optional[float], c: Optional[float]) -> Optional[float]:
    try:
        if o in (None, 0) or c is None:
            return None
        return (c - o) / o * 100
    except Exception:
        return None


def _tf_to_tv_resolution(tf: Optional[str]) -> Optional[str]:
    if not tf:
        return None
    return {"5m": "5", "15m": "15", "1h": "60", "4h": "240", "1D": "1D", "1W": "1W", "1M": "1M"}.get(tf)


def _fetch_bollinger_analysis(exchange: str, timeframe: str = "4h", limit: int = 50, bbw_filter: float = None) -> List[Row]:
    """Fetch analysis using tradingview_ta with bollinger band logic from the original screener."""
    if not TRADINGVIEW_TA_AVAILABLE:
        raise RuntimeError("tradingview_ta is missing; run `uv sync`.")
    
    symbols = load_symbols(exchange)
    if not symbols:
        raise RuntimeError(f"No symbols found for exchange: {exchange}")
    
    symbols = symbols[:limit * 2]
    
    screener = EXCHANGE_SCREENER.get(exchange, "crypto")
    
    try:
        analysis = get_multiple_analysis(screener=screener, interval=timeframe, symbols=symbols)
    except Exception as e:
        raise RuntimeError(f"Analysis failed: {str(e)}")
    
    rows: List[Row] = []
    
    for key, value in analysis.items():
        try:
            if value is None:
                continue
                
            indicators = value.indicators
            metrics = compute_metrics(indicators)
            
            if not metrics or metrics.get('bbw') is None:
                continue
            
            if bbw_filter is not None and (metrics['bbw'] >= bbw_filter or metrics['bbw'] <= 0):
                continue
            
            if not (indicators.get("EMA50") and indicators.get("RSI")):
                continue
                
            rows.append(Row(
                symbol=key,
                changePercent=metrics['change'],
                indicators=IndicatorMap(
                    open=metrics.get('open'),
                    close=metrics.get('price'),
                    SMA20=indicators.get("SMA20"),
                    BB_upper=indicators.get("BB.upper"),
                    BB_lower=indicators.get("BB.lower"),
                    EMA50=indicators.get("EMA50"),
                    RSI=indicators.get("RSI"),
                    volume=indicators.get("volume"),
                )
            ))
                
        except (TypeError, ZeroDivisionError, KeyError):
            continue
    
    rows.sort(key=lambda x: x["changePercent"], reverse=True)
    
    return rows[:limit]


def _fetch_trending_analysis(exchange: str, timeframe: str = "5m", filter_type: str = "", rating_filter: int = None, limit: int = 50) -> List[Row]:
    """Fetch trending coins analysis similar to the original app's trending endpoint."""
    if not TRADINGVIEW_TA_AVAILABLE:
        raise RuntimeError("tradingview_ta is missing; run `uv sync`.")
    
    symbols = load_symbols(exchange)
    if not symbols:
        raise RuntimeError(f"No symbols found for exchange: {exchange}")
    
    batch_size = 200
    all_coins = []
    
    screener = EXCHANGE_SCREENER.get(exchange, "crypto")
    
    for i in range(0, len(symbols), batch_size):
        batch_symbols = symbols[i:i + batch_size]
        
        try:
            analysis = get_multiple_analysis(screener=screener, interval=timeframe, symbols=batch_symbols)
        except Exception as e:
            continue
            
        for key, value in analysis.items():
            try:
                if value is None:
                    continue
                    
                indicators = value.indicators
                metrics = compute_metrics(indicators)
                
                if not metrics or metrics.get('bbw') is None:
                    continue
                
                if filter_type == "rating" and rating_filter is not None:
                    if metrics['rating'] != rating_filter:
                        continue
                
                all_coins.append(Row(
                    symbol=key,
                    changePercent=metrics['change'],
                    indicators=IndicatorMap(
                        open=metrics.get('open'),
                        close=metrics.get('price'),
                        SMA20=indicators.get("SMA20"),
                        BB_upper=indicators.get("BB.upper"),
                        BB_lower=indicators.get("BB.lower"),
                        EMA50=indicators.get("EMA50"),
                        RSI=indicators.get("RSI"),
                        volume=indicators.get("volume"),
                    )
                ))
                
            except (TypeError, ZeroDivisionError, KeyError):
                continue
    
    all_coins.sort(key=lambda x: x["changePercent"], reverse=True)
    
    return all_coins[:limit]


def _fetch_multi_changes(exchange: str, timeframes: List[str] | None, base_timeframe: str = "4h", limit: int | None = None, cookies: Any | None = None) -> List[MultiRow]:
    try:
        from tradingview_screener import Query
        from tradingview_screener.column import Column
    except Exception as e:
        raise RuntimeError("tradingview-screener missing; run `uv sync`.") from e

    tfs = timeframes or ["15m", "1h", "4h", "1D"]
    suffix_map: dict[str, str] = {}
    for tf in tfs:
        s = _tf_to_tv_resolution(tf)
        if s:
            suffix_map[tf] = s
    if not suffix_map:
        suffix_map = {base_timeframe: _tf_to_tv_resolution(base_timeframe) or "240"}

    base_suffix = _tf_to_tv_resolution(base_timeframe) or next(iter(suffix_map.values()))
    cols: list[str] = []
    seen: set[str] = set()
    for tf, s in suffix_map.items():
        for c in (f"open|{s}", f"close|{s}"):
            if c not in seen:
                cols.append(c)
                seen.add(c)
    for c in (f"SMA20|{base_suffix}", f"BB.upper|{base_suffix}", f"BB.lower|{base_suffix}", f"volume|{base_suffix}"):
        if c not in seen:
            cols.append(c)
            seen.add(c)

    q = Query().set_markets("crypto").select(*cols)
    if exchange:
        q = q.where(Column("exchange") == exchange.upper())
    if limit:
        q = q.limit(int(limit))

    _total, df = q.get_scanner_data(cookies=cookies)
    if df is None or df.empty:
        return []

    out: List[MultiRow] = []
    for _, r in df.iterrows():
        symbol = r.get("ticker")
        changes: dict[str, Optional[float]] = {}
        for tf, s in suffix_map.items():
            o = r.get(f"open|{s}")
            c = r.get(f"close|{s}")
            changes[tf] = _percent_change(o, c)
        base_ind = IndicatorMap(
            open=r.get(f"open|{base_suffix}"),
            close=r.get(f"close|{base_suffix}"),
            SMA20=r.get(f"SMA20|{base_suffix}"),
            BB_upper=r.get(f"BB.upper|{base_suffix}"),
            BB_lower=r.get(f"BB.lower|{base_suffix}"),
            volume=r.get(f"volume|{base_suffix}"),
        )
        out.append(MultiRow(symbol=symbol, changes=changes, base_indicators=base_ind))
    return out


mcp = FastMCP(
    name="TradingView Screener",
    instructions=("Crypto screener utilities backed by TradingView Screener. Tools: top_gainers, top_losers, multi_changes."),
)


@mcp.tool()
def top_gainers(exchange: str = "KUCOIN", timeframe: str = "15m", limit: int = 25) -> list[dict]:
    """Return top gainers for an exchange and timeframe using bollinger band analysis.
    
    Args:
        exchange: Exchange name like KUCOIN, BINANCE, BYBIT, etc.
        timeframe: One of 5m, 15m, 1h, 4h, 1D, 1W, 1M
        limit: Number of rows to return (max 50)
    """
    exchange = sanitize_exchange(exchange, "KUCOIN")
    timeframe = sanitize_timeframe(timeframe, "15m")
    limit = max(1, min(limit, 50))
    
    rows = _fetch_trending_analysis(exchange, timeframe=timeframe, limit=limit)
    return [{
        "symbol": row["symbol"],
        "changePercent": row["changePercent"], 
        "indicators": dict(row["indicators"])
    } for row in rows]


@mcp.tool()
def top_losers(exchange: str = "KUCOIN", timeframe: str = "15m", limit: int = 25) -> list[dict]:
    """Return top losers for an exchange and timeframe using bollinger band analysis."""
    exchange = sanitize_exchange(exchange, "KUCOIN")
    timeframe = sanitize_timeframe(timeframe, "15m")
    limit = max(1, min(limit, 50))
    
    rows = _fetch_trending_analysis(exchange, timeframe=timeframe, limit=limit)
    rows.sort(key=lambda x: x["changePercent"])
    
    return [{
        "symbol": row["symbol"],
        "changePercent": row["changePercent"],
        "indicators": dict(row["indicators"])
    } for row in rows[:limit]]


@mcp.tool()
def bollinger_scan(exchange: str = "KUCOIN", timeframe: str = "4h", bbw_threshold: float = 0.04, limit: int = 50) -> list[dict]:
    """Scan for coins with low Bollinger Band Width (squeeze detection).
    
    Args:
        exchange: Exchange name like KUCOIN, BINANCE, BYBIT, etc.
        timeframe: One of 5m, 15m, 1h, 4h, 1D, 1W, 1M  
        bbw_threshold: Maximum BBW value to filter (default 0.04)
        limit: Number of rows to return (max 100)
    """
    exchange = sanitize_exchange(exchange, "KUCOIN")
    timeframe = sanitize_timeframe(timeframe, "4h")
    limit = max(1, min(limit, 100))
    
    rows = _fetch_bollinger_analysis(exchange, timeframe=timeframe, bbw_filter=bbw_threshold, limit=limit)
    return [{
        "symbol": row["symbol"],
        "changePercent": row["changePercent"],
        "indicators": dict(row["indicators"])
    } for row in rows]


@mcp.tool()
def rating_filter(exchange: str = "KUCOIN", timeframe: str = "5m", rating: int = 2, limit: int = 25) -> list[dict]:
    """Filter coins by Bollinger Band rating.
    
    Args:
        exchange: Exchange name like KUCOIN, BINANCE, BYBIT, etc.
        timeframe: One of 5m, 15m, 1h, 4h, 1D, 1W, 1M
        rating: BB rating (-3 to +3): -3=Strong Sell, -2=Sell, -1=Weak Sell, 1=Weak Buy, 2=Buy, 3=Strong Buy
        limit: Number of rows to return (max 50)
    """
    exchange = sanitize_exchange(exchange, "KUCOIN")
    timeframe = sanitize_timeframe(timeframe, "5m")
    rating = max(-3, min(3, rating))
    limit = max(1, min(limit, 50))
    
    rows = _fetch_trending_analysis(exchange, timeframe=timeframe, filter_type="rating", rating_filter=rating, limit=limit)
    return [{
        "symbol": row["symbol"],
        "changePercent": row["changePercent"],
        "indicators": dict(row["indicators"])
    } for row in rows]


@mcp.tool()
def coin_analysis(
    symbol: str,
    exchange: str = "KUCOIN",
    timeframe: str = "15m"
) -> dict:
    """Get detailed analysis for a specific coin on specified exchange and timeframe.
    
    Args:
        symbol: Coin symbol (e.g., "ACEUSDT", "BTCUSDT")
        exchange: Exchange name (BINANCE, KUCOIN, etc.) 
        timeframe: Time interval (5m, 15m, 1h, 4h, 1D, 1W, 1M)
    
    Returns:
        Detailed coin analysis with all indicators and metrics
    """
    try:
        exchange = sanitize_exchange(exchange, "KUCOIN")
        timeframe = sanitize_timeframe(timeframe, "15m")
        
        if ":" not in symbol:
            full_symbol = f"{exchange.upper()}:{symbol.upper()}"
        else:
            full_symbol = symbol.upper()
        
        screener = EXCHANGE_SCREENER.get(exchange, "crypto")
        
        try:
            analysis = get_multiple_analysis(
                screener=screener,
                interval=timeframe,
                symbols=[full_symbol]
            )
            
            if full_symbol not in analysis or analysis[full_symbol] is None:
                return {
                    "error": f"No data found for {symbol} on {exchange}",
                    "symbol": symbol,
                    "exchange": exchange,
                }
            
            value = analysis[full_symbol]
            indicators = value.indicators
            metrics = compute_metrics(indicators)
            
            return {
                "symbol": full_symbol,
                "exchange": exchange,
                "timeframe": timeframe,
                "metrics": metrics,
                "indicators": {
                    "open": indicators.get("open"),
                    "close": indicators.get("close"),
                    "high": indicators.get("high"),
                    "low": indicators.get("low"),
                    "volume": indicators.get("volume"),
                    "SMA20": indicators.get("SMA20"),
                    "EMA50": indicators.get("EMA50"),
                    "RSI": indicators.get("RSI"),
                    "MACD": indicators.get("MACD.macd"),
                    "BB_upper": indicators.get("BB.upper"),
                    "BB_lower": indicators.get("BB.lower"),
                },
                "summary": value.summary if hasattr(value, 'summary') else None,
            }
            
        except Exception as e:
            return {
                "error": f"Analysis failed: {str(e)}",
                "symbol": symbol,
                "exchange": exchange,
            }
            
    except Exception as e:
        return {
            "error": f"Error: {str(e)}",
            "symbol": symbol,
        }


@mcp.tool()
def multi_changes(exchange: str = "", timeframes: str = "15m,1h,4h,1D", limit: int = 50) -> list[dict]:
    """Get price changes across multiple timeframes.
    
    Args:
        exchange: Optional exchange filter (e.g., BINANCE, KUCOIN)
        timeframes: Comma-separated timeframes (e.g., "15m,1h,4h,1D")
        limit: Number of results (max 100)
    """
    tfs = [t.strip() for t in timeframes.split(",") if t.strip()]
    limit = max(1, min(limit, 100))
    
    rows = _fetch_multi_changes(exchange, tfs, limit=limit)
    return [{
        "symbol": row["symbol"],
        "changes": row["changes"],
        "base_indicators": dict(row["base_indicators"])
    } for row in rows]


def main():
    """Main entry point for the TradingView MCP server."""
    parser = argparse.ArgumentParser(description="TradingView MCP Server")
    parser.add_argument("--transport", choices=["stdio", "sse"], default="stdio")
    args = parser.parse_args()
    
    mcp.run(transport=args.transport)


if __name__ == "__main__":
    main()
