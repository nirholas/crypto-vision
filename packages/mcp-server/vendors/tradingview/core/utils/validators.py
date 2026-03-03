# TradingView MCP Validators
# 
# @author nich
# @website https://x.com/nichxbt
# @github https://github.com/nirholas
# @license Apache-2.0

from __future__ import annotations
import os
from typing import Set

ALLOWED_TIMEFRAMES: Set[str] = {"5m", "15m", "1h", "4h", "1D", "1W", "1M"}
EXCHANGE_SCREENER = {
    "all": "crypto",
    "huobi": "crypto",
    "kucoin": "crypto",
    "coinbase": "crypto",
    "gateio": "crypto",
    "binance": "crypto",
    "bitfinex": "crypto",
    "bitget": "crypto",
    "bybit": "crypto",
    "okx": "crypto",
    "bist": "turkey",
    "nasdaq": "america",
    "bursa": "malaysia",
    "myx": "malaysia",
    "klse": "malaysia",
    "ace": "malaysia",
    "leap": "malaysia",
    "hkex": "hongkong",
    "hk": "hongkong",
    "hsi": "hongkong",
    "nyse": "america",
}

_this_file = __file__
_utils_dir = os.path.dirname(_this_file)
_core_dir = os.path.dirname(_utils_dir)
_package_dir = os.path.dirname(_core_dir)
COINLIST_DIR = os.path.join(_package_dir, 'coinlist')


def sanitize_timeframe(tf: str, default: str = "5m") -> str:
    if not tf:
        return default
    tfs = tf.strip()
    return tfs if tfs in ALLOWED_TIMEFRAMES else default


def sanitize_exchange(ex: str, default: str = "kucoin") -> str:
    if not ex:
        return default
    exs = ex.strip().lower()
    return exs if exs in EXCHANGE_SCREENER else default
