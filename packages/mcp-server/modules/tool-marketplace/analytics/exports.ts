/**
 * Export & Reporting
 * @description CSV/JSON export, scheduled reports, webhooks, and Grafana-compatible metrics
 * @author nirholas
 * @license Apache-2.0
 */

import { timeseriesDB, type Granularity, type AggregatedDataPoint } from "./timeseries.js"
import { metricsCollector, METRIC_NAMES } from "./collector.js"
import { platformAnalytics, type PlatformAnalyticsOverview } from "./platform.js"
import { creatorInsights, type CreatorDashboard, type ToolInsights } from "../dashboard/creator.js"
import type { Address } from "viem"
import Logger from "@/utils/logger.js"

/**
 * Export format types
 */
export type ExportFormat = "csv" | "json" | "prometheus"

/**
 * Scheduled report configuration
 */
export interface ScheduledReportConfig {
  /** Report ID */
  id: string
  /** Report name */
  name: string
  /** Report type */
  type: "creator_dashboard" | "tool_insights" | "platform_overview"
  /** Target (tool ID or creator address) */
  target?: string
  /** Schedule frequency */
  frequency: "daily" | "weekly" | "monthly"
  /** Email recipients */
  emails: string[]
  /** Webhook URLs */
  webhooks: string[]
  /** Export format */
  format: ExportFormat
  /** Enabled status */
  enabled: boolean
  /** Last sent timestamp */
  lastSent?: number
  /** Next scheduled timestamp */
  nextScheduled: number
}

/**
 * Webhook configuration
 */
export interface WebhookConfig {
  /** Webhook ID */
  id: string
  /** Webhook URL */
  url: string
  /** Event types to send */
  events: WebhookEventType[]
  /** Secret for HMAC signing */
  secret?: string
  /** Enabled status */
  enabled: boolean
  /** Retry configuration */
  retryPolicy: {
    maxRetries: number
    backoffMs: number
  }
}

/**
 * Webhook event types
 */
export type WebhookEventType =
  | "revenue_threshold"
  | "usage_spike"
  | "anomaly_detected"
  | "churn_risk"
  | "daily_summary"
  | "weekly_summary"

/**
 * Webhook event payload
 */
export interface WebhookEvent {
  /** Event type */
  type: WebhookEventType
  /** Event timestamp */
  timestamp: number
  /** Event data */
  data: Record<string, unknown>
}

/**
 * Prometheus metric format
 */
interface PrometheusMetric {
  /** Metric name */
  name: string
  /** Metric type */
  type: "counter" | "gauge" | "histogram" | "summary"
  /** Help text */
  help: string
  /** Labels */
  labels: Record<string, string>
  /** Value */
  value: number
}

/**
 * Internal storage
 */
interface ExportStorage {
  /** Scheduled reports */
  scheduledReports: Map<string, ScheduledReportConfig>
  /** Webhooks */
  webhooks: Map<string, WebhookConfig>
  /** Webhook delivery history */
  webhookHistory: Array<{
    webhookId: string
    eventType: WebhookEventType
    timestamp: number
    success: boolean
    responseCode?: number
  }>
}

const storage: ExportStorage = {
  scheduledReports: new Map(),
  webhooks: new Map(),
  webhookHistory: [],
}

/**
 * Generate unique ID
 */
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Export & Reporting Service
 */
export class ExportReportingService {
  private reportScheduler: ReturnType<typeof setInterval> | null = null

  /**
   * Start the report scheduler
   */
  startScheduler(intervalMs: number = 60000): void {
    if (this.reportScheduler) return

    this.reportScheduler = setInterval(() => {
      this.checkScheduledReports()
    }, intervalMs)

    Logger.info("ExportReporting: Started scheduler")
  }

  /**
   * Stop the report scheduler
   */
  stopScheduler(): void {
    if (this.reportScheduler) {
      clearInterval(this.reportScheduler)
      this.reportScheduler = null
      Logger.info("ExportReporting: Stopped scheduler")
    }
  }

  // ============================================================================
  // Data Export
  // ============================================================================

  /**
   * Export time series data
   */
  exportTimeSeries(
    metricName: string,
    startTime: number,
    endTime: number,
    granularity: Granularity,
    format: ExportFormat
  ): string {
    const data = timeseriesDB.query(metricName, {
      startTime,
      endTime,
      granularity,
    })

    switch (format) {
      case "json":
        return JSON.stringify({
          metric: metricName,
          granularity,
          period: { startTime, endTime },
          data,
        }, null, 2)

      case "csv":
        return this.toCSV(data, [
          "timestamp", "endTimestamp", "count", "sum", "avg",
          "min", "max", "p50", "p95", "p99"
        ])

      case "prometheus":
        return this.toPrometheus(metricName, data)

      default:
        throw new Error(`Unsupported format: ${format}`)
    }
  }

  /**
   * Export creator dashboard
   */
  async exportCreatorDashboard(
    creatorAddress: Address,
    periodDays: number,
    format: ExportFormat
  ): Promise<string> {
    const dashboard = await creatorInsights.getCreatorDashboard(creatorAddress, periodDays)

    switch (format) {
      case "json":
        return JSON.stringify(dashboard, null, 2)

      case "csv":
        return this.dashboardToCSV(dashboard)

      default:
        throw new Error(`Unsupported format for dashboard: ${format}`)
    }
  }

  /**
   * Export tool insights
   */
  async exportToolInsights(
    toolId: string,
    periodDays: number,
    format: ExportFormat
  ): Promise<string> {
    const insights = await creatorInsights.getToolInsights(toolId, periodDays)

    switch (format) {
      case "json":
        return JSON.stringify(insights, null, 2)

      case "csv":
        return this.insightsToCSV(insights)

      default:
        throw new Error(`Unsupported format for insights: ${format}`)
    }
  }

  /**
   * Export platform overview
   */
  async exportPlatformOverview(
    periodDays: number,
    format: ExportFormat
  ): Promise<string> {
    const overview = await platformAnalytics.getOverview(periodDays)

    switch (format) {
      case "json":
        return JSON.stringify(overview, null, 2)

      case "csv":
        return this.overviewToCSV(overview)

      default:
        throw new Error(`Unsupported format for overview: ${format}`)
    }
  }

  // ============================================================================
  // Scheduled Reports
  // ============================================================================

  /**
   * Create a scheduled report
   */
  createScheduledReport(config: Omit<ScheduledReportConfig, "id" | "nextScheduled">): string {
    const id = generateId("report")
    const nextScheduled = this.calculateNextSchedule(config.frequency)

    const report: ScheduledReportConfig = {
      ...config,
      id,
      nextScheduled,
    }

    storage.scheduledReports.set(id, report)
    Logger.info(`ExportReporting: Created scheduled report ${id}`)

    return id
  }

  /**
   * Update a scheduled report
   */
  updateScheduledReport(id: string, updates: Partial<ScheduledReportConfig>): void {
    const report = storage.scheduledReports.get(id)
    if (!report) {
      throw new Error(`Report not found: ${id}`)
    }

    Object.assign(report, updates)
    storage.scheduledReports.set(id, report)
  }

  /**
   * Delete a scheduled report
   */
  deleteScheduledReport(id: string): void {
    storage.scheduledReports.delete(id)
  }

  /**
   * List all scheduled reports
   */
  listScheduledReports(): ScheduledReportConfig[] {
    return Array.from(storage.scheduledReports.values())
  }

  /**
   * Check and execute due scheduled reports
   */
  private async checkScheduledReports(): Promise<void> {
    const now = Date.now()

    for (const [id, report] of storage.scheduledReports) {
      if (!report.enabled) continue
      if (report.nextScheduled > now) continue

      try {
        await this.executeScheduledReport(report)
        
        // Update last sent and next scheduled
        report.lastSent = now
        report.nextScheduled = this.calculateNextSchedule(report.frequency)
        storage.scheduledReports.set(id, report)

        Logger.info(`ExportReporting: Executed scheduled report ${id}`)
      } catch (error) {
        Logger.error(`ExportReporting: Failed to execute report ${id}: ${error}`)
      }
    }
  }

  /**
   * Execute a scheduled report
   */
  private async executeScheduledReport(report: ScheduledReportConfig): Promise<void> {
    let data: string

    switch (report.type) {
      case "creator_dashboard":
        if (!report.target) throw new Error("Creator address required")
        data = await this.exportCreatorDashboard(
          report.target as Address,
          report.frequency === "daily" ? 1 : report.frequency === "weekly" ? 7 : 30,
          report.format
        )
        break

      case "tool_insights":
        if (!report.target) throw new Error("Tool ID required")
        data = await this.exportToolInsights(
          report.target,
          report.frequency === "daily" ? 1 : report.frequency === "weekly" ? 7 : 30,
          report.format
        )
        break

      case "platform_overview":
        data = await this.exportPlatformOverview(
          report.frequency === "daily" ? 1 : report.frequency === "weekly" ? 7 : 30,
          report.format
        )
        break

      default:
        throw new Error(`Unknown report type: ${report.type}`)
    }

    // Send to webhooks
    for (const webhookUrl of report.webhooks) {
      await this.sendToWebhook(webhookUrl, {
        type: report.frequency === "daily" ? "daily_summary" : "weekly_summary",
        timestamp: Date.now(),
        data: { report: report.name, content: data },
      })
    }

    // Email sending would be implemented here with an email service
    // For now, just log
    if (report.emails.length > 0) {
      Logger.info(`ExportReporting: Would send to emails: ${report.emails.join(", ")}`)
    }
  }

  /**
   * Calculate next schedule timestamp
   */
  private calculateNextSchedule(frequency: ScheduledReportConfig["frequency"]): number {
    const now = new Date()
    
    switch (frequency) {
      case "daily":
        now.setDate(now.getDate() + 1)
        now.setHours(9, 0, 0, 0) // 9 AM
        break
      case "weekly":
        now.setDate(now.getDate() + (7 - now.getDay() + 1) % 7 || 7) // Next Monday
        now.setHours(9, 0, 0, 0)
        break
      case "monthly":
        now.setMonth(now.getMonth() + 1)
        now.setDate(1)
        now.setHours(9, 0, 0, 0)
        break
    }

    return now.getTime()
  }

  // ============================================================================
  // Webhooks
  // ============================================================================

  /**
   * Register a webhook
   */
  registerWebhook(config: Omit<WebhookConfig, "id">): string {
    const id = generateId("webhook")
    const webhook: WebhookConfig = { ...config, id }
    storage.webhooks.set(id, webhook)
    Logger.info(`ExportReporting: Registered webhook ${id}`)
    return id
  }

  /**
   * Update a webhook
   */
  updateWebhook(id: string, updates: Partial<WebhookConfig>): void {
    const webhook = storage.webhooks.get(id)
    if (!webhook) {
      throw new Error(`Webhook not found: ${id}`)
    }
    Object.assign(webhook, updates)
    storage.webhooks.set(id, webhook)
  }

  /**
   * Delete a webhook
   */
  deleteWebhook(id: string): void {
    storage.webhooks.delete(id)
  }

  /**
   * List all webhooks
   */
  listWebhooks(): WebhookConfig[] {
    return Array.from(storage.webhooks.values())
  }

  /**
   * Send event to a webhook URL
   */
  async sendToWebhook(url: string, event: WebhookEvent): Promise<boolean> {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Event": event.type,
          "X-Webhook-Timestamp": event.timestamp.toString(),
        },
        body: JSON.stringify(event),
      })

      const success = response.ok

      // Record in history
      storage.webhookHistory.push({
        webhookId: url,
        eventType: event.type,
        timestamp: Date.now(),
        success,
        responseCode: response.status,
      })

      // Keep history limited
      if (storage.webhookHistory.length > 1000) {
        storage.webhookHistory = storage.webhookHistory.slice(-500)
      }

      return success
    } catch (error) {
      Logger.error(`ExportReporting: Webhook failed: ${error}`)
      return false
    }
  }

  /**
   * Trigger event to all relevant webhooks
   */
  async triggerEvent(event: WebhookEvent): Promise<void> {
    for (const webhook of storage.webhooks.values()) {
      if (!webhook.enabled) continue
      if (!webhook.events.includes(event.type)) continue

      await this.sendToWebhook(webhook.url, event)
    }
  }

  // ============================================================================
  // Grafana / Prometheus Compatible Metrics
  // ============================================================================

  /**
   * Get metrics in Prometheus format
   */
  async getPrometheusMetrics(): Promise<string> {
    const lines: string[] = []
    const now = Date.now()
    const hourAgo = now - 60 * 60 * 1000

    // Platform metrics
    const platformMetrics = metricsCollector.getPlatformMetrics(hourAgo, now)

    lines.push("# HELP marketplace_total_calls_total Total number of tool calls")
    lines.push("# TYPE marketplace_total_calls_total counter")
    lines.push(`marketplace_total_calls_total ${platformMetrics.totalCalls}`)

    lines.push("")
    lines.push("# HELP marketplace_total_revenue_usd Total revenue in USD")
    lines.push("# TYPE marketplace_total_revenue_usd gauge")
    lines.push(`marketplace_total_revenue_usd ${parseFloat(platformMetrics.totalRevenue)}`)

    lines.push("")
    lines.push("# HELP marketplace_active_users Number of active users")
    lines.push("# TYPE marketplace_active_users gauge")
    lines.push(`marketplace_active_users ${platformMetrics.activeUsers}`)

    lines.push("")
    lines.push("# HELP marketplace_new_tools Number of new tools")
    lines.push("# TYPE marketplace_new_tools counter")
    lines.push(`marketplace_new_tools ${platformMetrics.newTools}`)

    // Add time series data
    const responseTimeData = timeseriesDB.query(METRIC_NAMES.TOOL_RESPONSE_TIME, {
      startTime: hourAgo,
      endTime: now,
      granularity: "minute",
    })

    if (responseTimeData.length > 0) {
      const latestRT = responseTimeData[responseTimeData.length - 1]
      
      if (latestRT) {
        lines.push("")
        lines.push("# HELP marketplace_response_time_seconds Response time in seconds")
        lines.push("# TYPE marketplace_response_time_seconds summary")
        lines.push(`marketplace_response_time_seconds{quantile="0.5"} ${(latestRT.percentiles.p50 / 1000).toFixed(3)}`)
        lines.push(`marketplace_response_time_seconds{quantile="0.95"} ${(latestRT.percentiles.p95 / 1000).toFixed(3)}`)
        lines.push(`marketplace_response_time_seconds{quantile="0.99"} ${(latestRT.percentiles.p99 / 1000).toFixed(3)}`)
        lines.push(`marketplace_response_time_seconds_sum ${(latestRT.sum / 1000).toFixed(3)}`)
        lines.push(`marketplace_response_time_seconds_count ${latestRT.count}`)
      }
    }

    return lines.join("\n")
  }

  /**
   * Get metrics endpoint (for Grafana/Prometheus scraping)
   */
  async handleMetricsEndpoint(): Promise<{
    contentType: string
    body: string
  }> {
    const metrics = await this.getPrometheusMetrics()
    return {
      contentType: "text/plain; version=0.0.4",
      body: metrics,
    }
  }

  // ============================================================================
  // Conversion Helpers
  // ============================================================================

  /**
   * Convert data to CSV format
   */
  private toCSV(data: AggregatedDataPoint[], columns: string[]): string {
    const lines: string[] = [columns.join(",")]

    for (const point of data) {
      const row = columns.map(col => {
        if (col === "p50") return point.percentiles.p50
        if (col === "p95") return point.percentiles.p95
        if (col === "p99") return point.percentiles.p99
        return (point as any)[col] ?? ""
      })
      lines.push(row.join(","))
    }

    return lines.join("\n")
  }

  /**
   * Convert to Prometheus format
   */
  private toPrometheus(metricName: string, data: AggregatedDataPoint[]): string {
    const safeName = metricName.replace(/\./g, "_")
    const lines: string[] = []

    lines.push(`# HELP ${safeName} ${metricName}`)
    lines.push(`# TYPE ${safeName} gauge`)

    for (const point of data) {
      const timestamp = point.timestamp
      lines.push(`${safeName}{stat="sum"} ${point.sum} ${timestamp}`)
      lines.push(`${safeName}{stat="avg"} ${point.avg} ${timestamp}`)
      lines.push(`${safeName}{stat="count"} ${point.count} ${timestamp}`)
    }

    return lines.join("\n")
  }

  /**
   * Convert dashboard to CSV
   */
  private dashboardToCSV(dashboard: CreatorDashboard): string {
    const lines: string[] = []

    // Summary section
    lines.push("# Summary")
    lines.push("Metric,Value")
    lines.push(`Total Revenue,${dashboard.totalRevenue}`)
    lines.push(`Period Revenue,${dashboard.periodRevenue}`)
    lines.push(`Revenue Change,${dashboard.revenueChange24h}`)
    lines.push(`Total Calls,${dashboard.totalCalls}`)
    lines.push(`Unique Users,${dashboard.uniqueUsers}`)
    lines.push(`Average Rating,${dashboard.avgRating}`)
    lines.push("")

    // Top tools section
    lines.push("# Top Tools")
    lines.push("Tool ID,Name,Revenue,Calls,Users,Success Rate,Rating")
    for (const tool of dashboard.topTools) {
      lines.push([
        tool.toolId,
        tool.name,
        tool.revenue,
        tool.calls,
        tool.uniqueUsers,
        tool.successRate.toFixed(2),
        tool.rating.toFixed(2),
      ].join(","))
    }
    lines.push("")

    // Revenue chart
    lines.push("# Revenue by Day")
    lines.push("Date,Revenue")
    for (const point of dashboard.revenueChart.data) {
      lines.push(`${point.date},${point.value}`)
    }

    return lines.join("\n")
  }

  /**
   * Convert insights to CSV
   */
  private insightsToCSV(insights: ToolInsights): string {
    const lines: string[] = []

    // Summary
    lines.push("# Tool Summary")
    lines.push("Metric,Value")
    lines.push(`Tool ID,${insights.toolId}`)
    lines.push(`Name,${insights.name}`)
    lines.push(`Status,${insights.status}`)
    lines.push(`Total Revenue,${insights.revenue.total}`)
    lines.push(`Period Revenue,${insights.revenue.period}`)
    lines.push(`Total Calls,${insights.usage.totalCalls}`)
    lines.push(`Success Rate,${insights.usage.successRate}%`)
    lines.push(`Avg Response Time,${insights.performance.avgResponseTime}ms`)
    lines.push(`Rating,${insights.rating.average}`)
    lines.push("")

    // Usage by day
    lines.push("# Usage by Day")
    lines.push("Date,Calls")
    for (const point of insights.usage.byDay.data) {
      lines.push(`${point.date},${point.value}`)
    }

    return lines.join("\n")
  }

  /**
   * Convert overview to CSV
   */
  private overviewToCSV(overview: PlatformAnalyticsOverview): string {
    const lines: string[] = []

    lines.push("# Platform Overview")
    lines.push("Metric,Value")
    lines.push(`Total Volume,${overview.summary.totalVolume}`)
    lines.push(`Volume Change,${overview.summary.volumeChange}`)
    lines.push(`Total Transactions,${overview.summary.totalTransactions}`)
    lines.push(`Active Tools,${overview.summary.activeTools}`)
    lines.push(`Active Creators,${overview.summary.activeCreators}`)
    lines.push(`Active Users,${overview.summary.activeUsers}`)
    lines.push("")

    lines.push("# Growth Metrics")
    lines.push(`DAU,${overview.growth.dau}`)
    lines.push(`WAU,${overview.growth.wau}`)
    lines.push(`MAU,${overview.growth.mau}`)
    lines.push(`Stickiness,${overview.growth.stickiness.toFixed(2)}%`)
    lines.push("")

    lines.push("# Revenue by Category")
    lines.push("Category,Revenue,Percentage,Tools")
    for (const cat of overview.revenueByCategory) {
      lines.push(`${cat.category},${cat.revenue},${cat.percentage.toFixed(2)}%,${cat.toolCount}`)
    }

    return lines.join("\n")
  }
}

// Singleton instance
export const exportReporting = new ExportReportingService()
