/**
 * AI Prediction Marketplace Module
 * @description ML-powered crypto predictions monetized via x402
 * @author nirholas
 * @license Apache-2.0
 * 
 * Transforms LSTM Bitcoin prediction models into a paid prediction service.
 * AI agents can pay for ML-powered crypto predictions via x402 protocol.
 * 
 * @example
 * ```typescript
 * import { registerAIPredictions } from "@/modules/ai-predictions/index.js"
 * 
 * // Register with MCP server
 * registerAIPredictions(server)
 * ```
 * 
 * Pricing:
 * - Price Direction: $0.01 (Up/Down/Sideways)
 * - Price Target: $0.05 (Specific price prediction)
 * - Confidence Score: $0.02 (Model confidence)
 * - Full Report: $0.10 (Direction + Target + Confidence + Analysis)
 * - Backtesting: $0.50 (Strategy testing)
 * - Model-as-a-Service: $10/month (Custom training)
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

import { registerPredictionTools } from "./tools.js"
import { registerPredictionPrompts } from "./prompts.js"

/**
 * Register AI Predictions module with the MCP server
 * Provides ML-powered cryptocurrency predictions via x402 payments
 */
export function registerAIPredictions(server: McpServer) {
  registerPredictionTools(server)
  registerPredictionPrompts(server)
}

// Re-export core components
export { PredictionClient, type PredictionClientConfig } from "./client.js"
export { LSTMModel, type LSTMConfig, type ModelPrediction } from "./model.js"
export {
  PREDICTION_PRICING,
  SUPPORTED_ASSETS,
  TIMEFRAMES,
  type PredictionType,
  type SupportedAsset,
  type Timeframe,
} from "./types.js"
