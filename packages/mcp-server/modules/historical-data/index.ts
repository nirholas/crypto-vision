/**
 * Historical Data API Module
 * Access historical price, volume, and market data
 *
 * @author nich
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

// Cache for historical data
const dataCache = new Map<string, { data: any; timestamp: Date }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// Generate mock OHLCV data
function generateOHLCV(
  symbol: string,
  startTime: number,
  endTime: number,
  interval: string
): Array<{
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}> {
  const intervalMs: Record<string, number> = {
    "1m": 60 * 1000,
    "5m": 5 * 60 * 1000,
    "15m": 15 * 60 * 1000,
    "1h": 60 * 60 * 1000,
    "4h": 4 * 60 * 60 * 1000,
    "1d": 24 * 60 * 60 * 1000,
    "1w": 7 * 24 * 60 * 60 * 1000,
  }

  const ms = intervalMs[interval] || intervalMs["1h"]
  const data: Array<{
    timestamp: number
    open: number
    high: number
    low: number
    close: number
    volume: number
  }> = []

  // Base prices for common symbols
  const basePrices: Record<string, number> = {
    BTC: 95000,
    ETH: 3500,
    BNB: 600,
    SOL: 180,
    AVAX: 35,
    ATOM: 8,
    DOT: 7,
    LINK: 15,
    UNI: 12,
  }

  const basePrice = basePrices[symbol.toUpperCase()] || 100
  let currentPrice = basePrice

  for (let t = startTime; t <= endTime; t += ms) {
    const change = (Math.random() - 0.5) * basePrice * 0.02 // ±1% per candle
    const open = currentPrice
    const close = currentPrice + change
    const high = Math.max(open, close) * (1 + Math.random() * 0.005)
    const low = Math.min(open, close) * (1 - Math.random() * 0.005)
    const volume = Math.random() * 1000000 * (basePrice / 100)

    data.push({
      timestamp: t,
      open,
      high,
      low,
      close,
      volume,
    })

    currentPrice = close
  }

  return data
}

export function registerHistoricalData(server: McpServer) {
  // Get OHLCV candle data
  server.tool(
    "historical_ohlcv",
    "Get historical OHLCV (candlestick) data for a symbol",
    {
      symbol: z.string().describe("Trading symbol (e.g., BTC, ETH)"),
      interval: z
        .enum(["1m", "5m", "15m", "1h", "4h", "1d", "1w"])
        .default("1h")
        .describe("Candle interval"),
      startTime: z.string().optional().describe("Start time (ISO date or Unix ms)"),
      endTime: z.string().optional().describe("End time (ISO date or Unix ms)"),
      limit: z.number().default(100).describe("Maximum number of candles"),
    },
    async ({ symbol, interval, startTime, endTime, limit }) => {
      // Parse times
      const end = endTime ? new Date(endTime).getTime() : Date.now()
      const intervalMs: Record<string, number> = {
        "1m": 60 * 1000,
        "5m": 5 * 60 * 1000,
        "15m": 15 * 60 * 1000,
        "1h": 60 * 60 * 1000,
        "4h": 4 * 60 * 60 * 1000,
        "1d": 24 * 60 * 60 * 1000,
        "1w": 7 * 24 * 60 * 60 * 1000,
      }
      const start = startTime
        ? new Date(startTime).getTime()
        : end - limit * intervalMs[interval]

      const cacheKey = `ohlcv_${symbol}_${interval}_${start}_${end}`
      const cached = dataCache.get(cacheKey)

      if (cached && Date.now() - cached.timestamp.getTime() < CACHE_TTL) {
        return {
          content: [{ type: "text", text: JSON.stringify(cached.data, null, 2) }],
        }
      }

      const candles = generateOHLCV(symbol, start, end, interval).slice(-limit)

      const result = {
        symbol,
        interval,
        startTime: new Date(start).toISOString(),
        endTime: new Date(end).toISOString(),
        candleCount: candles.length,
        candles: candles.map((c) => ({
          ...c,
          time: new Date(c.timestamp).toISOString(),
        })),
      }

      dataCache.set(cacheKey, { data: result, timestamp: new Date() })

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      }
    }
  )

  // Get price history (simplified)
  server.tool(
    "historical_prices",
    "Get historical price data for a symbol",
    {
      symbol: z.string().describe("Trading symbol"),
      days: z.number().default(30).describe("Number of days of history"),
      vs_currency: z.string().default("usd").describe("Quote currency"),
    },
    async ({ symbol, days, vs_currency }) => {
      const now = Date.now()
      const start = now - days * 24 * 60 * 60 * 1000
      const interval = days > 90 ? "1d" : days > 7 ? "4h" : "1h"

      const candles = generateOHLCV(symbol, start, now, interval)

      const prices = candles.map((c) => ({
        timestamp: c.timestamp,
        date: new Date(c.timestamp).toISOString().split("T")[0],
        price: c.close,
      }))

      // Calculate statistics
      const priceValues = prices.map((p) => p.price)
      const stats = {
        high: Math.max(...priceValues),
        low: Math.min(...priceValues),
        average: priceValues.reduce((a, b) => a + b, 0) / priceValues.length,
        change: priceValues[priceValues.length - 1] - priceValues[0],
        changePercent:
          ((priceValues[priceValues.length - 1] - priceValues[0]) / priceValues[0]) * 100,
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                symbol,
                vs_currency,
                days,
                dataPoints: prices.length,
                statistics: stats,
                prices: prices.slice(-50), // Return last 50 for brevity
              },
              null,
              2
            ),
          },
        ],
      }
    }
  )

  // Get market cap history
  server.tool(
    "historical_market_cap",
    "Get historical market cap data",
    {
      symbol: z.string().describe("Trading symbol"),
      days: z.number().default(30).describe("Number of days"),
    },
    async ({ symbol, days }) => {
      const now = Date.now()

      // Mock market cap data
      const baseMcap: Record<string, number> = {
        BTC: 1900000000000,
        ETH: 420000000000,
        BNB: 90000000000,
        SOL: 80000000000,
      }

      const base = baseMcap[symbol.toUpperCase()] || 1000000000
      const data: Array<{ timestamp: number; date: string; marketCap: number }> = []

      for (let i = days; i >= 0; i--) {
        const timestamp = now - i * 24 * 60 * 60 * 1000
        const variation = (Math.random() - 0.5) * 0.1 // ±5%
        data.push({
          timestamp,
          date: new Date(timestamp).toISOString().split("T")[0],
          marketCap: base * (1 + variation * (1 - i / days)),
        })
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                symbol,
                days,
                dataPoints: data.length,
                currentMarketCap: data[data.length - 1].marketCap,
                highestMarketCap: Math.max(...data.map((d) => d.marketCap)),
                lowestMarketCap: Math.min(...data.map((d) => d.marketCap)),
                data: data.slice(-30),
              },
              null,
              2
            ),
          },
        ],
      }
    }
  )

  // Get volume history
  server.tool(
    "historical_volume",
    "Get historical trading volume data",
    {
      symbol: z.string().describe("Trading symbol"),
      days: z.number().default(30).describe("Number of days"),
    },
    async ({ symbol, days }) => {
      const now = Date.now()

      const baseVolume: Record<string, number> = {
        BTC: 50000000000,
        ETH: 20000000000,
        BNB: 2000000000,
        SOL: 3000000000,
      }

      const base = baseVolume[symbol.toUpperCase()] || 100000000
      const data: Array<{
        timestamp: number
        date: string
        volume: number
      }> = []

      for (let i = days; i >= 0; i--) {
        const timestamp = now - i * 24 * 60 * 60 * 1000
        const variation = (Math.random() - 0.3) * 0.6 // -30% to +30%
        data.push({
          timestamp,
          date: new Date(timestamp).toISOString().split("T")[0],
          volume: base * (1 + variation),
        })
      }

      const volumes = data.map((d) => d.volume)
      const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                symbol,
                days,
                dataPoints: data.length,
                averageVolume: avgVolume,
                highestVolume: Math.max(...volumes),
                lowestVolume: Math.min(...volumes),
                data: data.slice(-30),
              },
              null,
              2
            ),
          },
        ],
      }
    }
  )

  // Get all-time high/low
  server.tool(
    "historical_ath_atl",
    "Get all-time high and all-time low data for a symbol",
    {
      symbol: z.string().describe("Trading symbol"),
    },
    async ({ symbol }) => {
      // Mock ATH/ATL data
      const athData: Record<
        string,
        {
          ath: number
          athDate: string
          atl: number
          atlDate: string
          currentPrice: number
        }
      > = {
        BTC: {
          ath: 109000,
          athDate: "2025-01-20",
          atl: 67.81,
          atlDate: "2013-07-06",
          currentPrice: 95000,
        },
        ETH: {
          ath: 4891,
          athDate: "2021-11-10",
          atl: 0.42,
          atlDate: "2015-10-21",
          currentPrice: 3500,
        },
        BNB: {
          ath: 793,
          athDate: "2024-12-04",
          atl: 0.0398,
          atlDate: "2017-08-01",
          currentPrice: 600,
        },
        SOL: {
          ath: 295,
          athDate: "2025-01-19",
          atl: 0.5052,
          atlDate: "2020-05-11",
          currentPrice: 180,
        },
      }

      const data = athData[symbol.toUpperCase()] || {
        ath: 100,
        athDate: "2024-01-01",
        atl: 1,
        atlDate: "2020-01-01",
        currentPrice: 50,
      }

      const athChange = ((data.currentPrice - data.ath) / data.ath) * 100
      const atlChange = ((data.currentPrice - data.atl) / data.atl) * 100

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                symbol,
                currentPrice: data.currentPrice,
                allTimeHigh: {
                  price: data.ath,
                  date: data.athDate,
                  changeFromATH: athChange,
                  percentBelowATH: Math.abs(athChange),
                },
                allTimeLow: {
                  price: data.atl,
                  date: data.atlDate,
                  changeFromATL: atlChange,
                  percentAboveATL: atlChange,
                },
                priceRange: {
                  total: data.ath - data.atl,
                  currentPositionPercent:
                    ((data.currentPrice - data.atl) / (data.ath - data.atl)) * 100,
                },
              },
              null,
              2
            ),
          },
        ],
      }
    }
  )

  // Get correlation data
  server.tool(
    "historical_correlation",
    "Get correlation data between two symbols",
    {
      symbol1: z.string().describe("First symbol"),
      symbol2: z.string().describe("Second symbol"),
      days: z.number().default(30).describe("Number of days"),
    },
    async ({ symbol1, symbol2, days }) => {
      // Generate correlated price data
      const now = Date.now()
      const start = now - days * 24 * 60 * 60 * 1000

      const candles1 = generateOHLCV(symbol1, start, now, "1d")
      const candles2 = generateOHLCV(symbol2, start, now, "1d")

      // Calculate returns
      const returns1: number[] = []
      const returns2: number[] = []

      for (let i = 1; i < candles1.length; i++) {
        returns1.push((candles1[i].close - candles1[i - 1].close) / candles1[i - 1].close)
        returns2.push((candles2[i].close - candles2[i - 1].close) / candles2[i - 1].close)
      }

      // Calculate correlation coefficient
      const n = returns1.length
      const mean1 = returns1.reduce((a, b) => a + b, 0) / n
      const mean2 = returns2.reduce((a, b) => a + b, 0) / n

      let numerator = 0
      let denom1 = 0
      let denom2 = 0

      for (let i = 0; i < n; i++) {
        const diff1 = returns1[i] - mean1
        const diff2 = returns2[i] - mean2
        numerator += diff1 * diff2
        denom1 += diff1 * diff1
        denom2 += diff2 * diff2
      }

      const correlation = numerator / Math.sqrt(denom1 * denom2)

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                symbol1,
                symbol2,
                days,
                correlation: correlation,
                interpretation:
                  correlation > 0.7
                    ? "Strong positive correlation"
                    : correlation > 0.3
                      ? "Moderate positive correlation"
                      : correlation > -0.3
                        ? "Low correlation"
                        : correlation > -0.7
                          ? "Moderate negative correlation"
                          : "Strong negative correlation",
                dataPoints: n,
              },
              null,
              2
            ),
          },
        ],
      }
    }
  )

  // Get returns analysis
  server.tool(
    "historical_returns",
    "Get historical returns analysis for a symbol",
    {
      symbol: z.string().describe("Trading symbol"),
      period: z.enum(["1d", "7d", "30d", "90d", "1y", "ytd"]).describe("Return period"),
    },
    async ({ symbol, period }) => {
      const periodDays: Record<string, number> = {
        "1d": 1,
        "7d": 7,
        "30d": 30,
        "90d": 90,
        "1y": 365,
        ytd: Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / (24 * 60 * 60 * 1000)),
      }

      const days = periodDays[period]
      const now = Date.now()
      const start = now - days * 24 * 60 * 60 * 1000

      const candles = generateOHLCV(symbol, start, now, days > 30 ? "1d" : "1h")
      const startPrice = candles[0].close
      const endPrice = candles[candles.length - 1].close
      const returns = ((endPrice - startPrice) / startPrice) * 100

      // Calculate additional metrics
      const prices = candles.map((c) => c.close)
      const dailyReturns: number[] = []
      for (let i = 1; i < prices.length; i++) {
        dailyReturns.push((prices[i] - prices[i - 1]) / prices[i - 1])
      }

      const avgReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length
      const variance =
        dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / dailyReturns.length
      const volatility = Math.sqrt(variance) * Math.sqrt(252) // Annualized

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                symbol,
                period,
                returns: {
                  absolute: endPrice - startPrice,
                  percentage: returns,
                },
                prices: {
                  start: startPrice,
                  end: endPrice,
                  high: Math.max(...prices),
                  low: Math.min(...prices),
                },
                volatility: {
                  annualized: volatility * 100,
                  daily: Math.sqrt(variance) * 100,
                },
                riskMetrics: {
                  sharpeRatio: returns / (volatility * 100) || 0,
                  maxDrawdown:
                    ((Math.max(...prices) - Math.min(...prices)) / Math.max(...prices)) * 100,
                },
              },
              null,
              2
            ),
          },
        ],
      }
    }
  )
}
