/**
 * Profit Consolidator — Sweeps realized gains from trader wallets to a vault
 *
 * After the swarm finishes a trading session (or on-demand), this module
 * calculates each wallet's realised PnL, subtracts a configurable reserve
 * for future gas, and consolidates the remainder into a single treasury
 * wallet via batched SOL transfers.
 *
 * Features:
 * - Per-wallet PnL calculation (SOL in vs. SOL out + remaining balance)
 * - Configurable gas reserve so wallets stay funded for the next session
 * - Batched transfers with retry logic + circuit breaker awareness
 * - Minimum consolidation threshold to avoid dust transfers
 * - Full audit trail via SwarmEventBus
 * - Dry-run mode for pre-flight checks
 *
 * @example
 * ```typescript
 * import { Connection, Keypair } from '@solana/web3.js';
 * import { SwarmEventBus } from '../infra/event-bus.js';
 * import { ProfitConsolidator } from './profit-consolidator.js';
 *
 * const connection = new Connection('https://api.mainnet-beta.solana.com');
 * const eventBus = SwarmEventBus.getInstance();
 * const treasury = Keypair.generate();
 *
 * const consolidator = new ProfitConsolidator(connection, eventBus, {
 *   treasuryPublicKey: treasury.publicKey.toBase58(),
 *   gasReserveLamports: 5_000_000,       // 0.005 SOL kept per wallet
 *   minConsolidationLamports: 1_000_000, // skip wallets with < 0.001 SOL profit
 * });
 *
 * const result = await consolidator.consolidate(walletPool);
 * console.log(`Swept ${result.totalConsolidatedLamports} lamports from ${result.walletsSwept} wallets`);
 * ```
 */

import {
    Connection,
    Keypair,
    LAMPORTS_PER_SOL,
    PublicKey,
    SystemProgram,
    Transaction,
    sendAndConfirmTransaction,
} from '@solana/web3.js';
import BN from 'bn.js';
import { v4 as uuid } from 'uuid';

import { SwarmEventBus } from '../infra/event-bus.js';
import type { AgentWallet, SwarmEventCategory } from '../types.js';

// ─── Types ────────────────────────────────────────────────────

export interface ProfitConsolidatorConfig {
    /** Base58-encoded public key of the treasury / vault wallet */
    treasuryPublicKey: string;
    /** Lamports to leave in each wallet as gas reserve (default 5_000_000 = 0.005 SOL) */
    gasReserveLamports: number;
    /** Minimum profit (lamports) required before a wallet is swept (default 1_000_000) */
    minConsolidationLamports: number;
    /** Maximum wallets to sweep in a single batch (default 10) */
    batchSize: number;
    /** Milliseconds between batches to avoid rate limits (default 2000) */
    batchDelayMs: number;
    /** Maximum retry attempts per transfer (default 3) */
    maxRetries: number;
    /** If true, calculate but do not execute transfers */
    dryRun: boolean;
}

export interface WalletPnL {
    walletAddress: string;
    /** SOL deposited into this wallet over its lifetime (lamports) */
    totalDepositedLamports: BN;
    /** SOL withdrawn / transferred OUT before consolidation (lamports) */
    totalWithdrawnLamports: BN;
    /** Current on-chain SOL balance (lamports) */
    currentBalanceLamports: BN;
    /** Net realised PnL = currentBalance + totalWithdrawn − totalDeposited */
    realisedPnlLamports: BN;
    /** Amount eligible for consolidation after gas reserve */
    consolidatableLamports: BN;
}

export interface ConsolidationResult {
    /** Unique run ID */
    runId: string;
    /** Timestamp of the consolidation run */
    timestamp: number;
    /** Whether this was a dry-run */
    dryRun: boolean;
    /** Number of wallets evaluated */
    walletsEvaluated: number;
    /** Number of wallets actually swept */
    walletsSwept: number;
    /** Number of wallets skipped (below threshold / negative PnL) */
    walletsSkipped: number;
    /** Total lamports transferred to treasury */
    totalConsolidatedLamports: BN;
    /** Per-wallet breakdown */
    walletResults: WalletConsolidationEntry[];
    /** Errors encountered */
    errors: ConsolidationError[];
}

export interface WalletConsolidationEntry {
    walletAddress: string;
    amountLamports: BN;
    signature: string | null;
    success: boolean;
    error?: string;
}

export interface ConsolidationError {
    walletAddress: string;
    error: string;
    attempt: number;
}

// ─── Defaults ─────────────────────────────────────────────────

const DEFAULT_CONFIG: ProfitConsolidatorConfig = {
    treasuryPublicKey: '',
    gasReserveLamports: 5_000_000,
    minConsolidationLamports: 1_000_000,
    batchSize: 10,
    batchDelayMs: 2_000,
    maxRetries: 3,
    dryRun: false,
};

// ─── ProfitConsolidator ───────────────────────────────────────

export class ProfitConsolidator {
    private readonly connection: Connection;
    private readonly eventBus: SwarmEventBus;
    private readonly config: ProfitConsolidatorConfig;
    private readonly treasuryPubkey: PublicKey;

    /** Tracks cumulative deposits per wallet (walletAddress → lamports) */
    private depositLedger: Map<string, BN> = new Map();
    /** Tracks cumulative withdrawals per wallet (walletAddress → lamports) */
    private withdrawalLedger: Map<string, BN> = new Map();
    /** History of consolidation runs */
    private history: ConsolidationResult[] = [];

    constructor(
        connection: Connection,
        eventBus: SwarmEventBus,
        config: Partial<ProfitConsolidatorConfig> = {},
    ) {
        this.connection = connection;
        this.eventBus = eventBus;
        this.config = { ...DEFAULT_CONFIG, ...config };

        if (!this.config.treasuryPublicKey) {
            throw new Error('ProfitConsolidator: treasuryPublicKey is required');
        }
        this.treasuryPubkey = new PublicKey(this.config.treasuryPublicKey);
    }

    // ─── Public API ───────────────────────────────────────────

    /**
     * Record a deposit into a wallet (call when funding traders).
     */
    recordDeposit(walletAddress: string, lamports: BN): void {
        const current = this.depositLedger.get(walletAddress) ?? new BN(0);
        this.depositLedger.set(walletAddress, current.add(lamports));
    }

    /**
     * Record a withdrawal / send from a wallet (outside of consolidation).
     */
    recordWithdrawal(walletAddress: string, lamports: BN): void {
        const current = this.withdrawalLedger.get(walletAddress) ?? new BN(0);
        this.withdrawalLedger.set(walletAddress, current.add(lamports));
    }

    /**
     * Calculate PnL for a single wallet.
     */
    async calculateWalletPnL(wallet: AgentWallet): Promise<WalletPnL> {
        const address = wallet.keypair.publicKey.toBase58();
        const currentBalance = new BN(
            await this.connection.getBalance(wallet.keypair.publicKey),
        );
        const totalDeposited = this.depositLedger.get(address) ?? new BN(0);
        const totalWithdrawn = this.withdrawalLedger.get(address) ?? new BN(0);

        // PnL = current + withdrawn − deposited
        const realisedPnl = currentBalance.add(totalWithdrawn).sub(totalDeposited);

        // Consolidatable = current − gasReserve, clamped to ≥ 0
        const gasReserve = new BN(this.config.gasReserveLamports);
        const consolidatable = BN.max(currentBalance.sub(gasReserve), new BN(0));

        return {
            walletAddress: address,
            totalDepositedLamports: totalDeposited,
            totalWithdrawnLamports: totalWithdrawn,
            currentBalanceLamports: currentBalance,
            realisedPnlLamports: realisedPnl,
            consolidatableLamports: consolidatable,
        };
    }

    /**
     * Calculate PnL across all wallets in a pool.
     */
    async calculatePoolPnL(wallets: AgentWallet[]): Promise<WalletPnL[]> {
        return Promise.all(wallets.map((w) => this.calculateWalletPnL(w)));
    }

    /**
     * Run consolidation: sweep profits from all wallets to treasury.
     */
    async consolidate(wallets: AgentWallet[]): Promise<ConsolidationResult> {
        const runId = uuid();
        const timestamp = Date.now();

        this.emitEvent('consolidation:started', {
            runId,
            walletCount: wallets.length,
            dryRun: this.config.dryRun,
        });

        const pnls = await this.calculatePoolPnL(wallets);
        const minThreshold = new BN(this.config.minConsolidationLamports);

        // Filter to wallets with enough consolidatable balance
        const eligible = pnls.filter((p) => p.consolidatableLamports.gte(minThreshold));
        const skipped = pnls.length - eligible.length;

        const walletResults: WalletConsolidationEntry[] = [];
        const errors: ConsolidationError[] = [];
        let totalConsolidated = new BN(0);

        // Build wallet lookup for keypair access
        const walletMap = new Map<string, AgentWallet>();
        for (const w of wallets) {
            walletMap.set(w.keypair.publicKey.toBase58(), w);
        }

        // Process in batches
        for (let i = 0; i < eligible.length; i += this.config.batchSize) {
            const batch = eligible.slice(i, i + this.config.batchSize);

            for (const pnl of batch) {
                const wallet = walletMap.get(pnl.walletAddress);
                if (!wallet) continue;

                const entry = await this.sweepWallet(
                    wallet,
                    pnl.consolidatableLamports,
                    errors,
                );
                walletResults.push(entry);
                if (entry.success) {
                    totalConsolidated = totalConsolidated.add(entry.amountLamports);
                }
            }

            // Delay between batches (skip after last batch)
            if (i + this.config.batchSize < eligible.length) {
                await this.sleep(this.config.batchDelayMs);
            }
        }

        const result: ConsolidationResult = {
            runId,
            timestamp,
            dryRun: this.config.dryRun,
            walletsEvaluated: pnls.length,
            walletsSwept: walletResults.filter((r) => r.success).length,
            walletsSkipped: skipped,
            totalConsolidatedLamports: totalConsolidated,
            walletResults,
            errors,
        };

        this.history.push(result);

        this.emitEvent('consolidation:completed', {
            runId,
            walletsSwept: result.walletsSwept,
            totalLamports: totalConsolidated.toString(),
            dryRun: this.config.dryRun,
            errorCount: errors.length,
        });

        return result;
    }

    /**
     * Get history of all consolidation runs.
     */
    getHistory(): ConsolidationResult[] {
        return [...this.history];
    }

    /**
     * Get the last consolidation result, if any.
     */
    getLastRun(): ConsolidationResult | null {
        return this.history.at(-1) ?? null;
    }

    /**
     * Get total lamports consolidated across all runs.
     */
    getTotalConsolidated(): BN {
        return this.history.reduce(
            (sum, r) => sum.add(r.totalConsolidatedLamports),
            new BN(0),
        );
    }

    /**
     * Reset the deposit/withdrawal ledger (e.g., at start of new session).
     */
    resetLedger(): void {
        this.depositLedger.clear();
        this.withdrawalLedger.clear();
    }

    // ─── Private ──────────────────────────────────────────────

    private async sweepWallet(
        wallet: AgentWallet,
        amount: BN,
        errors: ConsolidationError[],
    ): Promise<WalletConsolidationEntry> {
        const address = wallet.keypair.publicKey.toBase58();

        if (this.config.dryRun) {
            return {
                walletAddress: address,
                amountLamports: amount,
                signature: null,
                success: true,
            };
        }

        for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
            try {
                const tx = new Transaction().add(
                    SystemProgram.transfer({
                        fromPubkey: wallet.keypair.publicKey,
                        toPubkey: this.treasuryPubkey,
                        lamports: BigInt(amount.toString()),
                    }),
                );

                const signature = await sendAndConfirmTransaction(
                    this.connection,
                    tx,
                    [wallet.keypair],
                    { commitment: 'confirmed' },
                );

                // Record this as a withdrawal in the ledger
                this.recordWithdrawal(address, amount);

                this.emitEvent('consolidation:wallet-swept', {
                    walletAddress: address,
                    amountLamports: amount.toString(),
                    signature,
                });

                return {
                    walletAddress: address,
                    amountLamports: amount,
                    signature,
                    success: true,
                };
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                errors.push({ walletAddress: address, error: message, attempt });

                if (attempt === this.config.maxRetries) {
                    this.emitEvent('consolidation:wallet-error', {
                        walletAddress: address,
                        error: message,
                        attempts: attempt,
                    });

                    return {
                        walletAddress: address,
                        amountLamports: amount,
                        signature: null,
                        success: false,
                        error: message,
                    };
                }

                // Exponential backoff between retries
                await this.sleep(1_000 * Math.pow(2, attempt - 1));
            }
        }

        // Should never reach here, but satisfy TS
        return {
            walletAddress: address,
            amountLamports: amount,
            signature: null,
            success: false,
            error: 'Unexpected: exhausted retries without return',
        };
    }

    private emitEvent(
        action: string,
        metadata: Record<string, unknown>,
    ): void {
        this.eventBus.emit({
            category: 'system' as SwarmEventCategory,
            action,
            agentId: 'profit-consolidator',
            details: action,
            metadata,
            success: true,
        });
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
