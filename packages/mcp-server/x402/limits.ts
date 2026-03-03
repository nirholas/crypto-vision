/**
 * x402 Payment Limits
 * @description Payment limits and allowlist management for x402 protocol
 * @author nirholas
 * @license Apache-2.0
 *
 * SECURITY: This module enforces payment limits to prevent:
 * - Accidental large payments
 * - Runaway spending by AI agents
 * - Payments to untrusted services
 */

import Logger from "@/utils/logger.js"
import { logSecurityEvent } from "./security.js"

// ============================================================================
// Payment Limit Configuration
// ============================================================================

/**
 * Default payment limits (in USD)
 * These are intentionally conservative
 */
export const DEFAULT_LIMITS = {
  /** Maximum single payment (default $1.00) */
  MAX_SINGLE_PAYMENT: 1.0,
  /** Maximum daily spending (default $10.00) */
  MAX_DAILY_PAYMENT: 10.0,
  /** Warning threshold for large payments */
  LARGE_PAYMENT_WARNING: 0.5,
  /** Absolute maximum single payment (hard cap) */
  ABSOLUTE_MAX_SINGLE: 100.0,
  /** Absolute maximum daily spending (hard cap) */
  ABSOLUTE_MAX_DAILY: 1000.0,
} as const

/**
 * Current payment limits
 */
export interface PaymentLimits {
  maxSinglePayment: number
  maxDailyPayment: number
  largePaymentWarning: number
}

let currentLimits: PaymentLimits = {
  maxSinglePayment: DEFAULT_LIMITS.MAX_SINGLE_PAYMENT,
  maxDailyPayment: DEFAULT_LIMITS.MAX_DAILY_PAYMENT,
  largePaymentWarning: DEFAULT_LIMITS.LARGE_PAYMENT_WARNING,
}

/**
 * Load limits from environment variables
 */
export function loadLimitsFromEnv(): PaymentLimits {
  const envMax = parseFloat(process.env.X402_MAX_PAYMENT || "")
  const envDaily = parseFloat(process.env.X402_MAX_DAILY || "")
  const envWarning = parseFloat(process.env.X402_LARGE_PAYMENT_WARNING || "")

  if (!isNaN(envMax) && envMax > 0) {
    currentLimits.maxSinglePayment = Math.min(envMax, DEFAULT_LIMITS.ABSOLUTE_MAX_SINGLE)
  }
  if (!isNaN(envDaily) && envDaily > 0) {
    currentLimits.maxDailyPayment = Math.min(envDaily, DEFAULT_LIMITS.ABSOLUTE_MAX_DAILY)
  }
  if (!isNaN(envWarning) && envWarning > 0) {
    currentLimits.largePaymentWarning = envWarning
  }

  Logger.debug(`x402 Limits: max single=$${currentLimits.maxSinglePayment}, max daily=$${currentLimits.maxDailyPayment}`)

  return currentLimits
}

/**
 * Get current payment limits
 */
export function getPaymentLimits(): PaymentLimits {
  return { ...currentLimits }
}

/**
 * Set payment limits programmatically
 * @param limits - New limits to set
 * @returns Updated limits
 */
export function setPaymentLimits(limits: Partial<PaymentLimits>): PaymentLimits {
  const oldLimits = { ...currentLimits }

  if (limits.maxSinglePayment !== undefined) {
    if (limits.maxSinglePayment <= 0) {
      throw new Error("maxSinglePayment must be positive")
    }
    if (limits.maxSinglePayment > DEFAULT_LIMITS.ABSOLUTE_MAX_SINGLE) {
      throw new Error(`maxSinglePayment cannot exceed $${DEFAULT_LIMITS.ABSOLUTE_MAX_SINGLE}`)
    }
    currentLimits.maxSinglePayment = limits.maxSinglePayment
  }

  if (limits.maxDailyPayment !== undefined) {
    if (limits.maxDailyPayment <= 0) {
      throw new Error("maxDailyPayment must be positive")
    }
    if (limits.maxDailyPayment > DEFAULT_LIMITS.ABSOLUTE_MAX_DAILY) {
      throw new Error(`maxDailyPayment cannot exceed $${DEFAULT_LIMITS.ABSOLUTE_MAX_DAILY}`)
    }
    currentLimits.maxDailyPayment = limits.maxDailyPayment
  }

  if (limits.largePaymentWarning !== undefined) {
    if (limits.largePaymentWarning <= 0) {
      throw new Error("largePaymentWarning must be positive")
    }
    currentLimits.largePaymentWarning = limits.largePaymentWarning
  }

  logSecurityEvent("config_changed", {
    type: "payment_limits",
    old: oldLimits,
    new: currentLimits,
  }, "info")

  return { ...currentLimits }
}

// ============================================================================
// Daily Spending Tracker
// ============================================================================

interface DailySpending {
  date: string // YYYY-MM-DD
  total: number
  payments: Array<{
    amount: number
    recipient: string
    service: string
    timestamp: Date
  }>
}

let dailySpending: DailySpending = {
  date: getTodayDate(),
  total: 0,
  payments: [],
}

function getTodayDate(): string {
  return new Date().toISOString().split("T")[0]
}

/**
 * Reset daily spending if it's a new day
 */
function ensureCurrentDay(): void {
  const today = getTodayDate()
  if (dailySpending.date !== today) {
    Logger.debug(`x402 Limits: New day, resetting daily spending tracker`)
    dailySpending = {
      date: today,
      total: 0,
      payments: [],
    }
  }
}

/**
 * Get current daily spending
 */
export function getDailySpending(): { date: string; total: number; remaining: number; count: number } {
  ensureCurrentDay()
  return {
    date: dailySpending.date,
    total: dailySpending.total,
    remaining: Math.max(0, currentLimits.maxDailyPayment - dailySpending.total),
    count: dailySpending.payments.length,
  }
}

/**
 * Record a payment for daily tracking
 */
export function recordPayment(
  amount: number,
  recipient: string,
  service: string
): void {
  ensureCurrentDay()
  dailySpending.total += amount
  dailySpending.payments.push({
    amount,
    recipient,
    service,
    timestamp: new Date(),
  })
}

/**
 * Get payment history for today
 */
export function getTodayPayments(): DailySpending["payments"] {
  ensureCurrentDay()
  return [...dailySpending.payments]
}

// ============================================================================
// Payment Validation
// ============================================================================

export interface PaymentValidationResult {
  allowed: boolean
  requiresApproval: boolean
  warnings: string[]
  errors: string[]
}

/**
 * Validate a payment against limits
 */
export function validatePaymentLimits(
  amount: number,
  recipient: string,
  service: string
): PaymentValidationResult {
  const result: PaymentValidationResult = {
    allowed: true,
    requiresApproval: false,
    warnings: [],
    errors: [],
  }

  ensureCurrentDay()

  // Check single payment limit
  if (amount > currentLimits.maxSinglePayment) {
    result.allowed = false
    result.errors.push(
      `Payment of $${amount.toFixed(2)} exceeds max single payment of $${currentLimits.maxSinglePayment.toFixed(2)}`
    )
    logSecurityEvent("payment_limit_exceeded", {
      amount,
      limit: currentLimits.maxSinglePayment,
      recipient,
      service,
    }, "warning")
  }

  // Check daily limit
  const projectedDaily = dailySpending.total + amount
  if (projectedDaily > currentLimits.maxDailyPayment) {
    result.allowed = false
    result.errors.push(
      `Payment would exceed daily limit. Today's spending: $${dailySpending.total.toFixed(2)}, limit: $${currentLimits.maxDailyPayment.toFixed(2)}`
    )
    logSecurityEvent("daily_limit_exceeded", {
      amount,
      dailyTotal: dailySpending.total,
      limit: currentLimits.maxDailyPayment,
      recipient,
      service,
    }, "warning")
  }

  // Check large payment warning
  if (amount >= currentLimits.largePaymentWarning) {
    result.requiresApproval = true
    result.warnings.push(
      `Large payment of $${amount.toFixed(2)} - consider manual approval`
    )
    logSecurityEvent("large_payment_warning", {
      amount,
      threshold: currentLimits.largePaymentWarning,
      recipient,
      service,
    }, "info")
  }

  // Check service allowlist
  const serviceCheck = isServiceApproved(service)
  if (!serviceCheck.approved && !serviceCheck.allowUnknown) {
    result.allowed = false
    result.errors.push(`Service "${service}" is not in the approved list`)
    logSecurityEvent("untrusted_service", {
      service,
      recipient,
      amount,
    }, "warning")
  } else if (!serviceCheck.approved) {
    result.warnings.push(`Service "${service}" is not in the approved list (unknown services allowed)`)
  }

  return result
}

// ============================================================================
// Service Allowlist
// ============================================================================

interface ApprovedService {
  domain: string
  name: string
  maxPayment?: number
  addedAt: Date
  addedBy?: string
}

const approvedServices: Map<string, ApprovedService> = new Map()

/**
 * Default trusted services (well-known x402 providers)
 */
const DEFAULT_APPROVED_SERVICES: ApprovedService[] = [
  // Add known trusted x402 services here
]

/**
 * Allow unknown services by default?
 * Set to false for strict allowlist mode
 */
let allowUnknownServices = true

/**
 * Initialize service allowlist from environment
 */
export function initializeAllowlist(): void {
  // Load default services
  for (const service of DEFAULT_APPROVED_SERVICES) {
    approvedServices.set(service.domain, service)
  }

  // Load from environment (comma-separated domains)
  const envServices = process.env.X402_APPROVED_SERVICES
  if (envServices) {
    const domains = envServices.split(",").map((d) => d.trim())
    for (const domain of domains) {
      if (domain) {
        approvedServices.set(domain, {
          domain,
          name: domain,
          addedAt: new Date(),
          addedBy: "environment",
        })
      }
    }
  }

  // Check for strict mode
  allowUnknownServices = process.env.X402_STRICT_ALLOWLIST !== "true"

  Logger.debug(
    `x402 Allowlist: ${approvedServices.size} approved services, strict mode: ${!allowUnknownServices}`
  )
}

/**
 * Check if a service is approved
 */
export function isServiceApproved(
  serviceUrl: string
): { approved: boolean; service?: ApprovedService; allowUnknown: boolean } {
  try {
    const url = new URL(serviceUrl)
    const domain = url.hostname

    const service = approvedServices.get(domain)
    if (service) {
      return { approved: true, service, allowUnknown: allowUnknownServices }
    }

    // Check for wildcard subdomain matches
    const parts = domain.split(".")
    for (let i = 1; i < parts.length; i++) {
      const wildcard = "*." + parts.slice(i).join(".")
      const wildcardService = approvedServices.get(wildcard)
      if (wildcardService) {
        return { approved: true, service: wildcardService, allowUnknown: allowUnknownServices }
      }
    }

    return { approved: false, allowUnknown: allowUnknownServices }
  } catch {
    // Invalid URL
    return { approved: false, allowUnknown: allowUnknownServices }
  }
}

/**
 * Approve a service
 */
export function approveService(
  domain: string,
  name?: string,
  maxPayment?: number
): ApprovedService {
  const service: ApprovedService = {
    domain: domain.toLowerCase(),
    name: name || domain,
    maxPayment,
    addedAt: new Date(),
  }

  approvedServices.set(service.domain, service)

  logSecurityEvent("config_changed", {
    type: "service_approved",
    domain: service.domain,
    name: service.name,
    maxPayment: service.maxPayment,
  }, "info")

  Logger.info(`x402 Allowlist: Approved service ${service.domain}`)

  return service
}

/**
 * Remove a service from allowlist
 */
export function removeService(domain: string): boolean {
  const removed = approvedServices.delete(domain.toLowerCase())
  if (removed) {
    logSecurityEvent("config_changed", {
      type: "service_removed",
      domain,
    }, "info")
  }
  return removed
}

/**
 * Get all approved services
 */
export function getApprovedServices(): ApprovedService[] {
  return Array.from(approvedServices.values())
}

/**
 * Set strict allowlist mode
 */
export function setStrictAllowlistMode(strict: boolean): void {
  const wasStrict = !allowUnknownServices
  allowUnknownServices = !strict

  logSecurityEvent("config_changed", {
    type: "strict_mode_changed",
    from: wasStrict,
    to: strict,
  }, "info")

  Logger.info(`x402 Allowlist: Strict mode ${strict ? "enabled" : "disabled"}`)
}

/**
 * Check if in strict allowlist mode
 */
export function isStrictAllowlistMode(): boolean {
  return !allowUnknownServices
}

// ============================================================================
// Payment History
// ============================================================================

interface PaymentHistoryEntry {
  id: string
  timestamp: Date
  amount: number
  token: string
  recipient: string
  service: string
  txHash?: string
  status: "pending" | "completed" | "failed"
  chain: string
  gasless: boolean
}

const paymentHistory: PaymentHistoryEntry[] = []
const MAX_HISTORY_ENTRIES = 10000

/**
 * Add a payment to history
 */
export function addToPaymentHistory(entry: Omit<PaymentHistoryEntry, "id">): string {
  const id = `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  const fullEntry: PaymentHistoryEntry = {
    ...entry,
    id,
  }

  paymentHistory.push(fullEntry)

  // Limit stored history
  if (paymentHistory.length > MAX_HISTORY_ENTRIES) {
    paymentHistory.shift()
  }

  return id
}

/**
 * Update payment status
 */
export function updatePaymentStatus(
  id: string,
  status: PaymentHistoryEntry["status"],
  txHash?: string
): boolean {
  const entry = paymentHistory.find((p) => p.id === id)
  if (entry) {
    entry.status = status
    if (txHash) {
      entry.txHash = txHash
    }
    return true
  }
  return false
}

/**
 * Get payment history
 */
export function getPaymentHistory(options?: {
  limit?: number
  since?: Date
  service?: string
  status?: PaymentHistoryEntry["status"]
}): PaymentHistoryEntry[] {
  let result = [...paymentHistory].reverse()

  if (options?.since) {
    result = result.filter((p) => p.timestamp >= options.since!)
  }
  if (options?.service) {
    result = result.filter((p) => p.service.includes(options.service!))
  }
  if (options?.status) {
    result = result.filter((p) => p.status === options.status)
  }

  return result.slice(0, options?.limit || 100)
}

/**
 * Get payment statistics
 */
export function getPaymentStats(since?: Date): {
  total: number
  count: number
  avgAmount: number
  byService: Record<string, { count: number; total: number }>
  byStatus: Record<string, number>
} {
  let payments = [...paymentHistory]
  if (since) {
    payments = payments.filter((p) => p.timestamp >= since)
  }

  const byService: Record<string, { count: number; total: number }> = {}
  const byStatus: Record<string, number> = {}
  let total = 0

  for (const payment of payments) {
    total += payment.amount

    if (!byService[payment.service]) {
      byService[payment.service] = { count: 0, total: 0 }
    }
    byService[payment.service].count++
    byService[payment.service].total += payment.amount

    byStatus[payment.status] = (byStatus[payment.status] || 0) + 1
  }

  return {
    total,
    count: payments.length,
    avgAmount: payments.length > 0 ? total / payments.length : 0,
    byService,
    byStatus,
  }
}

// Initialize on module load
loadLimitsFromEnv()
initializeAllowlist()
