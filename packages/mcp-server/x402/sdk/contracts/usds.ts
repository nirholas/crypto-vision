/**
 * @fileoverview USDs Contract Bindings
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import type { Address, PublicClient, WalletClient, Hash, Chain } from 'viem';
import { formatUnits, parseUnits } from 'viem';
import { arbitrum } from 'viem/chains';
import { SPERAX_USD_ADDRESS, USDS_ABI, ERC20_ABI } from '../constants';
import { X402Error, X402ErrorCode } from '../types';

/**
 * USDs (Sperax USD) contract interface
 * Provides typed access to USDs functions
 */
export class USDs {
  public readonly address: Address = SPERAX_USD_ADDRESS;
  public readonly decimals = 18;
  public readonly symbol = 'USDs';
  public readonly name = 'Sperax USD';
  private readonly chain: Chain = arbitrum;

  constructor(
    private readonly publicClient: PublicClient,
    private readonly walletClient?: WalletClient
  ) {}

  // ============================================================================
  // Read Methods
  // ============================================================================

  /**
   * Get token balance
   */
  async balanceOf(account: Address): Promise<{ raw: bigint; formatted: string }> {
    const balance = await this.publicClient.readContract({
      address: this.address,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [account],
    }) as bigint;

    return {
      raw: balance,
      formatted: formatUnits(balance, this.decimals),
    };
  }

  /**
   * Get token allowance
   */
  async allowance(owner: Address, spender: Address): Promise<{ raw: bigint; formatted: string }> {
    const allowance = await this.publicClient.readContract({
      address: this.address,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [owner, spender],
    }) as bigint;

    return {
      raw: allowance,
      formatted: formatUnits(allowance, this.decimals),
    };
  }

  /**
   * Get total supply
   */
  async totalSupply(): Promise<{ raw: bigint; formatted: string }> {
    const supply = await this.publicClient.readContract({
      address: this.address,
      abi: [
        {
          name: 'totalSupply',
          type: 'function',
          stateMutability: 'view',
          inputs: [],
          outputs: [{ type: 'uint256' }],
        },
      ],
      functionName: 'totalSupply',
      args: [],
    }) as bigint;

    return {
      raw: supply,
      formatted: formatUnits(supply, this.decimals),
    };
  }

  /**
   * Check if rebasing is enabled for an account
   */
  async isRebaseEnabled(account: Address): Promise<boolean> {
    try {
      return await this.publicClient.readContract({
        address: this.address,
        abi: USDS_ABI,
        functionName: 'isRebaseEnabled',
        args: [account],
      }) as boolean;
    } catch {
      return true; // Default to true if method doesn't exist
    }
  }

  /**
   * Get rebase credits per token
   */
  async rebasingCreditsPerToken(): Promise<bigint> {
    try {
      return await this.publicClient.readContract({
        address: this.address,
        abi: USDS_ABI,
        functionName: 'rebasingCreditsPerToken',
        args: [],
      }) as bigint;
    } catch {
      return BigInt(1e18);
    }
  }

  /**
   * Check if authorization nonce has been used
   */
  async authorizationState(authorizer: Address, nonce: `0x${string}`): Promise<boolean> {
    try {
      return await this.publicClient.readContract({
        address: this.address,
        abi: USDS_ABI,
        functionName: 'authorizationState',
        args: [authorizer, nonce],
      }) as boolean;
    } catch {
      return false;
    }
  }

  // ============================================================================
  // Write Methods
  // ============================================================================

  /**
   * Transfer tokens
   */
  async transfer(to: Address, amount: string): Promise<Hash> {
    this.requireWallet();

    const amountParsed = parseUnits(amount, this.decimals);

    const hash = await this.walletClient!.writeContract({
      account: this.walletClient!.account!,
      chain: this.chain,
      address: this.address,
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [to, amountParsed],
    });

    await this.publicClient.waitForTransactionReceipt({ hash });

    return hash;
  }

  /**
   * Approve spender
   */
  async approve(spender: Address, amount: string): Promise<Hash> {
    this.requireWallet();

    const amountParsed = parseUnits(amount, this.decimals);

    const hash = await this.walletClient!.writeContract({
      account: this.walletClient!.account!,
      chain: this.chain,
      address: this.address,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [spender, amountParsed],
    });

    await this.publicClient.waitForTransactionReceipt({ hash });

    return hash;
  }

  /**
   * Transfer with authorization (EIP-3009)
   */
  async transferWithAuthorization(
    from: Address,
    to: Address,
    value: bigint,
    validAfter: bigint,
    validBefore: bigint,
    nonce: `0x${string}`,
    v: number,
    r: `0x${string}`,
    s: `0x${string}`
  ): Promise<Hash> {
    this.requireWallet();

    const hash = await this.walletClient!.writeContract({
      account: this.walletClient!.account!,
      chain: this.chain,
      address: this.address,
      abi: USDS_ABI,
      functionName: 'transferWithAuthorization',
      args: [from, to, value, validAfter, validBefore, nonce, v, r, s],
    });

    await this.publicClient.waitForTransactionReceipt({ hash });

    return hash;
  }

  /**
   * Opt in to rebasing
   */
  async rebaseOptIn(): Promise<Hash> {
    this.requireWallet();

    const hash = await this.walletClient!.writeContract({
      account: this.walletClient!.account!,
      chain: this.chain,
      address: this.address,
      abi: USDS_ABI,
      functionName: 'rebaseOptIn',
      args: [],
    });

    await this.publicClient.waitForTransactionReceipt({ hash });

    return hash;
  }

  /**
   * Opt out of rebasing
   */
  async rebaseOptOut(): Promise<Hash> {
    this.requireWallet();

    const hash = await this.walletClient!.writeContract({
      account: this.walletClient!.account!,
      chain: this.chain,
      address: this.address,
      abi: USDS_ABI,
      functionName: 'rebaseOptOut',
      args: [],
    });

    await this.publicClient.waitForTransactionReceipt({ hash });

    return hash;
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  /**
   * Check if wallet is configured
   */
  private requireWallet(): void {
    if (!this.walletClient?.account) {
      throw new X402Error(
        'Wallet not configured. Provide privateKey to perform write operations.',
        X402ErrorCode.MISSING_PRIVATE_KEY
      );
    }
  }

  /**
   * Parse amount string to bigint
   */
  parseAmount(amount: string): bigint {
    return parseUnits(amount, this.decimals);
  }

  /**
   * Format bigint to string
   */
  formatAmount(amount: bigint): string {
    return formatUnits(amount, this.decimals);
  }
}
