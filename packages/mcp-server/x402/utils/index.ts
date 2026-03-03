/**
 * x402 Developer Utilities
 * @description Utilities for working with x402 payments
 * @author nirholas
 * @license Apache-2.0
 */

export { formatPayment, parsePayment, createPaymentHeader, validatePaymentRequest, estimateTotalCost } from '../cli/utils/payment.js';
export { generateWallet, generateWalletWithMnemonic, exportWallet, importWallet, deriveAddress, isValidPrivateKey, isValidAddress, maskPrivateKey } from '../cli/utils/wallet.js';
export { formatUSD, formatCrypto, shortenAddress, formatDate, formatTxLink, formatJSON, progressBar, formatBytes, formatDuration } from '../cli/utils/format.js';

import type { X402Chain, X402Token, PaymentRequest } from '../sdk/types.js';

/**
 * Convert between token decimals and human-readable amounts
 */
export function toTokenDecimals(amount: string | number, decimals: number = 18): bigint {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return BigInt(Math.floor(num * Math.pow(10, decimals)));
}

/**
 * Convert from token decimals to human-readable amounts
 */
export function fromTokenDecimals(amount: bigint, decimals: number = 18): string {
  const divisor = BigInt(Math.pow(10, decimals));
  const wholePart = amount / divisor;
  const fractionalPart = amount % divisor;
  
  // Pad fractional part with leading zeros
  const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
  
  // Trim trailing zeros but keep at least 2 decimal places
  const trimmed = fractionalStr.replace(/0+$/, '') || '00';
  const finalFraction = trimmed.length < 2 ? trimmed.padEnd(2, '0') : trimmed;
  
  return `${wholePart}.${finalFraction}`;
}

/**
 * Parse amount string with support for various formats
 * Supports: "10", "10.5", "10 USDs", "$10.50", "10.5 USDC"
 */
export function parseAmount(input: string): { amount: number; token?: X402Token } {
  // Remove currency symbols and whitespace
  const cleaned = input.trim().replace(/^\$/, '');
  
  // Check for token suffix
  const tokenMatch = cleaned.match(/^([\d.]+)\s*(USDs?|USDC?|USDT?|DAI|ETH)?$/i);
  
  if (tokenMatch) {
    const amount = parseFloat(tokenMatch[1]);
    const tokenStr = tokenMatch[2]?.toUpperCase();
    
    // Normalize token names
    const token = tokenStr === 'USD' ? 'USDs' 
      : tokenStr === 'USDS' ? 'USDs'
      : tokenStr as X402Token | undefined;
    
    return { amount, token };
  }
  
  return { amount: parseFloat(cleaned) };
}

/**
 * Format payment amount for display with token
 */
export function formatAmount(amount: string | number, token: X402Token = 'USDs'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  const formatted = num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
  return `${formatted} ${token}`;
}

/**
 * Check if a URL is likely to require payment (heuristic)
 */
export function isPaidEndpoint(url: string): boolean {
  const paidPatterns = [
    /\/api\/paid\//i,
    /\/premium\//i,
    /\/pro\//i,
    /\/paid\//i,
    /x-price/i,
    /402/i,
  ];
  
  return paidPatterns.some(pattern => pattern.test(url));
}

/**
 * Create a standardized x402 price tag for documentation/display
 */
export function createPriceTag(amount: string, token: X402Token = 'USDs', period?: string): string {
  const formatted = formatAmount(amount, token);
  return period ? `${formatted}/${period}` : formatted;
}

/**
 * Calculate payment with optional fee
 */
export function calculatePaymentWithFee(
  amount: string | number,
  feePercent: number = 0
): { amount: string; fee: string; total: string } {
  const baseAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  const fee = baseAmount * (feePercent / 100);
  const total = baseAmount + fee;
  
  return {
    amount: baseAmount.toFixed(6),
    fee: fee.toFixed(6),
    total: total.toFixed(6),
  };
}

/**
 * Generate a unique payment reference/nonce
 */
export function generatePaymentReference(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `x402-${timestamp}-${random}`;
}

/**
 * Parse payment reference to extract timestamp
 */
export function parsePaymentReference(ref: string): { timestamp: number; random: string } | null {
  const match = ref.match(/^x402-([a-z0-9]+)-([a-z0-9]+)$/);
  if (!match) return null;
  
  return {
    timestamp: parseInt(match[1], 36),
    random: match[2],
  };
}

/**
 * Get chain explorer URL for address or transaction
 */
export function getExplorerUrl(
  hash: string, 
  chain: X402Chain, 
  type: 'tx' | 'address' | 'token' = 'tx'
): string {
  const explorers: Record<X402Chain, string> = {
    arbitrum: 'https://arbiscan.io',
    'arbitrum-sepolia': 'https://sepolia.arbiscan.io',
    base: 'https://basescan.org',
    ethereum: 'https://etherscan.io',
    polygon: 'https://polygonscan.com',
    optimism: 'https://optimistic.etherscan.io',
    bsc: 'https://bscscan.com',
  };
  
  return `${explorers[chain]}/${type}/${hash}`;
}

/**
 * Validate and normalize chain name
 */
export function normalizeChain(chain: string): X402Chain | null {
  const chainMap: Record<string, X402Chain> = {
    arbitrum: 'arbitrum',
    arb: 'arbitrum',
    'arbitrum-one': 'arbitrum',
    'arbitrum-sepolia': 'arbitrum-sepolia',
    'arb-sepolia': 'arbitrum-sepolia',
    base: 'base',
    ethereum: 'ethereum',
    eth: 'ethereum',
    mainnet: 'ethereum',
    polygon: 'polygon',
    matic: 'polygon',
    optimism: 'optimism',
    op: 'optimism',
    bsc: 'bsc',
    bnb: 'bsc',
    'binance-smart-chain': 'bsc',
  };
  
  return chainMap[chain.toLowerCase()] || null;
}

/**
 * Get USDs token address for a chain
 */
export function getUSDsAddress(chain: X402Chain): `0x${string}` | null {
  const addresses: Partial<Record<X402Chain, `0x${string}`>> = {
    arbitrum: '0xD74f5255D557944cf7Dd0e45FF521520002D5748',
    'arbitrum-sepolia': '0x5555555555555555555555555555555555555555', // Placeholder
  };
  
  return addresses[chain] || null;
}

/**
 * Estimate gas cost in USD
 */
export function estimateGasUSD(
  gasLimit: number,
  gasPriceGwei: number,
  ethPriceUSD: number
): number {
  const gasEth = (gasLimit * gasPriceGwei) / 1e9;
  return gasEth * ethPriceUSD;
}

/**
 * Format Wei to ETH string
 */
export function weiToEth(wei: bigint | string | number): string {
  const weiBigInt = typeof wei === 'bigint' ? wei : BigInt(wei);
  return fromTokenDecimals(weiBigInt, 18);
}

/**
 * Format ETH to Wei
 */
export function ethToWei(eth: string | number): bigint {
  return toTokenDecimals(eth, 18);
}

/**
 * Sleep utility for async operations
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry an async operation with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: { maxRetries?: number; baseDelay?: number; maxDelay?: number } = {}
): Promise<T> {
  const { maxRetries = 3, baseDelay = 1000, maxDelay = 10000 } = options;
  
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < maxRetries - 1) {
        const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
        await sleep(delay);
      }
    }
  }
  
  throw lastError;
}
