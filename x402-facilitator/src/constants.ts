import type { Address, NetworkName } from './types/index.js';

/** Facilitator version (semver) */
export const FACILITATOR_VERSION = '1.0.0';

/** x402 protocol version supported */
export const X402_VERSION = 1;

/** Supported payment schemes */
export const SUPPORTED_SCHEMES = ['exact'] as const;

/** Supported network names */
export const SUPPORTED_NETWORKS: readonly NetworkName[] = ['base', 'base-sepolia'] as const;

/** USDC contract addresses per network */
export const USDC_ADDRESSES: Record<string, Address> = {
  'base': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  'base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
};

/** Maximum payment amount in USDC (raw units, 6 decimals) — $10,000 */
export const MAX_PAYMENT_AMOUNT = 10_000_000_000n;

/** Minimum payment amount in USDC (raw units, 6 decimals) — $0.01 */
export const MIN_PAYMENT_AMOUNT = 10_000n;
