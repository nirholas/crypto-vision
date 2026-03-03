/**
 * Utility functions for formatting and calculations
 */

import { PROTOCOL_CONSTANTS } from './config.js';

/**
 * Format a bigint with decimals to a human-readable string
 */
export const formatUnits = (value: bigint, decimals: number): string => {
  const divisor = BigInt(10 ** decimals);
  const integerPart = value / divisor;
  const fractionalPart = value % divisor;
  
  if (fractionalPart === 0n) {
    return integerPart.toString();
  }
  
  const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
  const trimmedFractional = fractionalStr.replace(/0+$/, '');
  
  return `${integerPart}.${trimmedFractional}`;
};

/**
 * Parse a decimal string to bigint with decimals
 */
export const parseUnits = (value: string, decimals: number): bigint => {
  const [integerPart, fractionalPart = ''] = value.split('.');
  const paddedFractional = fractionalPart.padEnd(decimals, '0').slice(0, decimals);
  return BigInt(integerPart + paddedFractional);
};

/**
 * Format a number as USD currency
 */
export const formatUSD = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

/**
 * Format a number as percentage
 */
export const formatPercentage = (value: number, decimals = 2): string => {
  return `${value.toFixed(decimals)}%`;
};

/**
 * Format large numbers with abbreviations (K, M, B)
 */
export const formatLargeNumber = (value: number): string => {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(2)}K`;
  }
  return value.toFixed(2);
};

/**
 * Format a date/timestamp
 */
export const formatDate = (timestamp: number): string => {
  return new Date(timestamp * 1000).toISOString().split('T')[0];
};

/**
 * Calculate veSPA voting power
 * Formula: veSPA = SPA × (lockDays / 365)
 */
export const calculateVeSPAPower = (spaAmount: number, lockDays: number): number => {
  const clampedDays = Math.min(
    Math.max(lockDays, PROTOCOL_CONSTANTS.MIN_LOCK_DAYS),
    PROTOCOL_CONSTANTS.MAX_LOCK_DAYS
  );
  return spaAmount * (clampedDays / 365);
};

/**
 * Calculate xSPA to SPA redemption
 * Formula: SPA_out = xSPA × (vestingDays + 150) / 330
 */
export const calculateXSPARedemption = (xspaAmount: number, vestingDays: number): number => {
  const clampedDays = Math.min(
    Math.max(vestingDays, PROTOCOL_CONSTANTS.MIN_VESTING_DAYS),
    PROTOCOL_CONSTANTS.MAX_VESTING_DAYS
  );
  const ratio = (clampedDays + 150) / 330;
  return xspaAmount * ratio;
};

/**
 * Calculate redemption ratio for xSPA
 */
export const calculateRedemptionRatio = (vestingDays: number): number => {
  const clampedDays = Math.min(
    Math.max(vestingDays, PROTOCOL_CONSTANTS.MIN_VESTING_DAYS),
    PROTOCOL_CONSTANTS.MAX_VESTING_DAYS
  );
  return (clampedDays + 150) / 330;
};

/**
 * Calculate daily yield from APR
 */
export const calculateDailyYield = (principal: number, apr: number): number => {
  return (principal * (apr / 100)) / 365;
};

/**
 * Calculate projected earnings
 */
export const calculateProjectedEarnings = (
  principal: number,
  apr: number,
  days: number
): { daily: number; total: number; endBalance: number } => {
  const dailyYield = calculateDailyYield(principal, apr);
  const total = dailyYield * days;
  return {
    daily: dailyYield,
    total,
    endBalance: principal + total,
  };
};

/**
 * Validate Ethereum address
 */
export const isValidAddress = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

/**
 * Shorten address for display
 */
export const shortenAddress = (address: string): string => {
  if (!isValidAddress(address)) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

/**
 * Calculate time until unlock
 */
export const calculateTimeUntil = (timestamp: number): string => {
  const now = Math.floor(Date.now() / 1000);
  const diff = timestamp - now;
  
  if (diff <= 0) return 'Unlocked';
  
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  
  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''} ${hours} hour${hours > 1 ? 's' : ''}`;
  }
  return `${hours} hour${hours > 1 ? 's' : ''}`;
};

/**
 * Safe JSON stringify for bigint values
 */
export const safeStringify = (obj: unknown): string => {
  return JSON.stringify(obj, (_, value) => {
    if (typeof value === 'bigint') {
      return value.toString();
    }
    return value;
  }, 2);
};
