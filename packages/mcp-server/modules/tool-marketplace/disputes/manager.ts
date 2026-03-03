/**
 * Dispute Manager Service
 * @description Manages payment disputes between users and tool owners
 * @author nirholas
 * @license Apache-2.0
 */

import Logger from "@/utils/logger.js"
import type { Address } from "viem"
import type {
  Dispute,
  DisputeState,
  DisputeOutcome,
  DisputeEvidence,
  DisputeReason,
  CreateDisputeInput,
  DisputeFilter,
  DisputeStats,
  UserDisputeLimits,
  EvidenceType,
} from "./types.js"

/**
 * Configuration for dispute management
 */
export interface DisputeManagerConfig {
  /** Time window to open dispute after payment (ms) - default 24 hours */
  disputeWindow: number
  /** Maximum open disputes per user */
  maxOpenDisputesPerUser: number
  /** Dispute expiry time (ms) - default 7 days */
  disputeExpiryTime: number
  /** Cooldown after opening a dispute (ms) - default 1 hour */
  disputeCooldown: number
}

const DEFAULT_CONFIG: DisputeManagerConfig = {
  disputeWindow: 24 * 60 * 60 * 1000, // 24 hours
  maxOpenDisputesPerUser: 3,
  disputeExpiryTime: 7 * 24 * 60 * 60 * 1000, // 7 days
  disputeCooldown: 60 * 60 * 1000, // 1 hour
}

/**
 * Generate unique ID
 */
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * In-memory storage for disputes
 */
interface DisputeStorage {
  disputes: Map<string, Dispute>
  disputesByUser: Map<string, string[]>
  disputesByTool: Map<string, string[]>
  disputesByToolOwner: Map<string, string[]>
  paymentDisputes: Map<string, string> // txHash -> disputeId
  userCooldowns: Map<string, number>
}

const storage: DisputeStorage = {
  disputes: new Map(),
  disputesByUser: new Map(),
  disputesByTool: new Map(),
  disputesByToolOwner: new Map(),
  paymentDisputes: new Map(),
  userCooldowns: new Map(),
}

/**
 * Dispute Manager Service
 * Handles creation, management, and resolution of payment disputes
 */
export class DisputeManager {
  private config: DisputeManagerConfig

  constructor(config: Partial<DisputeManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Open a new dispute
   */
  async openDispute(
    input: CreateDisputeInput,
    toolOwnerAddress: Address
  ): Promise<Dispute> {
    // Check if user can open dispute
    const limits = this.getUserLimits(input.userAddress)
    if (!limits.canOpenDispute) {
      throw new Error(limits.reason || "Cannot open dispute at this time")
    }

    // Check if payment already disputed
    if (storage.paymentDisputes.has(input.paymentTxHash)) {
      throw new Error("This payment has already been disputed")
    }

    // Create evidence list
    const evidence: DisputeEvidence[] = (input.evidence || []).map((e) => ({
      id: generateId("evidence"),
      type: e.type,
      content: e.content,
      description: e.description,
      submittedBy: input.userAddress,
      submittedAt: Date.now(),
    }))

    // Create dispute
    const dispute: Dispute = {
      id: generateId("dispute"),
      toolId: input.toolId,
      userAddress: input.userAddress,
      toolOwnerAddress,
      paymentTxHash: input.paymentTxHash,
      paymentAmount: input.paymentAmount,
      paymentToken: input.paymentToken,
      reason: input.reason,
      description: input.description,
      evidence,
      state: "open",
      outcome: "pending",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      autoResolved: false,
    }

    // Store dispute
    storage.disputes.set(dispute.id, dispute)
    storage.paymentDisputes.set(input.paymentTxHash, dispute.id)

    // Update user disputes index
    const userDisputes = storage.disputesByUser.get(input.userAddress) || []
    userDisputes.push(dispute.id)
    storage.disputesByUser.set(input.userAddress, userDisputes)

    // Update tool disputes index
    const toolDisputes = storage.disputesByTool.get(input.toolId) || []
    toolDisputes.push(dispute.id)
    storage.disputesByTool.set(input.toolId, toolDisputes)

    // Update tool owner disputes index
    const ownerDisputes = storage.disputesByToolOwner.get(toolOwnerAddress) || []
    ownerDisputes.push(dispute.id)
    storage.disputesByToolOwner.set(toolOwnerAddress, ownerDisputes)

    // Set user cooldown
    storage.userCooldowns.set(input.userAddress, Date.now() + this.config.disputeCooldown)

    Logger.info(`Dispute opened: ${dispute.id} for tool ${input.toolId}`)

    return dispute
  }

  /**
   * Get dispute by ID
   */
  getDispute(disputeId: string): Dispute | null {
    return storage.disputes.get(disputeId) || null
  }

  /**
   * Get disputes with filters
   */
  getDisputes(filter: DisputeFilter = {}): Dispute[] {
    let disputes = Array.from(storage.disputes.values())

    // Apply filters
    if (filter.state) {
      disputes = disputes.filter((d) => d.state === filter.state)
    }
    if (filter.toolId) {
      disputes = disputes.filter((d) => d.toolId === filter.toolId)
    }
    if (filter.userAddress) {
      disputes = disputes.filter(
        (d) => d.userAddress.toLowerCase() === filter.userAddress!.toLowerCase()
      )
    }
    if (filter.toolOwnerAddress) {
      disputes = disputes.filter(
        (d) => d.toolOwnerAddress.toLowerCase() === filter.toolOwnerAddress!.toLowerCase()
      )
    }
    if (filter.createdAfter) {
      disputes = disputes.filter((d) => d.createdAt > filter.createdAfter!)
    }
    if (filter.createdBefore) {
      disputes = disputes.filter((d) => d.createdAt < filter.createdBefore!)
    }

    // Sort by creation date (newest first)
    disputes.sort((a, b) => b.createdAt - a.createdAt)

    // Apply pagination
    const offset = filter.offset || 0
    const limit = filter.limit || 50
    return disputes.slice(offset, offset + limit)
  }

  /**
   * Get user's disputes
   */
  getUserDisputes(userAddress: Address): Dispute[] {
    const disputeIds = storage.disputesByUser.get(userAddress) || []
    return disputeIds
      .map((id) => storage.disputes.get(id))
      .filter((d): d is Dispute => d !== undefined)
      .sort((a, b) => b.createdAt - a.createdAt)
  }

  /**
   * Get disputes for a tool
   */
  getToolDisputes(toolId: string): Dispute[] {
    const disputeIds = storage.disputesByTool.get(toolId) || []
    return disputeIds
      .map((id) => storage.disputes.get(id))
      .filter((d): d is Dispute => d !== undefined)
      .sort((a, b) => b.createdAt - a.createdAt)
  }

  /**
   * Get user dispute limits
   */
  getUserLimits(userAddress: Address): UserDisputeLimits {
    const userDisputes = storage.disputesByUser.get(userAddress) || []
    const openDisputes = userDisputes
      .map((id) => storage.disputes.get(id))
      .filter((d): d is Dispute => d !== undefined)
      .filter((d) => d.state === "open" || d.state === "under_review" || d.state === "escalated")

    const cooldownEnd = storage.userCooldowns.get(userAddress)
    const inCooldown = cooldownEnd && Date.now() < cooldownEnd

    let canOpenDispute = true
    let reason: string | undefined

    if (openDisputes.length >= this.config.maxOpenDisputesPerUser) {
      canOpenDispute = false
      reason = `Maximum open disputes (${this.config.maxOpenDisputesPerUser}) reached`
    } else if (inCooldown) {
      canOpenDispute = false
      reason = "Cooldown period active"
    }

    return {
      userAddress,
      openDisputes: openDisputes.length,
      maxOpenDisputes: this.config.maxOpenDisputesPerUser,
      canOpenDispute,
      reason,
      cooldownEndsAt: cooldownEnd,
    }
  }

  /**
   * Submit evidence to a dispute
   */
  async submitEvidence(
    disputeId: string,
    submitterAddress: Address,
    type: EvidenceType,
    content: string,
    description?: string
  ): Promise<DisputeEvidence> {
    const dispute = storage.disputes.get(disputeId)

    if (!dispute) {
      throw new Error("Dispute not found")
    }

    // Check if dispute is still accepting evidence
    if (dispute.state !== "open" && dispute.state !== "under_review") {
      throw new Error("Dispute is no longer accepting evidence")
    }

    // Verify submitter is party to dispute
    if (
      submitterAddress.toLowerCase() !== dispute.userAddress.toLowerCase() &&
      submitterAddress.toLowerCase() !== dispute.toolOwnerAddress.toLowerCase()
    ) {
      throw new Error("Only parties to the dispute can submit evidence")
    }

    const evidence: DisputeEvidence = {
      id: generateId("evidence"),
      type,
      content,
      description,
      submittedBy: submitterAddress,
      submittedAt: Date.now(),
    }

    dispute.evidence.push(evidence)
    dispute.updatedAt = Date.now()
    storage.disputes.set(disputeId, dispute)

    Logger.info(`Evidence submitted to dispute ${disputeId}`)

    return evidence
  }

  /**
   * Start reviewing a dispute
   */
  async startReview(disputeId: string, reviewerAddress: Address): Promise<Dispute> {
    const dispute = storage.disputes.get(disputeId)

    if (!dispute) {
      throw new Error("Dispute not found")
    }

    if (dispute.state !== "open") {
      throw new Error("Dispute is not in open state")
    }

    dispute.state = "under_review"
    dispute.reviewerAddress = reviewerAddress
    dispute.updatedAt = Date.now()

    storage.disputes.set(disputeId, dispute)

    Logger.info(`Dispute ${disputeId} under review by ${reviewerAddress}`)

    return dispute
  }

  /**
   * Resolve a dispute
   */
  async resolveDispute(
    disputeId: string,
    outcome: DisputeOutcome,
    refundAmount?: string,
    notes?: string
  ): Promise<Dispute> {
    const dispute = storage.disputes.get(disputeId)

    if (!dispute) {
      throw new Error("Dispute not found")
    }

    if (dispute.state === "resolved" || dispute.state === "closed") {
      throw new Error("Dispute is already resolved")
    }

    dispute.state = "resolved"
    dispute.outcome = outcome
    dispute.refundAmount = refundAmount
    dispute.resolutionNotes = notes
    dispute.updatedAt = Date.now()
    dispute.resolvedAt = Date.now()

    storage.disputes.set(disputeId, dispute)

    Logger.info(`Dispute ${disputeId} resolved: ${outcome}`)

    return dispute
  }

  /**
   * Escalate a dispute to arbitration
   */
  async escalateDispute(
    disputeId: string,
    escalatorAddress: Address,
    reason: string
  ): Promise<Dispute> {
    const dispute = storage.disputes.get(disputeId)

    if (!dispute) {
      throw new Error("Dispute not found")
    }

    if (dispute.state !== "open" && dispute.state !== "under_review") {
      throw new Error("Dispute cannot be escalated in current state")
    }

    // Verify escalator is party to dispute
    if (
      escalatorAddress.toLowerCase() !== dispute.userAddress.toLowerCase() &&
      escalatorAddress.toLowerCase() !== dispute.toolOwnerAddress.toLowerCase()
    ) {
      throw new Error("Only parties to the dispute can escalate")
    }

    dispute.state = "escalated"
    dispute.escalation = {
      escalatedAt: Date.now(),
      reason,
      escalatedBy: escalatorAddress,
    }
    dispute.updatedAt = Date.now()

    storage.disputes.set(disputeId, dispute)

    Logger.info(`Dispute ${disputeId} escalated by ${escalatorAddress}`)

    return dispute
  }

  /**
   * Close an expired dispute
   */
  async closeExpiredDispute(disputeId: string): Promise<Dispute> {
    const dispute = storage.disputes.get(disputeId)

    if (!dispute) {
      throw new Error("Dispute not found")
    }

    if (dispute.state === "resolved" || dispute.state === "closed") {
      throw new Error("Dispute is already closed")
    }

    const expiryTime = dispute.createdAt + this.config.disputeExpiryTime
    if (Date.now() < expiryTime) {
      throw new Error("Dispute has not yet expired")
    }

    dispute.state = "expired"
    dispute.outcome = "dismissed"
    dispute.resolutionNotes = "Dispute expired without resolution"
    dispute.updatedAt = Date.now()
    dispute.resolvedAt = Date.now()

    storage.disputes.set(disputeId, dispute)

    Logger.info(`Dispute ${disputeId} closed due to expiry`)

    return dispute
  }

  /**
   * Get dispute statistics
   */
  getStats(): DisputeStats {
    const disputes = Array.from(storage.disputes.values())

    const stats: DisputeStats = {
      totalDisputes: disputes.length,
      openDisputes: disputes.filter((d) => d.state === "open").length,
      resolvedDisputes: disputes.filter((d) => d.state === "resolved").length,
      escalatedDisputes: disputes.filter((d) => d.state === "escalated").length,
      avgResolutionTime: 0,
      autoResolutionRate: 0,
      userWinRate: 0,
      totalRefundsIssued: "0",
      disputesByReason: {
        tool_down: 0,
        slow_response: 0,
        invalid_response: 0,
        schema_violation: 0,
        wrong_result: 0,
        security_concern: 0,
        unauthorized_charges: 0,
        other: 0,
      },
    }

    // Calculate averages and rates
    const resolvedDisputes = disputes.filter((d) => d.resolvedAt)
    if (resolvedDisputes.length > 0) {
      const totalResolutionTime = resolvedDisputes.reduce(
        (sum, d) => sum + (d.resolvedAt! - d.createdAt),
        0
      )
      stats.avgResolutionTime = totalResolutionTime / resolvedDisputes.length

      const autoResolved = resolvedDisputes.filter((d) => d.autoResolved)
      stats.autoResolutionRate = (autoResolved.length / resolvedDisputes.length) * 100

      const userWins = resolvedDisputes.filter(
        (d) => d.outcome === "full_refund" || d.outcome === "partial_refund"
      )
      stats.userWinRate = (userWins.length / resolvedDisputes.length) * 100

      const totalRefunds = resolvedDisputes
        .filter((d) => d.refundAmount)
        .reduce((sum, d) => sum + parseFloat(d.refundAmount!), 0)
      stats.totalRefundsIssued = totalRefunds.toFixed(2)
    }

    // Count by reason
    for (const dispute of disputes) {
      stats.disputesByReason[dispute.reason]++
    }

    return stats
  }

  /**
   * Check and close expired disputes
   */
  async processExpiredDisputes(): Promise<number> {
    const disputes = Array.from(storage.disputes.values())
    let closedCount = 0

    for (const dispute of disputes) {
      if (dispute.state === "open" || dispute.state === "under_review") {
        const expiryTime = dispute.createdAt + this.config.disputeExpiryTime
        if (Date.now() >= expiryTime) {
          await this.closeExpiredDispute(dispute.id)
          closedCount++
        }
      }
    }

    if (closedCount > 0) {
      Logger.info(`Closed ${closedCount} expired disputes`)
    }

    return closedCount
  }

  /**
   * Mark dispute as auto-resolved
   */
  markAutoResolved(disputeId: string): void {
    const dispute = storage.disputes.get(disputeId)
    if (dispute) {
      dispute.autoResolved = true
      storage.disputes.set(disputeId, dispute)
    }
  }
}

/**
 * Singleton instance
 */
export const disputeManager = new DisputeManager()
