/**
 * @fileoverview Express Middleware for X402 Payment Gates
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import type { Address, PublicClient } from 'viem';
import { createPublicClient, http } from 'viem';
import { arbitrum } from 'viem/chains';
import type { PaymentRequest, X402Chain, X402Token } from '../types';
import { X402Error, X402ErrorCode } from '../types';
import { HTTP402Handler } from './handler';
import { NETWORKS } from '../constants';

/**
 * Express Request type (minimal)
 */
interface ExpressRequest {
  headers: Record<string, string | string[] | undefined>;
  path?: string;
  originalUrl?: string;
  method?: string;
}

/**
 * Express Response type (minimal)
 */
interface ExpressResponse {
  status(code: number): ExpressResponse;
  set(headers: Record<string, string>): ExpressResponse;
  json(body: unknown): ExpressResponse;
}

/**
 * Express NextFunction type
 */
type NextFunction = (error?: unknown) => void;

/**
 * Payment verification options
 */
export interface PaymentVerificationOptions {
  /** Recipient address that should receive payments */
  recipient: Address;

  /** Expected payment token */
  token: X402Token;

  /** Expected payment chain */
  chain: X402Chain;

  /** Custom RPC URL */
  rpcUrl?: string;

  /** Public client for verification (optional, created if not provided) */
  publicClient?: PublicClient;
}

/**
 * Payment gate configuration
 */
export interface PaymentGateConfig {
  /** Payment amount required */
  amount: string;

  /** Payment token */
  token: X402Token;

  /** Payment chain */
  chain: X402Chain;

  /** Recipient address */
  recipient: Address;

  /** Resource name (for identification) */
  resource?: string;

  /** Payment validity period in seconds */
  validityPeriod?: number;

  /** Custom verification function */
  verifyPayment?: (txHash: string, request: PaymentRequest) => Promise<boolean>;
}

/**
 * Create Express middleware for payment gate
 * Requires payment for protected routes
 */
export function createPaymentGate(config: PaymentGateConfig) {
  const {
    amount,
    token,
    chain,
    recipient,
    resource,
    validityPeriod = 300,
    verifyPayment,
  } = config;

  // Create public client for verification
  const networkConfig = NETWORKS[chain];
  const publicClient = createPublicClient({
    chain: chain === 'arbitrum' ? arbitrum : arbitrum,
    transport: http(networkConfig.rpcUrl),
  });

  return async function paymentGateMiddleware(
    req: ExpressRequest,
    res: ExpressResponse,
    next: NextFunction
  ) {
    // Check for payment proof in headers
    const paymentProof = getHeader(req, 'x-payment-proof');
    const paymentToken = getHeader(req, 'x-payment-token');

    if (paymentProof) {
      try {
        // Verify the payment
        const paymentRequest: PaymentRequest = {
          amount,
          token: (paymentToken as X402Token) ?? token,
          chain,
          recipient,
          resource: resource ?? req.path ?? req.originalUrl,
        };

        let isValid = false;

        if (verifyPayment) {
          isValid = await verifyPayment(paymentProof, paymentRequest);
        } else {
          isValid = await verifyPaymentOnChain(publicClient, paymentProof, recipient);
        }

        if (isValid) {
          // Payment verified, proceed
          return next();
        }
      } catch (error) {
        // Verification failed, require new payment
        console.error('Payment verification failed:', error);
      }
    }

    // No valid payment, return 402
    const paymentRequest: PaymentRequest = {
      amount,
      token,
      chain,
      recipient,
      resource: resource ?? req.path ?? req.originalUrl,
      deadline: Math.floor(Date.now() / 1000) + validityPeriod,
    };

    const response = HTTP402Handler.createResponse(
      paymentRequest,
      `Access to ${paymentRequest.resource} requires payment of ${amount} ${token}`
    );

    res
      .status(402)
      .set(response.headers)
      .json(response.body);
  };
}

/**
 * Create middleware factory for dynamic pricing
 */
export function createDynamicPaymentGate(
  getConfig: (req: ExpressRequest) => PaymentGateConfig | Promise<PaymentGateConfig>
) {
  return async function dynamicPaymentGateMiddleware(
    req: ExpressRequest,
    res: ExpressResponse,
    next: NextFunction
  ) {
    const config = await getConfig(req);
    const middleware = createPaymentGate(config);
    return middleware(req, res, next);
  };
}

/**
 * Middleware to extract and validate payment headers
 */
export function extractPaymentInfo() {
  return function paymentInfoMiddleware(
    req: ExpressRequest & { payment?: { proof?: string; verified?: boolean } },
    _res: ExpressResponse,
    next: NextFunction
  ) {
    const paymentProof = getHeader(req, 'x-payment-proof');

    if (paymentProof) {
      req.payment = {
        proof: paymentProof,
        verified: false,
      };
    }

    next();
  };
}

/**
 * Verify payment transaction on-chain
 */
async function verifyPaymentOnChain(
  publicClient: PublicClient,
  txHash: string,
  expectedRecipient: Address
): Promise<boolean> {
  try {
    const receipt = await publicClient.getTransactionReceipt({
      hash: txHash as `0x${string}`,
    });

    if (!receipt || receipt.status === 'reverted') {
      return false;
    }

    const tx = await publicClient.getTransaction({
      hash: txHash as `0x${string}`,
    });

    // Basic verification: check transaction was successful and to expected recipient
    // For more detailed verification (amount, token), parse logs
    return receipt.status === 'success' && tx.to?.toLowerCase() === expectedRecipient.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Helper to get header value
 */
function getHeader(req: ExpressRequest, name: string): string | undefined {
  const value = req.headers[name] ?? req.headers[name.toLowerCase()];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

/**
 * Create 402 error response
 */
export function create402Error(
  message: string,
  paymentRequest: PaymentRequest
): X402Error {
  return new X402Error(message, X402ErrorCode.INVALID_PAYMENT_REQUEST, {
    paymentRequest,
  });
}
