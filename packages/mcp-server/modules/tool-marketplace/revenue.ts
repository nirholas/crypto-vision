/**
 * Revenue Splitter Service
 * @description Handles revenue distribution to tool creators and platform
 * @author nirholas
 * @license Apache-2.0
 */

import type { Address } from "viem"
import { toolRegistry } from "./registry.js"
import type { RegisteredTool, RevenueSplit } from "./types.js"
import Logger from "@/utils/logger.js"

/**
 * Payout record
 */
export interface PayoutRecord {
  id: string
  toolId: string
  recipient: Address
  amount: string
  token: string
  txHash: string
  timestamp: number
  period: {
    start: number
    end: number
  }
}

/**
 * Pending payout calculation
 */
export interface PendingPayout {
  recipient: Address
  label?: string
  amount: string
  percentage: number
}

/**
 * Revenue distribution for a tool
 */
export interface RevenueDistribution {
  toolId: string
  toolName: string
  totalRevenue: string
  periodRevenue: string
  distribution: PendingPayout[]
  platformFee: string
}

// In-memory storage for payout records
const payoutRecords: Map<string, PayoutRecord[]> = new Map()
const platformFeePercent = 5 // 5% platform fee on top of creator split

/**
 * Revenue Splitter Service
 * Calculates and executes revenue distribution for tool creators
 */
export class RevenueSplitterService {
  private platformAddress: Address
  private minPayoutAmount: string
  private payoutToken: "USDs" | "USDC"

  constructor(options?: {
    platformAddress?: Address
    minPayoutAmount?: string
    payoutToken?: "USDs" | "USDC"
  }) {
    this.platformAddress = options?.platformAddress || "0x0000000000000000000000000000000000000000" as Address
    this.minPayoutAmount = options?.minPayoutAmount || "1.00"
    this.payoutToken = options?.payoutToken || "USDs"
  }

  /**
   * Calculate pending payouts for a tool
   */
  async calculatePendingPayouts(toolId: string): Promise<RevenueDistribution> {
    const tool = await toolRegistry.getTool(toolId)
    if (!tool) {
      throw new Error(`Tool not found: ${toolId}`)
    }

    const revenue = await toolRegistry.getToolRevenue(toolId)
    const totalRevenue = parseFloat(revenue.totalRevenue)

    // Calculate already paid out
    const toolPayouts = payoutRecords.get(toolId) || []
    const alreadyPaid = toolPayouts.reduce(
      (sum, p) => sum + parseFloat(p.amount), 0
    )

    // Period revenue is total minus already paid
    const periodRevenue = totalRevenue - alreadyPaid

    // Calculate platform fee
    const platformFee = (periodRevenue * platformFeePercent) / 100
    const distributableRevenue = periodRevenue - platformFee

    // Calculate distribution based on revenue split
    const distribution: PendingPayout[] = tool.revenueSplit.map(split => ({
      recipient: split.address,
      label: split.label,
      amount: ((distributableRevenue * split.percent) / 100).toFixed(6),
      percentage: split.percent,
    }))

    return {
      toolId,
      toolName: tool.name,
      totalRevenue: totalRevenue.toFixed(6),
      periodRevenue: periodRevenue.toFixed(6),
      distribution,
      platformFee: platformFee.toFixed(6),
    }
  }

  /**
   * Calculate pending payouts for a creator across all tools
   */
  async calculateCreatorPayouts(creatorAddress: Address): Promise<{
    totalPending: string
    byTool: Array<{
      toolId: string
      toolName: string
      amount: string
    }>
  }> {
    const tools = await toolRegistry.getToolsByOwner(creatorAddress)
    let totalPending = 0
    const byTool: Array<{ toolId: string; toolName: string; amount: string }> = []

    for (const tool of tools) {
      const distribution = await this.calculatePendingPayouts(tool.toolId)
      
      // Find creator's share
      const creatorShare = distribution.distribution.find(
        d => d.recipient.toLowerCase() === creatorAddress.toLowerCase()
      )

      if (creatorShare) {
        const amount = parseFloat(creatorShare.amount)
        totalPending += amount
        byTool.push({
          toolId: tool.toolId,
          toolName: tool.name,
          amount: amount.toFixed(6),
        })
      }
    }

    return {
      totalPending: totalPending.toFixed(6),
      byTool,
    }
  }

  /**
   * Execute payouts for a tool
   * Returns the payment operations to execute
   */
  async preparePayouts(
    toolId: string,
    options?: { forceAll?: boolean }
  ): Promise<Array<{
    recipient: Address
    amount: string
    label?: string
  }>> {
    const distribution = await this.calculatePendingPayouts(toolId)
    const minAmount = parseFloat(this.minPayoutAmount)

    const payouts: Array<{ recipient: Address; amount: string; label?: string }> = []

    // Add creator payouts
    for (const dist of distribution.distribution) {
      const amount = parseFloat(dist.amount)
      if (options?.forceAll || amount >= minAmount) {
        payouts.push({
          recipient: dist.recipient,
          amount: dist.amount,
          label: dist.label,
        })
      }
    }

    // Add platform fee
    const platformFee = parseFloat(distribution.platformFee)
    if (options?.forceAll || platformFee >= minAmount) {
      payouts.push({
        recipient: this.platformAddress,
        amount: distribution.platformFee,
        label: "platform_fee",
      })
    }

    return payouts
  }

  /**
   * Record a completed payout
   */
  async recordPayout(
    toolId: string,
    recipient: Address,
    amount: string,
    txHash: string,
    periodStart: number,
    periodEnd: number
  ): Promise<PayoutRecord> {
    const record: PayoutRecord = {
      id: `payout_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      toolId,
      recipient,
      amount,
      token: this.payoutToken,
      txHash,
      timestamp: Date.now(),
      period: {
        start: periodStart,
        end: periodEnd,
      },
    }

    const toolPayouts = payoutRecords.get(toolId) || []
    toolPayouts.push(record)
    payoutRecords.set(toolId, toolPayouts)

    Logger.info(`Payout recorded: ${amount} ${this.payoutToken} to ${recipient}`)
    return record
  }

  /**
   * Get payout history for a tool
   */
  async getPayoutHistory(toolId: string): Promise<PayoutRecord[]> {
    return payoutRecords.get(toolId) || []
  }

  /**
   * Get all payouts for a recipient
   */
  async getRecipientPayouts(recipientAddress: Address): Promise<PayoutRecord[]> {
    const allPayouts: PayoutRecord[] = []
    
    for (const records of payoutRecords.values()) {
      allPayouts.push(
        ...records.filter(
          r => r.recipient.toLowerCase() === recipientAddress.toLowerCase()
        )
      )
    }

    return allPayouts.sort((a, b) => b.timestamp - a.timestamp)
  }

  /**
   * Get weekly payout summary
   */
  async getWeeklyPayoutSummary(): Promise<{
    totalPaid: string
    payoutCount: number
    uniqueRecipients: number
    byTool: Array<{ toolId: string; amount: string }>
  }> {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    let totalPaid = 0
    let payoutCount = 0
    const recipients = new Set<string>()
    const byTool: Map<string, number> = new Map()

    for (const [toolId, records] of payoutRecords) {
      for (const record of records) {
        if (record.timestamp > weekAgo) {
          const amount = parseFloat(record.amount)
          totalPaid += amount
          payoutCount++
          recipients.add(record.recipient.toLowerCase())
          
          const toolTotal = byTool.get(toolId) || 0
          byTool.set(toolId, toolTotal + amount)
        }
      }
    }

    return {
      totalPaid: totalPaid.toFixed(6),
      payoutCount,
      uniqueRecipients: recipients.size,
      byTool: Array.from(byTool).map(([toolId, amount]) => ({
        toolId,
        amount: amount.toFixed(6),
      })),
    }
  }
}

// Export singleton instance
export const revenueSplitter = new RevenueSplitterService()
