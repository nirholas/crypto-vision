/**
 * Verification Workers
 * @description Background workers for periodic verification checks using Bull queue
 * @author nirholas
 * @license Apache-2.0
 */

import Logger from "@/utils/logger.js"
import { endpointVerifier } from "./verification/endpoint-verifier.js"
import { schemaValidator } from "./verification/schema-validator.js"
import { securityScanner } from "./verification/security-scanner.js"
import { reputationScorer } from "./reputation/score.js"
import { disputeManager } from "./disputes/manager.js"
import { autoResolver } from "./disputes/auto-resolver.js"
import { arbitrationDAO } from "./disputes/arbitration.js"
import type { VerificationJob, VerificationWebhook, VerificationEventType } from "./verification/types.js"

/**
 * Queue configuration
 */
export interface WorkerConfig {
  /** Endpoint check interval (ms) - default 5 minutes */
  endpointCheckInterval: number
  /** Security scan interval (ms) - default 24 hours */
  securityScanInterval: number
  /** Reputation recalculation interval (ms) - default 1 hour */
  reputationInterval: number
  /** Dispute processing interval (ms) - default 15 minutes */
  disputeProcessInterval: number
  /** Arbitration processing interval (ms) - default 1 hour */
  arbitrationInterval: number
  /** Enable workers */
  enabled: boolean
}

const DEFAULT_CONFIG: WorkerConfig = {
  endpointCheckInterval: 5 * 60 * 1000, // 5 minutes
  securityScanInterval: 24 * 60 * 60 * 1000, // 24 hours
  reputationInterval: 60 * 60 * 1000, // 1 hour
  disputeProcessInterval: 15 * 60 * 1000, // 15 minutes
  arbitrationInterval: 60 * 60 * 1000, // 1 hour
  enabled: true,
}

/**
 * Generate unique ID
 */
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Job queue storage (in production, use Bull/Redis)
 */
interface QueueStorage {
  jobs: Map<string, VerificationJob>
  webhooks: Map<string, VerificationWebhook>
  toolEndpoints: Map<string, string> // toolId -> endpoint
  intervals: Map<string, NodeJS.Timeout>
}

const storage: QueueStorage = {
  jobs: new Map(),
  webhooks: new Map(),
  toolEndpoints: new Map(),
  intervals: new Map(),
}

/**
 * Verification Worker Manager
 * Manages background workers for periodic verification tasks
 */
export class VerificationWorkerManager {
  private config: WorkerConfig
  private running: boolean = false

  constructor(config: Partial<WorkerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Start all workers
   */
  start(): void {
    if (this.running) {
      Logger.warn("Workers already running")
      return
    }

    if (!this.config.enabled) {
      Logger.info("Workers are disabled")
      return
    }

    this.running = true

    // Start endpoint verification worker
    this.startEndpointWorker()

    // Start security scan worker
    this.startSecurityWorker()

    // Start reputation calculation worker
    this.startReputationWorker()

    // Start dispute processing worker
    this.startDisputeWorker()

    // Start arbitration processing worker
    this.startArbitrationWorker()

    Logger.info("Verification workers started")
  }

  /**
   * Stop all workers
   */
  stop(): void {
    if (!this.running) {
      return
    }

    // Clear all intervals
    for (const [name, interval] of storage.intervals) {
      clearInterval(interval)
      Logger.debug(`Stopped worker: ${name}`)
    }
    storage.intervals.clear()

    this.running = false
    Logger.info("Verification workers stopped")
  }

  /**
   * Start endpoint verification worker
   */
  private startEndpointWorker(): void {
    const worker = setInterval(async () => {
      await this.processEndpointChecks()
    }, this.config.endpointCheckInterval)

    storage.intervals.set("endpoint", worker)
    Logger.debug(`Endpoint worker started (interval: ${this.config.endpointCheckInterval}ms)`)
  }

  /**
   * Start security scan worker
   */
  private startSecurityWorker(): void {
    const worker = setInterval(async () => {
      await this.processSecurityScans()
    }, this.config.securityScanInterval)

    storage.intervals.set("security", worker)
    Logger.debug(`Security worker started (interval: ${this.config.securityScanInterval}ms)`)
  }

  /**
   * Start reputation calculation worker
   */
  private startReputationWorker(): void {
    const worker = setInterval(async () => {
      await this.processReputationUpdates()
    }, this.config.reputationInterval)

    storage.intervals.set("reputation", worker)
    Logger.debug(`Reputation worker started (interval: ${this.config.reputationInterval}ms)`)
  }

  /**
   * Start dispute processing worker
   */
  private startDisputeWorker(): void {
    const worker = setInterval(async () => {
      await this.processDisputes()
    }, this.config.disputeProcessInterval)

    storage.intervals.set("dispute", worker)
    Logger.debug(`Dispute worker started (interval: ${this.config.disputeProcessInterval}ms)`)
  }

  /**
   * Start arbitration processing worker
   */
  private startArbitrationWorker(): void {
    const worker = setInterval(async () => {
      await this.processArbitration()
    }, this.config.arbitrationInterval)

    storage.intervals.set("arbitration", worker)
    Logger.debug(`Arbitration worker started (interval: ${this.config.arbitrationInterval}ms)`)
  }

  /**
   * Process endpoint checks for all registered tools
   */
  private async processEndpointChecks(): Promise<void> {
    Logger.debug("Processing endpoint checks...")

    let checked = 0
    let failed = 0

    for (const [toolId, endpoint] of storage.toolEndpoints) {
      try {
        const result = await endpointVerifier.checkEndpoint(toolId, endpoint)
        checked++

        // Notify if status changed to down
        if (result.status === "down") {
          await this.notifyWebhooks(toolId, "endpoint.down", { result })
          failed++
        }

        // Update tool metrics
        const uptime = endpointVerifier.getUptimeRecord(toolId, "day")
        if (uptime) {
          reputationScorer.updateMetrics(toolId, {
            uptimePercent: uptime.uptimePercent,
            avgResponseTime: uptime.avgResponseTime,
          })
        }
      } catch (error) {
        Logger.error(`Endpoint check failed for ${toolId}: ${error instanceof Error ? error.message : "Unknown"}`)
      }
    }

    Logger.debug(`Endpoint checks complete: ${checked} checked, ${failed} down`)
  }

  /**
   * Process security scans for all registered tools
   */
  private async processSecurityScans(): Promise<void> {
    Logger.debug("Processing security scans...")

    let scanned = 0
    let issues = 0

    for (const [toolId, endpoint] of storage.toolEndpoints) {
      try {
        const result = await securityScanner.scanEndpoint(toolId, endpoint)
        scanned++

        // Notify if security issues found
        if (!result.passed) {
          await this.notifyWebhooks(toolId, "security.issue", { result })
          issues++

          // Revoke verified badge if critical issues
          const criticalFindings = result.findings.filter(f => f.severity === "critical")
          if (criticalFindings.length > 0) {
            reputationScorer.revokeBadge(toolId, "verified")
          }
        }
      } catch (error) {
        Logger.error(`Security scan failed for ${toolId}: ${error instanceof Error ? error.message : "Unknown"}`)
      }
    }

    Logger.debug(`Security scans complete: ${scanned} scanned, ${issues} with issues`)
  }

  /**
   * Process reputation updates for all tools
   */
  private async processReputationUpdates(): Promise<void> {
    Logger.debug("Processing reputation updates...")

    await reputationScorer.recalculateAll()

    Logger.debug("Reputation updates complete")
  }

  /**
   * Process open disputes
   */
  private async processDisputes(): Promise<void> {
    Logger.debug("Processing disputes...")

    // Process expired disputes
    const expiredCount = await disputeManager.processExpiredDisputes()

    // Try auto-resolution on open disputes
    const autoResult = await autoResolver.processOpenDisputes()

    Logger.debug(
      `Dispute processing complete: ${expiredCount} expired, ${autoResult.resolved}/${autoResult.processed} auto-resolved`
    )
  }

  /**
   * Process arbitration cases
   */
  private async processArbitration(): Promise<void> {
    Logger.debug("Processing arbitration cases...")

    const processedCount = await arbitrationDAO.processExpiredCases()

    Logger.debug(`Arbitration processing complete: ${processedCount} cases processed`)
  }

  /**
   * Register a tool for monitoring
   */
  registerTool(toolId: string, endpoint: string): void {
    storage.toolEndpoints.set(toolId, endpoint)
    Logger.debug(`Tool registered for monitoring: ${toolId}`)
  }

  /**
   * Unregister a tool from monitoring
   */
  unregisterTool(toolId: string): void {
    storage.toolEndpoints.delete(toolId)
    Logger.debug(`Tool unregistered from monitoring: ${toolId}`)
  }

  /**
   * Register a webhook for notifications
   */
  registerWebhook(
    toolId: string,
    ownerAddress: `0x${string}`,
    webhookUrl: string,
    events: VerificationEventType[]
  ): VerificationWebhook {
    const webhook: VerificationWebhook = {
      id: generateId("webhook"),
      toolId,
      ownerAddress,
      webhookUrl,
      events,
      secret: generateId("secret"),
      active: true,
      createdAt: Date.now(),
    }

    storage.webhooks.set(webhook.id, webhook)
    Logger.info(`Webhook registered for tool ${toolId}: ${webhookUrl}`)

    return webhook
  }

  /**
   * Unregister a webhook
   */
  unregisterWebhook(webhookId: string): boolean {
    const deleted = storage.webhooks.delete(webhookId)
    if (deleted) {
      Logger.info(`Webhook unregistered: ${webhookId}`)
    }
    return deleted
  }

  /**
   * Send notifications to registered webhooks
   */
  private async notifyWebhooks(
    toolId: string,
    event: VerificationEventType,
    data: Record<string, unknown>
  ): Promise<void> {
    const webhooks = Array.from(storage.webhooks.values()).filter(
      (w) => w.toolId === toolId && w.events.includes(event) && w.active
    )

    for (const webhook of webhooks) {
      try {
        await fetch(webhook.webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Webhook-Secret": webhook.secret,
            "X-Webhook-Event": event,
          },
          body: JSON.stringify({
            event,
            toolId,
            timestamp: Date.now(),
            data,
          }),
        })

        Logger.debug(`Webhook notification sent: ${event} for tool ${toolId}`)
      } catch (error) {
        Logger.error(
          `Webhook notification failed for ${webhook.webhookUrl}: ${error instanceof Error ? error.message : "Unknown"}`
        )
      }
    }
  }

  /**
   * Add a job to the queue
   */
  addJob(
    toolId: string,
    type: VerificationJob["type"],
    priority: number = 0
  ): VerificationJob {
    const job: VerificationJob = {
      jobId: generateId("job"),
      toolId,
      type,
      priority,
      scheduledAt: Date.now(),
      attempts: 0,
      maxAttempts: 3,
    }

    storage.jobs.set(job.jobId, job)
    Logger.debug(`Job added: ${job.jobId} (${type} for ${toolId})`)

    return job
  }

  /**
   * Get job status
   */
  getJob(jobId: string): VerificationJob | null {
    return storage.jobs.get(jobId) || null
  }

  /**
   * Get all pending jobs
   */
  getPendingJobs(): VerificationJob[] {
    return Array.from(storage.jobs.values())
      .filter((j) => j.attempts < j.maxAttempts)
      .sort((a, b) => b.priority - a.priority || a.scheduledAt - b.scheduledAt)
  }

  /**
   * Get worker statistics
   */
  getStats(): {
    running: boolean
    registeredTools: number
    registeredWebhooks: number
    pendingJobs: number
    workers: string[]
  } {
    return {
      running: this.running,
      registeredTools: storage.toolEndpoints.size,
      registeredWebhooks: storage.webhooks.size,
      pendingJobs: this.getPendingJobs().length,
      workers: Array.from(storage.intervals.keys()),
    }
  }
}

/**
 * Singleton instance
 */
export const workerManager = new VerificationWorkerManager()
