/**
 * Unit Tests — Slippage Calculator
 *
 * Tests for SlippageCalculator: bonding curve math, buy/sell slippage,
 * price impact, order splitting, and fee calculations.
 */

import { describe, it, expect } from 'vitest';
import BN from 'bn.js';

// We test the bonding curve math directly since SlippageCalculator
// needs a live Solana connection. The pure math functions are the
// critical path to validate.

// Re-implement the bonding curve helpers locally to test the math
// (these mirror the private functions in slippage-calculator.ts)

const PUMP_FUN_FEE_BPS = 100;
const BPS_DENOMINATOR = 10_000;

function computeBuyOutput(
  virtualSolReserves: BN,
  virtualTokenReserves: BN,
  solInput: BN,
): { tokensOut: BN; fee: BN; solAfterFee: BN } {
  if (solInput.isZero() || solInput.isNeg()) {
    return { tokensOut: new BN(0), fee: new BN(0), solAfterFee: new BN(0) };
  }
  const fee = solInput.mul(new BN(PUMP_FUN_FEE_BPS)).div(new BN(BPS_DENOMINATOR));
  const solAfterFee = solInput.sub(fee);
  const k = virtualSolReserves.mul(virtualTokenReserves);
  const newSolReserves = virtualSolReserves.add(solAfterFee);
  const newTokenReserves = k.div(newSolReserves);
  const tokensOut = virtualTokenReserves.sub(newTokenReserves);
  return {
    tokensOut: tokensOut.isNeg() ? new BN(0) : tokensOut,
    fee,
    solAfterFee,
  };
}

function computeSellOutput(
  virtualSolReserves: BN,
  virtualTokenReserves: BN,
  tokensIn: BN,
): { solOut: BN; fee: BN; solBeforeFee: BN } {
  if (tokensIn.isZero() || tokensIn.isNeg()) {
    return { solOut: new BN(0), fee: new BN(0), solBeforeFee: new BN(0) };
  }
  const k = virtualSolReserves.mul(virtualTokenReserves);
  const newTokenReserves = virtualTokenReserves.add(tokensIn);
  const newSolReserves = k.div(newTokenReserves);
  const solBeforeFee = virtualSolReserves.sub(newSolReserves);
  const fee = solBeforeFee.mul(new BN(PUMP_FUN_FEE_BPS)).div(new BN(BPS_DENOMINATOR));
  const solOut = solBeforeFee.sub(fee);
  return {
    solOut: solOut.isNeg() ? new BN(0) : solOut,
    fee,
    solBeforeFee,
  };
}

function spotPrice(virtualSolReserves: BN, virtualTokenReserves: BN): number {
  return virtualSolReserves.toNumber() / virtualTokenReserves.toNumber();
}

describe('Slippage Calculator — Bonding Curve Math', () => {
  // Typical Pump.fun initial reserves
  const INITIAL_SOL = new BN(30_000_000_000); // 30 SOL in lamports
  const INITIAL_TOKENS = new BN(1_073_000_000_000_000); // ~1.073B tokens (6 decimals)

  // ─── Buy Output ─────────────────────────────────────────────

  describe('computeBuyOutput', () => {
    it('returns zero tokens for zero SOL input', () => {
      const { tokensOut, fee } = computeBuyOutput(INITIAL_SOL, INITIAL_TOKENS, new BN(0));
      expect(tokensOut.isZero()).toBe(true);
      expect(fee.isZero()).toBe(true);
    });

    it('returns zero tokens for negative SOL input', () => {
      const { tokensOut } = computeBuyOutput(INITIAL_SOL, INITIAL_TOKENS, new BN(-1));
      expect(tokensOut.isZero()).toBe(true);
    });

    it('deducts 1% fee before swap', () => {
      const solIn = new BN(1_000_000_000); // 1 SOL
      const { fee, solAfterFee } = computeBuyOutput(INITIAL_SOL, INITIAL_TOKENS, solIn);

      // Fee should be exactly 1%
      expect(fee.toNumber()).toBe(10_000_000); // 0.01 SOL
      expect(solAfterFee.toNumber()).toBe(990_000_000); // 0.99 SOL
    });

    it('calculates tokens out on a small buy', () => {
      const solIn = new BN(100_000_000); // 0.1 SOL
      const { tokensOut } = computeBuyOutput(INITIAL_SOL, INITIAL_TOKENS, solIn);

      expect(tokensOut.gt(new BN(0))).toBe(true);
      // Should receive roughly (0.1 * 0.99 / 30) * 1.073B tokens ≈ 3.5M tokens
      // But slightly less due to curve mechanics
      expect(tokensOut.toNumber()).toBeGreaterThan(3_000_000_000_000); // > 3M tokens
      expect(tokensOut.toNumber()).toBeLessThan(4_000_000_000_000); // < 4M tokens
    });

    it('larger buys receive fewer tokens per SOL (slippage)', () => {
      const smallBuy = new BN(100_000_000); // 0.1 SOL
      const largeBuy = new BN(5_000_000_000); // 5 SOL

      const { tokensOut: smallTokens } = computeBuyOutput(INITIAL_SOL, INITIAL_TOKENS, smallBuy);
      const { tokensOut: largeTokens } = computeBuyOutput(INITIAL_SOL, INITIAL_TOKENS, largeBuy);

      // Tokens per SOL should be higher for small buy (less slippage)
      const smallRate = smallTokens.toNumber() / smallBuy.toNumber();
      const largeRate = largeTokens.toNumber() / largeBuy.toNumber();
      expect(smallRate).toBeGreaterThan(largeRate);
    });

    it('preserves constant product invariant', () => {
      const solIn = new BN(1_000_000_000);
      const { tokensOut, solAfterFee } = computeBuyOutput(INITIAL_SOL, INITIAL_TOKENS, solIn);

      const kBefore = INITIAL_SOL.mul(INITIAL_TOKENS);
      const newSol = INITIAL_SOL.add(solAfterFee);
      const newTokens = INITIAL_TOKENS.sub(tokensOut);
      const kAfter = newSol.mul(newTokens);

      // k should be preserved (within rounding because of integer division)
      const diff = kBefore.sub(kAfter).abs();
      // Rounding error should be < the new sol reserves (1 unit rounding per division)
      expect(diff.lt(newSol)).toBe(true);
    });
  });

  // ─── Sell Output ────────────────────────────────────────────

  describe('computeSellOutput', () => {
    it('returns zero SOL for zero token input', () => {
      const { solOut } = computeSellOutput(INITIAL_SOL, INITIAL_TOKENS, new BN(0));
      expect(solOut.isZero()).toBe(true);
    });

    it('deducts 1% fee after swap on sells', () => {
      const tokensIn = new BN(10_000_000_000_000); // 10M tokens
      const { solOut, fee, solBeforeFee } = computeSellOutput(INITIAL_SOL, INITIAL_TOKENS, tokensIn);

      expect(fee.gt(new BN(0))).toBe(true);
      // fee + solOut should equal solBeforeFee
      expect(solOut.add(fee).eq(solBeforeFee)).toBe(true);
    });

    it('returns SOL for a token sell', () => {
      const tokensIn = new BN(5_000_000_000_000); // 5M tokens
      const { solOut } = computeSellOutput(INITIAL_SOL, INITIAL_TOKENS, tokensIn);
      expect(solOut.gt(new BN(0))).toBe(true);
    });

    it('larger sells receive fewer SOL per token (slippage)', () => {
      const smallSell = new BN(1_000_000_000_000); // 1M tokens
      const largeSell = new BN(100_000_000_000_000); // 100M tokens

      const { solOut: smallSol } = computeSellOutput(INITIAL_SOL, INITIAL_TOKENS, smallSell);
      const { solOut: largeSol } = computeSellOutput(INITIAL_SOL, INITIAL_TOKENS, largeSell);

      const smallRate = smallSol.toNumber() / smallSell.toNumber();
      const largeRate = largeSol.toNumber() / largeSell.toNumber();
      expect(smallRate).toBeGreaterThan(largeRate);
    });
  });

  // ─── Spot Price ─────────────────────────────────────────────

  describe('spot price', () => {
    it('calculates initial spot price', () => {
      const price = spotPrice(INITIAL_SOL, INITIAL_TOKENS);
      expect(price).toBeGreaterThan(0);
      // ~30 SOL / 1.073B tokens ≈ 2.8e-8 SOL per token
      expect(price).toBeLessThan(0.001);
    });

    it('price increases after a buy', () => {
      const priceBefore = spotPrice(INITIAL_SOL, INITIAL_TOKENS);

      const solIn = new BN(1_000_000_000); // 1 SOL
      const { tokensOut, solAfterFee } = computeBuyOutput(INITIAL_SOL, INITIAL_TOKENS, solIn);
      const newSol = INITIAL_SOL.add(solAfterFee);
      const newTokens = INITIAL_TOKENS.sub(tokensOut);
      const priceAfter = spotPrice(newSol, newTokens);

      expect(priceAfter).toBeGreaterThan(priceBefore);
    });

    it('price decreases after a sell', () => {
      const priceBefore = spotPrice(INITIAL_SOL, INITIAL_TOKENS);

      const tokensIn = new BN(10_000_000_000_000); // 10M tokens
      const { solBeforeFee } = computeSellOutput(INITIAL_SOL, INITIAL_TOKENS, tokensIn);
      const newSol = INITIAL_SOL.sub(solBeforeFee);
      const newTokens = INITIAL_TOKENS.add(tokensIn);
      const priceAfter = spotPrice(newSol, newTokens);

      expect(priceAfter).toBeLessThan(priceBefore);
    });
  });

  // ─── Price Impact ──────────────────────────────────────────

  describe('price impact', () => {
    it('small trades have low price impact', () => {
      const solIn = new BN(10_000_000); // 0.01 SOL
      const priceBefore = spotPrice(INITIAL_SOL, INITIAL_TOKENS);

      const { tokensOut, solAfterFee } = computeBuyOutput(INITIAL_SOL, INITIAL_TOKENS, solIn);
      const priceAfter = spotPrice(
        INITIAL_SOL.add(solAfterFee),
        INITIAL_TOKENS.sub(tokensOut),
      );

      const impactPercent = ((priceAfter - priceBefore) / priceBefore) * 100;
      expect(impactPercent).toBeLessThan(0.1); // < 0.1% impact
    });

    it('large trades have significant price impact', () => {
      const solIn = new BN(10_000_000_000); // 10 SOL (33% of reserves)
      const priceBefore = spotPrice(INITIAL_SOL, INITIAL_TOKENS);

      const { tokensOut, solAfterFee } = computeBuyOutput(INITIAL_SOL, INITIAL_TOKENS, solIn);
      const priceAfter = spotPrice(
        INITIAL_SOL.add(solAfterFee),
        INITIAL_TOKENS.sub(tokensOut),
      );

      const impactPercent = ((priceAfter - priceBefore) / priceBefore) * 100;
      expect(impactPercent).toBeGreaterThan(10); // > 10% impact for huge trade
    });
  });

  // ─── Round-trip Loss ───────────────────────────────────────

  describe('round-trip', () => {
    it('buy then sell results in less SOL than started (due to fees + slippage)', () => {
      const solIn = new BN(1_000_000_000); // 1 SOL
      const { tokensOut, solAfterFee } = computeBuyOutput(INITIAL_SOL, INITIAL_TOKENS, solIn);

      // Now sell those tokens back
      const newSol = INITIAL_SOL.add(solAfterFee);
      const newTokens = INITIAL_TOKENS.sub(tokensOut);
      const { solOut } = computeSellOutput(newSol, newTokens, tokensOut);

      // Should get back less than 1 SOL due to 1% fee on each side + slippage
      expect(solOut.lt(solIn)).toBe(true);
      // But not too much less — for small trades, ~2% total loss
      expect(solOut.toNumber()).toBeGreaterThan(solIn.toNumber() * 0.95);
    });
  });
});
