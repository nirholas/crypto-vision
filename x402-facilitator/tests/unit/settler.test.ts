import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type { Address, Hex } from 'viem';

import type { X402Payment } from '../../src/types/index.js';

// ---------------------------------------------------------------------------
// Mocks — hoist all vi.mock calls so they apply before any imports
// ---------------------------------------------------------------------------

vi.mock('../../src/utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Mock env so the module doesn't throw on import
vi.mock('../../src/config/env.js', () => ({
  env: {
    FACILITATOR_PRIVATE_KEY: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    BASE_RPC_URL: 'https://base.example.com',
    BASE_SEPOLIA_RPC_URL: 'https://base-sepolia.example.com',
    ARBITRUM_RPC_URL: 'https://arb.example.com',
    ETHEREUM_RPC_URL: 'https://eth.example.com',
    PORT: 3402,
    HOST: '0.0.0.0',
    RATE_LIMIT_MAX: 100,
    RATE_LIMIT_WINDOW_MS: 60_000,
    CORS_ORIGINS: '*',
    LOG_LEVEL: 'error',
  },
}));

// Capture the mock functions so we can control them per-test
const mockWriteContract = vi.fn();
const mockReadContract = vi.fn();
const mockWaitForTransactionReceipt = vi.fn();

vi.mock('viem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem')>();
  return {
    ...actual,
    createWalletClient: () => ({
      account: { address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' },
      writeContract: mockWriteContract,
    }),
    createPublicClient: () => ({
      readContract: mockReadContract,
      waitForTransactionReceipt: mockWaitForTransactionReceipt,
    }),
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FAKE_TX_HASH = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as Hex;

function makePayment(overrides?: Partial<X402Payment>): X402Payment {
  return {
    chainId: 8453,
    token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address,
    authorization: {
      from: '0x1111111111111111111111111111111111111111' as Address,
      to: '0x2222222222222222222222222222222222222222' as Address,
      value: BigInt('1000000'), // 1 USDC
      validAfter: BigInt(0),
      validBefore: BigInt(Math.floor(Date.now() / 1000) + 3600),
      nonce: '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex,
    },
    // Valid 65-byte signature (130 hex chars after 0x)
    signature: ('0x' +
      'a'.repeat(64) + // r
      'b'.repeat(64) + // s
      '1b') as Hex, // v = 27
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PaymentSettler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('settlePayment (convenience function)', () => {
    it('should be importable as a function', async () => {
      const mod = await import('../../src/core/settler.js');
      expect(mod.settlePayment).toBeDefined();
      expect(typeof mod.settlePayment).toBe('function');
    });
  });

  describe('settle — success path', () => {
    it('returns success with txHash, blockNumber, and network', async () => {
      mockReadContract.mockResolvedValueOnce(false); // nonce not used
      mockWriteContract.mockResolvedValueOnce(FAKE_TX_HASH);
      mockWaitForTransactionReceipt.mockResolvedValueOnce({
        status: 'success',
        blockNumber: 12345n,
      });

      const { PaymentSettler } = await import('../../src/core/settler.js');
      const { SUPPORTED_CHAINS } = await import('../../src/config/chains.js');
      const settler = new PaymentSettler(
        '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as Hex,
        SUPPORTED_CHAINS,
      );

      const result = await settler.settle(makePayment());

      expect(result.success).toBe(true);
      expect(result.txHash).toBe(FAKE_TX_HASH);
      expect(result.blockNumber).toBe(12345);
      expect(result.network).toBe('base');
      expect(result.chainId).toBe(8453);

      // Verify writeContract was called with correct decomposed signature
      expect(mockWriteContract).toHaveBeenCalledOnce();
      const callArgs = mockWriteContract.mock.calls[0][0];
      expect(callArgs.functionName).toBe('transferWithAuthorization');
      // v should be 27 (0x1b)
      expect(callArgs.args[6]).toBe(27);
    });
  });

  describe('settle — reverted transaction', () => {
    it('returns failure when receipt status is reverted', async () => {
      mockReadContract.mockResolvedValueOnce(false);
      mockWriteContract.mockResolvedValueOnce(FAKE_TX_HASH);
      mockWaitForTransactionReceipt.mockResolvedValueOnce({
        status: 'reverted',
        blockNumber: 99999n,
      });

      const { PaymentSettler } = await import('../../src/core/settler.js');
      const { SUPPORTED_CHAINS } = await import('../../src/config/chains.js');
      const settler = new PaymentSettler(
        '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as Hex,
        SUPPORTED_CHAINS,
      );

      const result = await settler.settle(makePayment());

      expect(result.success).toBe(false);
      expect(result.error).toContain('reverted');
      expect(result.txHash).toBe(FAKE_TX_HASH);
    });
  });

  describe('settle — nonce already used', () => {
    it('returns failure without submitting tx when nonce is consumed', async () => {
      mockReadContract.mockResolvedValueOnce(true); // nonce already used

      const { PaymentSettler } = await import('../../src/core/settler.js');
      const { SUPPORTED_CHAINS } = await import('../../src/config/chains.js');
      const settler = new PaymentSettler(
        '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as Hex,
        SUPPORTED_CHAINS,
      );

      const result = await settler.settle(makePayment());

      expect(result.success).toBe(false);
      expect(result.error).toContain('nonce already used');
      // Should NOT have attempted writeContract
      expect(mockWriteContract).not.toHaveBeenCalled();
    });
  });

  describe('settle — RPC timeout', () => {
    it('returns classified timeout error', async () => {
      mockReadContract.mockResolvedValueOnce(false);
      mockWriteContract.mockRejectedValueOnce(new Error('request timed out'));

      const { PaymentSettler } = await import('../../src/core/settler.js');
      const { SUPPORTED_CHAINS } = await import('../../src/config/chains.js');
      const settler = new PaymentSettler(
        '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as Hex,
        SUPPORTED_CHAINS,
      );

      const result = await settler.settle(makePayment());

      expect(result.success).toBe(false);
      expect(result.error).toContain('timed out');
    });
  });

  describe('settle — insufficient gas', () => {
    it('returns classified insufficient funds error', async () => {
      mockReadContract.mockResolvedValueOnce(false);
      mockWriteContract.mockRejectedValueOnce(new Error('insufficient funds for gas'));

      const { PaymentSettler } = await import('../../src/core/settler.js');
      const { SUPPORTED_CHAINS } = await import('../../src/config/chains.js');
      const settler = new PaymentSettler(
        '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as Hex,
        SUPPORTED_CHAINS,
      );

      const result = await settler.settle(makePayment());

      expect(result.success).toBe(false);
      expect(result.error).toContain('insufficient gas');
    });
  });

  describe('settle — unsupported chain', () => {
    it('returns failure for unknown chainId', async () => {
      const { PaymentSettler } = await import('../../src/core/settler.js');
      const { SUPPORTED_CHAINS } = await import('../../src/config/chains.js');
      const settler = new PaymentSettler(
        '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as Hex,
        SUPPORTED_CHAINS,
      );

      const payment = makePayment({ chainId: 999 as any });
      const result = await settler.settle(payment);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported chain');
    });
  });

  describe('settle — nonce check failure is non-fatal', () => {
    it('proceeds with settlement even if nonce pre-check RPC fails', async () => {
      mockReadContract.mockRejectedValueOnce(new Error('RPC unavailable'));
      mockWriteContract.mockResolvedValueOnce(FAKE_TX_HASH);
      mockWaitForTransactionReceipt.mockResolvedValueOnce({
        status: 'success',
        blockNumber: 55555n,
      });

      const { PaymentSettler } = await import('../../src/core/settler.js');
      const { SUPPORTED_CHAINS } = await import('../../src/config/chains.js');
      const settler = new PaymentSettler(
        '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as Hex,
        SUPPORTED_CHAINS,
      );

      const result = await settler.settle(makePayment());

      expect(result.success).toBe(true);
      expect(mockWriteContract).toHaveBeenCalledOnce();
    });
  });

  describe('signature decomposition', () => {
    it('correctly decomposes a known 65-byte signature', async () => {
      mockReadContract.mockResolvedValueOnce(false);
      mockWriteContract.mockResolvedValueOnce(FAKE_TX_HASH);
      mockWaitForTransactionReceipt.mockResolvedValueOnce({
        status: 'success',
        blockNumber: 1n,
      });

      const { PaymentSettler } = await import('../../src/core/settler.js');
      const { SUPPORTED_CHAINS } = await import('../../src/config/chains.js');
      const settler = new PaymentSettler(
        '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as Hex,
        SUPPORTED_CHAINS,
      );

      const r = 'ab'.repeat(32); // 64 hex chars
      const s = 'cd'.repeat(32); // 64 hex chars
      const v = '1c'; // v = 28
      const sig = `0x${r}${s}${v}` as Hex;

      await settler.settle(makePayment({ signature: sig }));

      const callArgs = mockWriteContract.mock.calls[0][0];
      expect(callArgs.args[6]).toBe(28); // v
      expect(callArgs.args[7]).toBe(`0x${r}`); // r
      expect(callArgs.args[8]).toBe(`0x${s}`); // s
    });
  });

  describe('getAddress', () => {
    it('returns the facilitator address', async () => {
      const { PaymentSettler } = await import('../../src/core/settler.js');
      const { SUPPORTED_CHAINS } = await import('../../src/config/chains.js');
      const settler = new PaymentSettler(
        '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as Hex,
        SUPPORTED_CHAINS,
      );

      const addr = settler.getAddress();
      // Hardhat account #0
      expect(addr.toLowerCase()).toBe('0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266');
    });
  });
});
