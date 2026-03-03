/**
 * Analytics MCP Tools
 * @description MCP tools for marketplace analytics and insights
 * @author nirholas
 * @license Apache-2.0
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type { Address } from "viem"

// Analytics imports
import { platformAnalytics } from "../analytics/platform.js"
import { predictiveAnalytics } from "../analytics/predictions.js"
import { exportReporting } from "../analytics/exports.js"

// Dashboard imports
import { creatorInsights } from "../dashboard/creator.js"
import { competitorAnalysis } from "../dashboard/competitor.js"

import Logger from "@/utils/logger.js"

/**
 * Register analytics MCP tools
 */
export function registerAnalyticsMCPTools(server: McpServer): void {
  // ============================================================================
  // Platform Analytics
  // ============================================================================

  server.tool(
    "marketplace_analytics_overview",
    "Get comprehensive platform-wide analytics including total volume, active users, " +
    "growth metrics (DAU/WAU/MAU), revenue by category, and conversion funnel. " +
    "Use this to understand overall marketplace health and trends.",
    {
      periodDays: z.number()
        .min(1)
        .max(365)
        .default(30)
        .describe("Time period in days to analyze (default: 30)"),
    },
    async (params) => {
      try {
        const overview = await platformAnalytics.getOverview(params.periodDays)

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              period: overview.period.label,
              summary: {
                totalVolume: overview.summary.totalVolume,
                volumeChange: overview.summary.volumeChange,
                totalTransactions: overview.summary.totalTransactions,
                transactionChange: overview.summary.transactionChange,
                activeTools: overview.summary.activeTools,
                activeCreators: overview.summary.activeCreators,
                activeUsers: overview.summary.activeUsers,
              },
              growth: {
                dau: overview.growth.dau,
                wau: overview.growth.wau,
                mau: overview.growth.mau,
                stickiness: `${overview.growth.stickiness.toFixed(1)}%`,
                userGrowthRate: overview.growth.userGrowthRate,
                revenueGrowthRate: overview.growth.revenueGrowthRate,
              },
              health: {
                score: overview.health.healthScore,
                status: overview.health.status,
                apiAvailability: `${overview.health.apiAvailability.toFixed(2)}%`,
                avgResponseTime: `${overview.health.avgResponseTime}ms`,
                errorRate: `${overview.health.errorRate.toFixed(2)}%`,
              },
              topCategories: overview.revenueByCategory.slice(0, 5).map(c => ({
                category: c.category,
                revenue: c.revenue,
                share: `${c.percentage.toFixed(1)}%`,
              })),
              topTools: overview.topTools.slice(0, 5),
              conversionFunnel: overview.funnel,
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Failed to get overview",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  // ============================================================================
  // Creator Dashboard
  // ============================================================================

  server.tool(
    "marketplace_creator_dashboard",
    "Get a comprehensive dashboard for a tool creator, including total revenue, " +
    "revenue trends, top performing tools, user retention, geographic breakdown, " +
    "and performance recommendations. Essential for creators to track their business.",
    {
      creatorAddress: z.string()
        .regex(/^0x[a-fA-F0-9]{40}$/)
        .describe("Creator's wallet address"),
      periodDays: z.number()
        .min(1)
        .max(365)
        .default(30)
        .describe("Time period in days (default: 30)"),
    },
    async (params) => {
      try {
        const dashboard = await creatorInsights.getCreatorDashboard(
          params.creatorAddress as Address,
          params.periodDays
        )

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              period: dashboard.period.label,
              revenue: {
                total: dashboard.totalRevenue,
                period: dashboard.periodRevenue,
                change: dashboard.revenueChange24h,
              },
              usage: {
                totalCalls: dashboard.totalCalls,
                periodCalls: dashboard.periodCalls,
                uniqueUsers: dashboard.uniqueUsers,
                newUsers: dashboard.newUsers,
                avgRating: dashboard.avgRating.toFixed(2),
              },
              topTools: dashboard.topTools.slice(0, 5).map(t => ({
                name: t.name,
                revenue: t.revenue,
                revenueChange: t.revenueChange,
                calls: t.calls,
                successRate: `${t.successRate.toFixed(1)}%`,
                rating: t.rating.toFixed(2),
              })),
              peakUsageHours: dashboard.peakUsageHours.map(h => `${h}:00 UTC`),
              topCountries: dashboard.geographicBreakdown.countries.slice(0, 5).map(c => ({
                country: c.name,
                users: c.count,
                share: `${c.percentage.toFixed(1)}%`,
              })),
              performance: {
                avgResponseTime: `${dashboard.performance.avg}ms`,
                p95: `${dashboard.performance.p95}ms`,
                p99: `${dashboard.performance.p99}ms`,
              },
              revenueChart: dashboard.revenueChart.data.slice(-7),
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Failed to get dashboard",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  // ============================================================================
  // Tool Insights
  // ============================================================================

  server.tool(
    "marketplace_tool_insights",
    "Get deep insights for a specific tool including detailed revenue breakdown, " +
    "usage patterns by hour and day, user metrics, performance data, and " +
    "actionable recommendations for improvement.",
    {
      toolId: z.string().describe("The tool ID to analyze"),
      periodDays: z.number()
        .min(1)
        .max(365)
        .default(30)
        .describe("Time period in days (default: 30)"),
    },
    async (params) => {
      try {
        const insights = await creatorInsights.getToolInsights(
          params.toolId,
          params.periodDays
        )

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              tool: {
                id: insights.toolId,
                name: insights.displayName,
                status: insights.status,
                registeredAt: insights.registeredAt,
              },
              period: insights.period.label,
              revenue: {
                total: insights.revenue.total,
                period: insights.revenue.period,
                change: insights.revenue.change,
                byToken: insights.revenue.byToken,
                byChain: insights.revenue.byChain,
              },
              usage: {
                totalCalls: insights.usage.totalCalls,
                periodCalls: insights.usage.periodCalls,
                change: insights.usage.callsChange,
                successRate: `${insights.usage.successRate.toFixed(1)}%`,
                topHours: insights.usage.byHour
                  .sort((a, b) => b.count - a.count)
                  .slice(0, 3)
                  .map(h => ({ hour: `${h.hour}:00 UTC`, calls: h.count })),
              },
              users: {
                unique: insights.users.unique,
                new: insights.users.new,
                returning: insights.users.returning,
                avgCallsPerUser: insights.users.avgCallsPerUser,
                topUsers: insights.users.topUsers.slice(0, 5),
              },
              performance: {
                avgResponseTime: `${insights.performance.avgResponseTime}ms`,
                p50: `${insights.performance.p50}ms`,
                p95: `${insights.performance.p95}ms`,
                p99: `${insights.performance.p99}ms`,
                uptime: `${insights.performance.uptime}%`,
              },
              rating: {
                average: insights.rating.average.toFixed(2),
                count: insights.rating.count,
              },
              recommendations: insights.recommendations,
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Failed to get insights",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  // ============================================================================
  // Revenue Forecast
  // ============================================================================

  server.tool(
    "marketplace_revenue_forecast",
    "Predict future revenue using historical data and statistical models. " +
    "Provides low/mid/high forecasts with confidence levels and trend analysis. " +
    "Can forecast for a specific tool or the entire platform.",
    {
      toolId: z.string()
        .optional()
        .describe("Tool ID (omit for platform-wide forecast)"),
      days: z.number()
        .min(7)
        .max(90)
        .default(30)
        .describe("Forecast period in days (default: 30)"),
    },
    async (params) => {
      try {
        const forecast = await predictiveAnalytics.forecastRevenue(
          params.toolId,
          params.days
        )

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              scope: params.toolId || "platform",
              forecastPeriod: `${params.days} days`,
              currentRunRate: `$${forecast.currentRunRate}/day`,
              forecast: {
                conservative: `$${forecast.forecast.low}`,
                expected: `$${forecast.forecast.mid}`,
                optimistic: `$${forecast.forecast.high}`,
              },
              confidence: `${forecast.confidence}%`,
              trend: {
                direction: forecast.trend,
                strength: forecast.trendStrength,
              },
              factors: forecast.factors,
              dailyForecast: forecast.dailyForecast.slice(0, 7).map(d => ({
                date: d.date,
                expected: `$${d.mid}`,
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
              error: error instanceof Error ? error.message : "Failed to forecast",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  // ============================================================================
  // Usage Heatmap
  // ============================================================================

  server.tool(
    "marketplace_usage_heatmap",
    "Get a heatmap showing when tools are used most frequently by day of week " +
    "and hour of day. Helps identify peak usage times for capacity planning, " +
    "maintenance windows, and understanding user behavior.",
    {
      toolId: z.string().describe("The tool ID to analyze"),
      days: z.number()
        .min(1)
        .max(30)
        .default(7)
        .describe("Days of data to include (default: 7)"),
    },
    async (params) => {
      try {
        const heatmap = await creatorInsights.getUsageHeatmap(params.toolId, params.days)

        // Summarize heatmap data by day
        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
        const byDay = dayNames.map((name, dayIndex) => {
          const dayData = heatmap.data.filter(d => d.day === dayIndex)
          const totalValue = dayData.reduce((sum, d) => sum + d.value, 0)
          const peakHour = dayData.reduce((a, b) => a.value > b.value ? a : b)
          return {
            day: name,
            totalCalls: totalValue,
            peakHour: `${peakHour.hour}:00`,
            peakCalls: peakHour.value,
          }
        })

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              toolId: params.toolId,
              period: heatmap.period,
              peakTimes: heatmap.peakTimes.slice(0, 5).map(p => ({
                when: `${p.day} at ${p.hour}:00 UTC`,
                calls: p.value,
              })),
              quietTimes: heatmap.quietTimes.slice(0, 3).map(q => ({
                when: `${q.day} at ${q.hour}:00 UTC`,
                calls: q.value,
              })),
              byDay,
              recommendation: heatmap.peakTimes[0]
                ? `Peak usage is ${heatmap.peakTimes[0].day} at ${heatmap.peakTimes[0].hour}:00 UTC. ` +
                  `Schedule maintenance during ${heatmap.quietTimes[0]?.day || "quiet periods"}.`
                : "Insufficient data for recommendations",
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Failed to get heatmap",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  // ============================================================================
  // Competitor Analysis
  // ============================================================================

  server.tool(
    "marketplace_competitor_analysis",
    "Compare your tool against competitors in the same category. Get price benchmarking, " +
    "market share estimates, feature gap analysis, performance rankings, and " +
    "strategic recommendations for improvement.",
    {
      toolId: z.string().describe("Your tool ID to analyze"),
    },
    async (params) => {
      try {
        const analysis = await competitorAnalysis.analyzeCompetitors(params.toolId)

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              tool: analysis.yourToolName,
              category: analysis.category,
              competitorCount: analysis.competitorCount,
              analyzedAt: new Date(analysis.analyzedAt).toISOString(),
              pricing: {
                yourPrice: `$${analysis.priceBenchmark.yourPrice}`,
                categoryAvg: `$${analysis.priceBenchmark.categoryAvg}`,
                categoryMedian: `$${analysis.priceBenchmark.categoryMedian}`,
                percentile: `${analysis.priceBenchmark.percentile}th`,
                recommendation: analysis.priceBenchmark.recommendation,
              },
              marketShare: {
                yourShare: `${analysis.marketShare.yourShare.toFixed(1)}%`,
                totalMarketCalls: analysis.marketShare.totalMarketCalls,
                totalMarketRevenue: `$${analysis.marketShare.totalMarketRevenue}`,
              },
              topCompetitors: analysis.topCompetitors.slice(0, 3).map(c => ({
                name: c.name,
                price: `$${c.price}`,
                rating: c.rating.toFixed(2),
                marketShare: `${c.marketSharePercent.toFixed(1)}%`,
                strengths: c.strengths,
                weaknesses: c.weaknesses,
              })),
              featureGaps: analysis.featureGaps.slice(0, 5).map(g => ({
                feature: g.feature,
                competitorsWithFeature: g.competitorCount,
                impact: g.estimatedImpact,
              })),
              performanceRanking: analysis.performanceRanking.map(r => ({
                metric: r.metric,
                yourValue: r.yourValue,
                categoryAvg: r.categoryAvg.toFixed(2),
                rank: `#${r.rank} of ${r.totalInCategory}`,
              })),
              recommendations: analysis.recommendations,
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Failed to analyze competitors",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  // ============================================================================
  // Export Data
  // ============================================================================

  server.tool(
    "marketplace_export_data",
    "Export analytics data in various formats (CSV, JSON). Use this to download " +
    "data for external analysis, reporting, or record keeping.",
    {
      exportType: z.enum(["creator_dashboard", "tool_insights", "platform_overview"])
        .describe("Type of data to export"),
      target: z.string()
        .optional()
        .describe("Creator address or tool ID (required for creator_dashboard and tool_insights)"),
      format: z.enum(["csv", "json"])
        .default("json")
        .describe("Export format"),
      periodDays: z.number()
        .min(1)
        .max(365)
        .default(30)
        .describe("Time period in days"),
    },
    async (params) => {
      try {
        let data: string

        switch (params.exportType) {
          case "creator_dashboard":
            if (!params.target) {
              throw new Error("Creator address required for creator_dashboard export")
            }
            data = await exportReporting.exportCreatorDashboard(
              params.target as Address,
              params.periodDays,
              params.format
            )
            break

          case "tool_insights":
            if (!params.target) {
              throw new Error("Tool ID required for tool_insights export")
            }
            data = await exportReporting.exportToolInsights(
              params.target,
              params.periodDays,
              params.format
            )
            break

          case "platform_overview":
            data = await exportReporting.exportPlatformOverview(
              params.periodDays,
              params.format
            )
            break

          default:
            throw new Error(`Unknown export type: ${params.exportType}`)
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              exportType: params.exportType,
              format: params.format,
              periodDays: params.periodDays,
              dataSize: `${data.length} characters`,
              data: params.format === "json"
                ? JSON.parse(data)
                : data.split("\n").slice(0, 20).join("\n") + "\n... (truncated)",
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Failed to export data",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  // ============================================================================
  // Churn Prediction
  // ============================================================================

  server.tool(
    "marketplace_churn_prediction",
    "Identify users at risk of churning (stopping usage) with probability scores, " +
    "risk signals, and recommended retention actions. Helps proactively retain users.",
    {
      toolId: z.string()
        .optional()
        .describe("Filter by specific tool (omit for all tools)"),
      limit: z.number()
        .min(1)
        .max(100)
        .default(20)
        .describe("Maximum users to return"),
    },
    async (params) => {
      try {
        const predictions = await predictiveAnalytics.predictChurn(
          params.toolId,
          params.limit
        )

        // Group by risk level
        const byRisk = {
          critical: predictions.filter(p => p.riskLevel === "critical").length,
          high: predictions.filter(p => p.riskLevel === "high").length,
          medium: predictions.filter(p => p.riskLevel === "medium").length,
          low: predictions.filter(p => p.riskLevel === "low").length,
        }

        const totalRevenueAtRisk = predictions.reduce(
          (sum, p) => sum + parseFloat(p.revenueAtRisk),
          0
        )

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              scope: params.toolId || "all_tools",
              summary: {
                totalUsersAnalyzed: predictions.length,
                riskDistribution: byRisk,
                totalRevenueAtRisk: `$${totalRevenueAtRisk.toFixed(2)}`,
              },
              highRiskUsers: predictions
                .filter(p => p.riskLevel === "critical" || p.riskLevel === "high")
                .slice(0, 10)
                .map(p => ({
                  user: `${p.userAddress.slice(0, 6)}...${p.userAddress.slice(-4)}`,
                  churnProbability: `${p.churnProbability}%`,
                  riskLevel: p.riskLevel,
                  daysSinceActive: p.daysSinceLastActivity,
                  activityTrend: p.activityTrend,
                  revenueAtRisk: `$${p.revenueAtRisk}`,
                  topRiskSignal: p.riskSignals[0],
                  topAction: p.recommendedActions[0],
                })),
              recommendedActions: [
                "Send re-engagement campaigns to high-risk users",
                "Offer incentives for returning users",
                "Survey churned users to understand reasons",
                "Improve onboarding for users with low engagement",
              ],
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Failed to predict churn",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  // ============================================================================
  // Demand Prediction
  // ============================================================================

  server.tool(
    "marketplace_demand_prediction",
    "Predict which tools are likely to grow in demand. Identifies growth signals, " +
    "blockers, and market opportunity scores. Useful for investment decisions.",
    {
      limit: z.number()
        .min(1)
        .max(50)
        .default(20)
        .describe("Maximum tools to return"),
    },
    async (params) => {
      try {
        const predictions = await predictiveAnalytics.predictDemand(params.limit)

        const highGrowth = predictions.filter(p => p.growthProbability >= 70)
        const opportunities = predictions.filter(p => p.opportunityScore >= 70)

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              summary: {
                toolsAnalyzed: predictions.length,
                highGrowthTools: highGrowth.length,
                highOpportunityTools: opportunities.length,
              },
              topGrowthTools: predictions.slice(0, 10).map(p => ({
                tool: p.toolName,
                toolId: p.toolId,
                growthProbability: `${p.growthProbability}%`,
                predictedGrowthRate: p.predictedGrowthRate,
                currentWeeklyCalls: p.currentWeeklyCalls,
                predictedWeeklyCalls: p.predictedWeeklyCalls,
                opportunityScore: p.opportunityScore,
                growthSignals: p.growthSignals,
                blockers: p.blockers,
              })),
              insights: [
                highGrowth.length > 0
                  ? `${highGrowth.length} tools show strong growth potential`
                  : "No tools currently showing high growth signals",
                opportunities.length > 0
                  ? `${opportunities.length} tools have high market opportunity scores`
                  : "Market appears saturated in analyzed categories",
              ],
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Failed to predict demand",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  Logger.info("Analytics MCP tools registered")
}
