/**
 * @fileoverview X402 Payment Verification
 * @description Verify payments on-chain, prevent replay attacks, validate amounts
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 * 
 * @example Basic Verification
 * ```typescript
 * const verifier = new X402PaymentVerifier({ chain: 'arbitrum' });
 * 
 * const result = await verifier.verify({
 *   proof: '0xabc123...',
 *   expected: {
 *     amount: '10.00',
 *     token: 'USDs',
 *     chain: 'arbitrum',
 *     recipient: '0x...'
 *   }
 * });
 * 
 * if (result.valid) {
 *   console.log('Payment verified!');
 * }
 * ```
 * 
 * @example With Replay Protection
 * ```typescript
 * const verifier = new X402PaymentVerifier({
 *   chain: 'arbitrum',
 *   nonceStore: new RedisNonceStore(redis),
 * });
 * 
 * // Same proof will be rejected on second use
 * const result = await verifier.verify({
 *   proof: txHash,
 *   expected: paymentRequest,
 *   allowReplay: false,
 * });
 * ```
 */

import {
  createPublicClient,
  http,
  type Address,
  type Hash,
  type PublicClient,
  parseAbi,
  formatUnits,
} from 'viem';
import { arbitrum, arbitrumSepolia, base, baseSepolia, mainnet, polygon, optimism, bsc } from 'viem/chains';
import type { PaymentRequest, X402Chain, X402Token } from '../sdk/types.js';
import type {
  VerificationRequest,
  VerificationResult,
  NonceStore,
} from './types.js';
import { NETWORKS } from '../sdk/constants.js';
import Logger from '@/utils/logger.js';

// ============================================================================
// Chain Configuration
// ============================================================================

/**
 * Viem chain mapping
 */
const VIEM_CHAINS = {
  arbitrum,
  'arbitrum-sepolia': arbitrumSepolia,
  base,
  'base-sepolia': baseSepolia,
  ethereum: mainnet,
  polygon,
  optimism,
  bsc,
};

/**
 * Token addresses by chain
 */
const TOKEN_ADDRESSES: Partial<Record<X402Chain, Partial<Record<X402Token, Address>>>> = {
  arbitrum: {
    USDs: '0xD74f5255D557944cf7Dd0E45FF521520002D5748',
    USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
  },
  'arbitrum-sepolia': {
    USDs: '0xD74f5255D557944cf7Dd0E45FF521520002D5748',
    USDC: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
  },
  base: {
    USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  },
  ethereum: {
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    DAI: '0x6B175474E89094C44Da98b954EesdfCD2B891515',
  },
  polygon: {
    USDC: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
  },
  optimism: {
    USDC: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
  },
  bsc: {
    USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    USDT: '0x55d398326f99059fF775485246999027B3197955',
  },
};

/**
 * Token decimals
 */
const TOKEN_DECIMALS: Record<X402Token, number> = {
  USDs: 18,
  USDC: 6,
  USDT: 6,
  DAI: 18,
  ETH: 18,
  SOL: 9,
};

/**
 * ERC20 Transfer event ABI
 */
const ERC20_TRANSFER_EVENT = parseAbi([
  'event Transfer(address indexed from, address indexed to, uint256 value)',
]);

// ============================================================================
// In-Memory Nonce Store
// ============================================================================

/**
 * Simple in-memory nonce store for replay protection
 * Use Redis or database store in production
 */
export class InMemoryNonceStore implements NonceStore {
  private readonly nonces = new Map<string, number>();
  private readonly defaultTtl: number;

  constructor(defaultTtlSeconds = 3600) {
    this.defaultTtl = defaultTtlSeconds * 1000;
    
    // Cleanup expired nonces every minute
    setInterval(() => this.cleanup(), 60000);
  }

  async has(nonce: string): Promise<boolean> {
    const expiry = this.nonces.get(nonce);
    if (expiry === undefined) return false;
    
    if (Date.now() > expiry) {
      this.nonces.delete(nonce);
      return false;
    }
    
    return true;
  }

  async add(nonce: string, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds ? ttlSeconds * 1000 : this.defaultTtl;
    this.nonces.set(nonce, Date.now() + ttl);
  }

  async cleanup(): Promise<void> {
    const now = Date.now();
    for (const [nonce, expiry] of this.nonces.entries()) {
      if (now > expiry) {
        this.nonces.delete(nonce);
      }
    }
  }

  /** Get count of stored nonces (for monitoring) */
  get size(): number {
    return this.nonces.size;
  }
}

// ============================================================================
// Payment Verifier
// ============================================================================

/**
 * Verifier configuration
 */
export interface VerifierConfig {
  /** Blockchain network */
  chain: X402Chain;
  /** Custom RPC URL */
  rpcUrl?: string;
  /** Public client (optional, created if not provided) */
  publicClient?: PublicClient;
  /** Nonce store for replay protection */
  nonceStore?: NonceStore;
  /** Default nonce TTL in seconds */
  nonceTtlSeconds?: number;
  /** Required confirmations for on-chain verification */
  requiredConfirmations?: number;
  /** Allow small amount discrepancies (as percentage) */
  amountTolerancePercent?: number;
  /** Cache verification results */
  cacheResults?: boolean;
  /** Cache TTL in seconds */
  cacheTtlSeconds?: number;
}

/**
 * X402 Payment Verifier
 * 
 * Verifies payments on-chain with replay protection
 */
export class X402PaymentVerifier {
  private readonly publicClient: PublicClient;
  private readonly chain: X402Chain;
  private readonly nonceStore: NonceStore;
  private readonly config: Required<Pick<VerifierConfig, 'requiredConfirmations' | 'amountTolerancePercent' | 'cacheResults' | 'cacheTtlSeconds' | 'nonceTtlSeconds'>>;
  
  // Verification cache
  private readonly cache = new Map<string, { result: VerificationResult; expiry: number }>();

  constructor(config: VerifierConfig) {
    this.chain = config.chain;
    this.nonceStore = config.nonceStore || new InMemoryNonceStore(config.nonceTtlSeconds);
    
    this.config = {
      requiredConfirmations: config.requiredConfirmations ?? 1,
      amountTolerancePercent: config.amountTolerancePercent ?? 0,
      cacheResults: config.cacheResults ?? true,
      cacheTtlSeconds: config.cacheTtlSeconds ?? 300,
      nonceTtlSeconds: config.nonceTtlSeconds ?? 3600,
    };

    // Create public client
    if (config.publicClient) {
      this.publicClient = config.publicClient;
    } else {
      const viemChain = VIEM_CHAINS[this.chain];
      const rpcUrl = config.rpcUrl || NETWORKS[this.chain]?.rpcUrl;
      
      this.publicClient = createPublicClient({
        chain: viemChain,
        transport: http(rpcUrl),
      }) as PublicClient;
    }
  }

  // ============================================================================
  // Main Verification Methods
  // ============================================================================

  /**
   * Verify a payment
   * 
   * @param request - Verification request
   * @returns Verification result
   * 
   * @example
   * ```typescript
   * const result = await verifier.verify({
   *   proof: '0xabc123...',
   *   expected: {
   *     amount: '10.00',
   *     token: 'USDs',
   *     chain: 'arbitrum',
   *     recipient: '0x...'
   *   },
   *   allowReplay: false
   * });
   * ```
   */
  async verify(request: VerificationRequest): Promise<VerificationResult> {
    const { proof, expected, allowReplay = false } = request;
    const cacheKey = `${this.chain}:${proof}`;

    // Check cache first
    if (this.config.cacheResults) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() < cached.expiry) {
        // If cached result was valid and replay not allowed, check replay
        if (cached.result.valid && !allowReplay) {
          const isReplay = await this.nonceStore.has(proof);
          if (isReplay) {
            return {
              ...cached.result,
              valid: false,
              isReplay: true,
              error: 'Payment proof has already been used (replay attack)',
            };
          }
        }
        return { ...cached.result, method: 'cached' };
      }
    }

    // Check for replay attack
    if (!allowReplay) {
      const isReplay = await this.nonceStore.has(proof);
      if (isReplay) {
        return {
          valid: false,
          method: 'on-chain',
          isReplay: true,
          error: 'Payment proof has already been used (replay attack)',
        };
      }
    }

    // Verify on-chain
    const result = await this.verifyOnChain(proof as Hash, expected);

    // Cache result
    if (this.config.cacheResults && result.valid) {
      this.cache.set(cacheKey, {
        result,
        expiry: Date.now() + this.config.cacheTtlSeconds * 1000,
      });
    }

    // Mark nonce as used if valid and replay protection enabled
    if (result.valid && !allowReplay) {
      await this.nonceStore.add(proof, this.config.nonceTtlSeconds);
    }

    return result;
  }

  /**
   * Batch verify multiple payments
   * 
   * @param requests - Array of verification requests
   * @returns Array of verification results
   */
  async verifyBatch(requests: VerificationRequest[]): Promise<VerificationResult[]> {
    return Promise.all(requests.map(req => this.verify(req)));
  }

  /**
   * Quick check if a transaction exists and is confirmed
   * Does not verify amount or recipient
   * 
   * @param txHash - Transaction hash
   * @returns True if transaction exists and is confirmed
   */
  async quickCheck(txHash: Hash): Promise<boolean> {
    try {
      const receipt = await this.publicClient.getTransactionReceipt({ hash: txHash });
      return receipt?.status === 'success';
    } catch {
      return false;
    }
  }

  // ============================================================================
  // On-Chain Verification
  // ============================================================================

  /**
   * Verify payment on-chain
   */
  private async verifyOnChain(
    txHash: Hash,
    expected: PaymentRequest
  ): Promise<VerificationResult> {
    try {
      // Get transaction receipt
      const receipt = await this.publicClient.getTransactionReceipt({ hash: txHash });
      
      if (!receipt) {
        return {
          valid: false,
          method: 'on-chain',
          error: 'Transaction not found',
        };
      }

      if (receipt.status !== 'success') {
        return {
          valid: false,
          method: 'on-chain',
          txHash,
          error: 'Transaction failed or reverted',
        };
      }

      // Check confirmations
      const currentBlock = await this.publicClient.getBlockNumber();
      const confirmations = Number(currentBlock - receipt.blockNumber);
      
      if (confirmations < this.config.requiredConfirmations) {
        return {
          valid: false,
          method: 'on-chain',
          txHash,
          blockNumber: Number(receipt.blockNumber),
          error: `Insufficient confirmations: ${confirmations} < ${this.config.requiredConfirmations}`,
        };
      }

      // Get transaction details
      const tx = await this.publicClient.getTransaction({ hash: txHash });
      
      // Get block for timestamp
      const block = await this.publicClient.getBlock({ blockNumber: receipt.blockNumber });

      // Verify based on token type
      let verificationResult: {
        valid: boolean;
        paidAmount?: string;
        payer?: Address;
        actualRecipient?: Address;
        error?: string;
      };

      if (expected.token === 'ETH') {
        // Native token transfer
        verificationResult = this.verifyNativeTransfer(tx, expected);
      } else {
        // ERC20 transfer - parse logs
        verificationResult = await this.verifyErc20Transfer(receipt, expected);
      }

      if (!verificationResult.valid) {
        return {
          valid: false,
          method: 'on-chain',
          txHash,
          blockNumber: Number(receipt.blockNumber),
          timestamp: Number(block.timestamp) * 1000,
          payer: verificationResult.payer,
          paidAmount: verificationResult.paidAmount,
          error: verificationResult.error,
        };
      }

      return {
        valid: true,
        method: 'on-chain',
        txHash,
        blockNumber: Number(receipt.blockNumber),
        timestamp: Number(block.timestamp) * 1000,
        payer: verificationResult.payer,
        paidAmount: verificationResult.paidAmount,
      };
    } catch (error) {
      Logger.error(`x402: On-chain verification failed: ${error instanceof Error ? error.message : error}`);
      return {
        valid: false,
        method: 'on-chain',
        txHash,
        error: error instanceof Error ? error.message : 'Verification failed',
      };
    }
  }

  /**
   * Verify native ETH transfer
   */
  private verifyNativeTransfer(
    tx: { from: Address; to: Address | null; value: bigint },
    expected: PaymentRequest
  ): { valid: boolean; paidAmount?: string; payer?: Address; error?: string } {
    const payer = tx.from;
    const recipient = tx.to;
    const paidAmount = formatUnits(tx.value, 18);

    // Check recipient
    if (!recipient || recipient.toLowerCase() !== expected.recipient.toLowerCase()) {
      return {
        valid: false,
        payer,
        paidAmount,
        error: `Recipient mismatch: expected ${expected.recipient}, got ${recipient}`,
      };
    }

    // Check amount
    if (!this.isAmountSufficient(paidAmount, expected.amount)) {
      return {
        valid: false,
        payer,
        paidAmount,
        error: `Amount insufficient: expected ${expected.amount}, got ${paidAmount}`,
      };
    }

    return { valid: true, payer, paidAmount };
  }

  /**
   * Verify ERC20 transfer from transaction logs
   */
  private async verifyErc20Transfer(
    receipt: { logs: Array<{ address: Address; topics: readonly `0x${string}`[]; data: `0x${string}` }> },
    expected: PaymentRequest
  ): Promise<{ valid: boolean; paidAmount?: string; payer?: Address; error?: string }> {
    const tokenAddress = TOKEN_ADDRESSES[this.chain]?.[expected.token];
    const decimals = TOKEN_DECIMALS[expected.token] ?? 18;

    if (!tokenAddress) {
      return {
        valid: false,
        error: `Token ${expected.token} not supported on ${this.chain}`,
      };
    }

    // Find Transfer event to recipient
    for (const log of receipt.logs) {
      // Check if this is the token contract
      if (log.address.toLowerCase() !== tokenAddress.toLowerCase()) {
        continue;
      }

      // Check if this is a Transfer event
      // Transfer(address indexed from, address indexed to, uint256 value)
      // Topic 0: keccak256("Transfer(address,address,uint256)")
      const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
      
      if (log.topics[0] !== transferTopic) {
        continue;
      }

      // Extract from, to, value from indexed topics and data
      const from = `0x${log.topics[1]?.slice(26)}` as Address;
      const to = `0x${log.topics[2]?.slice(26)}` as Address;
      const value = BigInt(log.data);
      const paidAmount = formatUnits(value, decimals);

      // Check recipient
      if (to.toLowerCase() !== expected.recipient.toLowerCase()) {
        continue; // Not the transfer we're looking for
      }

      // Check amount
      if (!this.isAmountSufficient(paidAmount, expected.amount)) {
        return {
          valid: false,
          payer: from,
          paidAmount,
          error: `Amount insufficient: expected ${expected.amount}, got ${paidAmount}`,
        };
      }

      return { valid: true, payer: from, paidAmount };
    }

    return {
      valid: false,
      error: `No matching ${expected.token} transfer found to ${expected.recipient}`,
    };
  }

  /**
   * Check if paid amount is sufficient
   */
  private isAmountSufficient(paid: string, expected: string): boolean {
    const paidFloat = parseFloat(paid);
    const expectedFloat = parseFloat(expected);
    
    if (this.config.amountTolerancePercent > 0) {
      const tolerance = expectedFloat * (this.config.amountTolerancePercent / 100);
      return paidFloat >= expectedFloat - tolerance;
    }
    
    return paidFloat >= expectedFloat;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get current chain configuration
   */
  getChain(): X402Chain {
    return this.chain;
  }

  /**
   * Clear verification cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hitRate?: number } {
    return {
      size: this.cache.size,
    };
  }

  /**
   * Check if a proof has been used (for replay detection)
   */
  async hasProofBeenUsed(proof: string): Promise<boolean> {
    return this.nonceStore.has(proof);
  }

  /**
   * Manually mark a proof as used
   */
  async markProofUsed(proof: string, ttlSeconds?: number): Promise<void> {
    await this.nonceStore.add(proof, ttlSeconds);
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create verifier for a specific chain
 */
export function createVerifier(
  chain: X402Chain,
  options: Omit<VerifierConfig, 'chain'> = {}
): X402PaymentVerifier {
  return new X402PaymentVerifier({ chain, ...options });
}

/**
 * Create verifiers for multiple chains
 */
export function createMultiChainVerifier(
  chains: X402Chain[],
  options: Omit<VerifierConfig, 'chain'> = {}
): Map<X402Chain, X402PaymentVerifier> {
  const verifiers = new Map<X402Chain, X402PaymentVerifier>();
  
  for (const chain of chains) {
    verifiers.set(chain, new X402PaymentVerifier({ chain, ...options }));
  }
  
  return verifiers;
}

/**
 * Create verifier with shared nonce store
 * Useful for multi-instance deployments
 */
export function createVerifierWithSharedStore(
  chain: X402Chain,
  nonceStore: NonceStore,
  options: Omit<VerifierConfig, 'chain' | 'nonceStore'> = {}
): X402PaymentVerifier {
  return new X402PaymentVerifier({ chain, nonceStore, ...options });
}
