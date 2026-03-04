/**
 * x402 Access Pass System
 *
 * Implements time-based access passes for unlimited API usage.
 * Passes grant access to all premium endpoints for a duration
 * without per-request payments.
 *
 * Pass Types:
 * - hour: 1 hour unlimited access ($0.25)
 * - day: 24 hour unlimited access ($2.00)
 * - week: 7 day unlimited access ($10.00)
 * 
 * Uses unified storage layer (Upstash Redis / memory fallback)
 */

import { CURRENT_NETWORK, PAYMENT_ADDRESS, USDC_ADDRESS } from './config';
import { createReceipt } from './payments';
import * as storage from '../storage';

// Storage namespace for pass data
const NAMESPACE = 'x402:passes';
const PASSES_KEY = 'passes'; // Hash of pass ID -> pass data
const WALLET_INDEX_PREFIX = 'wallet:'; // wallet:address -> list of pass IDs
const ACTIVE_PASSES_KEY = 'active'; // Set of active pass IDs

// =============================================================================
// TYPES
// =============================================================================

export type PassDuration = 'hour' | 'day' | 'week';

export interface AccessPass {
  /** Unique pass ID */
  id: string;
  /** Wallet address that owns this pass */
  walletAddress: string;
  /** Pass type/duration */
  duration: PassDuration;
  /** ISO timestamp when pass starts */
  startsAt: string;
  /** ISO timestamp when pass expires */
  expiresAt: string;
  /** Amount paid (in USDC atomic units) */
  amountPaid: string;
  /** Transaction hash */
  transactionHash?: string;
  /** Network used */
  network: string;
  /** Current status */
  status: 'active' | 'expired' | 'cancelled';
  /** Number of requests made */
  requestCount: number;
  /** Last request timestamp */
  lastRequestAt?: string;
  /** Created timestamp */
  createdAt: string;
}

export interface PassConfig {
  duration: PassDuration;
  durationSeconds: number;
  priceUsd: number;
  priceUsdc: string;
  name: string;
  description: string;
  features: string[];
  rateLimit: number; // requests per minute
}

export interface PassPurchaseResult {
  success: boolean;
  pass?: AccessPass;
  receipt?: string;
  error?: string;
  paymentRequired?: {
    x402Version: number;
    accepts: Array<{
      scheme: string;
      network: string;
      asset: string;
      payTo: string;
      maxAmountRequired: string;
      resource: string;
      description: string;
    }>;
  };
}

// =============================================================================
// CONFIGURATION
// =============================================================================

export const PASS_CONFIG: Record<PassDuration, PassConfig> = {
  hour: {
    duration: 'hour',
    durationSeconds: 60 * 60, // 1 hour
    priceUsd: 0.25,
    priceUsdc: '250000', // 0.25 USDC
    name: '1 Hour Pass',
    description: 'Unlimited premium API access for 1 hour',
    features: [
      'All premium endpoints',
      'No per-request fees',
      'Standard rate limits (60/min)',
      'Perfect for quick analysis',
    ],
    rateLimit: 60,
  },
  day: {
    duration: 'day',
    durationSeconds: 24 * 60 * 60, // 24 hours
    priceUsd: 2.0,
    priceUsdc: '2000000', // 2 USDC
    name: '24 Hour Pass',
    description: 'Unlimited premium API access for 24 hours',
    features: [
      'All premium endpoints',
      'No per-request fees',
      'Higher rate limits (120/min)',
      'Priority support',
    ],
    rateLimit: 120,
  },
  week: {
    duration: 'week',
    durationSeconds: 7 * 24 * 60 * 60, // 7 days
    priceUsd: 10.0,
    priceUsdc: '10000000', // 10 USDC
    name: 'Weekly Pass',
    description: 'Unlimited premium API access for 7 days',
    features: [
      'All premium endpoints',
      'No per-request fees',
      'Highest rate limits (300/min)',
      'Priority support',
      'Webhook support',
      'Export capabilities',
    ],
    rateLimit: 300,
  },
};

// =============================================================================
// STORAGE HELPERS
// =============================================================================

/**
 * Get pass from storage
 */
async function getPassFromStorage(passId: string): Promise<AccessPass | null> {
  return storage.hget<AccessPass>(`${NAMESPACE}:${PASSES_KEY}`, passId);
}

/**
 * Save pass to storage
 */
async function savePassToStorage(pass: AccessPass): Promise<void> {
  // Store pass in hash
  await storage.hset(`${NAMESPACE}:${PASSES_KEY}`, pass.id, pass);
  
  // Add to wallet index
  const walletKey = `${NAMESPACE}:${WALLET_INDEX_PREFIX}${pass.walletAddress}`;
  await storage.rpush(walletKey, pass.id);
  
  // Add to active passes set if active
  if (pass.status === 'active') {
    await storage.sadd(`${NAMESPACE}:${ACTIVE_PASSES_KEY}`, pass.id);
  }
}

/**
 * Update pass in storage
 */
async function updatePassInStorage(pass: AccessPass): Promise<void> {
  await storage.hset(`${NAMESPACE}:${PASSES_KEY}`, pass.id, pass);
  
  // Remove from active set if no longer active
  if (pass.status !== 'active') {
    await storage.srem(`${NAMESPACE}:${ACTIVE_PASSES_KEY}`, pass.id);
  }
}

/**
 * Get wallet pass IDs from storage
 */
async function getWalletPassIds(walletAddress: string): Promise<string[]> {
  const walletKey = `${NAMESPACE}:${WALLET_INDEX_PREFIX}${walletAddress}`;
  return storage.lrange(walletKey, 0, -1);
}

// =============================================================================
// PASS MANAGEMENT
// =============================================================================

/**
 * Generate a unique pass ID
 */
function generatePassId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `pass_${timestamp}_${random}`;
}

/**
 * Create a new access pass
 */
export async function createPass(
  walletAddress: string,
  duration: PassDuration,
  transactionHash?: string
): Promise<AccessPass> {
  const config = PASS_CONFIG[duration];
  const now = new Date();
  const expiresAt = new Date(now.getTime() + config.durationSeconds * 1000);

  const pass: AccessPass = {
    id: generatePassId(),
    walletAddress: walletAddress.toLowerCase(),
    duration,
    startsAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    amountPaid: config.priceUsdc,
    transactionHash,
    network: CURRENT_NETWORK,
    status: 'active',
    requestCount: 0,
    createdAt: now.toISOString(),
  };

  // Store pass in persistent storage
  await savePassToStorage(pass);

  // Create receipt (async, don't await)
  createReceipt({
    walletAddress: pass.walletAddress,
    amount: config.priceUsdc,
    resource: `/api/premium/pass/${duration}`,
    description: config.description,
    transactionHash,
  }).catch(err => console.error('[Passes] Failed to create receipt:', err));

  return pass;
}

/**
 * Get active pass for a wallet
 */
export async function getActivePass(walletAddress: string): Promise<AccessPass | null> {
  const normalizedAddress = walletAddress.toLowerCase();
  const passIds = await getWalletPassIds(normalizedAddress);

  const now = new Date();

  // Check most recent first (reverse order)
  for (let i = passIds.length - 1; i >= 0; i--) {
    const passId = passIds[i];
    const pass = await getPassFromStorage(passId);
    if (!pass) continue;

    // Check if expired
    if (new Date(pass.expiresAt) < now) {
      if (pass.status === 'active') {
        pass.status = 'expired';
        await updatePassInStorage(pass);
      }
      continue;
    }

    if (pass.status === 'active') {
      return pass;
    }
  }

  return null;
}

/**
 * Check if wallet has active pass
 */
export async function hasActivePass(walletAddress: string): Promise<boolean> {
  const pass = await getActivePass(walletAddress);
  return pass !== null;
}

/**
 * Record a request against a pass
 */
export async function recordPassRequest(passId: string): Promise<boolean> {
  const pass = await getPassFromStorage(passId);
  if (!pass) return false;

  if (pass.status !== 'active') return false;

  // Check if expired
  if (new Date(pass.expiresAt) < new Date()) {
    pass.status = 'expired';
    await updatePassInStorage(pass);
    return false;
  }

  pass.requestCount += 1;
  pass.lastRequestAt = new Date().toISOString();
  await updatePassInStorage(pass);

  return true;
}

/**
 * Get pass by ID
 */
export async function getPass(passId: string): Promise<AccessPass | null> {
  return getPassFromStorage(passId);
}

/**
 * Get all passes for a wallet
 */
export async function getWalletPasses(walletAddress: string): Promise<AccessPass[]> {
  const normalizedAddress = walletAddress.toLowerCase();
  const passIds = await getWalletPassIds(normalizedAddress);

  const passPromises = passIds.map((id: string) => getPassFromStorage(id));
  const passesRaw = await Promise.all(passPromises);

  return passesRaw
    .filter((p): p is AccessPass => p !== null)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Get rate limit for a pass
 */
export function getPassRateLimit(pass: AccessPass): number {
  return PASS_CONFIG[pass.duration].rateLimit;
}

// =============================================================================
// PAYMENT REQUIREMENTS
// =============================================================================

/**
 * Get x402 payment requirements for a pass
 */
export function getPassPaymentRequirements(duration: PassDuration) {
  const config = PASS_CONFIG[duration];

  return {
    x402Version: 2,
    accepts: [
      {
        scheme: 'exact',
        network: CURRENT_NETWORK,
        asset: USDC_ADDRESS,
        payTo: PAYMENT_ADDRESS,
        maxAmountRequired: config.priceUsdc,
        resource: `/api/premium/pass/${duration}`,
        description: config.description,
        mimeType: 'application/json',
        maxTimeoutSeconds: 300,
      },
    ],
  };
}

/**
 * Validate pass purchase payment
 */
export function validatePassPayment(
  duration: PassDuration,
  amountPaid: string
): { valid: boolean; reason?: string } {
  const config = PASS_CONFIG[duration];
  const required = BigInt(config.priceUsdc);
  const paid = BigInt(amountPaid);

  if (paid < required) {
    return {
      valid: false,
      reason: `Insufficient payment. Required: ${config.priceUsd} USDC, Paid: ${Number(paid) / 1_000_000} USDC`,
    };
  }

  return { valid: true };
}

// =============================================================================
// PASS STATUS
// =============================================================================

/**
 * Get pass status info for display
 */
export function getPassStatus(pass: AccessPass): {
  isActive: boolean;
  remainingSeconds: number;
  remainingFormatted: string;
  progress: number;
  config: PassConfig;
} {
  const config = PASS_CONFIG[pass.duration];
  const now = new Date();
  const expiresAt = new Date(pass.expiresAt);
  const startsAt = new Date(pass.startsAt);

  const remainingSeconds = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
  const totalSeconds = config.durationSeconds;
  const elapsedSeconds = Math.floor((now.getTime() - startsAt.getTime()) / 1000);
  const progress = Math.min(100, (elapsedSeconds / totalSeconds) * 100);

  let remainingFormatted: string;
  if (remainingSeconds <= 0) {
    remainingFormatted = 'Expired';
  } else if (remainingSeconds < 60) {
    remainingFormatted = `${remainingSeconds}s`;
  } else if (remainingSeconds < 3600) {
    remainingFormatted = `${Math.floor(remainingSeconds / 60)}m`;
  } else if (remainingSeconds < 86400) {
    remainingFormatted = `${Math.floor(remainingSeconds / 3600)}h ${Math.floor((remainingSeconds % 3600) / 60)}m`;
  } else {
    remainingFormatted = `${Math.floor(remainingSeconds / 86400)}d ${Math.floor((remainingSeconds % 86400) / 3600)}h`;
  }

  return {
    isActive: pass.status === 'active' && remainingSeconds > 0,
    remainingSeconds,
    remainingFormatted,
    progress,
    config,
  };
}

/**
 * Get all pass options for display
 */
export function getPassOptions(): Array<PassConfig & { savings?: string }> {
  const hourlyRate = PASS_CONFIG.hour.priceUsd; // Base comparison
  const estimatedRequestsPerHour = 50;
  const perRequestCost = 0.02; // Average

  return Object.values(PASS_CONFIG).map((config) => {
    const hours = config.durationSeconds / 3600;
    const perRequestTotal = estimatedRequestsPerHour * hours * perRequestCost;
    const savings =
      perRequestTotal > config.priceUsd
        ? `Save up to $${(perRequestTotal - config.priceUsd).toFixed(2)}`
        : undefined;

    return { ...config, savings };
  });
}
