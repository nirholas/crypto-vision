/**
 * @fileoverview YieldingWallet - Auto-converting wallet that maximizes USDs yield
 * @description Wallet class that automatically converts payments to USDs for passive yield
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 * 
 * "AI agents don't just GET paid - they EARN while they wait"
 * "Every payment grows. Every balance compounds."
 */

import type { Address, PublicClient, WalletClient, Hash } from 'viem';
import { formatUnits, parseUnits } from 'viem';
import type { X402Chain, X402Token, PaymentResult, YieldEstimate } from '../types.js';
import { X402Error, X402ErrorCode } from '../types.js';
import { TOKENS, SPERAX_USD_ADDRESS, ERC20_ABI, USDS_ABI, DEFAULTS } from '../constants.js';
import { YieldTracker } from '../yield/tracker.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for YieldingWallet
 */
export interface YieldingWalletConfig {
  /** Enable auto-conversion of all payments to USDs */
  autoConvertToUSDs: boolean;
  
  /** Enable automatic compounding of yield */
  autoCompound: boolean;
  
  /** Minimum balance to keep as non-USDs (for gas) */
  minGasReserve: string;
  
  /** Token to use for gas reserve (ETH on Arbitrum) */
  gasReserveToken: 'ETH' | 'native';
  
  /** Minimum amount to trigger auto-conversion */
  minConversionAmount: string;
  
  /** Enable yield notifications */
  enableYieldNotifications: boolean;
  
  /** Yield notification threshold (e.g., notify when daily yield exceeds this) */
  yieldNotificationThreshold: string;
}

/**
 * Yield report entry
 */
export interface YieldReportEntry {
  date: string;
  startingBalance: string;
  endingBalance: string;
  deposits: string;
  withdrawals: string;
  yieldEarned: string;
  apy: string;
}

/**
 * Monthly yield report
 */
export interface MonthlyYieldReport {
  month: string;
  year: number;
  entries: YieldReportEntry[];
  totalYieldEarned: string;
  averageAPY: string;
  startingBalance: string;
  endingBalance: string;
  totalDeposits: string;
  totalWithdrawals: string;
  netGrowth: string;
  projectedAnnualYield: string;
}

/**
 * Conversion result
 */
export interface ConversionResult {
  success: boolean;
  fromToken: X402Token;
  toToken: 'USDs';
  amountIn: string;
  amountOut: string;
  transactionHash?: Hash;
  error?: string;
}

/**
 * Wallet balance breakdown
 */
export interface WalletBalances {
  /** USDs balance (yield-bearing) */
  usds: {
    balance: string;
    formattedBalance: string;
    isRebasing: boolean;
    pendingYield: string;
  };
  
  /** Other token balances */
  other: {
    token: X402Token;
    balance: string;
    formattedBalance: string;
    usdValue?: string;
  }[];
  
  /** Gas reserve */
  gasReserve: {
    balance: string;
    formattedBalance: string;
    sufficient: boolean;
  };
  
  /** Total portfolio value in USD */
  totalValueUSD: string;
  
  /** Percentage in yield-bearing USDs */
  usdsPercentage: string;
}

/**
 * Yield projection
 */
export interface YieldProjection {
  currentBalance: string;
  apy: string;
  projections: {
    period: string;
    days: number;
    projectedBalance: string;
    projectedYield: string;
    compoundedYield: string;
  }[];
  timeToDouble: { days: number; months: number; years: number } | null;
  monthlyPassiveIncome: string;
  annualPassiveIncome: string;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: YieldingWalletConfig = {
  autoConvertToUSDs: true,
  autoCompound: true,
  minGasReserve: '0.01', // 0.01 ETH for gas
  gasReserveToken: 'ETH',
  minConversionAmount: '1.00', // $1 minimum for conversion
  enableYieldNotifications: true,
  yieldNotificationThreshold: '1.00', // Notify when daily yield > $1
};

// ============================================================================
// YieldingWallet Class
// ============================================================================

/**
 * YieldingWallet - Smart wallet that maximizes USDs yield
 * 
 * Key Features:
 * - Auto-converts all received payments to USDs
 * - Tracks yield earnings in real-time
 * - Projects future yield earnings
 * - Generates monthly yield reports
 * - Maintains gas reserves for transactions
 * 
 * @example
 * ```typescript
 * const wallet = new YieldingWallet(publicClient, walletClient, 'arbitrum');
 * 
 * // Check yield
 * const projection = await wallet.projectYield();
 * console.log(`Monthly passive income: $${projection.monthlyPassiveIncome}`);
 * 
 * // Auto-convert received payment
 * await wallet.receiveAndConvert('0x...', '100.00', 'USDC');
 * 
 * // Generate monthly report
 * const report = await wallet.generateMonthlyReport(1, 2026);
 * ```
 */
export class YieldingWallet {
  private readonly yieldTracker: YieldTracker;
  private config: YieldingWalletConfig;
  private balanceHistory: Map<string, { balance: string; timestamp: number }[]> = new Map();
  private transactionHistory: { type: 'deposit' | 'withdrawal' | 'yield'; amount: string; timestamp: number; txHash?: string }[] = [];

  constructor(
    private readonly publicClient: PublicClient,
    private readonly walletClient: WalletClient | undefined,
    private readonly chain: X402Chain,
    config: Partial<YieldingWalletConfig> = {}
  ) {
    // Only Arbitrum supports USDs
    if (chain !== 'arbitrum' && chain !== 'arbitrum-sepolia') {
      throw new X402Error(
        'YieldingWallet requires Arbitrum for USDs yield. Use "arbitrum" or "arbitrum-sepolia".',
        X402ErrorCode.UNSUPPORTED_CHAIN
      );
    }

    this.yieldTracker = new YieldTracker(publicClient, chain);
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ============================================================================
  // Configuration
  // ============================================================================

  /**
   * Update wallet configuration
   */
  updateConfig(config: Partial<YieldingWalletConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): YieldingWalletConfig {
    return { ...this.config };
  }

  /**
   * Enable/disable auto-compound
   */
  setAutoCompound(enabled: boolean): void {
    this.config.autoCompound = enabled;
  }

  /**
   * Enable/disable auto-conversion to USDs
   */
  setAutoConvert(enabled: boolean): void {
    this.config.autoConvertToUSDs = enabled;
  }

  // ============================================================================
  // Balance & Yield
  // ============================================================================

  /**
   * Get comprehensive wallet balances
   */
  async getBalances(): Promise<WalletBalances> {
    if (!this.walletClient?.account) {
      throw new X402Error('Wallet not connected', X402ErrorCode.NO_SIGNER);
    }

    const address = this.walletClient.account.address;

    // Get USDs balance
    const usdsBalance = await this.publicClient.readContract({
      address: SPERAX_USD_ADDRESS,
      abi: USDS_ABI,
      functionName: 'balanceOf',
      args: [address],
    }) as bigint;

    // Check if rebasing is enabled
    let isRebasing = true;
    try {
      isRebasing = await this.publicClient.readContract({
        address: SPERAX_USD_ADDRESS,
        abi: USDS_ABI,
        functionName: 'isRebaseEnabled',
        args: [address],
      }) as boolean;
    } catch {
      // Default to true if method doesn't exist
    }

    // Get ETH balance for gas reserve
    const ethBalance = await this.publicClient.getBalance({ address });

    // Calculate pending yield (estimated based on last known balance)
    const pendingYield = await this.calculatePendingYield(address);

    const formattedUsdsBalance = formatUnits(usdsBalance, 18);
    const formattedEthBalance = formatUnits(ethBalance, 18);
    
    // Check if gas reserve is sufficient
    const minReserve = parseFloat(this.config.minGasReserve);
    const currentReserve = parseFloat(formattedEthBalance);
    
    return {
      usds: {
        balance: usdsBalance.toString(),
        formattedBalance: formattedUsdsBalance,
        isRebasing,
        pendingYield,
      },
      other: [], // Could add USDC, etc. if needed
      gasReserve: {
        balance: ethBalance.toString(),
        formattedBalance: formattedEthBalance,
        sufficient: currentReserve >= minReserve,
      },
      totalValueUSD: formattedUsdsBalance, // Simplified - USDs = $1
      usdsPercentage: '100', // All in USDs
    };
  }

  /**
   * Get current USDs balance with yield info
   */
  async getUsdsBalance(): Promise<{
    balance: string;
    formattedBalance: string;
    apy: string;
    dailyYield: string;
    monthlyYield: string;
    annualYield: string;
  }> {
    if (!this.walletClient?.account) {
      throw new X402Error('Wallet not connected', X402ErrorCode.NO_SIGNER);
    }

    const info = await this.yieldTracker.getYieldInfo(this.walletClient.account.address);
    const estimate = await this.yieldTracker.estimateYield(this.walletClient.account.address);

    return {
      balance: info.balance,
      formattedBalance: info.formattedBalance,
      apy: info.currentAPY,
      dailyYield: estimate.daily,
      monthlyYield: estimate.monthly,
      annualYield: estimate.annual,
    };
  }

  /**
   * Calculate pending yield since last balance snapshot
   */
  private async calculatePendingYield(address: Address): Promise<string> {
    const history = this.balanceHistory.get(address);
    if (!history || history.length === 0) {
      return '0';
    }

    const lastEntry = history[history.length - 1];
    const currentBalance = await this.yieldTracker.getBalance(address);
    
    // Simple calculation: current - last (assumes no deposits/withdrawals)
    const lastBalance = parseFloat(lastEntry.balance);
    const current = parseFloat(currentBalance.formatted);
    const pending = current - lastBalance;
    
    return pending > 0 ? pending.toFixed(6) : '0';
  }

  // ============================================================================
  // Yield Projection
  // ============================================================================

  /**
   * Project future yield earnings
   */
  async projectYield(customBalance?: string): Promise<YieldProjection> {
    if (!this.walletClient?.account) {
      throw new X402Error('Wallet not connected', X402ErrorCode.NO_SIGNER);
    }

    const address = this.walletClient.account.address;
    const balance = customBalance 
      ? parseFloat(customBalance) 
      : parseFloat((await this.yieldTracker.getBalance(address)).formatted);
    
    const apy = await this.yieldTracker.getCurrentAPY();
    const apyDecimal = apy / 100;

    // Calculate projections for various time periods
    const periods = [
      { period: '1 Week', days: 7 },
      { period: '1 Month', days: 30 },
      { period: '3 Months', days: 90 },
      { period: '6 Months', days: 180 },
      { period: '1 Year', days: 365 },
      { period: '2 Years', days: 730 },
      { period: '5 Years', days: 1825 },
    ];

    const projections = periods.map(({ period, days }) => {
      // Simple interest
      const simpleYield = balance * (apyDecimal / 365) * days;
      
      // Compound interest (daily compounding)
      const dailyRate = apyDecimal / 365;
      const compoundedBalance = balance * Math.pow(1 + dailyRate, days);
      const compoundedYield = compoundedBalance - balance;

      return {
        period,
        days,
        projectedBalance: compoundedBalance.toFixed(2),
        projectedYield: simpleYield.toFixed(2),
        compoundedYield: compoundedYield.toFixed(2),
      };
    });

    // Time to double calculation
    const timeToDouble = this.yieldTracker.estimateTimeToTarget(balance, balance * 2, apy);

    // Monthly and annual passive income
    const monthlyPassiveIncome = (balance * (apyDecimal / 12)).toFixed(2);
    const annualPassiveIncome = (balance * apyDecimal).toFixed(2);

    return {
      currentBalance: balance.toFixed(2),
      apy: apy.toFixed(2),
      projections,
      timeToDouble,
      monthlyPassiveIncome,
      annualPassiveIncome,
    };
  }

  /**
   * Calculate yield to reach a target balance
   */
  async calculateYieldToTarget(targetBalance: number): Promise<{
    currentBalance: string;
    targetBalance: string;
    yieldNeeded: string;
    estimatedTime: { days: number; months: number; years: number } | null;
    additionalDepositNeeded: string;
  }> {
    if (!this.walletClient?.account) {
      throw new X402Error('Wallet not connected', X402ErrorCode.NO_SIGNER);
    }

    const address = this.walletClient.account.address;
    const balance = parseFloat((await this.yieldTracker.getBalance(address)).formatted);
    const apy = await this.yieldTracker.getCurrentAPY();
    
    const yieldNeeded = targetBalance - balance;
    const estimatedTime = this.yieldTracker.estimateTimeToTarget(balance, targetBalance, apy);

    // How much to deposit now to reach target in 1 year
    const apyDecimal = apy / 100;
    const requiredPrincipal = targetBalance / (1 + apyDecimal);
    const additionalDeposit = Math.max(0, requiredPrincipal - balance);

    return {
      currentBalance: balance.toFixed(2),
      targetBalance: targetBalance.toFixed(2),
      yieldNeeded: yieldNeeded > 0 ? yieldNeeded.toFixed(2) : '0',
      estimatedTime,
      additionalDepositNeeded: additionalDeposit.toFixed(2),
    };
  }

  // ============================================================================
  // Yield Reports
  // ============================================================================

  /**
   * Generate a monthly yield report
   */
  async generateMonthlyReport(month: number, year: number): Promise<MonthlyYieldReport> {
    if (!this.walletClient?.account) {
      throw new X402Error('Wallet not connected', X402ErrorCode.NO_SIGNER);
    }

    const address = this.walletClient.account.address;
    const currentBalance = parseFloat((await this.yieldTracker.getBalance(address)).formatted);
    const apy = await this.yieldTracker.getCurrentAPY();

    // Get days in month
    const daysInMonth = new Date(year, month, 0).getDate();
    const monthName = new Date(year, month - 1, 1).toLocaleString('default', { month: 'long' });

    // Generate daily entries (estimated based on current balance and APY)
    const dailyRate = apy / 100 / 365;
    let runningBalance = currentBalance / Math.pow(1 + dailyRate, daysInMonth); // Estimate starting balance
    
    const entries: YieldReportEntry[] = [];
    let totalYield = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      const startBalance = runningBalance;
      const dailyYield = startBalance * dailyRate;
      const endBalance = startBalance + dailyYield;
      
      entries.push({
        date,
        startingBalance: startBalance.toFixed(6),
        endingBalance: endBalance.toFixed(6),
        deposits: '0.00',
        withdrawals: '0.00',
        yieldEarned: dailyYield.toFixed(6),
        apy: apy.toFixed(2),
      });

      totalYield += dailyYield;
      runningBalance = endBalance;
    }

    const startingBalance = entries[0]?.startingBalance || '0';
    const endingBalance = entries[entries.length - 1]?.endingBalance || currentBalance.toFixed(6);
    const netGrowth = (parseFloat(endingBalance) - parseFloat(startingBalance)).toFixed(6);

    // Project annual yield based on this month
    const projectedAnnual = (totalYield * 12).toFixed(2);

    return {
      month: monthName,
      year,
      entries,
      totalYieldEarned: totalYield.toFixed(6),
      averageAPY: apy.toFixed(2),
      startingBalance,
      endingBalance,
      totalDeposits: '0.00',
      totalWithdrawals: '0.00',
      netGrowth,
      projectedAnnualYield: projectedAnnual,
    };
  }

  /**
   * Get yield history summary
   */
  async getYieldHistory(days: number = 30): Promise<{
    period: string;
    totalYield: string;
    averageDailyYield: string;
    startingBalance: string;
    endingBalance: string;
    effectiveAPY: string;
  }> {
    if (!this.walletClient?.account) {
      throw new X402Error('Wallet not connected', X402ErrorCode.NO_SIGNER);
    }

    const address = this.walletClient.account.address;
    const currentBalance = parseFloat((await this.yieldTracker.getBalance(address)).formatted);
    const apy = await this.yieldTracker.getCurrentAPY();

    // Estimate based on current state
    const dailyRate = apy / 100 / 365;
    const estimatedStartBalance = currentBalance / Math.pow(1 + dailyRate, days);
    const totalYield = currentBalance - estimatedStartBalance;
    const averageDailyYield = totalYield / days;

    // Calculate effective APY
    const effectiveAPY = ((totalYield / estimatedStartBalance) * (365 / days) * 100);

    return {
      period: `Last ${days} days`,
      totalYield: totalYield.toFixed(6),
      averageDailyYield: averageDailyYield.toFixed(6),
      startingBalance: estimatedStartBalance.toFixed(2),
      endingBalance: currentBalance.toFixed(2),
      effectiveAPY: effectiveAPY.toFixed(2),
    };
  }

  // ============================================================================
  // Auto-Conversion
  // ============================================================================

  /**
   * Receive payment and optionally auto-convert to USDs
   * This would integrate with DEX protocols like Rubic or Uniswap
   */
  async receiveAndConvert(
    _fromAddress: Address,
    amount: string,
    fromToken: X402Token
  ): Promise<ConversionResult> {
    if (!this.config.autoConvertToUSDs || fromToken === 'USDs') {
      return {
        success: true,
        fromToken,
        toToken: 'USDs',
        amountIn: amount,
        amountOut: amount, // No conversion
      };
    }

    const amountNum = parseFloat(amount);
    if (amountNum < parseFloat(this.config.minConversionAmount)) {
      return {
        success: false,
        fromToken,
        toToken: 'USDs',
        amountIn: amount,
        amountOut: '0',
        error: `Amount ${amount} below minimum conversion amount ${this.config.minConversionAmount}`,
      };
    }

    // In production, this would:
    // 1. Get best swap route via Rubic/1inch
    // 2. Execute swap fromToken -> USDs
    // 3. Return result with actual amounts

    // Placeholder for swap integration
    return {
      success: true,
      fromToken,
      toToken: 'USDs',
      amountIn: amount,
      amountOut: amount, // 1:1 for stablecoins
      // transactionHash would be set after actual swap
    };
  }

  /**
   * Check if conversion is recommended
   */
  async shouldConvert(token: X402Token, amount: string): Promise<{
    recommended: boolean;
    reason: string;
    estimatedYieldLoss: string;
  }> {
    if (token === 'USDs') {
      return {
        recommended: false,
        reason: 'Already in USDs - earning yield',
        estimatedYieldLoss: '0',
      };
    }

    const amountNum = parseFloat(amount);
    const apy = await this.yieldTracker.getCurrentAPY();
    
    // Calculate yield loss for not converting (per year)
    const annualYieldLoss = amountNum * (apy / 100);

    return {
      recommended: true,
      reason: `Convert to USDs to earn ~${apy}% APY (≈$${annualYieldLoss.toFixed(2)}/year)`,
      estimatedYieldLoss: annualYieldLoss.toFixed(2),
    };
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get wallet address
   */
  getAddress(): Address | undefined {
    return this.walletClient?.account?.address;
  }

  /**
   * Get chain
   */
  getChain(): X402Chain {
    return this.chain;
  }

  /**
   * Get underlying yield tracker
   */
  getYieldTracker(): YieldTracker {
    return this.yieldTracker;
  }

  /**
   * Format yield for display
   */
  static formatYield(amount: string, period: 'daily' | 'monthly' | 'annual'): string {
    const num = parseFloat(amount);
    if (num < 0.01) {
      return `$${amount}/${period.replace('ly', '')}`;
    }
    return `$${num.toFixed(2)}/${period.replace('ly', '')}`;
  }

  /**
   * Calculate compound interest
   */
  static calculateCompoundInterest(
    principal: number,
    apy: number,
    days: number,
    compoundFrequency: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'daily'
  ): number {
    const apyDecimal = apy / 100;
    const periodsPerYear = {
      daily: 365,
      weekly: 52,
      monthly: 12,
      yearly: 1,
    };
    
    const n = periodsPerYear[compoundFrequency];
    const t = days / 365;
    const rate = apyDecimal / n;
    const periods = n * t;

    return principal * Math.pow(1 + rate, periods);
  }
}

// ============================================================================
// Exports
// ============================================================================

export default YieldingWallet;
