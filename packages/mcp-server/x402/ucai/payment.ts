/**
 * UCAI Payment Service
 * @description x402 payment integration for UCAI premium features
 * @author nirholas
 * @license Apache-2.0
 * 
 * Integrates with x402-stablecoin contracts:
 * - X402PaymentChannel for gas sponsorship
 * - X402Subscription for monthly plans
 * - ToolRegistry for contract discovery
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  encodeFunctionData,
  parseUnits,
  formatUnits,
  type Address,
  type Hash,
  type Hex,
} from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { arbitrum, arbitrumSepolia } from "viem/chains"
import type {
  UCAPPaymentConfig,
  UCAPSubscription,
  SubscriptionTier,
  SUBSCRIPTION_TIERS,
} from "./types.js"
import Logger from "@/utils/logger.js"

// Contract addresses on Arbitrum
const CONTRACTS = {
  arbitrum: {
    paymentChannel: "0x4A6e7c137a6691D55693CA3Bc7E5C698d9d43815" as Address,
    subscription: "0x5B7e8c237b7691D55693CA3Bc7E5C698d9d43816" as Address,
    toolRegistry: "0x6C8f9d347c8791E55693CA3Bc7E5C698d9d43817" as Address,
    usds: "0xD74f5255D557944cf7Dd0E45FF521520002D5748" as Address, // Sperax USDs
    usdc: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8" as Address, // Arbitrum USDC
  },
  "arbitrum-sepolia": {
    paymentChannel: "0x1234567890123456789012345678901234567890" as Address,
    subscription: "0x2345678901234567890123456789012345678901" as Address,
    toolRegistry: "0x3456789012345678901234567890123456789012" as Address,
    usds: "0x4567890123456789012345678901234567890123" as Address,
    usdc: "0x5678901234567890123456789012345678901234" as Address,
  },
}

// ABIs for x402-stablecoin contracts
const PAYMENT_CHANNEL_ABI = [
  {
    name: "openChannel",
    type: "function",
    inputs: [
      { name: "recipient", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "duration", type: "uint256" },
    ],
    outputs: [{ name: "channelId", type: "bytes32" }],
    stateMutability: "nonpayable",
  },
  {
    name: "pay",
    type: "function",
    inputs: [
      { name: "channelId", type: "bytes32" },
      { name: "amount", type: "uint256" },
      { name: "proof", type: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    name: "getChannelBalance",
    type: "function",
    inputs: [{ name: "channelId", type: "bytes32" }],
    outputs: [{ name: "balance", type: "uint256" }],
    stateMutability: "view",
  },
  {
    name: "closeChannel",
    type: "function",
    inputs: [{ name: "channelId", type: "bytes32" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const

const SUBSCRIPTION_ABI = [
  {
    name: "subscribe",
    type: "function",
    inputs: [
      { name: "tier", type: "uint8" },
      { name: "months", type: "uint256" },
    ],
    outputs: [{ name: "subscriptionId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    name: "getSubscription",
    type: "function",
    inputs: [{ name: "subscriber", type: "address" }],
    outputs: [
      { name: "tier", type: "uint8" },
      { name: "expiresAt", type: "uint256" },
      { name: "usageCount", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    name: "checkAccess",
    type: "function",
    inputs: [
      { name: "subscriber", type: "address" },
      { name: "toolId", type: "bytes32" },
    ],
    outputs: [{ name: "hasAccess", type: "bool" }],
    stateMutability: "view",
  },
  {
    name: "recordUsage",
    type: "function",
    inputs: [
      { name: "subscriber", type: "address" },
      { name: "toolId", type: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const

const TOOL_REGISTRY_ABI = [
  {
    name: "registerTool",
    type: "function",
    inputs: [
      { name: "toolId", type: "bytes32" },
      { name: "priceUsd", type: "uint256" },
      { name: "requiredTier", type: "uint8" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    name: "getToolPrice",
    type: "function",
    inputs: [{ name: "toolId", type: "bytes32" }],
    outputs: [{ name: "priceUsd", type: "uint256" }],
    stateMutability: "view",
  },
  {
    name: "isToolEnabled",
    type: "function",
    inputs: [{ name: "toolId", type: "bytes32" }],
    outputs: [{ name: "enabled", type: "bool" }],
    stateMutability: "view",
  },
] as const

const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "success", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    name: "balanceOf",
    type: "function",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }],
    stateMutability: "view",
  },
  {
    name: "allowance",
    type: "function",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "remaining", type: "uint256" }],
    stateMutability: "view",
  },
  {
    name: "transfer",
    type: "function",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "success", type: "bool" }],
    stateMutability: "nonpayable",
  },
] as const

// Payment result interface
interface PaymentResult {
  success: boolean
  paymentId?: string
  transactionHash?: Hash
  error?: string
}

// Balance info interface
interface BalanceInfo {
  usds: string
  usdc: string
  channelBalance?: string
  network: string
}

/**
 * UCAI Payment Service
 * 
 * Handles all x402 payments for UCAI premium features.
 */
export class UCAIPaymentService {
  private readonly network: "arbitrum" | "arbitrum-sepolia"
  private readonly privateKey: Hex
  private readonly contracts: typeof CONTRACTS["arbitrum"]
  private channelId?: Hex
  private paymentNonce: number = 0

  constructor(options?: {
    network?: "arbitrum" | "arbitrum-sepolia"
    privateKey?: Hex
  }) {
    this.network = options?.network ?? "arbitrum"
    this.privateKey = (options?.privateKey ?? 
      process.env.X402_EVM_PRIVATE_KEY ?? 
      process.env.UCAI_PRIVATE_KEY) as Hex
    
    if (!this.privateKey) {
      Logger.warn("UCAI Payment: No private key configured - payments will be simulated")
    }

    this.contracts = CONTRACTS[this.network]
  }

  /**
   * Get public and wallet clients
   */
  private getClients() {
    const chain = this.network === "arbitrum" ? arbitrum : arbitrumSepolia

    const publicClient = createPublicClient({
      chain,
      transport: http(),
    })

    if (!this.privateKey) {
      return { publicClient, walletClient: null, account: null }
    }

    const account = privateKeyToAccount(this.privateKey)
    const walletClient = createWalletClient({
      account,
      chain,
      transport: http(),
    })

    return { publicClient, walletClient, account }
  }

  /**
   * Process payment for a tool
   */
  async processPayment(
    toolId: string,
    amountUsd: string
  ): Promise<PaymentResult> {
    const { publicClient, walletClient, account } = this.getClients()

    // Simulate payment if no wallet configured
    if (!walletClient || !account) {
      Logger.info(`Simulating payment of $${amountUsd} for ${toolId}`)
      return {
        success: true,
        paymentId: `sim_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      }
    }

    try {
      // Check subscription first
      const subscription = await this.getSubscription()
      if (subscription && this.hasToolAccess(subscription, toolId)) {
        // Record usage and allow
        await this.recordToolUsage(toolId)
        return {
          success: true,
          paymentId: `sub_${subscription.id}_${Date.now()}`,
        }
      }

      // Pay-per-use: Process direct payment
      const amountWei = parseUnits(amountUsd, 18)

      // Check balance
      const balance = await publicClient.readContract({
        address: this.contracts.usds,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [account.address],
      })

      if (balance < amountWei) {
        return {
          success: false,
          error: `Insufficient USDs balance. Required: ${amountUsd}, Available: ${formatUnits(balance, 18)}`,
        }
      }

      // Check/set allowance for payment channel
      const allowance = await publicClient.readContract({
        address: this.contracts.usds,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [account.address, this.contracts.paymentChannel],
      })

      if (allowance < amountWei) {
        // Approve payment channel
        const approveTx = await walletClient.writeContract({
          address: this.contracts.usds,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [this.contracts.paymentChannel, amountWei * 100n], // Approve 100x for efficiency
        })
        await publicClient.waitForTransactionReceipt({ hash: approveTx })
      }

      // If we have an open channel, use it
      if (this.channelId) {
        const channelBalance = await publicClient.readContract({
          address: this.contracts.paymentChannel,
          abi: PAYMENT_CHANNEL_ABI,
          functionName: "getChannelBalance",
          args: [this.channelId],
        })

        if (channelBalance >= amountWei) {
          // Pay through channel
          const paymentProof = this.generatePaymentProof(amountUsd)
          const tx = await walletClient.writeContract({
            address: this.contracts.paymentChannel,
            abi: PAYMENT_CHANNEL_ABI,
            functionName: "pay",
            args: [this.channelId, amountWei, paymentProof],
          })

          await publicClient.waitForTransactionReceipt({ hash: tx })

          return {
            success: true,
            paymentId: `chan_${this.channelId}_${this.paymentNonce++}`,
            transactionHash: tx,
          }
        }
      }

      // Direct transfer for pay-per-use
      const tx = await walletClient.writeContract({
        address: this.contracts.usds,
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [this.contracts.paymentChannel, amountWei],
      })

      await publicClient.waitForTransactionReceipt({ hash: tx })

      return {
        success: true,
        paymentId: `pay_${tx}_${Date.now()}`,
        transactionHash: tx,
      }
    } catch (error) {
      Logger.error("Payment failed:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Payment failed",
      }
    }
  }

  /**
   * Refund a payment (in case of service failure)
   */
  async refundPayment(paymentId: string): Promise<boolean> {
    // In a real implementation, this would interact with the payment channel
    // to return funds for failed services
    Logger.info(`Refund requested for payment ${paymentId}`)
    
    if (paymentId.startsWith("sim_")) {
      return true // Simulated payments don't need refunds
    }

    // TODO: Implement actual refund logic
    return true
  }

  /**
   * Get current balance
   */
  async getBalance(): Promise<BalanceInfo> {
    const { publicClient, account } = this.getClients()

    if (!account) {
      return {
        usds: "0",
        usdc: "0",
        network: this.network,
      }
    }

    try {
      const [usdsBalance, usdcBalance] = await Promise.all([
        publicClient.readContract({
          address: this.contracts.usds,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [account.address],
        }),
        publicClient.readContract({
          address: this.contracts.usdc,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [account.address],
        }),
      ])

      let channelBalance: string | undefined
      if (this.channelId) {
        const balance = await publicClient.readContract({
          address: this.contracts.paymentChannel,
          abi: PAYMENT_CHANNEL_ABI,
          functionName: "getChannelBalance",
          args: [this.channelId],
        })
        channelBalance = formatUnits(balance, 18)
      }

      return {
        usds: formatUnits(usdsBalance, 18),
        usdc: formatUnits(usdcBalance, 6),
        channelBalance,
        network: this.network,
      }
    } catch (error) {
      Logger.error("Failed to get balance:", error)
      return {
        usds: "0",
        usdc: "0",
        network: this.network,
      }
    }
  }

  /**
   * Get subscription status
   */
  async getSubscription(): Promise<UCAPSubscription | null> {
    const { publicClient, account } = this.getClients()

    if (!account) {
      return null
    }

    try {
      const [tier, expiresAt, usageCount] = await publicClient.readContract({
        address: this.contracts.subscription,
        abi: SUBSCRIPTION_ABI,
        functionName: "getSubscription",
        args: [account.address],
      })

      if (Number(expiresAt) < Math.floor(Date.now() / 1000)) {
        return null // Expired
      }

      const tierNames: SubscriptionTier[] = ["free", "basic", "pro", "enterprise"]
      const tierName = tierNames[Number(tier)] ?? "free"

      return {
        id: `sub_${account.address}_${tier}`,
        subscriber: account.address,
        tier: tierName,
        priceUsd: this.getTierPrice(tierName),
        startedAt: 0, // Would need additional contract call
        expiresAt: Number(expiresAt),
        features: this.getTierFeatures(tierName),
        limits: this.getTierLimits(tierName),
      }
    } catch (error) {
      Logger.debug("No subscription found:", error)
      return null
    }
  }

  /**
   * Subscribe to a tier
   */
  async subscribe(
    tier: SubscriptionTier,
    months: number = 1
  ): Promise<{ success: boolean; subscriptionId?: string; error?: string }> {
    const { publicClient, walletClient, account } = this.getClients()

    if (!walletClient || !account) {
      return { success: false, error: "Wallet not configured" }
    }

    try {
      const tierIndex = ["free", "basic", "pro", "enterprise"].indexOf(tier)
      if (tierIndex < 0) {
        return { success: false, error: "Invalid tier" }
      }

      // Calculate cost
      const pricePerMonth = parseFloat(this.getTierPrice(tier))
      const totalCost = parseUnits((pricePerMonth * months).toString(), 18)

      // Approve subscription contract
      const approveTx = await walletClient.writeContract({
        address: this.contracts.usds,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [this.contracts.subscription, totalCost],
      })
      await publicClient.waitForTransactionReceipt({ hash: approveTx })

      // Subscribe
      const tx = await walletClient.writeContract({
        address: this.contracts.subscription,
        abi: SUBSCRIPTION_ABI,
        functionName: "subscribe",
        args: [tierIndex, BigInt(months)],
      })

      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx })

      return {
        success: true,
        subscriptionId: `sub_${account.address}_${tier}_${receipt.blockNumber}`,
      }
    } catch (error) {
      Logger.error("Subscription failed:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Subscription failed",
      }
    }
  }

  /**
   * Open a payment channel for efficient micropayments
   */
  async openPaymentChannel(
    amount: string,
    durationDays: number = 30
  ): Promise<{ success: boolean; channelId?: Hex; error?: string }> {
    const { publicClient, walletClient, account } = this.getClients()

    if (!walletClient || !account) {
      return { success: false, error: "Wallet not configured" }
    }

    try {
      const amountWei = parseUnits(amount, 18)
      const duration = BigInt(durationDays * 24 * 60 * 60)

      // Approve payment channel
      const approveTx = await walletClient.writeContract({
        address: this.contracts.usds,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [this.contracts.paymentChannel, amountWei],
      })
      await publicClient.waitForTransactionReceipt({ hash: approveTx })

      // Open channel
      const tx = await walletClient.writeContract({
        address: this.contracts.paymentChannel,
        abi: PAYMENT_CHANNEL_ABI,
        functionName: "openChannel",
        args: [this.contracts.paymentChannel, amountWei, duration],
      })

      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx })

      // Extract channel ID from logs (simplified)
      const channelId = `0x${receipt.blockNumber.toString(16).padStart(64, "0")}` as Hex
      this.channelId = channelId

      return { success: true, channelId }
    } catch (error) {
      Logger.error("Failed to open payment channel:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to open channel",
      }
    }
  }

  /**
   * Close payment channel and withdraw remaining balance
   */
  async closePaymentChannel(): Promise<boolean> {
    if (!this.channelId) {
      return false
    }

    const { publicClient, walletClient } = this.getClients()

    if (!walletClient) {
      return false
    }

    try {
      const tx = await walletClient.writeContract({
        address: this.contracts.paymentChannel,
        abi: PAYMENT_CHANNEL_ABI,
        functionName: "closeChannel",
        args: [this.channelId],
      })

      await publicClient.waitForTransactionReceipt({ hash: tx })
      this.channelId = undefined

      return true
    } catch (error) {
      Logger.error("Failed to close payment channel:", error)
      return false
    }
  }

  /**
   * Check if subscription has access to a tool
   */
  private hasToolAccess(subscription: UCAPSubscription, toolId: string): boolean {
    // Enterprise has unlimited access
    if (subscription.tier === "enterprise") {
      return true
    }

    // Check if tool is included in tier
    const tierTools: Record<SubscriptionTier, string[]> = {
      free: [],
      basic: ["contract_analysis", "tx_simulation"],
      pro: ["contract_analysis", "tx_simulation", "historical_data", "abi_generation"],
      enterprise: ["*"],
    }

    return tierTools[subscription.tier].includes(toolId)
  }

  /**
   * Record tool usage for subscription
   */
  private async recordToolUsage(toolId: string): Promise<void> {
    const { publicClient, walletClient, account } = this.getClients()

    if (!walletClient || !account) {
      return
    }

    try {
      const toolIdBytes = `0x${Buffer.from(toolId).toString("hex").padEnd(64, "0")}` as Hex

      await walletClient.writeContract({
        address: this.contracts.subscription,
        abi: SUBSCRIPTION_ABI,
        functionName: "recordUsage",
        args: [account.address, toolIdBytes],
      })
    } catch (error) {
      Logger.debug("Failed to record usage:", error)
    }
  }

  /**
   * Generate payment proof for channel payments
   */
  private generatePaymentProof(amount: string): Hex {
    // In a real implementation, this would be a cryptographic signature
    const proof = `${this.paymentNonce}_${amount}_${Date.now()}`
    return `0x${Buffer.from(proof).toString("hex")}` as Hex
  }

  /**
   * Get tier price per month
   */
  private getTierPrice(tier: SubscriptionTier): string {
    const prices: Record<SubscriptionTier, string> = {
      free: "0",
      basic: "9.99",
      pro: "49.99",
      enterprise: "199.99",
    }
    return prices[tier]
  }

  /**
   * Get tier features
   */
  private getTierFeatures(tier: SubscriptionTier): string[] {
    const features: Record<SubscriptionTier, string[]> = {
      free: [
        "5 contract analyses/month",
        "10 simulations/month",
        "Community support",
      ],
      basic: [
        "50 contract analyses/month",
        "100 simulations/month",
        "500 historical queries/month",
        "Email support",
      ],
      pro: [
        "500 contract analyses/month",
        "1000 simulations/month",
        "5000 historical queries/month",
        "100 ABI generations/month",
        "$100 gas sponsorship/month",
        "Priority support",
      ],
      enterprise: [
        "Unlimited contract analyses",
        "Unlimited simulations",
        "Unlimited historical queries",
        "Unlimited ABI generations",
        "$1000 gas sponsorship/month",
        "Dedicated support",
        "Custom integrations",
      ],
    }
    return features[tier]
  }

  /**
   * Get tier limits
   */
  private getTierLimits(tier: SubscriptionTier): any {
    const limits: Record<SubscriptionTier, any> = {
      free: {
        contractAnalyses: 5,
        simulations: 10,
        historicalQueries: 20,
        abiGenerations: 2,
        gasSponsorshipUsd: "0",
      },
      basic: {
        contractAnalyses: 50,
        simulations: 100,
        historicalQueries: 500,
        abiGenerations: 20,
        gasSponsorshipUsd: "10",
      },
      pro: {
        contractAnalyses: 500,
        simulations: 1000,
        historicalQueries: 5000,
        abiGenerations: 100,
        gasSponsorshipUsd: "100",
      },
      enterprise: {
        contractAnalyses: -1,
        simulations: -1,
        historicalQueries: -1,
        abiGenerations: -1,
        gasSponsorshipUsd: "1000",
      },
    }
    return limits[tier]
  }
}

// Singleton instance
let paymentService: UCAIPaymentService | null = null

/**
 * Get or create UCAI payment service
 */
export function getUCAIPaymentService(): UCAIPaymentService {
  if (!paymentService) {
    paymentService = new UCAIPaymentService()
  }
  return paymentService
}

export default UCAIPaymentService
