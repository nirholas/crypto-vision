/**
 * Usage Quotas Manager
 * @description Monthly usage caps and overage handling for API keys
 * @author nirholas
 * @license Apache-2.0
 */

import type { Address } from "viem"
import type {
  QuotaConfig,
  QuotaStatus,
  OverageStrategy,
  AccessStorageAdapter,
  AccessTierName,
} from "./types.js"
import { defaultStorage } from "./storage.js"
import { DEFAULT_TIERS } from "./tiers.js"
import Logger from "@/utils/logger.js"

/**
 * Default quota configurations by tier
 */
export const DEFAULT_QUOTA_CONFIG: Record<AccessTierName, QuotaConfig> = {
  free: {
    monthlyLimit: 1000,
    dailyLimit: 100,
    overageStrategy: "block",
    notifyThreshold: 80,
  },
  basic: {
    monthlyLimit: 10000,
    dailyLimit: 500,
    overageStrategy: "notify",
    overageRate: "0.001",
    notifyThreshold: 80,
  },
  pro: {
    monthlyLimit: 100000,
    dailyLimit: 5000,
    overageStrategy: "allow_premium",
    overageRate: "0.0005",
    notifyThreshold: 90,
  },
  enterprise: {
    monthlyLimit: -1, // Unlimited
    overageStrategy: "allow_premium",
    notifyThreshold: 95,
  },
}

/**
 * Usage Quota Manager
 */
export class QuotaManager {
  private storage: AccessStorageAdapter
  private notificationHandlers: Map<string, (data: any) => Promise<void>> = new Map()

  constructor(storage: AccessStorageAdapter = defaultStorage) {
    this.storage = storage
  }

  /**
   * Get the current month period string (YYYY-MM)
   */
  private getCurrentPeriod(): string {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  }

  /**
   * Get the current day period string (YYYY-MM-DD)
   */
  private getCurrentDay(): string {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
  }

  /**
   * Get the end of the current month (Unix ms)
   */
  private getMonthEndTimestamp(): number {
    const now = new Date()
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    return nextMonth.getTime()
  }

  /**
   * Get the end of the current day (Unix ms)
   */
  private getDayEndTimestamp(): number {
    const now = new Date()
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    return tomorrow.getTime()
  }

  /**
   * Get quota status for a key
   */
  async getQuotaStatus(
    keyId: string,
    toolId: string,
    config: QuotaConfig
  ): Promise<QuotaStatus> {
    const period = this.getCurrentPeriod()
    const used = await this.storage.getQuotaUsage(keyId, period)
    const limit = config.monthlyLimit

    // Handle unlimited quota
    if (limit === -1) {
      return {
        id: keyId,
        toolId,
        period,
        used,
        limit: -1,
        remaining: -1, // Unlimited
        percentUsed: 0,
        exceeded: false,
        resetsAt: this.getMonthEndTimestamp(),
      }
    }

    const remaining = Math.max(0, limit - used)
    const percentUsed = Math.round((used / limit) * 100)
    const exceeded = used >= limit
    const overage = exceeded ? used - limit : undefined

    return {
      id: keyId,
      toolId,
      period,
      used,
      limit,
      remaining,
      percentUsed,
      exceeded,
      resetsAt: this.getMonthEndTimestamp(),
      overage,
    }
  }

  /**
   * Get daily quota status for a key
   */
  async getDailyQuotaStatus(
    keyId: string,
    toolId: string,
    config: QuotaConfig
  ): Promise<QuotaStatus | null> {
    if (!config.dailyLimit) {
      return null
    }

    const period = this.getCurrentDay()
    const used = await this.storage.getQuotaUsage(`${keyId}:daily`, period)
    const limit = config.dailyLimit

    const remaining = Math.max(0, limit - used)
    const percentUsed = Math.round((used / limit) * 100)
    const exceeded = used >= limit

    return {
      id: keyId,
      toolId,
      period,
      used,
      limit,
      remaining,
      percentUsed,
      exceeded,
      resetsAt: this.getDayEndTimestamp(),
    }
  }

  /**
   * Check and consume quota
   * Returns whether the request is allowed
   */
  async checkAndConsumeQuota(
    keyId: string,
    toolId: string,
    config: QuotaConfig,
    cost: number = 1
  ): Promise<{
    allowed: boolean
    status: QuotaStatus
    dailyStatus?: QuotaStatus | null
    reason?: string
    overageCharge?: string
  }> {
    const monthlyStatus = await this.getQuotaStatus(keyId, toolId, config)
    const dailyStatus = await this.getDailyQuotaStatus(keyId, toolId, config)

    // Check daily limit first (if applicable)
    if (dailyStatus && dailyStatus.exceeded) {
      if (config.overageStrategy === "block") {
        return {
          allowed: false,
          status: monthlyStatus,
          dailyStatus,
          reason: "Daily quota exceeded",
        }
      }
    }

    // Check monthly limit
    if (monthlyStatus.exceeded) {
      switch (config.overageStrategy) {
        case "block":
          return {
            allowed: false,
            status: monthlyStatus,
            dailyStatus,
            reason: "Monthly quota exceeded",
          }

        case "throttle":
          // In throttle mode, we might still allow but at reduced rate
          // This is handled at the rate limiter level
          return {
            allowed: false,
            status: monthlyStatus,
            dailyStatus,
            reason: "Monthly quota exceeded (throttled)",
          }

        case "allow_premium":
          // Allow but charge overage
          if (!config.overageRate) {
            return {
              allowed: false,
              status: monthlyStatus,
              dailyStatus,
              reason: "Overage rate not configured",
            }
          }
          const overageCharge = (parseFloat(config.overageRate) * cost).toFixed(6)
          // Continue to consume...
          break

        case "notify":
          // Notify but allow
          await this.sendNotification(keyId, toolId, "quota_exceeded", {
            status: monthlyStatus,
          })
          break
      }
    }

    // Check notification threshold
    if (
      config.notifyThreshold &&
      monthlyStatus.percentUsed >= config.notifyThreshold &&
      monthlyStatus.percentUsed < 100
    ) {
      await this.sendNotification(keyId, toolId, "quota_warning", {
        percentUsed: monthlyStatus.percentUsed,
        threshold: config.notifyThreshold,
      })
    }

    // Consume quota
    const period = this.getCurrentPeriod()
    await this.storage.incrementQuotaUsage(keyId, period, cost)

    // Consume daily quota if applicable
    if (config.dailyLimit) {
      const dayPeriod = this.getCurrentDay()
      await this.storage.incrementQuotaUsage(`${keyId}:daily`, dayPeriod, cost)
    }

    // Get updated status
    const updatedStatus = await this.getQuotaStatus(keyId, toolId, config)
    const updatedDailyStatus = await this.getDailyQuotaStatus(keyId, toolId, config)

    // Calculate overage charge if applicable
    let overageCharge: string | undefined
    if (
      config.overageStrategy === "allow_premium" &&
      config.overageRate &&
      monthlyStatus.exceeded
    ) {
      overageCharge = (parseFloat(config.overageRate) * cost).toFixed(6)
    }

    return {
      allowed: true,
      status: updatedStatus,
      dailyStatus: updatedDailyStatus,
      overageCharge,
    }
  }

  /**
   * Get quota usage history
   */
  async getQuotaHistory(
    keyId: string,
    months: number = 6
  ): Promise<{ period: string; usage: number }[]> {
    const history: { period: string; usage: number }[] = []
    const now = new Date()

    for (let i = 0; i < months; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
      const usage = await this.storage.getQuotaUsage(keyId, period)
      history.push({ period, usage })
    }

    return history.reverse()
  }

  /**
   * Reset quota for a specific period (admin function)
   */
  async resetQuota(keyId: string, period?: string): Promise<void> {
    const targetPeriod = period || this.getCurrentPeriod()
    // In a real implementation, you'd reset the counter
    // For now, we just log it
    Logger.info(`Quota reset for ${keyId} period ${targetPeriod}`)
  }

  /**
   * Calculate estimated overage charges
   */
  estimateOverageCharges(
    currentUsage: number,
    projectedUsage: number,
    config: QuotaConfig
  ): string {
    if (config.monthlyLimit === -1 || !config.overageRate) {
      return "0"
    }

    const overage = Math.max(0, projectedUsage - config.monthlyLimit)
    return (overage * parseFloat(config.overageRate)).toFixed(2)
  }

  /**
   * Get days remaining in current period
   */
  getDaysRemainingInPeriod(): number {
    const now = new Date()
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return endOfMonth.getDate() - now.getDate()
  }

  /**
   * Project usage for the month based on current rate
   */
  projectMonthlyUsage(currentUsage: number): number {
    const now = new Date()
    const dayOfMonth = now.getDate()
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()

    if (dayOfMonth === 0) return 0

    const dailyRate = currentUsage / dayOfMonth
    return Math.round(dailyRate * daysInMonth)
  }

  /**
   * Register a notification handler
   */
  registerNotificationHandler(
    keyId: string,
    handler: (data: any) => Promise<void>
  ): void {
    this.notificationHandlers.set(keyId, handler)
  }

  /**
   * Send notification
   */
  private async sendNotification(
    keyId: string,
    toolId: string,
    type: "quota_warning" | "quota_exceeded",
    data: any
  ): Promise<void> {
    const handler = this.notificationHandlers.get(keyId)
    if (handler) {
      try {
        await handler({ type, keyId, toolId, timestamp: Date.now(), ...data })
      } catch (error) {
        Logger.error(`Notification handler error for key ${keyId}:`, error)
      }
    }

    Logger.info(`Quota notification: ${type} for key ${keyId}`)
  }

  /**
   * Get quota config for a tier
   */
  getQuotaConfigForTier(tier: AccessTierName): QuotaConfig {
    return DEFAULT_QUOTA_CONFIG[tier]
  }

  /**
   * Create custom quota config
   */
  createCustomQuotaConfig(
    baseConfig: QuotaConfig,
    overrides: Partial<QuotaConfig>
  ): QuotaConfig {
    return { ...baseConfig, ...overrides }
  }
}

/**
 * Default quota manager instance
 */
export const quotaManager = new QuotaManager()

/**
 * Quota check result type for middleware
 */
export interface QuotaCheckResult {
  allowed: boolean
  quotaStatus: QuotaStatus
  dailyQuotaStatus?: QuotaStatus | null
  overageCharge?: string
  reason?: string
}

/**
 * Utility function for quick quota check
 */
export async function checkQuota(
  keyId: string,
  toolId: string,
  tier: AccessTierName,
  cost: number = 1
): Promise<QuotaCheckResult> {
  const config = DEFAULT_QUOTA_CONFIG[tier]
  const result = await quotaManager.checkAndConsumeQuota(keyId, toolId, config, cost)

  return {
    allowed: result.allowed,
    quotaStatus: result.status,
    dailyQuotaStatus: result.dailyStatus,
    overageCharge: result.overageCharge,
    reason: result.reason,
  }
}
