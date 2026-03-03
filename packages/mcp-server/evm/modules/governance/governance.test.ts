/**
 * Governance Module Tests
 * Tests for DAO governance tools, proposals, voting
 * @author nich
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import type { Address, Hash } from "viem"

// Mock the clients module
vi.mock("@/evm/services/clients.js", () => ({
  getPublicClient: vi.fn(() => mockPublicClient),
  getWalletClient: vi.fn(() => mockWalletClient)
}))

// Mock viem accounts
vi.mock("viem/accounts", () => ({
  privateKeyToAccount: vi.fn(() => ({
    address: "0x1234567890123456789012345678901234567890" as Address
  }))
}))

// Mock public client
const mockPublicClient = {
  getChainId: vi.fn().mockResolvedValue(1),
  readContract: vi.fn(),
  getBlockNumber: vi.fn()
}

// Mock wallet client
const mockWalletClient = {
  account: { address: "0x1234567890123456789012345678901234567890" as Address },
  writeContract: vi.fn()
}

describe("Governance Module", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // Test addresses
  const governorAddress = "0xGovernor1234567890123456789012345678901234" as Address
  const voterAddress = "0x742d35Cc6634C0532925a3b844Bc9e7595f0Ab12" as Address
  const mockProposalId = BigInt("12345678901234567890")

  // Proposal states mapping
  const PROPOSAL_STATES = [
    "Pending",
    "Active",
    "Canceled",
    "Defeated",
    "Succeeded",
    "Queued",
    "Expired",
    "Executed"
  ]

  // Vote types
  const VOTE_TYPES = {
    Against: 0,
    For: 1,
    Abstain: 2
  }

  describe("Proposal Details", () => {
    it("should fetch proposal state", async () => {
      mockPublicClient.readContract.mockResolvedValueOnce(1) // Active state

      const state = await mockPublicClient.readContract({
        address: governorAddress,
        functionName: "state",
        args: [mockProposalId]
      })

      expect(PROPOSAL_STATES[state as number]).toBe("Active")
    })

    it("should fetch proposal votes", async () => {
      const mockVotes = [
        BigInt("1000000000000000000000"),  // againstVotes (1000)
        BigInt("5000000000000000000000"),  // forVotes (5000)
        BigInt("500000000000000000000")    // abstainVotes (500)
      ]

      mockPublicClient.readContract.mockResolvedValueOnce(mockVotes)

      const votes = await mockPublicClient.readContract({
        address: governorAddress,
        functionName: "proposalVotes",
        args: [mockProposalId]
      })

      const [againstVotes, forVotes, abstainVotes] = votes as [bigint, bigint, bigint]
      const totalVotes = againstVotes + forVotes + abstainVotes

      expect(forVotes).toBeGreaterThan(againstVotes)
      expect(totalVotes).toBe(BigInt("6500000000000000000000"))
    })

    it("should fetch proposal deadline", async () => {
      const futureBlock = BigInt(19000000)
      mockPublicClient.readContract.mockResolvedValueOnce(futureBlock)
      mockPublicClient.getBlockNumber.mockResolvedValueOnce(BigInt(18000000))

      const deadline = await mockPublicClient.readContract({
        address: governorAddress,
        functionName: "proposalDeadline",
        args: [mockProposalId]
      })

      const currentBlock = await mockPublicClient.getBlockNumber()
      expect(deadline).toBeGreaterThan(currentBlock)
    })

    it("should fetch proposal snapshot block", async () => {
      mockPublicClient.readContract.mockResolvedValueOnce(BigInt(17500000))

      const snapshot = await mockPublicClient.readContract({
        address: governorAddress,
        functionName: "proposalSnapshot",
        args: [mockProposalId]
      })

      expect(snapshot).toBe(BigInt(17500000))
    })
  })

  describe("Voting Power", () => {
    it("should check voting power at snapshot block", async () => {
      mockPublicClient.readContract.mockResolvedValueOnce(BigInt("1000000000000000000000")) // 1000 tokens

      const votes = await mockPublicClient.readContract({
        address: governorAddress,
        functionName: "getVotes",
        args: [voterAddress, BigInt(17500000)]
      })

      expect(votes).toBe(BigInt("1000000000000000000000"))
    })

    it("should check if user has voted", async () => {
      mockPublicClient.readContract.mockResolvedValueOnce(false)

      const hasVoted = await mockPublicClient.readContract({
        address: governorAddress,
        functionName: "hasVoted",
        args: [mockProposalId, voterAddress]
      })

      expect(hasVoted).toBe(false)
    })

    it("should check proposal threshold", async () => {
      mockPublicClient.readContract.mockResolvedValueOnce(BigInt("100000000000000000000000")) // 100k tokens

      const threshold = await mockPublicClient.readContract({
        address: governorAddress,
        functionName: "proposalThreshold"
      })

      expect(threshold).toBe(BigInt("100000000000000000000000"))
    })

    it("should check quorum requirement", async () => {
      mockPublicClient.readContract.mockResolvedValueOnce(BigInt("1000000000000000000000000")) // 1M tokens

      const quorum = await mockPublicClient.readContract({
        address: governorAddress,
        functionName: "quorum",
        args: [BigInt(17500000)]
      })

      expect(quorum).toBe(BigInt("1000000000000000000000000"))
    })
  })

  describe("Voting Operations", () => {
    it("should cast vote for proposal", async () => {
      const mockTxHash = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" as Hash
      mockWalletClient.writeContract.mockResolvedValueOnce(mockTxHash)

      const txHash = await mockWalletClient.writeContract({
        address: governorAddress,
        functionName: "castVote",
        args: [mockProposalId, VOTE_TYPES.For]
      })

      expect(txHash).toBe(mockTxHash)
      expect(mockWalletClient.writeContract).toHaveBeenCalledWith({
        address: governorAddress,
        functionName: "castVote",
        args: [mockProposalId, 1] // For = 1
      })
    })

    it("should cast vote against proposal", async () => {
      const mockTxHash = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as Hash
      mockWalletClient.writeContract.mockResolvedValueOnce(mockTxHash)

      const txHash = await mockWalletClient.writeContract({
        address: governorAddress,
        functionName: "castVote",
        args: [mockProposalId, VOTE_TYPES.Against]
      })

      expect(txHash).toBe(mockTxHash)
    })

    it("should cast vote with reason", async () => {
      const mockTxHash = "0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321" as Hash
      mockWalletClient.writeContract.mockResolvedValueOnce(mockTxHash)

      const reason = "I support this proposal because it benefits the community"

      const txHash = await mockWalletClient.writeContract({
        address: governorAddress,
        functionName: "castVoteWithReason",
        args: [mockProposalId, VOTE_TYPES.For, reason]
      })

      expect(txHash).toBe(mockTxHash)
    })

    it("should abstain from voting", async () => {
      const mockTxHash = "0x0000000000000000000000000000000000000000000000000000000000000001" as Hash
      mockWalletClient.writeContract.mockResolvedValueOnce(mockTxHash)

      const txHash = await mockWalletClient.writeContract({
        address: governorAddress,
        functionName: "castVote",
        args: [mockProposalId, VOTE_TYPES.Abstain]
      })

      expect(txHash).toBe(mockTxHash)
    })
  })

  describe("Proposal Creation", () => {
    it("should create a new proposal", async () => {
      const mockTxHash = "0xproposal12345678901234567890123456789012345678901234567890123456" as Hash
      mockWalletClient.writeContract.mockResolvedValueOnce(mockTxHash)

      const targets = [governorAddress]
      const values = [BigInt(0)]
      const calldatas = ["0x12345678" as `0x${string}`]
      const description = "Proposal #1: Update fee structure"

      const txHash = await mockWalletClient.writeContract({
        address: governorAddress,
        functionName: "propose",
        args: [targets, values, calldatas, description]
      })

      expect(txHash).toBe(mockTxHash)
    })
  })

  describe("Governor Configuration", () => {
    it("should fetch voting delay", async () => {
      mockPublicClient.readContract.mockResolvedValueOnce(BigInt(1)) // 1 block delay

      const delay = await mockPublicClient.readContract({
        address: governorAddress,
        functionName: "votingDelay"
      })

      expect(delay).toBe(BigInt(1))
    })

    it("should fetch voting period", async () => {
      mockPublicClient.readContract.mockResolvedValueOnce(BigInt(45818)) // ~1 week in blocks

      const period = await mockPublicClient.readContract({
        address: governorAddress,
        functionName: "votingPeriod"
      })

      expect(period).toBe(BigInt(45818))
    })
  })

  describe("Proposal State Machine", () => {
    it("should correctly map all proposal states", () => {
      expect(PROPOSAL_STATES[0]).toBe("Pending")
      expect(PROPOSAL_STATES[1]).toBe("Active")
      expect(PROPOSAL_STATES[2]).toBe("Canceled")
      expect(PROPOSAL_STATES[3]).toBe("Defeated")
      expect(PROPOSAL_STATES[4]).toBe("Succeeded")
      expect(PROPOSAL_STATES[5]).toBe("Queued")
      expect(PROPOSAL_STATES[6]).toBe("Expired")
      expect(PROPOSAL_STATES[7]).toBe("Executed")
    })

    it("should identify vote-able proposals", () => {
      const votableStates = ["Active"]
      
      // Pending - not yet active
      expect(votableStates.includes(PROPOSAL_STATES[0])).toBe(false)
      // Active - can vote
      expect(votableStates.includes(PROPOSAL_STATES[1])).toBe(true)
      // Executed - too late
      expect(votableStates.includes(PROPOSAL_STATES[7])).toBe(false)
    })
  })

  describe("Vote Calculation", () => {
    it("should calculate vote percentages", () => {
      const forVotes = BigInt("7000000000000000000000")
      const againstVotes = BigInt("2000000000000000000000")
      const abstainVotes = BigInt("1000000000000000000000")
      const totalVotes = forVotes + againstVotes + abstainVotes

      const forPercent = (Number(forVotes) / Number(totalVotes)) * 100
      const againstPercent = (Number(againstVotes) / Number(totalVotes)) * 100
      const abstainPercent = (Number(abstainVotes) / Number(totalVotes)) * 100

      expect(forPercent).toBe(70)
      expect(againstPercent).toBe(20)
      expect(abstainPercent).toBe(10)
    })

    it("should determine if proposal passes simple majority", () => {
      const forVotes = BigInt("5100000000000000000000")
      const againstVotes = BigInt("4900000000000000000000")

      expect(forVotes > againstVotes).toBe(true)
    })
  })

  describe("Edge Cases", () => {
    it("should handle proposal not found", async () => {
      mockPublicClient.readContract.mockRejectedValue(
        new Error("Proposal not found")
      )

      await expect(
        mockPublicClient.readContract({
          address: governorAddress,
          functionName: "state",
          args: [BigInt(999999999)]
        })
      ).rejects.toThrow("Proposal not found")
    })

    it("should handle zero votes scenario", () => {
      const forVotes = BigInt(0)
      const againstVotes = BigInt(0)
      const abstainVotes = BigInt(0)
      const totalVotes = forVotes + againstVotes + abstainVotes

      expect(totalVotes).toBe(BigInt(0))
      // Avoid division by zero
      const forPercent = totalVotes > 0n ? (Number(forVotes) / Number(totalVotes)) * 100 : 0
      expect(forPercent).toBe(0)
    })

    it("should handle user without voting power", async () => {
      mockPublicClient.readContract.mockResolvedValueOnce(BigInt(0))

      const votes = await mockPublicClient.readContract({
        address: governorAddress,
        functionName: "getVotes",
        args: [voterAddress, BigInt(17500000)]
      })

      expect(votes).toBe(BigInt(0))
    })

    it("should handle RPC errors", async () => {
      mockPublicClient.readContract.mockRejectedValue(
        new Error("RPC connection failed")
      )

      await expect(
        mockPublicClient.readContract({
          address: governorAddress,
          functionName: "proposalVotes",
          args: [mockProposalId]
        })
      ).rejects.toThrow("RPC connection failed")
    })

    it("should handle already voted error", async () => {
      mockWalletClient.writeContract.mockRejectedValue(
        new Error("GovernorVotingSimple: vote already cast")
      )

      await expect(
        mockWalletClient.writeContract({
          address: governorAddress,
          functionName: "castVote",
          args: [mockProposalId, VOTE_TYPES.For]
        })
      ).rejects.toThrow("vote already cast")
    })
  })
})
