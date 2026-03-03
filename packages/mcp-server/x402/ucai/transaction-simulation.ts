/**
 * UCAI Transaction Simulation Service
 * @description x402-powered transaction simulation before execution
 * @author nirholas
 * @license Apache-2.0
 * @price $0.01 per simulation
 */

import {
  createPublicClient,
  http,
  encodeFunctionData,
  decodeFunctionResult,
  decodeEventLog,
  formatEther,
  formatUnits,
  parseAbi,
  type Address,
  type Hex,
  type Log,
  type TransactionReceipt,
} from "viem"
import { arbitrum, base, mainnet, polygon, optimism, bsc } from "viem/chains"
import type {
  SimulationRequest,
  SimulationResult,
  StateChange,
  SimulatedEvent,
  TokenTransfer,
  NativeTransfer,
} from "./types.js"
import { UCAI_PRICING } from "./types.js"
import Logger from "@/utils/logger.js"

// Chain configurations - use any to avoid viem's strict chain typing
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CHAINS: Record<string, any> = {
  ethereum: mainnet,
  arbitrum: arbitrum,
  base: base,
  polygon: polygon,
  optimism: optimism,
  bsc: bsc,
}

// Type-safe chain accessor
function getChain(network: string) {
  return CHAINS[network] ?? mainnet
}

// ERC20 Transfer event signature
const ERC20_TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
const ERC20_APPROVAL_TOPIC = "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925"

// Common ABIs for decoding
const ERC20_ABI = parseAbi([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
])

const ERC721_ABI = parseAbi([
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
  "event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId)",
])

/**
 * Transaction Simulation Service
 * 
 * Simulates transactions before execution to preview outcomes,
 * catch errors, and analyze state changes.
 */
export class TransactionSimulationService {
  private tokenInfoCache: Map<string, { symbol: string; decimals: number }> = new Map()

  /**
   * Simulate a transaction and return detailed results
   * 
   * @param request - Simulation request
   * @returns Simulation result with state changes, events, and transfers
   */
  async simulateTransaction(request: SimulationRequest): Promise<SimulationResult> {
    const { contractAddress, functionName, args, abi, from, value, network } = request

    const chain = getChain(network)
    if (!chain) {
      throw new Error(`Unsupported network: ${network}`)
    }

    const publicClient = createPublicClient({
      chain,
      transport: http(),
    })

    Logger.info(`Simulating ${functionName} on ${contractAddress} from ${from}`)

    // Initialize result
    const result: SimulationResult = {
      success: false,
      gasUsed: 0n,
      gasLimit: 0n,
      stateChanges: [],
      events: [],
      tokenTransfers: [],
      nativeTransfers: [],
      warnings: [],
    }

    try {
      // Encode the call data
      const callData = encodeFunctionData({
        abi: abi as any,
        functionName,
        args: args as any[],
      })

      // Get current state before simulation
      const [fromBalance, toBalance] = await Promise.all([
        publicClient.getBalance({ address: from }),
        publicClient.getBalance({ address: contractAddress }),
      ])

      // Estimate gas first (this also validates the transaction)
      let gasEstimate: bigint
      try {
        gasEstimate = await publicClient.estimateGas({
          account: from,
          to: contractAddress,
          data: callData,
          value: value ?? 0n,
        })
        result.gasLimit = gasEstimate + (gasEstimate / 10n) // Add 10% buffer
      } catch (error: any) {
        // Transaction would fail
        result.success = false
        result.error = error.message ?? "Transaction would revert"
        result.revertReason = this.extractRevertReason(error)
        result.warnings.push("Transaction simulation failed - would revert on-chain")
        return result
      }

      // Simulate the call to get return value
      try {
        const callResult = await publicClient.call({
          account: from,
          to: contractAddress,
          data: callData,
          value: value ?? 0n,
        })

        if (callResult.data) {
          result.returnValue = callResult.data

          // Try to decode the return value
          try {
            const decoded = decodeFunctionResult({
              abi: abi as any,
              functionName,
              data: callResult.data,
            })
            result.decodedReturn = decoded
          } catch {
            // Could not decode return value
          }
        }
      } catch (error: any) {
        // Call failed but gas estimate succeeded - unusual
        result.warnings.push("Call simulation returned error but gas estimate succeeded")
      }

      // Simulate with trace to get state changes and events
      // Note: This requires a node that supports debug_traceCall or eth_simulateV1
      const simulationData = await this.simulateWithTrace(
        publicClient,
        from,
        contractAddress,
        callData,
        value ?? 0n,
        network
      )

      result.stateChanges = simulationData.stateChanges
      result.events = simulationData.events
      result.gasUsed = simulationData.gasUsed ?? gasEstimate

      // Parse token transfers from events
      result.tokenTransfers = await this.parseTokenTransfers(
        publicClient,
        simulationData.events
      )

      // Check for native transfers
      if (value && value > 0n) {
        result.nativeTransfers.push({
          from,
          to: contractAddress,
          amount: value,
          formattedAmount: formatEther(value),
        })
      }

      // Add warnings for potential issues
      this.addWarnings(result, request)

      result.success = true

      return result
    } catch (error) {
      Logger.error("Simulation failed:", error)
      result.error = error instanceof Error ? error.message : "Simulation failed"
      return result
    }
  }

  /**
   * Simulate transaction with trace (if supported by node)
   */
  /**
   * Simulate transaction with trace (if supported by node)
   */
  private async simulateWithTrace(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client: any,
    from: Address,
    to: Address,
    data: Hex,
    value: bigint,
    network: string
  ): Promise<{
    stateChanges: StateChange[]
    events: SimulatedEvent[]
    gasUsed?: bigint
  }> {
    const stateChanges: StateChange[] = []
    const events: SimulatedEvent[] = []

    try {
      // Try eth_simulateV1 (newer nodes)
      // This is a simplified version - real implementation would use actual trace
      const result = await (client as any).request({
        method: "eth_call",
        params: [
          {
            from,
            to,
            data,
            value: value ? `0x${value.toString(16)}` : "0x0",
          },
          "latest",
        ],
      })

      // Parse logs from trace if available
      // This is a placeholder - real implementation would parse actual trace

    } catch (error) {
      // Tracing not supported, return empty
      Logger.debug("Trace not supported:", error)
    }

    return { stateChanges, events }
  }

  /**
   * Parse token transfers from events
   */
  private async parseTokenTransfers(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client: any,
    events: SimulatedEvent[]
  ): Promise<TokenTransfer[]> {
    const transfers: TokenTransfer[] = []

    for (const event of events) {
      const topics = event.topics ?? []
      if (topics[0] === ERC20_TRANSFER_TOPIC && topics.length >= 3) {
        try {
          // Decode Transfer event: Transfer(address indexed from, address indexed to, uint256 value)
          // topics[1] = from (indexed), topics[2] = to (indexed), data = value
          const topic1 = topics[1]
          const topic2 = topics[2]
          if (!topic1 || !topic2) continue
          const from = ("0x" + topic1.slice(26)) as Address
          const to = ("0x" + topic2.slice(26)) as Address
          
          // Get token info and value from data
          const tokenInfo = await this.getTokenInfo(client, event.address)
          const eventData = (event as SimulatedEvent & { data?: Hex }).data
          const value = eventData && eventData !== "0x" ? BigInt(eventData) : 0n
          
          transfers.push({
            token: event.address,
            symbol: tokenInfo?.symbol,
            decimals: tokenInfo?.decimals,
            from,
            to,
            amount: value,
            formattedAmount: tokenInfo
              ? formatUnits(value, tokenInfo.decimals)
              : undefined,
          })
        } catch {
          // Could not decode transfer event
        }
      }
    }

    return transfers
  }

  /**
   * Get token info (symbol, decimals)
   */
  private async getTokenInfo(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client: any,
    tokenAddress: Address
  ): Promise<{ symbol: string; decimals: number } | null> {
    const cacheKey = `${tokenAddress}`
    
    if (this.tokenInfoCache.has(cacheKey)) {
      return this.tokenInfoCache.get(cacheKey)!
    }

    try {
      const [symbol, decimals] = await Promise.all([
        client.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: "symbol",
        }),
        client.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: "decimals",
        }),
      ])

      const info = { symbol: symbol as string, decimals: Number(decimals) }
      this.tokenInfoCache.set(cacheKey, info)
      return info
    } catch {
      return null
    }
  }

  /**
   * Extract revert reason from error
   */
  private extractRevertReason(error: any): string | undefined {
    const message = error.message ?? ""
    
    // Try to extract revert reason
    const revertMatch = message.match(/reverted with reason string '([^']+)'/)
    if (revertMatch) {
      return revertMatch[1]
    }

    const customErrorMatch = message.match(/reverted with custom error '([^']+)'/)
    if (customErrorMatch) {
      return customErrorMatch[1]
    }

    const panicMatch = message.match(/reverted with panic code 0x([0-9a-f]+)/)
    if (panicMatch) {
      const panicCode = parseInt(panicMatch[1], 16)
      return this.getPanicDescription(panicCode)
    }

    return undefined
  }

  /**
   * Get human-readable panic code description
   */
  private getPanicDescription(code: number): string {
    const panicCodes: Record<number, string> = {
      0x00: "Generic compiler panic",
      0x01: "Assert failed",
      0x11: "Arithmetic overflow/underflow",
      0x12: "Division by zero",
      0x21: "Invalid enum value",
      0x22: "Storage byte array encoding error",
      0x31: "Empty array pop",
      0x32: "Array index out of bounds",
      0x41: "Memory allocation error",
      0x51: "Internal function called incorrectly",
    }
    return panicCodes[code] ?? `Panic code: 0x${code.toString(16)}`
  }

  /**
   * Add warnings for potential issues
   */
  private addWarnings(result: SimulationResult, request: SimulationRequest): void {
    // Check for high gas usage
    if (result.gasUsed > 500000n) {
      result.warnings.push(`High gas usage: ${result.gasUsed} gas units`)
    }

    // Check for large value transfers
    if (request.value && request.value > 10n ** 18n) {
      result.warnings.push(`Large ETH transfer: ${formatEther(request.value)} ETH`)
    }

    // Check for unlimited approvals
    if (request.functionName === "approve" && request.args?.length === 2) {
      const amount = request.args[1]
      if (typeof amount === "bigint" && amount === 2n ** 256n - 1n) {
        result.warnings.push("Unlimited token approval - consider setting a specific limit")
      }
    }

    // Check for interaction with unverified contracts
    // This would require additional verification check
  }

  /**
   * Batch simulate multiple transactions
   */
  async simulateBatch(
    requests: SimulationRequest[]
  ): Promise<SimulationResult[]> {
    const results: SimulationResult[] = []

    for (const request of requests) {
      const result = await this.simulateTransaction(request)
      results.push(result)

      // If a transaction fails, subsequent ones might behave differently
      if (!result.success) {
        result.warnings.push("Batch simulation stopped due to failure")
        break
      }
    }

    return results
  }

  /**
   * Compare simulation with actual execution
   */
  async compareWithExecution(
    simulation: SimulationResult,
    receipt: TransactionReceipt
  ): Promise<{
    gasMatch: boolean
    gasDifference: bigint
    eventsMatch: boolean
    warnings: string[]
  }> {
    const warnings: string[] = []

    // Compare gas
    const gasDiff = simulation.gasUsed > receipt.gasUsed
      ? simulation.gasUsed - receipt.gasUsed
      : receipt.gasUsed - simulation.gasUsed
    
    const gasMatch = gasDiff < simulation.gasUsed / 10n // Within 10%

    if (!gasMatch) {
      warnings.push(`Gas mismatch: simulated ${simulation.gasUsed}, actual ${receipt.gasUsed}`)
    }

    // Compare event count
    const eventsMatch = simulation.events.length === receipt.logs.length

    if (!eventsMatch) {
      warnings.push(`Event count mismatch: simulated ${simulation.events.length}, actual ${receipt.logs.length}`)
    }

    return {
      gasMatch,
      gasDifference: gasDiff,
      eventsMatch,
      warnings,
    }
  }

  /**
   * Get simulation pricing
   */
  getPricing(): string {
    return UCAI_PRICING.TRANSACTION_SIMULATION
  }
}

// Singleton instance
let simulationService: TransactionSimulationService | null = null

/**
 * Get or create transaction simulation service
 */
export function getTransactionSimulationService(): TransactionSimulationService {
  if (!simulationService) {
    simulationService = new TransactionSimulationService()
  }
  return simulationService
}

export default TransactionSimulationService
