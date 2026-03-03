/**
 * x402 Payment Protocol Types
 *
 * HTTP 402-based micropayment protocol for paying agents per-request.
 * @see https://www.x402.org
 */

// ─── Payment Configuration ─────────────────────────────────────────

export interface X402PricingConfig {
  /** Route pattern (e.g. "trading/execute") */
  route: string;
  /** Price in token units (e.g. "0.001") */
  price: string;
  /** Token symbol (e.g. "USDC") */
  token: string;
  /** Token contract address (overrides symbol lookup) */
  tokenAddress?: string;
  /** Token decimals (default: 6 for USDC, 18 for others) */
  decimals?: number;
  /** Description of what the payment covers */
  description?: string;
}

// ─── Payment Header ────────────────────────────────────────────────

export interface X402PaymentHeader {
  /** Payment protocol version */
  version: '1';
  /** Payer's wallet address */
  payer: string;
  /** Payee's wallet address (agent) */
  payee: string;
  /** Payment amount in smallest unit */
  amount: string;
  /** Token contract address */
  token: string;
  /** Chain ID */
  chainId: number;
  /** Transaction hash (after payment) */
  txHash?: string;
  /** Signature of the payment intent */
  signature: string;
  /** Nonce to prevent replay */
  nonce: string;
  /** Expiration timestamp */
  expiry: number;
}

// ─── Payment Requirement (402 Response) ─────────────────────────────

export interface X402PaymentRequired {
  /** Payment version */
  version: '1';
  /** Accepted payment methods */
  accepts: X402PaymentMethod[];
  /** Human-readable reason */
  description: string;
  /** Max response bytes (optional) */
  maxResponseBytes?: number;
  /** Additional metadata */
  extra?: Record<string, unknown>;
}

export interface X402PaymentMethod {
  /** Network (e.g. "evm") */
  network: string;
  /** Chain ID */
  chainId: number;
  /** Token address */
  token: string;
  /** Token symbol */
  symbol: string;
  /** Amount in smallest unit */
  amount: string;
  /** Payee address */
  payee: string;
  /** Required payment scheme */
  scheme: 'exact';
}

// ─── Payment Verification ──────────────────────────────────────────

export interface PaymentVerification {
  valid: boolean;
  payer: string;
  amount: string;
  token: string;
  chainId: number;
  txHash?: string;
  error?: string;
}

// ─── Payment Receipt ───────────────────────────────────────────────

export interface PaymentReceipt {
  paymentId: string;
  payer: string;
  payee: string;
  amount: string;
  token: string;
  chainId: number;
  txHash: string;
  timestamp: number;
  route: string;
}

// ─── Facilitator ───────────────────────────────────────────────────

export interface FacilitatorConfig {
  /** URL of the x402 facilitator service */
  url?: string;
  /** Chain ID to use */
  chainId: number;
  /** Payee wallet address */
  payeeAddress: string;
  /** Supported tokens */
  tokens: TokenConfig[];
}

export interface TokenConfig {
  symbol: string;
  address: string;
  decimals: number;
  chainId: number;
}

// ─── Common token addresses on BSC ─────────────────────────────────

export const BSC_TOKENS: Record<string, TokenConfig> = {
  USDC: {
    symbol: 'USDC',
    address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    decimals: 18,
    chainId: 56,
  },
  USDT: {
    symbol: 'USDT',
    address: '0x55d398326f99059fF775485246999027B3197955',
    decimals: 18,
    chainId: 56,
  },
  BUSD: {
    symbol: 'BUSD',
    address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
    decimals: 18,
    chainId: 56,
  },
};

export const BSC_TESTNET_TOKENS: Record<string, TokenConfig> = {
  USDC: {
    symbol: 'USDC',
    address: '0x64544969ed7EBf5f083679233325356EbE738930',
    decimals: 18,
    chainId: 97,
  },
  USDT: {
    symbol: 'USDT',
    address: '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd',
    decimals: 18,
    chainId: 97,
  },
};

// ─── Common token addresses on opBNB ───────────────────────────────

export const OPBNB_TOKENS: Record<string, TokenConfig> = {
  USDT: {
    symbol: 'USDT',
    address: '0x9e5AAC1Ba1a2e6aEd6b32689DFcF62A509Ca96f3',
    decimals: 18,
    chainId: 204,
  },
  FDUSD: {
    symbol: 'FDUSD',
    address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
    decimals: 18,
    chainId: 204,
  },
};

export const OPBNB_TESTNET_TOKENS: Record<string, TokenConfig> = {
  USDT: {
    symbol: 'USDT',
    address: '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd',
    decimals: 18,
    chainId: 5611,
  },
};
