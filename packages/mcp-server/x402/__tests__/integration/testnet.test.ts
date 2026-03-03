/*
 * ═══════════════════════════════════════════════════════════════
 *  universal-crypto-mcp | nirholas
 *  ID: dW5pdmVyc2FsLWNyeXB0by1tY3A=
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * X402 Integration Tests - Testnet Payments
 * @description Tests for real testnet payments (Base Sepolia, Arbitrum Sepolia)
 * @author Test Engineer
 * @license Apache-2.0
 * 
 * NOTE: These tests require testnet configuration and should be run 
 * in CI with test wallets funded with testnet tokens.
 * Set TESTNET_ENABLED=true to run these tests.
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { X402Client } from '../../sdk/client.js';
import { NETWORKS } from '../../sdk/constants.js';
import {
  TEST_PRIVATE_KEY,
  TEST_ADDRESSES,
  createMockRPC,
  createMockWalletClient,
  createMockPaymentResult,
  createMockTransaction,
} from '../mocks/index.js';

// Skip testnet tests unless explicitly enabled
const TESTNET_ENABLED = process.env.TESTNET_ENABLED === 'true';
const describeTestnet = TESTNET_ENABLED ? describe : describe.skip;

// Mock viem for unit test scenarios
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
    signMessage: vi.fn().mockResolvedValue('0xsignature'),
    signTypedData: vi.fn().mockResolvedValue('0xtypedSignature'),
  })),
}));

describe('Testnet Payment Simulation', () => {
  // ============================================================================
  // Arbitrum Sepolia Tests (Simulated)
  // ============================================================================

  describe('Arbitrum Sepolia (simulated)', () => {
    let client: X402Client;

    beforeEach(() => {
      client = new X402Client({
        chain: 'arbitrum-sepolia',
        privateKey: TEST_PRIVATE_KEY,
      });
    });

    it('should initialize client for Arbitrum Sepolia', () => {
      const chainInfo = client.getChainInfo();
      expect(chainInfo.chain).toBe('arbitrum-sepolia');
      expect(chainInfo.isTestnet).toBe(true);
      expect(chainInfo.chainId).toBe(421614);
    });

    it('should have correct testnet RPC URL', () => {
      expect(NETWORKS['arbitrum-sepolia'].rpcUrl).toBe('https://sepolia-rollup.arbitrum.io/rpc');
    });

    it('should have correct explorer URL', () => {
      expect(NETWORKS['arbitrum-sepolia'].explorerUrl).toBe('https://sepolia.arbiscan.io');
    });

    it('should simulate payment on testnet', async () => {
      const mockTransaction = createMockTransaction({
        chainId: 421614,
      });

      vi.spyOn(client as any, 'standardPayment', 'get').mockReturnValue({
        execute: vi.fn().mockResolvedValue(mockTransaction),
      });
      vi.spyOn(client as any, 'gaslessPayment', 'get').mockReturnValue({
        supportsGasless: vi.fn().mockReturnValue(false),
      });

      const result = await client.pay(TEST_ADDRESSES.recipient, '1.00', 'USDs');

      expect(result.transaction).toBeDefined();
      expect(result.transaction.chainId).toBe(421614);
    });

    it('should simulate balance check on testnet', async () => {
      vi.spyOn(client as any, 'standardPayment', 'get').mockReturnValue({
        getBalance: vi.fn().mockResolvedValue({
          raw: 10000000000000000000n,
          formatted: '10.00',
          token: 'USDs',
        }),
      });

      const balance = await client.getBalance(TEST_ADDRESSES.sender);
      expect(balance.formatted).toBe('10.00');
    });
  });

  // ============================================================================
  // Base Sepolia Tests (Simulated)
  // ============================================================================

  describe('Base Sepolia (simulated)', () => {
    it('should have correct Base mainnet config', () => {
      expect(NETWORKS.base.chainId).toBe(8453);
      expect(NETWORKS.base.isTestnet).toBe(false);
    });

    it('should initialize client for Base', () => {
      const client = new X402Client({
        chain: 'base',
        privateKey: TEST_PRIVATE_KEY,
      });

      const chainInfo = client.getChainInfo();
      expect(chainInfo.chain).toBe('base');
      expect(chainInfo.chainId).toBe(8453);
    });
  });

  // ============================================================================
  // Cross-chain Payment Tests (Simulated)
  // ============================================================================

  describe('cross-chain payments (simulated)', () => {
    it('should simulate payment on multiple chains', async () => {
      const chains = ['arbitrum-sepolia', 'base'] as const;

      for (const chain of chains) {
        const client = new X402Client({
          chain,
          privateKey: TEST_PRIVATE_KEY,
        });

        const chainInfo = client.getChainInfo();
        expect(chainInfo.chain).toBe(chain);
        expect(chainInfo.chainId).toBe(NETWORKS[chain].chainId);
      }
    });

    it('should track different balances per chain', async () => {
      const balances: Record<string, string> = {};
      const chains = ['arbitrum', 'polygon', 'optimism'] as const;

      for (const chain of chains) {
        const client = new X402Client({
          chain,
          privateKey: TEST_PRIVATE_KEY,
        });

        // Each chain would have different balance
        const mockBalance = (Math.random() * 100).toFixed(2);
        vi.spyOn(client as any, 'standardPayment', 'get').mockReturnValue({
          getBalance: vi.fn().mockResolvedValue({
            raw: BigInt(parseFloat(mockBalance) * 1e18),
            formatted: mockBalance,
            token: 'USDs',
          }),
        });

        const balance = await client.getBalance(TEST_ADDRESSES.sender);
        balances[chain] = balance.formatted;
      }

      // Each chain should have a balance entry
      expect(Object.keys(balances)).toHaveLength(3);
    });
  });

  // ============================================================================
  // Payment Verification Tests
  // ============================================================================

  describe('payment verification', () => {
    it('should verify payment transaction on testnet', async () => {
      const mockRPC = createMockRPC({ chainId: 421614 });

      const receipt = await mockRPC.getTransactionReceipt({ 
        hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' 
      });

      expect(receipt.status).toBe('success');
    });

    it('should get transaction details', async () => {
      const mockRPC = createMockRPC({ chainId: 421614 });

      const tx = await mockRPC.getTransaction({ 
        hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' 
      });

      expect(tx.from).toBe(TEST_ADDRESSES.sender);
      expect(tx.to).toBe(TEST_ADDRESSES.recipient);
    });

    it('should wait for transaction confirmation', async () => {
      const mockRPC = createMockRPC({ chainId: 421614 });

      const receipt = await mockRPC.waitForTransactionReceipt({ 
        hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' 
      });

      expect(receipt.status).toBe('success');
    });
  });

  // ============================================================================
  // Gas Estimation Tests
  // ============================================================================

  describe('gas estimation', () => {
    it('should estimate gas for payment', async () => {
      const mockRPC = createMockRPC({ chainId: 421614, gasPrice: 100000000n });

      const gasEstimate = await mockRPC.estimateGas({
        to: TEST_ADDRESSES.recipient,
        data: '0x',
      });

      expect(gasEstimate).toBe(50000n);
    });

    it('should get current gas price', async () => {
      const mockRPC = createMockRPC({ chainId: 421614, gasPrice: 100000000n });

      const gasPrice = await mockRPC.getGasPrice();

      expect(gasPrice).toBe(100000000n);
    });

    it('should calculate total gas cost', async () => {
      const gasEstimate = 50000n;
      const gasPrice = 100000000n; // 0.1 gwei

      const totalCost = gasEstimate * gasPrice;
      const costInEth = Number(totalCost) / 1e18;

      expect(costInEth).toBeCloseTo(0.000005, 10);
    });
  });
});

// ============================================================================
// Real Testnet Tests (Conditional)
// ============================================================================

describeTestnet('Real Testnet Payments', () => {
  let client: X402Client;

  beforeAll(() => {
    // Use real testnet private key from environment
    const privateKey = process.env.TESTNET_PRIVATE_KEY as `0x${string}`;
    if (!privateKey) {
      throw new Error('TESTNET_PRIVATE_KEY not set');
    }

    client = new X402Client({
      chain: 'arbitrum-sepolia',
      privateKey,
    });
  });

  it('should connect to Arbitrum Sepolia', async () => {
    const chainInfo = client.getChainInfo();
    expect(chainInfo.chain).toBe('arbitrum-sepolia');
  });

  it('should get real testnet balance', async () => {
    const address = client.getAddress();
    if (address) {
      const balance = await client.getBalance(address);
      expect(balance).toBeDefined();
      console.log(`Testnet balance: ${balance.formatted} ${balance.token}`);
    }
  });

  it('should send small testnet payment', async () => {
    // Only run if explicitly confirmed
    if (process.env.TESTNET_SEND_ENABLED !== 'true') {
      console.log('Skipping testnet send - set TESTNET_SEND_ENABLED=true to enable');
      return;
    }

    const recipient = process.env.TESTNET_RECIPIENT as `0x${string}`;
    if (!recipient) {
      throw new Error('TESTNET_RECIPIENT not set');
    }

    const result = await client.pay(recipient, '0.001', 'USDs');
    
    expect(result.transaction).toBeDefined();
    expect(result.transaction.hash).toBeDefined();
    console.log(`Testnet payment tx: ${result.transaction.hash}`);
  });
});

// ============================================================================
// Network Connectivity Tests
// ============================================================================

describe('Network Connectivity', () => {
  it('should have valid RPC URLs for all networks', () => {
    for (const [chain, config] of Object.entries(NETWORKS)) {
      expect(config.rpcUrl).toMatch(/^https?:\/\//);
    }
  });

  it('should have valid explorer URLs for all networks', () => {
    for (const [chain, config] of Object.entries(NETWORKS)) {
      expect(config.explorerUrl).toMatch(/^https:\/\//);
    }
  });

  it('should simulate RPC connection', async () => {
    const mockRPC = createMockRPC();
    
    const blockNumber = await mockRPC.getBlockNumber();
    expect(blockNumber).toBeGreaterThan(0n);
  });

  it('should handle RPC timeout', async () => {
    const mockRPC = createMockRPC();
    mockRPC.getBlockNumber.mockRejectedValue(new Error('Request timed out'));

    await expect(mockRPC.getBlockNumber()).rejects.toThrow('Request timed out');
  });

  it('should handle RPC rate limiting', async () => {
    const mockRPC = createMockRPC();
    mockRPC.getBlockNumber.mockRejectedValue(new Error('Rate limit exceeded'));

    await expect(mockRPC.getBlockNumber()).rejects.toThrow('Rate limit exceeded');
  });
});


/* universal-crypto-mcp © n1ch0las */