/**
 * @file OnChainRegistry.ts
 * @author nirholas
 * @copyright (c) 2026 nichxbt
 * @repository universal-crypto-mcp
 * @version 0.4.14.3
 * 
 * TypeScript SDK for interacting with on-chain tool registry
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  type PublicClient,
  type WalletClient,
  type Chain,
  type Address,
  type Hash,
  type Log,
  encodeAbiParameters,
  keccak256,
  parseUnits,
  formatUnits,
} from 'viem';
import { arbitrum, arbitrumSepolia, base, baseSepolia, optimism, optimismSepolia } from 'viem/chains';

import { TOOL_REGISTRY_ABI, REVENUE_ROUTER_ABI, TOOL_STAKING_ABI, ERC20_ABI } from './abis';
import { getContractAddresses, type ChainId, type ContractAddresses } from './addresses';

// ═══════════════════════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════════════════════

export interface OnChainTool {
  toolId: `0x${string}`;
  owner: Address;
  name: string;
  endpoint: string;
  metadataURI: string;
  pricePerCall: bigint;
  pricePerCallFormatted: string;
  active: boolean;
  verified: boolean;
  totalCalls: bigint;
  totalRevenue: bigint;
  totalRevenueFormatted: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RevenueSplit {
  recipient: Address;
  sharePercentage: number; // 0-100
}

export interface StakeInfo {
  amount: bigint;
  amountFormatted: string;
  lockedUntil: Date | null;
  pendingUnstake: bigint;
  unstakeRequestTime: Date | null;
  hasActiveUnstake: boolean;
}

export interface RegisterToolParams {
  name: string;
  endpoint: string;
  metadataURI: string;
  pricePerCall: string; // In USDs (e.g., "0.01")
  revenueSplits: RevenueSplit[];
}

export interface ToolRegistryEvents {
  onToolRegistered?: (toolId: `0x${string}`, owner: Address, name: string) => void;
  onToolUpdated?: (toolId: `0x${string}`) => void;
  onToolPaused?: (toolId: `0x${string}`) => void;
  onToolActivated?: (toolId: `0x${string}`) => void;
  onUsageRecorded?: (toolId: `0x${string}`, payer: Address, amount: bigint) => void;
}

// ═══════════════════════════════════════════════════════════════
//  Chain Config
// ═══════════════════════════════════════════════════════════════

const CHAIN_CONFIG: Record<ChainId, Chain> = {
  42161: arbitrum,
  421614: arbitrumSepolia,
  8453: base,
  84532: baseSepolia,
  10: optimism,
  11155420: optimismSepolia,
};

// ═══════════════════════════════════════════════════════════════
//  OnChainRegistry Class
// ═══════════════════════════════════════════════════════════════

/**
 * TypeScript SDK for interacting with the on-chain tool registry
 * @author nirholas
 */
export class OnChainRegistry {
  private publicClient: PublicClient;
  private walletClient?: WalletClient;
  private addresses: ContractAddresses;
  private chainId: ChainId;
  private eventListeners: Map<string, () => void> = new Map();

  // Local cache for tools
  private toolCache: Map<`0x${string}`, OnChainTool> = new Map();
  private lastCacheUpdate: Date | null = null;

  /**
   * Get the account address from the wallet client
   * @throws Error if no account is available
   */
  private async getAccount(): Promise<`0x${string}`> {
    if (!this.walletClient) {
      throw new Error('Wallet client required');
    }
    const [account] = await this.walletClient.getAddresses();
    if (!account) {
      throw new Error('No account available in wallet client');
    }
    return account;
  }

  constructor(
    chainId: ChainId,
    rpcUrl?: string,
    walletClient?: WalletClient
  ) {
    this.chainId = chainId;
    this.addresses = getContractAddresses(chainId);
    this.walletClient = walletClient;

    const chain = CHAIN_CONFIG[chainId];
    if (!chain) {
      throw new Error(`Unsupported chain ID: ${chainId}`);
    }

    this.publicClient = createPublicClient({
      chain,
      transport: http(rpcUrl),
    });
  }

  // ═══════════════════════════════════════════════════════════════
  //  Tool Registration & Management
  // ═══════════════════════════════════════════════════════════════

  /**
   * Register a new tool on-chain
   * @param params Tool registration parameters
   * @returns Transaction hash and tool ID
   */
  async registerTool(params: RegisterToolParams): Promise<{ hash: Hash; toolId: `0x${string}` }> {
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations');
    }

    const priceWei = parseUnits(params.pricePerCall, 18);
    const recipients = params.revenueSplits.map(s => s.recipient);
    const shares = params.revenueSplits.map(s => BigInt(s.sharePercentage * 100)); // Convert to basis points

    // Validate shares sum to 100%
    const totalShares = shares.reduce((a, b) => a + b, 0n);
    if (totalShares !== 10000n) {
      throw new Error(`Revenue shares must sum to 100%, got ${Number(totalShares) / 100}%`);
    }

    const [account] = await this.walletClient.getAddresses();
    if (!account) {
      throw new Error('No account available in wallet client');
    }

    // Calculate expected tool ID
    const toolId = this.computeToolId(params.name, account);

    const hash = await this.walletClient.writeContract({
      address: this.addresses.toolRegistry,
      abi: TOOL_REGISTRY_ABI,
      functionName: 'registerTool',
      args: [
        params.name,
        params.endpoint,
        params.metadataURI,
        priceWei,
        recipients,
        shares,
      ],
      account: account,
      chain: CHAIN_CONFIG[this.chainId],
    });

    return { hash, toolId };
  }

  /**
   * Update tool metadata and pricing
   */
  async updateTool(
    toolId: `0x${string}`,
    metadataURI?: string,
    pricePerCall?: string
  ): Promise<Hash> {
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations');
    }

    const account = await this.getAccount();
    const priceWei = pricePerCall ? parseUnits(pricePerCall, 18) : 0n;

    return this.walletClient.writeContract({
      address: this.addresses.toolRegistry,
      abi: TOOL_REGISTRY_ABI,
      functionName: 'updateTool',
      args: [toolId, metadataURI || '', priceWei],
      account: account,
      chain: CHAIN_CONFIG[this.chainId],
    });
  }

  /**
   * Update tool endpoint
   */
  async updateEndpoint(toolId: `0x${string}`, newEndpoint: string): Promise<Hash> {
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations');
    }

    const account = await this.getAccount();

    return this.walletClient.writeContract({
      address: this.addresses.toolRegistry,
      abi: TOOL_REGISTRY_ABI,
      functionName: 'updateEndpoint',
      args: [toolId, newEndpoint],
      account: account,
      chain: CHAIN_CONFIG[this.chainId],
    });
  }

  /**
   * Pause a tool
   */
  async pauseTool(toolId: `0x${string}`): Promise<Hash> {
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations');
    }

    const account = await this.getAccount();

    return this.walletClient.writeContract({
      address: this.addresses.toolRegistry,
      abi: TOOL_REGISTRY_ABI,
      functionName: 'pauseTool',
      args: [toolId],
      account: account,
      chain: CHAIN_CONFIG[this.chainId],
    });
  }

  /**
   * Activate a paused tool
   */
  async activateTool(toolId: `0x${string}`): Promise<Hash> {
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations');
    }

    const account = await this.getAccount();

    return this.walletClient.writeContract({
      address: this.addresses.toolRegistry,
      abi: TOOL_REGISTRY_ABI,
      functionName: 'activateTool',
      args: [toolId],
      account: account,
      chain: CHAIN_CONFIG[this.chainId],
    });
  }

  /**
   * Transfer tool ownership
   */
  async transferToolOwnership(toolId: `0x${string}`, newOwner: Address): Promise<Hash> {
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations');
    }

    const account = await this.getAccount();

    return this.walletClient.writeContract({
      address: this.addresses.toolRegistry,
      abi: TOOL_REGISTRY_ABI,
      functionName: 'transferOwnership',
      args: [toolId, newOwner],
      account: account,
      chain: CHAIN_CONFIG[this.chainId],
    });
  }

  // ═══════════════════════════════════════════════════════════════
  //  Read Functions
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get tool by ID
   */
  async getTool(toolId: `0x${string}`): Promise<OnChainTool | null> {
    try {
      const result = await this.publicClient.readContract({
        address: this.addresses.toolRegistry,
        abi: TOOL_REGISTRY_ABI,
        functionName: 'getTool',
        args: [toolId],
      });

      if (result.owner === '0x0000000000000000000000000000000000000000') {
        return null;
      }

      const tool = this.formatTool(toolId, result);
      this.toolCache.set(toolId, tool);
      return tool;
    } catch {
      return null;
    }
  }

  /**
   * Get revenue split configuration for a tool
   */
  async getRevenueSplit(toolId: `0x${string}`): Promise<RevenueSplit[]> {
    const [recipients, shares] = await this.publicClient.readContract({
      address: this.addresses.toolRegistry,
      abi: TOOL_REGISTRY_ABI,
      functionName: 'getRevenueSplit',
      args: [toolId],
    });

    return recipients.map((recipient, i) => ({
      recipient,
      sharePercentage: Number(shares[i]) / 100,
    }));
  }

  /**
   * Get all tools owned by an address
   */
  async getToolsByOwner(owner: Address): Promise<OnChainTool[]> {
    const toolIds = await this.publicClient.readContract({
      address: this.addresses.toolRegistry,
      abi: TOOL_REGISTRY_ABI,
      functionName: 'getToolsByOwner',
      args: [owner],
    });

    const tools: OnChainTool[] = [];
    for (const toolId of toolIds) {
      const tool = await this.getTool(toolId);
      if (tool) {
        tools.push(tool);
      }
    }
    return tools;
  }

  /**
   * Get total number of registered tools
   */
  async getTotalTools(): Promise<number> {
    const count = await this.publicClient.readContract({
      address: this.addresses.toolRegistry,
      abi: TOOL_REGISTRY_ABI,
      functionName: 'totalTools',
    });
    return Number(count);
  }

  /**
   * Get all tools (paginated)
   */
  async getAllTools(offset = 0, limit = 50): Promise<OnChainTool[]> {
    const toolIds = await this.publicClient.readContract({
      address: this.addresses.toolRegistry,
      abi: TOOL_REGISTRY_ABI,
      functionName: 'getAllTools',
      args: [BigInt(offset), BigInt(limit)],
    });

    const tools: OnChainTool[] = [];
    for (const toolId of toolIds) {
      const tool = await this.getTool(toolId);
      if (tool) {
        tools.push(tool);
      }
    }
    return tools;
  }

  /**
   * Check if a tool exists
   */
  async toolExists(toolId: `0x${string}`): Promise<boolean> {
    return this.publicClient.readContract({
      address: this.addresses.toolRegistry,
      abi: TOOL_REGISTRY_ABI,
      functionName: 'toolExists',
      args: [toolId],
    });
  }

  /**
   * Compute tool ID from name and owner
   */
  computeToolId(name: string, owner: Address): `0x${string}` {
    return keccak256(
      encodeAbiParameters(
        [{ type: 'string' }, { type: 'address' }],
        [name, owner]
      )
    );
  }

  // ═══════════════════════════════════════════════════════════════
  //  Revenue Router Functions
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get pending balance for an address
   */
  async getPendingBalance(account: Address): Promise<{ amount: bigint; formatted: string }> {
    const amount = await this.publicClient.readContract({
      address: this.addresses.revenueRouter,
      abi: REVENUE_ROUTER_ABI,
      functionName: 'getPendingBalance',
      args: [account],
    });

    return {
      amount,
      formatted: formatUnits(amount, 18),
    };
  }

  /**
   * Check if an account can claim their balance
   */
  async canClaim(account: Address): Promise<boolean> {
    return this.publicClient.readContract({
      address: this.addresses.revenueRouter,
      abi: REVENUE_ROUTER_ABI,
      functionName: 'canClaim',
      args: [account],
    });
  }

  /**
   * Claim pending payout
   */
  async claimPayout(): Promise<Hash> {
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations');
    }

    const account = await this.getAccount();

    return this.walletClient.writeContract({
      address: this.addresses.revenueRouter,
      abi: REVENUE_ROUTER_ABI,
      functionName: 'claimPayout',
      args: [],
      account: account,
      chain: CHAIN_CONFIG[this.chainId],
    });
  }

  /**
   * Get platform fee percentage
   */
  async getPlatformFee(): Promise<number> {
    const feeBps = await this.publicClient.readContract({
      address: this.addresses.revenueRouter,
      abi: REVENUE_ROUTER_ABI,
      functionName: 'platformFeeBps',
    });
    return Number(feeBps) / 100; // Convert from basis points to percentage
  }

  /**
   * Get total revenue processed
   */
  async getTotalRevenueProcessed(): Promise<{ amount: bigint; formatted: string }> {
    const amount = await this.publicClient.readContract({
      address: this.addresses.revenueRouter,
      abi: REVENUE_ROUTER_ABI,
      functionName: 'totalRevenueProcessed',
    });

    return {
      amount,
      formatted: formatUnits(amount, 18),
    };
  }

  // ═══════════════════════════════════════════════════════════════
  //  Staking Functions
  // ═══════════════════════════════════════════════════════════════

  /**
   * Stake USDs tokens
   */
  async stake(amount: string): Promise<Hash> {
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations');
    }

    const account = await this.getAccount();
    const amountWei = parseUnits(amount, 18);

    // First approve the staking contract
    await this.approveToken(this.addresses.toolStaking, amountWei);

    return this.walletClient.writeContract({
      address: this.addresses.toolStaking,
      abi: TOOL_STAKING_ABI,
      functionName: 'stake',
      args: [amountWei],
      account: account,
      chain: CHAIN_CONFIG[this.chainId],
    });
  }

  /**
   * Request unstake (starts 7-day delay)
   */
  async requestUnstake(amount: string): Promise<Hash> {
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations');
    }

    const account = await this.getAccount();
    const amountWei = parseUnits(amount, 18);

    return this.walletClient.writeContract({
      address: this.addresses.toolStaking,
      abi: TOOL_STAKING_ABI,
      functionName: 'requestUnstake',
      args: [amountWei],
      account: account,
      chain: CHAIN_CONFIG[this.chainId],
    });
  }

  /**
   * Complete unstake after delay
   */
  async unstake(): Promise<Hash> {
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations');
    }

    const account = await this.getAccount();

    return this.walletClient.writeContract({
      address: this.addresses.toolStaking,
      abi: TOOL_STAKING_ABI,
      functionName: 'unstake',
      args: [],
      account: account,
      chain: CHAIN_CONFIG[this.chainId],
    });
  }

  /**
   * Get stake info for an address
   */
  async getStakeInfo(account: Address): Promise<StakeInfo> {
    const result = await this.publicClient.readContract({
      address: this.addresses.toolStaking,
      abi: TOOL_STAKING_ABI,
      functionName: 'getStakeInfo',
      args: [account],
    });

    return {
      amount: result.amount,
      amountFormatted: formatUnits(result.amount, 18),
      lockedUntil: result.lockedUntil > 0n ? new Date(Number(result.lockedUntil) * 1000) : null,
      pendingUnstake: result.pendingUnstake,
      unstakeRequestTime: result.unstakeRequestTime > 0n 
        ? new Date(Number(result.unstakeRequestTime) * 1000) 
        : null,
      hasActiveUnstake: result.hasActiveUnstake,
    };
  }

  /**
   * Check if user meets minimum stake requirement
   */
  async meetsMinimumStake(account: Address): Promise<boolean> {
    return this.publicClient.readContract({
      address: this.addresses.toolStaking,
      abi: TOOL_STAKING_ABI,
      functionName: 'meetsMinimumStake',
      args: [account],
    });
  }

  /**
   * Get minimum stake requirement
   */
  async getMinimumStake(): Promise<{ amount: bigint; formatted: string }> {
    const amount = await this.publicClient.readContract({
      address: this.addresses.toolStaking,
      abi: TOOL_STAKING_ABI,
      functionName: 'minimumStake',
    });

    return {
      amount,
      formatted: formatUnits(amount, 18),
    };
  }

  // ═══════════════════════════════════════════════════════════════
  //  Event Listeners
  // ═══════════════════════════════════════════════════════════════

  /**
   * Subscribe to registry events
   */
  subscribeToEvents(callbacks: ToolRegistryEvents): void {
    if (callbacks.onToolRegistered) {
      const unwatch = this.publicClient.watchContractEvent({
        address: this.addresses.toolRegistry,
        abi: TOOL_REGISTRY_ABI,
        eventName: 'ToolRegistered',
        onLogs: (logs) => {
          for (const log of logs) {
            const { toolId, owner, name } = log.args as any;
            callbacks.onToolRegistered!(toolId, owner, name);
          }
        },
      });
      this.eventListeners.set('ToolRegistered', unwatch);
    }

    if (callbacks.onToolUpdated) {
      const unwatch = this.publicClient.watchContractEvent({
        address: this.addresses.toolRegistry,
        abi: TOOL_REGISTRY_ABI,
        eventName: 'ToolUpdated',
        onLogs: (logs) => {
          for (const log of logs) {
            const { toolId } = log.args as any;
            callbacks.onToolUpdated!(toolId);
          }
        },
      });
      this.eventListeners.set('ToolUpdated', unwatch);
    }

    if (callbacks.onUsageRecorded) {
      const unwatch = this.publicClient.watchContractEvent({
        address: this.addresses.toolRegistry,
        abi: TOOL_REGISTRY_ABI,
        eventName: 'UsageRecorded',
        onLogs: (logs) => {
          for (const log of logs) {
            const { toolId, payer, amount } = log.args as any;
            callbacks.onUsageRecorded!(toolId, payer, amount);
          }
        },
      });
      this.eventListeners.set('UsageRecorded', unwatch);
    }
  }

  /**
   * Unsubscribe from all events
   */
  unsubscribeAll(): void {
    for (const unwatch of this.eventListeners.values()) {
      unwatch();
    }
    this.eventListeners.clear();
  }

  // ═══════════════════════════════════════════════════════════════
  //  Cache Management
  // ═══════════════════════════════════════════════════════════════

  /**
   * Sync all tools from chain to local cache
   */
  async syncCache(): Promise<void> {
    const total = await this.getTotalTools();
    const batchSize = 50;
    
    this.toolCache.clear();
    
    for (let offset = 0; offset < total; offset += batchSize) {
      const tools = await this.getAllTools(offset, batchSize);
      for (const tool of tools) {
        this.toolCache.set(tool.toolId, tool);
      }
    }
    
    this.lastCacheUpdate = new Date();
  }

  /**
   * Get cached tools
   */
  getCachedTools(): OnChainTool[] {
    return Array.from(this.toolCache.values());
  }

  /**
   * Get last cache update time
   */
  getLastCacheUpdate(): Date | null {
    return this.lastCacheUpdate;
  }

  // ═══════════════════════════════════════════════════════════════
  //  Helper Functions
  // ═══════════════════════════════════════════════════════════════

  private formatTool(toolId: `0x${string}`, raw: any): OnChainTool {
    return {
      toolId,
      owner: raw.owner,
      name: raw.name,
      endpoint: raw.endpoint,
      metadataURI: raw.metadataURI,
      pricePerCall: raw.pricePerCall,
      pricePerCallFormatted: formatUnits(raw.pricePerCall, 18),
      active: raw.active,
      verified: raw.verified,
      totalCalls: raw.totalCalls,
      totalRevenue: raw.totalRevenue,
      totalRevenueFormatted: formatUnits(raw.totalRevenue, 18),
      createdAt: new Date(Number(raw.createdAt) * 1000),
      updatedAt: new Date(Number(raw.updatedAt) * 1000),
    };
  }

  private async approveToken(spender: Address, amount: bigint): Promise<void> {
    if (!this.walletClient) return;

    const account = await this.getAccount();

    // Check current allowance
    const allowance = await this.publicClient.readContract({
      address: this.addresses.usdsToken,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [account, spender],
    });

    if (allowance < amount) {
      await this.walletClient.writeContract({
        address: this.addresses.usdsToken,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [spender, amount],
        account: account,
        chain: CHAIN_CONFIG[this.chainId],
      });
    }
  }

  /**
   * Get contract addresses
   */
  getAddresses(): ContractAddresses {
    return this.addresses;
  }

  /**
   * Get chain ID
   */
  getChainId(): ChainId {
    return this.chainId;
  }
}

// Export convenience function
export function createOnChainRegistry(
  chainId: ChainId,
  rpcUrl?: string,
  walletClient?: WalletClient
): OnChainRegistry {
  return new OnChainRegistry(chainId, rpcUrl, walletClient);
}

// EOF - nichxbt | ucm:n1ch-0las-registry
