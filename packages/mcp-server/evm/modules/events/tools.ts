/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Address, Hex } from "viem"
import { decodeEventLog, parseAbiItem, keccak256, toHex } from "viem"
import { z } from "zod"

import { getPublicClient } from "@/evm/services/clients.js"
import { mcpToolRes } from "@/utils/helper.js"
import { defaultNetworkParam } from "../common/types.js"

// Common event signatures
const COMMON_EVENTS: Record<string, { signature: string; topic: Hex }> = {
  Transfer: {
    signature: "Transfer(address,address,uint256)",
    topic: keccak256(toHex("Transfer(address,address,uint256)"))
  },
  Approval: {
    signature: "Approval(address,address,uint256)",
    topic: keccak256(toHex("Approval(address,address,uint256)"))
  },
  Swap: {
    signature: "Swap(address,uint256,uint256,uint256,uint256,address)",
    topic: keccak256(toHex("Swap(address,uint256,uint256,uint256,uint256,address)"))
  },
  Sync: {
    signature: "Sync(uint112,uint112)",
    topic: keccak256(toHex("Sync(uint112,uint112)"))
  },
  Deposit: {
    signature: "Deposit(address,uint256)",
    topic: keccak256(toHex("Deposit(address,uint256)"))
  },
  Withdrawal: {
    signature: "Withdrawal(address,uint256)",
    topic: keccak256(toHex("Withdrawal(address,uint256)"))
  }
}

// ERC20 Transfer event ABI
const TRANSFER_EVENT_ABI = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)")
const APPROVAL_EVENT_ABI = parseAbiItem("event Approval(address indexed owner, address indexed spender, uint256 value)")

export function registerEventsTools(server: McpServer) {
  // Get logs by contract
  server.tool(
    "get_contract_logs",
    "Get event logs from a specific contract",
    {
      network: defaultNetworkParam,
      contractAddress: z.string().describe("Contract address to get logs from"),
      fromBlock: z.string().optional().describe("Start block (default: latest - 1000)"),
      toBlock: z.string().optional().describe("End block (default: latest)"),
      eventSignature: z.string().optional().describe("Event signature to filter (e.g., 'Transfer(address,address,uint256)')")
    },
    async ({ network, contractAddress, fromBlock, toBlock, eventSignature }) => {
      try {
        const publicClient = getPublicClient(network)
        const latestBlock = await publicClient.getBlockNumber()
        
        const from = fromBlock ? BigInt(fromBlock) : latestBlock - 1000n
        const to = toBlock ? BigInt(toBlock) : latestBlock

        let topics: [Hex] | undefined
        if (eventSignature) {
          topics = [keccak256(toHex(eventSignature))]
        }

        const logs = await publicClient.getLogs({
          address: contractAddress as Address,
          fromBlock: from,
          toBlock: to,
          topics
        })

        return mcpToolRes.success({
          network,
          contractAddress,
          fromBlock: from.toString(),
          toBlock: to.toString(),
          eventFilter: eventSignature || "all",
          logsCount: logs.length,
          logs: logs.slice(0, 100).map(log => ({
            blockNumber: log.blockNumber?.toString(),
            transactionHash: log.transactionHash,
            logIndex: log.logIndex,
            topics: log.topics,
            data: log.data
          })),
          truncated: logs.length > 100
        })
      } catch (error) {
        return mcpToolRes.error(error, "getting contract logs")
      }
    }
  )

  // Get ERC20 transfers
  server.tool(
    "get_erc20_transfers",
    "Get ERC20 token transfer events",
    {
      network: defaultNetworkParam,
      tokenAddress: z.string().describe("Token contract address"),
      fromAddress: z.string().optional().describe("Filter by sender"),
      toAddress: z.string().optional().describe("Filter by recipient"),
      fromBlock: z.string().optional().describe("Start block"),
      toBlock: z.string().optional().describe("End block"),
      limit: z.number().optional().describe("Max results (default: 50)")
    },
    async ({ network, tokenAddress, fromAddress, toAddress, fromBlock, toBlock, limit = 50 }) => {
      try {
        const publicClient = getPublicClient(network)
        const latestBlock = await publicClient.getBlockNumber()
        
        const from = fromBlock ? BigInt(fromBlock) : latestBlock - 5000n
        const to = toBlock ? BigInt(toBlock) : latestBlock

        // Build topics filter
        const topics: [Hex, Hex | null, Hex | null] = [
          COMMON_EVENTS.Transfer.topic,
          fromAddress ? `0x000000000000000000000000${fromAddress.slice(2).toLowerCase()}` as Hex : null,
          toAddress ? `0x000000000000000000000000${toAddress.slice(2).toLowerCase()}` as Hex : null
        ]

        const logs = await publicClient.getLogs({
          address: tokenAddress as Address,
          fromBlock: from,
          toBlock: to,
          topics
        })

        const transfers = logs.slice(0, limit).map(log => {
          try {
            const decoded = decodeEventLog({
              abi: [TRANSFER_EVENT_ABI],
              data: log.data,
              topics: log.topics
            })
            return {
              blockNumber: log.blockNumber?.toString(),
              transactionHash: log.transactionHash,
              from: (decoded.args as any).from,
              to: (decoded.args as any).to,
              value: (decoded.args as any).value.toString()
            }
          } catch {
            return {
              blockNumber: log.blockNumber?.toString(),
              transactionHash: log.transactionHash,
              raw: { topics: log.topics, data: log.data }
            }
          }
        })

        return mcpToolRes.success({
          network,
          tokenAddress,
          filters: { fromAddress, toAddress },
          blockRange: { from: from.toString(), to: to.toString() },
          totalFound: logs.length,
          transfers,
          truncated: logs.length > limit
        })
      } catch (error) {
        return mcpToolRes.error(error, "getting ERC20 transfers")
      }
    }
  )

  // Get approval events
  server.tool(
    "get_approval_events",
    "Get ERC20 approval events for a token or address",
    {
      network: defaultNetworkParam,
      tokenAddress: z.string().optional().describe("Token contract address"),
      ownerAddress: z.string().optional().describe("Filter by token owner"),
      spenderAddress: z.string().optional().describe("Filter by spender"),
      fromBlock: z.string().optional().describe("Start block"),
      toBlock: z.string().optional().describe("End block")
    },
    async ({ network, tokenAddress, ownerAddress, spenderAddress, fromBlock, toBlock }) => {
      try {
        const publicClient = getPublicClient(network)
        const latestBlock = await publicClient.getBlockNumber()
        
        const from = fromBlock ? BigInt(fromBlock) : latestBlock - 5000n
        const to = toBlock ? BigInt(toBlock) : latestBlock

        const topics: [Hex, Hex | null, Hex | null] = [
          COMMON_EVENTS.Approval.topic,
          ownerAddress ? `0x000000000000000000000000${ownerAddress.slice(2).toLowerCase()}` as Hex : null,
          spenderAddress ? `0x000000000000000000000000${spenderAddress.slice(2).toLowerCase()}` as Hex : null
        ]

        const logs = await publicClient.getLogs({
          address: tokenAddress as Address | undefined,
          fromBlock: from,
          toBlock: to,
          topics
        })

        const approvals = logs.slice(0, 100).map(log => {
          try {
            const decoded = decodeEventLog({
              abi: [APPROVAL_EVENT_ABI],
              data: log.data,
              topics: log.topics
            })
            return {
              blockNumber: log.blockNumber?.toString(),
              transactionHash: log.transactionHash,
              tokenAddress: log.address,
              owner: (decoded.args as any).owner,
              spender: (decoded.args as any).spender,
              value: (decoded.args as any).value.toString()
            }
          } catch {
            return {
              blockNumber: log.blockNumber?.toString(),
              transactionHash: log.transactionHash,
              tokenAddress: log.address,
              raw: true
            }
          }
        })

        return mcpToolRes.success({
          network,
          filters: { tokenAddress, ownerAddress, spenderAddress },
          blockRange: { from: from.toString(), to: to.toString() },
          totalFound: logs.length,
          approvals,
          truncated: logs.length > 100
        })
      } catch (error) {
        return mcpToolRes.error(error, "getting approval events")
      }
    }
  )

  // Get logs by topic
  server.tool(
    "get_logs_by_topic",
    "Get logs filtered by event topic hash",
    {
      network: defaultNetworkParam,
      topic0: z.string().describe("Primary topic (event signature hash)"),
      topic1: z.string().optional().describe("Second indexed parameter"),
      topic2: z.string().optional().describe("Third indexed parameter"),
      contractAddress: z.string().optional().describe("Contract address filter"),
      fromBlock: z.string().optional().describe("Start block"),
      toBlock: z.string().optional().describe("End block")
    },
    async ({ network, topic0, topic1, topic2, contractAddress, fromBlock, toBlock }) => {
      try {
        const publicClient = getPublicClient(network)
        const latestBlock = await publicClient.getBlockNumber()
        
        const from = fromBlock ? BigInt(fromBlock) : latestBlock - 1000n
        const to = toBlock ? BigInt(toBlock) : latestBlock

        const topics: (Hex | null)[] = [
          topic0 as Hex,
          topic1 ? topic1 as Hex : null,
          topic2 ? topic2 as Hex : null
        ]

        const logs = await publicClient.getLogs({
          address: contractAddress as Address | undefined,
          fromBlock: from,
          toBlock: to,
          topics: topics as [Hex, ...Hex[]]
        })

        return mcpToolRes.success({
          network,
          topics: { topic0, topic1, topic2 },
          contractAddress,
          blockRange: { from: from.toString(), to: to.toString() },
          logsCount: logs.length,
          logs: logs.slice(0, 100).map(log => ({
            address: log.address,
            blockNumber: log.blockNumber?.toString(),
            transactionHash: log.transactionHash,
            topics: log.topics,
            data: log.data
          })),
          truncated: logs.length > 100
        })
      } catch (error) {
        return mcpToolRes.error(error, "getting logs by topic")
      }
    }
  )

  // Get common event topics
  server.tool(
    "get_event_topics",
    "Get topic hashes for common events",
    {
      eventName: z.string().optional().describe("Specific event name (Transfer, Approval, Swap, etc.)")
    },
    async ({ eventName }) => {
      try {
        if (eventName) {
          const event = COMMON_EVENTS[eventName]
          if (!event) {
            return mcpToolRes.error(new Error(`Unknown event: ${eventName}`), "getting event topic")
          }
          return mcpToolRes.success({
            event: eventName,
            signature: event.signature,
            topic: event.topic
          })
        }

        const events = Object.entries(COMMON_EVENTS).map(([name, data]) => ({
          name,
          signature: data.signature,
          topic: data.topic
        }))

        return mcpToolRes.success({ events })
      } catch (error) {
        return mcpToolRes.error(error, "getting event topics")
      }
    }
  )

  // Calculate event signature
  server.tool(
    "calculate_event_signature",
    "Calculate the keccak256 topic hash for an event signature",
    {
      signature: z.string().describe("Event signature (e.g., 'Transfer(address,address,uint256)')")
    },
    async ({ signature }) => {
      try {
        const topic = keccak256(toHex(signature))
        return mcpToolRes.success({
          signature,
          topic
        })
      } catch (error) {
        return mcpToolRes.error(error, "calculating event signature")
      }
    }
  )

  // Watch for events (get recent + subscription info)
  server.tool(
    "get_recent_events",
    "Get recent events from the last N blocks for monitoring",
    {
      network: defaultNetworkParam,
      contractAddress: z.string().describe("Contract to monitor"),
      eventSignature: z.string().describe("Event signature to watch"),
      blocksBack: z.number().optional().describe("Number of blocks to look back (default: 100)")
    },
    async ({ network, contractAddress, eventSignature, blocksBack = 100 }) => {
      try {
        const publicClient = getPublicClient(network)
        const latestBlock = await publicClient.getBlockNumber()
        
        const topic = keccak256(toHex(eventSignature))

        const logs = await publicClient.getLogs({
          address: contractAddress as Address,
          fromBlock: latestBlock - BigInt(blocksBack),
          toBlock: latestBlock,
          topics: [topic]
        })

        // Group by block for activity analysis
        const byBlock: Record<string, number> = {}
        logs.forEach(log => {
          const block = log.blockNumber?.toString() || "unknown"
          byBlock[block] = (byBlock[block] || 0) + 1
        })

        return mcpToolRes.success({
          network,
          contractAddress,
          eventSignature,
          topic,
          latestBlock: latestBlock.toString(),
          blocksAnalyzed: blocksBack,
          totalEvents: logs.length,
          eventsPerBlock: Object.keys(byBlock).length > 0 ? 
            (logs.length / Object.keys(byBlock).length).toFixed(2) : "0",
          recentLogs: logs.slice(-20).map(log => ({
            blockNumber: log.blockNumber?.toString(),
            transactionHash: log.transactionHash,
            data: log.data.slice(0, 66) + (log.data.length > 66 ? "..." : "")
          }))
        })
      } catch (error) {
        return mcpToolRes.error(error, "getting recent events")
      }
    }
  )
}
