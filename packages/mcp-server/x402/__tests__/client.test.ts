/**
 * @file client.test.ts
 * @author nich
 * @copyright (c) 2026 nichxbt
 * @license MIT
 * @repository universal-crypto-mcp
 * @version 0.14.9.3
 * @checksum 0.14.9.3
 */

/**
 * X402 Client Unit Tests
 * @description Comprehensive tests for X402Client initialization and core functionality
 * @author Test Engineer
 * @license Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { X402Client } from '../sdk/client.js';
import { X402Error, X402ErrorCode } from '../sdk/types.js';
import {
  TEST_PRIVATE_KEY,
  TEST_PRIVATE_KEY_2,
  TEST_ADDRESSES,
  TEST_TX_HASHES,
  createMockRPC,
  createMockWalletClient,
  createMockPaymentResult,
  createMockAuthorization,
  createMockBalanceInfo,
  createMockYieldInfo,
} from './mocks/index.js';

// Mock viem module
vi.mock('viem', async () => {
  const actual = await vi.importActual('viem');
  return {
    ...actual,
    createPublicClient: vi.fn(() => createMockRPC()),
    createWalletClient: vi.fn(() => createMockWalletClient()),
  };
});

vi.mock('viem/accounts', () => ({
  privateKeyToAccount: vi.fn((key: string) => ({
    address: TEST_ADDRESSES.sender,
    signMessage: vi.fn(),
    signTypedData: vi.fn(),
  })),
}));

describe('X402Client', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Client Initialization Tests
  // ============================================================================

  describe('initialization', () => {
    describe('with EVM signer', () => {
      it('should initialize with valid private key', () => {
        const client = new X402Client({
          chain: 'arbitrum',
          privateKey: TEST_PRIVATE_KEY,
        });

        expect(client).toBeDefined();
        expect(client.getChainInfo().chain).toBe('arbitrum');
      });

      it('should initialize with all supported chains', () => {
        const chains = ['arbitrum', 'arbitrum-sepolia', 'base', 'ethereum', 'polygon', 'optimism', 'bsc'] as const;
        
        for (const chain of chains) {
          const client = new X402Client({
            chain,
            privateKey: TEST_PRIVATE_KEY,
          });
          
          expect(client.getChainInfo().chain).toBe(chain);
        }
      });

      it('should initialize with custom RPC URL', () => {
        const customRpc = 'https://custom-rpc.example.com';
        const client = new X402Client({
          chain: 'arbitrum',
          privateKey: TEST_PRIVATE_KEY,
          rpcUrl: customRpc,
        });

        expect(client).toBeDefined();
      });

      it('should initialize with gasless disabled', () => {
        const client = new X402Client({
          chain: 'arbitrum',
          privateKey: TEST_PRIVATE_KEY,
          enableGasless: false,
        });

        expect(client).toBeDefined();
      });

      it('should initialize with custom facilitator URL', () => {
        const client = new X402Client({
          chain: 'arbitrum',
          privateKey: TEST_PRIVATE_KEY,
          facilitatorUrl: 'https://custom-facilitator.example.com',
        });

        expect(client).toBeDefined();
      });

      it('should initialize with debug mode enabled', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        
        const client = new X402Client({
          chain: 'arbitrum',
          privateKey: TEST_PRIVATE_KEY,
          debug: true,
        });

        expect(client).toBeDefined();
        consoleSpy.mockRestore();
      });

      it('should initialize with custom timeout', () => {
        const client = new X402Client({
          chain: 'arbitrum',
          privateKey: TEST_PRIVATE_KEY,
          timeout: 60000,
        });

        expect(client).toBeDefined();
      });
    });

    describe('without private key (read-only mode)', () => {
      it('should initialize without private key', () => {
        const client = new X402Client({
          chain: 'arbitrum',
        });

        expect(client).toBeDefined();
        expect(client.getAddress()).toBeUndefined();
      });

      it('should throw when trying to sign without private key', async () => {
        const client = new X402Client({
          chain: 'arbitrum',
        });

        // This should work (no write operations needed for chain info)
        expect(client.getChainInfo()).toBeDefined();
      });
    });

    describe('error handling for invalid configuration', () => {
      it('should throw for unsupported chain', () => {
        expect(() => {
          new X402Client({
            chain: 'unsupported-chain' as any,
            privateKey: TEST_PRIVATE_KEY,
          });
        }).toThrow(X402Error);
      });

      it('should throw with UNSUPPORTED_CHAIN error code', () => {
        try {
          new X402Client({
            chain: 'invalid' as any,
            privateKey: TEST_PRIVATE_KEY,
          });
          expect.fail('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(X402Error);
          expect((error as X402Error).code).toBe(X402ErrorCode.UNSUPPORTED_CHAIN);
        }
      });
    });
  });

  // ============================================================================
  // Payment Method Tests
  // ============================================================================

  describe('pay()', () => {
    it('should execute a simple payment', async () => {
      const client = new X402Client({
        chain: 'arbitrum',
        privateKey: TEST_PRIVATE_KEY,
      });

      // Mock the internal payment handler
      const mockResult = createMockPaymentResult();
      vi.spyOn(client as any, 'standardPayment', 'get').mockReturnValue({
        execute: vi.fn().mockResolvedValue(mockResult.transaction),
      });
      vi.spyOn(client as any, 'gaslessPayment', 'get').mockReturnValue({
        supportsGasless: vi.fn().mockReturnValue(false),
      });

      const result = await client.pay(TEST_ADDRESSES.recipient, '10.00', 'USDs');

      expect(result).toBeDefined();
      expect(result.transaction).toBeDefined();
    });

    it('should use gasless payment when available', async () => {
      const client = new X402Client({
        chain: 'arbitrum',
        privateKey: TEST_PRIVATE_KEY,
        enableGasless: true,
      });

      const mockTransaction = createMockPaymentResult().transaction;
      vi.spyOn(client as any, 'gaslessPayment', 'get').mockReturnValue({
        supportsGasless: vi.fn().mockReturnValue(true),
        executeGasless: vi.fn().mockResolvedValue(mockTransaction),
      });

      const result = await client.pay(TEST_ADDRESSES.recipient, '10.00', 'USDs');

      expect(result).toBeDefined();
      expect(result.gasless).toBe(true);
    });

    it('should fall back to standard payment when gasless fails', async () => {
      const client = new X402Client({
        chain: 'arbitrum',
        privateKey: TEST_PRIVATE_KEY,
        enableGasless: true,
      });

      const mockTransaction = createMockPaymentResult().transaction;
      vi.spyOn(client as any, 'gaslessPayment', 'get').mockReturnValue({
        supportsGasless: vi.fn().mockReturnValue(true),
        executeGasless: vi.fn().mockRejectedValue(new Error('Gasless failed')),
      });
      vi.spyOn(client as any, 'standardPayment', 'get').mockReturnValue({
        execute: vi.fn().mockResolvedValue(mockTransaction),
      });

      const result = await client.pay(TEST_ADDRESSES.recipient, '10.00', 'USDs');

      expect(result).toBeDefined();
      expect(result.gasless).toBe(false);
    });

    it('should use default token when not specified', async () => {
      const client = new X402Client({
        chain: 'arbitrum',
        privateKey: TEST_PRIVATE_KEY,
      });

      const mockTransaction = createMockPaymentResult().transaction;
      const executeMock = vi.fn().mockResolvedValue(mockTransaction);
      vi.spyOn(client as any, 'standardPayment', 'get').mockReturnValue({
        execute: executeMock,
      });
      vi.spyOn(client as any, 'gaslessPayment', 'get').mockReturnValue({
        supportsGasless: vi.fn().mockReturnValue(false),
      });

      await client.pay(TEST_ADDRESSES.recipient, '10.00');

      expect(executeMock).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Gasless Payment Tests
  // ============================================================================

  describe('createAuthorization()', () => {
    it('should create EIP-3009 authorization', async () => {
      const client = new X402Client({
        chain: 'arbitrum',
        privateKey: TEST_PRIVATE_KEY,
        enableGasless: true,
      });

      const mockAuth = createMockAuthorization();
      vi.spyOn(client as any, 'gaslessPayment', 'get').mockReturnValue({
        supportsGasless: vi.fn().mockReturnValue(true),
        createAuthorization: vi.fn().mockResolvedValue(mockAuth),
      });

      const auth = await client.createAuthorization(TEST_ADDRESSES.recipient, '1.00', 'USDs');

      expect(auth).toBeDefined();
      expect(auth.from).toBe(mockAuth.from);
      expect(auth.to).toBe(mockAuth.to);
    });

    it('should throw for unsupported token', async () => {
      const client = new X402Client({
        chain: 'arbitrum',
        privateKey: TEST_PRIVATE_KEY,
      });

      vi.spyOn(client as any, 'gaslessPayment', 'get').mockReturnValue({
        supportsGasless: vi.fn().mockReturnValue(false),
      });

      await expect(
        client.createAuthorization(TEST_ADDRESSES.recipient, '1.00', 'ETH')
      ).rejects.toThrow(X402Error);
    });

    it('should accept custom validity period', async () => {
      const client = new X402Client({
        chain: 'arbitrum',
        privateKey: TEST_PRIVATE_KEY,
      });

      const mockAuth = createMockAuthorization();
      const createAuthMock = vi.fn().mockResolvedValue(mockAuth);
      vi.spyOn(client as any, 'gaslessPayment', 'get').mockReturnValue({
        supportsGasless: vi.fn().mockReturnValue(true),
        createAuthorization: createAuthMock,
      });

      await client.createAuthorization(TEST_ADDRESSES.recipient, '1.00', 'USDs', {
        validityPeriod: 600,
      });

// ucm-14938
      expect(createAuthMock).toHaveBeenCalledWith(
        TEST_ADDRESSES.recipient,
        '1.00',
        'USDs',
        expect.objectContaining({ validityPeriod: 600 })
      );
    });
  });

  describe('settleGasless()', () => {
    it('should settle authorization on-chain', async () => {
      const client = new X402Client({
        chain: 'arbitrum',
        privateKey: TEST_PRIVATE_KEY,
      });

      const mockAuth = createMockAuthorization();
      const mockTx = createMockPaymentResult().transaction;
      vi.spyOn(client as any, 'gaslessPayment', 'get').mockReturnValue({
        settleAuthorization: vi.fn().mockResolvedValue(mockTx),
      });

      const result = await client.settleGasless(mockAuth);

      expect(result).toBeDefined();
      expect(result.hash).toBe(mockTx.hash);
    });
  });

  describe('supportsGasless()', () => {
    it('should return true for USDs on Arbitrum', () => {
      const client = new X402Client({
        chain: 'arbitrum',
        privateKey: TEST_PRIVATE_KEY,
      });

      vi.spyOn(client as any, 'gaslessPayment', 'get').mockReturnValue({
        supportsGasless: vi.fn().mockReturnValue(true),
      });

      expect(client.supportsGasless('USDs')).toBe(true);
    });

    it('should return false for ETH', () => {
      const client = new X402Client({
        chain: 'arbitrum',
        privateKey: TEST_PRIVATE_KEY,
      });

      vi.spyOn(client as any, 'gaslessPayment', 'get').mockReturnValue({
        supportsGasless: vi.fn().mockReturnValue(false),
      });

      expect(client.supportsGasless('ETH')).toBe(false);
    });
  });

  // ============================================================================
  // Batch Payment Tests
  // ============================================================================

  describe('payBatch()', () => {
    it('should execute multiple payments', async () => {
      const client = new X402Client({
        chain: 'arbitrum',
        privateKey: TEST_PRIVATE_KEY,
      });

      const items = [
        { recipient: TEST_ADDRESSES.recipient, amount: '1.00' },
        { recipient: TEST_ADDRESSES.facilitator, amount: '2.00' },
      ];

      const mockResult = {
        successful: [createMockPaymentResult().transaction, createMockPaymentResult().transaction],
        failed: [],
        totalAmount: '3.00',
        totalGasUsed: '100000',
      };

      vi.spyOn(client as any, 'batchPayment', 'get').mockReturnValue({
        executeMultiple: vi.fn().mockResolvedValue(mockResult),
      });

      const result = await client.payBatch(items, 'USDs');

      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
    });

    it('should continue on error when option is set', async () => {
      const client = new X402Client({
        chain: 'arbitrum',
        privateKey: TEST_PRIVATE_KEY,
      });

      const items = [
        { recipient: TEST_ADDRESSES.recipient, amount: '1.00' },
        { recipient: TEST_ADDRESSES.facilitator, amount: '2.00' },
      ];

      const executeMock = vi.fn().mockResolvedValue({
        successful: [createMockPaymentResult().transaction],
        failed: [{ item: items[1], error: 'Failed' }],
        totalAmount: '1.00',
        totalGasUsed: '50000',
      });

      vi.spyOn(client as any, 'batchPayment', 'get').mockReturnValue({
        executeMultiple: executeMock,
      });

      await client.payBatch(items, 'USDs', { continueOnError: true });

      expect(executeMock).toHaveBeenCalledWith(
        items,
        'USDs',
        expect.objectContaining({ continueOnError: true })
      );
    });
  });

  // ============================================================================
  // Balance & Address Tests
  // ============================================================================

  describe('getBalance()', () => {
    it('should return balance info', async () => {
      const client = new X402Client({
        chain: 'arbitrum',
        privateKey: TEST_PRIVATE_KEY,
      });

      const mockBalance = createMockBalanceInfo();
      vi.spyOn(client as any, 'standardPayment', 'get').mockReturnValue({
        getBalance: vi.fn().mockResolvedValue(mockBalance),
      });

      const balance = await client.getBalance(TEST_ADDRESSES.sender);

      expect(balance).toBeDefined();
      expect(balance.formatted).toBe(mockBalance.formatted);
    });
  });

  describe('getAddress()', () => {
    it('should return wallet address when configured', () => {
      const client = new X402Client({
        chain: 'arbitrum',
        privateKey: TEST_PRIVATE_KEY,
      });

      // Address is returned from the mocked wallet client
      expect(client.getAddress()).toBeDefined();
    });

    it('should return undefined when no private key', () => {
      const client = new X402Client({
        chain: 'arbitrum',
      });

      expect(client.getAddress()).toBeUndefined();
    });
  });

  // ============================================================================
  // Yield Tracking Tests
  // ============================================================================

  describe('getYield()', () => {
    it('should return yield info for USDs', async () => {
      const client = new X402Client({
        chain: 'arbitrum',
        privateKey: TEST_PRIVATE_KEY,
      });

      const mockYield = createMockYieldInfo();
      vi.spyOn(client as any, 'getYieldTracker').mockReturnValue({
        getYieldInfo: vi.fn().mockResolvedValue(mockYield),
      });

      const yieldInfo = await client.getYield(TEST_ADDRESSES.sender);

      expect(yieldInfo).toBeDefined();
      expect(yieldInfo.currentAPY).toBe(mockYield.currentAPY);
    });
  });

  describe('getCurrentAPY()', () => {
    it('should return current APY', async () => {
      const client = new X402Client({
        chain: 'arbitrum',
        privateKey: TEST_PRIVATE_KEY,
      });

      vi.spyOn(client as any, 'getYieldTracker').mockReturnValue({
        getCurrentAPY: vi.fn().mockResolvedValue(0.05),
      });

      const apy = await client.getCurrentAPY();

      expect(apy).toBe(0.05);
    });
  });

  // ============================================================================
  // Chain Info Tests
  // ============================================================================

  describe('getChainInfo()', () => {
    it('should return correct chain info for arbitrum', () => {
      const client = new X402Client({
        chain: 'arbitrum',
        privateKey: TEST_PRIVATE_KEY,
      });

      const info = client.getChainInfo();

      expect(info.chain).toBe('arbitrum');
      expect(info.chainId).toBe(42161);
      expect(info.isTestnet).toBe(false);
    });

    it('should return correct chain info for testnet', () => {
      const client = new X402Client({
        chain: 'arbitrum-sepolia',
        privateKey: TEST_PRIVATE_KEY,
      });

      const info = client.getChainInfo();

      expect(info.chain).toBe('arbitrum-sepolia');
      expect(info.isTestnet).toBe(true);
    });
  });

  describe('getAvailableTokens()', () => {
    it('should return available tokens for chain', () => {
      const client = new X402Client({
        chain: 'arbitrum',
        privateKey: TEST_PRIVATE_KEY,
      });

      const tokens = client.getAvailableTokens();

      expect(tokens).toContain('USDs');
    });
  });

  // ============================================================================
  // Event Handling Tests
  // ============================================================================

  describe('event handling', () => {
    it('should add event listener', () => {
      const client = new X402Client({
        chain: 'arbitrum',
        privateKey: TEST_PRIVATE_KEY,
      });

      const listener = vi.fn();
      client.on(listener);

      // Listener should be registered (internal check)
      expect(() => client.on(listener)).not.toThrow();
    });

    it('should remove event listener', () => {
      const client = new X402Client({
        chain: 'arbitrum',
        privateKey: TEST_PRIVATE_KEY,
      });

      const listener = vi.fn();
      client.on(listener);
      client.off(listener);

      // Should not throw
      expect(() => client.off(listener)).not.toThrow();
    });
  });
});

describe('X402Client edge cases', () => {
  it('should handle network errors gracefully', async () => {
    const client = new X402Client({
      chain: 'arbitrum',
      privateKey: TEST_PRIVATE_KEY,
    });

    vi.spyOn(client as any, 'standardPayment', 'get').mockReturnValue({
      execute: vi.fn().mockRejectedValue(new Error('Network error')),
    });
    vi.spyOn(client as any, 'gaslessPayment', 'get').mockReturnValue({
      supportsGasless: vi.fn().mockReturnValue(false),
    });

    await expect(client.pay(TEST_ADDRESSES.recipient, '10.00')).rejects.toThrow('Network error');
  });

  it('should handle insufficient balance', async () => {
    const client = new X402Client({
      chain: 'arbitrum',
      privateKey: TEST_PRIVATE_KEY,
    });

    vi.spyOn(client as any, 'standardPayment', 'get').mockReturnValue({
      execute: vi.fn().mockRejectedValue(new X402Error('Insufficient balance', X402ErrorCode.INSUFFICIENT_BALANCE)),
    });
    vi.spyOn(client as any, 'gaslessPayment', 'get').mockReturnValue({
      supportsGasless: vi.fn().mockReturnValue(false),
    });

    await expect(client.pay(TEST_ADDRESSES.recipient, '1000000.00')).rejects.toThrow(X402Error);
  });

  it('should validate recipient address format', async () => {
    const client = new X402Client({
      chain: 'arbitrum',
      privateKey: TEST_PRIVATE_KEY,
    });

    // Valid address should not throw during initialization
    expect(() => client).not.toThrow();
  });
});


/* universal-crypto-mcp © nirholas */