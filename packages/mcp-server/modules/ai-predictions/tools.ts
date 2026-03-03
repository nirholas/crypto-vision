/**
 * AI Prediction MCP Tools
 * @description MCP tools for AI-powered crypto predictions via x402
 * @author nirholas
 * @license Apache-2.0
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { getDefaultPredictionClient } from "./client.js"
import {
  PREDICTION_PRICING,
  SUPPORTED_ASSETS,
  TIMEFRAMES,
  type SupportedAsset,
  type Timeframe,
} from "./types.js"
import Logger from "@/utils/logger.js"

/**
 * Register AI Prediction tools with MCP server
 */
export function registerPredictionTools(server: McpServer): void {
  const client = getDefaultPredictionClient()
  
  // ============================================================================
  // Core Prediction Tools
  // ============================================================================
  
  /**
   * Predict BTC price direction/target
   * Auto-pays via x402: $0.01-$0.10 depending on type
   */
  server.tool(
    "predict_btc_price",
    `Get AI prediction for BTC price. Uses LSTM model trained on historical data. ` +
    `Pricing: Direction=$${PREDICTION_PRICING.direction}, Target=$${PREDICTION_PRICING.target}, ` +
    `Confidence=$${PREDICTION_PRICING.confidence}, Full Report=$${PREDICTION_PRICING.full}. ` +
    `Payments handled automatically via x402.`,
    {
      timeframe: z.enum(["1h", "4h", "1d", "1w"])
        .describe("Prediction timeframe: 1h, 4h, 1d, or 1w"),
      type: z.enum(["direction", "target", "confidence", "full"])
        .default("direction")
        .describe("Prediction type: direction (Up/Down), target (price), confidence (%), or full report"),
    },
    async ({ timeframe, type }) => {
      try {
        const result = await client.predict("BTC", { 
          timeframe: timeframe as Timeframe, 
          type: type as "direction" | "target" | "confidence" | "full" 
        })
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              prediction: result,
              cost: `$${PREDICTION_PRICING[type as keyof typeof PREDICTION_PRICING]}`,
              model: "LSTM v1.2.0",
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Prediction failed",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )
  
  /**
   * Generic crypto price prediction
   */
  server.tool(
    "predict_crypto_price",
    `Get AI prediction for any supported cryptocurrency. ` +
    `Supported: ${SUPPORTED_ASSETS.join(", ")}. ` +
    `Auto-pays via x402: $0.01-$0.10 depending on prediction type.`,
    {
      asset: z.enum(SUPPORTED_ASSETS)
        .describe(`Cryptocurrency to predict: ${SUPPORTED_ASSETS.join(", ")}`),
      timeframe: z.enum(TIMEFRAMES)
        .describe("Prediction timeframe"),
      type: z.enum(["direction", "target", "confidence", "full"])
        .default("direction")
        .describe("Prediction type"),
    },
    async ({ asset, timeframe, type }) => {
      try {
        const result = await client.predict(
          asset as SupportedAsset, 
          { timeframe: timeframe as Timeframe, type: type as never }
        )
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              prediction: result,
              cost: `$${PREDICTION_PRICING[type as keyof typeof PREDICTION_PRICING]}`,
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Prediction failed",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )
  
  /**
   * Bulk multi-asset predictions
   */
  server.tool(
    "predict_multi_asset",
    `Get AI predictions for multiple cryptocurrencies at once. ` +
    `Cost: $${PREDICTION_PRICING.bulk_per_asset} per asset. ` +
    `Bulk discount applied automatically.`,
    {
      assets: z.array(z.enum(SUPPORTED_ASSETS))
        .min(1)
        .max(10)
        .describe("List of assets to predict"),
      timeframe: z.enum(TIMEFRAMES)
        .describe("Prediction timeframe for all assets"),
      type: z.enum(["direction", "target", "confidence", "full"])
        .default("direction")
        .describe("Prediction type for all assets"),
    },
    async ({ assets, timeframe, type }) => {
      try {
        const result = await client.predictBulk({
          assets: assets as SupportedAsset[],
          timeframe: timeframe as Timeframe,
          type: type as never,
        })
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              predictions: result.predictions,
              total_cost: `$${result.total_cost}`,
              asset_count: assets.length,
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Bulk prediction failed",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )
  
  // ============================================================================
  // Specialized Prediction Tools
  // ============================================================================
  
  /**
   * Price direction prediction (cheapest option)
   */
  server.tool(
    "predict_direction",
    `Get simple Up/Down/Sideways prediction. Cheapest option at $${PREDICTION_PRICING.direction}.`,
    {
      asset: z.enum(SUPPORTED_ASSETS).describe("Cryptocurrency to predict"),
      timeframe: z.enum(TIMEFRAMES).describe("Prediction timeframe"),
    },
    async ({ asset, timeframe }) => {
      try {
        const result = await client.predictDirection(
          asset as SupportedAsset, 
          timeframe as Timeframe
        )
        
        const emoji = result.direction === "bullish" ? "📈" :
                     result.direction === "bearish" ? "📉" : "↔️"
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              asset,
              timeframe,
              direction: result.direction,
              emoji,
              cost: `$${PREDICTION_PRICING.direction}`,
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Direction prediction failed",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )
  
  /**
   * Full analysis report
   */
  server.tool(
    "predict_full_report",
    `Get comprehensive prediction report with direction, target, confidence, and analysis. ` +
    `Cost: $${PREDICTION_PRICING.full}. Best value for complete analysis.`,
    {
      asset: z.enum(SUPPORTED_ASSETS).describe("Cryptocurrency to analyze"),
      timeframe: z.enum(TIMEFRAMES).describe("Analysis timeframe"),
    },
    async ({ asset, timeframe }) => {
      try {
        const result = await client.predictFull(
          asset as SupportedAsset, 
          timeframe as Timeframe
        )
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              report: {
                asset,
                timeframe,
                summary: result.analysis.summary,
                direction: result.direction.direction,
                current_price: result.target.current_price,
                predicted_price: result.target.predicted_price,
                change_pct: result.target.price_change_pct,
                confidence: `${Math.round(result.confidence.confidence * 100)}%`,
                key_levels: result.analysis.key_levels,
                indicators: result.analysis.indicators,
                risk_reward: result.analysis.risk_reward,
              },
              cost: `$${PREDICTION_PRICING.full}`,
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Full report failed",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )
  
  // ============================================================================
  // Backtesting Tool
  // ============================================================================
  
  /**
   * Strategy backtesting
   */
  server.tool(
    "backtest_strategy",
    `Backtest a trading strategy against historical data. ` +
    `Cost: $${PREDICTION_PRICING.backtest}. Returns performance metrics and risk analysis.`,
    {
      asset: z.enum(SUPPORTED_ASSETS).describe("Asset to backtest"),
      strategy: z.enum(["momentum", "mean_reversion", "trend_following", "custom"])
        .describe("Strategy type"),
      start_date: z.string()
        .describe("Start date (ISO format, e.g., 2025-01-01)"),
      end_date: z.string()
        .describe("End date (ISO format, e.g., 2025-12-31)"),
      parameters: z.record(z.number()).optional()
        .describe("Custom strategy parameters (for 'custom' strategy)"),
    },
    async ({ asset, strategy, start_date, end_date, parameters }) => {
      try {
        const result = await client.runBacktest({
          asset: asset as SupportedAsset,
          strategy,
          start_date,
          end_date,
          parameters,
        })
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              backtest: {
                asset,
                strategy,
                period: result.period,
                performance: result.performance,
                trades: result.trades,
                risk_metrics: result.risk_metrics,
                comparison: result.comparison,
              },
              cost: `$${PREDICTION_PRICING.backtest}`,
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Backtest failed",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )
  
  // ============================================================================
  // Utility Tools
  // ============================================================================
  
  /**
   * Get prediction pricing
   */
  server.tool(
    "prediction_pricing",
    "Get pricing information for all AI prediction services.",
    {},
    async () => {
      const stats = client.getStats()
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            pricing: {
              direction: {
                price: `$${PREDICTION_PRICING.direction}`,
                description: "Up/Down/Sideways prediction",
              },
              target: {
                price: `$${PREDICTION_PRICING.target}`,
                description: "Specific price target with support/resistance",
              },
              confidence: {
                price: `$${PREDICTION_PRICING.confidence}`,
                description: "Model confidence score with breakdown",
              },
              full: {
                price: `$${PREDICTION_PRICING.full}`,
                description: "Complete report: direction + target + confidence + analysis",
              },
              backtest: {
                price: `$${PREDICTION_PRICING.backtest}`,
                description: "Strategy backtesting with performance metrics",
              },
              bulk: {
                price: `$${PREDICTION_PRICING.bulk_per_asset}/asset`,
                description: "Multi-asset predictions with bulk discount",
              },
              maas: {
                price: `$${PREDICTION_PRICING.maas_monthly}/month`,
                description: "Model-as-a-Service: custom training + private instance",
              },
            },
            supported_assets: SUPPORTED_ASSETS,
            timeframes: TIMEFRAMES,
            session_stats: stats,
          }, null, 2),
        }],
      }
    }
  )
  
  /**
   * Get supported assets
   */
  server.tool(
    "prediction_assets",
    "Get list of supported cryptocurrencies for AI predictions.",
    {},
    async () => {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            supported_assets: SUPPORTED_ASSETS,
            timeframes: TIMEFRAMES,
            note: "Use predict_crypto_price tool with any of these assets",
          }, null, 2),
        }],
      }
    }
  )
  
  /**
   * Get session statistics
   */
  server.tool(
    "prediction_stats",
    "Get statistics for current prediction session (total spent, prediction count, etc.).",
    {},
    async () => {
      const stats = client.getStats()
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            session: {
              total_spent: `$${stats.totalSpent}`,
              prediction_count: stats.predictionCount,
              average_cost: `$${stats.averageCost}`,
              payments_enabled: stats.paymentsEnabled,
            },
          }, null, 2),
        }],
      }
    }
  )
  
  Logger.info("✅ AI Prediction tools registered")
}
