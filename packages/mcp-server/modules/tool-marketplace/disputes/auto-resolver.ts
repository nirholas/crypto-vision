/**
 * Auto Resolver Service
 * @description Automatically resolves disputes based on predefined rules
 * @author nirholas
 * @license Apache-2.0
 */

import Logger from "@/utils/logger.js"
import type { Dispute, DisputeOutcome, AutoResolutionRule } from "./types.js"
import { disputeManager } from "./manager.js"
import { endpointVerifier } from "../verification/endpoint-verifier.js"
import { schemaValidator } from "../verification/schema-validator.js"

/**
 * Configuration for auto resolution
 */
export interface AutoResolverConfig {
  /** Response time threshold for auto-refund (ms) */
  responseTimeThreshold: number
  /** Minimum uptime required (%) */
  minUptimeRequired: number
  /** Enable auto-resolution */
  enabled: boolean
}

const DEFAULT_CONFIG: AutoResolverConfig = {
  responseTimeThreshold: 30000, // 30 seconds
  minUptimeRequired: 95, // 95% uptime
  enabled: true,
}

/**
 * Generate unique ID
 */
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * In-memory storage for auto-resolution data
 */
interface AutoResolverStorage {
  rules: Map<string, AutoResolutionRule>
  resolutionLog: Array<{
    disputeId: string
    ruleId: string
    outcome: DisputeOutcome
    timestamp: number
  }>
}

const storage: AutoResolverStorage = {
  rules: new Map(),
  resolutionLog: [],
}

/**
 * Initialize default rules
 */
function initializeDefaultRules(): void {
  const defaultRules: AutoResolutionRule[] = [
    {
      id: "rule_tool_down",
      name: "Tool Down Auto-Refund",
      conditionType: "tool_down",
      action: "full_refund",
      active: true,
    },
    {
      id: "rule_slow_response",
      name: "Slow Response Auto-Refund",
      conditionType: "slow_response",
      threshold: 30000, // 30 seconds
      action: "full_refund",
      active: true,
    },
    {
      id: "rule_schema_violation",
      name: "Schema Violation Auto-Refund",
      conditionType: "schema_violation",
      action: "full_refund",
      active: true,
    },
  ]

  for (const rule of defaultRules) {
    storage.rules.set(rule.id, rule)
  }
}

// Initialize default rules on module load
initializeDefaultRules()

/**
 * Auto Resolver Service
 * Automatically resolves disputes based on objective criteria
 */
export class AutoResolver {
  private config: AutoResolverConfig

  constructor(config: Partial<AutoResolverConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Attempt to auto-resolve a dispute
   */
  async tryAutoResolve(dispute: Dispute): Promise<{
    resolved: boolean
    outcome?: DisputeOutcome
    ruleApplied?: string
    reason?: string
  }> {
    if (!this.config.enabled) {
      return { resolved: false, reason: "Auto-resolution disabled" }
    }

    if (dispute.state !== "open") {
      return { resolved: false, reason: "Dispute is not in open state" }
    }

    // Try each resolution rule
    for (const rule of storage.rules.values()) {
      if (!rule.active) continue

      const result = await this.checkRule(dispute, rule)
      if (result.matches) {
        // Apply the resolution
        const outcome = rule.action === "full_refund" ? "full_refund" : "partial_refund"
        const refundAmount =
          rule.action === "partial_refund"
            ? (parseFloat(dispute.paymentAmount) * (rule.refundPercent || 50) / 100).toFixed(4)
            : dispute.paymentAmount

        await disputeManager.resolveDispute(
          dispute.id,
          outcome,
          refundAmount,
          `Auto-resolved by rule: ${rule.name}. ${result.details}`
        )

        disputeManager.markAutoResolved(dispute.id)

        // Log the resolution
        storage.resolutionLog.push({
          disputeId: dispute.id,
          ruleId: rule.id,
          outcome,
          timestamp: Date.now(),
        })

        Logger.info(
          `Dispute ${dispute.id} auto-resolved by rule ${rule.id}: ${outcome}`
        )

        return {
          resolved: true,
          outcome,
          ruleApplied: rule.name,
          reason: result.details,
        }
      }
    }

    return { resolved: false, reason: "No auto-resolution rules matched" }
  }

  /**
   * Check if a rule applies to a dispute
   */
  private async checkRule(
    dispute: Dispute,
    rule: AutoResolutionRule
  ): Promise<{ matches: boolean; details?: string }> {
    switch (rule.conditionType) {
      case "tool_down":
        return this.checkToolDownCondition(dispute)

      case "slow_response":
        return this.checkSlowResponseCondition(dispute, rule.threshold || this.config.responseTimeThreshold)

      case "schema_violation":
        return this.checkSchemaViolationCondition(dispute)

      default:
        return { matches: false }
    }
  }

  /**
   * Check if tool was down during the disputed call
   */
  private async checkToolDownCondition(dispute: Dispute): Promise<{
    matches: boolean
    details?: string
  }> {
    if (dispute.reason !== "tool_down") {
      return { matches: false }
    }

    // Get endpoint health around the time of the dispute
    const health = endpointVerifier.getOverallHealth(dispute.toolId)

    // Check if endpoint was down or had poor uptime
    if (health.status === "down" || health.uptime24h < this.config.minUptimeRequired) {
      return {
        matches: true,
        details: `Tool uptime was ${health.uptime24h.toFixed(1)}% (below ${this.config.minUptimeRequired}% threshold). Status: ${health.status}`,
      }
    }

    // Also check historical data around the dispute time
    const checkHistory = endpointVerifier.getCheckHistory(dispute.toolId, 100)
    const disputeTime = dispute.createdAt
    const windowStart = disputeTime - 30 * 60 * 1000 // 30 minutes before
    const windowEnd = disputeTime + 30 * 60 * 1000 // 30 minutes after

    const relevantChecks = checkHistory.filter(
      (c) => c.timestamp >= windowStart && c.timestamp <= windowEnd
    )

    if (relevantChecks.length > 0) {
      const downChecks = relevantChecks.filter((c) => c.status === "down")
      if (downChecks.length > 0) {
        return {
          matches: true,
          details: `Tool was down during ${downChecks.length} of ${relevantChecks.length} checks around the dispute time`,
        }
      }
    }

    return { matches: false }
  }

  /**
   * Check if response time exceeded threshold
   */
  private async checkSlowResponseCondition(
    dispute: Dispute,
    threshold: number
  ): Promise<{ matches: boolean; details?: string }> {
    if (dispute.reason !== "slow_response") {
      return { matches: false }
    }

    // Check evidence for response time data
    const responseTimeEvidence = dispute.evidence.find(
      (e) => e.type === "log" && e.content.includes("responseTime")
    )

    if (responseTimeEvidence) {
      try {
        const data = JSON.parse(responseTimeEvidence.content)
        if (data.responseTime && data.responseTime > threshold) {
          return {
            matches: true,
            details: `Response time was ${data.responseTime}ms (threshold: ${threshold}ms)`,
          }
        }
      } catch {
        // JSON parse failed, continue with other checks
      }
    }

    // Check historical response times
    const health = endpointVerifier.getOverallHealth(dispute.toolId)
    if (health.avgResponseTime > threshold) {
      return {
        matches: true,
        details: `Average response time was ${health.avgResponseTime.toFixed(0)}ms (threshold: ${threshold}ms)`,
      }
    }

    return { matches: false }
  }

  /**
   * Check if there was a schema validation failure
   */
  private async checkSchemaViolationCondition(dispute: Dispute): Promise<{
    matches: boolean
    details?: string
  }> {
    if (dispute.reason !== "schema_violation" && dispute.reason !== "invalid_response") {
      return { matches: false }
    }

    // Check if tool has excessive violations
    if (schemaValidator.hasExcessiveViolations(dispute.toolId, 5)) {
      const violations = schemaValidator.getViolationCount(dispute.toolId)
      return {
        matches: true,
        details: `Tool has ${violations} schema violations`,
      }
    }

    // Check recent validation history
    const validationHistory = schemaValidator.getValidationHistory(dispute.toolId, 10)
    const recentFailures = validationHistory.filter((v) => !v.valid)

    if (recentFailures.length >= 3) {
      return {
        matches: true,
        details: `${recentFailures.length} of last ${validationHistory.length} validations failed`,
      }
    }

    return { matches: false }
  }

  /**
   * Add a custom auto-resolution rule
   */
  addRule(rule: Omit<AutoResolutionRule, "id">): AutoResolutionRule {
    const newRule: AutoResolutionRule = {
      ...rule,
      id: generateId("rule"),
    }

    storage.rules.set(newRule.id, newRule)
    Logger.info(`Auto-resolution rule added: ${newRule.name}`)

    return newRule
  }

  /**
   * Update a rule
   */
  updateRule(
    ruleId: string,
    updates: Partial<Omit<AutoResolutionRule, "id">>
  ): AutoResolutionRule | null {
    const rule = storage.rules.get(ruleId)
    if (!rule) return null

    const updatedRule = { ...rule, ...updates }
    storage.rules.set(ruleId, updatedRule)

    Logger.info(`Auto-resolution rule updated: ${ruleId}`)
    return updatedRule
  }

  /**
   * Delete a rule
   */
  deleteRule(ruleId: string): boolean {
    const deleted = storage.rules.delete(ruleId)
    if (deleted) {
      Logger.info(`Auto-resolution rule deleted: ${ruleId}`)
    }
    return deleted
  }

  /**
   * Get all rules
   */
  getRules(): AutoResolutionRule[] {
    return Array.from(storage.rules.values())
  }

  /**
   * Get rule by ID
   */
  getRule(ruleId: string): AutoResolutionRule | null {
    return storage.rules.get(ruleId) || null
  }

  /**
   * Enable/disable a rule
   */
  setRuleActive(ruleId: string, active: boolean): boolean {
    const rule = storage.rules.get(ruleId)
    if (!rule) return false

    rule.active = active
    storage.rules.set(ruleId, rule)

    Logger.info(`Auto-resolution rule ${ruleId} ${active ? "enabled" : "disabled"}`)
    return true
  }

  /**
   * Get resolution log
   */
  getResolutionLog(limit: number = 100): typeof storage.resolutionLog {
    return storage.resolutionLog.slice(-limit)
  }

  /**
   * Get auto-resolution statistics
   */
  getStats(): {
    totalAutoResolved: number
    byRule: Record<string, number>
    byOutcome: Record<DisputeOutcome, number>
    last24hCount: number
  } {
    const stats = {
      totalAutoResolved: storage.resolutionLog.length,
      byRule: {} as Record<string, number>,
      byOutcome: {
        full_refund: 0,
        partial_refund: 0,
        no_refund: 0,
        dismissed: 0,
        pending: 0,
      } as Record<DisputeOutcome, number>,
      last24hCount: 0,
    }

    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000

    for (const entry of storage.resolutionLog) {
      // Count by rule
      stats.byRule[entry.ruleId] = (stats.byRule[entry.ruleId] || 0) + 1

      // Count by outcome
      stats.byOutcome[entry.outcome]++

      // Count last 24h
      if (entry.timestamp > oneDayAgo) {
        stats.last24hCount++
      }
    }

    return stats
  }

  /**
   * Process all open disputes for auto-resolution
   */
  async processOpenDisputes(): Promise<{
    processed: number
    resolved: number
  }> {
    const openDisputes = disputeManager.getDisputes({ state: "open" })
    let resolved = 0

    for (const dispute of openDisputes) {
      const result = await this.tryAutoResolve(dispute)
      if (result.resolved) {
        resolved++
      }
    }

    Logger.info(`Processed ${openDisputes.length} open disputes, auto-resolved ${resolved}`)

    return {
      processed: openDisputes.length,
      resolved,
    }
  }
}

/**
 * Singleton instance
 */
export const autoResolver = new AutoResolver()
