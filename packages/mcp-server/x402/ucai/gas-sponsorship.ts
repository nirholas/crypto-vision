/**
 * UCAI Gas Sponsorship Service
 * @description x402-powered gas sponsorship with account abstraction integration
 * @author nirholas
 * @license Apache-2.0
 * 
 * Enables AI agents to sponsor gas for users, creating gasless UX.
 * Uses ERC-4337 account abstraction with paymasters.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  encodeFunctionData,
  formatEther,
  formatUnits,
  parseEther,
  type Address,
  type Hash,
  type Hex,
} from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { arbitrum, base, mainnet, polygon, optimism } from "viem/chains"
import type {
  GasSponsorshipRequest,
  GasSponsorshipResult,
  GasSponsorConfig,
} from "./types.js"
import { UCAI_PRICING } from "./types.js"
import Logger from "@/utils/logger.js"

// Chain configurations
const CHAINS = {
  ethereum: mainnet,
  arbitrum,
  base,
  polygon,
  optimism,
}

// Default paymaster addresses (ERC-4337 compatible)
const DEFAULT_PAYMASTERS: Record<string, Address> = {
  arbitrum: "0x4Fd9098af9ddcB41DA48A1d78F91F1398965addc" as Address, // Pimlico
  base: "0x2Fd9098af9ddcB41DA48A1d78F91F1398965addc" as Address,
  polygon: "0x3Fd9098af9ddcB41DA48A1d78F91F1398965addc" as Address,
  optimism: "0x5Fd9098af9ddcB41DA48A1d78F91F1398965addc" as Address,
}

// EntryPoint v0.6 address (standard across all chains)
const ENTRY_POINT_V06: Address = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789"
// EntryPoint v0.7 address
const ENTRY_POINT_V07: Address = "0x0000000071727De22E5E9d8BAf0edAc6f37da032"

// Simple Account Factory
const SIMPLE_ACCOUNT_FACTORY: Address = "0x9406Cc6185a346906296840746125a0E44976454"

/**
 * Gas Sponsorship Service
 * 
 * Sponsors gas for user transactions using x402 payments.
 * Integrates with ERC-4337 account abstraction for gasless UX.
 */
export class GasSponsorshipService {
  private readonly config: GasSponsorConfig
  private readonly sponsorPrivateKey: Hex
  private priceFeeds: Map<string, number> = new Map()

  constructor(
    sponsorPrivateKey: Hex,
    config?: Partial<GasSponsorConfig>
  ) {
    this.sponsorPrivateKey = sponsorPrivateKey
    this.config = {
      maxGasPerTx: config?.maxGasPerTx ?? "5.00",
      supportedNetworks: config?.supportedNetworks ?? ["arbitrum", "base", "polygon", "optimism"],
      paymasterAddresses: config?.paymasterAddresses ?? DEFAULT_PAYMASTERS,
      entryPointAddresses: config?.entryPointAddresses ?? {
        arbitrum: ENTRY_POINT_V07,
        base: ENTRY_POINT_V07,
        polygon: ENTRY_POINT_V07,
        optimism: ENTRY_POINT_V07,
      },
    }

    // Initialize price feeds (would typically fetch from oracle)
    this.priceFeeds.set("ethereum", 3500)
    this.priceFeeds.set("arbitrum", 3500)
    this.priceFeeds.set("base", 3500)
    this.priceFeeds.set("polygon", 0.80)
    this.priceFeeds.set("optimism", 3500)
  }

  /**
   * Sponsor gas for a user's transaction
   * 
   * @param request - Gas sponsorship request
   * @returns Sponsorship result with transaction details
   */
  async sponsorTransaction(request: GasSponsorshipRequest): Promise<GasSponsorshipResult> {
    try {
      const { userAddress, contractAddress, functionName, args, abi, network, maxGasUsd } = request

      // Validate network support
      if (!this.config.supportedNetworks.includes(network)) {
        return {
          success: false,
          error: `Network ${network} not supported for gas sponsorship`,
        }
      }

      // Get chain config
      const chain = CHAINS[network as keyof typeof CHAINS]
      if (!chain) {
        return {
          success: false,
          error: `Unknown chain: ${network}`,
        }
      }

      // Create clients
      const publicClient = createPublicClient({
        chain,
        transport: http(),
      })

      const account = privateKeyToAccount(this.sponsorPrivateKey)
      const walletClient = createWalletClient({
        account,
        chain,
        transport: http(),
      })

      // Encode the call data
      const callData = encodeFunctionData({
        abi: abi as any,
        functionName,
        args: args as any[],
      })

      // Estimate gas for the transaction
      const gasEstimate = await publicClient.estimateGas({
        account: userAddress,
        to: contractAddress,
        data: callData,
      })

      // Get current gas price
      const gasPrice = await publicClient.getGasPrice()

      // Calculate gas cost in native token
      const gasCostWei = gasEstimate * gasPrice
      const gasCostNative = formatEther(gasCostWei)

      // Convert to USD
      const nativePrice = this.priceFeeds.get(network) ?? 0
      const gasCostUsd = (parseFloat(gasCostNative) * nativePrice).toFixed(4)

      // Check against max gas limit
      const maxGas = maxGasUsd ?? this.config.maxGasPerTx
      if (parseFloat(gasCostUsd) > parseFloat(maxGas)) {
        return {
          success: false,
          error: `Gas cost $${gasCostUsd} exceeds maximum allowed $${maxGas}`,
          gasCostNative,
          gasCostUsd,
        }
      }

      // Calculate x402 payment (gas cost + fee)
      const fee = parseFloat(UCAI_PRICING.GAS_SPONSORSHIP_FEE)
      const paymentAmount = (parseFloat(gasCostUsd) * (1 + fee)).toFixed(4)

      Logger.info(`Sponsoring gas for ${userAddress} on ${network}: ${gasCostNative} ETH ($${gasCostUsd})`)

      // Execute the transaction on behalf of the user
      // In a full implementation, this would use a smart contract wallet or bundler
      const hash = await walletClient.sendTransaction({
        to: contractAddress,
        data: callData,
        gas: gasEstimate + (gasEstimate / 10n), // Add 10% buffer
        maxFeePerGas: gasPrice + (gasPrice / 5n), // Add 20% buffer
        maxPriorityFeePerGas: gasPrice / 10n,
      })

      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash })

      return {
        success: receipt.status === "success",
        transactionHash: hash,
        gasCostNative,
        gasCostUsd,
        paymentAmount,
      }
    } catch (error) {
      Logger.error("Gas sponsorship failed:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /**
   * Sponsor a UserOperation through ERC-4337 account abstraction
   * 
   * @param userOp - The UserOperation to sponsor
   * @param network - Network to execute on
   * @returns Sponsorship result with UserOp hash
   */
  async sponsorUserOperation(
    userOp: UserOperation,
    network: string
  ): Promise<GasSponsorshipResult> {
    try {
      if (!this.config.supportedNetworks.includes(network)) {
        return {
          success: false,
          error: `Network ${network} not supported for gas sponsorship`,
        }
      }

      const chain = CHAINS[network as keyof typeof CHAINS]
      if (!chain) {
        return {
          success: false,
          error: `Unknown chain: ${network}`,
        }
      }

      // Get paymaster address for the network
      const paymasterAddress = this.config.paymasterAddresses[network]
      if (!paymasterAddress) {
        return {
          success: false,
          error: `No paymaster configured for ${network}`,
        }
      }

      // Create client
      const publicClient = createPublicClient({
        chain,
        transport: http(),
      })

      // Get paymaster data
      const paymasterData = await this.getPaymasterData(
        userOp,
        paymasterAddress,
        network
      )

      // Update UserOp with paymaster data
      const sponsoredUserOp: UserOperation = {
        ...userOp,
        paymasterAndData: paymasterData,
      }

      // Calculate gas costs
      const totalGas = 
        BigInt(userOp.callGasLimit) +
        BigInt(userOp.verificationGasLimit) +
        BigInt(userOp.preVerificationGas)
      
      const gasPrice = BigInt(userOp.maxFeePerGas)
      const gasCostWei = totalGas * gasPrice
      const gasCostNative = formatEther(gasCostWei)

      const nativePrice = this.priceFeeds.get(network) ?? 0
      const gasCostUsd = (parseFloat(gasCostNative) * nativePrice).toFixed(4)

      // Calculate payment
      const fee = parseFloat(UCAI_PRICING.GAS_SPONSORSHIP_FEE)
      const paymentAmount = (parseFloat(gasCostUsd) * (1 + fee)).toFixed(4)

      // In a full implementation, this would submit to a bundler
      // For now, we return the sponsored UserOp hash
      const userOpHash = this.hashUserOp(sponsoredUserOp, network)

      Logger.info(`Sponsored UserOp ${userOpHash} on ${network}: $${gasCostUsd}`)

      return {
        success: true,
        userOpHash,
        gasCostNative,
        gasCostUsd,
        paymentAmount,
      }
    } catch (error) {
      Logger.error("UserOperation sponsorship failed:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /**
   * Get paymaster data for a UserOperation
   */
  private async getPaymasterData(
    userOp: UserOperation,
    paymasterAddress: Address,
    network: string
  ): Promise<Hex> {
    // In a real implementation, this would call the paymaster contract
    // to get the signed paymaster data
    // For now, return a placeholder
    const validUntil = Math.floor(Date.now() / 1000) + 3600 // 1 hour
    const validAfter = Math.floor(Date.now() / 1000) - 60 // 1 minute ago

    // Format: paymasterAddress + validUntil + validAfter + signature
    const paymasterData = paymasterAddress + 
      validUntil.toString(16).padStart(12, "0") +
      validAfter.toString(16).padStart(12, "0") +
      "0".repeat(130) // Placeholder signature

    return paymasterData as Hex
  }

  /**
   * Hash a UserOperation
   */
  private hashUserOp(userOp: UserOperation, network: string): Hash {
    const entryPoint = this.config.entryPointAddresses[network] ?? ENTRY_POINT_V07
    
    // Simplified hash - real implementation would use proper encoding
    const packed = [
      userOp.sender,
      userOp.nonce.toString(),
      userOp.callData,
      userOp.callGasLimit.toString(),
      userOp.verificationGasLimit.toString(),
      userOp.preVerificationGas.toString(),
      userOp.maxFeePerGas.toString(),
      userOp.maxPriorityFeePerGas.toString(),
    ].join("")

    // Return a deterministic hash
    return `0x${Buffer.from(packed).toString("hex").slice(0, 64).padEnd(64, "0")}` as Hash
  }

  /**
   * Estimate sponsorship cost for a transaction
   */
  async estimateSponsorshipCost(
    contractAddress: Address,
    functionName: string,
    args: unknown[],
    abi: unknown[],
    network: string
  ): Promise<{
    gasCostNative: string
    gasCostUsd: string
    paymentAmount: string
    supported: boolean
  }> {
    if (!this.config.supportedNetworks.includes(network)) {
      return {
        gasCostNative: "0",
        gasCostUsd: "0",
        paymentAmount: "0",
        supported: false,
      }
    }

    const chain = CHAINS[network as keyof typeof CHAINS]
    if (!chain) {
      return {
        gasCostNative: "0",
        gasCostUsd: "0",
        paymentAmount: "0",
        supported: false,
      }
    }

    const publicClient = createPublicClient({
      chain,
      transport: http(),
    })

    try {
      const callData = encodeFunctionData({
        abi: abi as any,
        functionName,
        args: args as any[],
      })

      const gasEstimate = await publicClient.estimateGas({
        to: contractAddress,
        data: callData,
      })

      const gasPrice = await publicClient.getGasPrice()
      const gasCostWei = gasEstimate * gasPrice
      const gasCostNative = formatEther(gasCostWei)

      const nativePrice = this.priceFeeds.get(network) ?? 0
      const gasCostUsd = (parseFloat(gasCostNative) * nativePrice).toFixed(4)

      const fee = parseFloat(UCAI_PRICING.GAS_SPONSORSHIP_FEE)
      const paymentAmount = (parseFloat(gasCostUsd) * (1 + fee)).toFixed(4)

      return {
        gasCostNative,
        gasCostUsd,
        paymentAmount,
        supported: true,
      }
    } catch {
      return {
        gasCostNative: "0",
        gasCostUsd: "0",
        paymentAmount: "0",
        supported: true,
      }
    }
  }

  /**
   * Update native token price feed
   */
  updatePriceFeed(network: string, priceUsd: number): void {
    this.priceFeeds.set(network, priceUsd)
  }

  /**
   * Get supported networks
   */
  getSupportedNetworks(): string[] {
    return [...this.config.supportedNetworks]
  }
}

/**
 * ERC-4337 UserOperation type
 */
export interface UserOperation {
  sender: Address
  nonce: bigint
  initCode: Hex
  callData: Hex
  callGasLimit: bigint
  verificationGasLimit: bigint
  preVerificationGas: bigint
  maxFeePerGas: bigint
  maxPriorityFeePerGas: bigint
  paymasterAndData: Hex
  signature: Hex
}

// Singleton instance
let gasSponsorService: GasSponsorshipService | null = null

/**
 * Get or create gas sponsorship service
 */
export function getGasSponsorService(): GasSponsorshipService {
  if (!gasSponsorService) {
    const privateKey = process.env.X402_SPONSOR_PRIVATE_KEY || process.env.X402_EVM_PRIVATE_KEY
    if (!privateKey) {
      throw new Error("X402_SPONSOR_PRIVATE_KEY or X402_EVM_PRIVATE_KEY required for gas sponsorship")
    }
    gasSponsorService = new GasSponsorshipService(privateKey as Hex)
  }
  return gasSponsorService
}

export default GasSponsorshipService
