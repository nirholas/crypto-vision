/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Hash, Address } from "viem"
import { z } from "zod"

import { getPublicClient } from "@/evm/services/clients.js"
import * as services from "@/evm/services/index.js"
import { mcpToolRes } from "@/utils/helper"
import { defaultNetworkParam } from "../common/types"

export function registerBlockTools(server: McpServer) {
  // Get block by hash for a specific network
  server.tool(
    "get_block_by_hash",
    "Get a block by hash",
    {
      blockHash: z.string().describe("The block hash to look up"),
      network: defaultNetworkParam
    },
    async ({ network, blockHash }) => {
      try {
        const block = await services.getBlockByHash(blockHash as Hash, network)
        return mcpToolRes.success(block)
      } catch (error) {
        return mcpToolRes.error(error, "fetching block by hash")
      }
    }
  )

  // Get block by number for a specific network
  server.tool(
    "get_block_by_number",
    "Get a block by number",
    {
      blockNumber: z.string().describe("The block number to look up"),
      network: defaultNetworkParam
    },
    async ({ network, blockNumber }) => {
      try {
        const block = await services.getBlockByNumber(
          parseInt(blockNumber),
          network
        )
        return mcpToolRes.success(block)
      } catch (error) {
        return mcpToolRes.error(error, "fetching block by number")
      }
    }
  )

  // Get latest block for a specific network
  server.tool(
    "get_latest_block",
    "Get the latest block",
    {
      network: defaultNetworkParam
    },
    async ({ network }) => {
      try {
        const block = await services.getLatestBlock(network)
        return mcpToolRes.success(block)
      } catch (error) {
        return mcpToolRes.error(error, "fetching latest block")
      }
    }
  )

  // Get block with full transactions
  server.tool(
    "get_block_with_transactions",
    "Get a block with full transaction details (not just hashes)",
    {
      blockNumber: z
        .string()
        .optional()
        .describe("Block number (defaults to latest)"),
      network: defaultNetworkParam
    },
    async ({ blockNumber, network }) => {
      try {
        const publicClient = getPublicClient(network)

        const block = await publicClient.getBlock({
          blockNumber: blockNumber ? BigInt(blockNumber) : undefined,
          blockTag: blockNumber ? undefined : "latest",
          includeTransactions: true
        })

        return mcpToolRes.success({
          blockNumber: block.number.toString(),
          blockHash: block.hash,
          parentHash: block.parentHash,
          timestamp: Number(block.timestamp),
          timestampDate: new Date(Number(block.timestamp) * 1000).toISOString(),
          miner: block.miner,
          gasUsed: block.gasUsed.toString(),
          gasLimit: block.gasLimit.toString(),
          baseFeePerGas: block.baseFeePerGas?.toString() || null,
          transactionCount: block.transactions.length,
          transactions: block.transactions.map((tx: any) => ({
            hash: tx.hash,
            from: tx.from,
            to: tx.to,
            value: tx.value.toString(),
            gasPrice: tx.gasPrice?.toString(),
            maxFeePerGas: tx.maxFeePerGas?.toString(),
            maxPriorityFeePerGas: tx.maxPriorityFeePerGas?.toString(),
            input: tx.input?.slice(0, 66) + (tx.input?.length > 66 ? "..." : ""),
            nonce: tx.nonce,
            transactionIndex: tx.transactionIndex
          })),
          network
        })
      } catch (error) {
        return mcpToolRes.error(error, "fetching block with transactions")
      }
    }
  )

  // Get uncle blocks
  server.tool(
    "get_uncle_blocks",
    "Get uncle (ommer) blocks for a specific block. Uncle blocks are valid blocks that weren't included in the main chain.",
    {
      blockNumber: z.string().describe("The block number to get uncles for"),
      network: defaultNetworkParam
    },
    async ({ blockNumber, network }) => {
      try {
        const publicClient = getPublicClient(network)

        const block = await publicClient.getBlock({
          blockNumber: BigInt(blockNumber)
        })

        const uncleCount = await publicClient.getUncleCountByBlockNumber({
          blockNumber: BigInt(blockNumber)
        })

        // Get uncle blocks if any exist
        const uncles: any[] = []
        for (let i = 0; i < uncleCount; i++) {
          try {
            // Note: viem doesn't have a direct method for uncle blocks
            // This is a placeholder for the uncle hash from the block
            uncles.push({
              index: i,
              hash: block.uncles?.[i] || null
            })
          } catch (e) {
            // Skip if uncle not available
          }
        }

        return mcpToolRes.success({
          blockNumber: block.number.toString(),
          blockHash: block.hash,
          uncleCount,
          uncleHashes: block.uncles || [],
          network,
          note:
            "Uncle blocks are more common on Ethereum mainnet. Many L2s and newer chains don't have uncles."
        })
      } catch (error) {
        return mcpToolRes.error(error, "fetching uncle blocks")
      }
    }
  )

  // Get block receipts (all transaction receipts for a block)
  server.tool(
    "get_block_receipts",
    "Get all transaction receipts for a specific block",
    {
      blockNumber: z.string().describe("The block number to get receipts for"),
      network: defaultNetworkParam
    },
    async ({ blockNumber, network }) => {
      try {
        const publicClient = getPublicClient(network)

        const block = await publicClient.getBlock({
          blockNumber: BigInt(blockNumber),
          includeTransactions: true
        })

        // Get receipts for all transactions in the block
        const receiptPromises = block.transactions.map((tx: any) =>
          publicClient.getTransactionReceipt({ hash: tx.hash || tx })
        )

        const receipts = await Promise.all(receiptPromises)

        const summary = {
          totalTransactions: receipts.length,
          successfulTransactions: receipts.filter((r) => r.status === "success")
            .length,
          failedTransactions: receipts.filter((r) => r.status === "reverted")
            .length,
          totalGasUsed: receipts
            .reduce((acc, r) => acc + r.gasUsed, BigInt(0))
            .toString(),
          totalLogs: receipts.reduce((acc, r) => acc + r.logs.length, 0),
          contractsCreated: receipts.filter((r) => r.contractAddress).length
        }

        return mcpToolRes.success({
          blockNumber: block.number.toString(),
          blockHash: block.hash,
          summary,
          receipts: receipts.map((r) => ({
            transactionHash: r.transactionHash,
            status: r.status,
            from: r.from,
            to: r.to,
            contractAddress: r.contractAddress,
            gasUsed: r.gasUsed.toString(),
            effectiveGasPrice: r.effectiveGasPrice.toString(),
            logsCount: r.logs.length,
            type: r.type
          })),
          network
        })
      } catch (error) {
        return mcpToolRes.error(error, "fetching block receipts")
      }
    }
  )

  // Get block range
  server.tool(
    "get_block_range",
    "Get a range of blocks with summary information",
    {
      startBlock: z.string().describe("Starting block number"),
      endBlock: z
        .string()
        .optional()
        .describe("Ending block number (defaults to latest)"),
      network: defaultNetworkParam
    },
    async ({ startBlock, endBlock, network }) => {
      try {
        const publicClient = getPublicClient(network)
        const latestBlock = await publicClient.getBlockNumber()

        const start = BigInt(startBlock)
        const end = endBlock ? BigInt(endBlock) : latestBlock

        if (end - start > BigInt(100)) {
          throw new Error(
            "Block range too large. Maximum 100 blocks at a time."
          )
        }

        const blockPromises: Promise<any>[] = []
        for (let i = start; i <= end; i++) {
          blockPromises.push(publicClient.getBlock({ blockNumber: i }))
        }

        const blocks = await Promise.all(blockPromises)

        const totalGasUsed = blocks.reduce(
          (acc, b) => acc + b.gasUsed,
          BigInt(0)
        )
        const totalTxCount = blocks.reduce(
          (acc, b) => acc + b.transactions.length,
          0
        )

        return mcpToolRes.success({
          startBlock: start.toString(),
          endBlock: end.toString(),
          blockCount: blocks.length,
          summary: {
            totalTransactions: totalTxCount,
            averageTransactionsPerBlock: totalTxCount / blocks.length,
            totalGasUsed: totalGasUsed.toString(),
            averageGasUsed: (totalGasUsed / BigInt(blocks.length)).toString(),
            timeRange: {
              start: Number(blocks[0].timestamp),
              end: Number(blocks[blocks.length - 1].timestamp),
              durationSeconds:
                Number(blocks[blocks.length - 1].timestamp) -
                Number(blocks[0].timestamp)
            }
          },
          blocks: blocks.map((b) => ({
            number: b.number.toString(),
            hash: b.hash,
            timestamp: Number(b.timestamp),
            transactionCount: b.transactions.length,
            gasUsed: b.gasUsed.toString(),
            gasLimit: b.gasLimit.toString(),
            baseFeePerGas: b.baseFeePerGas?.toString() || null,
            miner: b.miner
          })),
          network
        })
      } catch (error) {
        return mcpToolRes.error(error, "fetching block range")
      }
    }
  )

  // Get block producer/miner rewards estimate
  server.tool(
    "get_block_rewards",
    "Estimate block rewards for miners/validators on a specific block",
    {
      blockNumber: z
        .string()
        .optional()
        .describe("Block number (defaults to latest)"),
      network: defaultNetworkParam
    },
    async ({ blockNumber, network }) => {
      try {
        const publicClient = getPublicClient(network)

        const block = await publicClient.getBlock({
          blockNumber: blockNumber ? BigInt(blockNumber) : undefined,
          blockTag: blockNumber ? undefined : "latest",
          includeTransactions: true
        })

        // Get all transaction receipts to calculate fees
        const receiptPromises = block.transactions.map((tx: any) =>
          publicClient.getTransactionReceipt({ hash: tx.hash || tx })
        )
        const receipts = await Promise.all(receiptPromises)

        // Calculate total transaction fees
        let totalFees = BigInt(0)
        let totalPriorityFees = BigInt(0)

        for (const receipt of receipts) {
          const gasUsed = receipt.gasUsed
          const effectiveGasPrice = receipt.effectiveGasPrice

          totalFees += gasUsed * effectiveGasPrice

          if (block.baseFeePerGas) {
            const priorityFee = effectiveGasPrice - block.baseFeePerGas
            if (priorityFee > 0) {
              totalPriorityFees += gasUsed * priorityFee
            }
          }
        }

        // Base block reward varies by network
        const chainId = await publicClient.getChainId()
        let baseReward = BigInt(0)

        // Ethereum post-merge has no block reward (PoS)
        // BSC has 0.1 BNB per block
        // Polygon has variable rewards
        if (chainId === 56) {
          baseReward = BigInt(100000000000000000) // 0.1 BNB
        } else if (chainId === 137) {
          baseReward = BigInt(0) // Polygon rewards are different
        }
        // Ethereum mainnet (1) is PoS, no block reward

        const totalReward = baseReward + totalPriorityFees

        return mcpToolRes.success({
          blockNumber: block.number.toString(),
          blockHash: block.hash,
          miner: block.miner,
          baseFeePerGas: block.baseFeePerGas?.toString() || "0",
          rewards: {
            baseBlockReward: baseReward.toString(),
            baseBlockRewardEther: Number(baseReward) / 1e18,
            transactionFees: totalFees.toString(),
            transactionFeesEther: Number(totalFees) / 1e18,
            priorityFees: totalPriorityFees.toString(),
            priorityFeesEther: Number(totalPriorityFees) / 1e18,
            totalMinerReward: totalReward.toString(),
            totalMinerRewardEther: Number(totalReward) / 1e18,
            burntFees: block.baseFeePerGas
              ? (block.baseFeePerGas * block.gasUsed).toString()
              : "0"
          },
          transactionCount: receipts.length,
          network
        })
      } catch (error) {
        return mcpToolRes.error(error, "calculating block rewards")
      }
    }
  )

  // Get blocks by miner/validator
  server.tool(
    "get_blocks_by_miner",
    "Find recent blocks produced by a specific miner/validator address",
    {
      minerAddress: z
        .string()
        .describe("The miner/validator address to search for"),
      blockCount: z
        .number()
        .min(1)
        .max(1000)
        .default(100)
        .describe("Number of recent blocks to search (1-1000)"),
      network: defaultNetworkParam
    },
    async ({ minerAddress, blockCount, network }) => {
      try {
        const publicClient = getPublicClient(network)
        const latestBlock = await publicClient.getBlockNumber()

        const minerBlocks: any[] = []
        const searchAddress = minerAddress.toLowerCase()

        // Search through recent blocks
        for (
          let i = latestBlock;
          i > latestBlock - BigInt(blockCount) && i > 0;
          i--
        ) {
          const block = await publicClient.getBlock({ blockNumber: i })
          if (block.miner.toLowerCase() === searchAddress) {
            minerBlocks.push({
              number: block.number.toString(),
              hash: block.hash,
              timestamp: Number(block.timestamp),
              transactionCount: block.transactions.length,
              gasUsed: block.gasUsed.toString()
            })
          }

          if (minerBlocks.length >= 20) break // Limit results
        }

        return mcpToolRes.success({
          minerAddress,
          blocksSearched: blockCount,
          blocksFound: minerBlocks.length,
          blocks: minerBlocks,
          network
        })
      } catch (error) {
        return mcpToolRes.error(error, "searching blocks by miner")
      }
    }
  )
}
