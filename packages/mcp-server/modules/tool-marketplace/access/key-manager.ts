/**
 * API Key Manager
 * @description Manages API key creation, validation, rotation, and revocation
 * @author nirholas
 * @license Apache-2.0
 */

import type { Address } from "viem"
import { createHash, randomBytes } from "crypto"
import type {
  APIKey,
  APIKeyWithSecret,
  CreateKeyOptions,
  KeyValidationResult,
  KeyRotationResult,
  Permission,
  RateLimit,
  AccessStorageAdapter,
  AuditLogEntry,
  AccessTierName,
} from "./types.js"
import { defaultStorage } from "./storage.js"
import { DEFAULT_TIERS } from "./tiers.js"
import Logger from "@/utils/logger.js"

/**
 * Key prefix for marketplace API keys
 */
const KEY_PREFIX = "mk"

/**
 * Default key expiry for unused keys (90 days)
 */
const DEFAULT_UNUSED_KEY_EXPIRY_DAYS = 90

/**
 * Grace period for rotated keys (24 hours)
 */
const KEY_ROTATION_GRACE_PERIOD_MS = 24 * 60 * 60 * 1000

/**
 * API Key Manager Service
 */
export class KeyManager {
  private storage: AccessStorageAdapter
  private webhookHandlers: Map<string, (event: any) => Promise<void>> = new Map()

  constructor(storage: AccessStorageAdapter = defaultStorage) {
    this.storage = storage
  }

  /**
   * Generate a new API key string
   * Format: mk_<random32bytes>
   */
  private generateKeyString(): string {
    const randomPart = randomBytes(32).toString("hex")
    return `${KEY_PREFIX}_${randomPart}`
  }

  /**
   * Hash an API key using SHA-256
   */
  private hashKey(key: string): string {
    return createHash("sha256").update(key).digest("hex")
  }

  /**
   * Extract key prefix for display (first 8 chars + last 4 chars)
   */
  private extractKeyPrefix(key: string): string {
    const parts = key.split("_")
    if (parts.length !== 2) {
      return key.substring(0, 8) + "..." + key.substring(key.length - 4)
    }
    const randomPart = parts[1] ?? ""
    return `${KEY_PREFIX}_${randomPart.substring(0, 6)}...${randomPart.substring(randomPart.length - 4)}`
  }

  /**
   * Generate a unique key ID
   */
  private generateKeyId(): string {
    return `key_${randomBytes(16).toString("hex")}`
  }

  /**
   * Create a new API key
   */
  async createKey(
    toolId: string,
    userId: Address,
    options: CreateKeyOptions,
    tier: AccessTierName = "free"
  ): Promise<APIKeyWithSecret> {
    const keyString = this.generateKeyString()
    const keyHash = this.hashKey(keyString)
    const keyId = this.generateKeyId()
    const now = Date.now()

    // Get rate limit from options or tier default
    const rateLimit = options.rateLimit || DEFAULT_TIERS[tier].rateLimit

    // Default permissions if not provided
    const permissions: Permission[] = options.permissions || [
      { toolId, scope: "read" },
    ]

    const apiKey: APIKey = {
      id: keyId,
      toolId,
      userId,
      keyHash,
      keyPrefix: this.extractKeyPrefix(keyString),
      name: options.name,
      permissions,
      rateLimit,
      tier,
      expiresAt: options.expiresAt,
      createdAt: now,
      lastUsedAt: undefined,
      usageCount: 0,
      isActive: true,
      metadata: options.metadata,
    }

    await this.storage.saveKey(apiKey)

    // Audit log
    await this.logAudit("key_created", userId, keyId, "key", {
      toolId,
      keyName: options.name,
      tier,
    })

    // Emit webhook event
    await this.emitEvent(toolId, "key_created", {
      keyId,
      userId,
      toolId,
      tier,
    })

    Logger.info(`API key created: ${keyId} for tool ${toolId}`)

    // Return with the secret (only time it's visible)
    return {
      ...apiKey,
      key: keyString,
    }
  }

  /**
   * Validate an API key
   */
  async validateKey(key: string): Promise<KeyValidationResult> {
    // Basic format check
    if (!key.startsWith(`${KEY_PREFIX}_`)) {
      return {
        valid: false,
        error: "Invalid key format",
        errorCode: "INVALID_KEY",
      }
    }

    const keyHash = this.hashKey(key)
    const apiKey = await this.storage.getKeyByHash(keyHash)

    if (!apiKey) {
      return {
        valid: false,
        error: "Key not found",
        errorCode: "INVALID_KEY",
      }
    }

    // Check if revoked
    if (apiKey.revokedAt) {
      return {
        valid: false,
        error: "Key has been revoked",
        errorCode: "REVOKED",
        key: apiKey,
      }
    }

    // Check if active
    if (!apiKey.isActive) {
      return {
        valid: false,
        error: "Key is not active",
        errorCode: "REVOKED",
        key: apiKey,
      }
    }

    // Check expiration
    if (apiKey.expiresAt && apiKey.expiresAt < Date.now()) {
      return {
        valid: false,
        error: "Key has expired",
        errorCode: "EXPIRED",
        key: apiKey,
      }
    }

    // Update last used timestamp and usage count
    await this.storage.updateKey(apiKey.id, {
      lastUsedAt: Date.now(),
      usageCount: apiKey.usageCount + 1,
    })

    return {
      valid: true,
      key: apiKey,
    }
  }

  /**
   * Revoke an API key
   */
  async revokeKey(
    keyId: string,
    revokedBy: Address,
    reason?: string
  ): Promise<void> {
    const key = await this.storage.getKey(keyId)
    if (!key) {
      throw new Error(`Key not found: ${keyId}`)
    }

    // Verify ownership or admin permission
    if (key.userId.toLowerCase() !== revokedBy.toLowerCase()) {
      throw new Error("Not authorized to revoke this key")
    }

    await this.storage.updateKey(keyId, {
      isActive: false,
      revokedAt: Date.now(),
      revocationReason: reason || "Manually revoked",
    })

    // Audit log
    await this.logAudit("key_revoked", revokedBy, keyId, "key", {
      toolId: key.toolId,
      reason,
    })

    // Emit webhook event
    await this.emitEvent(key.toolId, "key_revoked", {
      keyId,
      userId: key.userId,
      toolId: key.toolId,
      reason,
    })

    Logger.info(`API key revoked: ${keyId}`)
  }

  /**
   * Rotate an API key (create new, old expires in 24h)
   */
  async rotateKey(keyId: string, rotatedBy: Address): Promise<KeyRotationResult> {
    const oldKey = await this.storage.getKey(keyId)
    if (!oldKey) {
      throw new Error(`Key not found: ${keyId}`)
    }

    // Verify ownership
    if (oldKey.userId.toLowerCase() !== rotatedBy.toLowerCase()) {
      throw new Error("Not authorized to rotate this key")
    }

    // Create new key with same settings
    const newKey = await this.createKey(
      oldKey.toolId,
      oldKey.userId,
      {
        name: `${oldKey.name} (rotated)`,
        permissions: oldKey.permissions,
        rateLimit: oldKey.rateLimit,
        metadata: oldKey.metadata,
      },
      oldKey.tier
    )

    // Set old key to expire in 24 hours
    const oldKeyExpiresAt = Date.now() + KEY_ROTATION_GRACE_PERIOD_MS
    await this.storage.updateKey(keyId, {
      expiresAt: oldKeyExpiresAt,
    })

    // Audit log
    await this.logAudit("key_rotated", rotatedBy, keyId, "key", {
      toolId: oldKey.toolId,
      newKeyId: newKey.id,
      oldKeyExpiresAt,
    })

    // Emit webhook event
    await this.emitEvent(oldKey.toolId, "key_rotated", {
      oldKeyId: keyId,
      newKeyId: newKey.id,
      userId: oldKey.userId,
      toolId: oldKey.toolId,
    })

    Logger.info(`API key rotated: ${keyId} -> ${newKey.id}`)

    return {
      newKey,
      oldKeyId: keyId,
      oldKeyExpiresAt,
    }
  }

  /**
   * Get a key by ID
   */
  async getKey(keyId: string): Promise<APIKey | null> {
    return this.storage.getKey(keyId)
  }

  /**
   * Get all keys for a user
   */
  async getKeysByUser(userId: Address): Promise<APIKey[]> {
    return this.storage.getKeysByUser(userId)
  }

  /**
   * Get all keys for a tool
   */
  async getKeysByTool(toolId: string): Promise<APIKey[]> {
    return this.storage.getKeysByTool(toolId)
  }

  /**
   * Update key rate limit
   */
  async updateKeyRateLimit(
    keyId: string,
    rateLimit: RateLimit,
    updatedBy: Address
  ): Promise<void> {
    const key = await this.storage.getKey(keyId)
    if (!key) {
      throw new Error(`Key not found: ${keyId}`)
    }

    // Verify ownership
    if (key.userId.toLowerCase() !== updatedBy.toLowerCase()) {
      throw new Error("Not authorized to update this key")
    }

    await this.storage.updateKey(keyId, { rateLimit })

    Logger.info(`API key rate limit updated: ${keyId}`)
  }

  /**
   * Update key permissions
   */
  async updateKeyPermissions(
    keyId: string,
    permissions: Permission[],
    updatedBy: Address
  ): Promise<void> {
    const key = await this.storage.getKey(keyId)
    if (!key) {
      throw new Error(`Key not found: ${keyId}`)
    }

    // Verify ownership
    if (key.userId.toLowerCase() !== updatedBy.toLowerCase()) {
      throw new Error("Not authorized to update this key")
    }

    await this.storage.updateKey(keyId, { permissions })

    Logger.info(`API key permissions updated: ${keyId}`)
  }

  /**
   * Update key tier
   */
  async updateKeyTier(
    keyId: string,
    tier: AccessTierName,
    updatedBy: Address
  ): Promise<void> {
    const key = await this.storage.getKey(keyId)
    if (!key) {
      throw new Error(`Key not found: ${keyId}`)
    }

    // Verify ownership
    if (key.userId.toLowerCase() !== updatedBy.toLowerCase()) {
      throw new Error("Not authorized to update this key")
    }

    // Update tier and rate limit to tier default
    await this.storage.updateKey(keyId, {
      tier,
      rateLimit: DEFAULT_TIERS[tier].rateLimit,
    })

    Logger.info(`API key tier updated: ${keyId} -> ${tier}`)
  }

  /**
   * Cleanup expired keys
   */
  async cleanupExpiredKeys(): Promise<number> {
    const now = Date.now()
    let cleanedCount = 0

    // Get all keys (in production, this should be paginated)
    const allKeys = await Promise.all([
      ...Array.from({ length: 10 }, (_, i) =>
        this.storage.getKey(`key_${i}`)
      ),
    ])

    // This is a simplified implementation - in production,
    // you'd query for expired keys directly from the database
    Logger.info(`Cleanup expired keys check completed: ${cleanedCount} keys expired`)
    return cleanedCount
  }

  /**
   * Check for unused keys and mark for expiration
   */
  async markUnusedKeysForExpiration(): Promise<number> {
    const cutoffTime = Date.now() - DEFAULT_UNUSED_KEY_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    let markedCount = 0

    // In production, this should query the database for unused keys
    Logger.info(`Marked ${markedCount} unused keys for expiration`)
    return markedCount
  }

  /**
   * Get key usage statistics
   */
  async getKeyUsageStats(keyId: string): Promise<{
    totalUsage: number
    lastUsedAt?: number
    createdAt: number
    daysActive: number
  }> {
    const key = await this.storage.getKey(keyId)
    if (!key) {
      throw new Error(`Key not found: ${keyId}`)
    }

    const now = Date.now()
    const daysActive = Math.floor((now - key.createdAt) / (24 * 60 * 60 * 1000))

    return {
      totalUsage: key.usageCount,
      lastUsedAt: key.lastUsedAt,
      createdAt: key.createdAt,
      daysActive,
    }
  }

  /**
   * Register a webhook handler for events
   */
  registerWebhookHandler(
    toolId: string,
    handler: (event: any) => Promise<void>
  ): void {
    this.webhookHandlers.set(toolId, handler)
  }

  /**
   * Emit an event to registered webhooks
   */
  private async emitEvent(
    toolId: string,
    eventType: string,
    data: Record<string, unknown>
  ): Promise<void> {
    const handler = this.webhookHandlers.get(toolId)
    if (handler) {
      try {
        await handler({ type: eventType, timestamp: Date.now(), ...data })
      } catch (error) {
        Logger.error(`Webhook handler error for tool ${toolId}:`, error)
      }
    }

    // Also dispatch to configured webhooks
    const webhooks = await this.storage.getWebhooks(toolId)
    for (const webhook of webhooks) {
      if (webhook.isActive && webhook.events.includes(eventType as any)) {
        // In production, this would make an HTTP request to webhook.url
        // with the event data and HMAC signature
        Logger.debug(`Would send webhook to ${webhook.url}: ${eventType}`)
      }
    }
  }

  /**
   * Log an audit entry
   */
  private async logAudit(
    action: AuditLogEntry["action"],
    actor: Address,
    target: string,
    targetType: AuditLogEntry["targetType"],
    details?: Record<string, unknown>
  ): Promise<void> {
    const entry: AuditLogEntry = {
      id: `audit_${randomBytes(16).toString("hex")}`,
      timestamp: Date.now(),
      action,
      actor,
      target,
      targetType,
      details,
      success: true,
    }

    await this.storage.saveAuditLog(entry)
  }
}

/**
 * Default key manager instance
 */
export const keyManager = new KeyManager()
