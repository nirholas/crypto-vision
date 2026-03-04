/**
 * Supply Chart — Token supply distribution tracker for pie/donut chart rendering
 *
 * Features:
 * - Fetches on-chain token holder data via getTokenLargestAccounts
 * - Categorizes holders as swarm, dev, curve, or external
 * - Calculates Gini coefficient and HHI concentration metrics
 * - Maintains historical distribution snapshots in circular buffer
 * - Assigns consistent colors for dashboard chart rendering
 * - Periodic automatic tracking with configurable interval
 * - Event bus integration for distribution change notifications
 */

import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

import type { SwarmEventBus } from '../infra/event-bus.js';
import type { RpcPool } from '../infra/rpc-pool.js';
import { SwarmLogger } from '../infra/logger.js';

// ─── Constants ────────────────────────────────────────────────

/** Maximum historical snapshots retained in circular buffer */
const MAX_HISTORY_SIZE = 1_000;

/** Default tracking interval: 60 seconds */
const DEFAULT_TRACKING_INTERVAL_MS = 60_000;

/** Pump.fun program ID on Solana mainnet */
const PUMP_FUN_PROGRAM_ID = new PublicKey(
  '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',
);

// ─── Color Palette ────────────────────────────────────────────

/** Blue shades for swarm wallets */
const SWARM_COLORS = [
  '#1E40AF', // blue-800
  '#2563EB', // blue-600
  '#3B82F6', // blue-500
  '#60A5FA', // blue-400
  '#93C5FD', // blue-300
  '#BFDBFE', // blue-200
  '#DBEAFE', // blue-100
  '#1D4ED8', // blue-700
  '#2563EB', // blue-600 (repeat for more wallets)
  '#3B82F6', // blue-500
] as const;

/** Dev wallet color */
const DEV_COLOR = '#DC2626'; // red-600

/** Bonding curve color */
const CURVE_COLOR = '#EAB308'; // yellow-500

/** External holder grey shades */
const EXTERNAL_COLORS = [
  '#6B7280', // gray-500
  '#9CA3AF', // gray-400
  '#D1D5DB', // gray-300
  '#4B5563', // gray-600
  '#374151', // gray-700
  '#E5E7EB', // gray-200
] as const;

// ─── Interfaces ───────────────────────────────────────────────

export interface SwarmWalletInfo {
  address: string;
  agentId: string;
  agentType: string;
  label: string;
}

export interface SupplyHolder {
  /** Wallet address */
  wallet: string;
  /** Display label (agent name or truncated address) */
  label: string;
  /** Token balance */
  tokens: bigint;
  /** Percentage of total supply */
  percent: number;
  /** Role: 'swarm', 'dev', 'curve', 'external' */
  role: 'swarm' | 'dev' | 'curve' | 'external';
  /** Agent ID if swarm wallet */
  agentId?: string;
  /** Agent type if swarm wallet */
  agentType?: string;
  /** Color for chart rendering */
  color: string;
}

export interface SupplyDistribution {
  timestamp: number;
  tokenMint: string;
  totalSupply: bigint;
  /** Holders sorted by balance descending */
  holders: SupplyHolder[];
  /** Aggregate swarm stats */
  swarmTotal: {
    tokens: bigint;
    percent: number;
    walletCount: number;
  };
  /** Aggregate external stats */
  externalTotal: {
    tokens: bigint;
    percent: number;
    walletCount: number;
  };
  /** Bonding curve / pool reserves */
  curveReserves: {
    tokens: bigint;
    percent: number;
  };
}

export interface ConcentrationMetrics {
  /** Gini coefficient (0 = perfect equality, 1 = one holder has all) */
  giniCoefficient: number;
  /** Herfindahl-Hirschman Index (0-10000) */
  hhi: number;
  /** Top 1 holder percentage */
  top1Percent: number;
  /** Top 5 holders percentage */
  top5Percent: number;
  /** Top 10 holders percentage */
  top10Percent: number;
  /** Number of unique holders */
  uniqueHolders: number;
  /** Percent held by swarm */
  swarmControlPercent: number;
}

// ─── Circular Buffer ──────────────────────────────────────────

/**
 * Fixed-capacity ring buffer for distribution history.
 * O(1) push, O(n) iteration — no array shifts or GC pressure.
 */
class DistributionBuffer {
  private readonly buffer: Array<SupplyDistribution | undefined>;
  private head = 0;
  private _size = 0;

  constructor(private readonly capacity: number) {
    this.buffer = new Array<SupplyDistribution | undefined>(capacity);
  }

  get size(): number {
    return this._size;
  }

  push(item: SupplyDistribution): void {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this._size < this.capacity) {
      this._size++;
    }
  }

  /** Return all items oldest → newest */
  toArray(): SupplyDistribution[] {
    if (this._size === 0) return [];
    const result: SupplyDistribution[] = [];
    const start = this._size < this.capacity ? 0 : this.head;
    for (let i = 0; i < this._size; i++) {
      const idx = (start + i) % this.capacity;
      const item = this.buffer[idx];
      if (item !== undefined) {
        result.push(item);
      }
    }
    return result;
  }

  /** Get the most recent item */
  latest(): SupplyDistribution | undefined {
    if (this._size === 0) return undefined;
    const idx = (this.head - 1 + this.capacity) % this.capacity;
    return this.buffer[idx];
  }

  clear(): void {
    this.buffer.fill(undefined);
    this.head = 0;
    this._size = 0;
  }
}

// ─── SupplyChart ──────────────────────────────────────────────

/**
 * Tracks token supply distribution across swarm and external wallets,
 * providing data formatted for pie/donut chart rendering.
 *
 * ```typescript
 * const chart = new SupplyChart(rpcPool, eventBus);
 * chart.setTokenMint('TokenMintAddress...');
 * chart.setSwarmWallets([
 *   { address: '...', agentId: 'trader-0', agentType: 'trader', label: 'Trader 0' },
 * ]);
 * const dist = await chart.getDistribution();
 * console.log(dist.holders); // sorted by balance descending
 * console.log(chart.getConcentrationMetrics()); // Gini, HHI, top holders
 * ```
 */
export class SupplyChart {
  private readonly rpcPool: RpcPool;
  private readonly eventBus: SwarmEventBus;
  private readonly logger: SwarmLogger;
  private readonly history: DistributionBuffer;

  private tokenMint: PublicKey | undefined;
  private tokenMintStr = '';
  private swarmWallets: SwarmWalletInfo[] = [];
  private swarmAddressSet = new Set<string>();
  private devWallet: string | undefined;
  private trackingTimer: ReturnType<typeof setInterval> | undefined;

  constructor(rpcPool: RpcPool, eventBus: SwarmEventBus) {
    this.rpcPool = rpcPool;
    this.eventBus = eventBus;
    this.logger = SwarmLogger.create('supply-chart', 'analytics');
    this.history = new DistributionBuffer(MAX_HISTORY_SIZE);
  }

  // ─── Configuration ────────────────────────────────────────

  /**
   * Set the token mint address to track.
   *
   * @param mint - Base58-encoded mint address
   */
  setTokenMint(mint: string): void {
    this.tokenMint = new PublicKey(mint);
    this.tokenMintStr = mint;
    this.logger.info('Token mint configured', { mint });
  }

  /**
   * Register swarm wallets for categorization.
   * These wallets will be tagged with 'swarm' role and their agent metadata.
   *
   * @param wallets - Array of swarm wallet info objects
   */
  setSwarmWallets(wallets: SwarmWalletInfo[]): void {
    this.swarmWallets = wallets;
    this.swarmAddressSet = new Set(wallets.map((w) => w.address));
    this.logger.info('Swarm wallets configured', {
      count: wallets.length,
      addresses: wallets.map((w) => w.address),
    });
  }

  /**
   * Set the dev (creator) wallet address for categorization.
   *
   * @param address - Base58-encoded dev wallet address
   */
  setDevWallet(address: string): void {
    this.devWallet = address;
    this.logger.info('Dev wallet configured', { address });
  }

  // ─── Distribution Fetching ────────────────────────────────

  /**
   * Fetch current token supply distribution from on-chain data.
   *
   * Uses `getTokenLargestAccounts` to retrieve the top holders,
   * then categorizes each as swarm, dev, curve, or external.
   *
   * @returns Complete supply distribution with holder breakdown
   * @throws {Error} If no token mint is configured
   */
  async getDistribution(): Promise<SupplyDistribution> {
    if (!this.tokenMint) {
      throw new Error('Token mint not configured — call setTokenMint() first');
    }

    const connection = this.rpcPool.getConnection();
    const mintPubkey = this.tokenMint;

    // Fetch token supply
    const supplyResponse = await connection.getTokenSupply(mintPubkey);
    const totalSupply = BigInt(supplyResponse.value.amount);

    // Fetch largest token accounts (top 20 on-chain)
    const largestAccounts = await connection.getTokenLargestAccounts(mintPubkey);

    // Derive the Pump.fun bonding curve PDA for this mint
    const curveAddress = this.deriveBondingCurvePDA(mintPubkey);

    // Resolve token account owners in parallel
    const holderEntries = await this.resolveHolderOwners(
      largestAccounts.value,
      curveAddress,
    );

    // Sort by balance descending
    holderEntries.sort((a, b) => {
      if (b.tokens > a.tokens) return 1;
      if (b.tokens < a.tokens) return -1;
      return 0;
    });

    // Calculate aggregates
    let swarmTokens = 0n;
    let swarmCount = 0;
    let externalTokens = 0n;
    let externalCount = 0;
    let curveTokens = 0n;

    for (const holder of holderEntries) {
      switch (holder.role) {
        case 'swarm':
          swarmTokens += holder.tokens;
          swarmCount++;
          break;
        case 'curve':
          curveTokens += holder.tokens;
          break;
        case 'dev':
        case 'external':
          externalTokens += holder.tokens;
          externalCount++;
          break;
      }
    }

    const distribution: SupplyDistribution = {
      timestamp: Date.now(),
      tokenMint: this.tokenMintStr,
      totalSupply,
      holders: holderEntries,
      swarmTotal: {
        tokens: swarmTokens,
        percent: totalSupply > 0n ? this.toPercent(swarmTokens, totalSupply) : 0,
        walletCount: swarmCount,
      },
      externalTotal: {
        tokens: externalTokens,
        percent: totalSupply > 0n ? this.toPercent(externalTokens, totalSupply) : 0,
        walletCount: externalCount,
      },
      curveReserves: {
        tokens: curveTokens,
        percent: totalSupply > 0n ? this.toPercent(curveTokens, totalSupply) : 0,
      },
    };

    // Store snapshot
    this.history.push(distribution);

    // Emit event
    this.eventBus.emit(
      'supply:distribution:updated',
      'analytics',
      'supply-chart',
      {
        tokenMint: this.tokenMintStr,
        totalSupply: totalSupply.toString(),
        holderCount: holderEntries.length,
        swarmPercent: distribution.swarmTotal.percent,
        externalPercent: distribution.externalTotal.percent,
        curvePercent: distribution.curveReserves.percent,
      },
    );

    this.logger.info('Supply distribution fetched', {
      holders: holderEntries.length,
      swarmPercent: distribution.swarmTotal.percent,
      externalPercent: distribution.externalTotal.percent,
      curvePercent: distribution.curveReserves.percent,
    });

    return distribution;
  }

  /**
   * Get historical distribution snapshots.
   *
   * @returns Array of past snapshots, oldest first
   */
  getDistributionHistory(): SupplyDistribution[] {
    return this.history.toArray();
  }

  // ─── Periodic Tracking ────────────────────────────────────

  /**
   * Start periodic distribution snapshot collection.
   *
   * @param intervalMs - Interval between snapshots (default: 60000ms)
   */
  startTracking(intervalMs: number = DEFAULT_TRACKING_INTERVAL_MS): void {
    if (this.trackingTimer !== undefined) {
      this.logger.warn('Tracking already active — stopping previous timer');
      this.stopTracking();
    }

    this.logger.info('Starting supply tracking', { intervalMs });

    this.trackingTimer = setInterval(() => {
      this.getDistribution().catch((err: unknown) => {
        const error = err instanceof Error ? err : new Error(String(err));
        this.logger.error('Tracking snapshot failed', error);
      });
    }, intervalMs);
  }

  /**
   * Stop periodic tracking.
   */
  stopTracking(): void {
    if (this.trackingTimer !== undefined) {
      clearInterval(this.trackingTimer);
      this.trackingTimer = undefined;
      this.logger.info('Supply tracking stopped');
    }
  }

  // ─── Concentration Metrics ────────────────────────────────

  /**
   * Calculate concentration metrics from the most recent distribution snapshot.
   *
   * Metrics include:
   * - **Gini coefficient**: 0 (perfect equality) to 1 (single holder)
   * - **HHI**: Herfindahl-Hirschman Index, sum of squared market shares (0–10000)
   * - **Top N holder percentages**: % of supply held by top 1, 5, 10 holders
   *
   * @returns Concentration metrics or zero-value defaults if no data
   */
  getConcentrationMetrics(): ConcentrationMetrics {
    const latest = this.history.latest();
    if (!latest || latest.holders.length === 0) {
      return {
        giniCoefficient: 0,
        hhi: 0,
        top1Percent: 0,
        top5Percent: 0,
        top10Percent: 0,
        uniqueHolders: 0,
        swarmControlPercent: 0,
      };
    }

    const holders = latest.holders;
    const balances = holders.map((h) => h.tokens);
    const totalSupply = latest.totalSupply;

    return {
      giniCoefficient: this.calculateGini(balances),
      hhi: this.calculateHHI(balances, totalSupply),
      top1Percent: this.topNPercent(holders, 1),
      top5Percent: this.topNPercent(holders, 5),
      top10Percent: this.topNPercent(holders, 10),
      uniqueHolders: holders.length,
      swarmControlPercent: latest.swarmTotal.percent,
    };
  }

  // ─── Private: On-chain Resolution ─────────────────────────

  /**
   * Derive the Pump.fun bonding curve PDA for a given token mint.
   *
   * The PDA is derived using the seeds: ["bonding-curve", mintPubkey]
   * against the Pump.fun program ID.
   */
  private deriveBondingCurvePDA(mint: PublicKey): string {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from('bonding-curve'), mint.toBuffer()],
      PUMP_FUN_PROGRAM_ID,
    );
    return pda.toBase58();
  }

  /**
   * Resolve token account addresses to owner wallet addresses
   * and categorize each holder.
   */
  private async resolveHolderOwners(
    accounts: ReadonlyArray<{
      address: PublicKey;
      amount: string;
      decimals: number;
      uiAmount: number | null;
      uiAmountString: string;
    }>,
    curveAddress: string,
  ): Promise<SupplyHolder[]> {
    const connection = this.rpcPool.getConnection();
    const holders: SupplyHolder[] = [];
    let swarmColorIdx = 0;
    let externalColorIdx = 0;

    // Batch-fetch account info for all token accounts to resolve owners
    const accountPubkeys = accounts.map((a) => a.address);
    const accountInfos = await connection.getMultipleAccountsInfo(accountPubkeys);

    for (let i = 0; i < accounts.length; i++) {
      const account = accounts[i];
      const tokens = BigInt(account.amount);
      if (tokens === 0n) continue;

      const accountInfo = accountInfos[i];
      let ownerAddress: string;

      if (accountInfo && accountInfo.data.length >= 64) {
        // SPL Token account layout: owner pubkey is at offset 32, 32 bytes
        const ownerBytes = accountInfo.data.subarray(32, 64);
        ownerAddress = new PublicKey(ownerBytes).toBase58();
      } else {
        // Fallback: use the token account address itself
        ownerAddress = account.address.toBase58();
      }

      const holder = this.categorizeHolder(
        ownerAddress,
        tokens,
        curveAddress,
        swarmColorIdx,
        externalColorIdx,
      );

      if (holder.role === 'swarm') swarmColorIdx++;
      if (holder.role === 'external') externalColorIdx++;

      holders.push(holder);
    }

    return holders;
  }

  /**
   * Categorize a holder by address, assigning role, label, and color.
   */
  private categorizeHolder(
    ownerAddress: string,
    tokens: bigint,
    curveAddress: string,
    swarmColorIdx: number,
    externalColorIdx: number,
  ): SupplyHolder {
    // Check if this is the bonding curve
    if (ownerAddress === curveAddress) {
      return {
        wallet: ownerAddress,
        label: 'Bonding Curve',
        tokens,
        percent: 0, // filled in by caller
        role: 'curve',
        color: CURVE_COLOR,
      };
    }

    // Check if this is the dev wallet
    if (this.devWallet && ownerAddress === this.devWallet) {
      return {
        wallet: ownerAddress,
        label: 'Dev Wallet',
        tokens,
        percent: 0,
        role: 'dev',
        color: DEV_COLOR,
      };
    }

    // Check if this is a swarm wallet
    if (this.swarmAddressSet.has(ownerAddress)) {
      const walletInfo = this.swarmWallets.find((w) => w.address === ownerAddress);
      return {
        wallet: ownerAddress,
        label: walletInfo?.label ?? `Swarm ${swarmColorIdx}`,
        tokens,
        percent: 0,
        role: 'swarm',
        agentId: walletInfo?.agentId,
        agentType: walletInfo?.agentType,
        color: SWARM_COLORS[swarmColorIdx % SWARM_COLORS.length],
      };
    }

    // External holder
    return {
      wallet: ownerAddress,
      label: this.truncateAddress(ownerAddress),
      tokens,
      percent: 0,
      role: 'external',
      color: EXTERNAL_COLORS[externalColorIdx % EXTERNAL_COLORS.length],
    };
  }

  // ─── Private: Math ────────────────────────────────────────

  /**
   * Convert a bigint token amount to a percentage of total supply.
   * Returns a number with 4 decimal places of precision.
   */
  private toPercent(amount: bigint, total: bigint): number {
    if (total === 0n) return 0;
    // Multiply by 1_000_000 for 4 decimal places of percentage precision
    const scaled = (amount * 1_000_000n) / total;
    return Number(scaled) / 10_000;
  }

  /**
   * Calculate Gini coefficient from an array of token balances.
   *
   * Gini = (2 * sum_i(i * x_i)) / (n * sum(x_i)) - (n + 1) / n
   * where x_i is sorted ascending and i is 1-indexed.
   *
   * @returns Gini coefficient in [0, 1]
   */
  private calculateGini(balances: bigint[]): number {
    const n = balances.length;
    if (n <= 1) return 0;

    // Sort ascending
    const sorted = [...balances].sort((a, b) => {
      if (a < b) return -1;
      if (a > b) return 1;
      return 0;
    });

    // Use Number for the Gini computation (sufficient precision for ratios)
    const numericSorted = sorted.map((b) => Number(b));
    const totalSum = numericSorted.reduce((acc, val) => acc + val, 0);
    if (totalSum === 0) return 0;

    let weightedSum = 0;
    for (let i = 0; i < n; i++) {
      weightedSum += (i + 1) * numericSorted[i];
    }

    const gini = (2 * weightedSum) / (n * totalSum) - (n + 1) / n;
    return Math.max(0, Math.min(1, gini));
  }

  /**
   * Calculate Herfindahl-Hirschman Index.
   *
   * HHI = sum((market_share_i * 100)^2) for each holder.
   * Range: 0 (perfect competition) to 10,000 (monopoly).
   */
  private calculateHHI(balances: bigint[], totalSupply: bigint): number {
    if (totalSupply === 0n || balances.length === 0) return 0;

    let hhi = 0;
    for (const balance of balances) {
      const sharePercent = this.toPercent(balance, totalSupply);
      hhi += sharePercent * sharePercent;
    }

    return Math.min(10_000, hhi);
  }

  /**
   * Sum of percent for the top N holders (already sorted descending).
   */
  private topNPercent(holders: SupplyHolder[], n: number): number {
    let sum = 0;
    const count = Math.min(n, holders.length);
    for (let i = 0; i < count; i++) {
      sum += holders[i].percent;
    }
    return sum;
  }

  /**
   * Truncate a Solana address to a human-readable label.
   * e.g., "7xKXtg2C...4zGkA" → "7xKX...zGkA"
   */
  private truncateAddress(address: string): string {
    if (address.length <= 8) return address;
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  }
}
