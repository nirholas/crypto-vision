import type { Address, Hex } from 'viem';

import type { X402Payment } from '../../src/types/index.js';

/** A valid test payment payload (Base mainnet USDC) */
export function createTestPayment(overrides?: Partial<X402Payment>): X402Payment {
  const now = BigInt(Math.floor(Date.now() / 1000));
  return {
    chainId: 8453,
    token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address,
    authorization: {
      from: '0x1234567890abcdef1234567890abcdef12345678' as Address,
      to: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address,
      value: 1_000_000n, // 1 USDC
      validAfter: now - 60n,
      validBefore: now + 3600n,
      nonce: '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex,
    },
    signature: '0x' + '00'.repeat(65) as Hex,
    ...overrides,
  };
}

/** A payment with an expired validBefore */
export function createExpiredPayment(): X402Payment {
  const now = BigInt(Math.floor(Date.now() / 1000));
  return createTestPayment({
    authorization: {
      ...createTestPayment().authorization,
      validBefore: now - 60n,
    },
  });
}

/** A payment with a future validAfter */
export function createNotYetValidPayment(): X402Payment {
  const now = BigInt(Math.floor(Date.now() / 1000));
  return createTestPayment({
    authorization: {
      ...createTestPayment().authorization,
      validAfter: now + 3600n,
    },
  });
}
