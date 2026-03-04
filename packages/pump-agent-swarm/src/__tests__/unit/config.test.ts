/**
 * Unit Tests — Configuration
 *
 * Tests for config loading, validation, and defaults.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { validateConfig, type ValidationResult } from '../../config/validation.js';
import {
  DEFAULT_RPC_CONFIG,
  DEFAULT_WALLET_CONFIG,
  DEFAULT_BUNDLE_CONFIG,
  DEFAULT_INTELLIGENCE_CONFIG,
} from '../../config/defaults.js';
import { createTestConfig, createTestRpcConfig } from '../helpers/test-config.js';
import type { SwarmMasterConfig } from '../../types.js';

describe('Configuration', () => {
  // ─── Defaults ───────────────────────────────────────────────

  describe('defaults', () => {
    it('provides valid default RPC config', () => {
      expect(DEFAULT_RPC_CONFIG.endpoints).toHaveLength(1);
      expect(DEFAULT_RPC_CONFIG.endpoints[0]!.url).toContain('solana.com');
      expect(DEFAULT_RPC_CONFIG.healthCheckIntervalMs).toBe(30_000);
    });

    it('provides valid default wallet config', () => {
      expect(DEFAULT_WALLET_CONFIG.poolSize).toBe(8);
      expect(DEFAULT_WALLET_CONFIG.minBalanceLamports.gt(
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        new (require('bn.js'))(0),
      )).toBe(true);
    });

    it('provides valid default bundle config', () => {
      expect(DEFAULT_BUNDLE_CONFIG.slippageBps).toBe(500);
      expect(DEFAULT_BUNDLE_CONFIG.bundleWallets).toEqual([]);
    });

    it('provides valid default intelligence config', () => {
      expect(DEFAULT_INTELLIGENCE_CONFIG.llmProvider).toBe('openrouter');
      expect(DEFAULT_INTELLIGENCE_CONFIG.riskTolerance).toBe(0.5);
    });
  });

  // ─── Validation ─────────────────────────────────────────────

  describe('validation', () => {
    it('accepts a valid config', () => {
      const config = createTestConfig();
      const result: ValidationResult = validateConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects config with no RPC endpoints', () => {
      const config = createTestConfig({
        rpc: createTestRpcConfig({ endpoints: [] }),
      });
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('endpoint'))).toBe(true);
    });

    it('rejects config with invalid RPC URL', () => {
      const config = createTestConfig({
        rpc: createTestRpcConfig({
          endpoints: [{
            url: 'not-a-url',
            weight: 1,
            rateLimit: 10,
            supportsJito: false,
            provider: 'test',
          }],
        }),
      });
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('URL') || e.includes('url'))).toBe(true);
    });

    it('warns when only one RPC endpoint is configured', () => {
      const config = createTestConfig(); // defaults to 1 endpoint
      const result = validateConfig(config);
      expect(result.warnings.some((w) =>
        w.includes('one') || w.includes('failover'),
      )).toBe(true);
    });

    it('rejects negative wallet pool size', () => {
      const config = createTestConfig();
      config.wallets.poolSize = -1;
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
    });
  });

  // ─── Test Config Helper ─────────────────────────────────────

  describe('createTestConfig', () => {
    it('creates a valid default test config', () => {
      const config = createTestConfig();
      expect(config.network).toBe('devnet');
      expect(config.logLevel).toBe('error');
      expect(config.enableMetrics).toBe(false);
      expect(config.rpc.endpoints).toHaveLength(1);
    });

    it('applies overrides correctly', () => {
      const config = createTestConfig({
        network: 'mainnet-beta',
        logLevel: 'debug',
      });
      expect(config.network).toBe('mainnet-beta');
      expect(config.logLevel).toBe('debug');
    });
  });
});
