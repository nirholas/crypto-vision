/**
 * TradingView Screener Tools
 * 
 * @author nich
 * @website https://x.com/nichxbt
 * @github https://github.com/nirholas
 * @license Apache-2.0
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import ccxt from "ccxt";

// Supported exchanges and their screener types
const EXCHANGE_SCREENER: Record<string, string> = {
  binance: "crypto",
  kucoin: "crypto",
  bybit: "crypto",
  okx: "crypto",
  bitget: "crypto",
  mexc: "crypto",
  gateio: "crypto",
  huobi: "crypto",
  kraken: "crypto",
  coinbase: "crypto",
};

const ALLOWED_TIMEFRAMES = ["5m", "15m", "1h", "4h", "1d", "1w"];

interface IndicatorMap {
  open?: number | null;
  close?: number | null;
  high?: number | null;
  low?: number | null;
  volume?: number | null;
  sma20?: number | null;
  ema50?: number | null;
  rsi?: number | null;
  bbUpper?: number | null;
  bbLower?: number | null;
  bbWidth?: number | null;
}

interface ScreenerRow {
  symbol: string;
  changePercent: number;
  indicators: IndicatorMap;
}

// Fetch OHLCV data for multiple symbols
async function fetchBatchOhlcv(
  exchange: ccxt.Exchange,
  symbols: string[],
  timeframe: string,
  limit: number = 100
): Promise<Map<string, number[][]>> {
  const results = new Map<string, number[][]>();
  
  // Process symbols in parallel with rate limiting
  const batchSize = 10;
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    const promises = batch.map(async (symbol) => {
      try {
        const ohlcv = await exchange.fetchOHLCV(symbol, timeframe, undefined, limit);
        return { symbol, ohlcv };
      } catch {
        return { symbol, ohlcv: [] };
      }
    });
    
    const batchResults = await Promise.all(promises);
    for (const { symbol, ohlcv } of batchResults) {
      if (ohlcv.length > 0) {
        results.set(symbol, ohlcv);
      }
    }
    
    // Rate limiting between batches
    if (i + batchSize < symbols.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return results;
}

// Calculate technical indicators from OHLCV data
function calculateIndicators(ohlcv: number[][]): IndicatorMap {
  if (ohlcv.length < 20) return {};
  
  const closes = ohlcv.map(c => c[4]);
  const highs = ohlcv.map(c => c[2]);
  const lows = ohlcv.map(c => c[3]);
  const volumes = ohlcv.map(c => c[5]);
  const latest = ohlcv[ohlcv.length - 1];
  
  // SMA 20
  const sma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  
  // EMA 50 (simplified calculation)
  const ema50 = calculateEMA(closes, 50);
  
  // RSI 14
  const rsi = calculateRSI(closes, 14);
  
  // Bollinger Bands
  const stdDev = calculateStdDev(closes.slice(-20));
  const bbUpper = sma20 + (2 * stdDev);
  const bbLower = sma20 - (2 * stdDev);
  const bbWidth = sma20 > 0 ? ((bbUpper - bbLower) / sma20) * 100 : 0;
  
  return {
    open: latest[1],
    close: latest[4],
    high: Math.max(...highs.slice(-20)),
    low: Math.min(...lows.slice(-20)),
    volume: volumes[volumes.length - 1],
    sma20,
    ema50,
    rsi,
    bbUpper,
    bbLower,
    bbWidth,
  };
}

function calculateEMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1];
  
  const multiplier = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema;
  }
  
  return ema;
}

function calculateRSI(prices: number[], period: number): number {
  if (prices.length < period + 1) return 50;
  
  const changes = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }
  
  const gains = changes.map(c => c > 0 ? c : 0);
  const losses = changes.map(c => c < 0 ? -c : 0);
  
  const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
  const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period;
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateStdDev(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
}

function calculatePercentChange(open: number | undefined | null, close: number | undefined | null): number {
  if (!open || !close || open === 0) return 0;
  return ((close - open) / open) * 100;
}

// Get exchange instance with caching
const exchangeCache = new Map<string, ccxt.Exchange>();

function getExchange(exchangeId: string): ccxt.Exchange {
  const normalizedId = exchangeId.toLowerCase();
  
  if (!exchangeCache.has(normalizedId)) {
    const ExchangeClass = ccxt[normalizedId as keyof typeof ccxt] as new (config?: ccxt.ExchangeOptions) => ccxt.Exchange;
    if (!ExchangeClass) {
      throw new Error(`Exchange ${exchangeId} not supported`);
    }
    exchangeCache.set(normalizedId, new ExchangeClass({ enableRateLimit: true }));
  }
  
  return exchangeCache.get(normalizedId)!;
}

export function registerScreenerTools(server: McpServer): void {
  server.tool(
    "screener_top_gainers",
    "Get top gaining cryptocurrencies on an exchange with technical indicators",
    {
      exchange: z.string().default("binance").describe("Exchange name (binance, kucoin, bybit, etc.)"),
      timeframe: z.enum(["5m", "15m", "1h", "4h", "1d", "1w"]).default("15m").describe("Timeframe for analysis"),
      limit: z.number().default(25).min(1).max(100).describe("Number of results to return"),
      quoteAsset: z.string().default("USDT").describe("Quote asset to filter by (USDT, BTC, etc.)"),
    },
    async ({ exchange, timeframe, limit, quoteAsset }) => {
      try {
        const ex = getExchange(exchange);
        await ex.loadMarkets();
        
        // Filter symbols by quote asset
        const symbols = Object.keys(ex.markets)
          .filter(s => s.endsWith(`/${quoteAsset}`))
          .slice(0, limit * 3); // Get extra for filtering
        
        const ohlcvMap = await fetchBatchOhlcv(ex, symbols, timeframe);
        
        const results: ScreenerRow[] = [];
        
        for (const [symbol, ohlcv] of ohlcvMap) {
          const indicators = calculateIndicators(ohlcv);
          const changePercent = calculatePercentChange(indicators.open, indicators.close);
          
          results.push({
            symbol,
            changePercent,
            indicators,
          });
        }
        
        // Sort by change percent descending (top gainers)
        results.sort((a, b) => b.changePercent - a.changePercent);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify(results.slice(0, limit), null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error: ${(error as Error).message}`,
          }],
        };
      }
    }
  );

  server.tool(
    "screener_top_losers",
    "Get top losing cryptocurrencies on an exchange with technical indicators",
    {
      exchange: z.string().default("binance").describe("Exchange name (binance, kucoin, bybit, etc.)"),
      timeframe: z.enum(["5m", "15m", "1h", "4h", "1d", "1w"]).default("15m").describe("Timeframe for analysis"),
      limit: z.number().default(25).min(1).max(100).describe("Number of results to return"),
      quoteAsset: z.string().default("USDT").describe("Quote asset to filter by (USDT, BTC, etc.)"),
    },
    async ({ exchange, timeframe, limit, quoteAsset }) => {
      try {
        const ex = getExchange(exchange);
        await ex.loadMarkets();
        
        const symbols = Object.keys(ex.markets)
          .filter(s => s.endsWith(`/${quoteAsset}`))
          .slice(0, limit * 3);
        
        const ohlcvMap = await fetchBatchOhlcv(ex, symbols, timeframe);
        
        const results: ScreenerRow[] = [];
        
        for (const [symbol, ohlcv] of ohlcvMap) {
          const indicators = calculateIndicators(ohlcv);
          const changePercent = calculatePercentChange(indicators.open, indicators.close);
          
          results.push({
            symbol,
            changePercent,
            indicators,
          });
        }
        
        // Sort by change percent ascending (top losers)
        results.sort((a, b) => a.changePercent - b.changePercent);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify(results.slice(0, limit), null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error: ${(error as Error).message}`,
          }],
        };
      }
    }
  );

  server.tool(
    "screener_bollinger_squeeze",
    "Find cryptocurrencies with narrow Bollinger Band width (potential breakout candidates)",
    {
      exchange: z.string().default("binance").describe("Exchange name"),
      timeframe: z.enum(["5m", "15m", "1h", "4h", "1d", "1w"]).default("4h").describe("Timeframe for analysis"),
      maxBbWidth: z.number().default(5).describe("Maximum BB width percentage to filter"),
      limit: z.number().default(25).min(1).max(100).describe("Number of results to return"),
      quoteAsset: z.string().default("USDT").describe("Quote asset to filter by"),
    },
    async ({ exchange, timeframe, maxBbWidth, limit, quoteAsset }) => {
      try {
        const ex = getExchange(exchange);
        await ex.loadMarkets();
        
        const symbols = Object.keys(ex.markets)
          .filter(s => s.endsWith(`/${quoteAsset}`))
          .slice(0, 200);
        
        const ohlcvMap = await fetchBatchOhlcv(ex, symbols, timeframe);
        
        const results: ScreenerRow[] = [];
        
        for (const [symbol, ohlcv] of ohlcvMap) {
          const indicators = calculateIndicators(ohlcv);
          
          // Filter by BB width
          if (indicators.bbWidth && indicators.bbWidth <= maxBbWidth && indicators.bbWidth > 0) {
            const changePercent = calculatePercentChange(indicators.open, indicators.close);
            results.push({
              symbol,
              changePercent,
              indicators,
            });
          }
        }
        
        // Sort by BB width ascending (tightest squeeze first)
        results.sort((a, b) => (a.indicators.bbWidth || 100) - (b.indicators.bbWidth || 100));
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify(results.slice(0, limit), null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error: ${(error as Error).message}`,
          }],
        };
      }
    }
  );

  server.tool(
    "screener_rsi_oversold",
    "Find cryptocurrencies with RSI below a threshold (potentially oversold)",
    {
      exchange: z.string().default("binance").describe("Exchange name"),
      timeframe: z.enum(["5m", "15m", "1h", "4h", "1d", "1w"]).default("1h").describe("Timeframe for analysis"),
      maxRsi: z.number().default(30).describe("Maximum RSI value to filter"),
      limit: z.number().default(25).min(1).max(100).describe("Number of results to return"),
      quoteAsset: z.string().default("USDT").describe("Quote asset to filter by"),
    },
    async ({ exchange, timeframe, maxRsi, limit, quoteAsset }) => {
      try {
        const ex = getExchange(exchange);
        await ex.loadMarkets();
        
        const symbols = Object.keys(ex.markets)
          .filter(s => s.endsWith(`/${quoteAsset}`))
          .slice(0, 200);
        
        const ohlcvMap = await fetchBatchOhlcv(ex, symbols, timeframe);
        
        const results: ScreenerRow[] = [];
        
        for (const [symbol, ohlcv] of ohlcvMap) {
          const indicators = calculateIndicators(ohlcv);
          
          if (indicators.rsi && indicators.rsi <= maxRsi) {
            const changePercent = calculatePercentChange(indicators.open, indicators.close);
            results.push({
              symbol,
              changePercent,
              indicators,
            });
          }
        }
        
        // Sort by RSI ascending (most oversold first)
        results.sort((a, b) => (a.indicators.rsi || 100) - (b.indicators.rsi || 100));
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify(results.slice(0, limit), null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error: ${(error as Error).message}`,
          }],
        };
      }
    }
  );

  server.tool(
    "screener_rsi_overbought",
    "Find cryptocurrencies with RSI above a threshold (potentially overbought)",
    {
      exchange: z.string().default("binance").describe("Exchange name"),
      timeframe: z.enum(["5m", "15m", "1h", "4h", "1d", "1w"]).default("1h").describe("Timeframe for analysis"),
      minRsi: z.number().default(70).describe("Minimum RSI value to filter"),
      limit: z.number().default(25).min(1).max(100).describe("Number of results to return"),
      quoteAsset: z.string().default("USDT").describe("Quote asset to filter by"),
    },
    async ({ exchange, timeframe, minRsi, limit, quoteAsset }) => {
      try {
        const ex = getExchange(exchange);
        await ex.loadMarkets();
        
        const symbols = Object.keys(ex.markets)
          .filter(s => s.endsWith(`/${quoteAsset}`))
          .slice(0, 200);
        
        const ohlcvMap = await fetchBatchOhlcv(ex, symbols, timeframe);
        
        const results: ScreenerRow[] = [];
        
        for (const [symbol, ohlcv] of ohlcvMap) {
          const indicators = calculateIndicators(ohlcv);
          
          if (indicators.rsi && indicators.rsi >= minRsi) {
            const changePercent = calculatePercentChange(indicators.open, indicators.close);
            results.push({
              symbol,
              changePercent,
              indicators,
            });
          }
        }
        
        // Sort by RSI descending (most overbought first)
        results.sort((a, b) => (b.indicators.rsi || 0) - (a.indicators.rsi || 0));
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify(results.slice(0, limit), null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error: ${(error as Error).message}`,
          }],
        };
      }
    }
  );

  server.tool(
    "screener_multi_timeframe",
    "Analyze a symbol across multiple timeframes",
    {
      exchange: z.string().default("binance").describe("Exchange name"),
      symbol: z.string().describe("Trading pair symbol (e.g., BTC/USDT)"),
      timeframes: z.array(z.enum(["5m", "15m", "1h", "4h", "1d", "1w"])).default(["15m", "1h", "4h", "1d"]).describe("Timeframes to analyze"),
    },
    async ({ exchange, symbol, timeframes }) => {
      try {
        const ex = getExchange(exchange);
        await ex.loadMarkets();
        
        const results: Record<string, { changePercent: number; indicators: IndicatorMap }> = {};
        
        for (const tf of timeframes) {
          try {
            const ohlcv = await ex.fetchOHLCV(symbol, tf, undefined, 100);
            const indicators = calculateIndicators(ohlcv);
            const changePercent = calculatePercentChange(indicators.open, indicators.close);
            
            results[tf] = { changePercent, indicators };
          } catch {
            results[tf] = { changePercent: 0, indicators: {} };
          }
        }
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ symbol, analysis: results }, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error: ${(error as Error).message}`,
          }],
        };
      }
    }
  );

  server.tool(
    "screener_volume_surge",
    "Find cryptocurrencies with unusually high volume compared to average",
    {
      exchange: z.string().default("binance").describe("Exchange name"),
      timeframe: z.enum(["5m", "15m", "1h", "4h", "1d", "1w"]).default("1h").describe("Timeframe for analysis"),
      minVolumeMultiplier: z.number().default(2).describe("Minimum volume multiplier vs average"),
      limit: z.number().default(25).min(1).max(100).describe("Number of results to return"),
      quoteAsset: z.string().default("USDT").describe("Quote asset to filter by"),
    },
    async ({ exchange, timeframe, minVolumeMultiplier, limit, quoteAsset }) => {
      try {
        const ex = getExchange(exchange);
        await ex.loadMarkets();
        
        const symbols = Object.keys(ex.markets)
          .filter(s => s.endsWith(`/${quoteAsset}`))
          .slice(0, 200);
        
        const ohlcvMap = await fetchBatchOhlcv(ex, symbols, timeframe);
        
        const results: Array<ScreenerRow & { volumeMultiplier: number }> = [];
        
        for (const [symbol, ohlcv] of ohlcvMap) {
          if (ohlcv.length < 20) continue;
          
          const volumes = ohlcv.map(c => c[5]);
          const avgVolume = volumes.slice(0, -1).reduce((a, b) => a + b, 0) / (volumes.length - 1);
          const currentVolume = volumes[volumes.length - 1];
          const volumeMultiplier = avgVolume > 0 ? currentVolume / avgVolume : 0;
          
          if (volumeMultiplier >= minVolumeMultiplier) {
            const indicators = calculateIndicators(ohlcv);
            const changePercent = calculatePercentChange(indicators.open, indicators.close);
            
            results.push({
              symbol,
              changePercent,
              indicators,
              volumeMultiplier,
            });
          }
        }
        
        // Sort by volume multiplier descending
        results.sort((a, b) => b.volumeMultiplier - a.volumeMultiplier);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify(results.slice(0, limit), null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error: ${(error as Error).message}`,
          }],
        };
      }
    }
  );
}
