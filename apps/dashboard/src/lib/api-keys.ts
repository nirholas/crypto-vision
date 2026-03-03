/**
 * API Key Management System
 *
 * Handles generation, validation, and rate limiting of API keys.
 * Uses Vercel KV for persistent storage.
 *
 * @module lib/api-keys
 */

import { kv } from '@vercel/kv';
import { sendWebhook, webhookPayloads } from './webhooks';

// ============================================================================
// Edge-compatible crypto utilities (using Web Crypto API)
// ============================================================================

/**
 * Generate cryptographically secure random bytes (Edge compatible)
 */
function getRandomBytes(length: number): Uint8Array {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return array;
}

/**
 * Convert bytes to base64url string
 */
function toBase64Url(bytes: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Convert bytes to hex string
 */
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * SHA-256 hash using Web Crypto API (Edge compatible)
 */
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return toHex(new Uint8Array(hashBuffer));
}

// ============================================================================
// Types
// ============================================================================

export interface ApiKeyData {
  id: string;
  key: string; // Hashed key (never store raw)
  keyPrefix: string; // First 8 chars for display
  name: string;
  email: string;
  tier: 'free' | 'pro' | 'enterprise';
  permissions: string[];
  rateLimit: number; // Requests per day
  usageToday: number;
  usageMonth: number;
  createdAt: string;
  lastUsedAt?: string;
  expiresAt?: string;
  active: boolean;
  metadata?: Record<string, unknown>;
}

export interface ApiKeyUsage {
  keyId: string;
  count: number;
  resetAt: number; // Unix timestamp
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: number;
}

// ============================================================================
// Configuration
// ============================================================================

export const API_KEY_TIERS = {
  free: {
    name: 'Free',
    requestsPerDay: 100,
    requestsPerMinute: 10,
    features: ['market:read', 'trending:read', 'search:read'],
  },
  pro: {
    name: 'Pro',
    requestsPerDay: 10000,
    requestsPerMinute: 100,
    features: ['market:read', 'market:premium', 'defi:read', 'historical:read', 'export:json'],
  },
  enterprise: {
    name: 'Enterprise',
    requestsPerDay: -1, // Unlimited
    requestsPerMinute: 1000,
    features: ['*'], // All permissions
  },
} as const;

// Key prefixes for different tiers
const KEY_PREFIXES = {
  free: 'cda_free_',
  pro: 'cda_pro_',
  enterprise: 'cda_ent_',
} as const;

// ============================================================================
// Key Generation (Edge-compatible)
// ============================================================================

/**
 * Generate a secure random API key
 */
export function generateApiKey(tier: 'free' | 'pro' | 'enterprise' = 'free'): string {
  const prefix = KEY_PREFIXES[tier];
  const randomPart = toBase64Url(getRandomBytes(24));
  return `${prefix}${randomPart}`;
}

/**
 * Hash an API key for secure storage (async for Edge compatibility)
 */
export async function hashApiKey(key: string): Promise<string> {
  return sha256(key);
}

/**
 * Synchronous hash for validation (simple hash for lookups)
 * Note: Uses a simple non-crypto hash for sync operations
 */
export function hashApiKeySync(key: string): string {
  // Simple deterministic hash for sync operations
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Generate a unique ID for the key record
 */
function generateKeyId(): string {
  return `key_${Date.now()}_${toHex(getRandomBytes(4))}`;
}

// ============================================================================
// Key Storage (Vercel KV)
// ============================================================================

const KV_PREFIX = {
  key: 'apikey:', // apikey:{hashedKey} -> ApiKeyData
  email: 'email:', // email:{email} -> keyId[]
  usage: 'usage:', // usage:{keyId}:{date} -> count
  rateLimit: 'rl:', // rl:{keyId}:{minute} -> count
};

/**
 * Check if Vercel KV is configured
 */
export function isKvConfigured(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

/**
 * Create a new API key
 */
export async function createApiKey(params: {
  email: string;
  name?: string;
  tier?: 'free' | 'pro' | 'enterprise';
}): Promise<{ key: string; data: ApiKeyData } | { error: string }> {
  const { email, name = 'Default', tier = 'free' } = params;

  // Check if KV is configured
  if (!isKvConfigured()) {
    return { error: 'API key storage not configured. Set KV_REST_API_URL and KV_REST_API_TOKEN.' };
  }

  // Check existing keys for this email
  const existingKeys = await getKeysByEmail(email);
  if (existingKeys.length >= 3) {
    return { error: 'Maximum 3 API keys per email. Please revoke an existing key first.' };
  }

  // Generate new key
  const rawKey = generateApiKey(tier);
  const hashedKey = await hashApiKey(rawKey);
  const keyId = generateKeyId();

  const tierConfig = API_KEY_TIERS[tier];

  const keyData: ApiKeyData = {
    id: keyId,
    key: hashedKey,
    keyPrefix: rawKey.substring(0, 12),
    name,
    email,
    tier,
    permissions: [...tierConfig.features],
    rateLimit: tierConfig.requestsPerDay,
    usageToday: 0,
    usageMonth: 0,
    createdAt: new Date().toISOString(),
    active: true,
  };

  try {
    // Store key data
    await kv.set(`${KV_PREFIX.key}${hashedKey}`, keyData);

    // Add to email index
    const emailKeys = existingKeys.map((k) => k.id);
    emailKeys.push(keyId);
    await kv.set(`${KV_PREFIX.email}${email}`, emailKeys);

    // Also store by keyId for reverse lookup
    await kv.set(`${KV_PREFIX.key}id:${keyId}`, hashedKey);

    // Emit webhook event for key creation (non-blocking)
    sendWebhook(
      'key.created',
      webhookPayloads.keyCreated({
        keyId,
        keyPrefix: keyData.keyPrefix,
        tier,
        email,
      })
    ).catch((err) => {
      console.error('[API Keys] Failed to send key.created webhook:', err);
    });

    return { key: rawKey, data: keyData };
  } catch (error) {
    console.error('Failed to create API key:', error);
    return { error: 'Failed to create API key. Please try again.' };
  }
}

/**
 * Validate an API key and return its data
 */
export async function validateApiKey(rawKey: string): Promise<ApiKeyData | null> {
  if (!isKvConfigured()) {
    console.warn('[API Keys] KV not configured, skipping validation');
    return null;
  }

  if (!rawKey || !rawKey.startsWith('cda_')) {
    return null;
  }

  const hashedKey = await hashApiKey(rawKey);

  try {
    const keyData = await kv.get<ApiKeyData>(`${KV_PREFIX.key}${hashedKey}`);

    if (!keyData || !keyData.active) {
      return null;
    }

    // Update last used timestamp (non-blocking)
    kv.set(`${KV_PREFIX.key}${hashedKey}`, {
      ...keyData,
      lastUsedAt: new Date().toISOString(),
    }).catch(() => {});

    return keyData;
  } catch (error) {
    console.error('Failed to validate API key:', error);
    return null;
  }
}

/**
 * Get all keys for an email
 */
export async function getKeysByEmail(email: string): Promise<ApiKeyData[]> {
  if (!isKvConfigured()) return [];

  try {
    const keyIds = await kv.get<string[]>(`${KV_PREFIX.email}${email}`);
    if (!keyIds || keyIds.length === 0) return [];

    const keys: ApiKeyData[] = [];
    for (const keyId of keyIds) {
      const hashedKey = await kv.get<string>(`${KV_PREFIX.key}id:${keyId}`);
      if (hashedKey) {
        const keyData = await kv.get<ApiKeyData>(`${KV_PREFIX.key}${hashedKey}`);
        if (keyData) keys.push(keyData);
      }
    }

    return keys;
  } catch (error) {
    console.error('Failed to get keys by email:', error);
    return [];
  }
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(keyId: string, email: string): Promise<boolean> {
  if (!isKvConfigured()) return false;

  try {
    const hashedKey = await kv.get<string>(`${KV_PREFIX.key}id:${keyId}`);
    if (!hashedKey) return false;

    const keyData = await kv.get<ApiKeyData>(`${KV_PREFIX.key}${hashedKey}`);
    if (!keyData || keyData.email !== email) return false;

    // Mark as inactive
    await kv.set(`${KV_PREFIX.key}${hashedKey}`, {
      ...keyData,
      active: false,
    });

    return true;
  } catch (error) {
    console.error('Failed to revoke API key:', error);
    return false;
  }
}

// ============================================================================
// Rate Limiting
// ============================================================================

/**
 * Check and update rate limit for a key
 */
export async function checkRateLimit(keyData: ApiKeyData): Promise<RateLimitResult> {
  const tierConfig = API_KEY_TIERS[keyData.tier];

  // Unlimited tier
  if (tierConfig.requestsPerDay === -1) {
    return {
      allowed: true,
      remaining: -1,
      limit: -1,
      resetAt: 0,
    };
  }

  if (!isKvConfigured()) {
    // If KV not configured, allow but warn
    return {
      allowed: true,
      remaining: tierConfig.requestsPerDay,
      limit: tierConfig.requestsPerDay,
      resetAt: Date.now() + 86400000,
    };
  }

  const today = new Date().toISOString().split('T')[0];
  const usageKey = `${KV_PREFIX.usage}${keyData.id}:${today}`;
  const notifiedKey = `${KV_PREFIX.usage}notified:${keyData.id}:${today}`;

  try {
    // Get current usage
    const currentUsage = (await kv.get<number>(usageKey)) || 0;

    if (currentUsage >= tierConfig.requestsPerDay) {
      // Calculate reset time (midnight UTC)
      const tomorrow = new Date();
      tomorrow.setUTCHours(24, 0, 0, 0);

      // Check if we've already notified about 100% limit today
      const notified = await kv.get<{ at90: boolean; at100: boolean }>(notifiedKey);
      if (!notified?.at100) {
        // Send rate limit webhook (100%)
        sendWebhook(
          'key.usage.limit',
          webhookPayloads.keyUsageLimit({
            keyId: keyData.id,
            keyPrefix: keyData.keyPrefix,
            tier: keyData.tier,
            usage: currentUsage,
            limit: tierConfig.requestsPerDay,
            percentage: 100,
            limitType: '100%',
          })
        ).catch((err) => {
          console.error('[API Keys] Failed to send key.usage.limit webhook:', err);
        });

        // Mark as notified
        await kv.set(notifiedKey, { ...notified, at100: true });
        await kv.expire(notifiedKey, 90000);
      }

      return {
        allowed: false,
        remaining: 0,
        limit: tierConfig.requestsPerDay,
        resetAt: tomorrow.getTime(),
      };
    }

    // Increment usage (atomic)
    const newUsage = await kv.incr(usageKey);

    // Set expiry on first use (25 hours to be safe)
    if (newUsage === 1) {
      await kv.expire(usageKey, 90000);
    }

    // Check if we've hit 90% threshold
    const threshold90 = Math.floor(tierConfig.requestsPerDay * 0.9);
    if (newUsage >= threshold90 && newUsage < tierConfig.requestsPerDay) {
      const notified = await kv.get<{ at90: boolean; at100: boolean }>(notifiedKey);
      if (!notified?.at90) {
        // Send rate limit webhook (90%)
        sendWebhook(
          'key.usage.limit',
          webhookPayloads.keyUsageLimit({
            keyId: keyData.id,
            keyPrefix: keyData.keyPrefix,
            tier: keyData.tier,
            usage: newUsage,
            limit: tierConfig.requestsPerDay,
            percentage: Math.round((newUsage / tierConfig.requestsPerDay) * 100),
            limitType: '90%',
          })
        ).catch((err) => {
          console.error('[API Keys] Failed to send key.usage.limit webhook:', err);
        });

        // Mark as notified
        await kv.set(notifiedKey, { ...notified, at90: true });
        await kv.expire(notifiedKey, 90000);
      }
    }

    const tomorrow = new Date();
    tomorrow.setUTCHours(24, 0, 0, 0);

    return {
      allowed: true,
      remaining: tierConfig.requestsPerDay - newUsage,
      limit: tierConfig.requestsPerDay,
      resetAt: tomorrow.getTime(),
    };
  } catch (error) {
    console.error('Rate limit check failed:', error);
    // On error, allow the request
    return {
      allowed: true,
      remaining: tierConfig.requestsPerDay,
      limit: tierConfig.requestsPerDay,
      resetAt: Date.now() + 86400000,
    };
  }
}

// ============================================================================
// Middleware Helper
// ============================================================================

/**
 * Extract API key from request
 */
export function extractApiKey(request: Request): string | null {
  // Check header first
  const headerKey = request.headers.get('X-API-Key');
  if (headerKey) return headerKey;

  // Check query param
  const url = new URL(request.url);
  const queryKey = url.searchParams.get('api_key');
  if (queryKey) return queryKey;

  // Check Authorization header (Bearer token)
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer cda_')) {
    return authHeader.slice(7);
  }

  return null;
}

/**
 * Validate request and return key data with rate limit info
 */
export async function validateRequest(request: Request): Promise<{
  valid: boolean;
  keyData?: ApiKeyData;
  rateLimit?: RateLimitResult;
  error?: string;
}> {
  const rawKey = extractApiKey(request);

  if (!rawKey) {
    return {
      valid: false,
      error: 'API key required. Get a free key at /api/register',
    };
  }

  const keyData = await validateApiKey(rawKey);

  if (!keyData) {
    return {
      valid: false,
      error: 'Invalid or revoked API key',
    };
  }

  const rateLimit = await checkRateLimit(keyData);

  if (!rateLimit.allowed) {
    return {
      valid: false,
      keyData,
      rateLimit,
      error: `Rate limit exceeded. Resets at ${new Date(rateLimit.resetAt).toISOString()}`,
    };
  }

  return {
    valid: true,
    keyData,
    rateLimit,
  };
}
// ============================================================================
// Key Lookup by ID
// ============================================================================

/**
 * Get API key data by key ID
 */
export async function getKeyById(keyId: string): Promise<ApiKeyData | null> {
  if (!isKvConfigured()) return null;

  try {
    const hashedKey = await kv.get<string>(`${KV_PREFIX.key}id:${keyId}`);
    if (!hashedKey) return null;

    const keyData = await kv.get<ApiKeyData>(`${KV_PREFIX.key}${hashedKey}`);
    return keyData;
  } catch (error) {
    console.error('Failed to get key by ID:', error);
    return null;
  }
}

// ============================================================================
// Subscription Management
// ============================================================================

/**
 * Upgrade an API key to a new tier
 */
export async function upgradeKeyTier(
  keyId: string,
  newTier: 'pro' | 'enterprise',
  expiresAt?: string
): Promise<{ success: boolean; data?: ApiKeyData; error?: string }> {
  if (!isKvConfigured()) {
    return { success: false, error: 'API key storage not configured' };
  }

  try {
    const hashedKey = await kv.get<string>(`${KV_PREFIX.key}id:${keyId}`);
    if (!hashedKey) {
      return { success: false, error: 'Key not found' };
    }

    const keyData = await kv.get<ApiKeyData>(`${KV_PREFIX.key}${hashedKey}`);
    if (!keyData) {
      return { success: false, error: 'Key data not found' };
    }

    if (!keyData.active) {
      return { success: false, error: 'Key is revoked' };
    }

    const tierConfig = API_KEY_TIERS[newTier];

    const updatedKeyData: ApiKeyData = {
      ...keyData,
      tier: newTier,
      permissions: [...tierConfig.features],
      rateLimit: tierConfig.requestsPerDay,
      expiresAt: expiresAt || keyData.expiresAt,
      metadata: {
        ...keyData.metadata,
        upgradedAt: new Date().toISOString(),
        previousTier: keyData.tier,
      },
    };

    await kv.set(`${KV_PREFIX.key}${hashedKey}`, updatedKeyData);

    // Emit webhook event for key upgrade (non-blocking)
    sendWebhook(
      'key.upgraded',
      webhookPayloads.keyUpgraded({
        keyId,
        keyPrefix: keyData.keyPrefix,
        previousTier: keyData.tier,
        newTier,
      })
    ).catch((err) => {
      console.error('[API Keys] Failed to send key.upgraded webhook:', err);
    });

    return { success: true, data: updatedKeyData };
  } catch (error) {
    console.error('Failed to upgrade key tier:', error);
    return { success: false, error: 'Failed to upgrade key tier' };
  }
}

/**
 * Downgrade an API key to free tier (used when subscription expires)
 */
export async function downgradeKeyToFree(keyId: string): Promise<boolean> {
  if (!isKvConfigured()) return false;

  try {
    const hashedKey = await kv.get<string>(`${KV_PREFIX.key}id:${keyId}`);
    if (!hashedKey) return false;

    const keyData = await kv.get<ApiKeyData>(`${KV_PREFIX.key}${hashedKey}`);
    if (!keyData) return false;

    const tierConfig = API_KEY_TIERS.free;

    const updatedKeyData: ApiKeyData = {
      ...keyData,
      tier: 'free',
      permissions: [...tierConfig.features],
      rateLimit: tierConfig.requestsPerDay,
      expiresAt: undefined,
      metadata: {
        ...keyData.metadata,
        downgradedAt: new Date().toISOString(),
        previousTier: keyData.tier,
      },
    };

    await kv.set(`${KV_PREFIX.key}${hashedKey}`, updatedKeyData);

    return true;
  } catch (error) {
    console.error('Failed to downgrade key:', error);
    return false;
  }
}

/**
 * Check for expired subscriptions and return keys that need to be downgraded
 */
export async function checkSubscriptionExpiry(): Promise<string[]> {
  if (!isKvConfigured()) return [];

  try {
    // Get all keys with pro or enterprise tier that have an expiry date
    // This uses a scan pattern - in production, you'd want a more efficient index
    const keys = await kv.keys(`${KV_PREFIX.key}*`);
    const expiredKeyIds: string[] = [];
    const now = new Date();

    for (const key of keys) {
      // Skip id reference keys
      if (key.includes(':id:')) continue;

      const keyData = await kv.get<ApiKeyData>(key);
      if (!keyData) continue;

      // Check if key has expired
      if (keyData.expiresAt && keyData.tier !== 'free' && new Date(keyData.expiresAt) < now) {
        expiredKeyIds.push(keyData.id);
      }
    }

    return expiredKeyIds;
  } catch (error) {
    console.error('Failed to check subscription expiry:', error);
    return [];
  }
}
