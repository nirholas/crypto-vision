// ucm:14938:nich

/**
 * x402 CLI - Formatting Utilities
 * @description Human-readable formatting for CLI output
 */

import chalk from 'chalk';
import type { X402Chain } from '../../sdk/types.js';

/**
 * Format USD amount with proper styling
 */
export function formatUSD(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(num)) {
    return chalk.gray('$0.00');
  }

  const formatted = num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });

  if (num === 0) {
    return chalk.gray(`$${formatted}`);
  } else if (num < 0) {
    return chalk.red(`$${formatted}`);
  } else if (num > 100) {
    return chalk.green(`$${formatted}`);
  }
  
  return chalk.white(`$${formatted}`);
}

/**
 * Format cryptocurrency amount with symbol
 */
export function formatCrypto(amount: string | number, symbol: string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(num)) {
    return chalk.gray(`0.0000 ${symbol}`);
  }

  const formatted = num.toLocaleString('en-US', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 8,
  });

  if (num === 0) {
    return chalk.gray(`${formatted} ${symbol}`);
  }
  
  return chalk.white(`${formatted} ${symbol}`);
}

/**
 * Shorten address for display
 */
export function shortenAddress(address: string): string {
  if (!address || address.length < 10) {
    return address;
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Format date for display
 */
export function formatDate(date: Date | string | number): string {
  const d = new Date(date);
  
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  // Relative time for recent dates
  if (diffMins < 1) {
    return 'just now';
  } else if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  // Full date for older dates
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Format transaction link
 */
export function formatTxLink(hash: string, chain: X402Chain): string {
  const explorers: Record<X402Chain, string> = {
    arbitrum: 'https://arbiscan.io/tx/',
    'arbitrum-sepolia': 'https://sepolia.arbiscan.io/tx/',
    base: 'https://basescan.org/tx/',
    ethereum: 'https://etherscan.io/tx/',
    polygon: 'https://polygonscan.com/tx/',
    optimism: 'https://optimistic.etherscan.io/tx/',
    bsc: 'https://bscscan.com/tx/',
  };

  return `${explorers[chain]}${hash}`;
}

/**
 * Format JSON with syntax highlighting
 */
export function formatJSON(obj: unknown): string {
  const json = JSON.stringify(obj, null, 2);
  
  // Simple syntax highlighting
  return json
    .replace(/"([^"]+)":/g, chalk.cyan('"$1":'))
    .replace(/: "([^"]+)"/g, `: ${chalk.green('"$1"')}`)
    .replace(/: (\d+)/g, `: ${chalk.yellow('$1')}`)
    .replace(/: (true|false)/g, `: ${chalk.magenta('$1')}`)
    .replace(/: null/g, `: ${chalk.gray('null')}`);
}

/**
 * Create a progress bar
 */
export function progressBar(current: number, total: number, width: number = 20): string {
  const percent = Math.min(current / total, 1);
  const filled = Math.round(width * percent);
  const empty = width - filled;
  
  const bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
  const percentText = `${Math.round(percent * 100)}%`;
  
  return `${bar} ${percentText}`;
}

/**
 * Format file size
 */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let unitIndex = 0;
  let size = bytes;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(unitIndex > 0 ? 2 : 0)} ${units[unitIndex]}`;
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  } else if (ms < 3600000) {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}m ${secs}s`;
  } else {
    const hours = Math.floor(ms / 3600000);
    const mins = Math.floor((ms % 3600000) / 60000);
    return `${hours}h ${mins}m`;
  }
}


/* EOF - universal-crypto-mcp | 0x4E494348 */