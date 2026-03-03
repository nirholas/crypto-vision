/**
 * AI Prediction Types
 * @description Type definitions for the AI prediction marketplace
 * @author nirholas
 * @license Apache-2.0
 */

// ============================================================================
// Pricing Configuration
// ============================================================================

/**
 * Prediction product pricing in USD
 */
export const PREDICTION_PRICING = {
  /** Up/Down/Sideways prediction */
  direction: 0.01,
  /** Specific price target */
  target: 0.05,
  /** Model confidence score */
  confidence: 0.02,
  /** Full report with analysis */
  full: 0.10,
  /** Backtesting service */
  backtest: 0.50,
  /** Multi-asset bulk (per asset) */
  bulk_per_asset: 0.01,
  /** Model-as-a-Service monthly */
  maas_monthly: 10.00,
} as const

/**
 * Supported cryptocurrency assets
 */
export const SUPPORTED_ASSETS = [
  "BTC",
  "ETH",
  "SOL",
  "ARB",
  "AVAX",
  "MATIC",
  "LINK",
  "UNI",
  "AAVE",
  "OP",
] as const

/**
 * Prediction timeframes
 */
export const TIMEFRAMES = ["1h", "4h", "1d", "1w"] as const

// ============================================================================
// Type Definitions
// ============================================================================

export type PredictionType = keyof typeof PREDICTION_PRICING
export type SupportedAsset = typeof SUPPORTED_ASSETS[number]
export type Timeframe = typeof TIMEFRAMES[number]

/**
 * Direction prediction result
 */
export type PriceDirection = "bullish" | "bearish" | "sideways"

/**
 * Prediction request parameters
 */
export interface PredictionRequest {
  /** Asset to predict */
  asset: SupportedAsset
  /** Prediction timeframe */
  timeframe: Timeframe
  /** Type of prediction */
  type: PredictionType
}

/**
 * Direction prediction response
 */
export interface DirectionPrediction {
  type: "direction"
  asset: SupportedAsset
  timeframe: Timeframe
  direction: PriceDirection
  timestamp: string
  model_version: string
}

/**
 * Price target prediction response
 */
export interface TargetPrediction {
  type: "target"
  asset: SupportedAsset
  timeframe: Timeframe
  current_price: number
  predicted_price: number
  price_change_pct: number
  support_levels: number[]
  resistance_levels: number[]
  timestamp: string
  model_version: string
}

/**
 * Confidence score response
 */
export interface ConfidencePrediction {
  type: "confidence"
  asset: SupportedAsset
  timeframe: Timeframe
  confidence: number
  confidence_breakdown: {
    technical: number
    momentum: number
    volatility: number
    volume: number
  }
  timestamp: string
  model_version: string
}

/**
 * Full prediction report
 */
export interface FullPrediction {
  type: "full"
  asset: SupportedAsset
  timeframe: Timeframe
  direction: DirectionPrediction
  target: TargetPrediction
  confidence: ConfidencePrediction
  analysis: {
    summary: string
    key_levels: {
      support: number[]
      resistance: number[]
      pivot: number
    }
    indicators: {
      rsi: number
      macd: {
        value: number
        signal: number
        histogram: number
      }
      ema_trend: "bullish" | "bearish" | "neutral"
    }
    risk_reward: {
      stop_loss: number
      take_profit: number
      ratio: number
    }
  }
  timestamp: string
  model_version: string
}

/**
 * Union type for all prediction responses
 */
export type PredictionResponse =
  | DirectionPrediction
  | TargetPrediction
  | ConfidencePrediction
  | FullPrediction

/**
 * Backtesting request parameters
 */
export interface BacktestRequest {
  /** Asset to backtest */
  asset: SupportedAsset
  /** Start date (ISO format) */
  start_date: string
  /** End date (ISO format) */
  end_date: string
  /** Strategy type */
  strategy: "momentum" | "mean_reversion" | "trend_following" | "custom"
  /** Custom strategy parameters */
  parameters?: Record<string, number>
}

/**
 * Backtesting response
 */
export interface BacktestResult {
  asset: SupportedAsset
  strategy: string
  period: {
    start: string
    end: string
    days: number
  }
  performance: {
    total_return_pct: number
    annualized_return_pct: number
    sharpe_ratio: number
    sortino_ratio: number
    max_drawdown_pct: number
    win_rate_pct: number
    profit_factor: number
  }
  trades: {
    total: number
    winning: number
    losing: number
    average_win_pct: number
    average_loss_pct: number
  }
  risk_metrics: {
    volatility_annual: number
    var_95: number
    cvar_95: number
    beta: number
    alpha: number
  }
  comparison: {
    vs_buy_hold: number
    vs_benchmark: number
  }
  timestamp: string
}

/**
 * Multi-asset prediction request
 */
export interface BulkPredictionRequest {
  /** Assets to predict */
  assets: SupportedAsset[]
  /** Prediction timeframe */
  timeframe: Timeframe
  /** Type of prediction */
  type: Exclude<PredictionType, "backtest" | "maas_monthly">
}

/**
 * Multi-asset prediction response
 */
export interface BulkPredictionResponse {
  predictions: Record<SupportedAsset, PredictionResponse>
  total_cost: number
  timestamp: string
}

/**
 * Model-as-a-Service subscription
 */
export interface MaaSSubscription {
  subscription_id: string
  user_id: string
  status: "active" | "pending" | "cancelled" | "expired"
  model_id: string
  created_at: string
  expires_at: string
  features: {
    custom_training: boolean
    private_instance: boolean
    api_access: boolean
    priority_inference: boolean
    custom_assets: number
  }
  api_key: string
  endpoint: string
}

/**
 * Payment receipt for predictions
 */
export interface PaymentReceipt {
  transaction_hash: string
  amount: string
  token: string
  network: string
  timestamp: string
  prediction_type: PredictionType
  asset?: SupportedAsset
}
