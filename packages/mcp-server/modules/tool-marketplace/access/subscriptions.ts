/**
 * Subscription Management
 * @description Manages subscriptions, auto-renewal, and tier changes with x402 integration
 * @author nirholas
 * @license Apache-2.0
 */

import type { Address } from "viem"
import { randomBytes } from "crypto"
import type {
  Subscription,
  SubscriptionState,
  CreateSubscriptionInput,
  ChangeSubscriptionInput,
  AccessTierName,
  AccessStorageAdapter,
  AuditLogEntry,
} from "./types.js"
import { defaultStorage } from "./storage.js"
import { DEFAULT_TIERS, calculateProratedPrice, isTierHigher, getTierPriceNumber } from "./tiers.js"
import { keyManager } from "./key-manager.js"
import Logger from "@/utils/logger.js"

/**
 * Grace period for failed payments (3 days)
 */
const PAYMENT_GRACE_PERIOD_MS = 3 * 24 * 60 * 60 * 1000

/**
 * Maximum failed payment attempts before cancellation
 */
const MAX_FAILED_PAYMENTS = 3

/**
 * Subscription period length (30 days)
 */
const SUBSCRIPTION_PERIOD_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Subscription Manager Service
 */
export class SubscriptionManager {
  private storage: AccessStorageAdapter
  private paymentProcessor?: PaymentProcessor

  constructor(
    storage: AccessStorageAdapter = defaultStorage,
    paymentProcessor?: PaymentProcessor
  ) {
    this.storage = storage
    this.paymentProcessor = paymentProcessor
  }

  /**
   * Generate a unique subscription ID
   */
  private generateSubscriptionId(): string {
    return `sub_${randomBytes(16).toString("hex")}`
  }

  /**
   * Create a new subscription
   */
  async createSubscription(input: CreateSubscriptionInput): Promise<Subscription> {
    // Check for existing active subscription
    const existing = await this.storage.getSubscriptionByUserAndTool(
      input.userId,
      input.toolId
    )
    if (existing && existing.state !== "canceled" && existing.state !== "expired") {
      throw new Error("Active subscription already exists for this tool")
    }

    const now = Date.now()
    const tier = DEFAULT_TIERS[input.tier]

    // Process initial payment (if not free tier)
    if (input.tier !== "free" && tier.price !== "custom") {
      const paymentResult = await this.processPayment(
        input.userId,
        input.toolId,
        tier.price,
        input.paymentToken,
        input.paymentChain
      )

      if (!paymentResult.success) {
        throw new Error(`Payment failed: ${paymentResult.error}`)
      }
    }

    const subscription: Subscription = {
      id: this.generateSubscriptionId(),
      userId: input.userId,
      toolId: input.toolId,
      tier: input.tier,
      state: "active",
      startedAt: now,
      currentPeriodStart: now,
      currentPeriodEnd: now + SUBSCRIPTION_PERIOD_MS,
      autoRenew: input.autoRenew ?? true,
      callsUsed: 0,
      paymentToken: input.paymentToken,
      paymentChain: input.paymentChain,
      lastPaymentAt: input.tier !== "free" ? now : undefined,
      lastPaymentAmount: input.tier !== "free" ? tier.price : undefined,
      failedPayments: 0,
      createdAt: now,
      updatedAt: now,
    }

    await this.storage.saveSubscription(subscription)

    // Create an API key for the subscription
    await keyManager.createKey(
      input.toolId,
      input.userId,
      {
        name: `${input.tier} subscription key`,
        permissions: [{ toolId: input.toolId, scope: "read" }],
      },
      input.tier
    )

    // Log audit
    await this.logAudit("subscription_created", input.userId, subscription.id, {
      toolId: input.toolId,
      tier: input.tier,
    })

    Logger.info(
      `Subscription created: ${subscription.id} for tool ${input.toolId} (${input.tier})`
    )

    return subscription
  }

  /**
   * Get subscription by ID
   */
  async getSubscription(subscriptionId: string): Promise<Subscription | null> {
    return this.storage.getSubscription(subscriptionId)
  }

  /**
   * Get subscription by user and tool
   */
  async getSubscriptionByUserAndTool(
    userId: Address,
    toolId: string
  ): Promise<Subscription | null> {
    return this.storage.getSubscriptionByUserAndTool(userId, toolId)
  }

  /**
   * Get all subscriptions for a user
   */
  async getUserSubscriptions(userId: Address): Promise<Subscription[]> {
    return this.storage.getSubscriptionsByUser(userId)
  }

  /**
   * Get all subscriptions for a tool
   */
  async getToolSubscriptions(toolId: string): Promise<Subscription[]> {
    return this.storage.getSubscriptionsByTool(toolId)
  }

  /**
   * Upgrade or downgrade subscription tier
   */
  async changeTier(input: ChangeSubscriptionInput): Promise<Subscription> {
    const subscription = await this.storage.getSubscription(input.subscriptionId)
    if (!subscription) {
      throw new Error("Subscription not found")
    }

    if (subscription.state !== "active") {
      throw new Error("Can only change tier for active subscriptions")
    }

    const currentTier = subscription.tier
    const newTier = input.newTier

    if (currentTier === newTier) {
      throw new Error("Already on this tier")
    }

    const isUpgrade = isTierHigher(newTier, currentTier)
    const now = Date.now()

    // Calculate prorated amount if requested
    let proratedAmount = "0"
    let isCredit = false

    if (input.prorate) {
      const daysRemaining = Math.ceil(
        (subscription.currentPeriodEnd - now) / (24 * 60 * 60 * 1000)
      )
      const proration = calculateProratedPrice(currentTier, newTier, daysRemaining)
      proratedAmount = proration.amount
      isCredit = proration.isCredit
    }

    // Process payment for upgrade (or issue credit for downgrade)
    if (isUpgrade && !isCredit && proratedAmount !== "custom" && parseFloat(proratedAmount) > 0) {
      const paymentResult = await this.processPayment(
        subscription.userId,
        subscription.toolId,
        proratedAmount,
        subscription.paymentToken,
        subscription.paymentChain
      )

      if (!paymentResult.success) {
        throw new Error(`Upgrade payment failed: ${paymentResult.error}`)
      }
    }

    // Update subscription
    const eventType = isUpgrade ? "subscription_upgraded" : "subscription_downgraded"
    await this.storage.updateSubscription(subscription.id, {
      tier: newTier,
      updatedAt: now,
    })

    // Update associated API keys to new tier rate limits
    const keys = await keyManager.getKeysByUser(subscription.userId)
    for (const key of keys) {
      if (key.toolId === subscription.toolId && key.isActive) {
        await keyManager.updateKeyTier(key.id, newTier, subscription.userId)
      }
    }

    // Log audit
    await this.logAudit(eventType, subscription.userId, subscription.id, {
      toolId: subscription.toolId,
      previousTier: currentTier,
      newTier,
      proratedAmount,
      isCredit,
    })

    Logger.info(`Subscription tier changed: ${subscription.id} ${currentTier} -> ${newTier}`)

    const updated = await this.storage.getSubscription(subscription.id)
    return updated!
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(
    subscriptionId: string,
    canceledBy: Address,
    reason?: string,
    immediate: boolean = false
  ): Promise<Subscription> {
    const subscription = await this.storage.getSubscription(subscriptionId)
    if (!subscription) {
      throw new Error("Subscription not found")
    }

    // Verify ownership
    if (subscription.userId.toLowerCase() !== canceledBy.toLowerCase()) {
      throw new Error("Not authorized to cancel this subscription")
    }

    const now = Date.now()

    if (immediate) {
      // Immediate cancellation - downgrade to free tier
      await this.storage.updateSubscription(subscriptionId, {
        state: "canceled",
        tier: "free",
        autoRenew: false,
        canceledAt: now,
        cancellationReason: reason,
        updatedAt: now,
      })
    } else {
      // Cancel at end of period - keep current tier until period ends
      await this.storage.updateSubscription(subscriptionId, {
        autoRenew: false,
        canceledAt: now,
        cancellationReason: reason,
        updatedAt: now,
      })
    }

    // Log audit
    await this.logAudit("subscription_canceled", canceledBy, subscriptionId, {
      toolId: subscription.toolId,
      reason,
      immediate,
    })

    Logger.info(
      `Subscription canceled: ${subscriptionId}${immediate ? " (immediate)" : ""}`
    )

    const updated = await this.storage.getSubscription(subscriptionId)
    return updated!
  }

  /**
   * Pause subscription
   */
  async pauseSubscription(
    subscriptionId: string,
    pausedBy: Address
  ): Promise<Subscription> {
    const subscription = await this.storage.getSubscription(subscriptionId)
    if (!subscription) {
      throw new Error("Subscription not found")
    }

    if (subscription.userId.toLowerCase() !== pausedBy.toLowerCase()) {
      throw new Error("Not authorized to pause this subscription")
    }

    await this.storage.updateSubscription(subscriptionId, {
      state: "paused",
      autoRenew: false,
      updatedAt: Date.now(),
    })

    Logger.info(`Subscription paused: ${subscriptionId}`)

    const updated = await this.storage.getSubscription(subscriptionId)
    return updated!
  }

  /**
   * Resume paused subscription
   */
  async resumeSubscription(
    subscriptionId: string,
    resumedBy: Address
  ): Promise<Subscription> {
    const subscription = await this.storage.getSubscription(subscriptionId)
    if (!subscription) {
      throw new Error("Subscription not found")
    }

    if (subscription.state !== "paused") {
      throw new Error("Subscription is not paused")
    }

    if (subscription.userId.toLowerCase() !== resumedBy.toLowerCase()) {
      throw new Error("Not authorized to resume this subscription")
    }

    const now = Date.now()

    // Check if we need to process payment for new period
    if (subscription.currentPeriodEnd < now) {
      const tier = DEFAULT_TIERS[subscription.tier]
      if (subscription.tier !== "free" && tier.price !== "custom") {
        const paymentResult = await this.processPayment(
          subscription.userId,
          subscription.toolId,
          tier.price,
          subscription.paymentToken,
          subscription.paymentChain
        )

        if (!paymentResult.success) {
          throw new Error(`Payment failed: ${paymentResult.error}`)
        }
      }

      await this.storage.updateSubscription(subscriptionId, {
        state: "active",
        autoRenew: true,
        currentPeriodStart: now,
        currentPeriodEnd: now + SUBSCRIPTION_PERIOD_MS,
        callsUsed: 0,
        lastPaymentAt: subscription.tier !== "free" ? now : subscription.lastPaymentAt,
        failedPayments: 0,
        updatedAt: now,
      })
    } else {
      await this.storage.updateSubscription(subscriptionId, {
        state: "active",
        autoRenew: true,
        updatedAt: now,
      })
    }

    Logger.info(`Subscription resumed: ${subscriptionId}`)

    const updated = await this.storage.getSubscription(subscriptionId)
    return updated!
  }

  /**
   * Process subscription renewal
   */
  async processRenewal(subscriptionId: string): Promise<{
    success: boolean
    error?: string
    newPeriodEnd?: number
  }> {
    const subscription = await this.storage.getSubscription(subscriptionId)
    if (!subscription) {
      return { success: false, error: "Subscription not found" }
    }

    if (!subscription.autoRenew) {
      // Subscription expires
      await this.storage.updateSubscription(subscriptionId, {
        state: "expired",
        tier: "free",
        updatedAt: Date.now(),
      })
      return { success: false, error: "Auto-renew disabled" }
    }

    const tier = DEFAULT_TIERS[subscription.tier]
    const now = Date.now()

    // Free tier doesn't need payment
    if (subscription.tier === "free") {
      await this.storage.updateSubscription(subscriptionId, {
        currentPeriodStart: now,
        currentPeriodEnd: now + SUBSCRIPTION_PERIOD_MS,
        callsUsed: 0,
        updatedAt: now,
      })
      return { success: true, newPeriodEnd: now + SUBSCRIPTION_PERIOD_MS }
    }

    // Enterprise with custom pricing
    if (tier.price === "custom") {
      Logger.warn(`Enterprise subscription ${subscriptionId} needs manual renewal`)
      return { success: false, error: "Manual renewal required for enterprise" }
    }

    // Process payment
    const paymentResult = await this.processPayment(
      subscription.userId,
      subscription.toolId,
      tier.price,
      subscription.paymentToken,
      subscription.paymentChain
    )

    if (paymentResult.success) {
      const newPeriodEnd = now + SUBSCRIPTION_PERIOD_MS
      await this.storage.updateSubscription(subscriptionId, {
        state: "active",
        currentPeriodStart: now,
        currentPeriodEnd: newPeriodEnd,
        callsUsed: 0,
        lastPaymentAt: now,
        lastPaymentAmount: tier.price,
        lastPaymentTxHash: paymentResult.txHash,
        failedPayments: 0,
        updatedAt: now,
      })

      await this.logAudit("subscription_renewed", subscription.userId, subscriptionId, {
        toolId: subscription.toolId,
        amount: tier.price,
        txHash: paymentResult.txHash,
      })

      Logger.info(`Subscription renewed: ${subscriptionId}`)
      return { success: true, newPeriodEnd }
    } else {
      // Payment failed
      const failedPayments = subscription.failedPayments + 1

      if (failedPayments >= MAX_FAILED_PAYMENTS) {
        // Cancel subscription after max failures
        await this.storage.updateSubscription(subscriptionId, {
          state: "canceled",
          tier: "free",
          failedPayments,
          updatedAt: now,
        })

        await this.logAudit("payment_failed", subscription.userId, subscriptionId, {
          toolId: subscription.toolId,
          failedPayments,
          canceled: true,
        })

        Logger.warn(`Subscription canceled due to payment failures: ${subscriptionId}`)
        return { success: false, error: "Max payment failures reached, subscription canceled" }
      } else {
        // Enter grace period
        await this.storage.updateSubscription(subscriptionId, {
          state: "past_due",
          gracePeriodEnd: now + PAYMENT_GRACE_PERIOD_MS,
          failedPayments,
          updatedAt: now,
        })

        await this.logAudit("payment_failed", subscription.userId, subscriptionId, {
          toolId: subscription.toolId,
          failedPayments,
          gracePeriodEnd: now + PAYMENT_GRACE_PERIOD_MS,
        })

        Logger.warn(`Subscription payment failed, grace period started: ${subscriptionId}`)
        return {
          success: false,
          error: `Payment failed (attempt ${failedPayments}/${MAX_FAILED_PAYMENTS})`,
        }
      }
    }
  }

  /**
   * Retry payment for past_due subscription
   */
  async retryPayment(subscriptionId: string): Promise<{
    success: boolean
    error?: string
  }> {
    const subscription = await this.storage.getSubscription(subscriptionId)
    if (!subscription) {
      return { success: false, error: "Subscription not found" }
    }

    if (subscription.state !== "past_due") {
      return { success: false, error: "Subscription is not past due" }
    }

    return this.processRenewal(subscriptionId)
  }

  /**
   * Record usage for a subscription
   */
  async recordUsage(subscriptionId: string, calls: number = 1): Promise<void> {
    const subscription = await this.storage.getSubscription(subscriptionId)
    if (!subscription) {
      return
    }

    await this.storage.updateSubscription(subscriptionId, {
      callsUsed: subscription.callsUsed + calls,
      updatedAt: Date.now(),
    })
  }

  /**
   * Get subscription status summary
   */
  async getSubscriptionStatus(subscriptionId: string): Promise<{
    subscription: Subscription
    daysRemaining: number
    callsRemaining: number
    renewalDate?: number
    estimatedRenewalCost?: string
  } | null> {
    const subscription = await this.storage.getSubscription(subscriptionId)
    if (!subscription) {
      return null
    }

    const now = Date.now()
    const daysRemaining = Math.max(
      0,
      Math.ceil((subscription.currentPeriodEnd - now) / (24 * 60 * 60 * 1000))
    )

    const tier = DEFAULT_TIERS[subscription.tier]
    const monthlyQuota = tier.monthlyQuota
    const callsRemaining = monthlyQuota === -1 ? -1 : Math.max(0, monthlyQuota - subscription.callsUsed)

    return {
      subscription,
      daysRemaining,
      callsRemaining,
      renewalDate: subscription.autoRenew ? subscription.currentPeriodEnd : undefined,
      estimatedRenewalCost: subscription.autoRenew ? tier.price : undefined,
    }
  }

  /**
   * Process subscriptions that need renewal (cron job)
   */
  async processSubscriptionRenewals(): Promise<{
    processed: number
    successful: number
    failed: number
  }> {
    const now = Date.now()
    let processed = 0
    let successful = 0
    let failed = 0

    // In a real implementation, you'd query for subscriptions where
    // currentPeriodEnd < now AND autoRenew = true
    // For MVP, this is a placeholder

    Logger.info(`Subscription renewal batch: ${successful}/${processed} successful`)

    return { processed, successful, failed }
  }

  /**
   * Process payment via x402
   */
  private async processPayment(
    userId: Address,
    toolId: string,
    amount: string,
    token: "USDs" | "USDC",
    chain: string
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    if (this.paymentProcessor) {
      return this.paymentProcessor.processPayment({
        from: userId,
        amount,
        token,
        chain,
        metadata: { toolId, type: "subscription" },
      })
    }

    // Mock payment for MVP
    Logger.debug(
      `Mock payment: ${amount} ${token} from ${userId} on ${chain} for tool ${toolId}`
    )
    return {
      success: true,
      txHash: `0x${randomBytes(32).toString("hex")}`,
    }
  }

  /**
   * Log an audit entry
   */
  private async logAudit(
    action: AuditLogEntry["action"],
    actor: Address,
    target: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    const entry: AuditLogEntry = {
      id: `audit_${randomBytes(16).toString("hex")}`,
      timestamp: Date.now(),
      action,
      actor,
      target,
      targetType: "subscription",
      details,
      success: true,
    }

    await this.storage.saveAuditLog(entry)
  }
}

/**
 * Payment processor interface for x402 integration
 */
export interface PaymentProcessor {
  processPayment(params: {
    from: Address
    amount: string
    token: "USDs" | "USDC"
    chain: string
    metadata?: Record<string, unknown>
  }): Promise<{ success: boolean; txHash?: string; error?: string }>
}

/**
 * Default subscription manager instance
 */
export const subscriptionManager = new SubscriptionManager()

/**
 * Subscription renewal scheduler
 */
export class SubscriptionRenewalScheduler {
  private manager: SubscriptionManager
  private intervalId?: NodeJS.Timeout

  constructor(manager: SubscriptionManager = subscriptionManager) {
    this.manager = manager
  }

  /**
   * Start the renewal scheduler
   */
  start(intervalMs: number = 60 * 60 * 1000): void {
    // Run every hour by default
    this.intervalId = setInterval(async () => {
      try {
        const result = await this.manager.processSubscriptionRenewals()
        Logger.info(
          `Subscription renewal scheduler: ${result.successful}/${result.processed} successful, ${result.failed} failed`
        )
      } catch (error) {
        Logger.error("Subscription renewal scheduler error:", error)
      }
    }, intervalMs)

    Logger.info("Subscription renewal scheduler started")
  }

  /**
   * Stop the renewal scheduler
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = undefined
      Logger.info("Subscription renewal scheduler stopped")
    }
  }
}
