import type { Address, Hex } from 'viem';

export type { Address, Hex } from 'viem';

/** Supported chain IDs */
export type SupportedChainId = 1 | 8453 | 42161 | 84532 | 421614;

/** Network display names */
export type NetworkName = 'ethereum' | 'base' | 'base-sepolia' | 'arbitrum' | 'arbitrum-sepolia';

/** EIP-3009 transferWithAuthorization parameters */
export interface TransferAuthorization {
  from: Address;
  to: Address;
  value: bigint;
  validAfter: bigint;
  validBefore: bigint;
  nonce: Hex;
}

/** x402 payment payload sent by the client */
export interface X402Payment {
  /** Chain ID where the payment should be settled */
  chainId: SupportedChainId;
  /** Token contract address (e.g. USDC) */
  token: Address;
  /** EIP-3009 authorization parameters */
  authorization: TransferAuthorization;
  /** EIP-712 signature (r + s + v) */
  signature: Hex;
}

/** Result of payment verification (internal) */
export interface VerifyResult {
  valid: boolean;
  /** Human-readable reason if invalid */
  reason?: string;
  /** Recovered signer address */
  signer?: Address;
}

/** x402 spec response for POST /verify
 *  Matches SDK VerifyResponseSchema: { isValid, invalidReason?, payer? }
 *  Also includes `valid` for x402 draft compatibility */
export type VerifyResponse =
  | { valid: true; isValid: true; payer: Address }
  | { valid: false; isValid: false; invalidReason: string };

/** Result of on-chain settlement */
export interface SettleResult {
  success: boolean;
  /** Transaction hash on success */
  txHash?: Hex;
  /** Error message on failure */
  error?: string;
  /** Chain ID where settlement occurred */
  chainId: SupportedChainId;
  /** Network name (e.g. "base", "arbitrum") */
  network?: string;
  /** Block number where the tx was included */
  blockNumber?: number;
}

/** x402 spec response for POST /settle
 *  Includes both `txHash` (x402 draft) and `transaction` (Coinbase SDK) for compatibility */
export type SettleResponse =
  | { success: true; txHash: Hex; transaction: Hex; network: string; payer: Address }
  | { success: false; errorReason: string };

/** Chain configuration */
export interface ChainConfig {
  chainId: SupportedChainId;
  network: NetworkName;
  rpcUrl: string;
  usdcAddress: Address;
  blockExplorerUrl: string;
  blockTimeMs: number;
}

/** Token configuration per chain */
export interface TokenConfig {
  address: Address;
  symbol: string;
  decimals: number;
}

/** Payment requirements (what the resource server demands) */
export interface PaymentRequirements {
  /** Chain the payment must be on */
  chainId: SupportedChainId;
  /** Token contract address */
  asset: Address;
  /** Recipient address (payTo) */
  payTo: Address;
  /** Minimum amount required */
  maxAmountRequired: bigint;
  /** Optional expiry timestamp (unix seconds) */
  expiry?: number;
}

/** Server info response */
export interface FacilitatorInfo {
  name: string;
  version: string;
  x402Version: number;
  facilitatorAddress: Address;
  supportedChains: Array<{
    chainId: SupportedChainId;
    network: string;
    tokens: TokenConfig[];
  }>;
  operator: {
    name: string;
    url: string;
  };
}

/** Health check response */
export interface HealthResponse {
  status: 'ok' | 'degraded';
  version: string;
  uptime: number;
  chains: Array<{
    chainId: SupportedChainId;
    network: string;
    connected: boolean;
    blockNumber?: number;
  }>;
}

/** Configuration for the Facilitator orchestrator */
export interface FacilitatorConfig {
  /** Private key for the settlement wallet (hex with 0x prefix) */
  privateKey: Hex;
  /** Supported chain configs */
  chains: ChainConfig[];
  /** Server port */
  port: number;
  /** Server hostname */
  host: string;
  /** Rate limit max requests per window */
  rateLimitMax: number;
  /** Rate limit window in milliseconds */
  rateLimitWindowMs: number;
  /** Allowed CORS origins */
  corsOrigins: string[];
  /** Log level */
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}
