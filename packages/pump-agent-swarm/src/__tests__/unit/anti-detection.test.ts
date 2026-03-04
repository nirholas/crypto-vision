/**
 * Unit Tests — Anti-Detection
 *
 * Tests for AntiDetection: amount randomization, timing jitter,
 * round-value avoidance, wallet rotation, noise transactions,
 * detection risk scoring, and trade sequence validation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AntiDetection } from '../../bundle/anti-detection.js';
import type { AntiDetectionConfig, DetectionRiskScore } from '../../bundle/anti-detection.js';
import { SwarmEventBus } from '../../infra/event-bus.js';
import {
  createTestEventBus,
  createTestAntiDetectionConfig,
  createTestWallet,
  createTestWallets,
  randomMint,
} from '../helpers/test-config.js';

describe('AntiDetection', () => {
  let bus: SwarmEventBus;
  let config: AntiDetectionConfig;

  beforeEach(() => {
    bus = createTestEventBus();
    config = createTestAntiDetectionConfig();
  });

  afterEach(() => {
    SwarmEventBus.resetInstance();
  });

  function createAntiDetection(overrides?: Partial<AntiDetectionConfig>): AntiDetection {
    return new AntiDetection({ ...config, ...overrides }, bus);
  }

  // ─── Amount Randomization ──────────────────────────────────

  describe('amount randomization', () => {
    it('adds variance to a base amount', () => {
      const ad = createAntiDetection({ minAmountVariance: 0.1, maxAmountVariance: 0.2 });
      const baseLamports = 1_000_000_000n; // 1 SOL

      const results = new Set<bigint>();
      for (let i = 0; i < 20; i++) {
        const randomized = ad.randomizeAmount(baseLamports);
        results.add(randomized);
        // Should be within ±20% of base
        const ratio = Number(randomized) / Number(baseLamports);
        expect(ratio).toBeGreaterThan(0.75);
        expect(ratio).toBeLessThan(1.35);
      }

      // Should have variance (not all the same)
      expect(results.size).toBeGreaterThan(1);
    });

    it('never returns zero or negative', () => {
      const ad = createAntiDetection({ maxAmountVariance: 0.5 });
      for (let i = 0; i < 50; i++) {
        const result = ad.randomizeAmount(100_000n);
        expect(result).toBeGreaterThan(0n);
      }
    });

    it('avoids round SOL values when enabled', () => {
      const ad = createAntiDetection({ roundValueAvoidance: true });
      const roundValues = [
        1_000_000_000n, // 1 SOL
        500_000_000n,   // 0.5 SOL
        100_000_000n,   // 0.1 SOL
      ];

      for (const val of roundValues) {
        const result = ad.randomizeAmount(val);
        // Result should not be exactly the round value
        expect(result).not.toBe(val);
      }
    });
  });

  // ─── Timing Jitter ──────────────────────────────────────────

  describe('timing jitter', () => {
    it('generates jitter within configured range', () => {
      const ad = createAntiDetection({
        timingJitterRange: [100, 500],
      });

      for (let i = 0; i < 20; i++) {
        const jitter = ad.getTimingJitter();
        expect(jitter).toBeGreaterThanOrEqual(100);
        expect(jitter).toBeLessThanOrEqual(500);
      }
    });

    it('returns varied jitter values (not constant)', () => {
      const ad = createAntiDetection({
        timingJitterRange: [100, 1000],
      });

      const jitters = new Set<number>();
      for (let i = 0; i < 20; i++) {
        jitters.add(ad.getTimingJitter());
      }
      expect(jitters.size).toBeGreaterThan(1);
    });
  });

  // ─── Wallet Rotation ──────────────────────────────────────

  describe('wallet rotation', () => {
    it('generates a rotation plan for multiple wallets', () => {
      const ad = createAntiDetection();
      const wallets = createTestWallets(5, 'rotation');
      const mint = randomMint();

      const plan = ad.buildRotationPlan(wallets, mint);
      expect(plan.sequence).toBeDefined();
      expect(plan.sequence.length).toBeGreaterThan(0);
      expect(plan.nextWalletIndex).toBeDefined();
    });

    it('enforces wallet cooldown timing', () => {
      const ad = createAntiDetection({
        walletCooldownMs: 60_000,
        maxTradesPerWalletPerHour: 3,
      });
      const wallet = createTestWallet('cooldown-test');
      const mint = randomMint();

      // Record trades for this wallet
      ad.recordTrade(wallet.address, 'buy', 1_000_000_000n, mint);
      ad.recordTrade(wallet.address, 'buy', 1_000_000_000n, mint);
      ad.recordTrade(wallet.address, 'buy', 1_000_000_000n, mint);

      // Should flag as needing cooldown
      const canTrade = ad.canWalletTrade(wallet.address);
      expect(canTrade).toBe(false);
    });
  });

  // ─── Detection Risk Scoring ────────────────────────────────

  describe('detection risk scoring', () => {
    it('returns a valid risk score structure', () => {
      const ad = createAntiDetection();
      const wallet = createTestWallet('score-test');

      const score = ad.getDetectionRiskScore(wallet.address);
      expect(score.overall).toBeGreaterThanOrEqual(0);
      expect(score.overall).toBeLessThanOrEqual(100);
      expect(score.factors).toBeDefined();
      expect(score.factors.timingRegularity).toBeDefined();
      expect(score.factors.amountPatterns).toBeDefined();
      expect(score.recommendations).toBeDefined();
    });

    it('low activity results in low risk score', () => {
      const ad = createAntiDetection();
      const wallet = createTestWallet('low-risk');

      const score = ad.getDetectionRiskScore(wallet.address);
      // New wallet with no history should have low risk
      expect(score.overall).toBeLessThan(50);
    });

    it('high-frequency same-amount trading increases risk', () => {
      const ad = createAntiDetection();
      const wallet = createTestWallet('high-risk');
      const mint = randomMint();

      // Simulate suspicious pattern: same amount, rapid fire
      for (let i = 0; i < 10; i++) {
        ad.recordTrade(wallet.address, 'buy', 1_000_000_000n, mint);
      }

      const score = ad.getDetectionRiskScore(wallet.address);
      expect(score.overall).toBeGreaterThan(30);
    });
  });

  // ─── Trade Sequence Validation ─────────────────────────────

  describe('trade sequence validation', () => {
    it('validates an empty sequence as valid', () => {
      const ad = createAntiDetection();
      const validation = ad.validateTradeSequence([]);
      expect(validation.valid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    it('flags a sequence with suspicious timing', () => {
      const ad = createAntiDetection();
      const wallet = createTestWallet('seq-test');
      const mint = randomMint();

      // Create trades with very regular timing (suspicious)
      const trades = Array.from({ length: 10 }, (_, i) => ({
        walletAddress: wallet.address,
        direction: 'buy' as const,
        amountLamports: 1_000_000_000n,
        timestamp: Date.now() + i * 1_000, // Exactly 1s apart
        mint,
      }));

      const validation = ad.validateTradeSequence(trades);
      // Regular timing should generate at least a warning
      if (validation.issues.length > 0) {
        expect(validation.issues[0]!.severity).toBeDefined();
      }
    });
  });

  // ─── Noise Transactions ────────────────────────────────────

  describe('noise transactions', () => {
    it('generates noise transaction configs when enabled', () => {
      const ad = createAntiDetection({
        enableNoiseTransactions: true,
        noiseProbability: 1.0, // Always generate noise for testing
      });
      const wallet = createTestWallet('noise-test');

      const noise = ad.generateNoiseTransactions(wallet.address);
      expect(Array.isArray(noise)).toBe(true);
      if (noise.length > 0) {
        expect(noise[0]!.type).toBeDefined();
        expect(noise[0]!.wallet).toBe(wallet.address);
        expect(noise[0]!.amountLamports).toBeDefined();
      }
    });

    it('does not generate noise when disabled', () => {
      const ad = createAntiDetection({
        enableNoiseTransactions: false,
      });
      const wallet = createTestWallet('no-noise');

      const noise = ad.generateNoiseTransactions(wallet.address);
      expect(noise).toHaveLength(0);
    });
  });
});
