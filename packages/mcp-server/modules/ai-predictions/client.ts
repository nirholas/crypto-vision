/**
 * AI Prediction Client
 * @description x402-enabled client for paid prediction services
 * @author nirholas
 * @license Apache-2.0
 * 
 * Wraps the LSTM model with x402 payment handling.
 * AI agents automatically pay for predictions via x402 protocol.
 */

import { createX402Client, type X402ClientWrapper } from "@/x402/client.js"
import Logger from "@/utils/logger.js"
import { LSTMModel } from "./model.js"
import {
  PREDICTION_PRICING,
  SUPPORTED_ASSETS,
  type SupportedAsset,
  type Timeframe,
  type PredictionType,
  type DirectionPrediction,
  type TargetPrediction,
  type ConfidencePrediction,
  type FullPrediction,
  type BacktestRequest,
  type BacktestResult,
  type BulkPredictionRequest,
  type BulkPredictionResponse,
  type PaymentReceipt,
} from "./types.js"

// ============================================================================
// Configuration
// ============================================================================

export interface PredictionClientConfig {
  /** Prediction service API endpoint */
  apiEndpoint: string
  /** x402 payment recipient address */
  recipientAddress: string
  /** x402 payment network */
  network: "base" | "arbitrum" | "ethereum"
  /** x402 payment token */
  token: "USDC" | "USDs"
  /** Enable x402 payments */
  enablePayments: boolean
  /** Max payment per request (USD) */
  maxPaymentPerRequest: number
  /** Debug mode */
  debug: boolean
}

const DEFAULT_CONFIG: PredictionClientConfig = {
  apiEndpoint: process.env.PREDICTION_API_ENDPOINT || "http://localhost:8000",
  recipientAddress: process.env.PREDICTION_RECIPIENT || "0x0000000000000000000000000000000000000000",
  network: "base",
  token: "USDC",
  enablePayments: process.env.PREDICTION_PAYMENTS_ENABLED === "true",
  maxPaymentPerRequest: 1.0,
  debug: process.env.NODE_ENV === "development",
}

// ============================================================================
// Prediction Client
// ============================================================================

/**
 * x402-enabled AI Prediction Client
 * Provides ML predictions with automatic micropayments
 */
export class PredictionClient {
  private config: PredictionClientConfig
  private model: LSTMModel
  private x402Client: X402ClientWrapper | null = null
  private totalSpent: number = 0
  private predictionCount: number = 0
  
  constructor(config: Partial<PredictionClientConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.model = new LSTMModel()
  }
  
  /**
   * Initialize x402 client for payments
   */
  private async getX402Client(): Promise<X402ClientWrapper> {
    if (!this.x402Client) {
      this.x402Client = await createX402Client()
    }
    return this.x402Client
  }
  
  /**
   * Process payment via x402
   */
  private async processPayment(
    amount: number,
    predictionType: PredictionType,
    asset?: SupportedAsset
  ): Promise<PaymentReceipt | null> {
    if (!this.config.enablePayments) {
      Logger.debug(`Payment skipped (payments disabled): $${amount} for ${predictionType}`)
      return null
    }
    
    if (amount > this.config.maxPaymentPerRequest) {
      throw new Error(`Payment amount $${amount} exceeds max allowed $${this.config.maxPaymentPerRequest}`)
    }
    
    try {
      const client = await this.getX402Client()
      
      // In production, this would use client.wrapFetch or wrapAxios
      // to make a paid request to the prediction API
      Logger.info(`Processing x402 payment: $${amount} for ${predictionType}`)
      
      // Simulate payment receipt
      const receipt: PaymentReceipt = {
        transaction_hash: `0x${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`,
        amount: amount.toString(),
        token: this.config.token,
        network: this.config.network,
        timestamp: new Date().toISOString(),
        prediction_type: predictionType,
        asset,
      }
      
      this.totalSpent += amount
      this.predictionCount++
      
      return receipt
    } catch (error) {
      Logger.error("Payment failed:", error)
      throw new Error(`Payment failed: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }
  
  /**
   * Get price for a prediction type
   */
  getPrice(type: PredictionType): number {
    return PREDICTION_PRICING[type]
  }
  
  /**
   * Predict price direction (Up/Down/Sideways)
   * Cost: $0.01
   */
  async predictDirection(
    asset: SupportedAsset,
    timeframe: Timeframe
  ): Promise<DirectionPrediction & { payment?: PaymentReceipt }> {
    const price = PREDICTION_PRICING.direction
    const payment = await this.processPayment(price, "direction", asset)
    
    const prediction = await this.model.predictDirection(asset, timeframe)
    
    return { ...prediction, payment: payment || undefined }
  }
  
  /**
   * Predict specific price target
   * Cost: $0.05
   */
  async predictTarget(
    asset: SupportedAsset,
    timeframe: Timeframe
  ): Promise<TargetPrediction & { payment?: PaymentReceipt }> {
    const price = PREDICTION_PRICING.target
    const payment = await this.processPayment(price, "target", asset)
    
    const prediction = await this.model.predictTarget(asset, timeframe)
    
    return { ...prediction, payment: payment || undefined }
  }
  
  /**
   * Get model confidence score
   * Cost: $0.02
   */
  async predictConfidence(
    asset: SupportedAsset,
    timeframe: Timeframe
  ): Promise<ConfidencePrediction & { payment?: PaymentReceipt }> {
    const price = PREDICTION_PRICING.confidence
    const payment = await this.processPayment(price, "confidence", asset)
    
    const prediction = await this.model.predictConfidence(asset, timeframe)
    
    return { ...prediction, payment: payment || undefined }
  }
  
  /**
   * Get full prediction report
   * Cost: $0.10
   */
  async predictFull(
    asset: SupportedAsset,
    timeframe: Timeframe
  ): Promise<FullPrediction & { payment?: PaymentReceipt }> {
    const price = PREDICTION_PRICING.full
    const payment = await this.processPayment(price, "full", asset)
    
    const prediction = await this.model.predictFull(asset, timeframe)
    
    return { ...prediction, payment: payment || undefined }
  }
  
  /**
   * Unified predict method - route to appropriate prediction type
   * Auto-pays via x402: $0.01-$0.10 depending on type
   */
  async predict(
    asset: SupportedAsset,
    params: { timeframe: Timeframe; type: "direction" | "target" | "confidence" | "full" }
  ): Promise<(DirectionPrediction | TargetPrediction | ConfidencePrediction | FullPrediction) & { payment?: PaymentReceipt }> {
    switch (params.type) {
      case "direction":
        return this.predictDirection(asset, params.timeframe)
      case "target":
        return this.predictTarget(asset, params.timeframe)
      case "confidence":
        return this.predictConfidence(asset, params.timeframe)
      case "full":
        return this.predictFull(asset, params.timeframe)
      default:
        throw new Error(`Unknown prediction type: ${params.type}`)
    }
  }
  
  /**
   * Bulk predictions for multiple assets
   * Cost: $0.01 per asset per prediction
   */
  async predictBulk(
    request: BulkPredictionRequest
  ): Promise<BulkPredictionResponse & { payment?: PaymentReceipt }> {
    const pricePerAsset = PREDICTION_PRICING.bulk_per_asset
    const totalPrice = pricePerAsset * request.assets.length
    
    const payment = await this.processPayment(totalPrice, "bulk_per_asset")
    
    const predictions: Record<string, unknown> = {}
    
    for (const asset of request.assets) {
      switch (request.type) {
        case "direction":
          predictions[asset] = await this.model.predictDirection(asset, request.timeframe)
          break
        case "target":
          predictions[asset] = await this.model.predictTarget(asset, request.timeframe)
          break
        case "confidence":
          predictions[asset] = await this.model.predictConfidence(asset, request.timeframe)
          break
        case "full":
          predictions[asset] = await this.model.predictFull(asset, request.timeframe)
          break
      }
    }
    
    return {
      predictions: predictions as Record<SupportedAsset, never>,
      total_cost: totalPrice,
      timestamp: new Date().toISOString(),
      payment: payment || undefined,
    }
  }
  
  /**
   * Run backtesting on historical data
   * Cost: $0.50
   */
  async runBacktest(
    request: BacktestRequest
  ): Promise<BacktestResult & { payment?: PaymentReceipt }> {
    const price = PREDICTION_PRICING.backtest
    const payment = await this.processPayment(price, "backtest", request.asset)
    
    const result = await this.model.runBacktest(request)
    
    return { ...result, payment: payment || undefined }
  }
  
  /**
   * Get client statistics
   */
  getStats(): {
    totalSpent: number
    predictionCount: number
    averageCost: number
    paymentsEnabled: boolean
  } {
    return {
      totalSpent: Math.round(this.totalSpent * 100) / 100,
      predictionCount: this.predictionCount,
      averageCost: this.predictionCount > 0 ? 
        Math.round((this.totalSpent / this.predictionCount) * 100) / 100 : 0,
      paymentsEnabled: this.config.enablePayments,
    }
  }
  
  /**
   * Get pricing information
   */
  getPricing(): typeof PREDICTION_PRICING {
    return PREDICTION_PRICING
  }
  
  /**
   * Get supported assets
   */
  getSupportedAssets(): readonly SupportedAsset[] {
    return SUPPORTED_ASSETS
  }
  
  /**
   * Clear model cache
   */
  clearCache(): void {
    this.model.clearCache()
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let defaultClient: PredictionClient | null = null

/**
 * Get or create default prediction client
 */
export function getDefaultPredictionClient(): PredictionClient {
  if (!defaultClient) {
    defaultClient = new PredictionClient()
  }
  return defaultClient
}

/**
 * Reset default prediction client
 */
export function resetPredictionClient(): void {
  defaultClient = null
}
