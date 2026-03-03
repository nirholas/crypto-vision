/**
 * Anvil Fork Setup Helper
 * Utilities for running tests against forked mainnet state
 */

import { createPublicClient, createWalletClient, http, type Address, type Chain } from "viem";
import { mainnet, arbitrum, polygon, base, optimism } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { vi } from "vitest";

// ============================================================
// Types
// ============================================================

export interface ForkConfig {
  chain: Chain;
  rpcUrl?: string;
  blockNumber?: bigint;
  port?: number;
}

export interface ForkContext {
  publicClient: ReturnType<typeof createPublicClient>;
  walletClient: ReturnType<typeof createWalletClient>;
  testAccount: ReturnType<typeof privateKeyToAccount>;
  anvilUrl: string;
  blockNumber: bigint;
  cleanup: () => Promise<void>;
}

// ============================================================
// Constants
// ============================================================

// Default test private key (DO NOT USE IN PRODUCTION)
// This is a well-known test key with no real funds
const TEST_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;

// Default fork block numbers (for reproducible tests)
export const FORK_BLOCKS: Record<string, bigint> = {
  ethereum: 18500000n,
  arbitrum: 150000000n,
  polygon: 50000000n,
  base: 8000000n,
  optimism: 115000000n,
};

// Chain configs
const CHAINS: Record<string, Chain> = {
  ethereum: mainnet,
  arbitrum: arbitrum,
  polygon: polygon,
  base: base,
  optimism: optimism,
};

// ============================================================
// Fork Setup Functions
// ============================================================

/**
 * Create clients for a local Anvil fork
 * Assumes Anvil is already running on the specified port
 */
export function createForkClients(
  anvilUrl: string = "http://127.0.0.1:8545",
  chain: Chain = mainnet
): { publicClient: ReturnType<typeof createPublicClient>; walletClient: ReturnType<typeof createWalletClient>; testAccount: ReturnType<typeof privateKeyToAccount> } {
  const testAccount = privateKeyToAccount(TEST_PRIVATE_KEY);
  
  const publicClient = createPublicClient({
    chain,
    transport: http(anvilUrl),
  });
  
  const walletClient = createWalletClient({
    chain,
    transport: http(anvilUrl),
    account: testAccount,
  });
  
  return { publicClient, walletClient, testAccount };
}

/**
 * Get the command to start an Anvil fork
 */
export function getAnvilForkCommand(config: ForkConfig): string {
  const {
    chain,
    rpcUrl,
    blockNumber = FORK_BLOCKS[chain.name.toLowerCase()] || 18000000n,
    port = 8545,
  } = config;
  
  // Get RPC URL from environment or use default public RPC
  const forkUrl = rpcUrl || process.env[`${chain.name.toUpperCase()}_RPC_URL`] || getPublicRpcUrl(chain);
  
  return `anvil --fork-url ${forkUrl} --fork-block-number ${blockNumber} --port ${port} --silent`;
}

/**
 * Get a public RPC URL for a chain (rate limited, use for testing only)
 */
function getPublicRpcUrl(chain: Chain): string {
  const publicRpcs: Record<number, string> = {
    1: "https://eth.llamarpc.com",
    42161: "https://arb1.arbitrum.io/rpc",
    137: "https://polygon-rpc.com",
    8453: "https://mainnet.base.org",
    10: "https://mainnet.optimism.io",
  };
  
  return publicRpcs[chain.id] || "https://eth.llamarpc.com";
}

/**
 * Wait for Anvil to be ready
 */
export async function waitForAnvil(
  url: string = "http://127.0.0.1:8545",
  maxAttempts: number = 30,
  delayMs: number = 1000
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_blockNumber",
          params: [],
          id: 1,
        }),
      });
      
      if (response.ok) {
        return true;
      }
    } catch {
      // Anvil not ready yet
    }
    
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  
  return false;
}

/**
 * Mine blocks on the fork
 */
export async function mineBlocks(
  publicClient: ReturnType<typeof createPublicClient>,
  numBlocks: number = 1
): Promise<void> {
  // Use the anvil_mine RPC method
  await (publicClient as any).request({
    method: "anvil_mine",
    params: [numBlocks],
  });
}

/**
 * Set the timestamp of the next block
 */
export async function setNextBlockTimestamp(
  publicClient: ReturnType<typeof createPublicClient>,
  timestamp: number
): Promise<void> {
  await (publicClient as any).request({
    method: "evm_setNextBlockTimestamp",
    params: [timestamp],
  });
}

/**
 * Impersonate an address (for testing with whale accounts)
 */
export async function impersonateAccount(
  publicClient: ReturnType<typeof createPublicClient>,
  address: Address
): Promise<void> {
  await (publicClient as any).request({
    method: "anvil_impersonateAccount",
    params: [address],
  });
}

/**
 * Stop impersonating an address
 */
export async function stopImpersonatingAccount(
  publicClient: ReturnType<typeof createPublicClient>,
  address: Address
): Promise<void> {
  await (publicClient as any).request({
    method: "anvil_stopImpersonatingAccount",
    params: [address],
  });
}

/**
 * Set the ETH balance of an address
 */
export async function setBalance(
  publicClient: ReturnType<typeof createPublicClient>,
  address: Address,
  balance: bigint
): Promise<void> {
  await (publicClient as any).request({
    method: "anvil_setBalance",
    params: [address, `0x${balance.toString(16)}`],
  });
}

/**
 * Take a snapshot of the current state
 */
export async function snapshot(
  publicClient: ReturnType<typeof createPublicClient>
): Promise<string> {
  return (publicClient as any).request({
    method: "evm_snapshot",
    params: [],
  });
}

/**
 * Revert to a previous snapshot
 */
export async function revert(
  publicClient: ReturnType<typeof createPublicClient>,
  snapshotId: string
): Promise<boolean> {
  return (publicClient as any).request({
    method: "evm_revert",
    params: [snapshotId],
  });
}

// ============================================================
// Test Helpers
// ============================================================

/**
 * Skip test if Anvil is not available
 */
export function skipIfNoAnvil() {
  return async () => {
    const isAvailable = await waitForAnvil("http://127.0.0.1:8545", 3, 500);
    if (!isAvailable) {
      console.log("Skipping test: Anvil not available");
      return true;
    }
    return false;
  };
}

/**
 * Get well-known whale addresses for testing
 */
export const WHALE_ADDRESSES: Record<string, Record<string, Address>> = {
  ethereum: {
    USDC: "0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503", // Binance
    WETH: "0x8EB8a3b98659Cce290402893d0123abb75E3ab28", // Avalanche Bridge
    USDT: "0xF977814e90dA44bFA03b6295A0616a897441aceC", // Binance
  },
  arbitrum: {
    USDC: "0x489ee077994B6658eAfA855C308275EAd8097C4A", // Arbitrum Gateway
  },
};

/**
 * Create a mock fork context for unit tests (no actual fork needed)
 */
export function createMockForkContext(): ForkContext {
  const testAccount = privateKeyToAccount(TEST_PRIVATE_KEY);
  
  return {
    publicClient: {
      chain: mainnet,
      readContract: vi.fn(),
      simulateContract: vi.fn(),
      estimateGas: vi.fn().mockResolvedValue(200000n),
      getGasPrice: vi.fn().mockResolvedValue(30000000000n),
      getBalance: vi.fn().mockResolvedValue(10000000000000000000n),
      getBlock: vi.fn().mockResolvedValue({ timestamp: BigInt(Date.now() / 1000) }),
      getBlockNumber: vi.fn().mockResolvedValue(18500000n),
    } as unknown as ReturnType<typeof createPublicClient>,
    walletClient: {
      chain: mainnet,
      account: testAccount,
      sendTransaction: vi.fn().mockResolvedValue("0xtxhash"),
      signMessage: vi.fn().mockResolvedValue("0xsignature"),
      writeContract: vi.fn().mockResolvedValue("0xcontracttxhash"),
    } as unknown as ReturnType<typeof createWalletClient>,
    testAccount,
    anvilUrl: "http://127.0.0.1:8545",
    blockNumber: 18500000n,
    cleanup: async () => {},
  };
}

// ============================================================
// Test Setup Helpers
// ============================================================

/**
 * Setup for fork-based integration tests
 */
export async function setupForkTest(
  chainName: string = "ethereum"
): Promise<ForkContext | null> {
  const chain = CHAINS[chainName];
  if (!chain) {
    console.warn(`Unknown chain: ${chainName}`);
    return null;
  }
  
  const anvilUrl = process.env.ANVIL_URL || "http://127.0.0.1:8545";
  
  // Check if Anvil is running
  const isAvailable = await waitForAnvil(anvilUrl, 5, 500);
  if (!isAvailable) {
    console.warn("Anvil not available, skipping fork test setup");
    return null;
  }
  
  const { publicClient, walletClient, testAccount } = createForkClients(anvilUrl, chain);
  
  // Take a snapshot for cleanup
  const snapshotId = await snapshot(publicClient);
  
  // Get current block number
  const blockNumber = await publicClient.getBlockNumber();
  
  return {
    publicClient,
    walletClient,
    testAccount,
    anvilUrl,
    blockNumber,
    cleanup: async () => {
      await revert(publicClient, snapshotId);
    },
  };
}

/**
 * Create a describe block that skips if Anvil is not available
 */
export function describeFork(name: string, fn: () => void) {
  const shouldSkip = !process.env.ANVIL_URL && !process.env.RUN_FORK_TESTS;
  
  if (shouldSkip) {
    describe.skip(`[Fork] ${name}`, fn);
  } else {
    describe(`[Fork] ${name}`, fn);
  }
}
