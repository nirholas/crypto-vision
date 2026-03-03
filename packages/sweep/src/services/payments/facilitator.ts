/**
 * x402 Facilitator Service
 *
 * Implements the x402 Facilitator role for payment settlement.
 * The facilitator acts as a trusted intermediary that:
 * 1. Verifies payment signatures
 * 2. Settles payments between payer and API
 * 3. Handles payment disputes
 */

import { createPublicClient, createWalletClient, http, parseAbi, type Address, type Hash } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { getRedis } from "../../utils/redis.js";
import { getDb, apiPayments } from "../../db/index.js";
import { eq } from "drizzle-orm";

// USDC contract on Base
const BASE_USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address;

// Settlement cache prefix
const SETTLEMENT_CACHE_PREFIX = "x402:settlement:";
const DISPUTE_CACHE_PREFIX = "x402:dispute:";

// Settlement status
export type SettlementStatus =
  | "pending"
  | "verified"
  | "settled"
  | "failed"
  | "disputed"
  | "refunded";

// Payment authorization from x402 payload
export interface PaymentAuthorization {
  from: Address;
  to: Address;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: string;
  signature: string;
}

// Settlement result
export interface SettlementResult {
  success: boolean;
  status: SettlementStatus;
  txHash?: string;
  error?: string;
  settledAt?: number;
}

// Dispute request
export interface DisputeRequest {
  receiptId: string;
  reason: string;
  evidence?: string;
  requestedRefund: boolean;
}

// Dispute resolution
export interface DisputeResolution {
  disputeId: string;
  receiptId: string;
  status: "pending" | "approved" | "rejected";
  resolution?: string;
  refundTxHash?: string;
  resolvedAt?: number;
}

// USDC ABI for transfers
const USDC_ABI = parseAbi([
  "function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, bytes signature) external",
  "function authorizationState(address authorizer, bytes32 nonce) view returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
]);

/**
 * Get Base client for reading
 */
function getBaseClient() {
  const rpcUrl = process.env.RPC_BASE || "https://mainnet.base.org";
  return createPublicClient({
    chain: base,
    transport: http(rpcUrl),
  });
}

/**
 * Get Base wallet client for writing (settlement)
 */
function getBaseWalletClient() {
  const rpcUrl = process.env.RPC_BASE || "https://mainnet.base.org";
  const privateKey = process.env.FACILITATOR_PRIVATE_KEY;

  if (!privateKey) {
    throw new Error("FACILITATOR_PRIVATE_KEY not configured");
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);

  return createWalletClient({
    account,
    chain: base,
    transport: http(rpcUrl),
  });
}

/**
 * Verify a payment authorization
 */
export async function verifyAuthorization(
  auth: PaymentAuthorization
): Promise<{ valid: boolean; error?: string }> {
  try {
    const client = getBaseClient();

    // Check if nonce is already used
    // Note: Using 'as any' to bypass viem type incompatibilities
    const nonceUsed = await (client as any).readContract({
      address: BASE_USDC_ADDRESS,
      abi: USDC_ABI,
      functionName: "authorizationState",
      args: [auth.from, auth.nonce as `0x${string}`],
    });

    if (nonceUsed) {
      return { valid: false, error: "Authorization nonce already used" };
    }

    // Check payer balance
    const balance = await (client as any).readContract({
      address: BASE_USDC_ADDRESS,
      abi: USDC_ABI,
      functionName: "balanceOf",
      args: [auth.from],
    }) as bigint;

    const requiredAmount = BigInt(auth.value);

    if (balance < requiredAmount) {
      return { valid: false, error: "Insufficient payer balance" };
    }

    // Check timing
    const now = Math.floor(Date.now() / 1000);
    const validAfter = parseInt(auth.validAfter);
    const validBefore = parseInt(auth.validBefore);

    if (now < validAfter) {
      return { valid: false, error: "Authorization not yet valid" };
    }

    if (now > validBefore) {
      return { valid: false, error: "Authorization expired" };
    }

    return { valid: true };
  } catch (error) {
    console.error("[Facilitator] Verification error:", error);
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Verification failed",
    };
  }
}

/**
 * Settle a payment using TransferWithAuthorization
 */
export async function settlePayment(
  auth: PaymentAuthorization,
  receiptId: string
): Promise<SettlementResult> {
  const redis = getRedis();
  const cacheKey = `${SETTLEMENT_CACHE_PREFIX}${auth.nonce}`;

  try {
    // Check if already settled
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as SettlementResult;
    }

    // Verify authorization first
    const verification = await verifyAuthorization(auth);
    if (!verification.valid) {
      const result: SettlementResult = {
        success: false,
        status: "failed",
        error: verification.error,
      };
      await redis.setex(cacheKey, 3600, JSON.stringify(result));
      return result;
    }

    // Use external facilitator if configured
    const facilitatorUrl = process.env.X402_FACILITATOR_URL;
    if (facilitatorUrl) {
      return settleWithExternalFacilitator(auth, receiptId, facilitatorUrl);
    }

    // Self-settlement (requires FACILITATOR_PRIVATE_KEY)
    return settleDirectly(auth, receiptId);
  } catch (error) {
    console.error("[Facilitator] Settlement error:", error);
    return {
      success: false,
      status: "failed",
      error: error instanceof Error ? error.message : "Settlement failed",
    };
  }
}

/**
 * Settle payment using external x402 facilitator
 */
async function settleWithExternalFacilitator(
  auth: PaymentAuthorization,
  receiptId: string,
  facilitatorUrl: string
): Promise<SettlementResult> {
  const redis = getRedis();
  const cacheKey = `${SETTLEMENT_CACHE_PREFIX}${auth.nonce}`;

  try {
    const response = await fetch(`${facilitatorUrl}/settle`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        x402Version: 1,
        scheme: "exact",
        network: "eip155:8453",
        payload: {
          signature: auth.signature,
          authorization: {
            from: auth.from,
            to: auth.to,
            value: auth.value,
            validAfter: auth.validAfter,
            validBefore: auth.validBefore,
            nonce: auth.nonce,
          },
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as { error?: string };
      const result: SettlementResult = {
        success: false,
        status: "failed",
        error: errorData.error || `HTTP ${response.status}`,
      };
      return result;
    }

    const data = await response.json() as { txHash?: string };

    const result: SettlementResult = {
      success: true,
      status: "settled",
      txHash: data.txHash,
      settledAt: Date.now(),
    };

    // Cache successful settlement
    await redis.setex(cacheKey, 86400, JSON.stringify(result)); // 24 hour cache

    // Update database
    await updatePaymentStatus(receiptId, "completed", data.txHash);

    return result;
  } catch (error) {
    console.error("[Facilitator] External settlement error:", error);
    return {
      success: false,
      status: "failed",
      error: error instanceof Error ? error.message : "External settlement failed",
    };
  }
}

/**
 * Settle payment directly on-chain
 */
async function settleDirectly(
  auth: PaymentAuthorization,
  receiptId: string
): Promise<SettlementResult> {
  const redis = getRedis();
  const cacheKey = `${SETTLEMENT_CACHE_PREFIX}${auth.nonce}`;

  try {
    const walletClient = getBaseWalletClient();
    const publicClient = getBaseClient();

    // Execute TransferWithAuthorization
    const hash = await (walletClient as any).writeContract({
      address: BASE_USDC_ADDRESS,
      abi: USDC_ABI,
      functionName: "transferWithAuthorization",
      args: [
        auth.from,
        auth.to,
        BigInt(auth.value),
        BigInt(auth.validAfter),
        BigInt(auth.validBefore),
        auth.nonce as `0x${string}`,
        auth.signature as `0x${string}`,
      ],
    });

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({
      hash,
      confirmations: 1,
    });

    if (receipt.status !== "success") {
      const result: SettlementResult = {
        success: false,
        status: "failed",
        txHash: hash,
        error: "Transaction reverted",
      };
      await redis.setex(cacheKey, 3600, JSON.stringify(result));
      return result;
    }

    const result: SettlementResult = {
      success: true,
      status: "settled",
      txHash: hash,
      settledAt: Date.now(),
    };

    // Cache successful settlement
    await redis.setex(cacheKey, 86400, JSON.stringify(result));

    // Update database
    await updatePaymentStatus(receiptId, "completed", hash);

    return result;
  } catch (error) {
    console.error("[Facilitator] Direct settlement error:", error);
    return {
      success: false,
      status: "failed",
      error: error instanceof Error ? error.message : "Direct settlement failed",
    };
  }
}

/**
 * Update payment status in database
 */
async function updatePaymentStatus(
  receiptId: string,
  status: "pending" | "completed" | "failed" | "refunded",
  txHash?: string
): Promise<void> {
  try {
    const db = getDb();
    await db
      .update(apiPayments)
      .set({
        status,
        updatedAt: new Date(),
        ...(txHash ? { txHash } : {}),
      } as any)
      .where(eq(apiPayments.receiptId, receiptId));
  } catch (error) {
    console.error("[Facilitator] Database update error:", error);
  }
}

/**
 * File a dispute for a payment
 */
export async function fileDispute(
  request: DisputeRequest
): Promise<{ disputeId: string; status: string }> {
  const redis = getRedis();
  const disputeId = `dispute_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
  const cacheKey = `${DISPUTE_CACHE_PREFIX}${disputeId}`;

  const dispute: DisputeResolution = {
    disputeId,
    receiptId: request.receiptId,
    status: "pending",
    resolution: undefined,
    refundTxHash: undefined,
    resolvedAt: undefined,
  };

  // Store dispute
  await redis.setex(cacheKey, 604800, JSON.stringify(dispute)); // 7 day TTL

  console.log("[Facilitator] Dispute filed:", {
    disputeId,
    receiptId: request.receiptId,
    reason: request.reason,
  });

  return {
    disputeId,
    status: "pending",
  };
}

/**
 * Get dispute status
 */
export async function getDisputeStatus(
  disputeId: string
): Promise<DisputeResolution | null> {
  const redis = getRedis();
  const cacheKey = `${DISPUTE_CACHE_PREFIX}${disputeId}`;
  const cached = await redis.get(cacheKey);

  if (cached) {
    return JSON.parse(cached) as DisputeResolution;
  }

  return null;
}

/**
 * Resolve a dispute (admin function)
 */
export async function resolveDispute(
  disputeId: string,
  approved: boolean,
  resolution: string
): Promise<DisputeResolution> {
  const redis = getRedis();
  const cacheKey = `${DISPUTE_CACHE_PREFIX}${disputeId}`;
  const cached = await redis.get(cacheKey);

  if (!cached) {
    throw new Error("Dispute not found");
  }

  const dispute = JSON.parse(cached) as DisputeResolution;

  dispute.status = approved ? "approved" : "rejected";
  dispute.resolution = resolution;
  dispute.resolvedAt = Date.now();

  // If approved and refund requested, process refund
  if (approved) {
    console.log("[Facilitator] Processing refund for dispute:", disputeId);

    // Look up the original payment to get payer address and amount
    const db = getDb();
    const payment = await db.query.apiPayments.findFirst({
      where: eq(apiPayments.receiptId, dispute.receiptId),
    });

    if (payment) {
      const refundResult = await processRefund(
        payment.payerAddress as Address,
        String(payment.amount),
        `Dispute ${disputeId} approved: ${resolution}`
      );

      if (refundResult.success) {
        dispute.refundTxHash = refundResult.txHash;
        // Update payment status to refunded
        await updatePaymentStatus(dispute.receiptId, "refunded", refundResult.txHash);
      } else {
        console.error("[Facilitator] Refund failed:", refundResult.error);
        dispute.resolution = `${resolution} (refund failed: ${refundResult.error})`;
      }
    } else {
      console.warn("[Facilitator] Payment not found for receiptId:", dispute.receiptId);
    }
  }

  await redis.setex(cacheKey, 604800, JSON.stringify(dispute));

  return dispute;
}

/**
 * Process a refund
 */
export async function processRefund(
  to: Address,
  amount: string,
  reason: string
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    const walletClient = getBaseWalletClient();
    const publicClient = getBaseClient();

    // Transfer USDC from facilitator to recipient
    const hash = await (walletClient as any).writeContract({
      address: BASE_USDC_ADDRESS,
      abi: USDC_ABI,
      functionName: "transfer",
      args: [to, BigInt(amount)],
    });

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({
      hash,
      confirmations: 1,
    });

    if (receipt.status !== "success") {
      return {
        success: false,
        txHash: hash,
        error: "Refund transaction reverted",
      };
    }

    console.log("[Facilitator] Refund processed:", {
      to,
      amount,
      reason,
      txHash: hash,
    });

    return {
      success: true,
      txHash: hash,
    };
  } catch (error) {
    console.error("[Facilitator] Refund error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Refund failed",
    };
  }
}

/**
 * Get settlement status
 */
export async function getSettlementStatus(
  nonce: string
): Promise<SettlementResult | null> {
  const redis = getRedis();
  const cacheKey = `${SETTLEMENT_CACHE_PREFIX}${nonce}`;
  const cached = await redis.get(cacheKey);

  if (cached) {
    return JSON.parse(cached) as SettlementResult;
  }

  return null;
}
