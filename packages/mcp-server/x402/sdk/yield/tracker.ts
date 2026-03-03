/**
 * @fileoverview USDs Yield Tracker
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import type { Address, PublicClient } from 'viem';
import { formatUnits } from 'viem';
import type { YieldInfo, YieldEstimate, YieldHistoryEntry, X402Chain } from '../types';
import { X402Error, X402ErrorCode } from '../types';
import { SPERAX_USD_ADDRESS, USDS_ABI, DEFAULTS } from '../constants';

/**
 * USDs yield tracking utilities
 * Tracks auto-yield earnings from Sperax USD
 */
export class YieldTracker {
  private readonly usdsAddress: Address;
  #chain: X402Chain;

  constructor(
    private readonly publicClient: PublicClient,
    chain: X402Chain
  ) {
    // Only Arbitrum supports USDs
    if (chain !== 'arbitrum' && chain !== 'arbitrum-sepolia') {
      throw new X402Error(
        'USDs yield tracking is only available on Arbitrum',
        X402ErrorCode.UNSUPPORTED_CHAIN
      );
    }
    this.#chain = chain;
    this.usdsAddress = SPERAX_USD_ADDRESS;
  }

  /**
   * Get the chain this tracker is configured for
   */
  get chain(): X402Chain {
    return this.#chain;
  }

  /**
   * Get comprehensive yield information for an address
   */
  async getYieldInfo(address: Address): Promise<YieldInfo> {
    // Get current balance
    const balance = await this.publicClient.readContract({
      address: this.usdsAddress,
      abi: USDS_ABI,
      functionName: 'balanceOf',
      args: [address],
    }) as bigint;

    // Check if rebasing is enabled
    let rebasingEnabled = true;
    try {
      rebasingEnabled = await this.publicClient.readContract({
        address: this.usdsAddress,
        abi: USDS_ABI,
        functionName: 'isRebaseEnabled',
        args: [address],
      }) as boolean;
    } catch {
      // Method might not exist in all versions
      rebasingEnabled = true;
    }

    // Get current APY (estimated)
    const currentAPY = await this.getCurrentAPY();

    // Calculate total yield (would need historical data for accuracy)
    // For now, return 0 as placeholder
    const totalYield = '0';

    return {
      balance: balance.toString(),
      formattedBalance: formatUnits(balance, 18),
      totalYield,
      currentAPY: currentAPY.toString(),
      rebasingEnabled,
    };
  }

  /**
   * Get current APY estimate
   * In production, this would query on-chain or off-chain data sources
   */
  async getCurrentAPY(): Promise<number> {
    // Placeholder: Return default APY
    // In production, calculate from rebase events or API
    return DEFAULTS.USDS_APY;
  }

  /**
   * Estimate yield over time based on current balance and APY
   */
  async estimateYield(
    address: Address,
    apy?: number
  ): Promise<YieldEstimate> {
    const balance = await this.publicClient.readContract({
      address: this.usdsAddress,
      abi: USDS_ABI,
      functionName: 'balanceOf',
      args: [address],
    }) as bigint;

    const currentAPY = apy ?? await this.getCurrentAPY();
    const balanceNum = parseFloat(formatUnits(balance, 18));

    return this.calculateYieldEstimate(balanceNum, currentAPY);
  }

  /**
   * Calculate yield estimates for a given balance and APY
   */
  calculateYieldEstimate(balance: number, apy: number): YieldEstimate {
    const apyDecimal = apy / 100;

    // Daily yield (APY / 365)
    const dailyRate = apyDecimal / 365;
    const daily = balance * dailyRate;

    // Weekly yield
    const weekly = daily * 7;

    // Monthly yield (approximate)
    const monthly = daily * 30;

    // Annual yield
    const annual = balance * apyDecimal;

    return {
      daily: daily.toFixed(6),
      weekly: weekly.toFixed(6),
      monthly: monthly.toFixed(6),
      annual: annual.toFixed(6),
      apy: apy.toString(),
    };
  }

  /**
   * Get USDs balance for an address
   */
  async getBalance(address: Address): Promise<{ raw: bigint; formatted: string }> {
    const balance = await this.publicClient.readContract({
      address: this.usdsAddress,
      abi: USDS_ABI,
      functionName: 'balanceOf',
      args: [address],
    }) as bigint;

    return {
      raw: balance,
      formatted: formatUnits(balance, 18),
    };
  }

  /**
   * Check if rebasing is enabled for an address
   */
  async isRebasingEnabled(address: Address): Promise<boolean> {
    try {
      return await this.publicClient.readContract({
        address: this.usdsAddress,
        abi: USDS_ABI,
        functionName: 'isRebaseEnabled',
        args: [address],
      }) as boolean;
    } catch {
      // If method doesn't exist, assume enabled
      return true;
    }
  }

  /**
   * Get rebase credits per token (for yield calculation)
   */
  async getRebasingCreditsPerToken(): Promise<bigint> {
    try {
      return await this.publicClient.readContract({
        address: this.usdsAddress,
        abi: USDS_ABI,
        functionName: 'rebasingCreditsPerToken',
        args: [],
      }) as bigint;
    } catch {
      return BigInt(1e18); // Default
    }
  }

  /**
   * Get yield history (requires indexer/subgraph in production)
   * This is a placeholder implementation
   */
  async getYieldHistory(
    address: Address,
    _fromBlock?: number,
    _toBlock?: number
  ): Promise<YieldHistoryEntry[]> {
    // In production, this would query:
    // 1. Transfer events to track balance changes
    // 2. Rebase events to track yield accrual
    // 3. Historical balance snapshots
    
    const currentBalance = await this.getBalance(address);
    const blockNumber = await this.publicClient.getBlockNumber();

    // Return current state as single entry
    return [
      {
        timestamp: Math.floor(Date.now() / 1000),
        balance: currentBalance.formatted,
        yieldEarned: '0',
        blockNumber: Number(blockNumber),
      },
    ];
  }

  /**
   * Calculate yield earned between two balances
   * Accounts for deposits/withdrawals
   */
  calculateYieldEarned(
    startBalance: string,
    endBalance: string,
    netDeposits: string
  ): string {
    const start = parseFloat(startBalance);
    const end = parseFloat(endBalance);
    const deposits = parseFloat(netDeposits);

    // Yield = End Balance - Start Balance - Net Deposits
    const yieldEarned = end - start - deposits;
    return yieldEarned > 0 ? yieldEarned.toFixed(6) : '0';
  }

  /**
   * Estimate time to reach target balance through yield
   */
  estimateTimeToTarget(
    currentBalance: number,
    targetBalance: number,
    apy: number
  ): { days: number; months: number; years: number } | null {
    if (currentBalance >= targetBalance || currentBalance <= 0 || apy <= 0) {
      return null;
    }

    const apyDecimal = apy / 100;
    const growthFactor = targetBalance / currentBalance;
    
    // Time = ln(target/current) / ln(1 + apy) for compound interest
    // Using simple interest approximation for daily compounding
    const yearsNeeded = Math.log(growthFactor) / Math.log(1 + apyDecimal);
    const daysNeeded = yearsNeeded * 365;
    const monthsNeeded = yearsNeeded * 12;

    return {
      days: Math.ceil(daysNeeded),
      months: Math.ceil(monthsNeeded),
      years: parseFloat(yearsNeeded.toFixed(2)),
    };
  }
}
