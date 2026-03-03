/**
 * LSTM Prediction Model
 * @description LSTM-based cryptocurrency price prediction model
 * @author nirholas
 * @license Apache-2.0
 * 
 * This module provides a TypeScript interface to LSTM prediction models.
 * In production, this would connect to a Python-based ML backend (FastAPI).
 * 
 * Based on lstm-bitcoin-prediction (11⭐):
 * https://github.com/nirholas/lstm-bitcoin-prediction
 */

import Logger from "@/utils/logger.js"
import type {
  SupportedAsset,
  Timeframe,
  PriceDirection,
  DirectionPrediction,
  TargetPrediction,
  ConfidencePrediction,
  FullPrediction,
  BacktestRequest,
  BacktestResult,
} from "./types.js"

// ============================================================================
// Configuration
// ============================================================================

export interface LSTMConfig {
  /** Model API endpoint (FastAPI backend) */
  apiEndpoint: string
  /** API key for authentication */
  apiKey?: string
  /** Model version */
  modelVersion: string
  /** Request timeout in ms */
  timeout: number
  /** Enable caching */
  enableCache: boolean
  /** Cache TTL in seconds */
  cacheTtl: number
}

const DEFAULT_CONFIG: LSTMConfig = {
  apiEndpoint: process.env.LSTM_API_ENDPOINT || "http://localhost:8000",
  apiKey: process.env.LSTM_API_KEY,
  modelVersion: "v1.2.0",
  timeout: 30000,
  enableCache: true,
  cacheTtl: 300, // 5 minutes
}

// ============================================================================
// Model Output Types
// ============================================================================

export interface ModelPrediction {
  predicted_price: number
  direction: PriceDirection
  confidence: number
  features: {
    rsi: number
    macd: number
    macd_signal: number
    ema_short: number
    ema_long: number
    volume_ratio: number
    volatility: number
  }
}

// ============================================================================
// Simulated Model (for development/testing)
// ============================================================================

/**
 * Simulated LSTM prediction for development
 * In production, this calls the actual ML API
 */
function simulateLSTMPrediction(
  asset: SupportedAsset,
  timeframe: Timeframe,
  currentPrice: number
): ModelPrediction {
  // Simulate model output with realistic variations
  const seed = asset.charCodeAt(0) + timeframe.charCodeAt(0) + Date.now() % 1000
  const random = (min: number, max: number) => min + (((seed * 9301 + 49297) % 233280) / 233280) * (max - min)
  
  // Generate features
  const rsi = random(20, 80)
  const macd = random(-0.5, 0.5)
  const macd_signal = macd + random(-0.1, 0.1)
  const ema_short = currentPrice * (1 + random(-0.02, 0.02))
  const ema_long = currentPrice * (1 + random(-0.03, 0.03))
  const volume_ratio = random(0.5, 2.0)
  const volatility = random(0.01, 0.05)
  
  // Determine direction based on features
  let direction: PriceDirection
  const bullishScore = (
    (rsi < 50 ? 1 : -1) +
    (macd > macd_signal ? 1 : -1) +
    (ema_short > ema_long ? 1 : -1)
  )
  
  if (bullishScore > 1) direction = "bullish"
  else if (bullishScore < -1) direction = "bearish"
  else direction = "sideways"
  
  // Calculate predicted price change based on timeframe
  const timeframeMultipliers: Record<Timeframe, number> = {
    "1h": 0.01,
    "4h": 0.025,
    "1d": 0.05,
    "1w": 0.15,
  }
  
  const maxChange = timeframeMultipliers[timeframe]
  let priceChange = random(-maxChange, maxChange)
  
  // Bias price change toward predicted direction
  if (direction === "bullish") priceChange = Math.abs(priceChange)
  else if (direction === "bearish") priceChange = -Math.abs(priceChange)
  
  const predicted_price = currentPrice * (1 + priceChange)
  
  // Calculate confidence
  const confidence = Math.min(0.95, Math.max(0.3, 0.5 + Math.abs(bullishScore) * 0.15 + random(0, 0.2)))
  
  return {
    predicted_price,
    direction,
    confidence,
    features: {
      rsi,
      macd,
      macd_signal,
      ema_short,
      ema_long,
      volume_ratio,
      volatility,
    },
  }
}

// ============================================================================
// LSTM Model Class
// ============================================================================

/**
 * LSTM Cryptocurrency Prediction Model
 * Provides ML-based price predictions for supported assets
 */
export class LSTMModel {
  private config: LSTMConfig
  private cache: Map<string, { data: unknown; expires: number }> = new Map()
  
  constructor(config: Partial<LSTMConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }
  
  /**
   * Get current price for an asset (simulated for demo)
   */
  private async getCurrentPrice(asset: SupportedAsset): Promise<number> {
    // In production, fetch from market data API
    const basePrices: Record<SupportedAsset, number> = {
      BTC: 95000,
      ETH: 3200,
      SOL: 180,
      ARB: 1.20,
      AVAX: 35,
      MATIC: 0.80,
      LINK: 18,
      UNI: 12,
      AAVE: 280,
      OP: 2.50,
    }
    
    // Add some variance
    const variance = 0.02
    const randomFactor = 1 + (Math.random() * 2 - 1) * variance
    return basePrices[asset] * randomFactor
  }
  
  /**
   * Get cache key
   */
  private getCacheKey(method: string, ...args: unknown[]): string {
    return `${method}:${JSON.stringify(args)}`
  }
  
  /**
   * Get cached value if valid
   */
  private getFromCache<T>(key: string): T | null {
    if (!this.config.enableCache) return null
    
    const cached = this.cache.get(key)
    if (cached && cached.expires > Date.now()) {
      return cached.data as T
    }
    
    this.cache.delete(key)
    return null
  }
  
  /**
   * Set cache value
   */
  private setCache(key: string, data: unknown): void {
    if (!this.config.enableCache) return
    
    this.cache.set(key, {
      data,
      expires: Date.now() + this.config.cacheTtl * 1000,
    })
  }
  
  /**
   * Predict price direction (Up/Down/Sideways)
   */
  async predictDirection(
    asset: SupportedAsset,
    timeframe: Timeframe
  ): Promise<DirectionPrediction> {
    const cacheKey = this.getCacheKey("direction", asset, timeframe)
    const cached = this.getFromCache<DirectionPrediction>(cacheKey)
    if (cached) return cached
    
    Logger.debug(`Predicting direction for ${asset} (${timeframe})`)
    
    const currentPrice = await this.getCurrentPrice(asset)
    const prediction = simulateLSTMPrediction(asset, timeframe, currentPrice)
    
    const result: DirectionPrediction = {
      type: "direction",
      asset,
      timeframe,
      direction: prediction.direction,
      timestamp: new Date().toISOString(),
      model_version: this.config.modelVersion,
    }
    
    this.setCache(cacheKey, result)
    return result
  }
  
  /**
   * Predict specific price target
   */
  async predictTarget(
    asset: SupportedAsset,
    timeframe: Timeframe
  ): Promise<TargetPrediction> {
    const cacheKey = this.getCacheKey("target", asset, timeframe)
    const cached = this.getFromCache<TargetPrediction>(cacheKey)
    if (cached) return cached
    
    Logger.debug(`Predicting target for ${asset} (${timeframe})`)
    
    const currentPrice = await this.getCurrentPrice(asset)
    const prediction = simulateLSTMPrediction(asset, timeframe, currentPrice)
    
    // Calculate support/resistance levels
    const range = Math.abs(prediction.predicted_price - currentPrice)
    const support_levels = [
      currentPrice - range * 0.5,
      currentPrice - range * 1.0,
      currentPrice - range * 1.5,
    ].map(p => Math.round(p * 100) / 100)
    
    const resistance_levels = [
      currentPrice + range * 0.5,
      currentPrice + range * 1.0,
      currentPrice + range * 1.5,
    ].map(p => Math.round(p * 100) / 100)
    
    const result: TargetPrediction = {
      type: "target",
      asset,
      timeframe,
      current_price: Math.round(currentPrice * 100) / 100,
      predicted_price: Math.round(prediction.predicted_price * 100) / 100,
      price_change_pct: Math.round(((prediction.predicted_price - currentPrice) / currentPrice) * 10000) / 100,
      support_levels,
      resistance_levels,
      timestamp: new Date().toISOString(),
      model_version: this.config.modelVersion,
    }
    
    this.setCache(cacheKey, result)
    return result
  }
  
  /**
   * Get model confidence score
   */
  async predictConfidence(
    asset: SupportedAsset,
    timeframe: Timeframe
  ): Promise<ConfidencePrediction> {
    const cacheKey = this.getCacheKey("confidence", asset, timeframe)
    const cached = this.getFromCache<ConfidencePrediction>(cacheKey)
    if (cached) return cached
    
    Logger.debug(`Predicting confidence for ${asset} (${timeframe})`)
    
    const currentPrice = await this.getCurrentPrice(asset)
    const prediction = simulateLSTMPrediction(asset, timeframe, currentPrice)
    
    // Break down confidence by factor
    const { features } = prediction
    const technicalConf = Math.abs(features.rsi - 50) / 50 * 0.3 + 0.5
    const momentumConf = Math.abs(features.macd - features.macd_signal) * 2 + 0.4
    const volatilityConf = 1 - features.volatility * 10
    const volumeConf = Math.min(1, features.volume_ratio / 2)
    
    const result: ConfidencePrediction = {
      type: "confidence",
      asset,
      timeframe,
      confidence: Math.round(prediction.confidence * 100) / 100,
      confidence_breakdown: {
        technical: Math.round(Math.min(1, Math.max(0, technicalConf)) * 100) / 100,
        momentum: Math.round(Math.min(1, Math.max(0, momentumConf)) * 100) / 100,
        volatility: Math.round(Math.min(1, Math.max(0, volatilityConf)) * 100) / 100,
        volume: Math.round(Math.min(1, Math.max(0, volumeConf)) * 100) / 100,
      },
      timestamp: new Date().toISOString(),
      model_version: this.config.modelVersion,
    }
    
    this.setCache(cacheKey, result)
    return result
  }
  
  /**
   * Get full prediction report
   */
  async predictFull(
    asset: SupportedAsset,
    timeframe: Timeframe
  ): Promise<FullPrediction> {
    const cacheKey = this.getCacheKey("full", asset, timeframe)
    const cached = this.getFromCache<FullPrediction>(cacheKey)
    if (cached) return cached
    
    Logger.debug(`Generating full report for ${asset} (${timeframe})`)
    
    // Get all prediction components
    const [direction, target, confidence] = await Promise.all([
      this.predictDirection(asset, timeframe),
      this.predictTarget(asset, timeframe),
      this.predictConfidence(asset, timeframe),
    ])
    
    const currentPrice = target.current_price
    const prediction = simulateLSTMPrediction(asset, timeframe, currentPrice)
    
    // Generate analysis
    const directionText = direction.direction === "bullish" ? "upward" :
                         direction.direction === "bearish" ? "downward" : "sideways"
    
    const summary = `${asset} is showing ${directionText} momentum on the ${timeframe} timeframe. ` +
      `Model confidence is ${Math.round(confidence.confidence * 100)}%. ` +
      `Price target: $${target.predicted_price} (${target.price_change_pct > 0 ? '+' : ''}${target.price_change_pct}%).`
    
    // Calculate risk/reward (with fallbacks for type safety)
    const stopLossLevel = target.support_levels[0] ?? currentPrice * 0.95
    const takeProfitLevel = target.resistance_levels[1] ?? currentPrice * 1.10
    const supportFirst = target.support_levels[0] ?? currentPrice * 0.95
    const resistanceFirst = target.resistance_levels[0] ?? currentPrice * 1.05
    
    const stopLossDistance = Math.abs(stopLossLevel - currentPrice)
    const takeProfitDistance = Math.abs(takeProfitLevel - currentPrice)
    
    const result: FullPrediction = {
      type: "full",
      asset,
      timeframe,
      direction,
      target,
      confidence,
      analysis: {
        summary,
        key_levels: {
          support: target.support_levels,
          resistance: target.resistance_levels,
          pivot: Math.round((supportFirst + resistanceFirst) / 2 * 100) / 100,
        },
        indicators: {
          rsi: Math.round(prediction.features.rsi * 100) / 100,
          macd: {
            value: Math.round(prediction.features.macd * 10000) / 10000,
            signal: Math.round(prediction.features.macd_signal * 10000) / 10000,
            histogram: Math.round((prediction.features.macd - prediction.features.macd_signal) * 10000) / 10000,
          },
          ema_trend: prediction.features.ema_short > prediction.features.ema_long ? "bullish" :
                     prediction.features.ema_short < prediction.features.ema_long ? "bearish" : "neutral",
        },
        risk_reward: {
          stop_loss: stopLossLevel,
          take_profit: takeProfitLevel,
          ratio: Math.round(takeProfitDistance / stopLossDistance * 100) / 100,
        },
      },
      timestamp: new Date().toISOString(),
      model_version: this.config.modelVersion,
    }
    
    this.setCache(cacheKey, result)
    return result
  }
  
  /**
   * Run backtesting on historical data
   */
  async runBacktest(request: BacktestRequest): Promise<BacktestResult> {
    Logger.debug(`Running backtest for ${request.asset}: ${request.strategy}`)
    
    const startDate = new Date(request.start_date)
    const endDate = new Date(request.end_date)
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    
    // Simulate backtesting results
    // In production, this runs actual backtests against historical data
    const seed = request.asset.charCodeAt(0) + request.strategy.charCodeAt(0)
    const random = (min: number, max: number) => min + (((seed * 9301 + 49297) % 233280) / 233280) * (max - min)
    
    const totalReturn = random(-20, 80)
    const trades = Math.floor(days / 3)
    const winRate = random(0.4, 0.65)
    const winning = Math.floor(trades * winRate)
    const avgWin = random(2, 8)
    const avgLoss = random(1, 4)
    
    const result: BacktestResult = {
      asset: request.asset,
      strategy: request.strategy,
      period: {
        start: request.start_date,
        end: request.end_date,
        days,
      },
      performance: {
        total_return_pct: Math.round(totalReturn * 100) / 100,
        annualized_return_pct: Math.round((totalReturn * 365 / days) * 100) / 100,
        sharpe_ratio: Math.round(random(0.5, 2.5) * 100) / 100,
        sortino_ratio: Math.round(random(0.8, 3.0) * 100) / 100,
        max_drawdown_pct: Math.round(random(5, 25) * 100) / 100,
        win_rate_pct: Math.round(winRate * 10000) / 100,
        profit_factor: Math.round((winning * avgWin) / ((trades - winning) * avgLoss) * 100) / 100,
      },
      trades: {
        total: trades,
        winning,
        losing: trades - winning,
        average_win_pct: Math.round(avgWin * 100) / 100,
        average_loss_pct: Math.round(avgLoss * 100) / 100,
      },
      risk_metrics: {
        volatility_annual: Math.round(random(15, 50) * 100) / 100,
        var_95: Math.round(random(2, 8) * 100) / 100,
        cvar_95: Math.round(random(3, 12) * 100) / 100,
        beta: Math.round(random(0.8, 1.4) * 100) / 100,
        alpha: Math.round(random(-5, 15) * 100) / 100,
      },
      comparison: {
        vs_buy_hold: Math.round(random(-10, 30) * 100) / 100,
        vs_benchmark: Math.round(random(-15, 25) * 100) / 100,
      },
      timestamp: new Date().toISOString(),
    }
    
    return result
  }
  
  /**
   * Clear prediction cache
   */
  clearCache(): void {
    this.cache.clear()
    Logger.debug("Prediction cache cleared")
  }
  
  /**
   * Get model info
   */
  getModelInfo(): { version: string; endpoint: string; cacheEnabled: boolean } {
    return {
      version: this.config.modelVersion,
      endpoint: this.config.apiEndpoint,
      cacheEnabled: this.config.enableCache,
    }
  }
}
