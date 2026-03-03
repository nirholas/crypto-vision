/**
 * @fileoverview Gasless Payment Implementation (EIP-3009)
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import {
  type PublicClient,
  type WalletClient,
  type Address,
  type Chain,
  parseUnits,
  formatUnits,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrum, arbitrumSepolia, base, mainnet, polygon, optimism, bsc } from 'viem/chains';
import type {
  PaymentRequest,
  PaymentTransaction,
  EIP3009Authorization,
  AuthorizationOptions,
  X402Token,
  X402Chain,
} from '../types';
import { X402Error, X402ErrorCode } from '../types';
import {
  TOKENS,
  NETWORKS,
  EIP3009_ABI,
  TRANSFER_WITH_AUTHORIZATION_TYPES,
  DEFAULTS,
} from '../constants';

const VIEM_CHAINS: Record<X402Chain, Chain> = {
  arbitrum,
  'arbitrum-sepolia': arbitrumSepolia,
  base,
  ethereum: mainnet,
  polygon,
  optimism,
  bsc,
};

/**
 * Gasless payment handler using EIP-3009 (transferWithAuthorization)
 */
export class GaslessPayment {
  constructor(
    private readonly publicClient: PublicClient,
    private readonly walletClient: WalletClient | undefined,
    private readonly chain: X402Chain,
    private readonly privateKey?: `0x${string}`
  ) {}

  /**
   * Create an EIP-3009 payment authorization
   * This signature can be submitted by anyone to execute the transfer
   */
  async createAuthorization(
    recipient: Address,
    amount: string,
    token: X402Token,
    options: AuthorizationOptions = {}
  ): Promise<EIP3009Authorization> {
    if (!this.privateKey) {
      throw new X402Error(
        'Private key required to create authorization',
        X402ErrorCode.MISSING_PRIVATE_KEY
      );
    }

    const tokenConfig = this.getTokenConfig(token);

    if (!tokenConfig.supportsEIP3009) {
      throw new X402Error(
        `Token ${token} does not support EIP-3009 gasless transfers`,
        X402ErrorCode.UNSUPPORTED_TOKEN
      );
    }

    const account = privateKeyToAccount(this.privateKey);
    const value = parseUnits(amount, tokenConfig.decimals);
    const now = Math.floor(Date.now() / 1000);
    const validityPeriod = options.validityPeriod ?? DEFAULTS.AUTHORIZATION_VALIDITY;

    const validAfter = BigInt(now);
    const validBefore = BigInt(now + validityPeriod);
    const nonce = options.nonce ?? this.generateNonce();

    // Build EIP-712 domain
    const domain = {
      name: tokenConfig.name,
      version: '1',
      chainId: NETWORKS[this.chain].chainId,
      verifyingContract: tokenConfig.address,
    };

    // Sign the authorization
    const signature = await account.signTypedData({
      domain,
      types: TRANSFER_WITH_AUTHORIZATION_TYPES,
      primaryType: 'TransferWithAuthorization',
      message: {
        from: account.address,
        to: recipient,
        value,
        validAfter,
        validBefore,
        nonce,
      },
    });

    // Split signature into v, r, s
    const r = `0x${signature.slice(2, 66)}` as `0x${string}`;
    const s = `0x${signature.slice(66, 130)}` as `0x${string}`;
    const v = parseInt(signature.slice(130, 132), 16);

    return {
      from: account.address,
      to: recipient,
      value,
      validAfter,
      validBefore,
      nonce,
      v,
      r,
      s,
    };
  }

  /**
   * Settle a gasless payment by submitting the authorization on-chain
   * This can be called by anyone (relayer, recipient, etc.)
   */
  async settleAuthorization(
    authorization: EIP3009Authorization,
    token: X402Token
  ): Promise<PaymentTransaction> {
    if (!this.walletClient?.account) {
      throw new X402Error(
        'Wallet required to settle authorization',
        X402ErrorCode.MISSING_PRIVATE_KEY
      );
    }

    const tokenConfig = this.getTokenConfig(token);

    // Validate authorization timing
    const now = BigInt(Math.floor(Date.now() / 1000));
    if (now < authorization.validAfter) {
      throw new X402Error(
        'Authorization is not yet valid',
        X402ErrorCode.AUTHORIZATION_NOT_YET_VALID
      );
    }
    if (now > authorization.validBefore) {
      throw new X402Error(
        'Authorization has expired',
        X402ErrorCode.AUTHORIZATION_EXPIRED
      );
    }

    // Check if nonce was already used
    const nonceUsed = await this.isNonceUsed(authorization.from, authorization.nonce, token);
    if (nonceUsed) {
      throw new X402Error(
        'Authorization nonce already used',
        X402ErrorCode.NONCE_ALREADY_USED
      );
    }

    const viemChain = VIEM_CHAINS[this.chain];

    // Submit the authorization
    const hash = await this.walletClient.writeContract({
      account: this.walletClient.account,
      chain: viemChain,
      address: tokenConfig.address,
      abi: EIP3009_ABI,
      functionName: 'transferWithAuthorization',
      args: [
        authorization.from,
        authorization.to,
        authorization.value,
        authorization.validAfter,
        authorization.validBefore,
        authorization.nonce,
        authorization.v,
        authorization.r,
        authorization.s,
      ],
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

    return {
      hash,
      chainId: NETWORKS[this.chain].chainId,
      from: authorization.from,
      to: authorization.to,
      amount: authorization.value.toString(),
      formattedAmount: formatUnits(authorization.value, tokenConfig.decimals),
      token,
      tokenAddress: tokenConfig.address,
      status: receipt.status === 'success' ? 'confirmed' : 'failed',
      blockNumber: Number(receipt.blockNumber),
      gasUsed: receipt.gasUsed.toString(),
      timestamp: Math.floor(Date.now() / 1000),
    };
  }

  /**
   * Create and immediately settle a gasless payment
   */
  async executeGasless(
    request: PaymentRequest,
    options: AuthorizationOptions = {}
  ): Promise<PaymentTransaction> {
    const authorization = await this.createAuthorization(
      request.recipient,
      request.amount,
      request.token,
      options
    );

    return this.settleAuthorization(authorization, request.token);
  }

  /**
   * Check if an authorization nonce has been used
   */
  async isNonceUsed(
    authorizer: Address,
    nonce: `0x${string}`,
    token: X402Token
  ): Promise<boolean> {
    const tokenConfig = this.getTokenConfig(token);

    try {
      const used = await this.publicClient.readContract({
        address: tokenConfig.address,
        abi: EIP3009_ABI,
        functionName: 'authorizationState',
        args: [authorizer, nonce],
      });
      return used as boolean;
    } catch {
      // If method doesn't exist, assume not used
      return false;
    }
  }

  /**
   * Check if a token supports EIP-3009 gasless transfers
   */
  supportsGasless(token: X402Token): boolean {
    const tokenConfig = TOKENS[this.chain]?.[token];
    return tokenConfig?.supportsEIP3009 ?? false;
  }

  /**
   * Validate an authorization without submitting it
   */
  async validateAuthorization(
    authorization: EIP3009Authorization,
    token: X402Token
  ): Promise<{ valid: boolean; error?: string }> {
    const now = BigInt(Math.floor(Date.now() / 1000));

    if (now < authorization.validAfter) {
      return { valid: false, error: 'Authorization is not yet valid' };
    }

    if (now > authorization.validBefore) {
      return { valid: false, error: 'Authorization has expired' };
    }

    const nonceUsed = await this.isNonceUsed(authorization.from, authorization.nonce, token);
    if (nonceUsed) {
      return { valid: false, error: 'Nonce already used' };
    }

    return { valid: true };
  }

  /**
   * Generate a random nonce for authorization
   */
  private generateNonce(): `0x${string}` {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return `0x${Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}` as `0x${string}`;
  }

  /**
   * Get token configuration
   */
  private getTokenConfig(token: X402Token) {
    const config = TOKENS[this.chain]?.[token];
    if (!config) {
      throw new X402Error(
        `Token ${token} not available on ${this.chain}`,
        X402ErrorCode.UNSUPPORTED_TOKEN
      );
    }
    return config;
  }
}
