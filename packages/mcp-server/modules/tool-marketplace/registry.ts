/**
 * Tool Registry Service
 * @description Core service for managing the decentralized tool marketplace
 * @author nirholas
 * @license Apache-2.0
 */

import type { Address } from "viem"
import Logger from "@/utils/logger.js"
import type {
  RegisterToolInput,
  RegisteredTool,
  ToolDiscoveryFilter,
  ToolUsageRecord,
  ToolRevenue,
  CreatorAnalytics,
  SubscriptionStatus,
  MarketplaceStats,
  MarketplaceEvent,
  PayoutConfig,
  ToolStatus,
  ToolMetadata,
} from "./types.js"

/**
 * In-memory storage for development/testing
 * Production would use on-chain storage + indexer
 */
interface RegistryStorage {
  tools: Map<string, RegisteredTool>
  usageRecords: Map<string, ToolUsageRecord[]>
  subscriptions: Map<string, SubscriptionStatus>
  events: MarketplaceEvent[]
  payoutConfig: Map<string, PayoutConfig>
}

const storage: RegistryStorage = {
  tools: new Map(),
  usageRecords: new Map(),
  subscriptions: new Map(),
  events: [],
  payoutConfig: new Map(),
}

/**
 * Generate a unique tool ID
 */
function generateToolId(name: string, owner: Address): string {
  const timestamp = Date.now()
  const hash = Buffer.from(`${name}-${owner}-${timestamp}`).toString("base64").slice(0, 8)
  return `tool_${hash}`
}

/**
 * Generate a unique ID
 */
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Default tool metadata
 */
function createDefaultMetadata(): ToolMetadata {
  return {
    version: "1.0.0",
    updatedAt: Date.now(),
    totalCalls: 0,
    totalRevenue: "0.00",
    avgResponseTime: 0,
    uptime: 100,
    rating: 0,
    ratingCount: 0,
  }
}

/**
 * Tool Registry Service
 * Manages registration, discovery, and usage tracking of paid AI tools
 */
export class ToolRegistryService {
  private platformFeePercent: number = 5 // 5% platform fee
  private platformAddress: Address

  constructor(platformAddress?: Address) {
    this.platformAddress = platformAddress || "0x0000000000000000000000000000000000000000" as Address
  }

  // ============================================================================
  // Tool Registration
  // ============================================================================

  /**
   * Register a new tool in the marketplace
   */
  async registerTool(input: RegisterToolInput): Promise<RegisteredTool> {
    // Validate input
    this.validateRegistration(input)

    // Check for duplicate name
    for (const tool of storage.tools.values()) {
      if (tool.name.toLowerCase() === input.name.toLowerCase()) {
        throw new Error(`Tool with name "${input.name}" already exists`)
      }
    }

    // Validate revenue split totals 100%
    const totalPercent = input.revenueSplit.reduce((sum, split) => sum + split.percent, 0)
    if (totalPercent !== 100) {
      throw new Error(`Revenue split must total 100%, got ${totalPercent}%`)
    }

    // Generate tool ID
    const toolId = generateToolId(input.name, input.owner)

    // Create registered tool
    const tool: RegisteredTool = {
      ...input,
      toolId,
      registeredAt: Date.now(),
      status: "active",
      metadata: createDefaultMetadata(),
    }

    // Store tool
    storage.tools.set(toolId, tool)

    // Emit event
    this.emitEvent({
      type: "tool-registered",
      timestamp: Date.now(),
      toolId,
      userAddress: input.owner,
      data: { name: input.name, category: input.category },
    })

    Logger.info(`Tool registered: ${input.name} (${toolId})`)
    return tool
  }

  /**
   * Update an existing tool
   */
  async updateTool(
    toolId: string,
    updates: Partial<Omit<RegisterToolInput, "owner" | "name">>,
    callerAddress: Address
  ): Promise<RegisteredTool> {
    const tool = storage.tools.get(toolId)
    if (!tool) {
      throw new Error(`Tool not found: ${toolId}`)
    }

    // Check ownership
    if (tool.owner.toLowerCase() !== callerAddress.toLowerCase()) {
      throw new Error("Only the tool owner can update it")
    }

    // Apply updates
    const updatedTool: RegisteredTool = {
      ...tool,
      ...updates,
      metadata: {
        ...tool.metadata,
        version: this.incrementVersion(tool.metadata.version),
        updatedAt: Date.now(),
      },
    }

    storage.tools.set(toolId, updatedTool)

    this.emitEvent({
      type: "tool-updated",
      timestamp: Date.now(),
      toolId,
      userAddress: callerAddress,
    })

    Logger.info(`Tool updated: ${tool.name} (${toolId})`)
    return updatedTool
  }

  /**
   * Pause a tool (stop accepting payments)
   */
  async pauseTool(toolId: string, callerAddress: Address): Promise<void> {
    const tool = storage.tools.get(toolId)
    if (!tool) {
      throw new Error(`Tool not found: ${toolId}`)
    }

    if (tool.owner.toLowerCase() !== callerAddress.toLowerCase()) {
      throw new Error("Only the tool owner can pause it")
    }

    tool.status = "paused"
    storage.tools.set(toolId, tool)

    this.emitEvent({
      type: "tool-paused",
      timestamp: Date.now(),
      toolId,
      userAddress: callerAddress,
    })

    Logger.info(`Tool paused: ${tool.name} (${toolId})`)
  }

  /**
   * Activate a paused tool
   */
  async activateTool(toolId: string, callerAddress: Address): Promise<void> {
    const tool = storage.tools.get(toolId)
    if (!tool) {
      throw new Error(`Tool not found: ${toolId}`)
    }

    if (tool.owner.toLowerCase() !== callerAddress.toLowerCase()) {
      throw new Error("Only the tool owner can activate it")
    }

    tool.status = "active"
    storage.tools.set(toolId, tool)

    this.emitEvent({
      type: "tool-activated",
      timestamp: Date.now(),
      toolId,
      userAddress: callerAddress,
    })

    Logger.info(`Tool activated: ${tool.name} (${toolId})`)
  }

  // ============================================================================
  // Tool Discovery
  // ============================================================================

  /**
   * Discover tools with filters
   */
  async discoverTools(filters: ToolDiscoveryFilter = {}): Promise<RegisteredTool[]> {
    let tools = Array.from(storage.tools.values())

    // Apply filters
    if (filters.activeOnly !== false) {
      tools = tools.filter(t => t.status === "active")
    }

    if (filters.category) {
      tools = tools.filter(t => t.category === filters.category)
    }

    if (filters.pricingModel) {
      tools = tools.filter(t => t.pricing.model === filters.pricingModel)
    }

    if (filters.maxPrice) {
      const maxPrice = parseFloat(filters.maxPrice)
      tools = tools.filter(t => {
        const basePrice = parseFloat(t.pricing.basePrice || "0")
        return basePrice <= maxPrice
      })
    }

    if (filters.minRating) {
      tools = tools.filter(t => t.metadata.rating >= filters.minRating!)
    }

    if (filters.query) {
      const query = filters.query.toLowerCase()
      tools = tools.filter(t =>
        t.name.toLowerCase().includes(query) ||
        t.displayName.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query)
      )
    }

    if (filters.tags && filters.tags.length > 0) {
      tools = tools.filter(t =>
        t.tags?.some(tag => filters.tags!.includes(tag))
      )
    }

    if (filters.chain) {
      tools = tools.filter(t =>
        t.pricing.supportedChains.includes(filters.chain!)
      )
    }

    // Sort
    const sortBy = filters.sortBy || "popularity"
    const sortOrder = filters.sortOrder || "desc"
    const multiplier = sortOrder === "desc" ? -1 : 1

    tools.sort((a, b) => {
      switch (sortBy) {
        case "price":
          return multiplier * (parseFloat(a.pricing.basePrice || "0") - parseFloat(b.pricing.basePrice || "0"))
        case "rating":
          return multiplier * (a.metadata.rating - b.metadata.rating)
        case "popularity":
          return multiplier * (a.metadata.totalCalls - b.metadata.totalCalls)
        case "newest":
          return multiplier * (a.registeredAt - b.registeredAt)
        default:
          return 0
      }
    })

    // Pagination
    const offset = filters.offset || 0
    const limit = filters.limit || 50

    return tools.slice(offset, offset + limit)
  }

  /**
   * Get a specific tool by ID
   */
  async getTool(toolId: string): Promise<RegisteredTool | null> {
    return storage.tools.get(toolId) || null
  }

  /**
   * Get a tool by name
   */
  async getToolByName(name: string): Promise<RegisteredTool | null> {
    for (const tool of storage.tools.values()) {
      if (tool.name.toLowerCase() === name.toLowerCase()) {
        return tool
      }
    }
    return null
  }

  /**
   * Get all tools by owner
   */
  async getToolsByOwner(ownerAddress: Address): Promise<RegisteredTool[]> {
    return Array.from(storage.tools.values()).filter(
      t => t.owner.toLowerCase() === ownerAddress.toLowerCase()
    )
  }

  // ============================================================================
  // Tool Usage
  // ============================================================================

  /**
   * Record a tool usage (called after successful payment)
   */
  async recordUsage(
    toolId: string,
    userAddress: Address,
    amountPaid: string,
    token: string,
    txHash: string,
    responseTime: number,
    success: boolean,
    error?: string
  ): Promise<ToolUsageRecord> {
    const tool = storage.tools.get(toolId)
    if (!tool) {
      throw new Error(`Tool not found: ${toolId}`)
    }

    const record: ToolUsageRecord = {
      id: generateId("usage"),
      toolId,
      userAddress,
      timestamp: Date.now(),
      amountPaid,
      token,
      txHash,
      responseTime,
      success,
      error,
    }

    // Store usage record
    const toolUsage = storage.usageRecords.get(toolId) || []
    toolUsage.push(record)
    storage.usageRecords.set(toolId, toolUsage)

    // Update tool metadata
    tool.metadata.totalCalls++
    tool.metadata.totalRevenue = (
      parseFloat(tool.metadata.totalRevenue) + parseFloat(amountPaid)
    ).toFixed(6)
    
    // Update average response time
    const allUsage = storage.usageRecords.get(toolId) || []
    const avgTime = allUsage.reduce((sum, u) => sum + u.responseTime, 0) / allUsage.length
    tool.metadata.avgResponseTime = Math.round(avgTime)

    storage.tools.set(toolId, tool)

    this.emitEvent({
      type: "tool-called",
      timestamp: Date.now(),
      toolId,
      userAddress,
      amount: amountPaid,
      txHash,
    })

    return record
  }

  /**
   * Get usage history for a tool
   */
  async getUsageHistory(
    toolId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<ToolUsageRecord[]> {
    const usage = storage.usageRecords.get(toolId) || []
    return usage
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(offset, offset + limit)
  }

  /**
   * Get usage history for a user
   */
  async getUserUsageHistory(
    userAddress: Address,
    limit: number = 100
  ): Promise<ToolUsageRecord[]> {
    const allUsage: ToolUsageRecord[] = []
    for (const records of storage.usageRecords.values()) {
      allUsage.push(
        ...records.filter(r => r.userAddress.toLowerCase() === userAddress.toLowerCase())
      )
    }
    return allUsage
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit)
  }

  // ============================================================================
  // Revenue Tracking
  // ============================================================================

  /**
   * Get revenue info for a tool
   */
  async getToolRevenue(toolId: string): Promise<ToolRevenue> {
    const tool = storage.tools.get(toolId)
    if (!tool) {
      throw new Error(`Tool not found: ${toolId}`)
    }

    const usage = storage.usageRecords.get(toolId) || []
    const now = Date.now()
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000

    const weeklyUsage = usage.filter(u => u.timestamp > weekAgo)
    const monthlyUsage = usage.filter(u => u.timestamp > monthAgo)

    const weeklyRevenue = weeklyUsage.reduce(
      (sum, u) => sum + parseFloat(u.amountPaid), 0
    ).toFixed(6)

    const monthlyRevenue = monthlyUsage.reduce(
      (sum, u) => sum + parseFloat(u.amountPaid), 0
    ).toFixed(6)

    // Calculate pending payouts based on revenue split
    const totalPending = parseFloat(tool.metadata.totalRevenue)
    const pendingPayouts = tool.revenueSplit.map(split => ({
      address: split.address,
      amount: ((totalPending * split.percent) / 100).toFixed(6),
    }))

    return {
      toolId,
      totalRevenue: tool.metadata.totalRevenue,
      weeklyRevenue,
      monthlyRevenue,
      pendingPayouts,
    }
  }

  /**
   * Get analytics for a creator
   */
  async getCreatorAnalytics(creatorAddress: Address): Promise<CreatorAnalytics> {
    const tools = await this.getToolsByOwner(creatorAddress)
    
    let totalRevenue = 0
    let totalCalls = 0
    let totalRating = 0
    let ratedTools = 0

    const revenueByTool = tools.map(tool => {
      totalRevenue += parseFloat(tool.metadata.totalRevenue)
      totalCalls += tool.metadata.totalCalls
      if (tool.metadata.rating > 0) {
        totalRating += tool.metadata.rating
        ratedTools++
      }

      return {
        toolId: tool.toolId,
        toolName: tool.name,
        revenue: tool.metadata.totalRevenue,
        calls: tool.metadata.totalCalls,
      }
    })

    // Calculate weekly revenue history (last 12 weeks)
    const weeklyRevenueHistory: { week: string; revenue: string }[] = []
    const now = Date.now()
    for (let i = 11; i >= 0; i--) {
      const weekStart = now - (i + 1) * 7 * 24 * 60 * 60 * 1000
      const weekEnd = now - i * 7 * 24 * 60 * 60 * 1000
      
      let weekRevenue = 0
      for (const tool of tools) {
        const usage = storage.usageRecords.get(tool.toolId) || []
        weekRevenue += usage
          .filter(u => u.timestamp >= weekStart && u.timestamp < weekEnd)
          .reduce((sum, u) => sum + parseFloat(u.amountPaid), 0)
      }

      weeklyRevenueHistory.push({
        week: new Date(weekStart).toISOString().slice(0, 10),
        revenue: weekRevenue.toFixed(6),
      })
    }

    return {
      creatorAddress,
      toolsOwned: tools.length,
      totalRevenue: totalRevenue.toFixed(6),
      totalCalls,
      avgRating: ratedTools > 0 ? totalRating / ratedTools : 0,
      revenueByTool,
      weeklyRevenueHistory,
    }
  }

  // ============================================================================
  // Subscriptions
  // ============================================================================

  /**
   * Create a subscription for a tool
   */
  async createSubscription(
    toolId: string,
    userAddress: Address,
    tierName: string,
    txHash: string
  ): Promise<SubscriptionStatus> {
    const tool = storage.tools.get(toolId)
    if (!tool) {
      throw new Error(`Tool not found: ${toolId}`)
    }

    if (tool.pricing.model !== "subscription") {
      throw new Error("This tool does not support subscriptions")
    }

    const tier = tool.pricing.subscriptionTiers?.find(t => t.name === tierName)
    if (!tier) {
      throw new Error(`Tier not found: ${tierName}`)
    }

    const now = Date.now()
    const subscriptionId = generateId("sub")

    const subscription: SubscriptionStatus = {
      subscriptionId,
      userAddress,
      toolId,
      tierName,
      startDate: now,
      endDate: now + 30 * 24 * 60 * 60 * 1000, // 30 days
      callsUsed: 0,
      callsRemaining: tier.callsIncluded,
      autoRenew: true,
      lastPayment: now,
      nextPaymentDue: now + 30 * 24 * 60 * 60 * 1000,
    }

    storage.subscriptions.set(subscriptionId, subscription)

    this.emitEvent({
      type: "subscription-created",
      timestamp: now,
      toolId,
      userAddress,
      amount: tier.monthlyPrice,
      txHash,
      data: { tierName, subscriptionId },
    })

    Logger.info(`Subscription created: ${subscriptionId} for ${tool.name}`)
    return subscription
  }

  /**
   * Get active subscription for a user and tool
   */
  async getSubscription(
    toolId: string,
    userAddress: Address
  ): Promise<SubscriptionStatus | null> {
    for (const sub of storage.subscriptions.values()) {
      if (
        sub.toolId === toolId &&
        sub.userAddress.toLowerCase() === userAddress.toLowerCase() &&
        sub.endDate > Date.now()
      ) {
        return sub
      }
    }
    return null
  }

  /**
   * Use a subscription call
   */
  async useSubscriptionCall(subscriptionId: string): Promise<boolean> {
    const sub = storage.subscriptions.get(subscriptionId)
    if (!sub) {
      throw new Error(`Subscription not found: ${subscriptionId}`)
    }

    if (sub.endDate < Date.now()) {
      throw new Error("Subscription has expired")
    }

    if (sub.callsRemaining <= 0) {
      throw new Error("No calls remaining in subscription")
    }

    sub.callsUsed++
    sub.callsRemaining--
    storage.subscriptions.set(subscriptionId, sub)

    return true
  }

  // ============================================================================
  // Marketplace Stats
  // ============================================================================

  /**
   * Get overall marketplace statistics
   */
  async getMarketplaceStats(): Promise<MarketplaceStats> {
    const tools = Array.from(storage.tools.values())
    const activeTools = tools.filter(t => t.status === "active")

    // Get unique creators
    const creators = new Set(tools.map(t => t.owner.toLowerCase()))

    // Calculate volumes
    const now = Date.now()
    const day24h = now - 24 * 60 * 60 * 1000
    const day7d = now - 7 * 24 * 60 * 60 * 1000

    let totalVolume = 0
    let volume24h = 0
    let volume7d = 0
    let totalCalls = 0

    for (const tool of tools) {
      totalVolume += parseFloat(tool.metadata.totalRevenue)
      totalCalls += tool.metadata.totalCalls

      const usage = storage.usageRecords.get(tool.toolId) || []
      for (const record of usage) {
        const amount = parseFloat(record.amountPaid)
        if (record.timestamp > day24h) volume24h += amount
        if (record.timestamp > day7d) volume7d += amount
      }
    }

    // Calculate average price
    const pricesSum = tools.reduce(
      (sum, t) => sum + parseFloat(t.pricing.basePrice || "0"), 0
    )
    const avgToolPrice = tools.length > 0 ? (pricesSum / tools.length).toFixed(6) : "0"

    // Find top category
    const categoryCount: Record<string, number> = {}
    for (const tool of tools) {
      categoryCount[tool.category] = (categoryCount[tool.category] || 0) + 1
    }
    const topCategory = Object.entries(categoryCount)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || "other"

    // Top tools by revenue
    const topToolsByRevenue = tools
      .sort((a, b) => parseFloat(b.metadata.totalRevenue) - parseFloat(a.metadata.totalRevenue))
      .slice(0, 10)
      .map(t => ({
        toolId: t.toolId,
        name: t.name,
        revenue: t.metadata.totalRevenue,
      }))

    return {
      totalTools: tools.length,
      activeTools: activeTools.length,
      totalCreators: creators.size,
      totalVolume: totalVolume.toFixed(6),
      volume24h: volume24h.toFixed(6),
      volume7d: volume7d.toFixed(6),
      totalCalls,
      avgToolPrice,
      topCategory: topCategory as any,
      topToolsByRevenue,
    }
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private validateRegistration(input: RegisterToolInput): void {
    if (!input.name || input.name.length < 3) {
      throw new Error("Tool name must be at least 3 characters")
    }

    if (!input.endpoint || !input.endpoint.startsWith("http")) {
      throw new Error("Valid endpoint URL is required")
    }

    if (!input.pricing.acceptedTokens || input.pricing.acceptedTokens.length === 0) {
      throw new Error("At least one accepted token is required")
    }

    if (!input.revenueSplit || input.revenueSplit.length === 0) {
      throw new Error("Revenue split configuration is required")
    }
  }

  private incrementVersion(version: string): string {
    const parts = version.split(".")
    const patch = parseInt(parts[2] || "0") + 1
    return `${parts[0]}.${parts[1]}.${patch}`
  }

  private emitEvent(event: MarketplaceEvent): void {
    storage.events.push(event)
    // Keep only last 10000 events
    if (storage.events.length > 10000) {
      storage.events = storage.events.slice(-10000)
    }
  }

  /**
   * Get recent events
   */
  async getRecentEvents(limit: number = 100): Promise<MarketplaceEvent[]> {
    return storage.events.slice(-limit).reverse()
  }

  /**
   * Clear all storage (for testing)
   */
  async clearStorage(): Promise<void> {
    storage.tools.clear()
    storage.usageRecords.clear()
    storage.subscriptions.clear()
    storage.events.length = 0
    storage.payoutConfig.clear()
  }
}

// Export singleton instance
export const toolRegistry = new ToolRegistryService()
