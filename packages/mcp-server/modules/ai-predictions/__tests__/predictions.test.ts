/**
 * Tests for AI Predictions Module
 * @author nirholas
 * @license Apache-2.0
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { LSTMModel } from "../model.js"
import { PredictionClient } from "../client.js"
import {
  PREDICTION_PRICING,
  SUPPORTED_ASSETS,
  TIMEFRAMES,
  type SupportedAsset,
  type Timeframe,
} from "../types.js"

describe("LSTMModel", () => {
  let model: LSTMModel

  beforeEach(() => {
    model = new LSTMModel()
  })

  describe("predictDirection", () => {
    it("should return a valid direction prediction", async () => {
      const result = await model.predictDirection("BTC", "1d")

      expect(result.type).toBe("direction")
      expect(result.asset).toBe("BTC")
      expect(result.timeframe).toBe("1d")
      expect(["bullish", "bearish", "sideways"]).toContain(result.direction)
      expect(result.timestamp).toBeDefined()
      expect(result.model_version).toBeDefined()
    })

    it("should cache predictions", async () => {
      const result1 = await model.predictDirection("ETH", "4h")
      const result2 = await model.predictDirection("ETH", "4h")

      expect(result1.timestamp).toBe(result2.timestamp)
    })
  })

  describe("predictTarget", () => {
    it("should return a valid target prediction", async () => {
      const result = await model.predictTarget("BTC", "1d")

      expect(result.type).toBe("target")
      expect(result.asset).toBe("BTC")
      expect(result.current_price).toBeGreaterThan(0)
      expect(result.predicted_price).toBeGreaterThan(0)
      expect(typeof result.price_change_pct).toBe("number")
      expect(result.support_levels).toHaveLength(3)
      expect(result.resistance_levels).toHaveLength(3)
    })
  })

  describe("predictConfidence", () => {
    it("should return a valid confidence prediction", async () => {
      const result = await model.predictConfidence("SOL", "1h")

      expect(result.type).toBe("confidence")
      expect(result.confidence).toBeGreaterThanOrEqual(0)
      expect(result.confidence).toBeLessThanOrEqual(1)
      expect(result.confidence_breakdown).toBeDefined()
      expect(result.confidence_breakdown.technical).toBeDefined()
      expect(result.confidence_breakdown.momentum).toBeDefined()
    })
  })

  describe("predictFull", () => {
    it("should return a complete prediction report", async () => {
      const result = await model.predictFull("BTC", "1d")

      expect(result.type).toBe("full")
      expect(result.direction).toBeDefined()
      expect(result.target).toBeDefined()
      expect(result.confidence).toBeDefined()
      expect(result.analysis).toBeDefined()
      expect(result.analysis.summary).toBeDefined()
      expect(result.analysis.key_levels).toBeDefined()
      expect(result.analysis.indicators).toBeDefined()
      expect(result.analysis.risk_reward).toBeDefined()
    })
  })

  describe("runBacktest", () => {
    it("should return valid backtest results", async () => {
      const result = await model.runBacktest({
        asset: "BTC",
        strategy: "momentum",
        start_date: "2025-01-01",
        end_date: "2025-12-31",
      })

      expect(result.asset).toBe("BTC")
      expect(result.strategy).toBe("momentum")
      expect(result.period.days).toBeGreaterThan(0)
      expect(result.performance).toBeDefined()
      expect(result.trades).toBeDefined()
      expect(result.risk_metrics).toBeDefined()
    })
  })

  describe("cache management", () => {
    it("should clear cache", () => {
      model.clearCache()
      // No error means success
      expect(true).toBe(true)
    })

    it("should return model info", () => {
      const info = model.getModelInfo()
      expect(info.version).toBeDefined()
      expect(info.endpoint).toBeDefined()
      expect(typeof info.cacheEnabled).toBe("boolean")
    })
  })
})

describe("PredictionClient", () => {
  let client: PredictionClient

  beforeEach(() => {
    // Create client with payments disabled for testing
    client = new PredictionClient({ enablePayments: false })
  })

  describe("predict", () => {
    it("should route to correct prediction method", async () => {
      const direction = await client.predict("BTC", { timeframe: "1d", type: "direction" })
      expect(direction.type).toBe("direction")

      const target = await client.predict("ETH", { timeframe: "4h", type: "target" })
      expect(target.type).toBe("target")

      const confidence = await client.predict("SOL", { timeframe: "1h", type: "confidence" })
      expect(confidence.type).toBe("confidence")

      const full = await client.predict("ARB", { timeframe: "1w", type: "full" })
      expect(full.type).toBe("full")
    })
  })

  describe("predictBulk", () => {
    it("should predict multiple assets", async () => {
      const result = await client.predictBulk({
        assets: ["BTC", "ETH", "SOL"],
        timeframe: "1d",
        type: "direction",
      })

      expect(result.predictions).toBeDefined()
      expect(Object.keys(result.predictions)).toHaveLength(3)
      expect(result.total_cost).toBe(PREDICTION_PRICING.bulk_per_asset * 3)
    })
  })

  describe("runBacktest", () => {
    it("should return backtest with payment info", async () => {
      const result = await client.runBacktest({
        asset: "BTC",
        strategy: "trend_following",
        start_date: "2025-01-01",
        end_date: "2025-06-30",
      })

      expect(result.asset).toBe("BTC")
      expect(result.strategy).toBe("trend_following")
    })
  })

  describe("getStats", () => {
    it("should track prediction statistics", async () => {
      await client.predictDirection("BTC", "1d")
      await client.predictTarget("ETH", "4h")

      const stats = client.getStats()
      expect(stats.predictionCount).toBe(2)
      expect(stats.totalSpent).toBe(0) // Payments disabled
      expect(stats.paymentsEnabled).toBe(false)
    })
  })

  describe("utility methods", () => {
    it("should return pricing", () => {
      const pricing = client.getPricing()
      expect(pricing.direction).toBe(0.01)
      expect(pricing.target).toBe(0.05)
      expect(pricing.full).toBe(0.10)
    })

    it("should return supported assets", () => {
      const assets = client.getSupportedAssets()
      expect(assets).toContain("BTC")
      expect(assets).toContain("ETH")
      expect(assets.length).toBe(SUPPORTED_ASSETS.length)
    })

    it("should get price for prediction type", () => {
      expect(client.getPrice("direction")).toBe(0.01)
      expect(client.getPrice("full")).toBe(0.10)
      expect(client.getPrice("backtest")).toBe(0.50)
    })
  })
})

describe("Types and Constants", () => {
  describe("PREDICTION_PRICING", () => {
    it("should have all required price tiers", () => {
      expect(PREDICTION_PRICING.direction).toBe(0.01)
      expect(PREDICTION_PRICING.target).toBe(0.05)
      expect(PREDICTION_PRICING.confidence).toBe(0.02)
      expect(PREDICTION_PRICING.full).toBe(0.10)
      expect(PREDICTION_PRICING.backtest).toBe(0.50)
      expect(PREDICTION_PRICING.bulk_per_asset).toBe(0.01)
      expect(PREDICTION_PRICING.maas_monthly).toBe(10.00)
    })
  })

  describe("SUPPORTED_ASSETS", () => {
    it("should include major cryptocurrencies", () => {
      expect(SUPPORTED_ASSETS).toContain("BTC")
      expect(SUPPORTED_ASSETS).toContain("ETH")
      expect(SUPPORTED_ASSETS).toContain("SOL")
      expect(SUPPORTED_ASSETS).toContain("ARB")
    })
  })

  describe("TIMEFRAMES", () => {
    it("should include all supported timeframes", () => {
      expect(TIMEFRAMES).toContain("1h")
      expect(TIMEFRAMES).toContain("4h")
      expect(TIMEFRAMES).toContain("1d")
      expect(TIMEFRAMES).toContain("1w")
    })
  })
})
