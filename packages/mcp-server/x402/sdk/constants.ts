/**
 * @fileoverview X402 SDK Constants
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import type { Address } from 'viem';
import type { X402Chain, X402Token, TokenConfig, NetworkConfig } from './types';

// ============================================================================
// Network Configuration
// ============================================================================

/**
 * Supported network configurations
 */
export const NETWORKS: Record<X402Chain, NetworkConfig> = {
  arbitrum: {
    chainId: 42161,
    name: 'Arbitrum One',
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    explorerUrl: 'https://arbiscan.io',
    isTestnet: false,
  },
  'arbitrum-sepolia': {
    chainId: 421614,
    name: 'Arbitrum Sepolia',
    rpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc',
    explorerUrl: 'https://sepolia.arbiscan.io',
    isTestnet: true,
  },
  base: {
    chainId: 8453,
    name: 'Base',
    rpcUrl: 'https://mainnet.base.org',
    explorerUrl: 'https://basescan.org',
    isTestnet: false,
  },
  ethereum: {
    chainId: 1,
    name: 'Ethereum',
    rpcUrl: 'https://eth.llamarpc.com',
    explorerUrl: 'https://etherscan.io',
    isTestnet: false,
  },
  polygon: {
    chainId: 137,
    name: 'Polygon',
    rpcUrl: 'https://polygon-rpc.com',
    explorerUrl: 'https://polygonscan.com',
    isTestnet: false,
  },
  optimism: {
    chainId: 10,
    name: 'Optimism',
    rpcUrl: 'https://mainnet.optimism.io',
    explorerUrl: 'https://optimistic.etherscan.io',
    isTestnet: false,
  },
  bsc: {
    chainId: 56,
    name: 'BNB Smart Chain',
    rpcUrl: 'https://bsc-dataseed.binance.org',
    explorerUrl: 'https://bscscan.com',
    isTestnet: false,
  },
};

/**
 * Chain ID to chain name mapping
 */
export const CHAIN_ID_TO_CHAIN: Record<number, X402Chain> = Object.entries(NETWORKS).reduce(
  (acc, [chain, config]) => {
    acc[config.chainId] = chain as X402Chain;
    return acc;
  },
  {} as Record<number, X402Chain>
);

// ============================================================================
// Token Configuration
// ============================================================================

/**
 * Sperax USD (USDs) contract address on Arbitrum
 * Auto-yield stablecoin
 */
export const SPERAX_USD_ADDRESS: Address = '0xd74f5255d557944cf7dd0e45ff521520002d5748';

/**
 * Token configurations per chain
 */
export const TOKENS: Record<X402Chain, Partial<Record<X402Token, TokenConfig>>> = {
  arbitrum: {
    USDs: {
      address: SPERAX_USD_ADDRESS,
      decimals: 18,
      name: 'Sperax USD',
      symbol: 'USDs',
      supportsEIP3009: true,
    },
    USDC: {
      address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' as Address,
      decimals: 6,
      name: 'USD Coin',
      symbol: 'USDC',
      supportsEIP3009: true,
    },
    USDT: {
      address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9' as Address,
      decimals: 6,
      name: 'Tether USD',
      symbol: 'USDT',
      supportsEIP3009: false,
    },
    DAI: {
      address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1' as Address,
      decimals: 18,
      name: 'Dai Stablecoin',
      symbol: 'DAI',
      supportsEIP3009: false,
    },
    ETH: {
      address: '0x0000000000000000000000000000000000000000' as Address,
      decimals: 18,
      name: 'Ether',
      symbol: 'ETH',
      supportsEIP3009: false,
    },
  },
  'arbitrum-sepolia': {
    USDs: {
      address: '0x0000000000000000000000000000000000000000' as Address, // Deploy for testnet
      decimals: 18,
      name: 'Test Sperax USD',
      symbol: 'USDs',
      supportsEIP3009: true,
    },
    USDC: {
      address: '0x0000000000000000000000000000000000000000' as Address, // Deploy for testnet
      decimals: 6,
      name: 'Test USD Coin',
      symbol: 'USDC',
      supportsEIP3009: true,
    },
  },
  base: {
    USDC: {
      address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address,
      decimals: 6,
      name: 'USD Coin',
      symbol: 'USDC',
      supportsEIP3009: true,
    },
  },
  ethereum: {
    USDC: {
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Address,
      decimals: 6,
      name: 'USD Coin',
      symbol: 'USDC',
      supportsEIP3009: true,
    },
    USDT: {
      address: '0xdAC17F958D2ee523a2206206994597C13D831ec7' as Address,
      decimals: 6,
      name: 'Tether USD',
      symbol: 'USDT',
      supportsEIP3009: false,
    },
    DAI: {
      address: '0x6B175474E89094C44Da98b954EedeAC495271d0F' as Address,
      decimals: 18,
      name: 'Dai Stablecoin',
      symbol: 'DAI',
      supportsEIP3009: false,
    },
  },
  polygon: {
    USDC: {
      address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' as Address,
      decimals: 6,
      name: 'USD Coin',
      symbol: 'USDC',
      supportsEIP3009: true,
    },
  },
  optimism: {
    USDC: {
      address: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607' as Address,
      decimals: 6,
      name: 'USD Coin',
      symbol: 'USDC',
      supportsEIP3009: true,
    },
  },
  bsc: {
    USDC: {
      address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d' as Address,
      decimals: 18,
      name: 'USD Coin',
      symbol: 'USDC',
      supportsEIP3009: false,
    },
  },
};

/**
 * Default token per chain
 */
export const DEFAULT_TOKEN: Record<X402Chain, X402Token> = {
  arbitrum: 'USDs',
  'arbitrum-sepolia': 'USDs',
  base: 'USDC',
  ethereum: 'USDC',
  polygon: 'USDC',
  optimism: 'USDC',
  bsc: 'USDC',
};

// ============================================================================
// Contract ABIs
// ============================================================================

/**
 * ERC-20 ABI (minimal)
 */
export const ERC20_ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'transferFrom',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint8' }],
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  {
    name: 'name',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
] as const;

/**
 * EIP-3009 Transfer With Authorization ABI
 */
export const EIP3009_ABI = [
  {
    name: 'transferWithAuthorization',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
      { name: 'v', type: 'uint8' },
      { name: 'r', type: 'bytes32' },
      { name: 's', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    name: 'receiveWithAuthorization',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
      { name: 'v', type: 'uint8' },
      { name: 'r', type: 'bytes32' },
      { name: 's', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    name: 'authorizationState',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'authorizer', type: 'address' },
      { name: 'nonce', type: 'bytes32' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const;

/**
 * USDs Rebasing Token ABI (additional methods)
 */
export const USDS_ABI = [
  ...ERC20_ABI,
  ...EIP3009_ABI,
  {
    name: 'rebasingCreditsPerToken',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'rebasingCredits',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'rebaseOptIn',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'rebaseOptOut',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'isRebaseEnabled',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
] as const;

/**
 * Revenue Splitter Contract ABI
 */
export const REVENUE_SPLITTER_ABI = [
  {
    name: 'processPayment',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'toolName', type: 'string' },
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'batchProcessPayments',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'toolNames', type: 'string[]' },
      { name: 'token', type: 'address' },
      { name: 'amounts', type: 'uint256[]' },
    ],
    outputs: [],
  },
  {
    name: 'registerTool',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'toolName', type: 'string' },
      { name: 'developer', type: 'address' },
      { name: 'platformFeeBps', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'getToolInfo',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'toolName', type: 'string' }],
    outputs: [
      { name: 'developer', type: 'address' },
      { name: 'platformFeeBps', type: 'uint256' },
      { name: 'totalRevenue', type: 'uint256' },
      { name: 'totalCalls', type: 'uint256' },
      { name: 'active', type: 'bool' },
    ],
  },
  {
    name: 'developerEarnings',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'developer', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'platformWallet',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    name: 'defaultPlatformFeeBps',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const;

// ============================================================================
// EIP-712 Type Definitions
// ============================================================================

/**
 * EIP-712 domain for EIP-3009 transfers
 */
export const EIP3009_DOMAIN_TYPE = {
  name: [{ name: 'name', type: 'string' }],
  version: [{ name: 'version', type: 'string' }],
  chainId: [{ name: 'chainId', type: 'uint256' }],
  verifyingContract: [{ name: 'verifyingContract', type: 'address' }],
};

/**
 * EIP-712 types for TransferWithAuthorization
 */
export const TRANSFER_WITH_AUTHORIZATION_TYPES = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const;

// ============================================================================
// Default Values
// ============================================================================

/**
 * Default configuration values
 */
export const DEFAULTS = {
  /** Default timeout in milliseconds */
  TIMEOUT: 30_000,

  /** Default validity period for authorizations (5 minutes) */
  AUTHORIZATION_VALIDITY: 300,

  /** Default facilitator URL */
  FACILITATOR_URL: 'http://localhost:3002',

  /** Default platform fee in basis points (20%) */
  PLATFORM_FEE_BPS: 2000,

  /** USDs APY estimate (for calculations) */
  USDS_APY: 5.0,
} as const;

/**
 * X402 Protocol version
 */
export const X402_VERSION = 1;

/**
 * SDK version
 */
export const SDK_VERSION = '1.0.0';
