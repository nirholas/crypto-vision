/**
 * Dispute System Types
 * @description Type definitions for the dispute resolution system
 * @author nirholas
 * @license Apache-2.0
 */

import type { Address } from "viem"

/**
 * Dispute states
 */
export type DisputeState =
  | "open"
  | "under_review"
  | "resolved"
  | "escalated"
  | "closed"
  | "expired"

/**
 * Dispute resolution outcome
 */
export type DisputeOutcome =
  | "full_refund"
  | "partial_refund"
  | "no_refund"
  | "dismissed"
  | "pending"

/**
 * Evidence type
 */
export type EvidenceType = "screenshot" | "log" | "transaction" | "api_response" | "other"

/**
 * Evidence item
 */
export interface DisputeEvidence {
  /** Evidence ID */
  id: string
  /** Evidence type */
  type: EvidenceType
  /** Evidence URL or data */
  content: string
  /** Description */
  description?: string
  /** Submitted by */
  submittedBy: Address
  /** Submission timestamp */
  submittedAt: number
}

/**
 * Dispute record
 */
export interface Dispute {
  /** Unique dispute ID */
  id: string
  /** Tool ID involved */
  toolId: string
  /** User who opened dispute */
  userAddress: Address
  /** Tool owner address */
  toolOwnerAddress: Address
  /** Payment transaction hash */
  paymentTxHash: string
  /** Payment amount */
  paymentAmount: string
  /** Payment token */
  paymentToken: string
  /** Dispute reason */
  reason: DisputeReason
  /** Detailed description */
  description: string
  /** Evidence submitted */
  evidence: DisputeEvidence[]
  /** Current state */
  state: DisputeState
  /** Resolution outcome */
  outcome: DisputeOutcome
  /** Refund amount (if applicable) */
  refundAmount?: string
  /** Created timestamp */
  createdAt: number
  /** Last updated timestamp */
  updatedAt: number
  /** Resolved timestamp */
  resolvedAt?: number
  /** Auto-resolution applied */
  autoResolved: boolean
  /** Resolution notes */
  resolutionNotes?: string
  /** Assigned reviewer (if under review) */
  reviewerAddress?: Address
  /** Escalation details */
  escalation?: EscalationDetails
}

/**
 * Dispute reason categories
 */
export type DisputeReason =
  | "tool_down"
  | "slow_response"
  | "invalid_response"
  | "schema_violation"
  | "wrong_result"
  | "security_concern"
  | "unauthorized_charges"
  | "other"

/**
 * Escalation details
 */
export interface EscalationDetails {
  /** Escalation timestamp */
  escalatedAt: number
  /** Escalation reason */
  reason: string
  /** Arbitration case ID */
  arbitrationCaseId?: string
  /** Escalated by */
  escalatedBy: Address
}

/**
 * Dispute creation input
 */
export interface CreateDisputeInput {
  /** Tool ID */
  toolId: string
  /** User opening dispute */
  userAddress: Address
  /** Payment transaction hash */
  paymentTxHash: string
  /** Payment amount */
  paymentAmount: string
  /** Payment token */
  paymentToken: string
  /** Dispute reason */
  reason: DisputeReason
  /** Description */
  description: string
  /** Initial evidence */
  evidence?: Array<{
    type: EvidenceType
    content: string
    description?: string
  }>
}

/**
 * Dispute filter options
 */
export interface DisputeFilter {
  /** Filter by state */
  state?: DisputeState
  /** Filter by tool ID */
  toolId?: string
  /** Filter by user address */
  userAddress?: Address
  /** Filter by tool owner */
  toolOwnerAddress?: Address
  /** Created after timestamp */
  createdAfter?: number
  /** Created before timestamp */
  createdBefore?: number
  /** Limit results */
  limit?: number
  /** Offset for pagination */
  offset?: number
}

/**
 * Auto-resolution rule
 */
export interface AutoResolutionRule {
  /** Rule ID */
  id: string
  /** Rule name */
  name: string
  /** Condition type */
  conditionType: "tool_down" | "slow_response" | "schema_violation"
  /** Threshold value (e.g., response time in ms) */
  threshold?: number
  /** Resolution action */
  action: "full_refund" | "partial_refund"
  /** Refund percentage (for partial refund) */
  refundPercent?: number
  /** Active status */
  active: boolean
}

/**
 * Arbitration vote
 */
export interface ArbitrationVote {
  /** Vote ID */
  id: string
  /** Case ID */
  caseId: string
  /** Arbitrator address */
  arbitratorAddress: Address
  /** Vote: true for user, false for tool owner */
  voteForUser: boolean
  /** Stake amount */
  stakeAmount: string
  /** Vote timestamp */
  votedAt: number
  /** Reasoning */
  reasoning?: string
}

/**
 * Arbitration case
 */
export interface ArbitrationCase {
  /** Case ID */
  id: string
  /** Related dispute ID */
  disputeId: string
  /** Created timestamp */
  createdAt: number
  /** Voting deadline */
  votingDeadline: number
  /** Votes cast */
  votes: ArbitrationVote[]
  /** Required stake to vote */
  requiredStake: string
  /** Minimum votes needed */
  minVotesRequired: number
  /** Case state */
  state: "voting" | "decided" | "expired"
  /** Outcome (if decided) */
  outcome?: DisputeOutcome
  /** Winning side */
  winningSide?: "user" | "tool_owner"
  /** Resolution timestamp */
  resolvedAt?: number
}

/**
 * Arbitrator info
 */
export interface Arbitrator {
  /** Arbitrator address */
  address: Address
  /** Total stake */
  stakedAmount: string
  /** Cases participated */
  casesParticipated: number
  /** Cases won (voted correctly) */
  casesWon: number
  /** Win rate */
  winRate: number
  /** Rewards earned */
  rewardsEarned: string
  /** Penalties incurred */
  penaltiesIncurred: string
  /** Active status */
  active: boolean
  /** Registered timestamp */
  registeredAt: number
}

/**
 * Dispute statistics
 */
export interface DisputeStats {
  /** Total disputes */
  totalDisputes: number
  /** Open disputes */
  openDisputes: number
  /** Resolved disputes */
  resolvedDisputes: number
  /** Escalated disputes */
  escalatedDisputes: number
  /** Average resolution time (ms) */
  avgResolutionTime: number
  /** Auto-resolution rate */
  autoResolutionRate: number
  /** User win rate */
  userWinRate: number
  /** Total refunds issued */
  totalRefundsIssued: string
  /** Disputes by reason */
  disputesByReason: Record<DisputeReason, number>
}

/**
 * User dispute limits
 */
export interface UserDisputeLimits {
  /** User address */
  userAddress: Address
  /** Open disputes count */
  openDisputes: number
  /** Max allowed open disputes */
  maxOpenDisputes: number
  /** Can open new dispute */
  canOpenDispute: boolean
  /** Reason if cannot open */
  reason?: string
  /** Cooldown end (if in cooldown) */
  cooldownEndsAt?: number
}
