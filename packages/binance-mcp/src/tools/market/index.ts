// src/tools/market/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { 
    binanceUsRequest, 
    formatKline, 
    formatAggTrade,
    ORDER_BOOK_VALID_LIMITS,
    KLINE_INTERVALS,
    ROLLING_WINDOW_SIZES,
    MAX_TRADES_LIMIT,
    MAX_KLINES_LIMIT,
    BinanceUsApiError,
    RateLimitError,
    IpBanError,
    type KlineRaw,
    type AggTradeResponse
} from "../../config/binanceUsClient.js";

/**
 * Format error response with helpful details
 */
function formatError(error: unknown): { content: { type: "text"; text: string }[]; isError: true } {
    if (error instanceof RateLimitError) {
        return {
            content: [{
                type: "text",
                text: `Rate limit exceeded. Please retry after ${error.retryAfter} seconds. Consider using WebSocket streams for real-time data.`
            }],
            isError: true
        };
    }
    if (error instanceof IpBanError) {
        return {
            content: [{
                type: "text",
                text: `IP temporarily banned. Ban will be lifted after ${error.retryAfter} seconds. Please reduce request frequency.`
            }],
            isError: true
        };
    }
    if (error instanceof BinanceUsApiError) {
        return {
            content: [{
                type: "text",
                text: `Binance.US API Error [${error.code}]: ${error.message}`
            }],
            isError: true
        };
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
        content: [{ type: "text", text: errorMessage }],
        isError: true
    };
}

/**
 * Register Market Data tools for Binance.US
 * 
 * These are public endpoints that don't require authentication.
 * Includes: order book, recent trades, klines, ticker data, etc.
 */
export function registerMarketTools(server: McpServer) {
    // binance_us_order_book - Get order book depth
    server.tool(
        "binance_us_order_book",
        "Get order book depth (bids and asks) for a trading pair on Binance.US. Returns price levels with quantities. Weight varies based on limit (1-100: weight 1, 101-500: weight 5, 501-1000: weight 10, 1001-5000: weight 50).",
        {
            symbol: z.string().toUpperCase().describe("Trading pair symbol, e.g., BTCUSD"),
            limit: z.number()
                .int()
                .min(1)
                .max(5000)
                .optional()
                .describe(`Number of price levels. Valid values: ${ORDER_BOOK_VALID_LIMITS.join(", ")}. Default 100, max 5000.`)
        },
        async ({ symbol, limit }) => {
            try {
                const params: Record<string, any> = { symbol };
                if (limit !== undefined) params.limit = limit;
                
                const result = await binanceUsRequest("GET", "/api/v3/depth", params, false);
                
                const bestBid = result.bids?.[0] || ["N/A", "N/A"];
                const bestAsk = result.asks?.[0] || ["N/A", "N/A"];
                
                return {
                    content: [{
                        type: "text",
                        text: `Order Book for ${symbol}\n` +
                            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                            `Last Update ID: ${result.lastUpdateId}\n` +
                            `Bids: ${result.bids?.length || 0} levels | Asks: ${result.asks?.length || 0} levels\n` +
                            `Best Bid: ${bestBid[0]} @ ${bestBid[1]} qty\n` +
                            `Best Ask: ${bestAsk[0]} @ ${bestAsk[1]} qty\n` +
                            `Spread: ${bestBid[0] !== "N/A" && bestAsk[0] !== "N/A" ? 
                                (parseFloat(bestAsk[0]) - parseFloat(bestBid[0])).toFixed(8) : "N/A"}\n\n` +
                            `Full Response:\n${JSON.stringify(result, null, 2)}`
                    }]
                };
            } catch (error) {
                return formatError(error);
            }
        }
    );

    // binance_us_recent_trades - Get recent trades
    server.tool(
        "binance_us_recent_trades",
        "Get recent trades for a trading pair on Binance.US. Returns trade ID, price, quantity, time, and maker/taker info.",
        {
            symbol: z.string().toUpperCase().describe("Trading pair symbol, e.g., BTCUSD"),
            limit: z.number().int().min(1).max(MAX_TRADES_LIMIT).optional()
                .describe(`Number of trades to return. Default 500, max ${MAX_TRADES_LIMIT}.`)
        },
        async ({ symbol, limit }) => {
            try {
                const params: Record<string, any> = { symbol };
                if (limit !== undefined) params.limit = limit;
                
                const result = await binanceUsRequest("GET", "/api/v3/trades", params, false);
                
                const latestTrade = result[result.length - 1];
                const oldestTrade = result[0];
                
                return {
                    content: [{
                        type: "text",
                        text: `Recent Trades for ${symbol}\n` +
                            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                            `Total trades: ${result.length}\n` +
                            `Time range: ${new Date(oldestTrade?.time).toISOString()} to ${new Date(latestTrade?.time).toISOString()}\n` +
                            `Latest: ${latestTrade?.price} @ ${latestTrade?.qty} qty (ID: ${latestTrade?.id})\n\n` +
                            `Full Response:\n${JSON.stringify(result, null, 2)}`
                    }]
                };
            } catch (error) {
                return formatError(error);
            }
        }
    );

    // binance_us_historical_trades - Get older trades (MARKET_DATA)
    server.tool(
        "binance_us_historical_trades",
        "Get older historical trades for a trading pair. Requires API key with MARKET_DATA permission.",
        {
            symbol: z.string().toUpperCase().describe("Trading pair symbol, e.g., BTCUSD"),
            limit: z.number().int().min(1).max(MAX_TRADES_LIMIT).optional()
                .describe(`Number of trades. Default 500, max ${MAX_TRADES_LIMIT}.`),
            fromId: z.number().int().positive().optional()
                .describe("Trade ID to fetch from (inclusive).")
        },
        async ({ symbol, limit, fromId }) => {
            try {
                const params: Record<string, any> = { symbol };
                if (limit !== undefined) params.limit = limit;
                if (fromId !== undefined) params.fromId = fromId;
                
                const result = await binanceUsRequest("GET", "/api/v3/historicalTrades", params, false, true);
                
                const latestTrade = result[result.length - 1];
                const oldestTrade = result[0];
                
                return {
                    content: [{
                        type: "text",
                        text: `Historical Trades for ${symbol}\n` +
                            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                            `Total trades: ${result.length}\n` +
                            `Trade ID range: ${oldestTrade?.id} to ${latestTrade?.id}\n` +
                            `Time range: ${new Date(oldestTrade?.time).toISOString()} to ${new Date(latestTrade?.time).toISOString()}\n\n` +
                            `Full Response:\n${JSON.stringify(result, null, 2)}`
                    }]
                };
            } catch (error) {
                return formatError(error);
            }
        }
    );

    // binance_us_agg_trades - Get aggregate trades
    server.tool(
        "binance_us_agg_trades",
        "Get compressed aggregate trades. Trades with same time, order, and price are aggregated.",
        {
            symbol: z.string().toUpperCase().describe("Trading pair symbol, e.g., BTCUSD"),
            fromId: z.number().int().positive().optional().describe("Agg trade ID to start from."),
            startTime: z.number().int().positive().optional().describe("Start time in ms."),
            endTime: z.number().int().positive().optional().describe("End time in ms."),
            limit: z.number().int().min(1).max(MAX_TRADES_LIMIT).optional()
                .describe(`Number of trades. Default 500, max ${MAX_TRADES_LIMIT}.`)
        },
        async ({ symbol, fromId, startTime, endTime, limit }) => {
            try {
                const params: Record<string, any> = { symbol };
                if (fromId !== undefined) params.fromId = fromId;
                if (startTime !== undefined) params.startTime = startTime;
                if (endTime !== undefined) params.endTime = endTime;
                if (limit !== undefined) params.limit = limit;
                
                const result: AggTradeResponse[] = await binanceUsRequest("GET", "/api/v3/aggTrades", params, false);
                const formattedTrades = result.map(formatAggTrade);
                
                const firstTrade = result[0];
                const lastTrade = result[result.length - 1];
                const summary = firstTrade && lastTrade ? {
                    firstAggId: firstTrade.a,
                    lastAggId: lastTrade.a,
                    timeRange: `${new Date(firstTrade.T).toISOString()} to ${new Date(lastTrade.T).toISOString()}`,
                    latestPrice: lastTrade.p
                } : null;
                
                return {
                    content: [{
                        type: "text",
                        text: `Aggregate Trades for ${symbol}\n` +
                            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                            `Total trades: ${result.length}\n` +
                            (summary ? `Agg ID range: ${summary.firstAggId} to ${summary.lastAggId}\n` +
                                `Time range: ${summary.timeRange}\n` +
                                `Latest price: ${summary.latestPrice}\n\n` : "\n") +
                            `Formatted (first 10):\n${JSON.stringify(formattedTrades.slice(0, 10), null, 2)}\n\n` +
                            `Raw Response:\n${JSON.stringify(result, null, 2)}`
                    }]
                };
            } catch (error) {
                return formatError(error);
            }
        }
    );

    // binance_us_klines - Get candlestick data
    server.tool(
        "binance_us_klines",
        "Get Kline/candlestick data for a trading pair. Returns OHLCV data.",
        {
            symbol: z.string().toUpperCase().describe("Trading pair symbol, e.g., BTCUSD"),
            interval: z.enum(KLINE_INTERVALS).describe(`Kline interval: ${KLINE_INTERVALS.join(", ")}`),
            startTime: z.number().int().positive().optional().describe("Start time in ms"),
            endTime: z.number().int().positive().optional().describe("End time in ms"),
            limit: z.number().int().min(1).max(MAX_KLINES_LIMIT).optional()
                .describe(`Number of klines. Default 500, max ${MAX_KLINES_LIMIT}.`)
        },
        async ({ symbol, interval, startTime, endTime, limit }) => {
            try {
                const params: Record<string, any> = { symbol, interval };
                if (startTime !== undefined) params.startTime = startTime;
                if (endTime !== undefined) params.endTime = endTime;
                if (limit !== undefined) params.limit = limit;
                
                const result: KlineRaw[] = await binanceUsRequest("GET", "/api/v3/klines", params, false);
                const formattedKlines = result.map(formatKline);
                
                const firstKline = formattedKlines[0];
                const latestKline = formattedKlines[formattedKlines.length - 1];
                
                let summaryText = "";
                if (formattedKlines.length > 0 && firstKline && latestKline) {
                    const highs = formattedKlines.map(k => parseFloat(k.high));
                    const lows = formattedKlines.map(k => parseFloat(k.low));
                    const volumes = formattedKlines.map(k => parseFloat(k.volume));
                    
                    summaryText = `Period: ${firstKline.openTimeISO} to ${latestKline.closeTimeISO}\n` +
                        `Latest: O:${latestKline.open} H:${latestKline.high} L:${latestKline.low} C:${latestKline.close}\n` +
                        `Period High: ${Math.max(...highs)} | Period Low: ${Math.min(...lows)}\n` +
                        `Total Volume: ${volumes.reduce((a, b) => a + b, 0).toFixed(8)}\n`;
                }
                
                return {
                    content: [{
                        type: "text",
                        text: `Klines for ${symbol} (${interval})\n` +
                            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                            `Total klines: ${result.length}\n` +
                            summaryText + "\n" +
                            `Formatted (last 5):\n${JSON.stringify(formattedKlines.slice(-5), null, 2)}\n\n` +
                            `Full Response:\n${JSON.stringify(formattedKlines, null, 2)}`
                    }]
                };
            } catch (error) {
                return formatError(error);
            }
        }
    );

    // binance_us_avg_price - Get average price
    server.tool(
        "binance_us_avg_price",
        "Get current 5-minute rolling weighted average price.",
        {
            symbol: z.string().toUpperCase().describe("Trading pair symbol, e.g., BTCUSD")
        },
        async ({ symbol }) => {
            try {
                const result = await binanceUsRequest("GET", "/api/v3/avgPrice", { symbol }, false);
                
                return {
                    content: [{
                        type: "text",
                        text: `Average Price for ${symbol}\n` +
                            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                            `Price: ${result.price}\n` +
                            `Window: ${result.mins} minutes\n\n` +
                            `Response:\n${JSON.stringify(result, null, 2)}`
                    }]
                };
            } catch (error) {
                return formatError(error);
            }
        }
    );

    // binance_us_ticker_24hr - Get 24hr statistics
    server.tool(
        "binance_us_ticker_24hr",
        "Get 24-hour rolling window price change statistics.",
        {
            symbol: z.string().toUpperCase().optional().describe("Symbol (e.g., BTCUSD). Cannot use with 'symbols'."),
            symbols: z.array(z.string()).optional().describe("Array of symbols. Cannot use with 'symbol'."),
            type: z.enum(["FULL", "MINI"]).optional().describe("FULL (default) or MINI (fewer fields).")
        },
        async ({ symbol, symbols, type }) => {
            try {
                if (symbol && symbols) {
                    return {
                        content: [{ type: "text", text: "Error: Cannot specify both 'symbol' and 'symbols'." }],
                        isError: true
                    };
                }
                
                const params: Record<string, any> = {};
                if (symbol) params.symbol = symbol;
                if (symbols?.length) params.symbols = JSON.stringify(symbols.map(s => s.toUpperCase()));
                if (type) params.type = type;
                
                const result = await binanceUsRequest("GET", "/api/v3/ticker/24hr", params, false);
                
                const isArray = Array.isArray(result);
                let summaryText: string;
                
                if (isArray) {
                    const sorted = [...result].sort((a: any, b: any) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume));
                    const top5 = sorted.slice(0, 5);
                    summaryText = `Total symbols: ${result.length}\n` +
                        `Top 5 by volume:\n${top5.map((t: any) => `  ${t.symbol}: ${t.priceChangePercent}% | Vol: ${parseFloat(t.quoteVolume).toLocaleString()}`).join("\n")}`;
                } else {
                    summaryText = `${result.symbol}: ${result.lastPrice} (${parseFloat(result.priceChangePercent) >= 0 ? "+" : ""}${result.priceChangePercent}%)\n` +
                        `High: ${result.highPrice} | Low: ${result.lowPrice}\n` +
                        `Volume: ${result.volume}`;
                }
                
                return {
                    content: [{
                        type: "text",
                        text: `24hr Ticker Statistics\n` +
                            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                            summaryText + "\n\n" +
                            `Full Response:\n${JSON.stringify(result, null, 2)}`
                    }]
                };
            } catch (error) {
                return formatError(error);
            }
        }
    );

    // binance_us_ticker_price - Get latest price
    server.tool(
        "binance_us_ticker_price",
        "Get latest price for symbol(s).",
        {
            symbol: z.string().toUpperCase().optional().describe("Symbol (e.g., BTCUSD). Cannot use with 'symbols'."),
            symbols: z.array(z.string()).optional().describe("Array of symbols. Cannot use with 'symbol'.")
        },
        async ({ symbol, symbols }) => {
            try {
                if (symbol && symbols) {
                    return {
                        content: [{ type: "text", text: "Error: Cannot specify both 'symbol' and 'symbols'." }],
                        isError: true
                    };
                }
                
                const params: Record<string, any> = {};
                if (symbol) params.symbol = symbol;
                if (symbols?.length) params.symbols = JSON.stringify(symbols.map(s => s.toUpperCase()));
                
                const result = await binanceUsRequest("GET", "/api/v3/ticker/price", params, false);
                
                const isArray = Array.isArray(result);
                const responseText = isArray
                    ? `Retrieved prices for ${result.length} symbols.`
                    : `${result.symbol}: ${result.price}`;
                
                return {
                    content: [{
                        type: "text",
                        text: `Price Ticker\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                            responseText + "\n\n" +
                            `Response:\n${JSON.stringify(result, null, 2)}`
                    }]
                };
            } catch (error) {
                return formatError(error);
            }
        }
    );

    // binance_us_ticker_book - Get book ticker
    server.tool(
        "binance_us_ticker_book",
        "Get best bid/ask prices and quantities (top of book).",
        {
            symbol: z.string().toUpperCase().optional().describe("Symbol (e.g., BTCUSD). Cannot use with 'symbols'."),
            symbols: z.array(z.string()).optional().describe("Array of symbols. Cannot use with 'symbol'.")
        },
        async ({ symbol, symbols }) => {
            try {
                if (symbol && symbols) {
                    return {
                        content: [{ type: "text", text: "Error: Cannot specify both 'symbol' and 'symbols'." }],
                        isError: true
                    };
                }
                
                const params: Record<string, any> = {};
                if (symbol) params.symbol = symbol;
                if (symbols?.length) params.symbols = JSON.stringify(symbols.map(s => s.toUpperCase()));
                
                const result = await binanceUsRequest("GET", "/api/v3/ticker/bookTicker", params, false);
                
                const isArray = Array.isArray(result);
                let summaryText: string;
                
                if (isArray) {
                    summaryText = `Total symbols: ${result.length}`;
                } else {
                    const spread = (parseFloat(result.askPrice) - parseFloat(result.bidPrice)).toFixed(8);
                    const midPrice = ((parseFloat(result.askPrice) + parseFloat(result.bidPrice)) / 2).toFixed(8);
                    summaryText = `${result.symbol}\n` +
                        `Bid: ${result.bidPrice} @ ${result.bidQty}\n` +
                        `Ask: ${result.askPrice} @ ${result.askQty}\n` +
                        `Spread: ${spread} | Mid: ${midPrice}`;
                }
                
                return {
                    content: [{
                        type: "text",
                        text: `Book Ticker\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                            summaryText + "\n\n" +
                            `Response:\n${JSON.stringify(result, null, 2)}`
                    }]
                };
            } catch (error) {
                return formatError(error);
            }
        }
    );

    // binance_us_rolling_window - Get rolling window stats
    server.tool(
        "binance_us_rolling_window",
        "Get rolling window price change statistics with custom window sizes (1m to 7d).",
        {
            symbol: z.string().toUpperCase().optional().describe("Symbol (required if 'symbols' not provided)."),
            symbols: z.array(z.string()).optional().describe("Array of symbols (required if 'symbol' not provided)."),
            windowSize: z.enum(ROLLING_WINDOW_SIZES).optional().describe(`Window size. Default 1d. Options: ${ROLLING_WINDOW_SIZES.join(", ")}`),
            type: z.enum(["FULL", "MINI"]).optional().describe("FULL (default) or MINI.")
        },
        async ({ symbol, symbols, windowSize, type }) => {
            try {
                if (!symbol && !symbols?.length) {
                    return {
                        content: [{ type: "text", text: "Error: Either 'symbol' or 'symbols' must be provided." }],
                        isError: true
                    };
                }
                if (symbol && symbols) {
                    return {
                        content: [{ type: "text", text: "Error: Cannot specify both 'symbol' and 'symbols'." }],
                        isError: true
                    };
                }
                
                const params: Record<string, any> = {};
                if (symbol) params.symbol = symbol;
                if (symbols?.length) params.symbols = JSON.stringify(symbols.map(s => s.toUpperCase()));
                if (windowSize) params.windowSize = windowSize;
                if (type) params.type = type;
                
                const result = await binanceUsRequest("GET", "/api/v3/ticker", params, false);
                
                const isArray = Array.isArray(result);
                const windowText = windowSize || "1d";
                let summaryText: string;
                
                if (isArray) {
                    summaryText = `Window: ${windowText}\nTotal symbols: ${result.length}`;
                } else {
                    summaryText = `${result.symbol} (${windowText})\n` +
                        `Price: ${result.lastPrice} (${parseFloat(result.priceChangePercent) >= 0 ? "+" : ""}${result.priceChangePercent}%)\n` +
                        `High: ${result.highPrice} | Low: ${result.lowPrice}\n` +
                        `Volume: ${result.volume} | Trades: ${result.count}`;
                }
                
                return {
                    content: [{
                        type: "text",
                        text: `Rolling Window Statistics\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                            summaryText + "\n\n" +
                            `Response:\n${JSON.stringify(result, null, 2)}`
                    }]
                };
            } catch (error) {
                return formatError(error);
            }
        }
    );
}
