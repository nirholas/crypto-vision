/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { normalize } from "viem/ens"
import { z } from "zod"

import { getChain, getRpcUrl, getSupportedNetworks, chainMap } from "@/evm/chains.js"
import { getPublicClient } from "@/evm/services/clients.js"
import * as services from "@/evm/services/index.js"
import { mcpToolRes } from "@/utils/helper"
import { defaultNetworkParam } from "../common/types.js"

export function registerNetworkTools(server: McpServer) {
  // Get EVM info for a specific network
  server.tool(
    "get_chain_info",
    "Get chain information for a specific network",
    {
      network: defaultNetworkParam
    },
    async ({ network }) => {
      try {
        const chainId = await services.getChainId(network)
        const blockNumber = await services.getBlockNumber(network)
        const rpcUrl = getRpcUrl(network)

        return mcpToolRes.success({
          network,
          chainId,
          blockNumber: blockNumber.toString(),
          rpcUrl
        })
      } catch (error) {
        return mcpToolRes.error(error, "fetching chain info")
      }
    }
  )

  // Get supported networks
  server.tool(
    "get_supported_networks",
    "Get list of supported networks",
    {},
    async () => {
      try {
        const networks = getSupportedNetworks()
        return mcpToolRes.success({
          supportedNetworks: networks
        })
      } catch (error) {
        return mcpToolRes.error(error, "fetching supported networks")
      }
    }
  )

  // Estimate block time
  server.tool(
    "estimate_block_time",
    "Estimate the average block time for a network by analyzing recent blocks",
    {
      network: defaultNetworkParam,
      sampleSize: z
        .number()
        .min(5)
        .max(100)
        .default(20)
        .describe("Number of recent blocks to sample for estimation (5-100)")
    },
    async ({ network, sampleSize }) => {
      try {
        const publicClient = getPublicClient(network)
        const latestBlock = await publicClient.getBlock()
        const latestBlockNumber = latestBlock.number

        // Get the block from sampleSize blocks ago
        const olderBlock = await publicClient.getBlock({
          blockNumber: latestBlockNumber - BigInt(sampleSize)
        })

        const timeDiff = Number(latestBlock.timestamp - olderBlock.timestamp)
        const avgBlockTime = timeDiff / sampleSize

        return mcpToolRes.success({
          network,
          averageBlockTimeSeconds: avgBlockTime,
          averageBlockTimeMs: avgBlockTime * 1000,
          blocksPerMinute: 60 / avgBlockTime,
          blocksPerHour: 3600 / avgBlockTime,
          blocksPerDay: 86400 / avgBlockTime,
          sampleSize,
          fromBlock: olderBlock.number.toString(),
          toBlock: latestBlock.number.toString()
        })
      } catch (error) {
        return mcpToolRes.error(error, "estimating block time")
      }
    }
  )

  // Get finality status
  server.tool(
    "get_finality_status",
    "Get the finality status for a block or transaction on the network",
    {
      network: defaultNetworkParam,
      blockNumber: z
        .string()
        .optional()
        .describe("Block number to check finality for (defaults to latest)")
    },
    async ({ network, blockNumber }) => {
      try {
        const publicClient = getPublicClient(network)
        const chain = getChain(network)

        const [latestBlock, finalizedBlock, safeBlock] = await Promise.all([
          publicClient.getBlock({ blockTag: "latest" }),
          publicClient.getBlock({ blockTag: "finalized" }).catch(() => null),
          publicClient.getBlock({ blockTag: "safe" }).catch(() => null)
        ])

        const targetBlockNum = blockNumber
          ? BigInt(blockNumber)
          : latestBlock.number

        const targetBlock = blockNumber
          ? await publicClient.getBlock({ blockNumber: targetBlockNum })
          : latestBlock

        const confirmations = Number(latestBlock.number - targetBlockNum)

        let finalityStatus = "pending"
        if (finalizedBlock && targetBlockNum <= finalizedBlock.number) {
          finalityStatus = "finalized"
        } else if (safeBlock && targetBlockNum <= safeBlock.number) {
          finalityStatus = "safe"
        } else if (confirmations >= 12) {
          finalityStatus = "highly_confirmed"
        } else if (confirmations >= 6) {
          finalityStatus = "confirmed"
        } else if (confirmations >= 1) {
          finalityStatus = "included"
        }

        return mcpToolRes.success({
          network,
          blockNumber: targetBlockNum.toString(),
          blockHash: targetBlock.hash,
          confirmations,
          finalityStatus,
          latestBlock: latestBlock.number.toString(),
          finalizedBlock: finalizedBlock?.number?.toString() || "not_supported",
          safeBlock: safeBlock?.number?.toString() || "not_supported",
          estimatedFinalityBlocks: chain.id === 1 ? 64 : chain.id === 137 ? 256 : 12
        })
      } catch (error) {
        return mcpToolRes.error(error, "checking finality status")
      }
    }
  )

  // Get mempool/pending transactions count
  server.tool(
    "get_pending_transactions_info",
    "Get information about pending transactions in the mempool for a network",
    {
      network: defaultNetworkParam,
      address: z
        .string()
        .optional()
        .describe("Optional address to check pending transactions for")
    },
    async ({ network, address }) => {
      try {
        const publicClient = getPublicClient(network)

        const [latestBlock, pendingBlock] = await Promise.all([
          publicClient.getBlock({ blockTag: "latest" }),
          publicClient.getBlock({ blockTag: "pending" }).catch(() => null)
        ])

        let addressPendingInfo = null
        if (address) {
          const [pendingNonce, latestNonce, pendingBalance, latestBalance] =
            await Promise.all([
              publicClient.getTransactionCount({
                address: address as `0x${string}`,
                blockTag: "pending"
              }),
              publicClient.getTransactionCount({
                address: address as `0x${string}`,
                blockTag: "latest"
              }),
              publicClient.getBalance({
                address: address as `0x${string}`,
                blockTag: "pending"
              }),
              publicClient.getBalance({
                address: address as `0x${string}`,
                blockTag: "latest"
              })
            ])

          addressPendingInfo = {
            address,
            pendingNonce,
            confirmedNonce: latestNonce,
            pendingTransactionCount: pendingNonce - latestNonce,
            pendingBalance: pendingBalance.toString(),
            confirmedBalance: latestBalance.toString(),
            balanceDelta: (pendingBalance - latestBalance).toString()
          }
        }

        return mcpToolRes.success({
          network,
          latestBlockNumber: latestBlock.number.toString(),
          latestBlockTxCount: latestBlock.transactions.length,
          pendingBlockAvailable: !!pendingBlock,
          pendingBlockTxCount: pendingBlock?.transactions?.length || 0,
          ...(addressPendingInfo && { addressPendingInfo })
        })
      } catch (error) {
        return mcpToolRes.error(error, "fetching pending transactions info")
      }
    }
  )

  // Get network metadata
  server.tool(
    "get_network_metadata",
    "Get comprehensive metadata about a network including explorers, native currency, and features",
    {
      network: defaultNetworkParam
    },
    async ({ network }) => {
      try {
        const chain = getChain(network)
        const publicClient = getPublicClient(network)
        const rpcUrl = getRpcUrl(network)

        const [chainId, blockNumber, gasPrice] = await Promise.all([
          publicClient.getChainId(),
          publicClient.getBlockNumber(),
          publicClient.getGasPrice()
        ])

        return mcpToolRes.success({
          network,
          chainId,
          name: chain.name,
          nativeCurrency: chain.nativeCurrency,
          blockExplorers: chain.blockExplorers,
          rpcUrl,
          currentBlockNumber: blockNumber.toString(),
          currentGasPrice: gasPrice.toString(),
          currentGasPriceGwei: Number(gasPrice) / 1e9,
          testnet: chain.testnet || false,
          features: {
            eip1559: chain.fees?.baseFeeMultiplier !== undefined,
            eip155: true
          },
          contracts: chain.contracts || {}
        })
      } catch (error) {
        return mcpToolRes.error(error, "fetching network metadata")
      }
    }
  )

  // Get gas oracle
  server.tool(
    "get_gas_oracle",
    "Get comprehensive gas price recommendations for different speed tiers",
    {
      network: defaultNetworkParam
    },
    async ({ network }) => {
      try {
        const publicClient = getPublicClient(network)

        const [gasPrice, block, feeHistory] = await Promise.all([
          publicClient.getGasPrice(),
          publicClient.getBlock({ blockTag: "latest" }),
          publicClient.getFeeHistory({
            blockCount: 10,
            rewardPercentiles: [10, 25, 50, 75, 90]
          }).catch(() => null)
        ])

        const baseFee = block.baseFeePerGas
        const gasPriceGwei = Number(gasPrice) / 1e9

        // Calculate priority fee suggestions
        let priorityFees = {
          slow: 1,
          standard: 1.5,
          fast: 2,
          instant: 3
        }

        if (feeHistory?.reward) {
          const avgRewards = feeHistory.reward.reduce(
            (acc, rewards) => {
              return rewards.map((r, i) => acc[i] + Number(r) / 1e9)
            },
            [0, 0, 0, 0, 0]
          ).map(sum => sum / feeHistory.reward.length)

          priorityFees = {
            slow: avgRewards[0] || 1,
            standard: avgRewards[2] || 1.5,
            fast: avgRewards[3] || 2,
            instant: avgRewards[4] || 3
          }
        }

        const baseFeeGwei = baseFee ? Number(baseFee) / 1e9 : gasPriceGwei

        return mcpToolRes.success({
          network,
          currentGasPrice: gasPriceGwei,
          baseFee: baseFeeGwei,
          recommendations: {
            slow: {
              maxFeePerGas: baseFeeGwei * 1.1 + priorityFees.slow,
              maxPriorityFeePerGas: priorityFees.slow,
              estimatedTime: "5+ minutes"
            },
            standard: {
              maxFeePerGas: baseFeeGwei * 1.25 + priorityFees.standard,
              maxPriorityFeePerGas: priorityFees.standard,
              estimatedTime: "1-3 minutes"
            },
            fast: {
              maxFeePerGas: baseFeeGwei * 1.5 + priorityFees.fast,
              maxPriorityFeePerGas: priorityFees.fast,
              estimatedTime: "15-30 seconds"
            },
            instant: {
              maxFeePerGas: baseFeeGwei * 2 + priorityFees.instant,
              maxPriorityFeePerGas: priorityFees.instant,
              estimatedTime: "< 15 seconds"
            }
          },
          blockUtilization: block.gasUsed && block.gasLimit
            ? Number((block.gasUsed * BigInt(100)) / block.gasLimit)
            : null
        })
      } catch (error) {
        return mcpToolRes.error(error, "fetching gas oracle")
      }
    }
  )

  // Get network health/status
  server.tool(
    "get_network_health",
    "Check the health and synchronization status of the network connection",
    {
      network: defaultNetworkParam
    },
    async ({ network }) => {
      try {
        const publicClient = getPublicClient(network)
        const startTime = Date.now()

        const [chainId, blockNumber, gasPrice, block] = await Promise.all([
          publicClient.getChainId(),
          publicClient.getBlockNumber(),
          publicClient.getGasPrice(),
          publicClient.getBlock({ blockTag: "latest" })
        ])

        const latency = Date.now() - startTime
        const blockAge = Date.now() / 1000 - Number(block.timestamp)

        let healthStatus = "healthy"
        const issues: string[] = []

        if (latency > 5000) {
          healthStatus = "degraded"
          issues.push("High RPC latency")
        }
        if (blockAge > 60) {
          healthStatus = "degraded"
          issues.push("Block is stale (>60s old)")
        }
        if (blockAge > 300) {
          healthStatus = "unhealthy"
          issues.push("Block is very stale (>5min old)")
        }

        return mcpToolRes.success({
          network,
          healthStatus,
          issues: issues.length > 0 ? issues : ["None"],
          metrics: {
            rpcLatencyMs: latency,
            chainId,
            currentBlock: blockNumber.toString(),
            blockTimestamp: Number(block.timestamp),
            blockAgeSeconds: Math.round(blockAge),
            gasPrice: gasPrice.toString(),
            gasPriceGwei: Number(gasPrice) / 1e9
          },
          rpcUrl: getRpcUrl(network)
        })
      } catch (error) {
        return mcpToolRes.error(error, "checking network health")
      }
    }
  )
}
