/**
 * Tool Bundles
 * @description Pre-packaged tool combinations with bundle discounts
 * @author nirholas
 * @license Apache-2.0
 */

import Logger from "@/utils/logger.js"
import type { Address } from "viem"
import type { RegisteredTool } from "../types.js"
import type {
  ToolBundle,
  BundleSubscription,
  CreateBundleInput,
} from "./types.js"

/**
 * Generate unique bundle ID
 */
function generateBundleId(): string {
  return `bundle_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Generate unique subscription ID
 */
function generateSubscriptionId(): string {
  return `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Pre-defined bundle templates
 */
export const BUNDLE_TEMPLATES = {
  defiStarter: {
    name: "DeFi Starter Pack",
    description: "Essential tools for DeFi operations: price feeds, swap quotes, and gas estimation",
    category: "defi",
    tags: ["defi", "starter", "essential"],
    requiredCategories: ["data", "defi"],
    requiredTags: ["price", "swap", "gas"],
    discountPercent: 15,
  },
  tradingPro: {
    name: "Trading Pro Bundle",
    description: "Professional trading tools: real-time prices, technical analysis, and alerts",
    category: "trading",
    tags: ["trading", "professional", "analytics"],
    requiredCategories: ["data", "analytics"],
    requiredTags: ["price", "chart", "alert", "analysis"],
    discountPercent: 20,
  },
  nftCreator: {
    name: "NFT Creator Toolkit",
    description: "Everything for NFT creators: metadata tools, marketplace integration, and analytics",
    category: "nft",
    tags: ["nft", "creator", "toolkit"],
    requiredCategories: ["data", "utilities"],
    requiredTags: ["nft", "metadata", "ipfs"],
    discountPercent: 10,
  },
  aiAnalytics: {
    name: "AI Analytics Suite",
    description: "AI-powered tools for market prediction, sentiment analysis, and insights",
    category: "ai",
    tags: ["ai", "ml", "prediction", "analytics"],
    requiredCategories: ["ai", "analytics"],
    requiredTags: ["prediction", "sentiment", "ml"],
    discountPercent: 25,
  },
  dataComplete: {
    name: "Data Complete Package",
    description: "Comprehensive data access: prices, volumes, on-chain metrics, and historical data",
    category: "data",
    tags: ["data", "complete", "comprehensive"],
    requiredCategories: ["data"],
    requiredTags: ["price", "volume", "historical", "onchain"],
    discountPercent: 20,
  },
}

/**
 * Tool Bundles Manager
 */
export class BundleManager {
  private tools: Map<string, RegisteredTool> = new Map()
  private bundles: Map<string, ToolBundle> = new Map()
  private subscriptions: Map<string, BundleSubscription> = new Map()
  private platformAddress: Address

  constructor(platformAddress: Address = "0x0000000000000000000000000000000000000000" as Address) {
    this.platformAddress = platformAddress
  }

  /**
   * Load tools
   */
  loadTools(tools: RegisteredTool[]): void {
    this.tools.clear()
    for (const tool of tools) {
      this.tools.set(tool.toolId, tool)
    }
    Logger.info(`Loaded ${tools.length} tools for bundles`)
  }

  /**
   * Calculate bundle pricing
   */
  private calculateBundlePricing(
    tools: RegisteredTool[],
    discountPercent: number
  ): { individualTotal: string; bundlePrice: string; savings: string } {
    // Sum individual prices (monthly equivalent)
    let individualTotal = 0
    for (const tool of tools) {
      const basePrice = parseFloat(tool.pricing.basePrice || "0")
      // Assume 1000 calls per month average for per-call pricing
      individualTotal += basePrice * 1000
    }

    const discount = discountPercent / 100
    const bundlePrice = individualTotal * (1 - discount)
    const savings = individualTotal - bundlePrice

    return {
      individualTotal: individualTotal.toFixed(4),
      bundlePrice: bundlePrice.toFixed(4),
      savings: savings.toFixed(4),
    }
  }

  /**
   * Create a new bundle
   */
  async createBundle(input: CreateBundleInput): Promise<ToolBundle> {
    // Validate tools exist
    const bundleTools: RegisteredTool[] = []
    for (const toolId of input.toolIds) {
      const tool = this.tools.get(toolId)
      if (!tool) {
        throw new Error(`Tool not found: ${toolId}`)
      }
      if (tool.status !== "active") {
        throw new Error(`Tool is not active: ${toolId}`)
      }
      bundleTools.push(tool)
    }

    if (bundleTools.length < 2) {
      throw new Error("Bundle must contain at least 2 tools")
    }

    if (input.discountPercent < 0 || input.discountPercent > 50) {
      throw new Error("Discount must be between 0% and 50%")
    }

    // Calculate pricing
    const pricing = this.calculateBundlePricing(bundleTools, input.discountPercent)

    const bundleId = generateBundleId()
    const bundle: ToolBundle = {
      bundleId,
      name: input.name,
      description: input.description,
      category: input.category,
      tools: bundleTools,
      toolIds: input.toolIds,
      individualPriceTotal: pricing.individualTotal,
      bundlePrice: pricing.bundlePrice,
      discountPercent: input.discountPercent,
      savings: pricing.savings,
      creatorAddress: input.creatorAddress,
      isCurated: input.creatorAddress.toLowerCase() === this.platformAddress.toLowerCase(),
      tags: input.tags || [],
      subscribers: 0,
      rating: 0,
      createdAt: Date.now(),
    }

    this.bundles.set(bundleId, bundle)
    Logger.info(`Created bundle: ${input.name} (${bundleId})`)

    return bundle
  }

  /**
   * Get bundle by ID
   */
  getBundle(bundleId: string): ToolBundle | undefined {
    return this.bundles.get(bundleId)
  }

  /**
   * Update bundle
   */
  async updateBundle(
    bundleId: string,
    updates: Partial<Pick<ToolBundle, "name" | "description" | "discountPercent" | "tags">>,
    callerAddress: Address
  ): Promise<ToolBundle> {
    const bundle = this.bundles.get(bundleId)
    if (!bundle) {
      throw new Error(`Bundle not found: ${bundleId}`)
    }

    if (bundle.creatorAddress.toLowerCase() !== callerAddress.toLowerCase()) {
      throw new Error("Only bundle creator can update")
    }

    // Apply updates
    if (updates.name) bundle.name = updates.name
    if (updates.description) bundle.description = updates.description
    if (updates.tags) bundle.tags = updates.tags

    // Recalculate pricing if discount changed
    if (updates.discountPercent !== undefined) {
      bundle.discountPercent = updates.discountPercent
      const pricing = this.calculateBundlePricing(bundle.tools, updates.discountPercent)
      bundle.bundlePrice = pricing.bundlePrice
      bundle.savings = pricing.savings
    }

    this.bundles.set(bundleId, bundle)
    return bundle
  }

  /**
   * Delete bundle
   */
  async deleteBundle(bundleId: string, callerAddress: Address): Promise<void> {
    const bundle = this.bundles.get(bundleId)
    if (!bundle) {
      throw new Error(`Bundle not found: ${bundleId}`)
    }

    if (bundle.creatorAddress.toLowerCase() !== callerAddress.toLowerCase()) {
      throw new Error("Only bundle creator can delete")
    }

    // Check for active subscriptions
    for (const sub of this.subscriptions.values()) {
      if (sub.bundleId === bundleId && sub.status === "active") {
        throw new Error("Cannot delete bundle with active subscriptions")
      }
    }

    this.bundles.delete(bundleId)
    Logger.info(`Deleted bundle: ${bundleId}`)
  }

  /**
   * List all bundles
   */
  listBundles(options: {
    category?: string
    minDiscount?: number
    creatorAddress?: Address
    curatedOnly?: boolean
    sortBy?: "subscribers" | "discount" | "price" | "rating" | "newest"
    limit?: number
    offset?: number
  } = {}): ToolBundle[] {
    const {
      category,
      minDiscount,
      creatorAddress,
      curatedOnly = false,
      sortBy = "subscribers",
      limit = 50,
      offset = 0,
    } = options

    let bundles = Array.from(this.bundles.values())

    // Apply filters
    if (category) {
      bundles = bundles.filter(b => b.category === category)
    }

    if (minDiscount !== undefined) {
      bundles = bundles.filter(b => b.discountPercent >= minDiscount)
    }

    if (creatorAddress) {
      bundles = bundles.filter(b =>
        b.creatorAddress.toLowerCase() === creatorAddress.toLowerCase()
      )
    }

    if (curatedOnly) {
      bundles = bundles.filter(b => b.isCurated)
    }

    // Sort
    switch (sortBy) {
      case "subscribers":
        bundles.sort((a, b) => b.subscribers - a.subscribers)
        break
      case "discount":
        bundles.sort((a, b) => b.discountPercent - a.discountPercent)
        break
      case "price":
        bundles.sort((a, b) => parseFloat(a.bundlePrice) - parseFloat(b.bundlePrice))
        break
      case "rating":
        bundles.sort((a, b) => b.rating - a.rating)
        break
      case "newest":
        bundles.sort((a, b) => b.createdAt - a.createdAt)
        break
    }

    return bundles.slice(offset, offset + limit)
  }

  /**
   * Subscribe to a bundle
   */
  async subscribe(
    bundleId: string,
    userAddress: Address,
    options: { autoRenew?: boolean } = {}
  ): Promise<BundleSubscription> {
    const bundle = this.bundles.get(bundleId)
    if (!bundle) {
      throw new Error(`Bundle not found: ${bundleId}`)
    }

    // Check for existing active subscription
    for (const sub of this.subscriptions.values()) {
      if (
        sub.bundleId === bundleId &&
        sub.userAddress.toLowerCase() === userAddress.toLowerCase() &&
        sub.status === "active"
      ) {
        throw new Error("Already subscribed to this bundle")
      }
    }

    const subscriptionId = generateSubscriptionId()
    const now = Date.now()
    const endDate = now + 30 * 24 * 60 * 60 * 1000 // 30 days

    const subscription: BundleSubscription = {
      subscriptionId,
      bundleId,
      userAddress,
      startDate: now,
      endDate,
      monthlyPrice: bundle.bundlePrice,
      autoRenew: options.autoRenew ?? false,
      status: "active",
    }

    this.subscriptions.set(subscriptionId, subscription)

    // Update bundle subscriber count
    bundle.subscribers++
    this.bundles.set(bundleId, bundle)

    Logger.info(`User ${userAddress} subscribed to bundle ${bundleId}`)
    return subscription
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(subscriptionId: string, userAddress: Address): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId)
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`)
    }

    if (subscription.userAddress.toLowerCase() !== userAddress.toLowerCase()) {
      throw new Error("Only subscription owner can cancel")
    }

    subscription.status = "cancelled"
    subscription.autoRenew = false
    this.subscriptions.set(subscriptionId, subscription)

    // Update bundle subscriber count
    const bundle = this.bundles.get(subscription.bundleId)
    if (bundle) {
      bundle.subscribers = Math.max(0, bundle.subscribers - 1)
      this.bundles.set(subscription.bundleId, bundle)
    }

    Logger.info(`Subscription cancelled: ${subscriptionId}`)
  }

  /**
   * Get user's subscriptions
   */
  getUserSubscriptions(userAddress: Address): BundleSubscription[] {
    return Array.from(this.subscriptions.values()).filter(
      s => s.userAddress.toLowerCase() === userAddress.toLowerCase()
    )
  }

  /**
   * Check if user has access to a bundle
   */
  hasAccess(userAddress: Address, bundleId: string): boolean {
    for (const sub of this.subscriptions.values()) {
      if (
        sub.bundleId === bundleId &&
        sub.userAddress.toLowerCase() === userAddress.toLowerCase() &&
        sub.status === "active" &&
        sub.endDate > Date.now()
      ) {
        return true
      }
    }
    return false
  }

  /**
   * Get bundles containing a specific tool
   */
  getBundlesForTool(toolId: string): ToolBundle[] {
    return Array.from(this.bundles.values()).filter(b =>
      b.toolIds.includes(toolId)
    )
  }

  /**
   * Auto-generate bundles based on tool categories and tags
   */
  async autoGenerateBundles(): Promise<ToolBundle[]> {
    const generated: ToolBundle[] = []

    for (const [templateKey, template] of Object.entries(BUNDLE_TEMPLATES)) {
      // Find matching tools
      const matchingTools: RegisteredTool[] = []

      for (const tool of this.tools.values()) {
        if (tool.status !== "active") continue

        // Check category match
        const categoryMatch = template.requiredCategories.includes(tool.category)

        // Check tag match
        const tagMatch = template.requiredTags.some(tag =>
          tool.tags?.some(t => t.toLowerCase().includes(tag.toLowerCase()))
        )

        if (categoryMatch || tagMatch) {
          matchingTools.push(tool)
        }
      }

      // Need at least 3 tools to make a bundle
      if (matchingTools.length < 3) continue

      // Select top tools by rating and popularity
      const selectedTools = matchingTools
        .sort((a, b) => {
          const scoreA = a.metadata.rating * Math.log(a.metadata.totalCalls + 1)
          const scoreB = b.metadata.rating * Math.log(b.metadata.totalCalls + 1)
          return scoreB - scoreA
        })
        .slice(0, 5)

      try {
        const bundle = await this.createBundle({
          name: template.name,
          description: template.description,
          category: template.category,
          toolIds: selectedTools.map(t => t.toolId),
          discountPercent: template.discountPercent,
          creatorAddress: this.platformAddress,
          tags: template.tags,
        })

        generated.push(bundle)
      } catch (error) {
        Logger.warn(`Failed to auto-generate bundle ${templateKey}: ${error}`)
      }
    }

    Logger.info(`Auto-generated ${generated.length} bundles`)
    return generated
  }

  /**
   * Suggest bundle for a user based on their usage
   */
  suggestBundleForUser(
    usedToolIds: string[],
    options: { maxPrice?: string } = {}
  ): ToolBundle | null {
    const { maxPrice } = options

    // Find bundles that contain tools the user uses
    const candidates: { bundle: ToolBundle; overlap: number }[] = []

    for (const bundle of this.bundles.values()) {
      const overlap = bundle.toolIds.filter(id => usedToolIds.includes(id)).length

      if (overlap > 0) {
        // Check price constraint
        if (maxPrice && parseFloat(bundle.bundlePrice) > parseFloat(maxPrice)) {
          continue
        }

        candidates.push({ bundle, overlap })
      }
    }

    // Sort by overlap (more tools user already uses = better fit)
    candidates.sort((a, b) => {
      if (b.overlap !== a.overlap) return b.overlap - a.overlap
      return a.bundle.discountPercent - b.bundle.discountPercent
    })

    return candidates[0]?.bundle || null
  }

  /**
   * Get bundle statistics
   */
  getStats(): {
    totalBundles: number
    curatedBundles: number
    totalSubscribers: number
    avgDiscount: number
    topCategories: { category: string; count: number }[]
  } {
    const bundles = Array.from(this.bundles.values())
    
    const categoryCount = new Map<string, number>()
    let totalSubscribers = 0
    let totalDiscount = 0
    let curatedCount = 0

    for (const bundle of bundles) {
      totalSubscribers += bundle.subscribers
      totalDiscount += bundle.discountPercent
      if (bundle.isCurated) curatedCount++

      const count = categoryCount.get(bundle.category) || 0
      categoryCount.set(bundle.category, count + 1)
    }

    const topCategories = Array.from(categoryCount.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    return {
      totalBundles: bundles.length,
      curatedBundles: curatedCount,
      totalSubscribers,
      avgDiscount: bundles.length > 0 ? totalDiscount / bundles.length : 0,
      topCategories,
    }
  }

  /**
   * Process subscription renewals
   */
  async processRenewals(): Promise<{ renewed: number; expired: number }> {
    const now = Date.now()
    let renewed = 0
    let expired = 0

    for (const [subId, sub] of this.subscriptions) {
      if (sub.status !== "active") continue
      if (sub.endDate > now) continue

      if (sub.autoRenew) {
        // Renew subscription
        sub.startDate = now
        sub.endDate = now + 30 * 24 * 60 * 60 * 1000
        this.subscriptions.set(subId, sub)
        renewed++
      } else {
        // Mark as expired
        sub.status = "expired"
        this.subscriptions.set(subId, sub)

        // Update bundle subscriber count
        const bundle = this.bundles.get(sub.bundleId)
        if (bundle) {
          bundle.subscribers = Math.max(0, bundle.subscribers - 1)
          this.bundles.set(sub.bundleId, bundle)
        }
        expired++
      }
    }

    if (renewed > 0 || expired > 0) {
      Logger.info(`Processed renewals: ${renewed} renewed, ${expired} expired`)
    }

    return { renewed, expired }
  }
}

/**
 * Singleton instance
 */
export const bundleManager = new BundleManager()
