/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Address, Hex } from "viem"
import { formatUnits, keccak256, toHex } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { z } from "zod"

import { getPublicClient, getWalletClient } from "@/evm/services/clients.js"
import { mcpToolRes } from "@/utils/helper.js"
import { defaultNetworkParam, privateKeyParam } from "../common/types.js"

// OpenZeppelin Governor ABI
const GOVERNOR_ABI = [
  {
    name: "propose",
    type: "function",
    inputs: [
      { name: "targets", type: "address[]" },
      { name: "values", type: "uint256[]" },
      { name: "calldatas", type: "bytes[]" },
      { name: "description", type: "string" }
    ],
    outputs: [{ name: "proposalId", type: "uint256" }]
  },
  {
    name: "castVote",
    type: "function",
    inputs: [
      { name: "proposalId", type: "uint256" },
      { name: "support", type: "uint8" }
    ],
    outputs: [{ name: "balance", type: "uint256" }]
  },
  {
    name: "castVoteWithReason",
    type: "function",
    inputs: [
      { name: "proposalId", type: "uint256" },
      { name: "support", type: "uint8" },
      { name: "reason", type: "string" }
    ],
    outputs: [{ name: "balance", type: "uint256" }]
  },
  {
    name: "state",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "proposalId", type: "uint256" }],
    outputs: [{ name: "", type: "uint8" }]
  },
  {
    name: "proposalVotes",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "proposalId", type: "uint256" }],
    outputs: [
      { name: "againstVotes", type: "uint256" },
      { name: "forVotes", type: "uint256" },
      { name: "abstainVotes", type: "uint256" }
    ]
  },
  {
    name: "hasVoted",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "proposalId", type: "uint256" },
      { name: "account", type: "address" }
    ],
    outputs: [{ name: "", type: "bool" }]
  },
  {
    name: "getVotes",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "blockNumber", type: "uint256" }
    ],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "proposalThreshold",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "quorum",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "blockNumber", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "votingDelay",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "votingPeriod",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "proposalDeadline",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "proposalId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "proposalSnapshot",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "proposalId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }]
  }
] as const

// Proposal states
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

export function registerGovernanceTools(server: McpServer) {
  // Get proposal details
  server.tool(
    "get_proposal_details",
    "Get details of a governance proposal",
    {
      network: defaultNetworkParam,
      governorAddress: z.string().describe("Governor contract address"),
      proposalId: z.string().describe("Proposal ID")
    },
    async ({ network, governorAddress, proposalId }) => {
      try {
        const publicClient = getPublicClient(network)
        const propId = BigInt(proposalId)
        
        // Get proposal state and votes
        const [state, votes, deadline, snapshot] = await Promise.all([
          publicClient.readContract({
            address: governorAddress as Address,
            abi: GOVERNOR_ABI,
            functionName: "state",
            args: [propId]
          }),
          publicClient.readContract({
            address: governorAddress as Address,
            abi: GOVERNOR_ABI,
            functionName: "proposalVotes",
            args: [propId]
          }),
          publicClient.readContract({
            address: governorAddress as Address,
            abi: GOVERNOR_ABI,
            functionName: "proposalDeadline",
            args: [propId]
          }),
          publicClient.readContract({
            address: governorAddress as Address,
            abi: GOVERNOR_ABI,
            functionName: "proposalSnapshot",
            args: [propId]
          })
        ])

        const [againstVotes, forVotes, abstainVotes] = votes
        const totalVotes = againstVotes + forVotes + abstainVotes

        return mcpToolRes.success({
          network,
          governorAddress,
          proposalId,
          state: PROPOSAL_STATES[state] || "Unknown",
          stateCode: state,
          votes: {
            for: formatUnits(forVotes, 18),
            against: formatUnits(againstVotes, 18),
            abstain: formatUnits(abstainVotes, 18),
            total: formatUnits(totalVotes, 18)
          },
          percentages: totalVotes > 0n ? {
            for: ((Number(forVotes) / Number(totalVotes)) * 100).toFixed(2) + "%",
            against: ((Number(againstVotes) / Number(totalVotes)) * 100).toFixed(2) + "%",
            abstain: ((Number(abstainVotes) / Number(totalVotes)) * 100).toFixed(2) + "%"
          } : null,
          timing: {
            snapshotBlock: snapshot.toString(),
            deadlineBlock: deadline.toString()
          }
        })
      } catch (error) {
        return mcpToolRes.error(error, "getting proposal details")
      }
    }
  )

  // Cast vote
  server.tool(
    "cast_vote",
    "Cast a vote on a governance proposal",
    {
      network: defaultNetworkParam,
      governorAddress: z.string().describe("Governor contract address"),
      proposalId: z.string().describe("Proposal ID"),
      support: z.enum(["for", "against", "abstain"]).describe("Vote type"),
      reason: z.string().optional().describe("Optional reason for vote"),
      privateKey: privateKeyParam
    },
    async ({ network, governorAddress, proposalId, support, reason, privateKey }) => {
      try {
        const account = privateKeyToAccount(privateKey as Hex)
        const walletClient = getWalletClient(privateKey as Hex, network)
        const publicClient = getPublicClient(network)
        
        const propId = BigInt(proposalId)
        const voteType = support === "for" ? 1 : support === "against" ? 0 : 2

        // Check if already voted
        const hasVoted = await publicClient.readContract({
          address: governorAddress as Address,
          abi: GOVERNOR_ABI,
          functionName: "hasVoted",
          args: [propId, account.address]
        })

        if (hasVoted) {
          return mcpToolRes.error(new Error("Already voted on this proposal"), "casting vote")
        }

        let hash: Hex
        if (reason) {
          hash = await walletClient.writeContract({
            address: governorAddress as Address,
            abi: GOVERNOR_ABI,
            functionName: "castVoteWithReason",
            args: [propId, voteType, reason],
            account
          })
        } else {
          hash = await walletClient.writeContract({
            address: governorAddress as Address,
            abi: GOVERNOR_ABI,
            functionName: "castVote",
            args: [propId, voteType],
            account
          })
        }

        const receipt = await publicClient.waitForTransactionReceipt({ hash })

        return mcpToolRes.success({
          network,
          governorAddress,
          proposalId,
          vote: support,
          reason: reason || null,
          voter: account.address,
          transactionHash: hash,
          status: receipt.status === "success" ? "success" : "failed"
        })
      } catch (error) {
        return mcpToolRes.error(error, "casting vote")
      }
    }
  )

  // Get voting power
  server.tool(
    "get_voting_power",
    "Get voting power for an address at a specific block",
    {
      network: defaultNetworkParam,
      governorAddress: z.string().describe("Governor contract address"),
      address: z.string().describe("Address to check"),
      blockNumber: z.string().optional().describe("Block number (default: latest)")
    },
    async ({ network, governorAddress, address, blockNumber }) => {
      try {
        const publicClient = getPublicClient(network)
        
        const block = blockNumber 
          ? BigInt(blockNumber) 
          : await publicClient.getBlockNumber() - 1n

        const votes = await publicClient.readContract({
          address: governorAddress as Address,
          abi: GOVERNOR_ABI,
          functionName: "getVotes",
          args: [address as Address, block]
        })

        return mcpToolRes.success({
          network,
          governorAddress,
          address,
          blockNumber: block.toString(),
          votingPower: votes.toString(),
          votingPowerFormatted: formatUnits(votes, 18)
        })
      } catch (error) {
        return mcpToolRes.error(error, "getting voting power")
      }
    }
  )

  // Get governance parameters
  server.tool(
    "get_governance_params",
    "Get governance parameters like voting delay, period, and thresholds",
    {
      network: defaultNetworkParam,
      governorAddress: z.string().describe("Governor contract address")
    },
    async ({ network, governorAddress }) => {
      try {
        const publicClient = getPublicClient(network)
        const currentBlock = await publicClient.getBlockNumber()
        
        const [votingDelay, votingPeriod, proposalThreshold, quorumVotes] = await Promise.all([
          publicClient.readContract({
            address: governorAddress as Address,
            abi: GOVERNOR_ABI,
            functionName: "votingDelay"
          }),
          publicClient.readContract({
            address: governorAddress as Address,
            abi: GOVERNOR_ABI,
            functionName: "votingPeriod"
          }),
          publicClient.readContract({
            address: governorAddress as Address,
            abi: GOVERNOR_ABI,
            functionName: "proposalThreshold"
          }),
          publicClient.readContract({
            address: governorAddress as Address,
            abi: GOVERNOR_ABI,
            functionName: "quorum",
            args: [currentBlock - 1n]
          })
        ])

        return mcpToolRes.success({
          network,
          governorAddress,
          parameters: {
            votingDelay: votingDelay.toString(),
            votingDelayBlocks: `${votingDelay} blocks`,
            votingPeriod: votingPeriod.toString(),
            votingPeriodBlocks: `${votingPeriod} blocks`,
            proposalThreshold: formatUnits(proposalThreshold, 18),
            quorum: formatUnits(quorumVotes, 18)
          },
          note: "Thresholds shown in governance token units"
        })
      } catch (error) {
        return mcpToolRes.error(error, "getting governance parameters")
      }
    }
  )

  // Check if can vote
  server.tool(
    "check_vote_eligibility",
    "Check if an address can vote on a proposal",
    {
      network: defaultNetworkParam,
      governorAddress: z.string().describe("Governor contract address"),
      proposalId: z.string().describe("Proposal ID"),
      address: z.string().describe("Address to check")
    },
    async ({ network, governorAddress, proposalId, address }) => {
      try {
        const publicClient = getPublicClient(network)
        const propId = BigInt(proposalId)
        
        // Get proposal state and snapshot
        const [state, snapshot, hasVoted] = await Promise.all([
          publicClient.readContract({
            address: governorAddress as Address,
            abi: GOVERNOR_ABI,
            functionName: "state",
            args: [propId]
          }),
          publicClient.readContract({
            address: governorAddress as Address,
            abi: GOVERNOR_ABI,
            functionName: "proposalSnapshot",
            args: [propId]
          }),
          publicClient.readContract({
            address: governorAddress as Address,
            abi: GOVERNOR_ABI,
            functionName: "hasVoted",
            args: [propId, address as Address]
          })
        ])

        // Get voting power at snapshot
        const votingPower = await publicClient.readContract({
          address: governorAddress as Address,
          abi: GOVERNOR_ABI,
          functionName: "getVotes",
          args: [address as Address, snapshot]
        })

        const isActive = state === 1
        const hasVotingPower = votingPower > 0n
        const canVote = isActive && !hasVoted && hasVotingPower

        return mcpToolRes.success({
          network,
          governorAddress,
          proposalId,
          address,
          eligibility: {
            canVote,
            proposalState: PROPOSAL_STATES[state],
            isActive,
            hasVoted,
            votingPower: formatUnits(votingPower, 18),
            hasVotingPower
          },
          reason: !isActive ? "Proposal is not active" :
                  hasVoted ? "Already voted" :
                  !hasVotingPower ? "No voting power at snapshot" :
                  "Eligible to vote"
        })
      } catch (error) {
        return mcpToolRes.error(error, "checking vote eligibility")
      }
    }
  )

  // Calculate proposal ID
  server.tool(
    "calculate_proposal_id",
    "Calculate proposal ID from proposal parameters",
    {
      targets: z.array(z.string()).describe("Target contract addresses"),
      values: z.array(z.string()).describe("ETH values for each call"),
      calldatas: z.array(z.string()).describe("Encoded call data for each target"),
      descriptionHash: z.string().describe("Keccak256 hash of description")
    },
    async ({ targets, values, calldatas, descriptionHash }) => {
      try {
        // This matches OpenZeppelin Governor's hashProposal
        const encoded = new TextEncoder().encode(
          JSON.stringify({
            targets,
            values,
            calldatas,
            descriptionHash
          })
        )
        
        const proposalId = keccak256(toHex(encoded))

        return mcpToolRes.success({
          proposalId,
          parameters: {
            targets,
            values,
            calldatas,
            descriptionHash
          },
          note: "This is a simplified calculation. Actual ID depends on Governor implementation."
        })
      } catch (error) {
        return mcpToolRes.error(error, "calculating proposal ID")
      }
    }
  )
}
