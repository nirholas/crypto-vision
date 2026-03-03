/* index.ts | nich | n1ch-0las-4e49-4348-786274000000 */

/**
 * x402 Test Mocks
 * @description Mock utilities for testing x402 payment protocol
 * @author Test Engineer
 * @license Apache-2.0
 */

import { vi } from 'vitest';
import type { Address, Hash } from 'viem';
import type {
  X402Chain,
  X402Token,
  PaymentResult,
  PaymentTransaction,
  BalanceInfo,
  EIP3009Authorization,
  HTTP402Response,
  YieldInfo,
  YieldEstimate,
  BatchPaymentResult,
} from '../../sdk/types.js';

// ============================================================================
// Test Constants
// ============================================================================

export const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const;
export const TEST_PRIVATE_KEY_2 = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' as const;

export const TEST_ADDRESSES = {
  sender: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Address,
  recipient: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as Address,
  contract: '0xd74f5255d557944cf7dd0e45ff521520002d5748' as Address,
  facilitator: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC' as Address,
};

export const TEST_TX_HASHES = {
  success: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as Hash,
  pending: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as Hash,
  failed: '0xfailed567890abcdef1234567890abcdef1234567890abcdef1234567890abc' as Hash,
};

// ============================================================================
// Mock 402 Response Generator
// ============================================================================

export interface Mock402ResponseOptions {
  amount?: string;
  token?: X402Token;
  chain?: X402Chain;
  recipient?: Address;
  resource?: string;
  deadline?: number;
  reference?: string;
}

/**
 * Generate a mock HTTP 402 response
 */
export function createMock402Response(options: Mock402ResponseOptions = {}): HTTP402Response {
  const {
    amount = '1.00',
    token = 'USDs',
    chain = 'arbitrum',
    recipient = TEST_ADDRESSES.recipient,
    resource = '/api/premium',
    deadline,
    reference,
  } = options;

  let authHeader = `X402 price="${amount} ${token}" chain="${chain}" recipient="${recipient}"`;
  if (resource) authHeader += ` resource="${resource}"`;
  if (deadline) authHeader += ` deadline="${deadline}"`;
  if (reference) authHeader += ` reference="${reference}"`;

  return {
    status: 402,
    headers: {
      'www-authenticate': authHeader,
      'content-type': 'application/json',
      'x-payment-version': '1',
    },
    body: {
      error: 'Payment Required',
      message: `Payment of ${amount} ${token} required`,
      payment: {
        amount,
        token,
        chain,
        recipient,
        resource,
        deadline,
      },
    },
  };
}

/**
 * Create a mock fetch Response that returns 402
 */
export function createMock402FetchResponse(options: Mock402ResponseOptions = {}): Response {
  const mock402 = createMock402Response(options);
  
  const headers = new Headers();
  headers.set('www-authenticate', mock402.headers['www-authenticate']);
  if (mock402.headers['content-type']) {
    headers.set('content-type', mock402.headers['content-type']);
  }
  if (mock402.headers['x-payment-version']) {
    headers.set('x-payment-version', mock402.headers['x-payment-version']);
  }

  return new Response(JSON.stringify(mock402.body), {
    status: 402,
    statusText: 'Payment Required',
    headers,
  });
}

/**
 * Create a mock successful fetch response (after payment)
 */
export function createMockSuccessResponse(data: unknown = { success: true }): Response {
  const headers = new Headers();
  headers.set('content-type', 'application/json');
  headers.set('x-payment-tx', TEST_TX_HASHES.success);

  return new Response(JSON.stringify(data), {
    status: 200,
    statusText: 'OK',
    headers,
  });
}

// ============================================================================
// Mock Payment Facilitator
// ============================================================================

export interface MockFacilitatorOptions {
  shouldSucceed?: boolean;
  latencyMs?: number;
  txHash?: Hash;
}

/**
 * Create a mock payment facilitator
 */
export function createMockFacilitator(options: MockFacilitatorOptions = {}) {
  const { shouldSucceed = true, latencyMs = 100, txHash = TEST_TX_HASHES.success } = options;

  return {
    submitAuthorization: vi.fn().mockImplementation(async (auth: EIP3009Authorization) => {
// FIXME(nich): review edge cases
      await new Promise(resolve => setTimeout(resolve, latencyMs));
      
      if (!shouldSucceed) {
        throw new Error('Facilitator rejected authorization');
      }

      return {
        hash: txHash,
        from: auth.from,
        to: auth.to,
        amount: auth.value.toString(),
      };
    }),

    getStatus: vi.fn().mockImplementation(async (hash: Hash) => {
      await new Promise(resolve => setTimeout(resolve, latencyMs / 2));
      return shouldSucceed ? 'confirmed' : 'failed';
    }),

    estimateGas: vi.fn().mockResolvedValue(21000n),
  };
}

// ============================================================================
// Mock Blockchain RPC
// ============================================================================

export interface MockRPCOptions {
  chainId?: number;
  balance?: bigint;
  tokenBalance?: bigint;
  blockNumber?: bigint;
  gasPrice?: bigint;
}

/**
 * Create a mock blockchain RPC client
 */
export function createMockRPC(options: MockRPCOptions = {}) {
  const {
    chainId = 42161,
    balance = 1000000000000000000n,
    tokenBalance = 100000000000000000000n,
    blockNumber = 150000000n,
    gasPrice = 100000000n,
  } = options;

  return {
    // Core reads
    getChainId: vi.fn().mockResolvedValue(chainId),
    getBlockNumber: vi.fn().mockResolvedValue(blockNumber),
    getBalance: vi.fn().mockResolvedValue(balance),
    getGasPrice: vi.fn().mockResolvedValue(gasPrice),

    // Transaction methods
    getTransaction: vi.fn().mockResolvedValue({
      hash: TEST_TX_HASHES.success,
      from: TEST_ADDRESSES.sender,
      to: TEST_ADDRESSES.recipient,
      value: 1000000000000000000n,
      blockNumber,
    }),
    getTransactionReceipt: vi.fn().mockResolvedValue({
      status: 'success',
      gasUsed: 21000n,
      blockNumber,
      transactionHash: TEST_TX_HASHES.success,
    }),
    sendTransaction: vi.fn().mockResolvedValue(TEST_TX_HASHES.success),
    waitForTransactionReceipt: vi.fn().mockResolvedValue({
      status: 'success',
      transactionHash: TEST_TX_HASHES.success,
    }),

    // Contract methods
    readContract: vi.fn().mockImplementation(async ({ functionName }: { functionName: string }) => {
      switch (functionName) {
        case 'balanceOf':
          return tokenBalance;
        case 'decimals':
          return 18;
        case 'symbol':
          return 'USDs';
        case 'name':
          return 'Sperax USD';
        case 'allowance':
          return 0n;
        default:
          return null;
      }
    }),
    writeContract: vi.fn().mockResolvedValue(TEST_TX_HASHES.success),
    simulateContract: vi.fn().mockResolvedValue({ request: {} }),
    estimateGas: vi.fn().mockResolvedValue(50000n),

    // Block methods
    getBlock: vi.fn().mockResolvedValue({
      number: blockNumber,
      timestamp: BigInt(Math.floor(Date.now() / 1000)),
      hash: TEST_TX_HASHES.success,
    }),
  };
}

// ============================================================================
// Mock Wallet Client
// ============================================================================

export interface MockWalletOptions {
  address?: Address;
  chainId?: number;
}

/**
 * Create a mock wallet client
 */
export function createMockWalletClient(options: MockWalletOptions = {}) {
  const { address = TEST_ADDRESSES.sender, chainId = 42161 } = options;

  return {
    account: { address },
    chain: { id: chainId, name: 'Arbitrum One' },
    sendTransaction: vi.fn().mockResolvedValue(TEST_TX_HASHES.success),
    signMessage: vi.fn().mockResolvedValue('0xsignature'),
    signTypedData: vi.fn().mockResolvedValue('0xtypedSignature'),
    writeContract: vi.fn().mockResolvedValue(TEST_TX_HASHES.success),
    getAddresses: vi.fn().mockResolvedValue([address]),
  };
}

// ============================================================================
// Mock Payment Results
// ============================================================================

/**
 * Create a mock payment transaction
 */
export function createMockTransaction(overrides: Partial<PaymentTransaction> = {}): PaymentTransaction {
  return {
    hash: TEST_TX_HASHES.success,
    chainId: 42161,
    from: TEST_ADDRESSES.sender,
    to: TEST_ADDRESSES.recipient,
    amount: '1000000000000000000',
    formattedAmount: '1.00',
    token: 'USDs',
    tokenAddress: TEST_ADDRESSES.contract,
    gasUsed: '50000',
    status: 'confirmed',
    blockNumber: 150000000,
    timestamp: Math.floor(Date.now() / 1000),
    ...overrides,
  };
}

/**
 * Create a mock payment result
 */
export function createMockPaymentResult(overrides: Partial<PaymentResult> = {}): PaymentResult {
  return {
    transaction: createMockTransaction(overrides.transaction),
    gasless: false,
    estimatedYield: {
      daily: '0.000137',
      weekly: '0.000959',
      monthly: '0.004167',
      annual: '0.05',
      apy: '5.00',
    },
    ...overrides,
  };
}

/**
 * Create mock balance info
 */
export function createMockBalanceInfo(overrides: Partial<BalanceInfo> = {}): BalanceInfo {
  return {
    raw: 100000000000000000000n,
    formatted: '100.00',
    token: 'USDs',
    ...overrides,
  };
}

/**
 * Create mock yield info
 */
export function createMockYieldInfo(overrides: Partial<YieldInfo> = {}): YieldInfo {
  return {
    balance: '100.00',
    formattedBalance: '100.00',
    totalYield: '5.00',
    currentAPY: '5.00',
    rebasingEnabled: true,
    lastRebaseAt: Math.floor(Date.now() / 1000) - 3600,
    ...overrides,
  };
}

/**
 * Create mock yield estimate
 */
export function createMockYieldEstimate(overrides: Partial<YieldEstimate> = {}): YieldEstimate {
  return {
    daily: '0.0137',
    weekly: '0.0959',
    monthly: '0.4167',
    annual: '5.00',
    apy: '5.00',
    ...overrides,
  };
}

/**
 * Create mock batch payment result
 */
export function createMockBatchResult(
  successCount: number = 2,
  failedCount: number = 0
): BatchPaymentResult {
  const successful: PaymentTransaction[] = [];
  const failed: Array<{ item: { recipient: Address; amount: string }; error: string }> = [];

  for (let i = 0; i < successCount; i++) {
    successful.push(createMockTransaction({
      to: `0x${i.toString().padStart(40, '0')}` as Address,
      amount: '1000000000000000000',
    }));
  }

  for (let i = 0; i < failedCount; i++) {
    failed.push({
      item: {
        recipient: `0x${(i + 100).toString().padStart(40, '0')}` as Address,
        amount: '1.00',
      },
      error: 'Insufficient balance',
    });
  }

  return {
    successful,
    failed,
    totalAmount: (successCount * 1).toFixed(2),
    totalGasUsed: (successCount * 50000).toString(),
  };
}

// ============================================================================
// Mock EIP-3009 Authorization
// ============================================================================

/**
 * Create a mock EIP-3009 authorization
 */
export function createMockAuthorization(overrides: Partial<EIP3009Authorization> = {}): EIP3009Authorization {
  const now = BigInt(Math.floor(Date.now() / 1000));
  
  return {
    from: TEST_ADDRESSES.sender,
    to: TEST_ADDRESSES.recipient,
    value: 1000000000000000000n,
    validAfter: now - 60n,
    validBefore: now + 300n,
    nonce: '0x0000000000000000000000000000000000000000000000000000000000000001',
    v: 27,
    r: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    s: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    ...overrides,
  };
}

// ============================================================================
// Test Wallet Generators
// ============================================================================

/**
 * Generate a random test wallet
 */
export function generateTestWallet(): { privateKey: `0x${string}`; address: Address } {
  // Generate deterministic "random" wallet for tests
  const randomHex = Array.from({ length: 64 }, (_, i) => 
    ((i * 7 + Math.floor(Date.now() / 1000) + i) % 16).toString(16)
  ).join('');
  
  const privateKey = `0x${randomHex}` as `0x${string}`;
  // Mock address - in real implementation would derive from private key
  const address = `0x${randomHex.slice(0, 40)}` as Address;
  
  return { privateKey, address };
}

/**
 * Preset test wallets for consistent testing
 */
export const TEST_WALLETS = {
  alice: {
    privateKey: TEST_PRIVATE_KEY,
    address: TEST_ADDRESSES.sender,
  },
  bob: {
// v14.9.3.8
    privateKey: TEST_PRIVATE_KEY_2,
    address: TEST_ADDRESSES.recipient,
  },
  facilitator: {
    privateKey: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a' as const,
    address: TEST_ADDRESSES.facilitator,
  },
};

// ============================================================================
// Mock X402Client
// ============================================================================

/**
 * Create a fully mocked X402Client for testing
 */
export function createMockX402Client(options: {
  chain?: X402Chain;
  address?: Address;
  shouldSucceed?: boolean;
} = {}) {
  const { chain = 'arbitrum', address = TEST_ADDRESSES.sender, shouldSucceed = true } = options;

  const mockClient = {
    // Properties
    chain,
    
    // Payment methods
    pay: vi.fn().mockImplementation(async () => {
      if (!shouldSucceed) throw new Error('Payment failed');
      return createMockPaymentResult();
    }),
    
    payBatch: vi.fn().mockImplementation(async (items: any[]) => {
      if (!shouldSucceed) throw new Error('Batch payment failed');
      return createMockBatchResult(items.length, 0);
    }),
    
    // Gasless methods
    createAuthorization: vi.fn().mockImplementation(async () => {
      if (!shouldSucceed) throw new Error('Authorization failed');
      return createMockAuthorization();
    }),
    
    settleGasless: vi.fn().mockImplementation(async () => {
      if (!shouldSucceed) throw new Error('Settlement failed');
      return createMockTransaction({ status: 'confirmed' });
    }),
    
    supportsGasless: vi.fn().mockReturnValue(true),
    
    // Balance methods
    getBalance: vi.fn().mockResolvedValue(createMockBalanceInfo()),
    getAddress: vi.fn().mockReturnValue(address),
    approve: vi.fn().mockResolvedValue(TEST_TX_HASHES.success),
    
    // Yield methods
    getYield: vi.fn().mockResolvedValue(createMockYieldInfo()),
    estimateYield: vi.fn().mockResolvedValue(createMockYieldEstimate()),
    getCurrentAPY: vi.fn().mockResolvedValue(0.05),
    
    // HTTP 402 handling
    handlePaymentRequired: vi.fn().mockImplementation(async (response: any, options?: any) => {
      const parseResult = { isPaymentRequired: true, paymentRequest: {} };
      if (options?.autoPayUnder) {
        return { ...parseResult, transaction: createMockTransaction() };
      }
      return parseResult;
    }),
    
    create402Response: vi.fn().mockImplementation((request: any) => ({
      status: 402,
      headers: { 'WWW-Authenticate': `X402 price="${request.amount} ${request.token}"` },
      body: { error: 'Payment Required' },
    })),
    
    // Chain info
    getChainInfo: vi.fn().mockReturnValue({
      chain,
      chainId: 42161,
      name: 'Arbitrum One',
      rpcUrl: 'https://arb1.arbitrum.io/rpc',
      explorerUrl: 'https://arbiscan.io',
      isTestnet: false,
    }),
    
    getAvailableTokens: vi.fn().mockReturnValue(['USDs', 'USDC']),
    
    // Event handling
    on: vi.fn(),
    off: vi.fn(),
    
    // Contract interfaces
    getUSDs: vi.fn().mockReturnValue({
      balanceOf: vi.fn().mockResolvedValue(100000000000000000000n),
      transfer: vi.fn().mockResolvedValue(TEST_TX_HASHES.success),
    }),
    
    getRevenueSplitter: vi.fn().mockReturnValue({
      registerTool: vi.fn().mockResolvedValue(TEST_TX_HASHES.success),
      processPayment: vi.fn().mockResolvedValue(TEST_TX_HASHES.success),
    }),
  };

  return mockClient;
}

// ============================================================================
// Mock Fetch
// ============================================================================

/**
 * Create a mock fetch function for testing HTTP interactions
 */
export function createMockFetch(responses: Array<{ match?: string | RegExp; response: Response }>) {
  return vi.fn().mockImplementation(async (url: string) => {
    for (const { match, response } of responses) {
      if (!match || (typeof match === 'string' ? url.includes(match) : match.test(url))) {
        return response.clone();
      }
    }
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
  });
}

/**
 * Setup global fetch mock for 402 flow testing
 */
export function setupFetch402Flow(options: {
  paymentAmount?: string;
  successData?: unknown;
} = {}) {
  const { paymentAmount = '1.00', successData = { data: 'premium content' } } = options;
  
  let paid = false;
  
  return vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
    // Check for payment header
    const headers = init?.headers as Record<string, string> | undefined;
    if (headers?.['x-payment-proof'] || headers?.['Authorization']?.includes('X402')) {
      paid = true;
    }
    
    if (!paid) {
      return createMock402FetchResponse({ amount: paymentAmount });
    }
    
    return createMockSuccessResponse(successData);
  });
}


/* EOF - universal-crypto-mcp | 1414930800 */