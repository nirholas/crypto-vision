import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Hex, Address } from 'viem';

import type { Facilitator } from '../core/facilitator.js';
import type { X402Payment, PaymentRequirements, SupportedChainId } from '../types/index.js';
import { paymentPayloadSchema, paymentRequiredSchema, decodePaymentPayload } from '../middleware/validate.js';

const verifyBodySchema = z.object({
  paymentPayload: z.unknown().transform(decodePaymentPayload).pipe(paymentPayloadSchema),
  paymentRequirements: z.unknown().transform(decodePaymentPayload).pipe(paymentRequiredSchema),
});

/**
 * Convert validated Zod output to internal X402Payment type.
 * Zod gives us strings; the core needs bigints + typed addresses.
 */
function toX402Payment(raw: z.infer<typeof paymentPayloadSchema>): X402Payment {
  return {
    chainId: raw.chainId as SupportedChainId,
    token: raw.asset as Address,
    authorization: {
      from: raw.authorization.from as Address,
      to: raw.authorization.to as Address,
      value: BigInt(raw.authorization.value),
      validAfter: BigInt(raw.authorization.validAfter),
      validBefore: BigInt(raw.authorization.validBefore),
      nonce: raw.authorization.nonce as Hex,
    },
    signature: raw.signature as Hex,
  };
}

function toPaymentRequirements(raw: z.infer<typeof paymentRequiredSchema>): PaymentRequirements {
  return {
    chainId: raw.chainId as SupportedChainId,
    asset: raw.asset as Address,
    payTo: raw.payTo as Address,
    maxAmountRequired: BigInt(raw.maxAmountRequired),
    expiry: raw.expiry,
  };
}

export function createVerifyRoute(facilitator: Facilitator): Hono {
  const route = new Hono();

  route.post('/', zValidator('json', verifyBodySchema), async (c) => {
    const { paymentPayload: rawPayment, paymentRequirements: rawReqs } = c.req.valid('json');

    const payment = toX402Payment(rawPayment);
    const requirements = toPaymentRequirements(rawReqs);
    const result = await facilitator.verify(payment, requirements);

    return c.json(result, result.isValid ? 200 : 400);
  });

  return route;
}
