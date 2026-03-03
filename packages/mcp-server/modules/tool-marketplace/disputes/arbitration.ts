/**
 * Arbitration DAO Service
 * @description Decentralized arbitration for escalated disputes using staked arbitrators
 * @author nirholas
 * @license Apache-2.0
 */

import Logger from "@/utils/logger.js"
import type { Address } from "viem"
import type {
  ArbitrationCase,
  ArbitrationVote,
  Arbitrator,
  Dispute,
  DisputeOutcome,
} from "./types.js"
import { disputeManager } from "./manager.js"

/**
 * Configuration for arbitration
 */
export interface ArbitrationConfig {
  /** Minimum stake required to become an arbitrator */
  minArbitratorStake: string
  /** Stake required to vote on a case */
  voteStake: string
  /** Voting period duration (ms) */
  votingPeriod: number
  /** Minimum votes required to decide a case */
  minVotesRequired: number
  /** Percentage of losing stake distributed to winners */
  winnerRewardPercent: number
  /** Percentage of losing stake burned/kept by DAO */
  daoBurnPercent: number
}

const DEFAULT_CONFIG: ArbitrationConfig = {
  minArbitratorStake: "100", // 100 USD
  voteStake: "10", // 10 USD per vote
  votingPeriod: 3 * 24 * 60 * 60 * 1000, // 3 days
  minVotesRequired: 3,
  winnerRewardPercent: 80,
  daoBurnPercent: 20,
}

/**
 * Generate unique ID
 */
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * In-memory storage for arbitration data
 */
interface ArbitrationStorage {
  cases: Map<string, ArbitrationCase>
  casesByDispute: Map<string, string>
  arbitrators: Map<string, Arbitrator>
  votes: Map<string, ArbitrationVote[]>
  pendingRewards: Map<string, string> // arbitrator address -> pending reward
}

const storage: ArbitrationStorage = {
  cases: new Map(),
  casesByDispute: new Map(),
  arbitrators: new Map(),
  votes: new Map(),
  pendingRewards: new Map(),
}

/**
 * Arbitration DAO Service
 * Manages decentralized dispute arbitration with staked arbitrators
 */
export class ArbitrationDAO {
  private config: ArbitrationConfig

  constructor(config: Partial<ArbitrationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  // ============================================================================
  // Arbitrator Management
  // ============================================================================

  /**
   * Register as an arbitrator
   */
  async registerArbitrator(
    address: Address,
    stakeAmount: string
  ): Promise<Arbitrator> {
    if (parseFloat(stakeAmount) < parseFloat(this.config.minArbitratorStake)) {
      throw new Error(
        `Minimum stake required: ${this.config.minArbitratorStake} USD`
      )
    }

    const existing = storage.arbitrators.get(address)
    if (existing && existing.active) {
      throw new Error("Already registered as arbitrator")
    }

    const arbitrator: Arbitrator = {
      address,
      stakedAmount: stakeAmount,
      casesParticipated: existing?.casesParticipated || 0,
      casesWon: existing?.casesWon || 0,
      winRate: existing?.winRate || 0,
      rewardsEarned: existing?.rewardsEarned || "0",
      penaltiesIncurred: existing?.penaltiesIncurred || "0",
      active: true,
      registeredAt: existing?.registeredAt || Date.now(),
    }

    storage.arbitrators.set(address, arbitrator)

    Logger.info(`Arbitrator registered: ${address} with stake ${stakeAmount}`)

    return arbitrator
  }

  /**
   * Increase arbitrator stake
   */
  async increaseStake(address: Address, additionalStake: string): Promise<Arbitrator> {
    const arbitrator = storage.arbitrators.get(address)
    if (!arbitrator) {
      throw new Error("Not registered as arbitrator")
    }

    arbitrator.stakedAmount = (
      parseFloat(arbitrator.stakedAmount) + parseFloat(additionalStake)
    ).toFixed(4)

    storage.arbitrators.set(address, arbitrator)

    Logger.info(`Arbitrator stake increased: ${address} to ${arbitrator.stakedAmount}`)

    return arbitrator
  }

  /**
   * Withdraw stake (only if not participating in active cases)
   */
  async withdrawStake(address: Address, amount: string): Promise<Arbitrator> {
    const arbitrator = storage.arbitrators.get(address)
    if (!arbitrator) {
      throw new Error("Not registered as arbitrator")
    }

    // Check for active votes
    const hasActiveVotes = this.hasActiveVotes(address)
    if (hasActiveVotes) {
      throw new Error("Cannot withdraw while participating in active cases")
    }

    const currentStake = parseFloat(arbitrator.stakedAmount)
    const withdrawAmount = parseFloat(amount)

    if (withdrawAmount > currentStake) {
      throw new Error("Insufficient stake")
    }

    arbitrator.stakedAmount = (currentStake - withdrawAmount).toFixed(4)

    // Deactivate if below minimum
    if (parseFloat(arbitrator.stakedAmount) < parseFloat(this.config.minArbitratorStake)) {
      arbitrator.active = false
    }

    storage.arbitrators.set(address, arbitrator)

    Logger.info(`Arbitrator stake withdrawn: ${address}, ${amount}`)

    return arbitrator
  }

  /**
   * Check if arbitrator has active votes
   */
  private hasActiveVotes(address: Address): boolean {
    for (const caseData of storage.cases.values()) {
      if (caseData.state === "voting") {
        const votes = storage.votes.get(caseData.id) || []
        if (votes.some((v) => v.arbitratorAddress.toLowerCase() === address.toLowerCase())) {
          return true
        }
      }
    }
    return false
  }

  /**
   * Get arbitrator info
   */
  getArbitrator(address: Address): Arbitrator | null {
    return storage.arbitrators.get(address) || null
  }

  /**
   * Get all active arbitrators
   */
  getActiveArbitrators(): Arbitrator[] {
    return Array.from(storage.arbitrators.values()).filter((a) => a.active)
  }

  /**
   * Get arbitrator leaderboard
   */
  getArbitratorLeaderboard(limit: number = 50): Arbitrator[] {
    return Array.from(storage.arbitrators.values())
      .filter((a) => a.casesParticipated >= 5) // Minimum cases to qualify
      .sort((a, b) => {
        // Sort by win rate, then by cases participated
        if (b.winRate !== a.winRate) return b.winRate - a.winRate
        return b.casesParticipated - a.casesParticipated
      })
      .slice(0, limit)
  }

  // ============================================================================
  // Arbitration Cases
  // ============================================================================

  /**
   * Create an arbitration case for an escalated dispute
   */
  async createCase(dispute: Dispute): Promise<ArbitrationCase> {
    if (dispute.state !== "escalated") {
      throw new Error("Only escalated disputes can be arbitrated")
    }

    // Check if case already exists
    const existingCaseId = storage.casesByDispute.get(dispute.id)
    if (existingCaseId) {
      throw new Error("Arbitration case already exists for this dispute")
    }

    const arbitrationCase: ArbitrationCase = {
      id: generateId("arb_case"),
      disputeId: dispute.id,
      createdAt: Date.now(),
      votingDeadline: Date.now() + this.config.votingPeriod,
      votes: [],
      requiredStake: this.config.voteStake,
      minVotesRequired: this.config.minVotesRequired,
      state: "voting",
    }

    storage.cases.set(arbitrationCase.id, arbitrationCase)
    storage.casesByDispute.set(dispute.id, arbitrationCase.id)
    storage.votes.set(arbitrationCase.id, [])

    // Update dispute with arbitration case ID
    if (dispute.escalation) {
      dispute.escalation.arbitrationCaseId = arbitrationCase.id
    }

    Logger.info(`Arbitration case created: ${arbitrationCase.id} for dispute ${dispute.id}`)

    return arbitrationCase
  }

  /**
   * Cast a vote on an arbitration case
   */
  async castVote(
    caseId: string,
    arbitratorAddress: Address,
    voteForUser: boolean,
    reasoning?: string
  ): Promise<ArbitrationVote> {
    const arbitrationCase = storage.cases.get(caseId)
    if (!arbitrationCase) {
      throw new Error("Arbitration case not found")
    }

    if (arbitrationCase.state !== "voting") {
      throw new Error("Voting period has ended")
    }

    if (Date.now() > arbitrationCase.votingDeadline) {
      throw new Error("Voting deadline has passed")
    }

    // Check if arbitrator is registered and active
    const arbitrator = storage.arbitrators.get(arbitratorAddress)
    if (!arbitrator || !arbitrator.active) {
      throw new Error("Not a registered active arbitrator")
    }

    // Check if already voted
    const existingVotes = storage.votes.get(caseId) || []
    if (
      existingVotes.some(
        (v) => v.arbitratorAddress.toLowerCase() === arbitratorAddress.toLowerCase()
      )
    ) {
      throw new Error("Already voted on this case")
    }

    // Check stake
    if (parseFloat(arbitrator.stakedAmount) < parseFloat(this.config.voteStake)) {
      throw new Error(`Insufficient stake. Required: ${this.config.voteStake}`)
    }

    const vote: ArbitrationVote = {
      id: generateId("vote"),
      caseId,
      arbitratorAddress,
      voteForUser,
      stakeAmount: this.config.voteStake,
      votedAt: Date.now(),
      reasoning,
    }

    existingVotes.push(vote)
    storage.votes.set(caseId, existingVotes)

    // Update case votes
    arbitrationCase.votes = existingVotes

    Logger.info(
      `Vote cast on case ${caseId} by ${arbitratorAddress}: ${voteForUser ? "for user" : "for tool owner"}`
    )

    // Check if case can be decided
    await this.checkAndDecideCase(caseId)

    return vote
  }

  /**
   * Check if case has enough votes to be decided
   */
  private async checkAndDecideCase(caseId: string): Promise<void> {
    const arbitrationCase = storage.cases.get(caseId)
    if (!arbitrationCase || arbitrationCase.state !== "voting") return

    const votes = storage.votes.get(caseId) || []

    if (votes.length >= this.config.minVotesRequired) {
      await this.decideCase(caseId)
    }
  }

  /**
   * Decide an arbitration case based on votes
   */
  async decideCase(caseId: string): Promise<ArbitrationCase> {
    const arbitrationCase = storage.cases.get(caseId)
    if (!arbitrationCase) {
      throw new Error("Arbitration case not found")
    }

    if (arbitrationCase.state !== "voting") {
      throw new Error("Case is not in voting state")
    }

    const votes = storage.votes.get(caseId) || []

    if (votes.length < this.config.minVotesRequired) {
      throw new Error(
        `Minimum ${this.config.minVotesRequired} votes required, only ${votes.length} received`
      )
    }

    // Count votes
    const votesForUser = votes.filter((v) => v.voteForUser).length
    const votesForToolOwner = votes.length - votesForUser

    // Determine outcome
    const winningSide: "user" | "tool_owner" =
      votesForUser > votesForToolOwner ? "user" : "tool_owner"

    const outcome: DisputeOutcome =
      winningSide === "user" ? "full_refund" : "no_refund"

    // Update case
    arbitrationCase.state = "decided"
    arbitrationCase.outcome = outcome
    arbitrationCase.winningSide = winningSide
    arbitrationCase.resolvedAt = Date.now()

    storage.cases.set(caseId, arbitrationCase)

    // Distribute rewards and penalties
    await this.distributeRewardsAndPenalties(arbitrationCase, votes)

    // Resolve the underlying dispute
    const dispute = disputeManager.getDispute(arbitrationCase.disputeId)
    if (dispute) {
      const refundAmount = outcome === "full_refund" ? dispute.paymentAmount : undefined
      await disputeManager.resolveDispute(
        dispute.id,
        outcome,
        refundAmount,
        `Decided by arbitration. Votes: ${votesForUser} for user, ${votesForToolOwner} for tool owner.`
      )
    }

    Logger.info(
      `Arbitration case ${caseId} decided: ${winningSide} wins (${votesForUser}-${votesForToolOwner})`
    )

    return arbitrationCase
  }

  /**
   * Distribute rewards to winning voters and penalties to losers
   */
  private async distributeRewardsAndPenalties(
    arbitrationCase: ArbitrationCase,
    votes: ArbitrationVote[]
  ): Promise<void> {
    const winningVotes = votes.filter(
      (v) =>
        (arbitrationCase.winningSide === "user" && v.voteForUser) ||
        (arbitrationCase.winningSide === "tool_owner" && !v.voteForUser)
    )

    const losingVotes = votes.filter(
      (v) =>
        (arbitrationCase.winningSide === "user" && !v.voteForUser) ||
        (arbitrationCase.winningSide === "tool_owner" && v.voteForUser)
    )

    // Calculate total losing stake
    const totalLosingStake = losingVotes.reduce(
      (sum, v) => sum + parseFloat(v.stakeAmount),
      0
    )

    // Calculate reward pool (portion of losing stake)
    const rewardPool = totalLosingStake * (this.config.winnerRewardPercent / 100)
    const rewardPerWinner = winningVotes.length > 0 ? rewardPool / winningVotes.length : 0

    // Distribute rewards to winners
    for (const vote of winningVotes) {
      const arbitrator = storage.arbitrators.get(vote.arbitratorAddress)
      if (arbitrator) {
        arbitrator.casesParticipated++
        arbitrator.casesWon++
        arbitrator.winRate =
          (arbitrator.casesWon / arbitrator.casesParticipated) * 100
        arbitrator.rewardsEarned = (
          parseFloat(arbitrator.rewardsEarned) + rewardPerWinner
        ).toFixed(4)

        // Add pending reward
        const existingReward = parseFloat(
          storage.pendingRewards.get(vote.arbitratorAddress) || "0"
        )
        storage.pendingRewards.set(
          vote.arbitratorAddress,
          (existingReward + rewardPerWinner).toFixed(4)
        )

        storage.arbitrators.set(vote.arbitratorAddress, arbitrator)
      }
    }

    // Apply penalties to losers
    for (const vote of losingVotes) {
      const arbitrator = storage.arbitrators.get(vote.arbitratorAddress)
      if (arbitrator) {
        arbitrator.casesParticipated++
        arbitrator.winRate =
          (arbitrator.casesWon / arbitrator.casesParticipated) * 100
        arbitrator.penaltiesIncurred = (
          parseFloat(arbitrator.penaltiesIncurred) + parseFloat(vote.stakeAmount)
        ).toFixed(4)

        // Reduce stake by vote stake amount
        arbitrator.stakedAmount = Math.max(
          0,
          parseFloat(arbitrator.stakedAmount) - parseFloat(vote.stakeAmount)
        ).toFixed(4)

        // Deactivate if below minimum
        if (parseFloat(arbitrator.stakedAmount) < parseFloat(this.config.minArbitratorStake)) {
          arbitrator.active = false
        }

        storage.arbitrators.set(vote.arbitratorAddress, arbitrator)
      }
    }

    Logger.info(
      `Rewards distributed: ${winningVotes.length} winners received ${rewardPerWinner.toFixed(4)} each`
    )
  }

  /**
   * Expire a case that didn't get enough votes
   */
  async expireCase(caseId: string): Promise<ArbitrationCase> {
    const arbitrationCase = storage.cases.get(caseId)
    if (!arbitrationCase) {
      throw new Error("Arbitration case not found")
    }

    if (arbitrationCase.state !== "voting") {
      throw new Error("Case is not in voting state")
    }

    if (Date.now() <= arbitrationCase.votingDeadline) {
      throw new Error("Case has not yet reached deadline")
    }

    const votes = storage.votes.get(caseId) || []
    if (votes.length >= this.config.minVotesRequired) {
      // Enough votes, decide instead of expire
      return this.decideCase(caseId)
    }

    // Mark as expired
    arbitrationCase.state = "expired"
    arbitrationCase.resolvedAt = Date.now()

    storage.cases.set(caseId, arbitrationCase)

    // Return stakes to voters (no penalty for expired cases)
    // In production, this would involve actual token transfers

    Logger.info(`Arbitration case ${caseId} expired due to insufficient votes`)

    return arbitrationCase
  }

  /**
   * Get arbitration case by ID
   */
  getCase(caseId: string): ArbitrationCase | null {
    return storage.cases.get(caseId) || null
  }

  /**
   * Get case by dispute ID
   */
  getCaseByDispute(disputeId: string): ArbitrationCase | null {
    const caseId = storage.casesByDispute.get(disputeId)
    return caseId ? storage.cases.get(caseId) || null : null
  }

  /**
   * Get all active cases
   */
  getActiveCases(): ArbitrationCase[] {
    return Array.from(storage.cases.values()).filter(
      (c) => c.state === "voting"
    )
  }

  /**
   * Get cases for an arbitrator
   */
  getArbitratorCases(address: Address): ArbitrationCase[] {
    const cases: ArbitrationCase[] = []

    for (const arbitrationCase of storage.cases.values()) {
      const votes = storage.votes.get(arbitrationCase.id) || []
      if (
        votes.some(
          (v) => v.arbitratorAddress.toLowerCase() === address.toLowerCase()
        )
      ) {
        cases.push(arbitrationCase)
      }
    }

    return cases.sort((a, b) => b.createdAt - a.createdAt)
  }

  /**
   * Get pending rewards for an arbitrator
   */
  getPendingRewards(address: Address): string {
    return storage.pendingRewards.get(address) || "0"
  }

  /**
   * Claim pending rewards
   */
  async claimRewards(address: Address): Promise<string> {
    const rewards = storage.pendingRewards.get(address) || "0"
    if (parseFloat(rewards) === 0) {
      throw new Error("No pending rewards to claim")
    }

    // In production, this would transfer tokens
    storage.pendingRewards.set(address, "0")

    Logger.info(`Rewards claimed by ${address}: ${rewards}`)

    return rewards
  }

  /**
   * Process expired cases
   */
  async processExpiredCases(): Promise<number> {
    const cases = Array.from(storage.cases.values())
    let processedCount = 0

    for (const arbitrationCase of cases) {
      if (
        arbitrationCase.state === "voting" &&
        Date.now() > arbitrationCase.votingDeadline
      ) {
        try {
          const votes = storage.votes.get(arbitrationCase.id) || []
          if (votes.length >= this.config.minVotesRequired) {
            await this.decideCase(arbitrationCase.id)
          } else {
            await this.expireCase(arbitrationCase.id)
          }
          processedCount++
        } catch (error) {
          Logger.error(
            `Error processing case ${arbitrationCase.id}: ${error instanceof Error ? error.message : "Unknown error"}`
          )
        }
      }
    }

    return processedCount
  }

  /**
   * Get arbitration statistics
   */
  getStats(): {
    totalCases: number
    activeCases: number
    decidedCases: number
    expiredCases: number
    totalArbitrators: number
    activeArbitrators: number
    avgVotesPerCase: number
    userWinRate: number
  } {
    const cases = Array.from(storage.cases.values())
    const arbitrators = Array.from(storage.arbitrators.values())

    const decidedCases = cases.filter((c) => c.state === "decided")
    const userWins = decidedCases.filter((c) => c.winningSide === "user")

    let totalVotes = 0
    for (const [, votes] of storage.votes) {
      totalVotes += votes.length
    }

    return {
      totalCases: cases.length,
      activeCases: cases.filter((c) => c.state === "voting").length,
      decidedCases: decidedCases.length,
      expiredCases: cases.filter((c) => c.state === "expired").length,
      totalArbitrators: arbitrators.length,
      activeArbitrators: arbitrators.filter((a) => a.active).length,
      avgVotesPerCase: cases.length > 0 ? totalVotes / cases.length : 0,
      userWinRate:
        decidedCases.length > 0
          ? (userWins.length / decidedCases.length) * 100
          : 0,
    }
  }
}

/**
 * Singleton instance
 */
export const arbitrationDAO = new ArbitrationDAO()
