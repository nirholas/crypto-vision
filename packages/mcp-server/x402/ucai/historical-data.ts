/**
 * UCAI Historical Contract Data Service
 * @description x402-powered historical data queries for smart contracts
 * @author nirholas
 * @license Apache-2.0
 * @price $0.02 per query
 */

import {
  createPublicClient,
  http,
  decodeEventLog,
  decodeFunctionData,
  formatEther,
  formatUnits,
  parseAbi,
  type Address,
  type Hash,
  type Hex,
  type Log,
} from "viem"
import { arbitrum, base, mainnet, polygon, optimism, bsc } from "viem/chains"
import type {
  HistoricalDataRequest,
  HistoricalDataResult,
  HistoricalTransaction,
  HistoricalEventLog,
  HistoricalStateChange,
  HistoricalDataType,
} from "./types.js"
import { UCAI_PRICING } from "./types.js"
import Logger from "@/utils/logger.js"

// Chain configurations
const CHAINS: Record<string, typeof mainnet> = {
  ethereum: mainnet,
  arbitrum,
  base,
  polygon,
  optimism,
  bsc,
}

// Block explorer APIs
const EXPLORER_APIS: Record<string, string> = {
  ethereum: "https://api.etherscan.io/api",
  arbitrum: "https://api.arbiscan.io/api",
  base: "https://api.basescan.org/api",
  polygon: "https://api.polygonscan.com/api",
  optimism: "https://api-optimistic.etherscan.io/api",
  bsc: "https://api.bscscan.com/api",
}

// Common event signatures
const COMMON_EVENTS = {
  Transfer: "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
  Approval: "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925",
  OwnershipTransferred: "0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0",
  Paused: "0x62e78cea01bee320cd4e420270b5ea74000d11b0c9f74754ebdbfc544b05a258",
  Unpaused: "0x5db9ee0a495bf2e6ff9c91a7834c1ba4fdd244a5e8aa4e537bd38aeae4b073aa",
}

// ERC20 ABI for parsing
const ERC20_ABI = parseAbi([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
])

// Default limits
const DEFAULT_LIMIT = 100
const MAX_LIMIT = 1000
const MAX_BLOCK_RANGE = 10000n

/**
 * Historical Contract Data Service
 * 
 * Queries historical data for smart contracts including
 * transactions, events, and state changes.
 */
export class HistoricalDataService {
  private explorerApiKeys: Record<string, string> = {}

  constructor(apiKeys?: Record<string, string>) {
    this.explorerApiKeys = apiKeys ?? {
      ethereum: process.env.ETHERSCAN_API_KEY ?? "",
      arbitrum: process.env.ARBISCAN_API_KEY ?? "",
      base: process.env.BASESCAN_API_KEY ?? "",
      polygon: process.env.POLYGONSCAN_API_KEY ?? "",
      optimism: process.env.OPTIMISTIC_API_KEY ?? "",
      bsc: process.env.BSCSCAN_API_KEY ?? "",
    }
  }

  /**
   * Query historical data for a contract
   * 
   * @param request - Historical data request
   * @returns Historical data result
   */
  async queryHistoricalData(request: HistoricalDataRequest): Promise<HistoricalDataResult> {
    const { contractAddress, network, dataType, fromBlock, toBlock, eventFilter, limit } = request

    const chain = CHAINS[network]
    if (!chain) {
      throw new Error(`Unsupported network: ${network}`)
    }

    const publicClient = createPublicClient({
      chain,
      transport: http(),
    })

    Logger.info(`Querying ${dataType} for ${contractAddress} on ${network}`)

    // Get current block
    const latestBlock = await publicClient.getBlockNumber()

    // Determine block range
    const startBlock = fromBlock === "earliest" ? 0n : (fromBlock ?? latestBlock - MAX_BLOCK_RANGE)
    const endBlock = toBlock === "latest" ? latestBlock : (toBlock ?? latestBlock)

    // Initialize result
    const result: HistoricalDataResult = {
      contractAddress,
      network,
      dataType,
      blockRange: {
        from: startBlock,
        to: endBlock,
      },
      totalCount: 0,
      hasMore: false,
    }

    // Query based on data type
    switch (dataType) {
      case "transactions":
        result.transactions = await this.queryTransactions(
          contractAddress,
          network,
          startBlock,
          endBlock,
          limit ?? DEFAULT_LIMIT
        )
        result.totalCount = result.transactions.length
        break

      case "event_logs":
        result.events = await this.queryEventLogs(
          publicClient,
          contractAddress,
          startBlock,
          endBlock,
          eventFilter,
          limit ?? DEFAULT_LIMIT
        )
        result.totalCount = result.events.length
        break

      case "state_changes":
        result.stateChanges = await this.queryStateChanges(
          publicClient,
          contractAddress,
          network,
          startBlock,
          endBlock,
          limit ?? DEFAULT_LIMIT
        )
        result.totalCount = result.stateChanges.length
        break

      case "balance_history":
        // This would require archive node or external service
        result.events = await this.queryBalanceChanges(
          publicClient,
          contractAddress,
          startBlock,
          endBlock,
          limit ?? DEFAULT_LIMIT
        )
        result.totalCount = result.events?.length ?? 0
        break

      case "function_calls":
        result.transactions = await this.queryFunctionCalls(
          contractAddress,
          network,
          startBlock,
          endBlock,
          limit ?? DEFAULT_LIMIT
        )
        result.totalCount = result.transactions.length
        break

      default:
        throw new Error(`Unknown data type: ${dataType}`)
    }

    result.hasMore = result.totalCount >= (limit ?? DEFAULT_LIMIT)

    return result
  }

  /**
   * Query transactions to/from a contract
   */
  private async queryTransactions(
    contractAddress: Address,
    network: string,
    fromBlock: bigint,
    toBlock: bigint,
    limit: number
  ): Promise<HistoricalTransaction[]> {
    const apiUrl = EXPLORER_APIS[network]
    const apiKey = this.explorerApiKeys[network]

    if (!apiUrl) {
      throw new Error(`No explorer API for network: ${network}`)
    }

    try {
      // Query internal and external transactions
      const [normalTxs, internalTxs] = await Promise.all([
        this.fetchExplorerApi(apiUrl, {
          module: "account",
          action: "txlist",
          address: contractAddress,
          startblock: fromBlock.toString(),
          endblock: toBlock.toString(),
          page: "1",
          offset: limit.toString(),
          sort: "desc",
          apikey: apiKey,
        }),
        this.fetchExplorerApi(apiUrl, {
          module: "account",
          action: "txlistinternal",
          address: contractAddress,
          startblock: fromBlock.toString(),
          endblock: toBlock.toString(),
          page: "1",
          offset: limit.toString(),
          sort: "desc",
          apikey: apiKey,
        }),
      ])

      const transactions: HistoricalTransaction[] = []

      // Parse normal transactions
      if (normalTxs.status === "1" && Array.isArray(normalTxs.result)) {
        for (const tx of normalTxs.result) {
          transactions.push({
            hash: tx.hash as Hash,
            blockNumber: BigInt(tx.blockNumber),
            timestamp: parseInt(tx.timeStamp),
            from: tx.from as Address,
            to: tx.to as Address,
            value: BigInt(tx.value),
            functionName: this.extractFunctionName(tx.input),
            gasUsed: BigInt(tx.gasUsed),
            status: tx.isError === "0" ? "success" : "failed",
          })
        }
      }

      return transactions.slice(0, limit)
    } catch (error) {
      Logger.error("Failed to query transactions:", error)
      return []
    }
  }

  /**
   * Query event logs from a contract
   */
  private async queryEventLogs(
    client: ReturnType<typeof createPublicClient>,
    contractAddress: Address,
    fromBlock: bigint,
    toBlock: bigint,
    eventFilter?: { eventName?: string; topics?: (Hex | null)[] },
    limit: number = DEFAULT_LIMIT
  ): Promise<HistoricalEventLog[]> {
    const events: HistoricalEventLog[] = []

    try {
      // Build topic filter
      const topics: (Hex | null | Hex[])[] = []
      
      if (eventFilter?.eventName) {
        const eventSignature = COMMON_EVENTS[eventFilter.eventName as keyof typeof COMMON_EVENTS]
        if (eventSignature) {
          topics.push(eventSignature as Hex)
        }
      }

      if (eventFilter?.topics) {
        topics.push(...eventFilter.topics)
      }

      // Get logs in chunks if block range is large
      const chunkSize = MAX_BLOCK_RANGE
      let currentFrom = fromBlock

      while (currentFrom < toBlock && events.length < limit) {
        const currentTo = currentFrom + chunkSize > toBlock 
          ? toBlock 
          : currentFrom + chunkSize

        const logs = await client.getLogs({
          address: contractAddress,
          fromBlock: currentFrom,
          toBlock: currentTo,
          topics: topics.length > 0 ? topics : undefined,
        })

        // Get block timestamps
        const blockTimestamps = new Map<bigint, number>()

        for (const log of logs) {
          if (events.length >= limit) break

          // Get timestamp if not cached
          if (!blockTimestamps.has(log.blockNumber)) {
            try {
              const block = await client.getBlock({ blockNumber: log.blockNumber })
              blockTimestamps.set(log.blockNumber, Number(block.timestamp))
            } catch {
              blockTimestamps.set(log.blockNumber, 0)
            }
          }

          // Try to decode the event
          let eventName = "Unknown"
          let decodedArgs: Record<string, unknown> = {}

          // Check against known events
          for (const [name, sig] of Object.entries(COMMON_EVENTS)) {
            if (log.topics[0] === sig) {
              eventName = name
              break
            }
          }

          events.push({
            transactionHash: log.transactionHash,
            blockNumber: log.blockNumber,
            logIndex: log.logIndex,
            timestamp: blockTimestamps.get(log.blockNumber) ?? 0,
            eventName,
            signature: log.topics[0] ?? "0x",
            args: decodedArgs,
            topics: log.topics as Hex[],
            data: log.data,
          })
        }

        currentFrom = currentTo + 1n
      }

      return events
    } catch (error) {
      Logger.error("Failed to query event logs:", error)
      return []
    }
  }

  /**
   * Query state changes for a contract
   */
  private async queryStateChanges(
    client: ReturnType<typeof createPublicClient>,
    contractAddress: Address,
    network: string,
    fromBlock: bigint,
    toBlock: bigint,
    limit: number
  ): Promise<HistoricalStateChange[]> {
    // State changes require trace/debug APIs or archive node
    // For now, we approximate by looking at storage slots in key transactions
    
    const stateChanges: HistoricalStateChange[] = []

    // This would typically use:
    // 1. debug_traceBlockByNumber with storage tracer
    // 2. External archive services like Alchemy/Infura
    // 3. TheGraph for indexed state

    Logger.warn("State change queries require archive node or external service")

    return stateChanges
  }

  /**
   * Query balance changes (via Transfer events)
   */
  private async queryBalanceChanges(
    client: ReturnType<typeof createPublicClient>,
    contractAddress: Address,
    fromBlock: bigint,
    toBlock: bigint,
    limit: number
  ): Promise<HistoricalEventLog[]> {
    // Query Transfer events to/from the contract
    return this.queryEventLogs(
      client,
      contractAddress,
      fromBlock,
      toBlock,
      { topics: [COMMON_EVENTS.Transfer as Hex] },
      limit
    )
  }

  /**
   * Query specific function calls to a contract
   */
  private async queryFunctionCalls(
    contractAddress: Address,
    network: string,
    fromBlock: bigint,
    toBlock: bigint,
    limit: number
  ): Promise<HistoricalTransaction[]> {
    // Get all transactions and filter by function calls (input data not empty)
    const transactions = await this.queryTransactions(
      contractAddress,
      network,
      fromBlock,
      toBlock,
      limit * 2 // Fetch more to filter
    )

    return transactions
      .filter(tx => tx.functionName && tx.functionName !== "transfer")
      .slice(0, limit)
  }

  /**
   * Fetch data from block explorer API
   */
  private async fetchExplorerApi(
    baseUrl: string,
    params: Record<string, string>
  ): Promise<any> {
    const url = new URL(baseUrl)
    for (const [key, value] of Object.entries(params)) {
      if (value) {
        url.searchParams.set(key, value)
      }
    }

    const response = await fetch(url.toString())
    return response.json()
  }

  /**
   * Extract function name from input data
   */
  private extractFunctionName(input: string): string | undefined {
    if (!input || input === "0x" || input.length < 10) {
      return undefined
    }

    // Common function selectors
    const selectors: Record<string, string> = {
      "0xa9059cbb": "transfer",
      "0x23b872dd": "transferFrom",
      "0x095ea7b3": "approve",
      "0x70a08231": "balanceOf",
      "0x18160ddd": "totalSupply",
      "0x313ce567": "decimals",
      "0x06fdde03": "name",
      "0x95d89b41": "symbol",
      "0x715018a6": "renounceOwnership",
      "0xf2fde38b": "transferOwnership",
      "0x5c975abb": "paused",
      "0x8456cb59": "pause",
      "0x3f4ba83a": "unpause",
    }

    const selector = input.slice(0, 10).toLowerCase()
    return selectors[selector]
  }

  /**
   * Get aggregate statistics for a contract
   */
  async getContractStats(
    contractAddress: Address,
    network: string
  ): Promise<{
    totalTransactions: number
    uniqueUsers: number
    totalValueTransferred: string
    firstTransaction?: HistoricalTransaction
    lastTransaction?: HistoricalTransaction
  }> {
    const apiUrl = EXPLORER_APIS[network]
    const apiKey = this.explorerApiKeys[network]

    if (!apiUrl) {
      throw new Error(`No explorer API for network: ${network}`)
    }

    try {
      const response = await this.fetchExplorerApi(apiUrl, {
        module: "account",
        action: "txlist",
        address: contractAddress,
        startblock: "0",
        endblock: "99999999",
        page: "1",
        offset: "10000",
        sort: "asc",
        apikey: apiKey,
      })

      if (response.status !== "1" || !Array.isArray(response.result)) {
        return {
          totalTransactions: 0,
          uniqueUsers: 0,
          totalValueTransferred: "0",
        }
      }

      const transactions = response.result
      const uniqueAddresses = new Set<string>()
      let totalValue = 0n

      for (const tx of transactions) {
        uniqueAddresses.add(tx.from.toLowerCase())
        if (tx.to) {
          uniqueAddresses.add(tx.to.toLowerCase())
        }
        totalValue += BigInt(tx.value)
      }

      return {
        totalTransactions: transactions.length,
        uniqueUsers: uniqueAddresses.size,
        totalValueTransferred: formatEther(totalValue),
        firstTransaction: transactions.length > 0 ? {
          hash: transactions[0].hash,
          blockNumber: BigInt(transactions[0].blockNumber),
          timestamp: parseInt(transactions[0].timeStamp),
          from: transactions[0].from,
          to: transactions[0].to,
          value: BigInt(transactions[0].value),
          gasUsed: BigInt(transactions[0].gasUsed),
          status: transactions[0].isError === "0" ? "success" : "failed",
        } : undefined,
        lastTransaction: transactions.length > 0 ? {
          hash: transactions[transactions.length - 1].hash,
          blockNumber: BigInt(transactions[transactions.length - 1].blockNumber),
          timestamp: parseInt(transactions[transactions.length - 1].timeStamp),
          from: transactions[transactions.length - 1].from,
          to: transactions[transactions.length - 1].to,
          value: BigInt(transactions[transactions.length - 1].value),
          gasUsed: BigInt(transactions[transactions.length - 1].gasUsed),
          status: transactions[transactions.length - 1].isError === "0" ? "success" : "failed",
        } : undefined,
      }
    } catch (error) {
      Logger.error("Failed to get contract stats:", error)
      return {
        totalTransactions: 0,
        uniqueUsers: 0,
        totalValueTransferred: "0",
      }
    }
  }

  /**
   * Get pricing for historical data queries
   */
  getPricing(): string {
    return UCAI_PRICING.HISTORICAL_DATA
  }
}

// Singleton instance
let historicalService: HistoricalDataService | null = null

/**
 * Get or create historical data service
 */
export function getHistoricalDataService(): HistoricalDataService {
  if (!historicalService) {
    historicalService = new HistoricalDataService()
  }
  return historicalService
}

export default HistoricalDataService
