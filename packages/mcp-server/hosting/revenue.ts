/**
 * Revenue Tracking System for MCP Hosting Platform
 * @description Track payments, calculate revenue, and manage payouts for creators
 * @author nirholas
 * @license Apache-2.0
 *
 * Revenue Model:
 * - Creator gets 85% of tool payment
 * - Platform gets 15% of tool payment
 * - Minimum payout threshold: $10
 */

import Logger from "@/utils/logger.js"
import { PLATFORM_FEE_PERCENTAGE, calculatePayout } from "./types.js"
import type { SupportedChainId } from "@/x402/verify.js"

// ============================================================================
// Type Definitions
// ============================================================================

export type RevenuePeriod = "day" | "week" | "month" | "all"

export interface PaymentRecord {
  id: string
  serverId: string
  toolId: string
  toolName: string
  txHash: string
  amount: string
  amountUSD: number
  creatorAmount: number
  platformAmount: number
  chain: SupportedChainId
  chainName: string
  sender: string
  recipient: string
  status: "pending" | "confirmed" | "paid_out"
  createdAt: Date
  confirmedAt?: Date
  paidOutAt?: Date
}

export interface RevenueStats {
  totalEarnings: number
  creatorEarnings: number
  platformEarnings: number
  pendingPayout: number
  transactionCount: number
  period: RevenuePeriod
  periodStart: Date
  periodEnd: Date
}

export interface ServerRevenue {
  serverId: string
  serverName: string
  totalEarnings: number
  creatorEarnings: number
  transactionCount: number
  topTools: Array<{
    toolId: string
    toolName: string
    earnings: number
    callCount: number
  }>
}

export interface UserRevenue extends RevenueStats {
  userId: string
  servers: ServerRevenue[]
}

export interface PlatformRevenue extends RevenueStats {
  activeServers: number
  activeUsers: number
  topServers: Array<{
    serverId: string
    serverName: string
    earnings: number
  }>
}

export interface PendingPayout {
  userId: string
  email: string
  payoutAddress: string
  pendingAmount: number
  paymentCount: number
  oldestPaymentDate: Date
  canRequestPayout: boolean
  minimumThreshold: number
}

export interface PayoutResult {
  userId: string
  amount: number
  txHash: string
  chain: SupportedChainId
  status: "success" | "failed"
  error?: string
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Minimum payout threshold in USD
 */
export const MINIMUM_PAYOUT_THRESHOLD = 10

/**
 * Chain names for display
 */
const CHAIN_NAMES: Record<SupportedChainId, string> = {
  1: "Ethereum",
  8453: "Base",
  42161: "Arbitrum",
}

// ============================================================================
// In-Memory Storage (Replace with database in production)
// ============================================================================

/**
 * Payment records storage
 * In production, this should be a proper database
 */
const paymentRecords: Map<string, PaymentRecord> = new Map()

/**
 * Server metadata storage
 */
const serverMetadata: Map<string, { name: string; userId: string }> = new Map()

/**
 * User metadata storage
 */
const userMetadata: Map<string, { email: string; payoutAddress: string }> = new Map()

// ============================================================================
// ID Generation
// ============================================================================

/**
 * Generate a unique payment ID
 */
function generatePaymentId(): string {
  return `pay_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
}

// ============================================================================
// Date Utilities
// ============================================================================

/**
 * Get start date for a revenue period
 */
function getPeriodStartDate(period: RevenuePeriod): Date {
  const now = new Date()
  
  switch (period) {
    case "day":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate())
    case "week":
      const dayOfWeek = now.getDay()
      const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
      return new Date(now.setDate(diff))
    case "month":
      return new Date(now.getFullYear(), now.getMonth(), 1)
    case "all":
      return new Date(0)
    default:
      return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  }
}

/**
 * Get end date for a revenue period
 */
function getPeriodEndDate(): Date {
  return new Date()
}

// ============================================================================
// Core Revenue Functions
// ============================================================================

/**
 * Record a payment for a tool call
 */
export async function recordPayment(
  serverId: string,
  toolId: string,
  toolName: string,
  txHash: string,
  amount: string,
  chain: SupportedChainId,
  sender: string,
  recipient: string
): Promise<PaymentRecord> {
  const amountUSD = parseFloat(amount)
  const { creatorAmount, platformAmount } = calculatePayout(amountUSD)
  
  const record: PaymentRecord = {
    id: generatePaymentId(),
    serverId,
    toolId,
    toolName,
    txHash,
    amount,
    amountUSD,
    creatorAmount,
    platformAmount,
    chain,
    chainName: CHAIN_NAMES[chain] || `Chain ${chain}`,
    sender,
    recipient,
    status: "confirmed",
    createdAt: new Date(),
    confirmedAt: new Date(),
  }
  
  paymentRecords.set(record.id, record)
  
  Logger.info(
    `Revenue: Recorded payment ${record.id} - ` +
    `$${amountUSD.toFixed(4)} for ${toolName} (Creator: $${creatorAmount.toFixed(4)}, Platform: $${platformAmount.toFixed(4)})`
  )
  
  return record
}

/**
 * Get revenue statistics for a specific server
 */
export async function getServerRevenue(
  serverId: string,
  period: RevenuePeriod = "month"
): Promise<ServerRevenue> {
  const periodStart = getPeriodStartDate(period)
  const metadata = serverMetadata.get(serverId) || { name: serverId, userId: "" }
  
  // Filter payments for this server and period
  const serverPayments = Array.from(paymentRecords.values()).filter(
    (p) => p.serverId === serverId && p.createdAt >= periodStart
  )
  
  // Aggregate by tool
  const toolAggregates = new Map<
    string,
    { toolId: string; toolName: string; earnings: number; callCount: number }
  >()
  
  let totalEarnings = 0
  let creatorEarnings = 0
  
  for (const payment of serverPayments) {
    totalEarnings += payment.amountUSD
    creatorEarnings += payment.creatorAmount
    
    const existing = toolAggregates.get(payment.toolId) || {
      toolId: payment.toolId,
      toolName: payment.toolName,
      earnings: 0,
      callCount: 0,
    }
    
    existing.earnings += payment.creatorAmount
    existing.callCount++
    toolAggregates.set(payment.toolId, existing)
  }
  
  // Sort tools by earnings
  const topTools = Array.from(toolAggregates.values())
    .sort((a, b) => b.earnings - a.earnings)
    .slice(0, 10)
  
  return {
    serverId,
    serverName: metadata.name,
    totalEarnings,
    creatorEarnings,
    transactionCount: serverPayments.length,
    topTools,
  }
}

/**
 * Get revenue statistics for a user across all their servers
 */
export async function getUserRevenue(
  userId: string,
  period: RevenuePeriod = "month"
): Promise<UserRevenue> {
  const periodStart = getPeriodStartDate(period)
  const periodEnd = getPeriodEndDate()
  
  // Find all servers belonging to this user
  const userServers = Array.from(serverMetadata.entries())
    .filter(([_, meta]) => meta.userId === userId)
    .map(([serverId]) => serverId)
  
  // Filter payments for user's servers and period
  const userPayments = Array.from(paymentRecords.values()).filter(
    (p) => userServers.includes(p.serverId) && p.createdAt >= periodStart
  )
  
  // Calculate totals
  let totalEarnings = 0
  let creatorEarnings = 0
  let platformEarnings = 0
  let pendingPayout = 0
  
  for (const payment of userPayments) {
    totalEarnings += payment.amountUSD
    creatorEarnings += payment.creatorAmount
    platformEarnings += payment.platformAmount
    
    if (payment.status === "confirmed") {
      pendingPayout += payment.creatorAmount
    }
  }
  
  // Get per-server revenue
  const servers = await Promise.all(
    userServers.map((serverId) => getServerRevenue(serverId, period))
  )
  
  return {
    userId,
    totalEarnings,
    creatorEarnings,
    platformEarnings,
    pendingPayout,
    transactionCount: userPayments.length,
    period,
    periodStart,
    periodEnd,
    servers,
  }
}

/**
 * Get platform-wide revenue statistics (admin only)
 */
export async function getPlatformRevenue(
  period: RevenuePeriod = "month"
): Promise<PlatformRevenue> {
  const periodStart = getPeriodStartDate(period)
  const periodEnd = getPeriodEndDate()
  
  // Filter payments for period
  const periodPayments = Array.from(paymentRecords.values()).filter(
    (p) => p.createdAt >= periodStart
  )
  
  // Calculate totals
  let totalEarnings = 0
  let creatorEarnings = 0
  let platformEarnings = 0
  let pendingPayout = 0
  
  const serverEarnings = new Map<string, number>()
  const activeUsers = new Set<string>()
  
  for (const payment of periodPayments) {
    totalEarnings += payment.amountUSD
    creatorEarnings += payment.creatorAmount
    platformEarnings += payment.platformAmount
    
    if (payment.status === "confirmed") {
      pendingPayout += payment.creatorAmount
    }
    
    // Track per-server earnings
    const current = serverEarnings.get(payment.serverId) || 0
    serverEarnings.set(payment.serverId, current + payment.amountUSD)
    
    // Track active users
    const serverMeta = serverMetadata.get(payment.serverId)
    if (serverMeta) {
      activeUsers.add(serverMeta.userId)
    }
  }
  
  // Get top servers by earnings
  const topServers = Array.from(serverEarnings.entries())
    .map(([serverId, earnings]) => ({
      serverId,
      serverName: serverMetadata.get(serverId)?.name || serverId,
      earnings,
    }))
    .sort((a, b) => b.earnings - a.earnings)
    .slice(0, 10)
  
  return {
    totalEarnings,
    creatorEarnings,
    platformEarnings,
    pendingPayout,
    transactionCount: periodPayments.length,
    period,
    periodStart,
    periodEnd,
    activeServers: serverEarnings.size,
    activeUsers: activeUsers.size,
    topServers,
  }
}

/**
 * Get list of pending payouts for all creators
 */
export async function getPendingPayouts(): Promise<PendingPayout[]> {
  // Group confirmed payments by user
  const userPayouts = new Map<
    string,
    {
      pendingAmount: number
      paymentCount: number
      oldestPaymentDate: Date
    }
  >()
  
  for (const payment of paymentRecords.values()) {
    if (payment.status !== "confirmed") continue
    
    const serverMeta = serverMetadata.get(payment.serverId)
    if (!serverMeta) continue
    
    const userId = serverMeta.userId
    const existing = userPayouts.get(userId) || {
      pendingAmount: 0,
      paymentCount: 0,
      oldestPaymentDate: new Date(),
    }
    
    existing.pendingAmount += payment.creatorAmount
    existing.paymentCount++
    
    if (payment.createdAt < existing.oldestPaymentDate) {
      existing.oldestPaymentDate = payment.createdAt
    }
    
    userPayouts.set(userId, existing)
  }
  
  // Convert to array with user metadata
  const pendingPayouts: PendingPayout[] = []
  
  for (const [userId, data] of userPayouts.entries()) {
    const userMeta = userMetadata.get(userId) || {
      email: "",
      payoutAddress: "",
    }
    
    pendingPayouts.push({
      userId,
      email: userMeta.email,
      payoutAddress: userMeta.payoutAddress,
      pendingAmount: data.pendingAmount,
      paymentCount: data.paymentCount,
      oldestPaymentDate: data.oldestPaymentDate,
      canRequestPayout: data.pendingAmount >= MINIMUM_PAYOUT_THRESHOLD,
      minimumThreshold: MINIMUM_PAYOUT_THRESHOLD,
    })
  }
  
  // Sort by pending amount descending
  return pendingPayouts.sort((a, b) => b.pendingAmount - a.pendingAmount)
}

/**
 * Process payouts for creators (batch send to creators)
 * Note: This is a placeholder - actual implementation would use a wallet/signer
 */
export async function processPayouts(
  userIds?: string[],
  chain: SupportedChainId = 8453 // Default to Base
): Promise<PayoutResult[]> {
  const pendingPayouts = await getPendingPayouts()
  
  // Filter by user IDs if provided
  const payoutsToProcess = userIds
    ? pendingPayouts.filter((p) => userIds.includes(p.userId))
    : pendingPayouts.filter((p) => p.canRequestPayout)
  
  const results: PayoutResult[] = []
  
  for (const payout of payoutsToProcess) {
    try {
      // Check if user has a payout address
      if (!payout.payoutAddress) {
        results.push({
          userId: payout.userId,
          amount: payout.pendingAmount,
          txHash: "",
          chain,
          status: "failed",
          error: "No payout address configured",
        })
        continue
      }
      
      // Check minimum threshold
      if (!payout.canRequestPayout) {
        results.push({
          userId: payout.userId,
          amount: payout.pendingAmount,
          txHash: "",
          chain,
          status: "failed",
          error: `Below minimum threshold of $${MINIMUM_PAYOUT_THRESHOLD}`,
        })
        continue
      }
      
      // TODO: Implement actual USDC transfer
      // This would require a signer/wallet and proper transaction handling
      // For now, we'll mark payments as paid out without sending
      
      Logger.warn(
        `Revenue: Payout processing not fully implemented. ` +
        `Would send $${payout.pendingAmount.toFixed(2)} to ${payout.payoutAddress}`
      )
      
      // Mark payments as paid out
      for (const payment of paymentRecords.values()) {
        const serverMeta = serverMetadata.get(payment.serverId)
        if (
          serverMeta?.userId === payout.userId &&
          payment.status === "confirmed"
        ) {
          payment.status = "paid_out"
          payment.paidOutAt = new Date()
        }
      }
      
      results.push({
        userId: payout.userId,
        amount: payout.pendingAmount,
        txHash: "0x" + "0".repeat(64), // Placeholder
        chain,
        status: "success",
      })
      
      Logger.info(
        `Revenue: Processed payout for user ${payout.userId} - $${payout.pendingAmount.toFixed(2)}`
      )
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      results.push({
        userId: payout.userId,
        amount: payout.pendingAmount,
        txHash: "",
        chain,
        status: "failed",
        error: errorMessage,
      })
      
      Logger.error(`Revenue: Failed to process payout for ${payout.userId}: ${errorMessage}`)
    }
  }
  
  return results
}

// ============================================================================
// Transaction History
// ============================================================================

export interface TransactionHistoryOptions {
  userId?: string
  serverId?: string
  toolId?: string
  period?: RevenuePeriod
  status?: PaymentRecord["status"]
  page?: number
  pageSize?: number
}

export interface TransactionHistoryResult {
  transactions: PaymentRecord[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

/**
 * Get transaction history with filtering and pagination
 */
export async function getTransactionHistory(
  options: TransactionHistoryOptions = {}
): Promise<TransactionHistoryResult> {
  const {
    userId,
    serverId,
    toolId,
    period = "month",
    status,
    page = 1,
    pageSize = 20,
  } = options
  
  const periodStart = getPeriodStartDate(period)
  
  // Get user's servers if filtering by user
  let userServers: string[] | null = null
  if (userId) {
    userServers = Array.from(serverMetadata.entries())
      .filter(([_, meta]) => meta.userId === userId)
      .map(([serverId]) => serverId)
  }
  
  // Filter transactions
  let transactions = Array.from(paymentRecords.values()).filter((p) => {
    if (p.createdAt < periodStart) return false
    if (serverId && p.serverId !== serverId) return false
    if (toolId && p.toolId !== toolId) return false
    if (status && p.status !== status) return false
    if (userServers && !userServers.includes(p.serverId)) return false
    return true
  })
  
  // Sort by date descending
  transactions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  
  const total = transactions.length
  const start = (page - 1) * pageSize
  const end = start + pageSize
  
  return {
    transactions: transactions.slice(start, end),
    total,
    page,
    pageSize,
    hasMore: end < total,
  }
}

// ============================================================================
// Metadata Management
// ============================================================================

/**
 * Register a server with its metadata
 */
export function registerServer(
  serverId: string,
  name: string,
  userId: string
): void {
  serverMetadata.set(serverId, { name, userId })
}

/**
 * Register a user with their metadata
 */
export function registerUser(
  userId: string,
  email: string,
  payoutAddress: string
): void {
  userMetadata.set(userId, { email, payoutAddress })
}

/**
 * Update user payout address
 */
export function updatePayoutAddress(
  userId: string,
  payoutAddress: string
): void {
  const existing = userMetadata.get(userId)
  if (existing) {
    userMetadata.set(userId, { ...existing, payoutAddress })
  }
}

// ============================================================================
// Statistics
// ============================================================================

/**
 * Get revenue statistics summary
 */
export async function getRevenueStats(): Promise<{
  totalPayments: number
  totalVolume: number
  totalPlatformFees: number
  pendingPayouts: number
}> {
  let totalVolume = 0
  let totalPlatformFees = 0
  let pendingPayouts = 0
  
  for (const payment of paymentRecords.values()) {
    totalVolume += payment.amountUSD
    totalPlatformFees += payment.platformAmount
    
    if (payment.status === "confirmed") {
      pendingPayouts += payment.creatorAmount
    }
  }
  
  return {
    totalPayments: paymentRecords.size,
    totalVolume,
    totalPlatformFees,
    pendingPayouts,
  }
}

// ============================================================================
// Exports
// ============================================================================

export default {
  recordPayment,
  getServerRevenue,
  getUserRevenue,
  getPlatformRevenue,
  getPendingPayouts,
  processPayouts,
  getTransactionHistory,
  registerServer,
  registerUser,
  updatePayoutAddress,
  getRevenueStats,
  MINIMUM_PAYOUT_THRESHOLD,
  PLATFORM_FEE_PERCENTAGE,
}
