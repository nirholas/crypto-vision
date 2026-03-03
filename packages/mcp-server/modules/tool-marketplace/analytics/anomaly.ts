/**
 * Anomaly Detector
 * @description Detects unusual patterns, spikes, and potential abuse in marketplace activity
 * @author nirholas
 * @license Apache-2.0
 */

import type { Address } from "viem"
import { timeseriesDB, type AggregatedDataPoint } from "./timeseries.js"
import { METRIC_NAMES } from "./collector.js"
import Logger from "@/utils/logger.js"

/**
 * Anomaly severity levels
 */
export type AnomalySeverity = "low" | "medium" | "high" | "critical"

/**
 * Anomaly types
 */
export type AnomalyType =
  | "usage_spike"
  | "usage_drop"
  | "revenue_spike"
  | "revenue_drop"
  | "error_spike"
  | "latency_spike"
  | "potential_abuse"
  | "bot_traffic"
  | "rate_limit_abuse"
  | "suspicious_pattern"

/**
 * Detected anomaly
 */
export interface Anomaly {
  /** Unique anomaly ID */
  id: string
  /** Type of anomaly */
  type: AnomalyType
  /** Severity level */
  severity: AnomalySeverity
  /** Detection timestamp */
  detectedAt: number
  /** Affected tool ID (if applicable) */
  toolId?: string
  /** Affected user address (if applicable) */
  userAddress?: Address
  /** Description of the anomaly */
  description: string
  /** Current value that triggered anomaly */
  currentValue: number
  /** Expected/baseline value */
  expectedValue: number
  /** Deviation percentage */
  deviationPercent: number
  /** Recommended action */
  recommendation: string
  /** Whether the anomaly has been acknowledged */
  acknowledged: boolean
  /** Resolution timestamp (if resolved) */
  resolvedAt?: number
}

/**
 * Alert configuration
 */
export interface AlertConfig {
  /** Anomaly types to alert on */
  types: AnomalyType[]
  /** Minimum severity to alert */
  minSeverity: AnomalySeverity
  /** Webhook URL for notifications */
  webhookUrl?: string
  /** Email addresses for notifications */
  emails?: string[]
}

/**
 * Bot detection result
 */
export interface BotDetectionResult {
  /** Whether bot traffic is suspected */
  isBot: boolean
  /** Confidence score (0-100) */
  confidence: number
  /** Reasons for classification */
  reasons: string[]
  /** User behavior metrics */
  metrics: {
    requestsPerMinute: number
    uniqueEndpoints: number
    avgResponseConsumption: number
    patternScore: number
  }
}

/**
 * Abuse pattern detection result
 */
export interface AbusePatternResult {
  /** Whether abuse is detected */
  abuseDetected: boolean
  /** Type of abuse */
  abuseType?: "rate_abuse" | "payment_fraud" | "credential_stuffing" | "scraping"
  /** Confidence score (0-100) */
  confidence: number
  /** Evidence of abuse */
  evidence: string[]
  /** Recommended actions */
  recommendedActions: string[]
}

/**
 * Statistical thresholds for anomaly detection
 */
interface DetectionThresholds {
  /** Z-score threshold for spike detection */
  spikeZScore: number
  /** Z-score threshold for drop detection */
  dropZScore: number
  /** Minimum data points for reliable detection */
  minDataPoints: number
  /** Rolling window size (in hours) */
  rollingWindowHours: number
}

const DEFAULT_THRESHOLDS: DetectionThresholds = {
  spikeZScore: 2.5,
  dropZScore: -2.0,
  minDataPoints: 24, // 24 hours of hourly data
  rollingWindowHours: 168, // 7 days
}

/**
 * Internal storage for anomalies and tracking
 */
interface AnomalyStorage {
  /** Detected anomalies */
  anomalies: Map<string, Anomaly>
  /** User request patterns: userAddress -> timestamps */
  userRequestPatterns: Map<string, number[]>
  /** User endpoint access: userAddress -> endpoint -> count */
  userEndpointAccess: Map<string, Map<string, number>>
  /** Alert configurations */
  alertConfigs: AlertConfig[]
}

const storage: AnomalyStorage = {
  anomalies: new Map(),
  userRequestPatterns: new Map(),
  userEndpointAccess: new Map(),
  alertConfigs: [],
}

/**
 * Generate unique anomaly ID
 */
function generateAnomalyId(type: AnomalyType, toolId?: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).slice(2, 8)
  return `anomaly_${type}_${toolId || "platform"}_${timestamp}_${random}`
}

/**
 * Calculate Z-score for anomaly detection
 */
function calculateZScore(value: number, mean: number, stddev: number): number {
  if (stddev === 0) return 0
  return (value - mean) / stddev
}

/**
 * Determine severity based on deviation
 */
function determineSeverity(deviationPercent: number): AnomalySeverity {
  const absDeviation = Math.abs(deviationPercent)
  if (absDeviation >= 500) return "critical"
  if (absDeviation >= 200) return "high"
  if (absDeviation >= 100) return "medium"
  return "low"
}

/**
 * Anomaly Detector Service
 * Monitors marketplace activity for unusual patterns
 */
export class AnomalyDetectorService {
  private thresholds: DetectionThresholds
  private detectionInterval: ReturnType<typeof setInterval> | null = null

  constructor(thresholds?: Partial<DetectionThresholds>) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds }
  }

  /**
   * Start automatic anomaly detection
   */
  startDetection(intervalMs: number = 300000): void { // 5 minutes default
    if (this.detectionInterval) return

    this.detectionInterval = setInterval(() => {
      this.runDetection()
    }, intervalMs)

    Logger.info("AnomalyDetector: Started automatic detection")
  }

  /**
   * Stop automatic detection
   */
  stopDetection(): void {
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval)
      this.detectionInterval = null
      Logger.info("AnomalyDetector: Stopped automatic detection")
    }
  }

  /**
   * Run full anomaly detection
   */
  async runDetection(): Promise<Anomaly[]> {
    const newAnomalies: Anomaly[] = []
    const now = Date.now()

    // Detect usage spikes/drops
    const usageAnomalies = await this.detectUsageAnomalies()
    newAnomalies.push(...usageAnomalies)

    // Detect revenue anomalies
    const revenueAnomalies = await this.detectRevenueAnomalies()
    newAnomalies.push(...revenueAnomalies)

    // Detect error spikes
    const errorAnomalies = await this.detectErrorSpikes()
    newAnomalies.push(...errorAnomalies)

    // Detect latency issues
    const latencyAnomalies = await this.detectLatencyAnomalies()
    newAnomalies.push(...latencyAnomalies)

    // Store new anomalies
    for (const anomaly of newAnomalies) {
      storage.anomalies.set(anomaly.id, anomaly)
    }

    // Send alerts
    await this.sendAlerts(newAnomalies)

    Logger.info(`AnomalyDetector: Detected ${newAnomalies.length} new anomalies`)
    return newAnomalies
  }

  /**
   * Detect usage anomalies (spikes and drops)
   */
  private async detectUsageAnomalies(): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = []
    const now = Date.now()
    const windowStart = now - this.thresholds.rollingWindowHours * 60 * 60 * 1000

    const data = timeseriesDB.query(METRIC_NAMES.PLATFORM_TOTAL_CALLS, {
      startTime: windowStart,
      endTime: now,
      granularity: "hour",
    })

    if (data.length < this.thresholds.minDataPoints) {
      return anomalies
    }

    // Calculate baseline statistics
    const values = data.map(d => d.count)
    const filteredValues = values.filter((v): v is number => v !== undefined)
    if (filteredValues.length < this.thresholds.minDataPoints) return anomalies
    const mean = filteredValues.reduce((a, b) => a + b, 0) / filteredValues.length
    const variance = filteredValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / filteredValues.length
    const stddev = Math.sqrt(variance)

    // Check the most recent hour
    const latestValueRaw = values[values.length - 1]
    if (latestValueRaw === undefined) return anomalies
    const latestValue: number = latestValueRaw
    const zScore = calculateZScore(latestValue, mean, stddev)

    if (zScore >= this.thresholds.spikeZScore) {
      const deviationPercent = ((latestValue - mean) / mean) * 100
      anomalies.push({
        id: generateAnomalyId("usage_spike"),
        type: "usage_spike",
        severity: determineSeverity(deviationPercent),
        detectedAt: now,
        description: `Unusual spike in platform usage: ${latestValue} calls vs expected ${mean.toFixed(0)}`,
        currentValue: latestValue,
        expectedValue: mean,
        deviationPercent,
        recommendation: "Investigate if this is legitimate traffic growth or potential abuse",
        acknowledged: false,
      })
    }

    if (zScore <= this.thresholds.dropZScore) {
      const deviationPercent = ((latestValue - mean) / mean) * 100
      anomalies.push({
        id: generateAnomalyId("usage_drop"),
        type: "usage_drop",
        severity: determineSeverity(Math.abs(deviationPercent)),
        detectedAt: now,
        description: `Significant drop in platform usage: ${latestValue} calls vs expected ${mean.toFixed(0)}`,
        currentValue: latestValue,
        expectedValue: mean,
        deviationPercent,
        recommendation: "Check for service outages, API errors, or external factors",
        acknowledged: false,
      })
    }

    return anomalies
  }

  /**
   * Detect revenue anomalies
   */
  private async detectRevenueAnomalies(): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = []
    const now = Date.now()
    const windowStart = now - this.thresholds.rollingWindowHours * 60 * 60 * 1000

    const data = timeseriesDB.query(METRIC_NAMES.PLATFORM_TOTAL_REVENUE, {
      startTime: windowStart,
      endTime: now,
      granularity: "hour",
    })

    if (data.length < this.thresholds.minDataPoints) {
      return anomalies
    }

    const values = data.map(d => d.sum)
    const filteredValues = values.filter((v): v is number => v !== undefined)
    if (filteredValues.length < this.thresholds.minDataPoints) return anomalies
    const mean = filteredValues.reduce((a, b) => a + b, 0) / filteredValues.length
    const variance = filteredValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / filteredValues.length
    const stddev = Math.sqrt(variance)

    const latestValueRaw = values[values.length - 1]
    if (latestValueRaw === undefined) return anomalies
    const latestValue: number = latestValueRaw
    const zScore = calculateZScore(latestValue, mean, stddev)

    if (zScore >= this.thresholds.spikeZScore) {
      const deviationPercent = mean > 0 ? ((latestValue - mean) / mean) * 100 : 0
      anomalies.push({
        id: generateAnomalyId("revenue_spike"),
        type: "revenue_spike",
        severity: determineSeverity(deviationPercent),
        detectedAt: now,
        description: `Revenue spike: $${latestValue.toFixed(2)} vs expected $${mean.toFixed(2)}`,
        currentValue: latestValue,
        expectedValue: mean,
        deviationPercent,
        recommendation: "Verify transactions are legitimate; may indicate bulk purchase or new enterprise client",
        acknowledged: false,
      })
    }

    if (zScore <= this.thresholds.dropZScore && mean > 0) {
      const deviationPercent = ((latestValue - mean) / mean) * 100
      anomalies.push({
        id: generateAnomalyId("revenue_drop"),
        type: "revenue_drop",
        severity: "high", // Revenue drops are always important
        detectedAt: now,
        description: `Revenue drop: $${latestValue.toFixed(2)} vs expected $${mean.toFixed(2)}`,
        currentValue: latestValue,
        expectedValue: mean,
        deviationPercent,
        recommendation: "Investigate payment processing issues, pricing changes, or customer churn",
        acknowledged: false,
      })
    }

    return anomalies
  }

  /**
   * Detect error rate spikes
   */
  private async detectErrorSpikes(): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = []
    const now = Date.now()
    const windowStart = now - 24 * 60 * 60 * 1000 // Last 24 hours

    const errorData = timeseriesDB.query(METRIC_NAMES.TOOL_ERRORS, {
      startTime: windowStart,
      endTime: now,
      granularity: "hour",
    })

    const callData = timeseriesDB.query(METRIC_NAMES.PLATFORM_TOTAL_CALLS, {
      startTime: windowStart,
      endTime: now,
      granularity: "hour",
    })

    if (errorData.length === 0 || callData.length === 0) {
      return anomalies
    }

    // Calculate error rate
    const totalErrors = errorData.reduce((sum, d) => sum + (d.count ?? 0), 0)
    const totalCalls = callData.reduce((sum, d) => sum + (d.count ?? 0), 0)
    
    if (totalCalls === 0) return anomalies

    const errorRate = (totalErrors / totalCalls) * 100
    const baselineErrorRate = 5 // 5% is typical baseline

    if (errorRate > baselineErrorRate * 2) {
      anomalies.push({
        id: generateAnomalyId("error_spike"),
        type: "error_spike",
        severity: errorRate > 20 ? "critical" : errorRate > 10 ? "high" : "medium",
        detectedAt: now,
        description: `Elevated error rate: ${errorRate.toFixed(1)}% (baseline: ${baselineErrorRate}%)`,
        currentValue: errorRate,
        expectedValue: baselineErrorRate,
        deviationPercent: ((errorRate - baselineErrorRate) / baselineErrorRate) * 100,
        recommendation: "Check API health, upstream dependencies, and recent deployments",
        acknowledged: false,
      })
    }

    return anomalies
  }

  /**
   * Detect latency anomalies
   */
  private async detectLatencyAnomalies(): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = []
    const now = Date.now()
    const windowStart = now - 24 * 60 * 60 * 1000

    const data = timeseriesDB.query(METRIC_NAMES.TOOL_RESPONSE_TIME, {
      startTime: windowStart,
      endTime: now,
      granularity: "hour",
    })

    if (data.length < 6) return anomalies // Need at least 6 hours of data

    const p95Values = data.map(d => d.percentiles.p95)
    const filteredP95Values = p95Values.filter((v): v is number => v !== undefined)
    if (filteredP95Values.length < 6) return anomalies
    const mean = filteredP95Values.reduce((a, b) => a + b, 0) / filteredP95Values.length
    const variance = filteredP95Values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / filteredP95Values.length
    const stddev = Math.sqrt(variance)

    const latestP95Raw = p95Values[p95Values.length - 1]
    if (latestP95Raw === undefined) return anomalies
    const latestP95: number = latestP95Raw
    const zScore = calculateZScore(latestP95, mean, stddev)

    if (zScore >= 2.0 || latestP95 > 5000) { // > 5 seconds is always bad
      const deviationPercent = mean > 0 ? ((latestP95 - mean) / mean) * 100 : 0
      anomalies.push({
        id: generateAnomalyId("latency_spike"),
        type: "latency_spike",
        severity: latestP95 > 10000 ? "critical" : latestP95 > 5000 ? "high" : "medium",
        detectedAt: now,
        description: `High response latency: p95=${latestP95}ms vs baseline ${mean.toFixed(0)}ms`,
        currentValue: latestP95,
        expectedValue: mean,
        deviationPercent,
        recommendation: "Check server resources, database queries, and network conditions",
        acknowledged: false,
      })
    }

    return anomalies
  }

  /**
   * Record user request for bot detection
   */
  recordUserRequest(userAddress: Address, endpoint: string): void {
    const now = Date.now()
    const userKey = userAddress.toLowerCase()

    // Record timestamp
    let timestamps = storage.userRequestPatterns.get(userKey)
    if (!timestamps) {
      timestamps = []
      storage.userRequestPatterns.set(userKey, timestamps)
    }
    timestamps.push(now)

    // Clean old timestamps (keep last hour)
    const cutoff = now - 60 * 60 * 1000
    storage.userRequestPatterns.set(
      userKey,
      timestamps.filter(t => t > cutoff)
    )

    // Record endpoint access
    let endpoints = storage.userEndpointAccess.get(userKey)
    if (!endpoints) {
      endpoints = new Map()
      storage.userEndpointAccess.set(userKey, endpoints)
    }
    endpoints.set(endpoint, (endpoints.get(endpoint) || 0) + 1)
  }

  /**
   * Detect if user is likely a bot
   */
  detectBot(userAddress: Address): BotDetectionResult {
    const userKey = userAddress.toLowerCase()
    const timestamps = storage.userRequestPatterns.get(userKey) || []
    const endpoints = storage.userEndpointAccess.get(userKey) || new Map()

    const reasons: string[] = []
    let score = 0

    // Check requests per minute
    const now = Date.now()
    const lastMinute = timestamps.filter(t => t > now - 60 * 1000)
    const requestsPerMinute = lastMinute.length

    if (requestsPerMinute > 60) {
      reasons.push(`High request rate: ${requestsPerMinute}/min`)
      score += 30
    } else if (requestsPerMinute > 30) {
      reasons.push(`Elevated request rate: ${requestsPerMinute}/min`)
      score += 15
    }

    // Check request timing patterns (bots often have regular intervals)
    if (timestamps.length >= 10) {
      const intervals: number[] = []
      for (let i = 1; i < timestamps.length; i++) {
        const curr = timestamps[i]
        const prev = timestamps[i - 1]
        if (curr !== undefined && prev !== undefined) {
          intervals.push(curr - prev)
        }
      }
      
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
      const variance = intervals.reduce((sum, v) => sum + Math.pow(v - avgInterval, 2), 0) / intervals.length
      const coefficientOfVariation = Math.sqrt(variance) / avgInterval

      if (coefficientOfVariation < 0.1) {
        reasons.push("Suspiciously regular request timing")
        score += 25
      }
    }

    // Check endpoint diversity
    const uniqueEndpoints = endpoints.size
    const totalRequests = Array.from(endpoints.values()).reduce((a, b) => a + b, 0)

    if (totalRequests > 100 && uniqueEndpoints <= 2) {
      reasons.push("Low endpoint diversity with high volume")
      score += 20
    }

    // Calculate pattern score (how bot-like the behavior is)
    const patternScore = Math.min(100, score)

    return {
      isBot: score >= 50,
      confidence: Math.min(100, score),
      reasons,
      metrics: {
        requestsPerMinute,
        uniqueEndpoints,
        avgResponseConsumption: 0, // Would need additional tracking
        patternScore,
      },
    }
  }

  /**
   * Detect potential abuse patterns
   */
  detectAbusePattern(
    userAddress: Address,
    toolId: string,
    recentPayments: Array<{ amount: string; timestamp: number }>
  ): AbusePatternResult {
    const evidence: string[] = []
    const recommendedActions: string[] = []
    let confidence = 0
    let abuseType: AbusePatternResult["abuseType"]

    // Check for rate abuse
    const botResult = this.detectBot(userAddress)
    if (botResult.isBot) {
      evidence.push(...botResult.reasons)
      confidence += botResult.confidence * 0.3
      abuseType = "rate_abuse"
      recommendedActions.push("Implement rate limiting for this user")
    }

    // Check for payment fraud patterns
    if (recentPayments.length >= 5) {
      const amounts = recentPayments.map(p => parseFloat(p.amount))
      const uniqueAmounts = new Set(amounts)
      
      // Same amount repeated many times might indicate automated abuse
      if (uniqueAmounts.size === 1 && recentPayments.length > 10) {
        evidence.push("Repeated identical payment amounts")
        confidence += 20
        abuseType = "payment_fraud"
        recommendedActions.push("Review transaction history for this user")
      }

      // Very small payments in rapid succession
      const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length
      if (avgAmount < 0.001 && recentPayments.length > 20) {
        evidence.push("Many micro-transactions detected")
        confidence += 25
        abuseType = "payment_fraud"
        recommendedActions.push("Consider implementing minimum payment thresholds")
      }
    }

    // Check for scraping patterns
    const endpoints = storage.userEndpointAccess.get(userAddress.toLowerCase())
    if (endpoints) {
      const totalCalls = Array.from(endpoints.values()).reduce((a, b) => a + b, 0)
      const endpointRatio = endpoints.size / totalCalls

      // High diversity with high volume suggests scraping
      if (endpointRatio > 0.8 && totalCalls > 100) {
        evidence.push("Pattern suggests data scraping")
        confidence += 30
        abuseType = "scraping"
        recommendedActions.push("Monitor data access patterns")
        recommendedActions.push("Consider implementing CAPTCHA")
      }
    }

    return {
      abuseDetected: confidence >= 40,
      abuseType: confidence >= 40 ? abuseType : undefined,
      confidence: Math.min(100, confidence),
      evidence,
      recommendedActions,
    }
  }

  /**
   * Get all active anomalies
   */
  getActiveAnomalies(): Anomaly[] {
    return Array.from(storage.anomalies.values())
      .filter(a => !a.resolvedAt && !a.acknowledged)
      .sort((a, b) => b.detectedAt - a.detectedAt)
  }

  /**
   * Get anomalies by severity
   */
  getAnomaliesBySeverity(severity: AnomalySeverity): Anomaly[] {
    return Array.from(storage.anomalies.values())
      .filter(a => a.severity === severity && !a.resolvedAt)
      .sort((a, b) => b.detectedAt - a.detectedAt)
  }

  /**
   * Acknowledge an anomaly
   */
  acknowledgeAnomaly(anomalyId: string): void {
    const anomaly = storage.anomalies.get(anomalyId)
    if (anomaly) {
      anomaly.acknowledged = true
      Logger.info(`AnomalyDetector: Acknowledged anomaly ${anomalyId}`)
    }
  }

  /**
   * Resolve an anomaly
   */
  resolveAnomaly(anomalyId: string): void {
    const anomaly = storage.anomalies.get(anomalyId)
    if (anomaly) {
      anomaly.resolvedAt = Date.now()
      Logger.info(`AnomalyDetector: Resolved anomaly ${anomalyId}`)
    }
  }

  /**
   * Configure alerts
   */
  configureAlerts(config: AlertConfig): void {
    storage.alertConfigs.push(config)
  }

  /**
   * Send alerts for new anomalies
   */
  private async sendAlerts(anomalies: Anomaly[]): Promise<void> {
    for (const config of storage.alertConfigs) {
      const relevantAnomalies = anomalies.filter(a => {
        const severityOrder = ["low", "medium", "high", "critical"]
        const anomalySeverityIndex = severityOrder.indexOf(a.severity)
        const minSeverityIndex = severityOrder.indexOf(config.minSeverity)
        
        return (
          config.types.includes(a.type) &&
          anomalySeverityIndex >= minSeverityIndex
        )
      })

      if (relevantAnomalies.length === 0) continue

      // Send webhook
      if (config.webhookUrl) {
        try {
          await fetch(config.webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "marketplace_anomaly_alert",
              timestamp: Date.now(),
              anomalies: relevantAnomalies,
            }),
          })
          Logger.info(`AnomalyDetector: Sent webhook alert to ${config.webhookUrl}`)
        } catch (error) {
          Logger.error(`AnomalyDetector: Failed to send webhook: ${error}`)
        }
      }
    }
  }

  /**
   * Get anomaly statistics
   */
  getStats(): {
    total: number
    active: number
    acknowledged: number
    resolved: number
    bySeverity: Record<AnomalySeverity, number>
    byType: Record<string, number>
  } {
    const anomalies = Array.from(storage.anomalies.values())
    const bySeverity: Record<AnomalySeverity, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    }
    const byType: Record<string, number> = {}

    let active = 0
    let acknowledged = 0
    let resolved = 0

    for (const anomaly of anomalies) {
      bySeverity[anomaly.severity]++
      byType[anomaly.type] = (byType[anomaly.type] || 0) + 1

      if (anomaly.resolvedAt) {
        resolved++
      } else if (anomaly.acknowledged) {
        acknowledged++
      } else {
        active++
      }
    }

    return {
      total: anomalies.length,
      active,
      acknowledged,
      resolved,
      bySeverity,
      byType,
    }
  }
}

// Singleton instance
export const anomalyDetector = new AnomalyDetectorService()
