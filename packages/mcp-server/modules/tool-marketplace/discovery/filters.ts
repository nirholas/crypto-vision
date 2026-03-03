/**
 * Filter Engine
 * @description Advanced filtering with combined AND/OR logic
 * @author nirholas
 * @license Apache-2.0
 */

import Logger from "@/utils/logger.js"
import type { RegisteredTool, ToolCategory, ToolStatus } from "../types.js"
import type {
  AdvancedFilterOptions,
  CombinedFilter,
  FilterCondition,
  PriceRangeFilter,
} from "./types.js"

/**
 * Filter operator evaluators
 */
const operatorEvaluators = {
  eq: (value: unknown, target: unknown) => value === target,
  ne: (value: unknown, target: unknown) => value !== target,
  gt: (value: unknown, target: unknown) => Number(value) > Number(target),
  gte: (value: unknown, target: unknown) => Number(value) >= Number(target),
  lt: (value: unknown, target: unknown) => Number(value) < Number(target),
  lte: (value: unknown, target: unknown) => Number(value) <= Number(target),
  in: (value: unknown, target: unknown) => {
    if (Array.isArray(target)) {
      return target.includes(value)
    }
    return false
  },
  contains: (value: unknown, target: unknown) => {
    if (typeof value === "string" && typeof target === "string") {
      return value.toLowerCase().includes(target.toLowerCase())
    }
    if (Array.isArray(value)) {
      return value.some(v => 
        typeof v === "string" && typeof target === "string"
          ? v.toLowerCase().includes(target.toLowerCase())
          : v === target
      )
    }
    return false
  },
}

/**
 * Get nested value from object by path
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".")
  let current: unknown = obj

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined
    }
    current = (current as Record<string, unknown>)[part]
  }

  return current
}

/**
 * Evaluate a single filter condition
 */
function evaluateCondition(tool: RegisteredTool, condition: FilterCondition): boolean {
  const { field, operator, value } = condition
  const toolValue = getNestedValue(tool as unknown as Record<string, unknown>, field)

  const evaluator = operatorEvaluators[operator]
  if (!evaluator) {
    Logger.warn(`Unknown filter operator: ${operator}`)
    return true
  }

  return evaluator(toolValue, value)
}

/**
 * Evaluate a combined filter with AND/OR logic
 */
function evaluateCombinedFilter(tool: RegisteredTool, filter: CombinedFilter): boolean {
  const { operator, conditions, groups } = filter

  // Evaluate all conditions
  const conditionResults = conditions.map(c => evaluateCondition(tool, c))

  // Evaluate nested groups recursively
  const groupResults = (groups || []).map(g => evaluateCombinedFilter(tool, g))

  // Combine all results
  const allResults = [...conditionResults, ...groupResults]

  if (operator === "AND") {
    return allResults.every(r => r)
  } else {
    return allResults.some(r => r)
  }
}

/**
 * Filter Engine for advanced tool filtering
 */
export class FilterEngine {
  /**
   * Apply price range filter
   */
  private applyPriceRangeFilter(
    tools: RegisteredTool[],
    priceRange: PriceRangeFilter
  ): RegisteredTool[] {
    return tools.filter(tool => {
      const price = parseFloat(tool.pricing.basePrice || "0")

      if (priceRange.min !== undefined) {
        if (price < parseFloat(priceRange.min)) {
          return false
        }
      }

      if (priceRange.max !== undefined) {
        if (price > parseFloat(priceRange.max)) {
          return false
        }
      }

      return true
    })
  }

  /**
   * Apply category filter
   */
  private applyCategoryFilter(
    tools: RegisteredTool[],
    categories: ToolCategory[]
  ): RegisteredTool[] {
    if (categories.length === 0) return tools
    return tools.filter(tool => categories.includes(tool.category))
  }

  /**
   * Apply rating filter
   */
  private applyRatingFilter(
    tools: RegisteredTool[],
    minRating?: number,
    maxRating?: number
  ): RegisteredTool[] {
    return tools.filter(tool => {
      const rating = tool.metadata.rating

      if (minRating !== undefined && rating < minRating) {
        return false
      }

      if (maxRating !== undefined && rating > maxRating) {
        return false
      }

      return true
    })
  }

  /**
   * Apply chain filter
   */
  private applyChainFilter(
    tools: RegisteredTool[],
    chains: string[]
  ): RegisteredTool[] {
    if (chains.length === 0) return tools
    return tools.filter(tool =>
      tool.pricing.supportedChains.some(chain => chains.includes(chain))
    )
  }

  /**
   * Apply status filter
   */
  private applyStatusFilter(
    tools: RegisteredTool[],
    statuses: ToolStatus[]
  ): RegisteredTool[] {
    if (statuses.length === 0) return tools
    return tools.filter(tool => statuses.includes(tool.status))
  }

  /**
   * Apply response time filter
   */
  private applyResponseTimeFilter(
    tools: RegisteredTool[],
    maxResponseTime: number
  ): RegisteredTool[] {
    return tools.filter(tool => tool.metadata.avgResponseTime <= maxResponseTime)
  }

  /**
   * Apply uptime filter
   */
  private applyUptimeFilter(
    tools: RegisteredTool[],
    minUptime: number
  ): RegisteredTool[] {
    return tools.filter(tool => tool.metadata.uptime >= minUptime)
  }

  /**
   * Apply tag filter
   */
  private applyTagFilter(
    tools: RegisteredTool[],
    tags: string[],
    matchMode: "any" | "all"
  ): RegisteredTool[] {
    if (tags.length === 0) return tools

    return tools.filter(tool => {
      const toolTags = tool.tags?.map(t => t.toLowerCase()) || []
      const filterTags = tags.map(t => t.toLowerCase())

      if (matchMode === "all") {
        return filterTags.every(tag => toolTags.includes(tag))
      } else {
        return filterTags.some(tag => toolTags.includes(tag))
      }
    })
  }

  /**
   * Apply pricing model filter
   */
  private applyPricingModelFilter(
    tools: RegisteredTool[],
    models: string[]
  ): RegisteredTool[] {
    if (models.length === 0) return tools
    return tools.filter(tool => models.includes(tool.pricing.model))
  }

  /**
   * Apply owner filter
   */
  private applyOwnerFilter(
    tools: RegisteredTool[],
    owner: string
  ): RegisteredTool[] {
    return tools.filter(tool =>
      tool.owner.toLowerCase() === owner.toLowerCase()
    )
  }

  /**
   * Apply registration date filter
   */
  private applyDateFilter(
    tools: RegisteredTool[],
    after?: number,
    before?: number
  ): RegisteredTool[] {
    return tools.filter(tool => {
      if (after !== undefined && tool.registeredAt < after) {
        return false
      }

      if (before !== undefined && tool.registeredAt > before) {
        return false
      }

      return true
    })
  }

  /**
   * Apply all filters
   */
  filter(tools: RegisteredTool[], options: AdvancedFilterOptions): RegisteredTool[] {
    let filtered = [...tools]

    // Apply individual filters
    if (options.priceRange) {
      filtered = this.applyPriceRangeFilter(filtered, options.priceRange)
    }

    if (options.categories && options.categories.length > 0) {
      filtered = this.applyCategoryFilter(filtered, options.categories)
    }

    if (options.minRating !== undefined || options.maxRating !== undefined) {
      filtered = this.applyRatingFilter(
        filtered,
        options.minRating,
        options.maxRating
      )
    }

    if (options.chains && options.chains.length > 0) {
      filtered = this.applyChainFilter(filtered, options.chains)
    }

    if (options.status && options.status.length > 0) {
      filtered = this.applyStatusFilter(filtered, options.status)
    }

    if (options.maxResponseTime !== undefined) {
      filtered = this.applyResponseTimeFilter(filtered, options.maxResponseTime)
    }

    if (options.minUptime !== undefined) {
      filtered = this.applyUptimeFilter(filtered, options.minUptime)
    }

    if (options.tags && options.tags.length > 0) {
      filtered = this.applyTagFilter(
        filtered,
        options.tags,
        options.tagMatchMode || "any"
      )
    }

    if (options.pricingModels && options.pricingModels.length > 0) {
      filtered = this.applyPricingModelFilter(filtered, options.pricingModels)
    }

    if (options.owner) {
      filtered = this.applyOwnerFilter(filtered, options.owner)
    }

    if (options.registeredAfter !== undefined || options.registeredBefore !== undefined) {
      filtered = this.applyDateFilter(
        filtered,
        options.registeredAfter,
        options.registeredBefore
      )
    }

    // Apply custom combined filter if provided
    if (options.customFilter) {
      filtered = filtered.filter(tool =>
        evaluateCombinedFilter(tool, options.customFilter!)
      )
    }

    return filtered
  }

  /**
   * Create a price range filter
   */
  static priceRange(min?: string, max?: string): PriceRangeFilter {
    return { min, max }
  }

  /**
   * Create a combined filter with AND logic
   */
  static and(...conditions: FilterCondition[]): CombinedFilter {
    return { operator: "AND", conditions }
  }

  /**
   * Create a combined filter with OR logic
   */
  static or(...conditions: FilterCondition[]): CombinedFilter {
    return { operator: "OR", conditions }
  }

  /**
   * Create a filter condition
   */
  static condition(
    field: string,
    operator: FilterCondition["operator"],
    value: unknown
  ): FilterCondition {
    return { field, operator, value }
  }

  /**
   * Helper: filter by free tools
   */
  static freeTools(): AdvancedFilterOptions {
    return {
      priceRange: { max: "0" },
    }
  }

  /**
   * Helper: filter by premium tools
   */
  static premiumTools(minPrice: string = "0.01"): AdvancedFilterOptions {
    return {
      priceRange: { min: minPrice },
    }
  }

  /**
   * Helper: filter by high-quality tools
   */
  static highQuality(): AdvancedFilterOptions {
    return {
      minRating: 4.0,
      minUptime: 99,
    }
  }

  /**
   * Helper: filter by new tools
   */
  static newTools(daysAgo: number = 7): AdvancedFilterOptions {
    const cutoff = Date.now() - daysAgo * 24 * 60 * 60 * 1000
    return {
      registeredAfter: cutoff,
    }
  }

  /**
   * Helper: filter by specific chain
   */
  static forChain(chain: string): AdvancedFilterOptions {
    return {
      chains: [chain],
    }
  }

  /**
   * Helper: filter DeFi tools
   */
  static defiTools(): AdvancedFilterOptions {
    return {
      categories: ["defi"],
      tags: ["swap", "lending", "yield", "liquidity", "staking"],
      tagMatchMode: "any",
    }
  }

  /**
   * Helper: filter AI tools
   */
  static aiTools(): AdvancedFilterOptions {
    return {
      categories: ["ai"],
      tags: ["ml", "machine-learning", "prediction", "llm", "nlp"],
      tagMatchMode: "any",
    }
  }

  /**
   * Helper: filter data tools
   */
  static dataTools(): AdvancedFilterOptions {
    return {
      categories: ["data"],
      tags: ["price", "market", "oracle", "feed", "api"],
      tagMatchMode: "any",
    }
  }

  /**
   * Combine multiple filter options
   */
  static combine(...options: AdvancedFilterOptions[]): AdvancedFilterOptions {
    const combined: AdvancedFilterOptions = {}

    for (const opt of options) {
      // Merge price ranges (most restrictive)
      if (opt.priceRange) {
        if (!combined.priceRange) {
          combined.priceRange = {}
        }
        if (opt.priceRange.min !== undefined) {
          const currentMin = combined.priceRange.min
          if (currentMin === undefined || parseFloat(opt.priceRange.min) > parseFloat(currentMin)) {
            combined.priceRange.min = opt.priceRange.min
          }
        }
        if (opt.priceRange.max !== undefined) {
          const currentMax = combined.priceRange.max
          if (currentMax === undefined || parseFloat(opt.priceRange.max) < parseFloat(currentMax)) {
            combined.priceRange.max = opt.priceRange.max
          }
        }
      }

      // Merge arrays (union)
      if (opt.categories) {
        combined.categories = [...new Set([...(combined.categories || []), ...opt.categories])]
      }
      if (opt.chains) {
        combined.chains = [...new Set([...(combined.chains || []), ...opt.chains])]
      }
      if (opt.status) {
        combined.status = [...new Set([...(combined.status || []), ...opt.status])]
      }
      if (opt.tags) {
        combined.tags = [...new Set([...(combined.tags || []), ...opt.tags])]
      }
      if (opt.pricingModels) {
        combined.pricingModels = [...new Set([...(combined.pricingModels || []), ...opt.pricingModels])]
      }

      // Take most restrictive values
      if (opt.minRating !== undefined) {
        combined.minRating = Math.max(combined.minRating ?? 0, opt.minRating)
      }
      if (opt.maxRating !== undefined) {
        combined.maxRating = Math.min(combined.maxRating ?? 5, opt.maxRating)
      }
      if (opt.minUptime !== undefined) {
        combined.minUptime = Math.max(combined.minUptime ?? 0, opt.minUptime)
      }
      if (opt.maxResponseTime !== undefined) {
        combined.maxResponseTime = Math.min(combined.maxResponseTime ?? Infinity, opt.maxResponseTime)
      }
      if (opt.registeredAfter !== undefined) {
        combined.registeredAfter = Math.max(combined.registeredAfter ?? 0, opt.registeredAfter)
      }
      if (opt.registeredBefore !== undefined) {
        combined.registeredBefore = Math.min(combined.registeredBefore ?? Infinity, opt.registeredBefore)
      }

      // Keep tag match mode from last filter
      if (opt.tagMatchMode) {
        combined.tagMatchMode = opt.tagMatchMode
      }

      // Keep owner from last filter
      if (opt.owner) {
        combined.owner = opt.owner
      }
    }

    return combined
  }

  /**
   * Create filter from query parameters (URL parsing)
   */
  static fromQueryParams(params: Record<string, string | string[]>): AdvancedFilterOptions {
    const options: AdvancedFilterOptions = {}

    if (params.minPrice || params.maxPrice) {
      options.priceRange = {
        min: params.minPrice as string,
        max: params.maxPrice as string,
      }
    }

    if (params.category) {
      options.categories = Array.isArray(params.category)
        ? params.category as ToolCategory[]
        : [params.category as ToolCategory]
    }

    if (params.minRating) {
      options.minRating = parseFloat(params.minRating as string)
    }

    if (params.chain) {
      options.chains = Array.isArray(params.chain)
        ? params.chain
        : [params.chain]
    }

    if (params.tag) {
      options.tags = Array.isArray(params.tag)
        ? params.tag
        : [params.tag]
    }

    if (params.status) {
      options.status = Array.isArray(params.status)
        ? params.status as ToolStatus[]
        : [params.status as ToolStatus]
    }

    if (params.maxResponseTime) {
      options.maxResponseTime = parseInt(params.maxResponseTime as string, 10)
    }

    if (params.minUptime) {
      options.minUptime = parseFloat(params.minUptime as string)
    }

    return options
  }
}

/**
 * Singleton instance
 */
export const filterEngine = new FilterEngine()
