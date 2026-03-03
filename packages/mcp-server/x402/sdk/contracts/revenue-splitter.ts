/**
 * @fileoverview Revenue Splitter Contract Bindings
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import type { Address, PublicClient, WalletClient, Hash, Chain } from 'viem';
import { formatUnits, parseUnits } from 'viem';
import { arbitrum } from 'viem/chains';
import { REVENUE_SPLITTER_ABI, ERC20_ABI } from '../constants';
import type { ToolRegistration, RevenueSplit, ToolRevenueStats } from '../types';
import { X402Error, X402ErrorCode } from '../types';

/**
 * X402 Revenue Splitter contract interface
 * Handles automated revenue splitting between developers and platform
 */
export class RevenueSplitter {
  private readonly chain: Chain = arbitrum;

  constructor(
    private readonly contractAddress: Address,
    private readonly publicClient: PublicClient,
    private readonly walletClient?: WalletClient
  ) {}

  // ============================================================================
  // Read Methods
  // ============================================================================

  /**
   * Get tool information
   */
  async getToolInfo(toolName: string): Promise<ToolRevenueStats | null> {
    try {
      const result = await this.publicClient.readContract({
        address: this.contractAddress,
        abi: REVENUE_SPLITTER_ABI,
        functionName: 'getToolInfo',
        args: [toolName],
      }) as [Address, bigint, bigint, bigint, boolean];

      const [developer, platformFeeBps, totalRevenue, totalCalls, active] = result;

      if (!active) {
        return null;
      }

      return {
        toolName,
        developer,
        totalRevenue: formatUnits(totalRevenue, 18),
        totalCalls: Number(totalCalls),
        platformFeeBps: Number(platformFeeBps),
        active,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get developer earnings
   */
  async getDeveloperEarnings(developer: Address): Promise<string> {
    const earnings = await this.publicClient.readContract({
      address: this.contractAddress,
      abi: REVENUE_SPLITTER_ABI,
      functionName: 'developerEarnings',
      args: [developer],
    }) as bigint;

    return formatUnits(earnings, 18);
  }

  /**
   * Get platform wallet address
   */
  async getPlatformWallet(): Promise<Address> {
    return await this.publicClient.readContract({
      address: this.contractAddress,
      abi: REVENUE_SPLITTER_ABI,
      functionName: 'platformWallet',
      args: [],
    }) as Address;
  }

  /**
   * Get default platform fee in basis points
   */
  async getDefaultPlatformFee(): Promise<number> {
    const feeBps = await this.publicClient.readContract({
      address: this.contractAddress,
      abi: REVENUE_SPLITTER_ABI,
      functionName: 'defaultPlatformFeeBps',
      args: [],
    }) as bigint;

    return Number(feeBps);
  }

  /**
   * Calculate revenue split for a payment
   */
  async calculateSplit(toolName: string, amount: string): Promise<RevenueSplit> {
    const toolInfo = await this.getToolInfo(toolName);

    if (!toolInfo) {
      throw new X402Error(
        `Tool "${toolName}" not found or inactive`,
        X402ErrorCode.TOOL_NOT_FOUND
      );
    }

    const totalAmount = parseFloat(amount);
    const platformPercentage = toolInfo.platformFeeBps / 100;
    const developerPercentage = 100 - platformPercentage;

    const platformAmount = (totalAmount * toolInfo.platformFeeBps) / 10000;
    const developerAmount = totalAmount - platformAmount;

    return {
      totalAmount: amount,
      developerAmount: developerAmount.toFixed(6),
      platformAmount: platformAmount.toFixed(6),
      developerPercentage: developerPercentage.toFixed(2),
      platformPercentage: platformPercentage.toFixed(2),
    };
  }

  // ============================================================================
  // Write Methods
  // ============================================================================

  /**
   * Process a single payment
   */
  async processPayment(
    toolName: string,
    tokenAddress: Address,
    amount: string,
    decimals: number = 18
  ): Promise<Hash> {
    this.requireWallet();

    const amountParsed = parseUnits(amount, decimals);

    // Check and approve if needed
    await this.ensureAllowance(tokenAddress, amountParsed);

    const hash = await this.walletClient!.writeContract({
      account: this.walletClient!.account!,
      chain: this.chain,
      address: this.contractAddress,
      abi: REVENUE_SPLITTER_ABI,
      functionName: 'processPayment',
      args: [toolName, tokenAddress, amountParsed],
    });

    await this.publicClient.waitForTransactionReceipt({ hash });

    return hash;
  }

  /**
   * Process multiple payments in batch
   */
  async batchProcessPayments(
    toolNames: string[],
    tokenAddress: Address,
    amounts: string[],
    decimals: number = 18
  ): Promise<Hash> {
    this.requireWallet();

    if (toolNames.length !== amounts.length) {
      throw new X402Error(
        'Tool names and amounts arrays must have same length',
        X402ErrorCode.INVALID_PAYMENT_REQUEST
      );
    }

    const amountsParsed = amounts.map((a) => parseUnits(a, decimals));
    const totalAmount = amountsParsed.reduce((sum, a) => sum + a, BigInt(0));

    // Check and approve if needed
    await this.ensureAllowance(tokenAddress, totalAmount);

    const hash = await this.walletClient!.writeContract({
      account: this.walletClient!.account!,
      chain: this.chain,
      address: this.contractAddress,
      abi: REVENUE_SPLITTER_ABI,
      functionName: 'batchProcessPayments',
      args: [toolNames, tokenAddress, amountsParsed],
    });

    await this.publicClient.waitForTransactionReceipt({ hash });

    return hash;
  }

  /**
   * Register a new tool (admin only)
   */
  async registerTool(registration: ToolRegistration): Promise<Hash> {
    this.requireWallet();

    const hash = await this.walletClient!.writeContract({
      account: this.walletClient!.account!,
      chain: this.chain,
      address: this.contractAddress,
      abi: REVENUE_SPLITTER_ABI,
      functionName: 'registerTool',
      args: [registration.name, registration.developer, BigInt(registration.platformFeeBps)],
    });

    await this.publicClient.waitForTransactionReceipt({ hash });

    return hash;
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  /**
   * Ensure sufficient allowance for the splitter contract
   */
  private async ensureAllowance(
    tokenAddress: Address,
    amount: bigint
  ): Promise<void> {
    if (!this.walletClient?.account) {
      return;
    }

    const allowance = await this.publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [this.walletClient.account.address, this.contractAddress],
    }) as bigint;

    if (allowance < amount) {
      const approveHash = await this.walletClient.writeContract({
        account: this.walletClient.account,
        chain: this.chain,
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [this.contractAddress, amount],
      });
      await this.publicClient.waitForTransactionReceipt({ hash: approveHash });
    }
  }

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
}
