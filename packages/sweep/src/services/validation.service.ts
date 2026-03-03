import { SAFETY_CONFIG } from "../config/chains.js";
import {
  getValidatedPrice,
  checkTokenLiquidity,
  detectPriceAnomaly,
  detectHoneypot,
  checkTradingVolume,
  checkTokenAge,
  crossCheckOnChainOracles,
} from "./price.service.js";
import type { SweepValidation, TokenBalance, ValidatedPrice, LiquidityCheck, HoneypotCheck } from "../types/index.js";

// ============================================================
// Token Whitelist/Blacklist
// ============================================================

// Tokens with reliable pricing - auto-sweep allowed
const WHITELISTED_TOKENS: Record<string, Set<string>> = {
  ethereum: new Set([
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // USDC
    "0xdac17f958d2ee523a2206206994597c13d831ec7", // USDT
    "0x6b175474e89094c44da98b954eedeac495271d0f", // DAI
    "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", // WETH
    "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599", // WBTC
    "0x514910771af9ca656af840dff83e8264ecf986ca", // LINK
    "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984", // UNI
    "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9", // AAVE
  ].map(a => a.toLowerCase())),
  base: new Set([
    "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", // USDC
    "0x4200000000000000000000000000000000000006", // WETH
    "0x50c5725949a6f0c72e6c4a641f24049a917db0cb", // DAI
  ].map(a => a.toLowerCase())),
  arbitrum: new Set([
    "0xaf88d065e77c8cc2239327c5edb3a432268e5831", // USDC
    "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9", // USDT
    "0x82af49447d8a07e3bd95bd0d56f35241523fbab1", // WETH
    "0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f", // WBTC
    "0xfc5a1a6eb076a2c7ad06ed22c90d7e710e35ad0a", // GMX
    "0x912ce59144191c1204e64559fe8253a0e49e6548", // ARB
  ].map(a => a.toLowerCase())),
  polygon: new Set([
    "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359", // USDC
    "0xc2132d05d31c914a87c6611c10748aeb04b58e8f", // USDT
    "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619", // WETH
    "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270", // WMATIC
  ].map(a => a.toLowerCase())),
  bsc: new Set([
    "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d", // USDC
    "0x55d398326f99059ff775485246999027b3197955", // USDT
    "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c", // WBNB
    "0x2170ed0880ac9a755fd29b2688956bd959f933f8", // ETH
  ].map(a => a.toLowerCase())),
  optimism: new Set([
    "0x0b2c639c533813f4aa9d7837caf62653d097ff85", // USDC
    "0x94b008aa00579c1307b0ef2c499ad98a8ce58e58", // USDT
    "0x4200000000000000000000000000000000000006", // WETH
    "0x4200000000000000000000000000000000000042", // OP
  ].map(a => a.toLowerCase())),
  linea: new Set([
    "0x176211869ca2b568f2a7d4ee941e073a821ee1ff", // USDC
    "0xe5d7c2a44ffddf6b295a15c148167daaaf5cf34f", // WETH
  ].map(a => a.toLowerCase())),
};

// Known scam/dangerous tokens - NEVER sweep
const BLACKLISTED_TOKENS: Record<string, Set<string>> = {
  ethereum: new Set([
    // Add known scam addresses here
  ]),
  base: new Set([]),
  arbitrum: new Set([]),
  polygon: new Set([]),
  bsc: new Set([]),
  optimism: new Set([]),
  linea: new Set([]),
};

// Suspicious patterns in token names/symbols
const GRAYLISTED_PATTERNS = [
  /rebase/i,
  /elastic/i,
  /reflect/i,
  /safemoon/i,
  /baby/i,
  /shib/i,
  /doge/i,
  /elon/i,
  /moon/i,
  /rocket/i,
  /pump/i,
  /100x/i,
  /1000x/i,
];

function getTokenListStatus(
  tokenAddress: string,
  tokenSymbol: string,
  chain: string
): "WHITELIST" | "BLACKLIST" | "GRAYLIST" | "UNKNOWN" {
  const normalized = tokenAddress.toLowerCase();

  if (BLACKLISTED_TOKENS[chain]?.has(normalized)) {
    return "BLACKLIST";
  }

  if (WHITELISTED_TOKENS[chain]?.has(normalized)) {
    return "WHITELIST";
  }

  if (GRAYLISTED_PATTERNS.some((p) => p.test(tokenSymbol))) {
    return "GRAYLIST";
  }

  return "UNKNOWN";
}

// ============================================================
// Complete Sweep Validation Pipeline
// ============================================================

export async function validateSweep(
  token: TokenBalance
): Promise<SweepValidation> {
  const reasons: string[] = [];
  const { address: tokenAddress, symbol: tokenSymbol, chain, balance, decimals } = token;
  const amount = BigInt(balance);

  // Step 1: Check whitelist/blacklist
  const listStatus = getTokenListStatus(tokenAddress, tokenSymbol, chain);
  if (listStatus === "BLACKLIST") {
    return createBlockedValidation("Token is blacklisted", listStatus);
  }

  // Step 2: Multi-oracle price validation
  const validatedPrice = await getValidatedPrice(tokenAddress, chain);
  if (validatedPrice.confidence === "UNTRUSTED") {
    reasons.push("No reliable price data available");
  }

  // Step 3: Liquidity check
  const liquidityCheck = await checkTokenLiquidity(tokenAddress, chain);
  if (!liquidityCheck.isLiquid) {
    reasons.push(`Insufficient liquidity: $${liquidityCheck.liquidityUsd.toFixed(0)}`);
  }

  // Step 4: Anomaly detection
  const anomalyCheck = await detectPriceAnomaly(tokenAddress, chain, validatedPrice.price);
  if (anomalyCheck.isAnomalous) {
    reasons.push(`Price anomaly: ${(anomalyCheck.deviation * 100).toFixed(0)}% from 7d avg`);
  }

  // Step 5: Volume check
  const volumeCheck = await checkTradingVolume(tokenAddress, chain);
  if (!volumeCheck.sufficient) {
    reasons.push(`Low 24h volume: $${volumeCheck.volume24h.toFixed(0)}`);
  }

  // Step 6: Honeypot detection
  const honeypotCheck = await detectHoneypot(tokenAddress, chain);
  if (honeypotCheck.isHoneypot) {
    return createBlockedValidation("Honeypot detected", listStatus, validatedPrice, liquidityCheck, anomalyCheck, honeypotCheck);
  }
  if (honeypotCheck.sellTax > 10) {
    reasons.push(`High sell tax: ${honeypotCheck.sellTax.toFixed(1)}%`);
  }

  // Step 7: Token age check
  const ageCheck = await checkTokenAge(tokenAddress, chain);
  if (!ageCheck.isMature) {
    reasons.push(`New token: ${ageCheck.ageInDays.toFixed(1)} days old`);
  }

  // Step 8: On-chain oracle cross-check
  const oracleCheck = await crossCheckOnChainOracles(tokenAddress, chain, validatedPrice.price);
  if (!oracleCheck.valid && oracleCheck.deviation) {
    reasons.push(`Oracle mismatch: ${(oracleCheck.deviation * 100).toFixed(0)}% deviation`);
  }

  // Calculate expected value
  const tokenAmount = Number(amount) / Math.pow(10, decimals);
  const expectedValue = validatedPrice.price * tokenAmount;
  const minAcceptableValue = expectedValue * (1 - SAFETY_CONFIG.MAX_SLIPPAGE);

  // Execution guard
  const executionGuard = {
    canExecute: validatedPrice.confidence !== "UNTRUSTED" && liquidityCheck.isLiquid,
    requiresApproval: expectedValue > SAFETY_CONFIG.AUTO_SWEEP_THRESHOLD_USD,
    reason: expectedValue > SAFETY_CONFIG.AUTO_SWEEP_THRESHOLD_USD
      ? `Value exceeds auto-sweep threshold ($${expectedValue.toFixed(2)} > $${SAFETY_CONFIG.AUTO_SWEEP_THRESHOLD_USD})`
      : undefined,
    expectedValue,
    minAcceptableValue,
  };

  if (executionGuard.requiresApproval && executionGuard.reason) {
    reasons.push(executionGuard.reason);
  }

  // Final decision
  const canSweep =
    (listStatus as string) !== "BLACKLIST" &&
    validatedPrice.confidence !== "UNTRUSTED" &&
    liquidityCheck.isLiquid &&
    !honeypotCheck.isHoneypot &&
    honeypotCheck.sellTax <= 10;

  const requiresApproval =
    listStatus === "GRAYLIST" ||
    listStatus === "UNKNOWN" ||
    validatedPrice.requiresApproval ||
    anomalyCheck.isAnomalous ||
    executionGuard.requiresApproval ||
    !ageCheck.isMature ||
    !volumeCheck.sufficient;

  return {
    canSweep,
    requiresApproval,
    validatedPrice,
    liquidityCheck,
    anomalyCheck,
    executionGuard,
    honeypotCheck,
    listStatus,
    reasons,
  };
}

// ============================================================
// Filter Dust Tokens
// ============================================================

export interface DustToken {
  token: TokenBalance;
  usdValue: number;
  validation: SweepValidation;
}

export async function filterDustTokens(
  balances: TokenBalance[],
  minValueUsd: number = 0.01,
  maxValueUsd: number = 1000 // Don't consider large holdings as "dust"
): Promise<DustToken[]> {
  const dustTokens: DustToken[] = [];

  for (const token of balances) {
    // Validate the token
    const validation = await validateSweep(token);

    if (!validation.canSweep) {
      continue;
    }

    const usdValue = validation.executionGuard.expectedValue;

    // Filter by value range (dust = small but not worthless)
    if (usdValue >= minValueUsd && usdValue <= maxValueUsd) {
      dustTokens.push({
        token,
        usdValue,
        validation,
      });
    }
  }

  // Sort by value descending
  return dustTokens.sort((a, b) => b.usdValue - a.usdValue);
}

// ============================================================
// Helper Functions
// ============================================================

function createBlockedValidation(
  reason: string,
  listStatus: "WHITELIST" | "BLACKLIST" | "GRAYLIST" | "UNKNOWN",
  validatedPrice?: ValidatedPrice,
  liquidityCheck?: LiquidityCheck,
  anomalyCheck?: { isAnomalous: boolean; currentPrice: number; avg7d: number; deviation: number },
  honeypotCheck?: HoneypotCheck
): SweepValidation {
  return {
    canSweep: false,
    requiresApproval: false,
    validatedPrice: validatedPrice || {
      price: 0,
      confidence: "UNTRUSTED",
      sources: [],
      requiresApproval: true,
    },
    liquidityCheck: liquidityCheck || {
      isLiquid: false,
      liquidityUsd: 0,
      topPools: [],
    },
    anomalyCheck: anomalyCheck || {
      isAnomalous: true,
      currentPrice: 0,
      avg7d: 0,
      deviation: 1,
    },
    executionGuard: {
      canExecute: false,
      requiresApproval: false,
      expectedValue: 0,
      minAcceptableValue: 0,
    },
    honeypotCheck,
    listStatus,
    reasons: [reason],
  };
}
