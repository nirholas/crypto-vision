// ucm:0.4.14.3:nirh

/**
 * X402 Chains Unit Tests
 * @description Tests for CAIP-2 parsing/generation, chain detection, and RPC connectivity
 * @author Test Engineer
 * @license Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SUPPORTED_CHAINS } from '../config.js';
import { NETWORKS, CHAIN_ID_TO_CHAIN, TOKENS } from '../sdk/constants.js';
import type { X402Chain } from '../sdk/types.js';
import { createMockRPC, TEST_ADDRESSES } from './mocks/index.js';

describe('Chains Configuration', () => {
  // ============================================================================
  // CAIP-2 Identifier Tests
  // ============================================================================

  describe('CAIP-2 identifiers', () => {
    it('should have valid CAIP-2 format for all chains', () => {
      const caip2Regex = /^eip155:\d+$/;

      for (const [chain, info] of Object.entries(SUPPORTED_CHAINS)) {
        expect(info.caip2).toMatch(caip2Regex);
      }
    });

    it('should have correct CAIP-2 for Arbitrum', () => {
      expect(SUPPORTED_CHAINS.arbitrum.caip2).toBe('eip155:42161');
    });

    it('should have correct CAIP-2 for Arbitrum Sepolia', () => {
      expect(SUPPORTED_CHAINS['arbitrum-sepolia'].caip2).toBe('eip155:421614');
    });

    it('should have correct CAIP-2 for Base', () => {
      expect(SUPPORTED_CHAINS.base.caip2).toBe('eip155:8453');
    });

    it('should have correct CAIP-2 for Ethereum', () => {
      expect(SUPPORTED_CHAINS.ethereum.caip2).toBe('eip155:1');
    });

    it('should have correct CAIP-2 for Polygon', () => {
      expect(SUPPORTED_CHAINS.polygon.caip2).toBe('eip155:137');
    });

    it('should have correct CAIP-2 for Optimism', () => {
      expect(SUPPORTED_CHAINS.optimism.caip2).toBe('eip155:10');
    });

    it('should have correct CAIP-2 for BSC', () => {
      expect(SUPPORTED_CHAINS.bsc.caip2).toBe('eip155:56');
    });
  });

  // ============================================================================
  // CAIP-2 Parsing Tests
  // ============================================================================

  describe('CAIP-2 parsing', () => {
    /**
     * Parse CAIP-2 identifier to extract namespace and reference
     */
    function parseCAIP2(caip2: string): { namespace: string; chainId: number } | null {
      const match = caip2.match(/^(\w+):(\d+)$/);
      if (!match) return null;
      return {
        namespace: match[1]!,
        chainId: parseInt(match[2]!, 10),
      };
    }

    it('should parse valid CAIP-2 identifier', () => {
      const result = parseCAIP2('eip155:42161');
      expect(result).toEqual({ namespace: 'eip155', chainId: 42161 });
    });

    it('should return null for invalid CAIP-2', () => {
      expect(parseCAIP2('invalid')).toBeNull();
      expect(parseCAIP2('eip155:')).toBeNull();
      expect(parseCAIP2(':42161')).toBeNull();
      expect(parseCAIP2('')).toBeNull();
    });

    it('should parse all supported chain CAIP-2 identifiers', () => {
      for (const [chain, info] of Object.entries(SUPPORTED_CHAINS)) {
        const parsed = parseCAIP2(info.caip2);
        expect(parsed).not.toBeNull();
        expect(parsed?.namespace).toBe('eip155');
        expect(parsed?.chainId).toBeGreaterThan(0);
      }
    });
  });

  // ============================================================================
  // CAIP-2 Generation Tests
  // ============================================================================

  describe('CAIP-2 generation', () => {
    /**
     * Generate CAIP-2 identifier from chain ID
     */
    function generateCAIP2(chainId: number, namespace: string = 'eip155'): string {
      return `${namespace}:${chainId}`;
    }

    it('should generate valid CAIP-2 for Arbitrum', () => {
      expect(generateCAIP2(42161)).toBe('eip155:42161');
    });

    it('should generate valid CAIP-2 for Ethereum', () => {
      expect(generateCAIP2(1)).toBe('eip155:1');
    });

    it('should support custom namespace', () => {
      expect(generateCAIP2(42161, 'eip155')).toBe('eip155:42161');
    });

// ucm-14938
    it('should match stored CAIP-2 when generated from chain ID', () => {
      for (const [chain, config] of Object.entries(NETWORKS)) {
        const generated = generateCAIP2(config.chainId);
        const stored = SUPPORTED_CHAINS[chain as X402Chain]?.caip2;
        if (stored) {
          expect(generated).toBe(stored);
        }
      }
    });
  });

  // ============================================================================
  // Chain Detection Tests
  // ============================================================================

  describe('chain detection', () => {
    describe('from chain ID', () => {
      it('should detect Arbitrum from chain ID', () => {
        expect(CHAIN_ID_TO_CHAIN[42161]).toBe('arbitrum');
      });

      it('should detect Arbitrum Sepolia from chain ID', () => {
        expect(CHAIN_ID_TO_CHAIN[421614]).toBe('arbitrum-sepolia');
      });

      it('should detect Base from chain ID', () => {
        expect(CHAIN_ID_TO_CHAIN[8453]).toBe('base');
      });

      it('should detect Ethereum from chain ID', () => {
        expect(CHAIN_ID_TO_CHAIN[1]).toBe('ethereum');
      });

      it('should detect Polygon from chain ID', () => {
        expect(CHAIN_ID_TO_CHAIN[137]).toBe('polygon');
      });

      it('should detect Optimism from chain ID', () => {
        expect(CHAIN_ID_TO_CHAIN[10]).toBe('optimism');
      });

      it('should detect BSC from chain ID', () => {
        expect(CHAIN_ID_TO_CHAIN[56]).toBe('bsc');
      });

      it('should return undefined for unknown chain ID', () => {
        expect(CHAIN_ID_TO_CHAIN[99999]).toBeUndefined();
      });
    });

    describe('from CAIP-2', () => {
      /**
       * Detect chain from CAIP-2 identifier
       */
      function chainFromCAIP2(caip2: string): X402Chain | undefined {
        const match = caip2.match(/^eip155:(\d+)$/);
        if (!match) return undefined;
        const chainId = parseInt(match[1]!, 10);
        return CHAIN_ID_TO_CHAIN[chainId];
      }

      it('should detect chain from CAIP-2', () => {
        expect(chainFromCAIP2('eip155:42161')).toBe('arbitrum');
        expect(chainFromCAIP2('eip155:1')).toBe('ethereum');
        expect(chainFromCAIP2('eip155:137')).toBe('polygon');
      });

      it('should return undefined for invalid CAIP-2', () => {
        expect(chainFromCAIP2('invalid')).toBeUndefined();
        expect(chainFromCAIP2('solana:mainnet')).toBeUndefined();
      });
    });

    describe('testnet detection', () => {
      it('should identify testnets correctly', () => {
        expect(SUPPORTED_CHAINS['arbitrum-sepolia'].testnet).toBe(true);
      });

      it('should identify mainnets correctly', () => {
        expect(SUPPORTED_CHAINS.arbitrum.testnet).toBe(false);
        expect(SUPPORTED_CHAINS.ethereum.testnet).toBe(false);
        expect(SUPPORTED_CHAINS.polygon.testnet).toBe(false);
      });

      it('should match testnet flag in NETWORKS', () => {
        for (const [chain, config] of Object.entries(NETWORKS)) {
          const supportedChain = SUPPORTED_CHAINS[chain as X402Chain];
          if (supportedChain) {
            expect(config.isTestnet).toBe(supportedChain.testnet);
          }
        }
      });
    });
  });

  // ============================================================================
  // Network Configuration Tests
  // ============================================================================

  describe('network configuration', () => {
    it('should have valid RPC URLs', () => {
      for (const [chain, config] of Object.entries(NETWORKS)) {
        expect(config.rpcUrl).toMatch(/^https?:\/\//);
      }
    });

    it('should have valid explorer URLs', () => {
      for (const [chain, config] of Object.entries(NETWORKS)) {
        expect(config.explorerUrl).toMatch(/^https:\/\//);
      }
    });

    it('should have correct chain IDs', () => {
      expect(NETWORKS.arbitrum.chainId).toBe(42161);
      expect(NETWORKS['arbitrum-sepolia'].chainId).toBe(421614);
      expect(NETWORKS.base.chainId).toBe(8453);
      expect(NETWORKS.ethereum.chainId).toBe(1);
      expect(NETWORKS.polygon.chainId).toBe(137);
      expect(NETWORKS.optimism.chainId).toBe(10);
      expect(NETWORKS.bsc.chainId).toBe(56);
    });

    it('should have human-readable names', () => {
      expect(NETWORKS.arbitrum.name).toBe('Arbitrum One');
      expect(NETWORKS['arbitrum-sepolia'].name).toBe('Arbitrum Sepolia');
      expect(NETWORKS.base.name).toBe('Base');
      expect(NETWORKS.ethereum.name).toBe('Ethereum');
    });
  });

  // ============================================================================
  // Token Configuration Tests
  // ============================================================================

  describe('token configuration', () => {
    it('should have USDs on Arbitrum', () => {
      expect(TOKENS.arbitrum.USDs).toBeDefined();
      expect(TOKENS.arbitrum.USDs?.symbol).toBe('USDs');
    });

    it('should have USDs on Arbitrum Sepolia', () => {
      expect(TOKENS['arbitrum-sepolia'].USDs).toBeDefined();
    });

    it('should have correct decimals for USDs', () => {
      expect(TOKENS.arbitrum.USDs?.decimals).toBe(18);
    });

    it('should indicate EIP-3009 support for USDs', () => {
      expect(TOKENS.arbitrum.USDs?.supportsEIP3009).toBe(true);
    });

    it('should have valid token addresses', () => {
      for (const [chain, tokens] of Object.entries(TOKENS)) {
        for (const [symbol, config] of Object.entries(tokens)) {
          if (config?.address) {
            expect(config.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
          }
        }
      }
    });
  });

  // ============================================================================
  // RPC Connectivity Tests (Mocked)
  // ============================================================================

  describe('RPC connectivity (mocked)', () => {
    let mockRPC: ReturnType<typeof createMockRPC>;

    beforeEach(() => {
      mockRPC = createMockRPC();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should connect and get chain ID', async () => {
      const chainId = await mockRPC.getChainId();
      expect(chainId).toBe(42161); // Arbitrum
    });

    it('should get block number', async () => {
      const blockNumber = await mockRPC.getBlockNumber();
      expect(blockNumber).toBe(150000000n);
    });

    it('should get balance', async () => {
      const balance = await mockRPC.getBalance(TEST_ADDRESSES.sender);
      expect(balance).toBe(1000000000000000000n);
    });

    it('should get gas price', async () => {
      const gasPrice = await mockRPC.getGasPrice();
      expect(gasPrice).toBe(100000000n);
    });

    it('should read contract data', async () => {
      const balance = await mockRPC.readContract({
        functionName: 'balanceOf',
        args: [TEST_ADDRESSES.sender],
      });
      expect(balance).toBe(100000000000000000000n);
    });

    it('should get token decimals', async () => {
      const decimals = await mockRPC.readContract({
        functionName: 'decimals',
        args: [],
      });
      expect(decimals).toBe(18);
    });

    it('should estimate gas', async () => {
      const gas = await mockRPC.estimateGas({
        to: TEST_ADDRESSES.recipient,
        value: 1000000000000000000n,
      });
      expect(gas).toBe(50000n);
    });

    it('should get transaction by hash', async () => {
      const tx = await mockRPC.getTransaction({ hash: '0x123' });
      expect(tx).toBeDefined();
      expect(tx.from).toBe(TEST_ADDRESSES.sender);
    });

    it('should get transaction receipt', async () => {
      const receipt = await mockRPC.getTransactionReceipt({ hash: '0x123' });
      expect(receipt.status).toBe('success');
    });

    it('should handle different chains', async () => {
      // Test with Ethereum config
      const ethRPC = createMockRPC({ chainId: 1 });
// FIXME(nich): review edge cases
      const chainId = await ethRPC.getChainId();
      expect(chainId).toBe(1);

      // Test with Polygon config
      const polygonRPC = createMockRPC({ chainId: 137 });
      const polyChainId = await polygonRPC.getChainId();
      expect(polyChainId).toBe(137);
    });
  });

  // ============================================================================
  // Token Balance Queries (Mocked)
  // ============================================================================

  describe('token balance queries (mocked)', () => {
    let mockRPC: ReturnType<typeof createMockRPC>;

    beforeEach(() => {
      mockRPC = createMockRPC({ tokenBalance: 500000000000000000000n });
    });

    it('should query USDs balance', async () => {
      const balance = await mockRPC.readContract({
        address: TOKENS.arbitrum.USDs?.address,
        functionName: 'balanceOf',
        args: [TEST_ADDRESSES.sender],
      });

      expect(balance).toBe(500000000000000000000n); // 500 USDs
    });

    it('should query token allowance', async () => {
      const allowance = await mockRPC.readContract({
        address: TOKENS.arbitrum.USDs?.address,
        functionName: 'allowance',
        args: [TEST_ADDRESSES.sender, TEST_ADDRESSES.contract],
      });

      expect(allowance).toBe(0n);
    });

    it('should handle zero balance', async () => {
      const zeroBalanceRPC = createMockRPC({ tokenBalance: 0n });
      const balance = await zeroBalanceRPC.readContract({
        functionName: 'balanceOf',
        args: [TEST_ADDRESSES.sender],
      });

      expect(balance).toBe(0n);
    });

    it('should format balance with correct decimals', () => {
      const rawBalance = 1234567890000000000n; // 1.23456789 tokens (18 decimals)
      const decimals = 18;
      const formatted = Number(rawBalance) / Math.pow(10, decimals);
      expect(formatted.toFixed(2)).toBe('1.23');
    });
  });

  // ============================================================================
  // Chain Compatibility Tests
  // ============================================================================

  describe('chain compatibility', () => {
    it('should have same chains in SUPPORTED_CHAINS and NETWORKS', () => {
      const supportedChains = Object.keys(SUPPORTED_CHAINS);
      const networkChains = Object.keys(NETWORKS);

      expect(supportedChains.sort()).toEqual(networkChains.sort());
    });

    it('should have bidirectional chain ID mapping', () => {
      for (const [chain, config] of Object.entries(NETWORKS)) {
        const chainId = config.chainId;
        const mappedChain = CHAIN_ID_TO_CHAIN[chainId];
        expect(mappedChain).toBe(chain);
      }
    });

    it('should support all EVM chains', () => {
      const evmChains: X402Chain[] = ['arbitrum', 'arbitrum-sepolia', 'base', 'ethereum', 'polygon', 'optimism', 'bsc'];
      
      for (const chain of evmChains) {
        expect(SUPPORTED_CHAINS[chain]).toBeDefined();
        expect(NETWORKS[chain]).toBeDefined();
      }
    });
  });
});

describe('Address validation', () => {
  /**
   * Validate EVM address format
   */
  function isValidEVMAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  it('should validate correct EVM addresses', () => {
    expect(isValidEVMAddress(TEST_ADDRESSES.sender)).toBe(true);
    expect(isValidEVMAddress(TEST_ADDRESSES.recipient)).toBe(true);
    expect(isValidEVMAddress(TEST_ADDRESSES.contract)).toBe(true);
  });

  it('should reject invalid addresses', () => {
    expect(isValidEVMAddress('0x123')).toBe(false);
    expect(isValidEVMAddress('not-an-address')).toBe(false);
    expect(isValidEVMAddress('')).toBe(false);
    expect(isValidEVMAddress('0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG')).toBe(false);
  });

  it('should handle checksummed addresses', () => {
    // Both lower and mixed case should be valid
    expect(isValidEVMAddress('0xd8da6bf26964af9d7eed9e03e53415d37aa96045')).toBe(true);
    expect(isValidEVMAddress('0xD8dA6BF26964aF9D7eEd9e03E53415D37aA96045')).toBe(true);
  });
});


/* ucm:n1ch98c1f9a1 */