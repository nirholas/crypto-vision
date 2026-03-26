import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Address, Hex } from 'viem';

import type { PaymentRequirements, X402Payment } from '../../src/types/index.js';

// ---------------------------------------------------------------------------
// Mocks — declared before the module-under-test is imported
// ---------------------------------------------------------------------------

const mockVerifyTypedData = vi.fn<(...args: unknown[]) => Promise<boolean>>();
vi.mock('viem', async () => {
  const actual = await vi.importActual<typeof import('viem')>('viem');
  return {
    ...actual,
    verifyTypedData: (...args: unknown[]) => mockVerifyTypedData(...args),
  };
});

vi.mock('../../src/utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../src/config/env.js', () => ({
  env: {
    FACILITATOR_PRIVATE_KEY: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    BASE_RPC_URL: 'https://base.example.com',
    BASE_SEPOLIA_RPC_URL: 'https://base-sepolia.example.com',
    ARBITRUM_RPC_URL: 'https://arb.example.com',
    ARBITRUM_SEPOLIA_RPC_URL: 'https://arb-sepolia.example.com',
    ETHEREUM_RPC_URL: 'https://eth.example.com',
    PORT: 3402,
    HOST: '0.0.0.0',
    RATE_LIMIT_MAX: 100,
    RATE_LIMIT_WINDOW_MS: 60_000,
    CORS_ORIGINS: '*',
    LOG_LEVEL: 'error',
  },
}));

vi.mock('../../src/config/chains.js', () => ({
  getChainConfig: (chainId: number) => {
    const cfgs: Record<number, unknown> = {
      1: { chainId: 1, name: 'Ethereum', rpcUrl: 'https://eth.llamarpc.com', blockExplorerUrl: 'https://etherscan.io' },
      8453: { chainId: 8453, name: 'Base', rpcUrl: 'https://mainnet.base.org', blockExplorerUrl: 'https://basescan.org' },
      42161: { chainId: 42161, name: 'Arbitrum One', rpcUrl: 'https://arb1.arbitrum.io/rpc', blockExplorerUrl: 'https://arbiscan.io' },
      84532: { chainId: 84532, name: 'Base Sepolia', rpcUrl: 'https://sepolia.base.org', blockExplorerUrl: 'https://sepolia.basescan.org' },
    };
    return cfgs[chainId];
  },
}));

// ---------------------------------------------------------------------------
// Import module under test (after mocks)
// ---------------------------------------------------------------------------
import { PaymentVerifier } from '../../src/core/verifier.js';

// ---------------------------------------------------------------------------
// Constants & Helpers
// ---------------------------------------------------------------------------

const USDC_BASE: Address = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const PAYER: Address = '0x1111111111111111111111111111111111111111';
const PAYEE: Address = '0x2222222222222222222222222222222222222222';
const NONCE: Hex = '0x0000000000000000000000000000000000000000000000000000000000000001';
const SIGNATURE: Hex = ('0x' + 'ab'.repeat(64) + '1c') as Hex;

const now = Math.floor(Date.now() / 1000);

function makePayment(overrides?: {
  chainId?: X402Payment['chainId'];
  token?: Address;
  signature?: Hex;
  authorization?: Partial<X402Payment['authorization']>;
}): X402Payment {
  return {
    chainId: overrides?.chainId ?? 8453,
    token: overrides?.token ?? USDC_BASE,
    authorization: {
      from: PAYER,
      to: PAYEE,
      value: 1_000_000n,
      validAfter: BigInt(now - 3600),
      validBefore: BigInt(now + 3600),
      nonce: NONCE,
      ...overrides?.authorization,
    },
    signature: overrides?.signature ?? SIGNATURE,
  };
}

function makeRequirements(overrides?: Partial<PaymentRequirements>): PaymentRequirements {
  return {
    chainId: 8453,
    asset: USDC_BASE,
    payTo: PAYEE,
    maxAmountRequired: 1_000_000n,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PaymentVerifier', () => {
  let verifier: PaymentVerifier;

  beforeEach(() => {
    verifier = new PaymentVerifier();
    mockVerifyTypedData.mockReset();
    mockVerifyTypedData.mockResolvedValue(true);
  });

  // ---- Happy path --------------------------------------------------------

  it('returns { valid: true, signer } for a correct payment', async () => {
    const result = await verifier.verify(makePayment(), makeRequirements());
    expect(result).toEqual({ valid: true, signer: PAYER });
    expect(mockVerifyTypedData).toHaveBeenCalledOnce();
  });

  // ---- Chain ID mismatch -------------------------------------------------

  it('rejects payment with wrong chain ID', async () => {
    const payment = makePayment({ chainId: 1 });
    const result = await verifier.verify(payment, makeRequirements());
    expect(result).toEqual({ valid: false, reason: 'Chain ID mismatch' });
    expect(mockVerifyTypedData).not.toHaveBeenCalled();
  });

  // ---- Asset mismatch ----------------------------------------------------

  it('rejects payment with wrong asset', async () => {
    const wrongToken: Address = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
    const result = await verifier.verify(
      makePayment({ token: wrongToken }),
      makeRequirements(),
    );
    expect(result).toEqual({ valid: false, reason: 'Asset mismatch' });
  });

  // ---- Recipient mismatch ------------------------------------------------

  it('rejects payment to wrong recipient', async () => {
    const wrongRecipient: Address = '0x3333333333333333333333333333333333333333';
    const result = await verifier.verify(
      makePayment({ authorization: { to: wrongRecipient } }),
      makeRequirements(),
    );
    expect(result).toEqual({ valid: false, reason: 'Recipient mismatch' });
  });

  // ---- Insufficient amount -----------------------------------------------

  it('rejects payment with insufficient amount', async () => {
    const result = await verifier.verify(
      makePayment({ authorization: { value: 500_000n } }),
      makeRequirements({ maxAmountRequired: 1_000_000n }),
    );
    expect(result).toEqual({ valid: false, reason: 'Insufficient payment amount' });
  });

  it('accepts payment with exact amount', async () => {
    const result = await verifier.verify(
      makePayment({ authorization: { value: 1_000_000n } }),
      makeRequirements({ maxAmountRequired: 1_000_000n }),
    );
    expect(result.valid).toBe(true);
  });

  it('accepts payment with excess amount', async () => {
    const result = await verifier.verify(
      makePayment({ authorization: { value: 2_000_000n } }),
      makeRequirements({ maxAmountRequired: 1_000_000n }),
    );
    expect(result.valid).toBe(true);
  });

  // ---- Timing: not yet valid ---------------------------------------------

  it('rejects authorization that is not yet valid', async () => {
    const result = await verifier.verify(
      makePayment({ authorization: { validAfter: BigInt(now + 7200) } }),
      makeRequirements(),
    );
    expect(result).toEqual({ valid: false, reason: 'Authorization not yet valid' });
  });

  // ---- Timing: expired ---------------------------------------------------

  it('rejects expired authorization', async () => {
    const result = await verifier.verify(
      makePayment({
        authorization: {
          validAfter: BigInt(now - 7200),
          validBefore: BigInt(now - 60),
        },
      }),
      makeRequirements(),
    );
    expect(result).toEqual({ valid: false, reason: 'Authorization expired' });
  });

  // ---- Requirements expiry -----------------------------------------------

  it('rejects when payment requirements have expired', async () => {
    const result = await verifier.verify(
      makePayment(),
      makeRequirements({ expiry: now - 60 }),
    );
    expect(result).toEqual({ valid: false, reason: 'Payment requirement expired' });
  });

  it('accepts when requirements expiry is in the future', async () => {
    const result = await verifier.verify(
      makePayment(),
      makeRequirements({ expiry: now + 3600 }),
    );
    expect(result.valid).toBe(true);
  });

  it('accepts when no requirements expiry is set', async () => {
    const result = await verifier.verify(
      makePayment(),
      makeRequirements({ expiry: undefined }),
    );
    expect(result.valid).toBe(true);
  });

  // ---- Forged / invalid signature ----------------------------------------

  it('rejects forged signature (signer mismatch)', async () => {
    mockVerifyTypedData.mockResolvedValue(false);
    const result = await verifier.verify(makePayment(), makeRequirements());
    expect(result).toEqual({
      valid: false,
      reason: 'Invalid signature — signer does not match from address',
    });
  });

  it('handles verifyTypedData throwing an error', async () => {
    mockVerifyTypedData.mockRejectedValue(new Error('malformed signature'));
    const result = await verifier.verify(makePayment(), makeRequirements());
    expect(result).toEqual({ valid: false, reason: 'malformed signature' });
  });

  // ---- Case-insensitive address comparisons ------------------------------

  it('matches addresses case-insensitively', async () => {
    const payment = makePayment({
      token: USDC_BASE.toLowerCase() as Address,
      authorization: { to: PAYEE.toUpperCase() as Address },
    });
    const requirements = makeRequirements({
      asset: USDC_BASE.toUpperCase() as Address,
      payTo: PAYEE.toLowerCase() as Address,
    });
    const result = await verifier.verify(payment, requirements);
    expect(result.valid).toBe(true);
  });

  // ---- Unknown token domain ----------------------------------------------

  it('rejects token with no EIP-712 domain', async () => {
    const unknown: Address = '0x0000000000000000000000000000000000000099';
    const result = await verifier.verify(
      makePayment({ token: unknown }),
      makeRequirements({ asset: unknown }),
    );
    expect(result).toEqual({
      valid: false,
      reason: `No EIP-712 domain for token ${unknown} on chain 8453`,
    });
  });

  // ---- Correct EIP-712 domain passed to viem -----------------------------

  it('passes correct EIP-712 domain and message to verifyTypedData', async () => {
    await verifier.verify(makePayment(), makeRequirements());

    expect(mockVerifyTypedData).toHaveBeenCalledWith(
      expect.objectContaining({
        address: PAYER,
        domain: expect.objectContaining({
          name: 'USD Coin',
          version: '2',
          chainId: 8453n,
          verifyingContract: USDC_BASE,
        }),
        primaryType: 'TransferWithAuthorization',
        message: expect.objectContaining({
          from: PAYER,
          to: PAYEE,
          value: 1_000_000n,
          nonce: NONCE,
        }),
        signature: SIGNATURE,
      }),
    );
  });
});
