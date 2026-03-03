# TradingView MCP Server

Advanced TradingView crypto screener with Bollinger Band analysis and candle pattern detection.

## Author

**Nich**
- Twitter: [@nichxbt](https://x.com/nichxbt)
- GitHub: [@nirholas](https://github.com/nirholas)

## Features

- **Top Gainers/Losers**: Scan for trending coins across exchanges
- **Bollinger Band Scan**: Find squeeze opportunities with low BBW
- **Rating Filter**: Filter by Bollinger Band rating (-3 to +3)
- **Coin Analysis**: Detailed analysis for specific coins
- **Multi-Timeframe Changes**: Track price changes across timeframes

## Supported Exchanges

### Crypto Exchanges
- Binance
- KuCoin
- Bybit
- Bitget
- Coinbase
- Gate.io
- Huobi
- OKX
- Bitfinex

### Stock Markets
- NASDAQ
- NYSE
- BIST (Turkey)
- HKEX (Hong Kong)
- KLSE/Bursa (Malaysia)

## Tools

### `top_gainers`
Returns top gaining coins for an exchange and timeframe.

### `top_losers`
Returns top losing coins for an exchange and timeframe.

### `bollinger_scan`
Scans for coins with low Bollinger Band Width (squeeze detection).

### `rating_filter`
Filters coins by Bollinger Band rating (-3 to +3).

### `coin_analysis`
Gets detailed analysis for a specific coin.

### `multi_changes`
Gets price changes across multiple timeframes.

## Usage

```bash
# Run with stdio transport
tradingview-mcp stdio

# Run with SSE transport
tradingview-mcp --transport sse
```

## Dependencies

- `mcp[cli]>=1.12.0`
- `tradingview-screener>=0.6.4`
- `tradingview-ta>=3.3.0`

## License

MIT License
