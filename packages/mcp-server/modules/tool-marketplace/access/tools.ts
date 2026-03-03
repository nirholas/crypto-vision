/**
 * Access Control MCP Tools
 * @description MCP tools for API key management, rate limiting, and access control
 * @author nirholas
 * @license Apache-2.0
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type { Address } from "viem"
import { keyManager } from "./key-manager.js"
import { rateLimiter } from "./rate-limiter.js"
import { quotaManager, DEFAULT_QUOTA_CONFIG } from "./quotas.js"
import { accessListManager, strikeManager } from "./lists.js"
import { subscriptionManager } from "./subscriptions.js"
import { DEFAULT_TIERS, isValidTierName } from "./tiers.js"
import Logger from "@/utils/logger.js"

/**
 * Ethereum address schema
 */
const AddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address")

/**
 * Rate limit schema
 */
const RateLimitSchema = z.object({
  requests: z.number().min(1),
  period: z.enum(["second", "minute", "hour", "day"]),
})

/**
 * Permission schema
 */
const PermissionSchema = z.object({
  toolId: z.string(),
  scope: z.enum(["read", "write", "admin"]),
  actions: z.array(z.string()).optional(),
})

/**
 * Register access control MCP tools
 */
export function registerAccessControlTools(server: McpServer): void {
  // ============================================================================
  // API Key Management Tools
  // ============================================================================

  server.tool(
    "marketplace_create_api_key",
    "Create a new API key for accessing a tool in the marketplace. " +
    "Returns the API key which is only shown once - store it securely!",
    {
      toolId: z.string().describe("The tool ID to create a key for"),
      userAddress: AddressSchema.describe("Your wallet address (key owner)"),
      name: z.string().max(100).describe("Human-readable name for this key (e.g., 'Production Key')"),
      tier: z.enum(["free", "basic", "pro", "enterprise"]).default("free").describe("Access tier for this key"),
      permissions: z.array(PermissionSchema).optional().describe("Specific permissions for this key"),
      rateLimit: RateLimitSchema.optional().describe("Custom rate limit (overrides tier default)"),
      expiresInDays: z.number().optional().describe("Key expiration in days (optional)"),
    },
    async (params) => {
      try {
        const expiresAt = params.expiresInDays
          ? Date.now() + params.expiresInDays * 24 * 60 * 60 * 1000
          : undefined

        const apiKey = await keyManager.createKey(
          params.toolId,
          params.userAddress as Address,
          {
            name: params.name,
            permissions: params.permissions as any,
            rateLimit: params.rateLimit,
            expiresAt,
          },
          params.tier
        )

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: "API key created successfully!",
              warning: "⚠️ Store this key securely - it will not be shown again!",
              key: {
                id: apiKey.id,
                apiKey: apiKey.key, // Only shown once!
                keyPrefix: apiKey.keyPrefix,
                name: apiKey.name,
                toolId: apiKey.toolId,
                tier: apiKey.tier,
                rateLimit: apiKey.rateLimit,
                expiresAt: apiKey.expiresAt
                  ? new Date(apiKey.expiresAt).toISOString()
                  : "Never",
                createdAt: new Date(apiKey.createdAt).toISOString(),
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
              error: error instanceof Error ? error.message : "Failed to create API key",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  server.tool(
    "marketplace_list_api_keys",
    "List all your API keys for a specific tool or all tools.",
    {
      userAddress: AddressSchema.describe("Your wallet address"),
      toolId: z.string().optional().describe("Filter by specific tool ID (optional)"),
    },
    async (params) => {
      try {
        let keys = await keyManager.getKeysByUser(params.userAddress as Address)

        if (params.toolId) {
          keys = keys.filter((k) => k.toolId === params.toolId)
        }

        const keysSummary = keys.map((k) => ({
          id: k.id,
          keyPrefix: k.keyPrefix,
          name: k.name,
          toolId: k.toolId,
          tier: k.tier,
          isActive: k.isActive,
          usageCount: k.usageCount,
          rateLimit: k.rateLimit,
          lastUsedAt: k.lastUsedAt ? new Date(k.lastUsedAt).toISOString() : "Never",
          expiresAt: k.expiresAt ? new Date(k.expiresAt).toISOString() : "Never",
          createdAt: new Date(k.createdAt).toISOString(),
        }))

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              count: keys.length,
              keys: keysSummary,
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Failed to list API keys",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  server.tool(
    "marketplace_revoke_api_key",
    "Revoke an API key, permanently disabling its access.",
    {
      keyId: z.string().describe("The key ID to revoke"),
      userAddress: AddressSchema.describe("Your wallet address (must be key owner)"),
      reason: z.string().optional().describe("Reason for revocation"),
    },
    async (params) => {
      try {
        await keyManager.revokeKey(
          params.keyId,
          params.userAddress as Address,
          params.reason
        )

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: `API key ${params.keyId} has been revoked`,
              reason: params.reason || "Manual revocation",
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Failed to revoke API key",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  server.tool(
    "marketplace_rotate_api_key",
    "Rotate an API key for security. Creates a new key and the old key expires in 24 hours.",
    {
      keyId: z.string().describe("The key ID to rotate"),
      userAddress: AddressSchema.describe("Your wallet address (must be key owner)"),
    },
    async (params) => {
      try {
        const result = await keyManager.rotateKey(
          params.keyId,
          params.userAddress as Address
        )

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: "API key rotated successfully!",
              warning: "⚠️ Store the new key securely - it will not be shown again!",
              newKey: {
                id: result.newKey.id,
                apiKey: result.newKey.key, // Only shown once!
                keyPrefix: result.newKey.keyPrefix,
              },
              oldKey: {
                id: result.oldKeyId,
                expiresAt: new Date(result.oldKeyExpiresAt).toISOString(),
                note: "Old key will continue working for 24 hours",
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
              error: error instanceof Error ? error.message : "Failed to rotate API key",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  server.tool(
    "marketplace_key_usage",
    "Get usage statistics and quota status for an API key.",
    {
      keyId: z.string().describe("The key ID to check"),
    },
    async (params) => {
      try {
        const key = await keyManager.getKey(params.keyId)
        if (!key) {
          throw new Error("Key not found")
        }

        const usageStats = await keyManager.getKeyUsageStats(params.keyId)
        const quotaConfig = DEFAULT_QUOTA_CONFIG[key.tier]
        const quotaStatus = await quotaManager.getQuotaStatus(
          params.keyId,
          key.toolId,
          quotaConfig
        )

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              key: {
                id: key.id,
                keyPrefix: key.keyPrefix,
                name: key.name,
                tier: key.tier,
              },
              usage: {
                totalCalls: usageStats.totalUsage,
                daysActive: usageStats.daysActive,
                lastUsed: usageStats.lastUsedAt
                  ? new Date(usageStats.lastUsedAt).toISOString()
                  : "Never",
              },
              quota: {
                period: quotaStatus.period,
                used: quotaStatus.used,
                limit: quotaStatus.limit === -1 ? "Unlimited" : quotaStatus.limit,
                remaining: quotaStatus.remaining === -1 ? "Unlimited" : quotaStatus.remaining,
                percentUsed: quotaStatus.percentUsed,
                exceeded: quotaStatus.exceeded,
                resetsAt: new Date(quotaStatus.resetsAt).toISOString(),
              },
              rateLimit: key.rateLimit,
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Failed to get usage stats",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  // ============================================================================
  // Rate Limiting Tools
  // ============================================================================

  server.tool(
    "marketplace_set_rate_limit",
    "Set custom rate limit for an API key (tool owner only).",
    {
      keyId: z.string().describe("The key ID to update"),
      userAddress: AddressSchema.describe("Your wallet address (must be key owner or tool owner)"),
      rateLimit: RateLimitSchema.describe("New rate limit configuration"),
    },
    async (params) => {
      try {
        await keyManager.updateKeyRateLimit(
          params.keyId,
          params.rateLimit,
          params.userAddress as Address
        )

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: "Rate limit updated successfully",
              keyId: params.keyId,
              newRateLimit: params.rateLimit,
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Failed to update rate limit",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  server.tool(
    "marketplace_check_rate_limit",
    "Check current rate limit status for a key.",
    {
      keyId: z.string().describe("The key ID to check"),
    },
    async (params) => {
      try {
        const key = await keyManager.getKey(params.keyId)
        if (!key) {
          throw new Error("Key not found")
        }

        const status = await rateLimiter.getRateLimitInfo(
          key.rateLimit,
          "key",
          params.keyId
        )

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              keyId: params.keyId,
              rateLimit: key.rateLimit,
              status: {
                limited: status.limited,
                remaining: status.remaining,
                limit: status.limit,
                resetIn: `${status.resetIn} seconds`,
                resetAt: new Date(status.resetAt).toISOString(),
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
              error: error instanceof Error ? error.message : "Failed to check rate limit",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  // ============================================================================
  // Access Control Tools
  // ============================================================================

  server.tool(
    "marketplace_block_user",
    "Block a user address from accessing your tool (tool owner only).",
    {
      toolId: z.string().describe("Your tool ID"),
      ownerAddress: AddressSchema.describe("Your wallet address (must be tool owner)"),
      blockAddress: AddressSchema.describe("Address to block"),
      reason: z.string().optional().describe("Reason for blocking"),
      severity: z.enum(["low", "medium", "high", "critical"]).default("medium").describe("Block severity"),
      durationDays: z.number().optional().describe("Block duration in days (optional, default permanent)"),
    },
    async (params) => {
      try {
        const expiresAt = params.durationDays
          ? Date.now() + params.durationDays * 24 * 60 * 60 * 1000
          : undefined

        const entry = await accessListManager.addToBlocklist(
          params.toolId,
          "address",
          params.blockAddress,
          params.ownerAddress as Address,
          {
            reason: params.reason,
            severity: params.severity,
            expiresAt,
          }
        )

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: `Address ${params.blockAddress} has been blocked`,
              entry: {
                id: entry.id,
                address: entry.value,
                severity: entry.severity,
                reason: entry.reason || "No reason provided",
                expiresAt: entry.expiresAt
                  ? new Date(entry.expiresAt).toISOString()
                  : "Permanent",
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
              error: error instanceof Error ? error.message : "Failed to block user",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  server.tool(
    "marketplace_unblock_user",
    "Remove a user from the blocklist (tool owner only).",
    {
      entryId: z.string().describe("The blocklist entry ID to remove"),
    },
    async (params) => {
      try {
        await accessListManager.removeFromBlocklist(params.entryId)

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: `Blocklist entry ${params.entryId} has been removed`,
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Failed to unblock user",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  server.tool(
    "marketplace_allowlist_user",
    "Add a user to the allowlist with optional special permissions (tool owner only).",
    {
      toolId: z.string().describe("Your tool ID"),
      ownerAddress: AddressSchema.describe("Your wallet address (must be tool owner)"),
      allowAddress: AddressSchema.describe("Address to allowlist"),
      reason: z.string().optional().describe("Reason for allowlisting"),
      customRateLimit: RateLimitSchema.optional().describe("Custom rate limit for this user"),
    },
    async (params) => {
      try {
        const entry = await accessListManager.addToAllowlist(
          params.toolId,
          "address",
          params.allowAddress,
          params.ownerAddress as Address,
          {
            reason: params.reason,
            customRateLimit: params.customRateLimit,
          }
        )

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: `Address ${params.allowAddress} has been allowlisted`,
              entry: {
                id: entry.id,
                address: entry.value,
                reason: entry.reason || "No reason provided",
                customRateLimit: entry.customRateLimit,
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
              error: error instanceof Error ? error.message : "Failed to allowlist user",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  server.tool(
    "marketplace_get_access_lists",
    "Get the allowlist and blocklist for a tool (tool owner only).",
    {
      toolId: z.string().describe("Your tool ID"),
    },
    async (params) => {
      try {
        const allowlist = await accessListManager.getAllowlist(params.toolId)
        const blocklist = await accessListManager.getBlocklist(params.toolId)
        const geoRestriction = await accessListManager.getGeoRestriction(params.toolId)

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              toolId: params.toolId,
              allowlist: allowlist.map((e) => ({
                id: e.id,
                type: e.type,
                value: e.value,
                reason: e.reason,
                createdAt: new Date(e.createdAt).toISOString(),
              })),
              blocklist: blocklist.map((e) => ({
                id: e.id,
                type: e.type,
                value: e.value,
                severity: e.severity,
                reason: e.reason,
                expiresAt: e.expiresAt ? new Date(e.expiresAt).toISOString() : "Permanent",
                createdAt: new Date(e.createdAt).toISOString(),
              })),
              geoRestriction: geoRestriction
                ? {
                    mode: geoRestriction.mode,
                    countries: geoRestriction.countries,
                  }
                : null,
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Failed to get access lists",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  // ============================================================================
  // Subscription & Tier Management Tools
  // ============================================================================

  server.tool(
    "marketplace_manage_tier",
    "Upgrade or downgrade your subscription tier for a tool.",
    {
      subscriptionId: z.string().describe("Your subscription ID"),
      newTier: z.enum(["free", "basic", "pro", "enterprise"]).describe("New tier to switch to"),
      prorate: z.boolean().default(true).describe("Whether to prorate charges/credits"),
    },
    async (params) => {
      try {
        const subscription = await subscriptionManager.changeTier({
          subscriptionId: params.subscriptionId,
          newTier: params.newTier,
          prorate: params.prorate,
        })

        const tier = DEFAULT_TIERS[params.newTier]

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: `Subscription upgraded to ${params.newTier} tier`,
              subscription: {
                id: subscription.id,
                tier: subscription.tier,
                state: subscription.state,
                periodEnd: new Date(subscription.currentPeriodEnd).toISOString(),
              },
              tierDetails: {
                name: tier.name,
                rateLimit: tier.rateLimit,
                monthlyQuota: tier.monthlyQuota === -1 ? "Unlimited" : tier.monthlyQuota,
                features: tier.features,
                price: tier.price,
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
              error: error instanceof Error ? error.message : "Failed to change tier",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  server.tool(
    "marketplace_get_subscription",
    "Get your subscription status for a tool.",
    {
      userAddress: AddressSchema.describe("Your wallet address"),
      toolId: z.string().describe("The tool ID"),
    },
    async (params) => {
      try {
        const subscription = await subscriptionManager.getSubscriptionByUserAndTool(
          params.userAddress as Address,
          params.toolId
        )

        if (!subscription) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: true,
                subscription: null,
                message: "No active subscription found for this tool",
              }, null, 2),
            }],
          }
        }

        const status = await subscriptionManager.getSubscriptionStatus(subscription.id)

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              subscription: {
                id: subscription.id,
                tier: subscription.tier,
                state: subscription.state,
                autoRenew: subscription.autoRenew,
                periodStart: new Date(subscription.currentPeriodStart).toISOString(),
                periodEnd: new Date(subscription.currentPeriodEnd).toISOString(),
                daysRemaining: status?.daysRemaining,
                callsUsed: subscription.callsUsed,
                callsRemaining: status?.callsRemaining === -1 ? "Unlimited" : status?.callsRemaining,
                renewalDate: status?.renewalDate
                  ? new Date(status.renewalDate).toISOString()
                  : null,
                estimatedRenewalCost: status?.estimatedRenewalCost,
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
              error: error instanceof Error ? error.message : "Failed to get subscription",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  server.tool(
    "marketplace_cancel_subscription",
    "Cancel your subscription for a tool.",
    {
      subscriptionId: z.string().describe("The subscription ID to cancel"),
      userAddress: AddressSchema.describe("Your wallet address"),
      reason: z.string().optional().describe("Reason for cancellation"),
      immediate: z.boolean().default(false).describe("Cancel immediately or at end of period"),
    },
    async (params) => {
      try {
        const subscription = await subscriptionManager.cancelSubscription(
          params.subscriptionId,
          params.userAddress as Address,
          params.reason,
          params.immediate
        )

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: params.immediate
                ? "Subscription canceled immediately"
                : "Subscription will be canceled at end of current period",
              subscription: {
                id: subscription.id,
                state: subscription.state,
                tier: subscription.tier,
                periodEnd: new Date(subscription.currentPeriodEnd).toISOString(),
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
              error: error instanceof Error ? error.message : "Failed to cancel subscription",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  server.tool(
    "marketplace_get_tiers",
    "Get available access tiers and their features.",
    {},
    async () => {
      const tiers = Object.values(DEFAULT_TIERS).map((tier) => ({
        name: tier.name,
        description: tier.description,
        rateLimit: `${tier.rateLimit.requests}/${tier.rateLimit.period}`,
        monthlyQuota: tier.monthlyQuota === -1 ? "Unlimited" : tier.monthlyQuota.toLocaleString(),
        features: tier.features,
        price: tier.price === "0" ? "Free" : tier.price === "custom" ? "Custom pricing" : `$${tier.price}/month`,
        prioritySupport: tier.prioritySupport || false,
      }))

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            tiers,
          }, null, 2),
        }],
      }
    }
  )

  Logger.info("Access Control MCP tools registered")
}
