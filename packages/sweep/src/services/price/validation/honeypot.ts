/**
 * Honeypot Detection Service
 * Detects scam tokens, honeypots, and high-tax tokens using honeypot.is API
 */

import { getRedis } from '../../../utils/redis.js';

export interface HoneypotAnalysis {
  isHoneypot: boolean;
  honeypotReason?: string;
  buyTax: number;
  sellTax: number;
  transferTax: number;
  isBlacklisted: boolean;
  isWhitelisted: boolean;
  isAntiWhale: boolean;
  isTradingCooldown: boolean;
  canBuy: boolean;
  canSell: boolean;
  maxBuy?: string;
  maxSell?: string;
  maxWallet?: string;
  contractVerified: boolean;
  isProxy: boolean;
  isPausable: boolean;
  isMintable: boolean;
  externalCalls: boolean;
  hiddenOwner: boolean;
  canTakeBackOwnership: boolean;
  ownerChangeBalance: boolean;
  simulationSuccess: boolean;
  simulationError?: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskScore: number; // 0-100
  flags: string[];
}

export interface HoneypotCheckResult {
  passed: boolean;
  analysis: HoneypotAnalysis;
  reason?: string;
}

const CHAIN_TO_HONEYPOT_CHAIN: Record<string, string> = {
  ethereum: 'eth',
  base: 'base',
  arbitrum: 'arbitrum',
  polygon: 'polygon',
  bsc: 'bsc',
  linea: 'linea',
  optimism: 'optimism',
  avalanche: 'avalanche',
};

// Maximum acceptable taxes
const MAX_BUY_TAX = 10; // 10%
const MAX_SELL_TAX = 10; // 10%
const MAX_TRANSFER_TAX = 5; // 5%

// Cache TTL
const HONEYPOT_CACHE_TTL = 3600; // 1 hour

/**
 * Check if a token is a honeypot using honeypot.is API
 */
export async function checkHoneypot(
  tokenAddress: string,
  chain: string
): Promise<HoneypotCheckResult> {
  const cacheKey = `honeypot:${chain}:${tokenAddress.toLowerCase()}`;
  
  // Check cache first
  const cached = await getRedis().get(cacheKey);
  if (cached) {
    const analysis = JSON.parse(cached) as HoneypotAnalysis;
    return evaluateAnalysis(analysis);
  }

  const honeypotChain = CHAIN_TO_HONEYPOT_CHAIN[chain];
  if (!honeypotChain) {
    return {
      passed: false,
      analysis: createUnknownAnalysis(),
      reason: `Chain ${chain} not supported by honeypot detection`,
    };
  }

  try {
    // Call honeypot.is API
    const response = await fetch(
      `https://api.honeypot.is/v2/IsHoneypot?address=${tokenAddress}&chainID=${getChainId(chain)}`,
      {
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!response.ok) {
      // Fallback to GoPlus API
      return await checkGoPlusSecurity(tokenAddress, chain);
    }

    const data = await response.json();
    const analysis = parseHoneypotResponse(data);
    
    // Cache the result
    await getRedis().setex(cacheKey, HONEYPOT_CACHE_TTL, JSON.stringify(analysis));
    
    return evaluateAnalysis(analysis);
  } catch (error) {
    console.error(`Honeypot check failed for ${tokenAddress}:`, error);
    // Fallback to GoPlus
    return await checkGoPlusSecurity(tokenAddress, chain);
  }
}

/**
 * Fallback: Check token security using GoPlus API
 */
async function checkGoPlusSecurity(
  tokenAddress: string,
  chain: string
): Promise<HoneypotCheckResult> {
  const chainId = getChainId(chain);
  
  try {
    const response = await fetch(
      `https://api.gopluslabs.io/api/v1/token_security/${chainId}?contract_addresses=${tokenAddress}`,
      {
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!response.ok) {
      return {
        passed: false,
        analysis: createUnknownAnalysis(),
        reason: 'Security check APIs unavailable',
      };
    }

    const data = await response.json();
    const tokenData = data.result?.[tokenAddress.toLowerCase()];
    
    if (!tokenData) {
      return {
        passed: false,
        analysis: createUnknownAnalysis(),
        reason: 'Token not found in security database',
      };
    }

    const analysis = parseGoPlusResponse(tokenData);
    
    // Cache the result
    const cacheKey = `honeypot:${chain}:${tokenAddress.toLowerCase()}`;
    await getRedis().setex(cacheKey, HONEYPOT_CACHE_TTL, JSON.stringify(analysis));
    
    return evaluateAnalysis(analysis);
  } catch (error) {
    console.error(`GoPlus check failed for ${tokenAddress}:`, error);
    return {
      passed: false,
      analysis: createUnknownAnalysis(),
      reason: 'Security check failed',
    };
  }
}

/**
 * Parse honeypot.is API response
 */
function parseHoneypotResponse(data: any): HoneypotAnalysis {
  const flags: string[] = [];
  
  const honeypotResult = data.honeypotResult || {};
  const simulationResult = data.simulationResult || {};
  const contractCode = data.contractCode || {};
  const holderAnalysis = data.holderAnalysis || {};
  
  // Extract tax information
  const buyTax = parseFloat(simulationResult.buyTax || '0') * 100;
  const sellTax = parseFloat(simulationResult.sellTax || '0') * 100;
  const transferTax = parseFloat(simulationResult.transferTax || '0') * 100;
  
  // Collect flags
  if (honeypotResult.isHoneypot) flags.push('HONEYPOT');
  if (buyTax > MAX_BUY_TAX) flags.push('HIGH_BUY_TAX');
  if (sellTax > MAX_SELL_TAX) flags.push('HIGH_SELL_TAX');
  if (transferTax > MAX_TRANSFER_TAX) flags.push('HIGH_TRANSFER_TAX');
  if (contractCode.isProxy) flags.push('PROXY_CONTRACT');
  if (!contractCode.isVerified) flags.push('UNVERIFIED_CONTRACT');
  if (contractCode.isMintable) flags.push('MINTABLE');
  if (contractCode.canPause) flags.push('PAUSABLE');
  if (contractCode.hasExternalCalls) flags.push('EXTERNAL_CALLS');
  if (contractCode.hiddenOwner) flags.push('HIDDEN_OWNER');
  if (contractCode.canTakeBackOwnership) flags.push('OWNERSHIP_TAKEBACK');
  if (contractCode.ownerChangeBalance) flags.push('OWNER_CAN_CHANGE_BALANCE');
  if (data.flags?.isBlacklisted) flags.push('BLACKLIST_FUNCTION');
  if (data.flags?.isWhitelisted) flags.push('WHITELIST_FUNCTION');
  if (data.flags?.isAntiWhale) flags.push('ANTI_WHALE');
  if (data.flags?.hasTradingCooldown) flags.push('TRADING_COOLDOWN');

  // Calculate risk score
  const riskScore = calculateRiskScore(flags, buyTax, sellTax);
  
  return {
    isHoneypot: honeypotResult.isHoneypot || false,
    honeypotReason: honeypotResult.honeypotReason,
    buyTax,
    sellTax,
    transferTax,
    isBlacklisted: data.flags?.isBlacklisted || false,
    isWhitelisted: data.flags?.isWhitelisted || false,
    isAntiWhale: data.flags?.isAntiWhale || false,
    isTradingCooldown: data.flags?.hasTradingCooldown || false,
    canBuy: simulationResult.buySuccess !== false,
    canSell: simulationResult.sellSuccess !== false,
    maxBuy: data.flags?.maxTransactionAmount,
    maxSell: data.flags?.maxTransactionAmount,
    maxWallet: data.flags?.maxWalletAmount,
    contractVerified: contractCode.isVerified || false,
    isProxy: contractCode.isProxy || false,
    isPausable: contractCode.canPause || false,
    isMintable: contractCode.isMintable || false,
    externalCalls: contractCode.hasExternalCalls || false,
    hiddenOwner: contractCode.hiddenOwner || false,
    canTakeBackOwnership: contractCode.canTakeBackOwnership || false,
    ownerChangeBalance: contractCode.ownerChangeBalance || false,
    simulationSuccess: simulationResult.success !== false,
    simulationError: simulationResult.error,
    riskLevel: getRiskLevel(riskScore),
    riskScore,
    flags,
  };
}

/**
 * Parse GoPlus API response
 */
function parseGoPlusResponse(data: any): HoneypotAnalysis {
  const flags: string[] = [];
  
  const buyTax = parseFloat(data.buy_tax || '0') * 100;
  const sellTax = parseFloat(data.sell_tax || '0') * 100;
  
  // Collect flags from GoPlus
  if (data.is_honeypot === '1') flags.push('HONEYPOT');
  if (data.is_blacklisted === '1') flags.push('BLACKLIST_FUNCTION');
  if (data.is_whitelisted === '1') flags.push('WHITELIST_FUNCTION');
  if (data.is_anti_whale === '1') flags.push('ANTI_WHALE');
  if (data.trading_cooldown === '1') flags.push('TRADING_COOLDOWN');
  if (data.is_proxy === '1') flags.push('PROXY_CONTRACT');
  if (data.is_open_source !== '1') flags.push('UNVERIFIED_CONTRACT');
  if (data.is_mintable === '1') flags.push('MINTABLE');
  if (data.can_take_back_ownership === '1') flags.push('OWNERSHIP_TAKEBACK');
  if (data.owner_change_balance === '1') flags.push('OWNER_CAN_CHANGE_BALANCE');
  if (data.hidden_owner === '1') flags.push('HIDDEN_OWNER');
  if (data.external_call === '1') flags.push('EXTERNAL_CALLS');
  if (data.selfdestruct === '1') flags.push('SELF_DESTRUCT');
  if (buyTax > MAX_BUY_TAX) flags.push('HIGH_BUY_TAX');
  if (sellTax > MAX_SELL_TAX) flags.push('HIGH_SELL_TAX');

  const riskScore = calculateRiskScore(flags, buyTax, sellTax);
  
  return {
    isHoneypot: data.is_honeypot === '1',
    honeypotReason: data.honeypot_with_same_creator === '1' ? 'Creator has deployed honeypots' : undefined,
    buyTax,
    sellTax,
    transferTax: 0,
    isBlacklisted: data.is_blacklisted === '1',
    isWhitelisted: data.is_whitelisted === '1',
    isAntiWhale: data.is_anti_whale === '1',
    isTradingCooldown: data.trading_cooldown === '1',
    canBuy: data.cannot_buy !== '1',
    canSell: data.cannot_sell_all !== '1',
    contractVerified: data.is_open_source === '1',
    isProxy: data.is_proxy === '1',
    isPausable: false, // Not in GoPlus
    isMintable: data.is_mintable === '1',
    externalCalls: data.external_call === '1',
    hiddenOwner: data.hidden_owner === '1',
    canTakeBackOwnership: data.can_take_back_ownership === '1',
    ownerChangeBalance: data.owner_change_balance === '1',
    simulationSuccess: true,
    riskLevel: getRiskLevel(riskScore),
    riskScore,
    flags,
  };
}

/**
 * Calculate risk score from flags and taxes
 */
function calculateRiskScore(flags: string[], buyTax: number, sellTax: number): number {
  let score = 0;
  
  // Critical flags (instant fail)
  if (flags.includes('HONEYPOT')) score += 100;
  if (flags.includes('OWNER_CAN_CHANGE_BALANCE')) score += 50;
  if (flags.includes('SELF_DESTRUCT')) score += 50;
  
  // High risk flags
  if (flags.includes('HIDDEN_OWNER')) score += 25;
  if (flags.includes('OWNERSHIP_TAKEBACK')) score += 25;
  if (flags.includes('UNVERIFIED_CONTRACT')) score += 20;
  if (flags.includes('EXTERNAL_CALLS')) score += 15;
  if (flags.includes('MINTABLE')) score += 10;
  
  // Medium risk flags
  if (flags.includes('PROXY_CONTRACT')) score += 10;
  if (flags.includes('PAUSABLE')) score += 10;
  if (flags.includes('BLACKLIST_FUNCTION')) score += 10;
  if (flags.includes('WHITELIST_FUNCTION')) score += 5;
  if (flags.includes('ANTI_WHALE')) score += 5;
  if (flags.includes('TRADING_COOLDOWN')) score += 5;
  
  // Tax-based scoring
  if (buyTax > 50) score += 40;
  else if (buyTax > 20) score += 20;
  else if (buyTax > 10) score += 10;
  
  if (sellTax > 50) score += 40;
  else if (sellTax > 20) score += 20;
  else if (sellTax > 10) score += 10;
  
  return Math.min(score, 100);
}

/**
 * Get risk level from score
 */
function getRiskLevel(score: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  if (score >= 75) return 'CRITICAL';
  if (score >= 50) return 'HIGH';
  if (score >= 25) return 'MEDIUM';
  return 'LOW';
}

/**
 * Create unknown analysis for unsupported chains/failed checks
 */
function createUnknownAnalysis(): HoneypotAnalysis {
  return {
    isHoneypot: false,
    buyTax: 0,
    sellTax: 0,
    transferTax: 0,
    isBlacklisted: false,
    isWhitelisted: false,
    isAntiWhale: false,
    isTradingCooldown: false,
    canBuy: true,
    canSell: true,
    contractVerified: false,
    isProxy: false,
    isPausable: false,
    isMintable: false,
    externalCalls: false,
    hiddenOwner: false,
    canTakeBackOwnership: false,
    ownerChangeBalance: false,
    simulationSuccess: false,
    riskLevel: 'HIGH', // Conservative when unknown
    riskScore: 50,
    flags: ['UNKNOWN_SECURITY'],
  };
}

/**
 * Evaluate analysis and return pass/fail result
 */
function evaluateAnalysis(analysis: HoneypotAnalysis): HoneypotCheckResult {
  // Automatic fail conditions
  if (analysis.isHoneypot) {
    return {
      passed: false,
      analysis,
      reason: `Token is a honeypot: ${analysis.honeypotReason || 'Cannot sell'}`,
    };
  }
  
  if (!analysis.canSell) {
    return {
      passed: false,
      analysis,
      reason: 'Token cannot be sold',
    };
  }
  
  if (analysis.sellTax > MAX_SELL_TAX) {
    return {
      passed: false,
      analysis,
      reason: `Sell tax too high: ${analysis.sellTax.toFixed(1)}%`,
    };
  }
  
  if (analysis.ownerChangeBalance) {
    return {
      passed: false,
      analysis,
      reason: 'Owner can modify balances',
    };
  }
  
  if (analysis.riskLevel === 'CRITICAL') {
    return {
      passed: false,
      analysis,
      reason: `Critical risk level (score: ${analysis.riskScore})`,
    };
  }
  
  // High risk requires manual approval
  if (analysis.riskLevel === 'HIGH') {
    return {
      passed: true,
      analysis,
      reason: 'High risk - requires user approval',
    };
  }
  
  return {
    passed: true,
    analysis,
  };
}

/**
 * Get chain ID for API calls
 */
function getChainId(chain: string): number {
  const chainIds: Record<string, number> = {
    ethereum: 1,
    base: 8453,
    arbitrum: 42161,
    polygon: 137,
    bsc: 56,
    linea: 59144,
    optimism: 10,
    avalanche: 43114,
  };
  return chainIds[chain] || 1;
}

/**
 * Batch check multiple tokens
 */
export async function batchCheckHoneypot(
  tokens: { address: string; chain: string }[]
): Promise<Map<string, HoneypotCheckResult>> {
  const results = new Map<string, HoneypotCheckResult>();
  
  // Process in parallel with concurrency limit
  const BATCH_SIZE = 5;
  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    const batch = tokens.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(t => checkHoneypot(t.address, t.chain))
    );
    
    batch.forEach((token, idx) => {
      results.set(`${token.chain}:${token.address.toLowerCase()}`, batchResults[idx]);
    });
  }
  
  return results;
}

/**
 * Detect honeypot - alias for checkHoneypot for compatibility
 */
export async function detectHoneypot(
  tokenAddress: string,
  chain: string
): Promise<HoneypotCheckResult> {
  return checkHoneypot(tokenAddress, chain);
}

/**
 * Determine if a token should be swept based on security analysis
 */
export function shouldSweepBasedOnSecurity(result: HoneypotCheckResult): boolean {
  if (!result.passed) return false;
  
  const { analysis } = result;
  
  // Don't sweep if it's a confirmed honeypot
  if (analysis.isHoneypot) return false;
  
  // Don't sweep if taxes are too high
  if (analysis.buyTax > MAX_BUY_TAX || analysis.sellTax > MAX_SELL_TAX) return false;
  
  // Don't sweep critical risk tokens
  if (analysis.riskLevel === 'CRITICAL') return false;
  
  // High risk requires manual approval (return false for auto-sweep)
  if (analysis.riskLevel === 'HIGH') return false;
  
  return true;
}

/**
 * Get a safety score for a token (0-100, higher is safer)
 */
export function getTokenSafetyScore(analysis: HoneypotAnalysis): number {
  // Start with inverse of risk score
  return Math.max(0, 100 - analysis.riskScore);
}
