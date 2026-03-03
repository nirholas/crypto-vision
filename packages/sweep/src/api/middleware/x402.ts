import { type Context, type Next } from "hono";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { getRedis } from "../../utils/redis.js";
import { verifyPaymentOnChain, type PaymentVerificationResult } from "../../services/payments/index.js";
import { checkCredits, deductCredits } from "../../services/payments/credits.js";
import { getEndpointPrice } from "../../services/payments/pricing.js";
import { getDb, apiPayments, apiUsage } from "../../db/index.js";

/**
 * x402 Payment Protocol Middleware
 *
 * Implements the x402 payment protocol for API monetization.
 * When payment is required, returns HTTP 402 with payment instructions.
 * When valid payment is provided, allows the request to proceed.
 *
 * Features:
 * - Full x402 protocol compliance
 * - On-chain payment verification (Base USDC)
 * - Prepaid credit system support
 * - Payment receipt issuance
 * - Redis caching for payment proofs
 * - Free tier rate limiting
 *
 * @see https://x402.org
 */

// x402 protocol version
export const X402_VERSION = 1;

// x402 payment configuration
export interface X402Config {
  /** Amount to charge in USD cents (e.g., 10 = $0.10) */
  amountCents: number;
  /** USDC receiver address */
  receiverAddress: string;
  /** Network for payment (default: Base) */
  network?: string;
  /** Asset for payment (default: USDC) */
  asset?: string;
  /** Whether to require payment (can be disabled for free tier) */
  enabled?: boolean;
  /** Custom description for payment */
  description?: string;
  /** Endpoint path for pricing lookup */
  endpoint?: string;
  /** Allow prepaid credits */
  allowCredits?: boolean;
  /** Free tier requests per day */
  freeTierLimit?: number;
}

// Payment requirement returned in 402 response
export interface PaymentRequirement {
  scheme: string;
  network: string;
  maxAmountRequired: string;
  resource: string;
  description: string;
  mimeType: string;
  payTo: string;
  maxTimeoutSeconds: number;
  asset: string;
  outputSchema?: object;
  extra?: Record<string, unknown>;
}

// Payment payload from client
export interface PaymentPayload {
  x402Version: number;
  scheme: string;
  network: string;
  payload: {
    signature: string;
    authorization: {
      from: string;
      to: string;
      value: string;
      validAfter: string;
      validBefore: string;
      nonce: string;
    };
  };
}

// Payment receipt issued after successful payment
export interface PaymentReceipt {
  receiptId: string;
  x402Version: number;
  network: string;
  txHash?: string;
  payer: string;
  payee: string;
  amount: string;
  resource: string;
  timestamp: number;
  expiresAt: number;
}

// x402 response for 402 status
export interface X402Response {
  x402Version: number;
  accepts: PaymentRequirement[];
  error?: string;
}

// Default configuration
const DEFAULT_CONFIG: Partial<X402Config> = {
  network: "eip155:8453", // Base mainnet
  asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
  enabled: true,
  allowCredits: true,
  freeTierLimit: 10, // 10 free requests per day
};

// Header names
const PAYMENT_HEADER = "x-payment";
const PAYMENT_RESPONSE_HEADER = "x-payment-response";
const PAYMENT_RECEIPT_HEADER = "x-payment-receipt";
const CREDITS_HEADER = "x-credits-used";

// Cache keys
const PAYMENT_CACHE_PREFIX = "x402:payment:";
const RECEIPT_CACHE_PREFIX = "x402:receipt:";
const FREE_TIER_PREFIX = "x402:free:";
const NONCE_PREFIX = "x402:nonce:";

// USDC has 6 decimals
const USDC_DECIMALS = 6;

// Receipt validity (24 hours)
const RECEIPT_TTL_SECONDS = 86400;

// Free tier window (24 hours)
const FREE_TIER_WINDOW_SECONDS = 86400;

/**
 * Convert cents to USDC amount string
 */
function centsToUsdcAmount(cents: number): string {
  // USDC has 6 decimals, so $0.10 = 100000 (0.10 * 10^6)
  const amount = BigInt(cents) * BigInt(10 ** (USDC_DECIMALS - 2));
  return amount.toString();
}

/**
 * Convert USDC amount to cents
 */
function usdcAmountToCents(amount: string): number {
  const amountBigInt = BigInt(amount);
  return Number(amountBigInt / BigInt(10 ** (USDC_DECIMALS - 2)));
}

/**
 * Generate a unique receipt ID
 */
function generateReceiptId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `rcpt_${timestamp}_${random}`;
}

/**
 * Check if a cached payment proof exists and is valid
 */
async function getCachedPaymentProof(
  paymentHash: string
): Promise<PaymentReceipt | null> {
  const redis = getRedis();
  const cached = await redis.get(`${PAYMENT_CACHE_PREFIX}${paymentHash}`);
  if (cached) {
    const receipt = JSON.parse(cached) as PaymentReceipt;
    if (receipt.expiresAt > Date.now()) {
      return receipt;
    }
  }
  return null;
}

/**
 * Cache a payment proof
 */
async function cachePaymentProof(
  paymentHash: string,
  receipt: PaymentReceipt
): Promise<void> {
  const redis = getRedis();
  const ttl = Math.floor((receipt.expiresAt - Date.now()) / 1000);
  if (ttl > 0) {
    await redis.setex(
      `${PAYMENT_CACHE_PREFIX}${paymentHash}`,
      ttl,
      JSON.stringify(receipt)
    );
  }
}

/**
 * Issue a payment receipt
 */
async function issueReceipt(
  payment: PaymentPayload,
  resource: string,
  txHash?: string
): Promise<PaymentReceipt> {
  const receipt: PaymentReceipt = {
    receiptId: generateReceiptId(),
    x402Version: X402_VERSION,
    network: payment.network,
    txHash,
    payer: payment.payload.authorization.from,
    payee: payment.payload.authorization.to,
    amount: payment.payload.authorization.value,
    resource,
    timestamp: Date.now(),
    expiresAt: Date.now() + RECEIPT_TTL_SECONDS * 1000,
  };

  // Cache the receipt
  const redis = getRedis();
  await redis.setex(
    `${RECEIPT_CACHE_PREFIX}${receipt.receiptId}`,
    RECEIPT_TTL_SECONDS,
    JSON.stringify(receipt)
  );

  return receipt;
}

/**
 * Check free tier usage
 */
async function checkFreeTier(
  identifier: string,
  limit: number
): Promise<{ allowed: boolean; used: number; remaining: number }> {
  const redis = getRedis();
  const key = `${FREE_TIER_PREFIX}${identifier}`;
  const used = parseInt((await redis.get(key)) || "0", 10);

  if (used >= limit) {
    return { allowed: false, used, remaining: 0 };
  }

  return { allowed: true, used, remaining: limit - used };
}

/**
 * Increment free tier usage
 */
async function incrementFreeTierUsage(identifier: string): Promise<void> {
  const redis = getRedis();
  const key = `${FREE_TIER_PREFIX}${identifier}`;
  const exists = await redis.exists(key);
  
  if (exists) {
    await redis.incr(key);
  } else {
    await redis.setex(key, FREE_TIER_WINDOW_SECONDS, "1");
  }
}

/**
 * Generate a hash for payment deduplication
 */
function generatePaymentHash(payment: PaymentPayload): string {
  const { from, to, value, nonce } = payment.payload.authorization;
  return `${from}:${to}:${value}:${nonce}`;
}

/**
 * Verify payment signature and authorization
 * Uses on-chain verification for production
 */
async function verifyPayment(
  payment: PaymentPayload,
  config: X402Config
): Promise<PaymentVerificationResult> {
  try {
    const { authorization } = payment.payload;

    // Verify basic fields
    if (authorization.to.toLowerCase() !== config.receiverAddress.toLowerCase()) {
      return { valid: false, error: "Invalid receiver address" };
    }

    const requiredAmount = BigInt(centsToUsdcAmount(config.amountCents));
    const providedAmount = BigInt(authorization.value);

    if (providedAmount < requiredAmount) {
      return { valid: false, error: "Insufficient payment amount" };
    }

    // Check validity window
    const now = Math.floor(Date.now() / 1000);
    const validAfter = parseInt(authorization.validAfter);
    const validBefore = parseInt(authorization.validBefore);

    if (now < validAfter) {
      return { valid: false, error: "Payment not yet valid" };
    }

    if (now > validBefore) {
      return { valid: false, error: "Payment expired" };
    }

    // Check if nonce was already used (replay protection)
    const redis = getRedis();
    const nonceKey = `${NONCE_PREFIX}${authorization.from}:${authorization.nonce}`;
    const used = await redis.get(nonceKey);

    if (used) {
      return { valid: false, error: "Nonce already used" };
    }

    // Check for cached payment proof (already verified)
    const paymentHash = generatePaymentHash(payment);
    const cachedReceipt = await getCachedPaymentProof(paymentHash);
    if (cachedReceipt) {
      return { valid: true, txHash: cachedReceipt.txHash };
    }

    // Perform on-chain verification
    const onChainResult = await verifyPaymentOnChain({
      payer: authorization.from as `0x${string}`,
      payee: authorization.to as `0x${string}`,
      amount: authorization.value,
      signature: payment.payload.signature,
      nonce: authorization.nonce,
      validAfter: authorization.validAfter,
      validBefore: authorization.validBefore,
    });

    if (!onChainResult.valid) {
      return { valid: false, error: onChainResult.error || "On-chain verification failed" };
    }

    // Mark nonce as used (expires after validBefore + buffer)
    const ttl = validBefore - now + 3600; // 1 hour buffer
    await redis.setex(nonceKey, ttl, "1");

    return { valid: true, txHash: onChainResult.txHash };
  } catch (error) {
    console.error("[x402] Payment verification error:", error);
    return { valid: false, error: "Payment verification failed" };
  }
}

/**
 * Settle the payment with the x402 facilitator
 */
async function settlePayment(
  payment: PaymentPayload,
  receipt: PaymentReceipt
): Promise<{
  success: boolean;
  txHash?: string;
  error?: string;
}> {
  try {
    // Use the x402 facilitator's /settle endpoint
    const facilitatorUrl = process.env.X402_FACILITATOR_URL || "https://x402.org";
    
    const settleResponse = await fetch(`${facilitatorUrl}/settle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        x402Version: X402_VERSION,
        payment,
        receipt,
      }),
    });

    if (!settleResponse.ok) {
      const errorData = await settleResponse.json().catch(() => ({}));
      console.error("[x402] Settlement API error:", errorData);
      // Settlement failure is non-blocking - payment was verified
      return { success: true, txHash: receipt.txHash };
    }

    const result = await settleResponse.json() as { txHash?: string };
    return {
      success: true,
      txHash: result.txHash || receipt.txHash,
    };
  } catch (error) {
    console.error("[x402] Payment settlement error:", error);
    // Settlement failure is non-blocking - we don't fail the request
    return { success: true, txHash: receipt.txHash };
  }
}

/**
 * Record payment in database
 */
async function recordPayment(
  receipt: PaymentReceipt,
  endpoint: string,
  method: string,
  paymentType: "x402" | "credits" | "free_tier"
): Promise<void> {
  try {
    const db = getDb();
    await db.insert(apiPayments).values({
      receiptId: receipt.receiptId,
      payerAddress: receipt.payer,
      payeeAddress: receipt.payee,
      amountUsdc: receipt.amount,
      network: receipt.network,
      txHash: receipt.txHash,
      endpoint,
      method,
      paymentType,
      status: "completed",
      createdAt: new Date(receipt.timestamp),
    } as any);
  } catch (error) {
    console.error("[x402] Failed to record payment:", error);
    // Non-blocking - don't fail the request
  }
}

/**
 * Record API usage
 */
async function recordUsage(
  userIdentifier: string,
  endpoint: string,
  method: string,
  priceCents: number,
  paymentType: "x402" | "credits" | "free_tier"
): Promise<void> {
  try {
    const db = getDb();
    await db.insert(apiUsage).values({
      userIdentifier,
      endpoint,
      method,
      priceCents: String(priceCents),
      paymentType,
      createdAt: new Date(),
    } as any);
  } catch (error) {
    console.error("[x402] Failed to record usage:", error);
    // Non-blocking
  }
}

/**
 * Create x402 payment middleware
 * 
 * Supports:
 * - x402 on-chain payments
 * - Prepaid credits
 * - Free tier with rate limiting
 */
export function x402Middleware(config: X402Config) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  return createMiddleware(async (c: Context, next: Next) => {
    // Skip if payments disabled
    if (!finalConfig.enabled) {
      await next();
      return;
    }

    const endpoint = finalConfig.endpoint || c.req.path;
    const method = c.req.method;

    // Get user identifier (IP or wallet address from auth)
    const userIdentifier = 
      c.get("walletAddress") || 
      c.req.header("x-forwarded-for")?.split(",")[0] || 
      "anonymous";

    // Check for x-credits header (prepaid credits)
    const creditsHeader = c.req.header("x-credits");
    if (creditsHeader && finalConfig.allowCredits) {
      try {
        const walletAddress = creditsHeader;
        const creditBalance = await checkCredits(walletAddress);
        
        if (creditBalance >= finalConfig.amountCents) {
          // Deduct credits and proceed
          await deductCredits(walletAddress, finalConfig.amountCents, endpoint);
          
          c.header(CREDITS_HEADER, finalConfig.amountCents.toString());
          c.set("x402PaymentType" as never, "credits");
          
          // Record usage
          await recordUsage(walletAddress, endpoint, method, finalConfig.amountCents, "credits");
          
          await next();
          return;
        }
      } catch (error) {
        console.error("[x402] Credits check error:", error);
        // Fall through to x402 payment
      }
    }

    // Check for payment header
    const paymentHeader = c.req.header(PAYMENT_HEADER);

    if (!paymentHeader) {
      // No payment provided - check free tier
      if (finalConfig.freeTierLimit && finalConfig.freeTierLimit > 0) {
        const freeTierCheck = await checkFreeTier(userIdentifier, finalConfig.freeTierLimit);
        
        if (freeTierCheck.allowed) {
          await incrementFreeTierUsage(userIdentifier);
          c.set("x402PaymentType" as never, "free_tier");
          
          // Record usage
          await recordUsage(userIdentifier, endpoint, method, 0, "free_tier");
          
          await next();
          return;
        }
      }

      // Return 402 with payment requirements
      const requirement: PaymentRequirement = {
        scheme: "exact",
        network: finalConfig.network!,
        maxAmountRequired: centsToUsdcAmount(finalConfig.amountCents),
        resource: c.req.url,
        description:
          finalConfig.description ||
          `Payment required: $${(finalConfig.amountCents / 100).toFixed(2)}`,
        mimeType: "application/json",
        payTo: finalConfig.receiverAddress,
        maxTimeoutSeconds: 300, // 5 minutes
        asset: finalConfig.asset!,
      };

      c.status(402);
      c.header("Content-Type", "application/json");
      c.header(
        "X-Payment-Required",
        JSON.stringify({
          x402Version: 1,
          accepts: [requirement],
          error: "Payment required to access this resource",
        })
      );

      return c.json({
        error: "Payment required",
        code: "PAYMENT_REQUIRED",
        accepts: [requirement],
      });
    }

    // Payment provided - verify it
    let payment: PaymentPayload;
    try {
      payment = JSON.parse(
        Buffer.from(paymentHeader, "base64").toString("utf-8")
      );
    } catch {
      throw new HTTPException(400, {
        message: "Invalid payment header format",
      });
    }

    // Verify the payment
    const verification = await verifyPayment(payment, finalConfig);

    if (!verification.valid) {
      throw new HTTPException(402, {
        message: verification.error || "Payment verification failed",
      });
    }

    // Issue receipt
    const receipt = await issueReceipt(payment, endpoint, verification.txHash);
    
    // Cache the payment proof
    const paymentHash = generatePaymentHash(payment);
    await cachePaymentProof(paymentHash, receipt);

    // Record payment in database
    await recordPayment(receipt, endpoint, method, "x402");
    await recordUsage(
      payment.payload.authorization.from,
      endpoint,
      method,
      finalConfig.amountCents,
      "x402"
    );

    // Settle the payment (in background, don't block request)
    settlePayment(payment, receipt).then((result) => {
      if (!result.success) {
        console.error("[x402] Settlement failed:", result.error);
      } else {
        console.log("[x402] Payment settled:", result.txHash);
      }
    });

    // Add payment response header
    c.header(
      PAYMENT_RESPONSE_HEADER,
      JSON.stringify({
        success: true,
        network: payment.network,
        payer: payment.payload.authorization.from,
        amount: payment.payload.authorization.value,
        receiptId: receipt.receiptId,
      })
    );

    // Add receipt header
    c.header(
      PAYMENT_RECEIPT_HEADER,
      Buffer.from(JSON.stringify(receipt)).toString("base64")
    );

    // Store payment info in context for logging
    c.set("x402Payment" as never, {
      payer: payment.payload.authorization.from,
      amount: payment.payload.authorization.value,
      network: payment.network,
      receiptId: receipt.receiptId,
    });
    c.set("x402PaymentType" as never, "x402");

    await next();
  });
}

/**
 * Create x402 middleware for sweep API ($0.10 per call)
 */
export const sweepPaymentMiddleware = (receiverAddress: string) =>
  x402Middleware({
    amountCents: 10, // $0.10
    receiverAddress,
    description: "Sweep sweep execution fee",
    endpoint: "POST /sweep",
  });

/**
 * Create x402 middleware for quote API ($0.05 per call)
 */
export const quotePaymentMiddleware = (
  receiverAddress: string,
  enabled = true
) =>
  x402Middleware({
    amountCents: 5, // $0.05
    receiverAddress,
    enabled,
    description: "Sweep quote fee",
    endpoint: "POST /quote",
  });

/**
 * Create x402 middleware for DeFi deposit ($0.15 per call)
 */
export const defiDepositMiddleware = (receiverAddress: string) =>
  x402Middleware({
    amountCents: 15, // $0.15
    receiverAddress,
    description: "Sweep DeFi deposit fee",
    endpoint: "POST /defi/deposit",
  });

/**
 * Create x402 middleware for consolidate execute ($0.25 per call)
 */
export const consolidateExecuteMiddleware = (receiverAddress: string) =>
  x402Middleware({
    amountCents: 25, // $0.25
    receiverAddress,
    description: "Sweep consolidate execution fee",
    endpoint: "POST /consolidate/execute",
  });

/**
 * Create x402 middleware for DeFi positions ($0.05 per call)
 */
export const defiPositionsMiddleware = (receiverAddress: string) =>
  x402Middleware({
    amountCents: 5, // $0.05
    receiverAddress,
    description: "Sweep DeFi positions query fee",
    endpoint: "GET /defi/positions",
  });

/**
 * Helper to check if x402 payments are configured
 */
export function isX402Configured(): boolean {
  return !!process.env.X402_RECEIVER_ADDRESS;
}

/**
 * Get x402 receiver address from environment
 */
export function getX402ReceiverAddress(): string {
  const address = process.env.X402_RECEIVER_ADDRESS;
  if (!address) {
    throw new Error("X402_RECEIVER_ADDRESS environment variable not set");
  }
  return address;
}

/**
 * Get a receipt by ID
 */
export async function getReceipt(receiptId: string): Promise<PaymentReceipt | null> {
  const redis = getRedis();
  const cached = await redis.get(`${RECEIPT_CACHE_PREFIX}${receiptId}`);
  if (cached) {
    return JSON.parse(cached) as PaymentReceipt;
  }
  return null;
}

/**
 * Validate a receipt
 */
export async function validateReceipt(receiptId: string): Promise<boolean> {
  const receipt = await getReceipt(receiptId);
  if (!receipt) return false;
  return receipt.expiresAt > Date.now();
}

// Export utilities
export { centsToUsdcAmount, usdcAmountToCents };
