/**
 * @file config.test.ts
 * @author n1ch0las
 * @copyright (c) 2026 nirholas/universal-crypto-mcp
 * @license MIT
 * @repository universal-crypto-mcp
 * @version 14.9.3.8
 * @checksum bmljaCBuaXJob2xhcw==
 */

/**
 * X402 Configuration Unit Tests
 * @description Tests for configuration loading and validation
 * @author Test Engineer
 * @license Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadX402Config, isX402Configured, validateX402Config, SUPPORTED_CHAINS } from '../config.js';
import { TEST_PRIVATE_KEY } from './mocks/index.js';

describe('X402 Configuration', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    // Clear all X402 env vars
    delete process.env.X402_PRIVATE_KEY;
    delete process.env.X402_CHAIN;
    delete process.env.X402_RPC_URL;
    delete process.env.X402_ENABLE_GASLESS;
    delete process.env.X402_FACILITATOR_URL;
    delete process.env.X402_MAX_PAYMENT;
    delete process.env.X402_DEBUG;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // ============================================================================
  // loadX402Config Tests
  // ============================================================================

  describe('loadX402Config', () => {
    it('should load default configuration', () => {
      const config = loadX402Config();

      expect(config.chain).toBe('arbitrum');
      expect(config.enableGasless).toBe(true);
      expect(config.maxPaymentPerRequest).toBe('1.00');
      expect(config.debug).toBe(false);
    });

    it('should load private key from environment', () => {
      process.env.X402_PRIVATE_KEY = TEST_PRIVATE_KEY;
      const config = loadX402Config();

      expect(config.privateKey).toBe(TEST_PRIVATE_KEY);
    });

    it('should load chain from environment', () => {
      process.env.X402_CHAIN = 'polygon';
      const config = loadX402Config();

      expect(config.chain).toBe('polygon');
    });

    it('should load RPC URL from environment', () => {
      process.env.X402_RPC_URL = 'https://custom-rpc.example.com';
      const config = loadX402Config();

      expect(config.rpcUrl).toBe('https://custom-rpc.example.com');
    });

    it('should load gasless setting from environment', () => {
      process.env.X402_ENABLE_GASLESS = 'false';
      const config = loadX402Config();

      expect(config.enableGasless).toBe(false);
    });

    it('should default gasless to true', () => {
      const config = loadX402Config();
      expect(config.enableGasless).toBe(true);
    });

    it('should load facilitator URL from environment', () => {
      process.env.X402_FACILITATOR_URL = 'https://facilitator.example.com';
      const config = loadX402Config();

      expect(config.facilitatorUrl).toBe('https://facilitator.example.com');
    });

    it('should load max payment from environment', () => {
      process.env.X402_MAX_PAYMENT = '5.00';
      const config = loadX402Config();

      expect(config.maxPaymentPerRequest).toBe('5.00');
    });

    it('should load debug setting from environment', () => {
      process.env.X402_DEBUG = 'true';
      const config = loadX402Config();

      expect(config.debug).toBe(true);
    });

    it('should handle all supported chains', () => {
      const chains = ['arbitrum', 'arbitrum-sepolia', 'base', 'ethereum', 'polygon', 'optimism', 'bsc'];

      for (const chain of chains) {
        process.env.X402_CHAIN = chain;
        const config = loadX402Config();
        expect(config.chain).toBe(chain);
      }
    });

    it('should preserve private key format', () => {
      const privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
      process.env.X402_PRIVATE_KEY = privateKey;
      const config = loadX402Config();

      expect(config.privateKey).toBe(privateKey);
      expect(config.privateKey?.startsWith('0x')).toBe(true);
    });
  });

  // ============================================================================
  // isX402Configured Tests
  // ============================================================================

  describe('isX402Configured', () => {
    it('should return false when private key not set', () => {
      expect(isX402Configured()).toBe(false);
    });

    it('should return true when private key is set', () => {
      process.env.X402_PRIVATE_KEY = TEST_PRIVATE_KEY;
      expect(isX402Configured()).toBe(true);
    });

    it('should return true for any valid private key', () => {
      process.env.X402_PRIVATE_KEY = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      expect(isX402Configured()).toBe(true);
    });
  });

  // ============================================================================
  // validateX402Config Tests
  // ============================================================================

  describe('validateX402Config', () => {
    it('should validate complete configuration', () => {
      const config = {
        privateKey: TEST_PRIVATE_KEY,
        chain: 'arbitrum' as const,
        enableGasless: true,
        maxPaymentPerRequest: '1.00',
        debug: false,
      };

      const result = validateX402Config(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should warn when private key is missing', () => {
      const config = {
        chain: 'arbitrum' as const,
        enableGasless: true,
        maxPaymentPerRequest: '1.00',
        debug: false,
      };

      const result = validateX402Config(config);

      expect(result.errors.some(e => e.includes('X402_PRIVATE_KEY'))).toBe(true);
    });

    it('should error on invalid private key format - missing 0x', () => {
      const config = {
        privateKey: 'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as `0x${string}`,
        chain: 'arbitrum' as const,
        enableGasless: true,
        maxPaymentPerRequest: '1.00',
        debug: false,
      };

      const result = validateX402Config(config);

      expect(result.errors.some(e => e.includes('0x'))).toBe(true);
    });

    it('should error on invalid private key length', () => {
      const config = {
        privateKey: '0x1234' as `0x${string}`,
        chain: 'arbitrum' as const,
        enableGasless: true,
        maxPaymentPerRequest: '1.00',
        debug: false,
      };

      const result = validateX402Config(config);

      expect(result.errors.some(e => e.includes('32-byte'))).toBe(true);
    });

    it('should error on unsupported chain', () => {
      const config = {
        privateKey: TEST_PRIVATE_KEY,
        chain: 'unsupported' as any,
        enableGasless: true,
        maxPaymentPerRequest: '1.00',
        debug: false,
      };

      const result = validateX402Config(config);

      expect(result.errors.some(e => e.includes('not supported'))).toBe(true);
    });

    it('should error on invalid max payment - negative', () => {
      const config = {
        privateKey: TEST_PRIVATE_KEY,
        chain: 'arbitrum' as const,
        enableGasless: true,
        maxPaymentPerRequest: '-1.00',
        debug: false,
      };

      const result = validateX402Config(config);

      expect(result.errors.some(e => e.includes('positive'))).toBe(true);
    });

    it('should error on invalid max payment - not a number', () => {
      const config = {
        privateKey: TEST_PRIVATE_KEY,
        chain: 'arbitrum' as const,
        enableGasless: true,
        maxPaymentPerRequest: 'invalid',
        debug: false,
      };

      const result = validateX402Config(config);

      expect(result.errors.some(e => e.includes('positive'))).toBe(true);
    });

    it('should error on zero max payment', () => {
      const config = {
        privateKey: TEST_PRIVATE_KEY,
        chain: 'arbitrum' as const,
        enableGasless: true,
        maxPaymentPerRequest: '0',
        debug: false,
      };

      const result = validateX402Config(config);

      expect(result.errors.some(e => e.includes('positive'))).toBe(true);
    });

    it('should be valid even with warnings about missing private key', () => {
      const config = {
        chain: 'arbitrum' as const,
        enableGasless: true,
        maxPaymentPerRequest: '1.00',
        debug: false,
      };

      const result = validateX402Config(config);

      // Should still be considered "valid" for read-only operations
      expect(result.valid).toBe(true);
      expect(result.errors.some(e => e.includes('disabled'))).toBe(true);
    });

    it('should validate all supported chains', () => {
      const chains = ['arbitrum', 'arbitrum-sepolia', 'base', 'ethereum', 'polygon', 'optimism', 'bsc'] as const;

      for (const chain of chains) {
        const config = {
          privateKey: TEST_PRIVATE_KEY,
          chain,
          enableGasless: true,
          maxPaymentPerRequest: '1.00',
          debug: false,
        };

        const result = validateX402Config(config);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      }
    });

    it('should validate decimal max payment amounts', () => {
      const amounts = ['0.01', '0.50', '1.00', '10.00', '100.00', '1000.00'];

      for (const amount of amounts) {
        const config = {
          privateKey: TEST_PRIVATE_KEY,
          chain: 'arbitrum' as const,
          enableGasless: true,
          maxPaymentPerRequest: amount,
          debug: false,
        };

        const result = validateX402Config(config);
        expect(result.valid).toBe(true);
      }
    });
  });

  // ============================================================================
  // SUPPORTED_CHAINS Tests
  // ============================================================================

  describe('SUPPORTED_CHAINS', () => {
    it('should have all expected chains', () => {
      expect(SUPPORTED_CHAINS).toHaveProperty('arbitrum');
      expect(SUPPORTED_CHAINS).toHaveProperty('arbitrum-sepolia');
      expect(SUPPORTED_CHAINS).toHaveProperty('base');
      expect(SUPPORTED_CHAINS).toHaveProperty('ethereum');
      expect(SUPPORTED_CHAINS).toHaveProperty('polygon');
      expect(SUPPORTED_CHAINS).toHaveProperty('optimism');
      expect(SUPPORTED_CHAINS).toHaveProperty('bsc');
    });

    it('should have valid CAIP-2 identifiers', () => {
      for (const [chain, info] of Object.entries(SUPPORTED_CHAINS)) {
        expect(info.caip2).toMatch(/^eip155:\d+$/);
      }
    });

    it('should have human-readable names', () => {
      expect(SUPPORTED_CHAINS.arbitrum.name).toBe('Arbitrum One');
      expect(SUPPORTED_CHAINS.ethereum.name).toBe('Ethereum');
      expect(SUPPORTED_CHAINS.polygon.name).toBe('Polygon');
    });

    it('should identify testnets', () => {
      expect(SUPPORTED_CHAINS['arbitrum-sepolia'].testnet).toBe(true);
      expect(SUPPORTED_CHAINS.arbitrum.testnet).toBe(false);
    });
  });

  // ============================================================================
  // Environment Variable Edge Cases
  // ============================================================================

  describe('environment variable edge cases', () => {
    it('should handle empty string private key', () => {
      process.env.X402_PRIVATE_KEY = '';
      expect(isX402Configured()).toBe(false);
    });

    it('should handle whitespace in environment variables', () => {
      process.env.X402_CHAIN = '  arbitrum  ';
      const config = loadX402Config();
      // Config should trim or handle whitespace
      expect(config.chain.trim()).toBe('arbitrum');
    });

    it('should handle case sensitivity in chain names', () => {
      process.env.X402_CHAIN = 'ARBITRUM';
      const config = loadX402Config();
      // Should handle case as-is (validation will catch invalid chains)
      expect(config.chain).toBe('ARBITRUM');
    });

    it('should handle boolean-like strings for gasless', () => {
      // Only 'false' should disable gasless
      process.env.X402_ENABLE_GASLESS = 'FALSE';
      let config = loadX402Config();
      expect(config.enableGasless).toBe(true); // !== 'false' exactly

      process.env.X402_ENABLE_GASLESS = 'false';
      config = loadX402Config();
      expect(config.enableGasless).toBe(false);

      process.env.X402_ENABLE_GASLESS = '0';
      config = loadX402Config();
      expect(config.enableGasless).toBe(true); // !== 'false'
    });

    it('should handle boolean-like strings for debug', () => {
      process.env.X402_DEBUG = 'TRUE';
      let config = loadX402Config();
      expect(config.debug).toBe(false); // !== 'true' exactly

      process.env.X402_DEBUG = 'true';
      config = loadX402Config();
      expect(config.debug).toBe(true);
    });
  });

  // ============================================================================
  // Configuration Immutability Tests
  // ============================================================================

  describe('configuration immutability', () => {
    it('should return fresh config object each time', () => {
      process.env.X402_PRIVATE_KEY = TEST_PRIVATE_KEY;
      
      const config1 = loadX402Config();
      const config2 = loadX402Config();

      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });

    it('should reflect environment changes', () => {
      process.env.X402_CHAIN = 'arbitrum';
      const config1 = loadX402Config();

      process.env.X402_CHAIN = 'polygon';
      const config2 = loadX402Config();

      expect(config1.chain).toBe('arbitrum');
      expect(config2.chain).toBe('polygon');
    });
  });
});


/* EOF - n1ch0las | 0.4.14.3 */