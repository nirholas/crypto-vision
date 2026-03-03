/*
 * ═══════════════════════════════════════════════════════════════
 *  universal-crypto-mcp | nichxbt
 *  ID: 14938
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * x402 CLI - Wallet Utilities
 * @description Generate and manage wallets for x402 payments
 */

import { generatePrivateKey, privateKeyToAccount, privateKeyToAddress } from 'viem/accounts';
import { mnemonicToAccount, english, generateMnemonic } from 'viem/accounts';
import chalk from 'chalk';

/**
 * Generated wallet information
 */
export interface GeneratedWallet {
  address: string;
  privateKey: `0x${string}`;
  mnemonic?: string;
}

/**
 * Generate a new random wallet
 */
export function generateWallet(): GeneratedWallet {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);

  return {
    address: account.address,
    privateKey,
  };
}

/**
 * Generate a new wallet with mnemonic phrase
 */
export function generateWalletWithMnemonic(): GeneratedWallet {
  const mnemonic = generateMnemonic(english);
  const account = mnemonicToAccount(mnemonic);

  return {
    address: account.address,
    privateKey: account.getHdKey().privateKey 
      ? `0x${Buffer.from(account.getHdKey().privateKey!).toString('hex')}` as `0x${string}`
      : generatePrivateKey(), // Fallback
    mnemonic,
  };
}

/**
 * Derive address from private key
 */
export function deriveAddress(privateKey: `0x${string}`): string {
  return privateKeyToAddress(privateKey);
}

/**
 * Validate private key format
 */
export function isValidPrivateKey(key: string): boolean {
  if (!key.startsWith('0x')) {
    return false;
  }
  if (key.length !== 66) {
    return false;
  }
  if (!/^0x[a-fA-F0-9]{64}$/.test(key)) {
    return false;
  }
  return true;
}

/**
 * Validate Ethereum address format
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Export wallet information for backup
 */
export function exportWallet(privateKey: `0x${string}`): {
  address: string;
  privateKey: string;
  created: string;
  format: string;
} {
  const address = privateKeyToAddress(privateKey);

  return {
    address,
    privateKey,
    created: new Date().toISOString(),
    format: 'x402-wallet-v1',
  };
}

/**
 * Import wallet from various formats
 */
export function importWallet(input: string): GeneratedWallet | null {
  // Try as private key
  if (input.startsWith('0x') && input.length === 66) {
    try {
      const privateKey = input as `0x${string}`;
      const address = privateKeyToAddress(privateKey);
      return { address, privateKey };
    } catch {
      return null;
    }
  }

  // Try as mnemonic
  const words = input.trim().split(/\s+/);
  if (words.length === 12 || words.length === 24) {
    try {
      const account = mnemonicToAccount(input);
      return {
        address: account.address,
        privateKey: account.getHdKey().privateKey 
          ? `0x${Buffer.from(account.getHdKey().privateKey!).toString('hex')}` as `0x${string}`
          : null as any,
        mnemonic: input,
      };
    } catch {
      return null;
    }
  }

  // Try as JSON
  try {
    const parsed = JSON.parse(input);
    if (parsed.privateKey && isValidPrivateKey(parsed.privateKey)) {
      return {
        address: parsed.address || privateKeyToAddress(parsed.privateKey),
        privateKey: parsed.privateKey,
        mnemonic: parsed.mnemonic,
      };
    }
  } catch {
    // Not JSON
  }

  return null;
}

/**
 * Print wallet information in a formatted way
 */
export function printWalletInfo(wallet: GeneratedWallet, showPrivate: boolean = false): void {
  console.log(chalk.cyan('\n📦 Wallet Information\n'));
  console.log(chalk.gray('─'.repeat(50)));
  console.log(chalk.white(`  Address: ${wallet.address}`));
  
  if (showPrivate) {
    console.log(chalk.white(`  Key:     ${wallet.privateKey}`));
    if (wallet.mnemonic) {
      console.log(chalk.white(`  Phrase:  ${wallet.mnemonic}`));
    }
  }
  
  console.log(chalk.gray('─'.repeat(50)));
}

/**
 * Mask private key for display
 */
export function maskPrivateKey(key: string): string {
  if (!key || key.length < 10) {
    return '****';
  }
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}

/**
 * Create a vanity address (starts with specific characters)
 * Warning: This can be computationally expensive!
 */
export async function generateVanityAddress(
  prefix: string,
  maxAttempts: number = 100000,
  onProgress?: (attempt: number) => void
): Promise<GeneratedWallet | null> {
  const targetPrefix = prefix.toLowerCase().replace('0x', '');
  
  for (let i = 0; i < maxAttempts; i++) {
    if (onProgress && i % 1000 === 0) {
      onProgress(i);
    }
    
    const privateKey = generatePrivateKey();
    const address = privateKeyToAddress(privateKey);
    
    if (address.toLowerCase().slice(2).startsWith(targetPrefix)) {
      return {
        address,
        privateKey,
      };
    }
  }
  
  return null;
}


/* universal-crypto-mcp © nirholas/universal-crypto-mcp */