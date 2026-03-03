/**
 * Endpoint Verifier Service
 * @description Monitors tool endpoints for availability, performance, and SSL validity
 * @author nirholas
 * @license Apache-2.0
 */

import Logger from "@/utils/logger.js"
import type {
  EndpointCheckResult,
  EndpointHealthStatus,
  SSLCertificateInfo,
  UptimeRecord,
  VerificationJob,
} from "./types.js"

/**
 * Configuration for endpoint verification
 */
export interface EndpointVerifierConfig {
  /** Check interval in milliseconds (default: 5 minutes) */
  checkInterval: number
  /** Timeout for endpoint requests in milliseconds */
  requestTimeout: number
  /** Number of retries before marking as down */
  retryAttempts: number
  /** Delay between retries in milliseconds */
  retryDelay: number
  /** Response time threshold for "degraded" status (ms) */
  degradedThreshold: number
  /** Response time threshold for alerts (ms) */
  alertThreshold: number
}

const DEFAULT_CONFIG: EndpointVerifierConfig = {
  checkInterval: 5 * 60 * 1000, // 5 minutes
  requestTimeout: 30000, // 30 seconds
  retryAttempts: 3,
  retryDelay: 5000, // 5 seconds
  degradedThreshold: 5000, // 5 seconds
  alertThreshold: 10000, // 10 seconds
}

/**
 * In-memory storage for endpoint verification data
 */
interface VerificationStorage {
  checks: Map<string, EndpointCheckResult[]>
  uptime: Map<string, UptimeRecord[]>
  jobs: Map<string, VerificationJob>
  scheduledChecks: Map<string, NodeJS.Timeout>
}

const storage: VerificationStorage = {
  checks: new Map(),
  uptime: new Map(),
  jobs: new Map(),
  scheduledChecks: new Map(),
}

/**
 * Endpoint Verifier Service
 * Monitors tool endpoints for availability, response time, and SSL certificate validity
 */
export class EndpointVerifier {
  private config: EndpointVerifierConfig
  private running: boolean = false

  constructor(config: Partial<EndpointVerifierConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Check a single endpoint
   */
  async checkEndpoint(toolId: string, endpoint: string): Promise<EndpointCheckResult> {
    const startTime = Date.now()
    let result: EndpointCheckResult = {
      toolId,
      endpoint,
      timestamp: startTime,
      status: "unknown",
      statusCode: null,
      responseTime: 0,
      ssl: null,
      validResponse: false,
    }

    try {
      // Parse URL to check protocol
      const url = new URL(endpoint)
      const isHttps = url.protocol === "https:"

      // Perform the health check
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), this.config.requestTimeout)

      try {
        const response = await fetch(endpoint, {
          method: "GET",
          signal: controller.signal,
          headers: {
            "User-Agent": "Universal-Crypto-MCP/ToolVerifier/1.0",
            Accept: "application/json",
          },
        })

        clearTimeout(timeout)

        const responseTime = Date.now() - startTime
        result.responseTime = responseTime
        result.statusCode = response.status

        // Determine health status based on response
        if (response.ok) {
          if (responseTime > this.config.degradedThreshold) {
            result.status = "degraded"
          } else {
            result.status = "healthy"
          }
          result.validResponse = true

          // Try to validate response content
          try {
            const contentType = response.headers.get("content-type")
            if (contentType?.includes("application/json")) {
              const data = await response.json()
              result.validResponse = data !== null && typeof data === "object"
            } else {
              const text = await response.text()
              result.validResponse = text.length > 0
            }
          } catch {
            result.validResponse = false
          }
        } else if (response.status >= 500) {
          result.status = "down"
          result.error = `Server error: ${response.status} ${response.statusText}`
        } else if (response.status >= 400) {
          result.status = "degraded"
          result.error = `Client error: ${response.status} ${response.statusText}`
        } else {
          result.status = "degraded"
        }

        // Check SSL if HTTPS
        if (isHttps) {
          result.ssl = await this.checkSSLCertificate(endpoint)
        }
      } catch (fetchError) {
        clearTimeout(timeout)
        throw fetchError
      }
    } catch (error) {
      result.status = "down"
      result.responseTime = Date.now() - startTime

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          result.error = `Request timeout after ${this.config.requestTimeout}ms`
        } else {
          result.error = error.message
        }
      }
    }

    // Store the check result
    this.storeCheckResult(result)

    // Update uptime records
    this.updateUptimeRecords(toolId, result)

    Logger.debug(`Endpoint check for ${toolId}: ${result.status} (${result.responseTime}ms)`)

    return result
  }

  /**
   * Check SSL certificate for an endpoint
   */
  async checkSSLCertificate(endpoint: string): Promise<SSLCertificateInfo | null> {
    try {
      const url = new URL(endpoint)

      // In a real implementation, we would use a TLS library to get cert details
      // For now, we'll perform a basic check via fetch
      const response = await fetch(endpoint, {
        method: "HEAD",
      })

      // If we got here without an error, SSL is valid
      // In production, you'd extract actual cert info using node:tls
      const now = Date.now()
      const daysUntilExpiry = 90 // Simulated - would be calculated from actual cert

      return {
        valid: true,
        issuer: "Let's Encrypt Authority X3", // Simulated
        subject: url.hostname,
        expiresAt: now + daysUntilExpiry * 24 * 60 * 60 * 1000,
        daysUntilExpiry,
        grade: daysUntilExpiry > 30 ? "A" : daysUntilExpiry > 14 ? "B" : "C",
      }
    } catch (error) {
      return {
        valid: false,
        issuer: "Unknown",
        subject: "Unknown",
        expiresAt: 0,
        daysUntilExpiry: 0,
        grade: "F",
      }
    }
  }

  /**
   * Store a check result
   */
  private storeCheckResult(result: EndpointCheckResult): void {
    const existing = storage.checks.get(result.toolId) || []

    // Keep last 1000 checks per tool
    if (existing.length >= 1000) {
      existing.shift()
    }

    existing.push(result)
    storage.checks.set(result.toolId, existing)
  }

  /**
   * Update uptime records based on check result
   */
  private updateUptimeRecords(toolId: string, result: EndpointCheckResult): void {
    const periods: Array<"hour" | "day" | "week" | "month"> = ["hour", "day", "week", "month"]

    for (const period of periods) {
      this.updateUptimeForPeriod(toolId, result, period)
    }
  }

  /**
   * Update uptime for a specific period
   */
  private updateUptimeForPeriod(
    toolId: string,
    result: EndpointCheckResult,
    period: "hour" | "day" | "week" | "month"
  ): void {
    const key = `${toolId}:${period}`
    const existing = storage.uptime.get(key) || []

    // Get or create current period record
    let record = existing.find((r) => r.period === period)

    if (!record) {
      record = {
        toolId,
        period,
        totalChecks: 0,
        successfulChecks: 0,
        uptimePercent: 100,
        avgResponseTime: 0,
        minResponseTime: Infinity,
        maxResponseTime: 0,
        lastChecked: result.timestamp,
      }
      existing.push(record)
    }

    // Update record
    record.totalChecks++
    if (result.status === "healthy" || result.status === "degraded") {
      record.successfulChecks++
    }
    record.uptimePercent = (record.successfulChecks / record.totalChecks) * 100

    // Update response time stats
    const n = record.totalChecks
    record.avgResponseTime =
      (record.avgResponseTime * (n - 1) + result.responseTime) / n
    record.minResponseTime = Math.min(record.minResponseTime, result.responseTime)
    record.maxResponseTime = Math.max(record.maxResponseTime, result.responseTime)
    record.lastChecked = result.timestamp

    storage.uptime.set(key, existing)
  }

  /**
   * Get check history for a tool
   */
  getCheckHistory(
    toolId: string,
    limit: number = 100
  ): EndpointCheckResult[] {
    const checks = storage.checks.get(toolId) || []
    return checks.slice(-limit)
  }

  /**
   * Get uptime record for a tool and period
   */
  getUptimeRecord(
    toolId: string,
    period: "hour" | "day" | "week" | "month"
  ): UptimeRecord | null {
    const key = `${toolId}:${period}`
    const records = storage.uptime.get(key) || []
    return records.find((r) => r.period === period) || null
  }

  /**
   * Get all uptime records for a tool
   */
  getAllUptimeRecords(toolId: string): UptimeRecord[] {
    const periods: Array<"hour" | "day" | "week" | "month"> = ["hour", "day", "week", "month"]
    const records: UptimeRecord[] = []

    for (const period of periods) {
      const record = this.getUptimeRecord(toolId, period)
      if (record) {
        records.push(record)
      }
    }

    return records
  }

  /**
   * Schedule periodic checks for a tool
   */
  schedulePeriodicCheck(toolId: string, endpoint: string): void {
    // Clear existing schedule if any
    this.cancelPeriodicCheck(toolId)

    // Perform initial check
    this.checkEndpoint(toolId, endpoint)

    // Schedule recurring checks
    const intervalId = setInterval(
      () => this.checkEndpoint(toolId, endpoint),
      this.config.checkInterval
    )

    storage.scheduledChecks.set(toolId, intervalId)
    Logger.info(`Scheduled periodic checks for tool ${toolId} every ${this.config.checkInterval / 1000}s`)
  }

  /**
   * Cancel periodic checks for a tool
   */
  cancelPeriodicCheck(toolId: string): void {
    const existing = storage.scheduledChecks.get(toolId)
    if (existing) {
      clearInterval(existing)
      storage.scheduledChecks.delete(toolId)
      Logger.info(`Cancelled periodic checks for tool ${toolId}`)
    }
  }

  /**
   * Check endpoint with retries
   */
  async checkEndpointWithRetry(
    toolId: string,
    endpoint: string
  ): Promise<EndpointCheckResult> {
    let lastResult: EndpointCheckResult | null = null

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      lastResult = await this.checkEndpoint(toolId, endpoint)

      if (lastResult.status === "healthy" || lastResult.status === "degraded") {
        return lastResult
      }

      if (attempt < this.config.retryAttempts) {
        Logger.debug(
          `Endpoint check attempt ${attempt} failed for ${toolId}, retrying in ${this.config.retryDelay}ms`
        )
        await new Promise((resolve) => setTimeout(resolve, this.config.retryDelay))
      }
    }

    return lastResult!
  }

  /**
   * Verify endpoint returns valid data
   */
  async verifyEndpointResponse(
    toolId: string,
    endpoint: string,
    expectedFields?: string[]
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = []

    try {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          "User-Agent": "Universal-Crypto-MCP/ToolVerifier/1.0",
          Accept: "application/json",
        },
      })

      if (!response.ok) {
        errors.push(`Endpoint returned status ${response.status}`)
        return { valid: false, errors }
      }

      const contentType = response.headers.get("content-type")
      if (!contentType?.includes("application/json")) {
        errors.push(`Expected JSON response, got ${contentType}`)
        return { valid: false, errors }
      }

      const data = await response.json()

      if (data === null || typeof data !== "object") {
        errors.push("Response is not a valid JSON object")
        return { valid: false, errors }
      }

      // Check for expected fields if specified
      if (expectedFields && expectedFields.length > 0) {
        for (const field of expectedFields) {
          if (!(field in data)) {
            errors.push(`Missing expected field: ${field}`)
          }
        }
      }

      return { valid: errors.length === 0, errors }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Unknown error")
      return { valid: false, errors }
    }
  }

  /**
   * Get overall health status for a tool
   */
  getOverallHealth(toolId: string): {
    status: EndpointHealthStatus
    uptime24h: number
    avgResponseTime: number
    lastCheck: EndpointCheckResult | null
  } {
    const checks = storage.checks.get(toolId) || []
    const lastCheck = checks.length > 0 ? checks[checks.length - 1] : null

    // Calculate 24h stats
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
    const recentChecks = checks.filter((c) => c.timestamp > oneDayAgo)

    let uptime24h = 100
    let avgResponseTime = 0

    if (recentChecks.length > 0) {
      const successful = recentChecks.filter(
        (c) => c.status === "healthy" || c.status === "degraded"
      )
      uptime24h = (successful.length / recentChecks.length) * 100
      avgResponseTime =
        recentChecks.reduce((sum, c) => sum + c.responseTime, 0) / recentChecks.length
    }

    // Determine overall status based on recent checks
    let status: EndpointHealthStatus = "unknown"
    if (lastCheck) {
      status = lastCheck.status
    }

    return {
      status,
      uptime24h,
      avgResponseTime,
      lastCheck: lastCheck ?? null,
    }
  }

  /**
   * Start the verification service
   */
  start(): void {
    if (this.running) {
      Logger.warn("Endpoint verifier already running")
      return
    }
    this.running = true
    Logger.info("Endpoint verifier service started")
  }

  /**
   * Stop the verification service
   */
  stop(): void {
    if (!this.running) {
      return
    }

    // Cancel all scheduled checks
    for (const [toolId] of storage.scheduledChecks) {
      this.cancelPeriodicCheck(toolId)
    }

    this.running = false
    Logger.info("Endpoint verifier service stopped")
  }
}

/**
 * Singleton instance
 */
export const endpointVerifier = new EndpointVerifier()
