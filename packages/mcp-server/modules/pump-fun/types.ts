/**
 * PumpFun x402 Module — Type Definitions
 *
 * Types for the PumpFun token intelligence service
 * with x402 micropayment gating.
 *
 * @author nirholas
 * @license Apache-2.0
 */

// ============================================================================
// Token Data Types (from pump.fun API / on-chain)
// ============================================================================

export interface PumpToken {
  mint: string
  name: string
  symbol: string
  description: string
  imageUri: string
  creator: string
  createdAt: string
  bondingCurveAddress: string
  associatedBondingCurve: string
  virtualSolReserves: string
  virtualTokenReserves: string
  realSolReserves: string
  realTokenReserves: string
  totalSupply: string
  marketCapSol: number
  marketCapUsd: number
  priceUsd: number
  priceSol: number
  isGraduated: boolean
  graduatedAt?: string
  ammPoolAddress?: string
  volume24h?: number
  holders?: number
  txCount24h?: number
}

export interface BondingCurveState {
  virtualSolReserves: string
  virtualTokenReserves: string
  realSolReserves: string
  realTokenReserves: string
  tokenTotalSupply: string
  complete: boolean
}

// ============================================================================
// Premium Analytics Types (x402-gated)
// ============================================================================

export interface WhaleHolder {
  address: string
  balance: string
  percentageOfSupply: number
  firstBuyTimestamp: string
  averageBuyPrice: number
  unrealizedPnl: number
  txCount: number
  label?: string // "sniper" | "whale" | "smart_money" | "dev" | "insider"
}

export interface TokenDeepAnalysis {
  token: PumpToken
  bondingCurve: BondingCurveState
  analytics: {
    healthScore: number // 0-100
    rugPullRisk: "low" | "medium" | "high" | "critical"
    graduationProbability: number // 0-1
    estimatedTimeToGraduation: string | null
    priceImpact1Sol: number // % price impact for 1 SOL buy
    priceImpact10Sol: number // % price impact for 10 SOL buy
    liquidityDepth: number // USD liquidity available
    holderConcentration: number // Gini coefficient 0-1
    top10HolderPercentage: number
    creatorHolding: number // % of supply held by creator
    devSellPressure: "none" | "low" | "medium" | "high"
  }
  whales: WhaleHolder[]
  signals: TradingSignal[]
  metadata: {
    analyzedAt: string
    dataSource: string
    paymentTxHash?: string
  }
}

export interface TradingSignal {
  type: "buy" | "sell" | "hold" | "warning"
  strength: "weak" | "moderate" | "strong"
  reason: string
  timestamp: string
}

export interface SniperDetectionResult {
  token: string
  snipersDetected: number
  totalSniperVolumeSol: number
  snipers: Array<{
    address: string
    buyTimestamp: string
    buyAmountSol: number
    tokensAcquired: string
    percentOfSupply: number
    hasAlreadySold: boolean
    soldAmountSol?: number
    knownSniperBot: boolean
    botName?: string
  }>
  riskLevel: "low" | "medium" | "high"
  verdict: string
}

export interface SmartMoneyFlow {
  token: string
  period: string
  netFlow: "inflow" | "outflow" | "neutral"
  smartMoneyBuyers: number
  smartMoneySellers: number
  smartMoneyNetVolumeSol: number
  notableWallets: Array<{
    address: string
    label: string
    action: "buy" | "sell"
    amountSol: number
    timestamp: string
    historicalWinRate: number
  }>
  sentiment: "bullish" | "bearish" | "neutral"
  confidence: number
}

export interface GraduationOdds {
  token: string
  currentMarketCapSol: number
  graduationThresholdSol: number
  progressPercent: number
  estimatedProbability: number
  factors: Array<{
    name: string
    weight: number
    score: number
    description: string
  }>
  historicalComparison: {
    totalLaunched: number
    totalGraduated: number
    graduationRate: number
    averageTimeToGraduation: string
  }
  recommendation: "likely" | "possible" | "unlikely" | "very_unlikely"
}

// ============================================================================
// x402 Pricing Configuration
// ============================================================================

export interface PumpX402Pricing {
  /** Basic token lookup — free */
  tokenLookup: 0
  /** Current price — free */
  getPrice: 0
  /** List new tokens — free */
  listNew: 0
  /** Deep analysis with whale tracking — $0.03 */
  deepAnalysis: 0.03
  /** Whale holder tracking — $0.05 */
  whaleTracker: 0.05
  /** Smart money flow analysis — $0.05 */
  smartMoney: 0.05
  /** Sniper bot detection — $0.02 */
  sniperDetection: 0.02
  /** Graduation probability — $0.03 */
  graduationOdds: 0.03
}

export const PUMP_X402_PRICING: PumpX402Pricing = {
  tokenLookup: 0,
  getPrice: 0,
  listNew: 0,
  deepAnalysis: 0.03,
  whaleTracker: 0.05,
  smartMoney: 0.05,
  sniperDetection: 0.02,
  graduationOdds: 0.03,
}

// ============================================================================
// API Response Envelope
// ============================================================================

export interface PumpApiResponse<T> {
  success: boolean
  data: T
  meta: {
    timestamp: string
    cached: boolean
    ttlSeconds: number
    paymentRequired: boolean
    costUsd?: number
  }
}

export interface PumpApiError {
  success: false
  error: {
    code: string
    message: string
    details?: string
  }
}
