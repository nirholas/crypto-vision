/**
 * Discovery UI Helpers
 * @description Rich formatting helpers for AI responses
 * @author nirholas
 * @license Apache-2.0
 */

import type { RegisteredTool } from "../types.js"
import type {
  SearchResult,
  SearchResponse,
  RecommendedTool,
  TrendingTool,
  HotTool,
  NewTool,
  RisingStarTool,
  FeaturedTool,
  ToolBundle,
  ToolComparison,
  ToolAlternative,
} from "./types.js"

/**
 * Format a star rating display
 */
function formatStars(rating: number): string {
  const fullStars = Math.floor(rating)
  const hasHalf = rating - fullStars >= 0.5
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0)

  return "★".repeat(fullStars) + (hasHalf ? "½" : "") + "☆".repeat(emptyStars)
}

/**
 * Format price display
 */
function formatPrice(price: string | undefined): string {
  const num = parseFloat(price || "0")
  if (num === 0) return "Free"
  if (num < 0.001) return `$${num.toFixed(6)}`
  if (num < 1) return `$${num.toFixed(4)}`
  return `$${num.toFixed(2)}`
}

/**
 * Format number with commas
 */
function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`
  return num.toString()
}

/**
 * Format relative time
 */
function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)

  if (seconds < 60) return "just now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  if (seconds < 2592000) return `${Math.floor(seconds / 604800)}w ago`
  return `${Math.floor(seconds / 2592000)}mo ago`
}

/**
 * Format percentage with sign
 */
function formatPercentChange(percent: number): string {
  const sign = percent >= 0 ? "+" : ""
  return `${sign}${percent.toFixed(1)}%`
}

/**
 * UI Formatting Helpers
 */
export class UIFormatter {
  /**
   * Format a single tool card in markdown
   */
  static formatToolCard(tool: RegisteredTool): string {
    const rating = formatStars(tool.metadata.rating)
    const price = formatPrice(tool.pricing.basePrice)
    const calls = formatNumber(tool.metadata.totalCalls)

    return `
### ${tool.displayName}
**ID**: \`${tool.toolId}\`

${tool.description}

| Metric | Value |
|--------|-------|
| 💰 Price | ${price}/call |
| ⭐ Rating | ${rating} (${tool.metadata.ratingCount} reviews) |
| 📊 Total Calls | ${calls} |
| ⏱️ Avg Response | ${tool.metadata.avgResponseTime}ms |
| 🔄 Uptime | ${tool.metadata.uptime}% |
| 📁 Category | ${tool.category} |
| 🏷️ Tags | ${tool.tags?.join(", ") || "none"} |
| ⛓️ Chains | ${tool.pricing.supportedChains.join(", ")} |

${tool.docsUrl ? `📖 [Documentation](${tool.docsUrl})` : ""}
`.trim()
  }

  /**
   * Format tool as compact inline
   */
  static formatToolInline(tool: RegisteredTool): string {
    const price = formatPrice(tool.pricing.basePrice)
    return `**${tool.displayName}** (${price}, ${tool.metadata.rating.toFixed(1)}⭐)`
  }

  /**
   * Format search result
   */
  static formatSearchResult(result: SearchResult, rank: number): string {
    const tool = result.tool
    const price = formatPrice(tool.pricing.basePrice)
    const score = (result.score * 100).toFixed(0)

    return `
**${rank}. ${tool.displayName}** \`${tool.toolId}\`
> ${tool.description.slice(0, 100)}${tool.description.length > 100 ? "..." : ""}
> 💰 ${price} | ⭐ ${tool.metadata.rating.toFixed(1)} | 📊 ${formatNumber(tool.metadata.totalCalls)} calls | Match: ${score}%
> 🏷️ ${result.matchReasons.slice(0, 3).join(", ")}
`.trim()
  }

  /**
   * Format search results as paginated list
   */
  static formatSearchResults(response: SearchResponse): string {
    if (response.results.length === 0) {
      return `
## Search Results for "${response.query}"

❌ No results found.

${response.suggestions.length > 0 ? `**Suggestions**: Try searching for: ${response.suggestions.join(", ")}` : ""}
`.trim()
    }

    const resultsList = response.results
      .map((result, i) => this.formatSearchResult(result, i + 1))
      .join("\n\n")

    const startNum = (response.page - 1) * response.pageSize + 1
    const endNum = startNum + response.results.length - 1
    const totalPages = Math.ceil(response.totalResults / response.pageSize)

    return `
## Search Results for "${response.query}"

Found **${response.totalResults}** results (showing ${startNum}-${endNum}) | Page ${response.page}/${totalPages} | ${response.searchTimeMs}ms

${resultsList}

---
${response.suggestions.length > 0 ? `💡 **Related searches**: ${response.suggestions.join(", ")}` : ""}
${response.relatedCategories.length > 0 ? `📁 **Related categories**: ${response.relatedCategories.join(", ")}` : ""}
`.trim()
  }

  /**
   * Format tool comparison as side-by-side table
   */
  static formatComparison(comparison: ToolComparison): string {
    const tools = comparison.tools
    const headers = ["Metric", ...tools.map(t => t.displayName)]

    const rows: string[][] = []

    // Basic info
    rows.push(["Category", ...tools.map(t => t.category)])
    rows.push(["Price/Call", ...tools.map(t => formatPrice(t.pricing.basePrice))])
    rows.push(["Rating", ...tools.map(t => `${t.metadata.rating.toFixed(1)} ⭐`)])
    rows.push(["Total Calls", ...tools.map(t => formatNumber(t.metadata.totalCalls))])
    rows.push(["Avg Response", ...tools.map(t => `${t.metadata.avgResponseTime}ms`)])
    rows.push(["Uptime", ...tools.map(t => `${t.metadata.uptime}%`)])
    rows.push(["Chains", ...tools.map(t => t.pricing.supportedChains.join(", "))])

    // Custom metrics
    for (const metric of comparison.metrics) {
      const values = tools.map(t => {
        const val = metric.values[t.toolId]
        return val !== undefined ? String(val) : "N/A"
      })
      rows.push([metric.category, ...values])
    }

    // Format as markdown table
    const headerRow = `| ${headers.join(" | ")} |`
    const separator = `| ${headers.map(() => "---").join(" | ")} |`
    const dataRows = rows.map(row => `| ${row.join(" | ")} |`)

    let table = [headerRow, separator, ...dataRows].join("\n")

    // Add winners
    if (Object.keys(comparison.winners).length > 0) {
      table += "\n\n**Winners by metric**:\n"
      for (const [metric, toolId] of Object.entries(comparison.winners)) {
        const tool = tools.find(t => t.toolId === toolId)
        if (tool) {
          table += `- ${metric}: **${tool.displayName}**\n`
        }
      }
    }

    // Add recommendation
    if (comparison.recommendation) {
      const recTool = tools.find(t => t.toolId === comparison.recommendation!.toolId)
      if (recTool) {
        table += `\n🏆 **Recommendation**: ${recTool.displayName} - ${comparison.recommendation.reason}`
      }
    }

    return table
  }

  /**
   * Format recommended tool
   */
  static formatRecommendation(rec: RecommendedTool, rank: number): string {
    const tool = rec.tool
    const price = formatPrice(tool.pricing.basePrice)
    const confidence = (rec.score * 100).toFixed(0)

    return `
**${rank}. ${tool.displayName}** (${rec.type})
> ${tool.description.slice(0, 80)}...
> 💰 ${price} | ⭐ ${tool.metadata.rating.toFixed(1)} | Confidence: ${confidence}%
> 📋 ${rec.reasons.slice(0, 2).join(", ")}
`.trim()
  }

  /**
   * Format recommendations list
   */
  static formatRecommendations(recommendations: RecommendedTool[], title: string = "Recommendations"): string {
    if (recommendations.length === 0) {
      return `## ${title}\n\nNo recommendations available.`
    }

    const list = recommendations
      .map((rec, i) => this.formatRecommendation(rec, i + 1))
      .join("\n\n")

    return `## ${title}\n\n${list}`
  }

  /**
   * Format trending tool
   */
  static formatTrendingTool(trending: TrendingTool): string {
    const tool = trending.tool
    const trendIcon = trending.trend === "up" ? "📈" : trending.trend === "down" ? "📉" : "➡️"
    const change = formatPercentChange(trending.growthPercent)

    return `**#${trending.rank} ${tool.displayName}** ${trendIcon} ${change} | ${formatNumber(trending.callsInPeriod)} calls | $${trending.revenueInPeriod} revenue`
  }

  /**
   * Format trending list
   */
  static formatTrendingList(trending: TrendingTool[], period: string = "7d"): string {
    if (trending.length === 0) {
      return `## 📈 Trending (${period})\n\nNo trending tools.`
    }

    const list = trending.map(t => this.formatTrendingTool(t)).join("\n")
    return `## 📈 Trending (${period})\n\n${list}`
  }

  /**
   * Format hot tool
   */
  static formatHotTool(hot: HotTool, rank: number): string {
    const tool = hot.tool
    return `**${rank}. ${tool.displayName}** 🔥 | ${formatNumber(hot.calls24h)} calls | ${hot.activeUsers24h} active users (24h)`
  }

  /**
   * Format hot list
   */
  static formatHotList(hot: HotTool[]): string {
    if (hot.length === 0) {
      return `## 🔥 Hot Right Now\n\nNo hot tools.`
    }

    const list = hot.map((h, i) => this.formatHotTool(h, i + 1)).join("\n")
    return `## 🔥 Hot Right Now\n\n${list}`
  }

  /**
   * Format new tool
   */
  static formatNewTool(newTool: NewTool, rank: number): string {
    const tool = newTool.tool
    const verified = newTool.isVerified ? "✓ Verified" : "Pending"
    const age = formatRelativeTime(newTool.registeredAt)

    return `**${rank}. ${tool.displayName}** 🆕 | Registered ${age} | ${verified} | ${formatNumber(newTool.initialCalls)} calls`
  }

  /**
   * Format new tools list
   */
  static formatNewList(newTools: NewTool[]): string {
    if (newTools.length === 0) {
      return `## 🆕 New Tools\n\nNo new tools.`
    }

    const list = newTools.map((t, i) => this.formatNewTool(t, i + 1)).join("\n")
    return `## 🆕 New Tools\n\n${list}`
  }

  /**
   * Format rising star
   */
  static formatRisingStar(star: RisingStarTool, rank: number): string {
    const tool = star.tool
    return `**${rank}. ${tool.displayName}** ⭐ ${star.rating.toFixed(1)} (${star.ratingCount} reviews) | Only ${formatNumber(star.totalCalls)} calls | ${star.reasons[0]}`
  }

  /**
   * Format rising stars list
   */
  static formatRisingStars(stars: RisingStarTool[]): string {
    if (stars.length === 0) {
      return `## 🌟 Rising Stars\n\nNo rising stars.`
    }

    const list = stars.map((s, i) => this.formatRisingStar(s, i + 1)).join("\n")
    return `## 🌟 Rising Stars (Hidden Gems)\n\n${list}`
  }

  /**
   * Format featured tool
   */
  static formatFeaturedTool(featured: FeaturedTool): string {
    const tool = featured.tool
    const badge = featured.editorsPick ? "🏅 Editor's Pick" : "⭐ Featured"
    const until = new Date(featured.featuredUntil).toLocaleDateString()

    return `${badge} **${tool.displayName}**
> ${featured.reason}
> Featured until: ${until}`
  }

  /**
   * Format featured list
   */
  static formatFeaturedList(featured: FeaturedTool[]): string {
    if (featured.length === 0) {
      return `## ⭐ Featured Tools\n\nNo featured tools.`
    }

    const list = featured.map(f => this.formatFeaturedTool(f)).join("\n\n")
    return `## ⭐ Featured Tools\n\n${list}`
  }

  /**
   * Format bundle card
   */
  static formatBundleCard(bundle: ToolBundle): string {
    const savings = ((parseFloat(bundle.individualPriceTotal) - parseFloat(bundle.bundlePrice)) / parseFloat(bundle.individualPriceTotal) * 100).toFixed(0)
    const tools = bundle.tools.map(t => `- ${t.displayName}`).join("\n")

    return `
### 📦 ${bundle.name}
${bundle.isCurated ? "✓ Platform Curated" : `Created by ${bundle.creatorAddress.slice(0, 8)}...`}

${bundle.description}

**Included Tools** (${bundle.tools.length}):
${tools}

| | |
|---|---|
| Regular Price | ${formatPrice(bundle.individualPriceTotal)}/mo |
| **Bundle Price** | **${formatPrice(bundle.bundlePrice)}/mo** |
| You Save | ${formatPrice(bundle.savings)} (${savings}% off) |
| Subscribers | ${formatNumber(bundle.subscribers)} |
| Rating | ${bundle.rating > 0 ? formatStars(bundle.rating) : "New"} |
`.trim()
  }

  /**
   * Format bundles list
   */
  static formatBundlesList(bundles: ToolBundle[]): string {
    if (bundles.length === 0) {
      return `## 📦 Tool Bundles\n\nNo bundles available.`
    }

    const list = bundles.map(b => {
      const savings = ((parseFloat(b.individualPriceTotal) - parseFloat(b.bundlePrice)) / parseFloat(b.individualPriceTotal) * 100).toFixed(0)
      return `**${b.name}** | ${b.tools.length} tools | ${formatPrice(b.bundlePrice)}/mo | Save ${savings}% | ${formatNumber(b.subscribers)} subscribers`
    }).join("\n")

    return `## 📦 Tool Bundles\n\n${list}`
  }

  /**
   * Format tool alternative
   */
  static formatAlternative(alt: ToolAlternative, rank: number): string {
    const tool = alt.tool
    const priceDiff = alt.comparison.priceDifferencePercent > 0 ? `+${alt.comparison.priceDifferencePercent.toFixed(0)}%` : `${alt.comparison.priceDifferencePercent.toFixed(0)}%`
    const ratingDiff = alt.comparison.ratingDifference > 0 ? `+${alt.comparison.ratingDifference.toFixed(1)}` : `${alt.comparison.ratingDifference.toFixed(1)}`

    return `**${rank}. ${tool.displayName}** (${alt.type})
> Price: ${formatPrice(tool.pricing.basePrice)} (${priceDiff}) | Rating: ${tool.metadata.rating.toFixed(1)}⭐ (${ratingDiff})
> ${alt.reasons[0]}`
  }

  /**
   * Format alternatives list
   */
  static formatAlternatives(alternatives: ToolAlternative[], originalTool: RegisteredTool): string {
    if (alternatives.length === 0) {
      return `## Alternatives to ${originalTool.displayName}\n\nNo alternatives found.`
    }

    const list = alternatives.map((a, i) => this.formatAlternative(a, i + 1)).join("\n\n")
    return `## Alternatives to ${originalTool.displayName}\n\n${list}`
  }

  /**
   * Format discovery feed summary
   */
  static formatDiscoveryFeed(feed: {
    trending: TrendingTool[]
    hot: HotTool[]
    new: NewTool[]
    risingStars: RisingStarTool[]
    featured: FeaturedTool[]
  }): string {
    const sections: string[] = []

    if (feed.featured.length > 0) {
      sections.push(this.formatFeaturedList(feed.featured.slice(0, 3)))
    }

    if (feed.hot.length > 0) {
      sections.push(this.formatHotList(feed.hot.slice(0, 5)))
    }

    if (feed.trending.length > 0) {
      sections.push(this.formatTrendingList(feed.trending.slice(0, 5)))
    }

    if (feed.risingStars.length > 0) {
      sections.push(this.formatRisingStars(feed.risingStars.slice(0, 5)))
    }

    if (feed.new.length > 0) {
      sections.push(this.formatNewList(feed.new.slice(0, 5)))
    }

    return sections.join("\n\n---\n\n")
  }
}

export const formatToolCard = UIFormatter.formatToolCard
export const formatComparison = UIFormatter.formatComparison
export const formatSearchResults = UIFormatter.formatSearchResults
