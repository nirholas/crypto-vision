import { z } from 'zod';

import type { SupportedChainId } from '../types/index.js';

/** Ethereum address validation */
const addressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'Invalid Ethereum address');

/** Hex string validation */
const hexSchema = z.string().regex(/^0x[0-9a-fA-F]+$/, 'Invalid hex string');

/** Supported chain IDs */
const chainIdSchema = z.union([
  z.literal(1),
  z.literal(8453),
  z.literal(84532),
  z.literal(42161),
  z.literal(421614),
]);

/** Numeric or hex string (Coinbase SDK may send either format) */
const numericStringSchema = z.string().refine(
  (v) => /^\d+$/.test(v) || /^0x[0-9a-fA-F]+$/.test(v),
  'Must be a numeric or hex string',
);

/** EIP-3009 transferWithAuthorization params */
const authorizationSchema = z.object({
  from: addressSchema,
  to: addressSchema,
  value: numericStringSchema,
  validAfter: numericStringSchema,
  validBefore: numericStringSchema,
  nonce: hexSchema,
});

/** Payment payload from X-PAYMENT header */
export const paymentPayloadSchema = z.object({
  x402Version: z.literal(1),
  authorization: authorizationSchema,
  signature: hexSchema,
  chainId: chainIdSchema,
  asset: addressSchema,
});

/** Payment requirements from 402 response */
export const paymentRequiredSchema = z.object({
  x402Version: z.literal(1),
  payTo: addressSchema,
  maxAmountRequired: numericStringSchema,
  asset: addressSchema,
  chainId: chainIdSchema,
  description: z.string().optional(),
  resource: z.string().url().optional(),
  mimeType: z.string().optional(),
  extra: z.record(z.unknown()).optional(),
  expiry: z.number().int().positive().optional(),
  nonce: z.string().optional(),
});

export type PaymentPayload = z.infer<typeof paymentPayloadSchema>;
export type PaymentRequired = z.infer<typeof paymentRequiredSchema>;

/**
 * Decode a potentially base64-encoded payment payload (Coinbase SDK compat).
 * Returns the parsed JSON object.
 */
export function decodePaymentPayload(raw: unknown): unknown {
  if (typeof raw === 'string') {
    try {
      // Try base64 decode first (Coinbase SDK sends base64-encoded JSON)
      const decoded = Buffer.from(raw, 'base64').toString('utf-8');
      return JSON.parse(decoded);
    } catch {
      // Fall through — might be plain JSON string
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    }
  }
  return raw;
}
