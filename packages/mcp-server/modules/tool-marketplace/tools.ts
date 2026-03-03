/**
 * Tool Marketplace MCP Tools
 * @description MCP tools for the decentralized AI tool marketplace
 * @author nirholas
 * @license Apache-2.0
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { toolRegistry, ToolRegistryService } from "./registry.js"
import type { Address } from "viem"
import Logger from "@/utils/logger.js"

// Trust & Verification imports
import { endpointVerifier } from "./verification/endpoint-verifier.js"
import { schemaValidator } from "./verification/schema-validator.js"
import { securityScanner } from "./verification/security-scanner.js"
import { ratingService } from "./reputation/rating.js"
import { reputationScorer } from "./reputation/score.js"
import { disputeManager } from "./disputes/manager.js"
import { autoResolver } from "./disputes/auto-resolver.js"
import { arbitrationDAO } from "./disputes/arbitration.js"

/**
 * Revenue split schema
 */
const RevenueSplitSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
  percent: z.number().min(0).max(100),
  label: z.string().optional(),
})

/**
 * Pricing schema
 */
const PricingSchema = z.object({
  model: z.enum(["per-call", "subscription", "tiered", "freemium"]),
  basePrice: z.string().optional(),
  freeCallsPerDay: z.number().optional(),
  acceptedTokens: z.array(z.enum(["USDs", "USDC", "ETH"])),
  supportedChains: z.array(z.string()),
})

/**
 * Register tool marketplace tools with MCP server
 */
export function registerToolMarketplaceTools(server: McpServer): void {
  // ============================================================================
  // Tool Registration Tools
  // ============================================================================

  server.tool(
    "marketplace_register_tool",
    "Register a new AI tool in the decentralized marketplace. " +
    "Define pricing, revenue splits, and make your tool discoverable to AI agents.",
    {
      name: z.string().min(3).max(50).describe("Unique tool identifier (e.g., 'weather-premium')"),
      displayName: z.string().max(100).describe("Human-readable display name"),
      description: z.string().max(500).describe("Tool description"),
      endpoint: z.string().url().describe("API endpoint URL"),
      category: z.enum(["data", "ai", "defi", "analytics", "social", "utilities", "notifications", "storage", "compute", "other"]).describe("Tool category"),
      price: z.string().describe("Price per call in USD (e.g., '0.001')"),
      acceptedTokens: z.array(z.enum(["USDs", "USDC", "ETH"])).default(["USDs"]).describe("Accepted payment tokens"),
      supportedChains: z.array(z.string()).default(["arbitrum"]).describe("Supported blockchain networks"),
      ownerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe("Tool owner wallet address"),
      revenueSplit: z.array(RevenueSplitSchema).describe("Revenue split configuration (must total 100%)"),
      docsUrl: z.string().url().optional().describe("Documentation URL"),
      tags: z.array(z.string()).optional().describe("Tags for discovery"),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (params: any) => {
      try {
        const tool = await toolRegistry.registerTool({
          name: params.name,
          displayName: params.displayName,
          description: params.description,
          endpoint: params.endpoint,
          category: params.category,
          pricing: {
            model: "per-call",
            basePrice: params.price,
            acceptedTokens: params.acceptedTokens as any,
            supportedChains: params.supportedChains,
          },
          owner: params.ownerAddress as Address,
          revenueSplit: params.revenueSplit as any,
          docsUrl: params.docsUrl,
          tags: params.tags,
        })

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: `Tool "${params.displayName}" registered successfully!`,
              toolId: tool.toolId,
              name: tool.name,
              endpoint: tool.endpoint,
              price: params.price,
              status: tool.status,
              registeredAt: new Date(tool.registeredAt).toISOString(),
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Registration failed",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  server.tool(
    "marketplace_update_tool",
    "Update an existing tool's settings (pricing, description, etc.). Only the tool owner can update.",
    {
      toolId: z.string().describe("The tool ID to update"),
      callerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe("Your wallet address (must be owner)"),
      displayName: z.string().optional().describe("New display name"),
      description: z.string().optional().describe("New description"),
      price: z.string().optional().describe("New price per call"),
      docsUrl: z.string().url().optional().describe("New documentation URL"),
      tags: z.array(z.string()).optional().describe("New tags"),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (params: any) => {
      try {
        const updates: any = {}
        if (params.displayName) updates.displayName = params.displayName
        if (params.description) updates.description = params.description
        if (params.docsUrl) updates.docsUrl = params.docsUrl
        if (params.tags) updates.tags = params.tags
        if (params.price) {
          const tool = await toolRegistry.getTool(params.toolId)
          if (tool) {
            updates.pricing = { ...tool.pricing, basePrice: params.price }
          }
        }

        const tool = await toolRegistry.updateTool(
          params.toolId,
          updates,
          params.callerAddress as Address
        )

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: "Tool updated successfully",
              tool: {
                toolId: tool.toolId,
                name: tool.name,
                version: tool.metadata.version,
                updatedAt: new Date(tool.metadata.updatedAt).toISOString(),
              },
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Update failed",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  server.tool(
    "marketplace_pause_tool",
    "Pause a tool to stop accepting new payments. Useful for maintenance.",
    {
      toolId: z.string().describe("The tool ID to pause"),
      callerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe("Your wallet address (must be owner)"),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (params: any) => {
      try {
        await toolRegistry.pauseTool(params.toolId, params.callerAddress as Address)

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: `Tool ${params.toolId} has been paused`,
              status: "paused",
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Pause failed",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  server.tool(
    "marketplace_activate_tool",
    "Reactivate a paused tool to resume accepting payments.",
    {
      toolId: z.string().describe("The tool ID to activate"),
      callerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe("Your wallet address (must be owner)"),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (params: any) => {
      try {
        await toolRegistry.activateTool(params.toolId, params.callerAddress as Address)

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: `Tool ${params.toolId} has been activated`,
              status: "active",
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Activation failed",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  // ============================================================================
  // Tool Discovery Tools
  // ============================================================================

  server.tool(
    "marketplace_discover_tools",
    "Discover paid AI tools in the marketplace. Filter by price, category, rating, and more.",
    {
      maxPrice: z.string().optional().describe("Maximum price per call in USD"),
      category: z.enum(["data", "ai", "defi", "analytics", "social", "utilities", "notifications", "storage", "compute", "other"]).optional().describe("Filter by category"),
      minRating: z.number().min(1).max(5).optional().describe("Minimum rating (1-5)"),
      query: z.string().optional().describe("Search query"),
      tags: z.array(z.string()).optional().describe("Filter by tags"),
      chain: z.string().optional().describe("Filter by supported chain"),
      sortBy: z.enum(["price", "rating", "popularity", "newest"]).default("popularity").describe("Sort field"),
      sortOrder: z.enum(["asc", "desc"]).default("desc").describe("Sort direction"),
      limit: z.number().default(20).describe("Max results to return"),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (params: any) => {
      try {
        const tools = await toolRegistry.discoverTools({
          maxPrice: params.maxPrice,
          category: params.category,
          minRating: params.minRating,
          query: params.query,
          tags: params.tags,
          chain: params.chain,
          sortBy: params.sortBy,
          sortOrder: params.sortOrder,
          limit: params.limit,
        })

        const results = tools.map(tool => ({
          toolId: tool.toolId,
          name: tool.name,
          displayName: tool.displayName,
          description: tool.description,
          category: tool.category,
          price: tool.pricing.basePrice,
          endpoint: tool.endpoint,
          rating: tool.metadata.rating,
          totalCalls: tool.metadata.totalCalls,
          tags: tool.tags,
        }))

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              count: results.length,
              tools: results,
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Discovery failed",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  server.tool(
    "marketplace_get_tool",
    "Get detailed information about a specific tool.",
    {
      toolId: z.string().optional().describe("Tool ID"),
      name: z.string().optional().describe("Tool name"),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (params: any) => {
      try {
        let tool = null
        if (params.toolId) {
          tool = await toolRegistry.getTool(params.toolId)
        } else if (params.name) {
          tool = await toolRegistry.getToolByName(params.name)
        } else {
          throw new Error("Either toolId or name is required")
        }

        if (!tool) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: false,
                error: "Tool not found",
              }, null, 2),
            }],
            isError: true,
          }
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              tool: {
                toolId: tool.toolId,
                name: tool.name,
                displayName: tool.displayName,
                description: tool.description,
                endpoint: tool.endpoint,
                category: tool.category,
                status: tool.status,
                pricing: tool.pricing,
                owner: tool.owner,
                revenueSplit: tool.revenueSplit,
                docsUrl: tool.docsUrl,
                tags: tool.tags,
                metadata: tool.metadata,
                registeredAt: new Date(tool.registeredAt).toISOString(),
              },
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Failed to get tool",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  // ============================================================================
  // Revenue & Analytics Tools
  // ============================================================================

  server.tool(
    "marketplace_tool_revenue",
    "Get revenue information for a tool including weekly/monthly stats and pending payouts.",
    {
      toolId: z.string().describe("Tool ID to check revenue for"),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (params: any) => {
      try {
        const revenue = await toolRegistry.getToolRevenue(params.toolId)

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              revenue: {
                toolId: revenue.toolId,
                totalRevenue: `$${revenue.totalRevenue}`,
                weeklyRevenue: `$${revenue.weeklyRevenue}`,
                monthlyRevenue: `$${revenue.monthlyRevenue}`,
                pendingPayouts: revenue.pendingPayouts.map(p => ({
                  address: p.address,
                  amount: `$${p.amount}`,
                })),
              },
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Failed to get revenue",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  server.tool(
    "marketplace_creator_analytics",
    "Get comprehensive analytics for a tool creator including all tools, revenue, and history.",
    {
      creatorAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe("Creator wallet address"),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (params: any) => {
      try {
        const analytics = await toolRegistry.getCreatorAnalytics(params.creatorAddress as Address)

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              analytics: {
                creatorAddress: analytics.creatorAddress,
                toolsOwned: analytics.toolsOwned,
                totalRevenue: `$${analytics.totalRevenue}`,
                totalCalls: analytics.totalCalls,
                avgRating: analytics.avgRating.toFixed(2),
                revenueByTool: analytics.revenueByTool.map(t => ({
                  ...t,
                  revenue: `$${t.revenue}`,
                })),
                weeklyRevenueHistory: analytics.weeklyRevenueHistory.map(w => ({
                  ...w,
                  revenue: `$${w.revenue}`,
                })),
              },
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Failed to get analytics",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  server.tool(
    "marketplace_stats",
    "Get overall marketplace statistics including volume, tool counts, and top performers.",
    {},
    async () => {
      try {
        const stats = await toolRegistry.getMarketplaceStats()

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              stats: {
                totalTools: stats.totalTools,
                activeTools: stats.activeTools,
                totalCreators: stats.totalCreators,
                totalVolume: `$${stats.totalVolume}`,
                volume24h: `$${stats.volume24h}`,
                volume7d: `$${stats.volume7d}`,
                totalCalls: stats.totalCalls,
                avgToolPrice: `$${stats.avgToolPrice}`,
                topCategory: stats.topCategory,
                topToolsByRevenue: stats.topToolsByRevenue.map(t => ({
                  ...t,
                  revenue: `$${t.revenue}`,
                })),
              },
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Failed to get stats",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  // ============================================================================
  // Usage Tracking Tools
  // ============================================================================

  server.tool(
    "marketplace_usage_history",
    "Get usage history for a tool or user.",
    {
      toolId: z.string().optional().describe("Tool ID to get history for"),
      userAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional().describe("User address to get history for"),
      limit: z.number().default(50).describe("Max records to return"),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (params: any) => {
      try {
        let usage
        if (params.toolId) {
          usage = await toolRegistry.getUsageHistory(params.toolId, params.limit)
        } else if (params.userAddress) {
          usage = await toolRegistry.getUserUsageHistory(params.userAddress as Address, params.limit)
        } else {
          throw new Error("Either toolId or userAddress is required")
        }

        const records = usage.map(u => ({
          id: u.id,
          toolId: u.toolId,
          timestamp: new Date(u.timestamp).toISOString(),
          amountPaid: `$${u.amountPaid}`,
          token: u.token,
          txHash: u.txHash,
          responseTime: `${u.responseTime}ms`,
          success: u.success,
          error: u.error,
        }))

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              count: records.length,
              usage: records,
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Failed to get usage",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  server.tool(
    "marketplace_recent_events",
    "Get recent marketplace events (registrations, payments, etc.).",
    {
      limit: z.number().default(50).describe("Max events to return"),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (params: any) => {
      try {
        const events = await toolRegistry.getRecentEvents(params.limit)

        const formatted = events.map(e => ({
          type: e.type,
          timestamp: new Date(e.timestamp).toISOString(),
          toolId: e.toolId,
          userAddress: e.userAddress,
          amount: e.amount ? `$${e.amount}` : undefined,
          txHash: e.txHash,
          data: e.data,
        }))

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              count: formatted.length,
              events: formatted,
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Failed to get events",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  // ============================================================================
  // Trust & Verification Tools
  // ============================================================================

  server.tool(
    "marketplace_rate_tool",
    "Rate a tool after using it. Ratings help other users find quality tools. " +
    "You can only rate a tool once per week to prevent manipulation.",
    {
      toolId: z.string().describe("The tool ID to rate"),
      userAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe("Your wallet address"),
      rating: z.number().min(1).max(5).describe("Rating from 1 to 5 stars"),
      review: z.string().max(500).optional().describe("Optional review text (max 500 chars)"),
      usageTxHash: z.string().optional().describe("Transaction hash of your tool usage (for verified rating)"),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (params: any) => {
      try {
        const rating = await ratingService.submitRating(
          params.toolId,
          params.userAddress as Address,
          params.rating as 1 | 2 | 3 | 4 | 5,
          params.review,
          params.usageTxHash
        )

        // Recalculate tool reputation after new rating
        await reputationScorer.calculateScore(params.toolId)

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: "Rating submitted successfully!",
              rating: {
                id: rating.id,
                toolId: rating.toolId,
                value: rating.value,
                verified: rating.verified,
                timestamp: new Date(rating.timestamp).toISOString(),
              },
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Rating failed",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  server.tool(
    "marketplace_report_tool",
    "Report a tool for malicious behavior, scams, or violations. " +
    "Reports are reviewed by the trust & safety team.",
    {
      toolId: z.string().describe("The tool ID to report"),
      reporterAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe("Your wallet address"),
      category: z.enum(["malicious", "scam", "broken", "misleading", "privacy", "other"]).describe("Report category"),
      severity: z.enum(["low", "medium", "high", "critical"]).describe("Severity of the issue"),
      description: z.string().min(20).max(1000).describe("Detailed description of the issue"),
      evidence: z.array(z.string()).optional().describe("Evidence URLs (screenshots, logs, etc.)"),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (params: any) => {
      try {
        const report = await reputationScorer.reportTool(
          params.toolId,
          params.reporterAddress,
          params.category,
          params.severity,
          params.description,
          params.evidence
        )

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: "Report submitted successfully. It will be reviewed by our trust & safety team.",
              report: {
                id: report.id,
                toolId: report.toolId,
                category: report.category,
                severity: report.severity,
                status: report.status,
                submittedAt: new Date(report.timestamp).toISOString(),
              },
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Report failed",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  server.tool(
    "marketplace_open_dispute",
    "Open a payment dispute for a tool. Disputes must be opened within 24 hours of payment. " +
    "Maximum 3 open disputes per user at a time.",
    {
      toolId: z.string().describe("The tool ID you had an issue with"),
      userAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe("Your wallet address"),
      paymentTxHash: z.string().describe("Transaction hash of the payment"),
      paymentAmount: z.string().describe("Amount paid"),
      paymentToken: z.string().describe("Token used for payment (e.g., 'USDs')"),
      reason: z.enum([
        "tool_down",
        "slow_response",
        "invalid_response",
        "schema_violation",
        "wrong_result",
        "security_concern",
        "unauthorized_charges",
        "other"
      ]).describe("Reason for dispute"),
      description: z.string().min(20).max(1000).describe("Detailed description of the issue"),
      evidence: z.array(z.object({
        type: z.enum(["screenshot", "log", "transaction", "api_response", "other"]),
        content: z.string(),
        description: z.string().optional(),
      })).optional().describe("Evidence to support your dispute"),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (params: any) => {
      try {
        // Get tool owner address
        const tool = await toolRegistry.getTool(params.toolId)
        if (!tool) {
          throw new Error("Tool not found")
        }

        const dispute = await disputeManager.openDispute(
          {
            toolId: params.toolId,
            userAddress: params.userAddress as Address,
            paymentTxHash: params.paymentTxHash,
            paymentAmount: params.paymentAmount,
            paymentToken: params.paymentToken,
            reason: params.reason,
            description: params.description,
            evidence: params.evidence,
          },
          tool.owner
        )

        // Try auto-resolution
        const autoResult = await autoResolver.tryAutoResolve(dispute)

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: autoResult.resolved 
                ? `Dispute auto-resolved: ${autoResult.outcome}` 
                : "Dispute opened successfully and is under review.",
              dispute: {
                id: dispute.id,
                toolId: dispute.toolId,
                reason: dispute.reason,
                state: dispute.state,
                autoResolved: autoResult.resolved,
                outcome: autoResult.outcome,
                createdAt: new Date(dispute.createdAt).toISOString(),
              },
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Failed to open dispute",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  server.tool(
    "marketplace_tool_reputation",
    "Get the complete trust and reputation information for a tool, including " +
    "ratings, uptime, verification status, and earned badges.",
    {
      toolId: z.string().describe("The tool ID to check"),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (params: any) => {
      try {
        // Get or calculate reputation score
        let score = reputationScorer.getScore(params.toolId)
        if (!score) {
          score = await reputationScorer.calculateScore(params.toolId)
        }

        // Get rating summary
        const ratingSummary = ratingService.getRatingSummary(params.toolId)

        // Get endpoint health
        const health = endpointVerifier.getOverallHealth(params.toolId)

        // Get latest security scan
        const securityScan = securityScanner.getLatestScan(params.toolId)

        // Get disputes stats
        const disputes = disputeManager.getToolDisputes(params.toolId)
        const openDisputes = disputes.filter(d => 
          d.state === "open" || d.state === "under_review" || d.state === "escalated"
        ).length

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              reputation: {
                toolId: params.toolId,
                score: score.score,
                tier: score.tier,
                trend: score.trend,
                badges: score.badges.map(b => ({
                  type: b.type,
                  label: b.label,
                  icon: b.icon,
                })),
                breakdown: {
                  uptime: `${score.breakdown.uptimeScore}/100 (weight: ${score.breakdown.weights.uptime * 100}%)`,
                  rating: `${score.breakdown.ratingScore}/100 (weight: ${score.breakdown.weights.rating * 100}%)`,
                  volume: `${score.breakdown.volumeScore}/100 (weight: ${score.breakdown.weights.volume * 100}%)`,
                  age: `${score.breakdown.ageScore}/100 (weight: ${score.breakdown.weights.age * 100}%)`,
                },
                ratings: {
                  average: ratingSummary.averageRating,
                  weighted: ratingSummary.weightedAverageRating,
                  total: ratingSummary.totalRatings,
                  verified: ratingSummary.verifiedRatings,
                  distribution: ratingSummary.distribution,
                },
                health: {
                  status: health.status,
                  uptime24h: `${health.uptime24h.toFixed(1)}%`,
                  avgResponseTime: `${health.avgResponseTime.toFixed(0)}ms`,
                },
                security: securityScan ? {
                  passed: securityScan.passed,
                  score: securityScan.score,
                  lastScanned: new Date(securityScan.timestamp).toISOString(),
                  criticalFindings: securityScan.findings.filter(f => f.severity === "critical").length,
                } : null,
                disputes: {
                  total: disputes.length,
                  open: openDisputes,
                },
              },
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Failed to get reputation",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  server.tool(
    "marketplace_verify_tool",
    "Request verification for a tool. This triggers endpoint, schema, and security checks. " +
    "Verified tools get the ✓ badge and appear higher in search results.",
    {
      toolId: z.string().describe("The tool ID to verify"),
      callerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe("Your wallet address (must be owner)"),
      schemaType: z.enum(["openapi", "jsonschema", "custom"]).optional().describe("Type of API schema"),
      schema: z.record(z.unknown()).optional().describe("API schema to register (JSON)"),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (params: any) => {
      try {
        // Get tool
        const tool = await toolRegistry.getTool(params.toolId)
        if (!tool) {
          throw new Error("Tool not found")
        }

        // Verify ownership
        if (tool.owner.toLowerCase() !== params.callerAddress.toLowerCase()) {
          throw new Error("Only the tool owner can request verification")
        }

        // Register schema if provided
        if (params.schema) {
          schemaValidator.registerSchema(
            params.toolId,
            params.schema,
            params.schemaType || "jsonschema"
          )
        }

        // Run endpoint check
        const endpointResult = await endpointVerifier.checkEndpointWithRetry(
          params.toolId,
          tool.endpoint
        )

        // Run security scan
        const securityResult = await securityScanner.scanEndpoint(
          params.toolId,
          tool.endpoint
        )

        // Schedule periodic checks
        endpointVerifier.schedulePeriodicCheck(params.toolId, tool.endpoint)

        // Award verified badge if checks pass
        const verified = endpointResult.status === "healthy" && securityResult.passed

        if (verified) {
          reputationScorer.awardBadge(params.toolId, "verified")
        }

        // Update tool metrics
        reputationScorer.updateMetrics(params.toolId, {
          uptimePercent: 100,
          avgResponseTime: endpointResult.responseTime,
          registeredAt: tool.registeredAt,
        })

        // Calculate initial reputation
        await reputationScorer.calculateScore(params.toolId)

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: verified 
                ? "Tool verified successfully! ✓ Badge awarded." 
                : "Verification completed with issues. Please review the results.",
              verification: {
                toolId: params.toolId,
                verified,
                endpoint: {
                  status: endpointResult.status,
                  responseTime: `${endpointResult.responseTime}ms`,
                  ssl: endpointResult.ssl ? {
                    valid: endpointResult.ssl.valid,
                    grade: endpointResult.ssl.grade,
                    expiresIn: `${endpointResult.ssl.daysUntilExpiry} days`,
                  } : null,
                },
                security: {
                  passed: securityResult.passed,
                  score: securityResult.score,
                  criticalIssues: securityResult.findings.filter(f => f.severity === "critical"),
                  highIssues: securityResult.findings.filter(f => f.severity === "high"),
                },
                periodicChecksEnabled: true,
                checkInterval: "5 minutes",
              },
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Verification failed",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  server.tool(
    "marketplace_get_dispute",
    "Get details of a specific dispute or list disputes for a user/tool.",
    {
      disputeId: z.string().optional().describe("Specific dispute ID to retrieve"),
      userAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional().describe("Filter by user address"),
      toolId: z.string().optional().describe("Filter by tool ID"),
      state: z.enum(["open", "under_review", "resolved", "escalated", "closed", "expired"]).optional().describe("Filter by state"),
      limit: z.number().default(20).describe("Maximum results to return"),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (params: any) => {
      try {
        if (params.disputeId) {
          const dispute = disputeManager.getDispute(params.disputeId)
          if (!dispute) {
            throw new Error("Dispute not found")
          }

          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: true,
                dispute: {
                  id: dispute.id,
                  toolId: dispute.toolId,
                  userAddress: dispute.userAddress,
                  reason: dispute.reason,
                  description: dispute.description,
                  state: dispute.state,
                  outcome: dispute.outcome,
                  paymentAmount: `${dispute.paymentAmount} ${dispute.paymentToken}`,
                  refundAmount: dispute.refundAmount ? `${dispute.refundAmount} ${dispute.paymentToken}` : null,
                  evidenceCount: dispute.evidence.length,
                  autoResolved: dispute.autoResolved,
                  createdAt: new Date(dispute.createdAt).toISOString(),
                  resolvedAt: dispute.resolvedAt ? new Date(dispute.resolvedAt).toISOString() : null,
                },
              }, null, 2),
            }],
          }
        }

        // List disputes with filters
        const disputes = disputeManager.getDisputes({
          userAddress: params.userAddress as Address,
          toolId: params.toolId,
          state: params.state,
          limit: params.limit,
        })

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              count: disputes.length,
              disputes: disputes.map(d => ({
                id: d.id,
                toolId: d.toolId,
                reason: d.reason,
                state: d.state,
                outcome: d.outcome,
                paymentAmount: `${d.paymentAmount} ${d.paymentToken}`,
                createdAt: new Date(d.createdAt).toISOString(),
              })),
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Failed to get disputes",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  server.tool(
    "marketplace_escalate_dispute",
    "Escalate a dispute to arbitration when automatic resolution is not satisfactory. " +
    "Arbitrators will vote on the outcome.",
    {
      disputeId: z.string().describe("The dispute ID to escalate"),
      callerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe("Your wallet address (must be party to dispute)"),
      reason: z.string().min(20).max(500).describe("Reason for escalation"),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (params: any) => {
      try {
        const dispute = await disputeManager.escalateDispute(
          params.disputeId,
          params.callerAddress as Address,
          params.reason
        )

        // Create arbitration case
        const arbitrationCase = await arbitrationDAO.createCase(dispute)

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: "Dispute escalated to arbitration. Arbitrators will vote on the outcome.",
              escalation: {
                disputeId: dispute.id,
                arbitrationCaseId: arbitrationCase.id,
                votingDeadline: new Date(arbitrationCase.votingDeadline).toISOString(),
                minVotesRequired: arbitrationCase.minVotesRequired,
                requiredStake: `${arbitrationCase.requiredStake} USD`,
              },
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Escalation failed",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  server.tool(
    "marketplace_reputation_leaderboard",
    "Get the top tools by reputation score.",
    {
      limit: z.number().default(20).describe("Maximum results to return"),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (params: any) => {
      try {
        const leaderboard = reputationScorer.getLeaderboard(params.limit)

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              count: leaderboard.length,
              leaderboard: leaderboard.map(entry => ({
                rank: entry.rank,
                toolId: entry.toolId,
                displayName: entry.displayName,
                score: entry.score,
                tier: entry.tier,
                badges: entry.badges.map(b => b.icon).join(" "),
                averageRating: entry.averageRating.toFixed(1),
                totalRatings: entry.totalRatings,
              })),
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Failed to get leaderboard",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  Logger.info("Tool Marketplace MCP tools registered")
}
