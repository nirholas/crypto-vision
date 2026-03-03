/**
 * In-Memory Storage Adapter
 * @description In-memory storage implementation for development/MVP
 * @author nirholas
 * @license Apache-2.0
 */

import type { Address } from "viem"
import type {
  AccessStorageAdapter,
  APIKey,
  Subscription,
  AllowlistEntry,
  BlocklistEntry,
  GeoRestriction,
  AuditLogEntry,
  AccessWebhook,
  AccessEventType,
} from "./types.js"

/**
 * In-memory storage adapter for access control data
 * Suitable for development and MVP, replace with Redis/database for production
 */
export class InMemoryStorageAdapter implements AccessStorageAdapter {
  private keys = new Map<string, APIKey>()
  private keysByHash = new Map<string, string>() // hash -> keyId
  private subscriptions = new Map<string, Subscription>()
  private allowlist = new Map<string, AllowlistEntry>()
  private blocklist = new Map<string, BlocklistEntry>()
  private geoRestrictions = new Map<string, GeoRestriction>()
  private auditLogs: AuditLogEntry[] = []
  private webhooks = new Map<string, AccessWebhook>()
  private rateCounts = new Map<string, { count: number; expiresAt: number }>()
  private quotaUsage = new Map<string, number>()

  // ========================================================================
  // API Keys
  // ========================================================================

  async saveKey(key: APIKey): Promise<void> {
    this.keys.set(key.id, key)
    this.keysByHash.set(key.keyHash, key.id)
  }

  async getKey(keyId: string): Promise<APIKey | null> {
    return this.keys.get(keyId) || null
  }

  async getKeyByHash(keyHash: string): Promise<APIKey | null> {
    const keyId = this.keysByHash.get(keyHash)
    if (!keyId) return null
    return this.keys.get(keyId) || null
  }

  async getKeysByUser(userId: Address): Promise<APIKey[]> {
    return Array.from(this.keys.values()).filter(
      (key) => key.userId.toLowerCase() === userId.toLowerCase()
    )
  }

  async getKeysByTool(toolId: string): Promise<APIKey[]> {
    return Array.from(this.keys.values()).filter((key) => key.toolId === toolId)
  }

  async updateKey(keyId: string, updates: Partial<APIKey>): Promise<void> {
    const key = this.keys.get(keyId)
    if (key) {
      this.keys.set(keyId, { ...key, ...updates })
    }
  }

  async deleteKey(keyId: string): Promise<void> {
    const key = this.keys.get(keyId)
    if (key) {
      this.keysByHash.delete(key.keyHash)
      this.keys.delete(keyId)
    }
  }

  // ========================================================================
  // Subscriptions
  // ========================================================================

  async saveSubscription(subscription: Subscription): Promise<void> {
    this.subscriptions.set(subscription.id, subscription)
  }

  async getSubscription(subscriptionId: string): Promise<Subscription | null> {
    return this.subscriptions.get(subscriptionId) || null
  }

  async getSubscriptionByUserAndTool(
    userId: Address,
    toolId: string
  ): Promise<Subscription | null> {
    for (const sub of this.subscriptions.values()) {
      if (
        sub.userId.toLowerCase() === userId.toLowerCase() &&
        sub.toolId === toolId &&
        sub.state !== "canceled" &&
        sub.state !== "expired"
      ) {
        return sub
      }
    }
    return null
  }

  async getSubscriptionsByUser(userId: Address): Promise<Subscription[]> {
    return Array.from(this.subscriptions.values()).filter(
      (sub) => sub.userId.toLowerCase() === userId.toLowerCase()
    )
  }

  async getSubscriptionsByTool(toolId: string): Promise<Subscription[]> {
    return Array.from(this.subscriptions.values()).filter(
      (sub) => sub.toolId === toolId
    )
  }

  async updateSubscription(
    subscriptionId: string,
    updates: Partial<Subscription>
  ): Promise<void> {
    const sub = this.subscriptions.get(subscriptionId)
    if (sub) {
      this.subscriptions.set(subscriptionId, {
        ...sub,
        ...updates,
        updatedAt: Date.now(),
      })
    }
  }

  // ========================================================================
  // Allow/Block Lists
  // ========================================================================

  async saveAllowlistEntry(entry: AllowlistEntry): Promise<void> {
    this.allowlist.set(entry.id, entry)
  }

  async getallowlist(toolId: string): Promise<AllowlistEntry[]> {
    return Array.from(this.allowlist.values()).filter(
      (entry) => entry.toolId === toolId
    )
  }

  async removeAllowlistEntry(entryId: string): Promise<void> {
    this.allowlist.delete(entryId)
  }

  async saveBlocklistEntry(entry: BlocklistEntry): Promise<void> {
    this.blocklist.set(entry.id, entry)
  }

  async getBlocklist(toolId: string): Promise<BlocklistEntry[]> {
    return Array.from(this.blocklist.values()).filter(
      (entry) => entry.toolId === toolId
    )
  }

  async removeBlocklistEntry(entryId: string): Promise<void> {
    this.blocklist.delete(entryId)
  }

  async saveGeoRestriction(restriction: GeoRestriction): Promise<void> {
    this.geoRestrictions.set(restriction.toolId, restriction)
  }

  async getGeoRestriction(toolId: string): Promise<GeoRestriction | null> {
    return this.geoRestrictions.get(toolId) || null
  }

  // ========================================================================
  // Rate Limiting
  // ========================================================================

  async getRateCount(key: string): Promise<number> {
    const entry = this.rateCounts.get(key)
    if (!entry || entry.expiresAt < Date.now()) {
      return 0
    }
    return entry.count
  }

  async incrementRateCount(key: string, ttlSeconds: number): Promise<number> {
    const now = Date.now()
    const entry = this.rateCounts.get(key)

    if (!entry || entry.expiresAt < now) {
      // Start new window
      this.rateCounts.set(key, {
        count: 1,
        expiresAt: now + ttlSeconds * 1000,
      })
      return 1
    }

    // Increment existing window
    entry.count += 1
    return entry.count
  }

  // ========================================================================
  // Quota Tracking
  // ========================================================================

  async getQuotaUsage(key: string, period: string): Promise<number> {
    const quotaKey = `${key}:${period}`
    return this.quotaUsage.get(quotaKey) || 0
  }

  async incrementQuotaUsage(
    key: string,
    period: string,
    amount: number = 1
  ): Promise<number> {
    const quotaKey = `${key}:${period}`
    const current = this.quotaUsage.get(quotaKey) || 0
    const newValue = current + amount
    this.quotaUsage.set(quotaKey, newValue)
    return newValue
  }

  // ========================================================================
  // Audit Logs
  // ========================================================================

  async saveAuditLog(entry: AuditLogEntry): Promise<void> {
    this.auditLogs.push(entry)
    // Keep only last 10000 entries in memory
    if (this.auditLogs.length > 10000) {
      this.auditLogs = this.auditLogs.slice(-10000)
    }
  }

  async getAuditLogs(filter: {
    toolId?: string
    userId?: Address
    action?: AccessEventType
    limit?: number
  }): Promise<AuditLogEntry[]> {
    let logs = this.auditLogs

    if (filter.toolId) {
      logs = logs.filter((log) => log.details?.toolId === filter.toolId)
    }

    if (filter.userId) {
      logs = logs.filter(
        (log) => log.actor.toLowerCase() === filter.userId!.toLowerCase()
      )
    }

    if (filter.action) {
      logs = logs.filter((log) => log.action === filter.action)
    }

    // Sort by timestamp descending
    logs = logs.sort((a, b) => b.timestamp - a.timestamp)

    if (filter.limit) {
      logs = logs.slice(0, filter.limit)
    }

    return logs
  }

  // ========================================================================
  // Webhooks
  // ========================================================================

  async saveWebhook(webhook: AccessWebhook): Promise<void> {
    this.webhooks.set(webhook.id, webhook)
  }

  async getWebhooks(toolId: string): Promise<AccessWebhook[]> {
    return Array.from(this.webhooks.values()).filter(
      (webhook) => webhook.toolId === toolId
    )
  }

  async updateWebhook(
    webhookId: string,
    updates: Partial<AccessWebhook>
  ): Promise<void> {
    const webhook = this.webhooks.get(webhookId)
    if (webhook) {
      this.webhooks.set(webhookId, { ...webhook, ...updates })
    }
  }

  async deleteWebhook(webhookId: string): Promise<void> {
    this.webhooks.delete(webhookId)
  }

  // ========================================================================
  // Utilities
  // ========================================================================

  /**
   * Clear all data (useful for testing)
   */
  clear(): void {
    this.keys.clear()
    this.keysByHash.clear()
    this.subscriptions.clear()
    this.allowlist.clear()
    this.blocklist.clear()
    this.geoRestrictions.clear()
    this.auditLogs = []
    this.webhooks.clear()
    this.rateCounts.clear()
    this.quotaUsage.clear()
  }

  /**
   * Cleanup expired rate limits
   */
  cleanupExpiredRateLimits(): void {
    const now = Date.now()
    for (const [key, entry] of this.rateCounts.entries()) {
      if (entry.expiresAt < now) {
        this.rateCounts.delete(key)
      }
    }
  }

  /**
   * Get storage stats
   */
  getStats(): {
    keys: number
    subscriptions: number
    allowlistEntries: number
    blocklistEntries: number
    auditLogs: number
    webhooks: number
  } {
    return {
      keys: this.keys.size,
      subscriptions: this.subscriptions.size,
      allowlistEntries: this.allowlist.size,
      blocklistEntries: this.blocklist.size,
      auditLogs: this.auditLogs.length,
      webhooks: this.webhooks.size,
    }
  }
}

/**
 * Default storage instance
 */
export const defaultStorage = new InMemoryStorageAdapter()
