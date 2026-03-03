/**
 * Solana Versioned Transaction Builder
 * Build optimized versioned transactions with:
 * - Address Lookup Tables (ALT)
 * - Compute budget optimization
 * - Priority fees
 * - Transaction batching
 */

import { Connection,
  PublicKey,
  VersionedTransaction,
  TransactionMessage,
  type TransactionInstruction,
  type AddressLookupTableAccount,
  ComputeBudgetProgram,
  Keypair,
  type Signer,
} from "@solana/web3.js";
import { PriorityFeesService, type PriorityLevel } from "../../solana/priority-fees.js";

// ============================================================
// Types
// ============================================================

export interface TransactionBuildOptions {
  /** Instructions to include */
  instructions: TransactionInstruction[];
  /** Payer public key */
  payer: PublicKey;
  /** Address lookup table addresses to use */
  lookupTableAddresses?: string[];
  /** Priority fee level */
  priorityLevel?: PriorityLevel;
  /** Custom compute unit price (overrides priorityLevel) */
  computeUnitPriceMicroLamports?: number;
  /** Custom compute unit limit (auto-estimated if not provided) */
  computeUnitLimit?: number;
  /** Use legacy transaction format */
  useLegacy?: boolean;
  /** Recent blockhash (fetched if not provided) */
  recentBlockhash?: string;
  /** Last valid block height */
  lastValidBlockHeight?: number;
}

export interface BuiltTransaction {
  transaction: VersionedTransaction;
  blockhash: string;
  lastValidBlockHeight: number;
  computeUnits: number;
  priorityFeeMicroLamports: number;
  estimatedFee: {
    priorityFeeLamports: number;
    baseFee: number;
    totalFee: number;
  };
  lookupTables: AddressLookupTableAccount[];
}

export interface SimulationResult {
  success: boolean;
  unitsConsumed?: number;
  error?: string;
  logs?: string[];
  returnData?: {
    programId: string;
    data: string;
  };
}

// ============================================================
// Constants
// ============================================================

// Common lookup tables for Jupiter swaps
export const JUPITER_LOOKUP_TABLES = [
  "AzJ3dJpESWUVN4CQBJ8cq2dJ6pMHwS7rKKjZ8hHhAVs6",
  "8Hx3fRaAsGpQF4e7Qy5gNzPvgXeAsGGJJyLq9LQwX2Yk",
];

// Default compute unit limit when auto-estimation fails
const DEFAULT_COMPUTE_UNITS = 200_000;

// Maximum compute units per transaction
const MAX_COMPUTE_UNITS = 1_400_000;

// Base transaction fee (lamports)
const BASE_FEE_LAMPORTS = 5000;

// ============================================================
// Versioned Transaction Builder
// ============================================================

export class VersionedTransactionBuilder {
  private readonly connection: Connection;
  private readonly priorityFeesService: PriorityFeesService;
  
  // Cache for lookup tables
  private lookupTableCache: Map<string, AddressLookupTableAccount> = new Map();

  constructor(rpcUrl?: string) {
    const url = rpcUrl || process.env.RPC_SOLANA || "https://api.mainnet-beta.solana.com";
    this.connection = new Connection(url, { commitment: "confirmed" });
    this.priorityFeesService = new PriorityFeesService({ rpcUrl: url });
  }

  /**
   * Build an optimized versioned transaction
   */
  async buildTransaction(options: TransactionBuildOptions): Promise<BuiltTransaction> {
    const {
      instructions,
      payer,
      lookupTableAddresses = [],
      priorityLevel = "medium",
      computeUnitPriceMicroLamports,
      useLegacy = false,
    } = options;

    // Get recent blockhash if not provided
    let { recentBlockhash, lastValidBlockHeight } = options;
    if (!recentBlockhash) {
      const blockhashInfo = await this.connection.getLatestBlockhash("confirmed");
      recentBlockhash = blockhashInfo.blockhash;
      lastValidBlockHeight = blockhashInfo.lastValidBlockHeight;
    }

    // Get lookup tables
    const lookupTables = await this.getLookupTables(lookupTableAddresses);

    // Determine compute unit price
    let priorityFeeMicroLamports = computeUnitPriceMicroLamports;
    if (priorityFeeMicroLamports === undefined) {
      priorityFeeMicroLamports = await this.priorityFeesService.getRecommendedFee(
        priorityLevel,
        this.extractAccountKeys(instructions)
      );
    }

    // Estimate compute units if not provided
    let computeUnits = options.computeUnitLimit;
    if (!computeUnits) {
      computeUnits = await this.estimateComputeUnits(
        instructions,
        payer,
        lookupTables,
        recentBlockhash
      );
    }

    // Build compute budget instructions
    const computeBudgetInstructions = this.buildComputeBudgetInstructions(
      computeUnits,
      priorityFeeMicroLamports
    );

    // Combine all instructions
    const allInstructions = [...computeBudgetInstructions, ...instructions];

    // Build transaction message
    const messageV0 = new TransactionMessage({
      payerKey: payer,
      recentBlockhash,
      instructions: allInstructions,
    }).compileToV0Message(lookupTables.length > 0 ? lookupTables : undefined);

    const transaction = new VersionedTransaction(messageV0);

    // Calculate estimated fee
    const estimatedFee = this.priorityFeesService.estimateTotalFee(
      computeUnits,
      priorityFeeMicroLamports
    );

    return {
      transaction,
      blockhash: recentBlockhash,
      lastValidBlockHeight: lastValidBlockHeight!,
      computeUnits,
      priorityFeeMicroLamports,
      estimatedFee,
      lookupTables,
    };
  }

  /**
   * Build compute budget instructions
   */
  buildComputeBudgetInstructions(
    computeUnits: number,
    microLamports: number
  ): TransactionInstruction[] {
    const instructions: TransactionInstruction[] = [];

    // Set compute unit limit
    instructions.push(
      ComputeBudgetProgram.setComputeUnitLimit({
        units: Math.min(computeUnits, MAX_COMPUTE_UNITS),
      })
    );

    // Set compute unit price (priority fee)
    if (microLamports > 0) {
      instructions.push(
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports,
        })
      );
    }

    return instructions;
  }

  /**
   * Estimate compute units for a transaction
   */
  async estimateComputeUnits(
    instructions: TransactionInstruction[],
    payer: PublicKey,
    lookupTables: AddressLookupTableAccount[],
    recentBlockhash: string
  ): Promise<number> {
    try {
      // Add placeholder compute budget to simulate
      const simulationInstructions = [
        ComputeBudgetProgram.setComputeUnitLimit({ units: MAX_COMPUTE_UNITS }),
        ...instructions,
      ];

      const messageV0 = new TransactionMessage({
        payerKey: payer,
        recentBlockhash,
        instructions: simulationInstructions,
      }).compileToV0Message(lookupTables.length > 0 ? lookupTables : undefined);

      const transaction = new VersionedTransaction(messageV0);

      const simulation = await this.connection.simulateTransaction(transaction, {
        commitment: "confirmed",
        replaceRecentBlockhash: true,
      });

      if (simulation.value.err) {
        console.warn("Simulation failed, using default compute units:", simulation.value.err);
        return DEFAULT_COMPUTE_UNITS;
      }

      // Add 20% buffer to consumed units
      const consumed = simulation.value.unitsConsumed || DEFAULT_COMPUTE_UNITS;
      return Math.min(Math.ceil(consumed * 1.2), MAX_COMPUTE_UNITS);
    } catch (error) {
      console.warn("Compute unit estimation failed:", error);
      return DEFAULT_COMPUTE_UNITS;
    }
  }

  /**
   * Simulate a transaction
   */
  async simulateTransaction(
    transaction: VersionedTransaction
  ): Promise<SimulationResult> {
    try {
      const result = await this.connection.simulateTransaction(transaction, {
        commitment: "confirmed",
        replaceRecentBlockhash: true,
      });

      if (result.value.err) {
        return {
          success: false,
          unitsConsumed: result.value.unitsConsumed ?? undefined,
          error: JSON.stringify(result.value.err),
          logs: result.value.logs ?? undefined,
        };
      }

      return {
        success: true,
        unitsConsumed: result.value.unitsConsumed ?? undefined,
        logs: result.value.logs ?? undefined,
        returnData: result.value.returnData
          ? {
              programId: result.value.returnData.programId,
              data: result.value.returnData.data[0],
            }
          : undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Simulation failed",
      };
    }
  }

  /**
   * Sign a versioned transaction
   */
  signTransaction(
    transaction: VersionedTransaction,
    signers: Signer[]
  ): VersionedTransaction {
    transaction.sign(signers);
    return transaction;
  }

  /**
   * Send a signed transaction
   */
  async sendTransaction(
    signedTransaction: VersionedTransaction,
    options?: {
      skipPreflight?: boolean;
      maxRetries?: number;
    }
  ): Promise<string> {
    return this.connection.sendTransaction(signedTransaction, {
      skipPreflight: options?.skipPreflight ?? false,
      preflightCommitment: "confirmed",
      maxRetries: options?.maxRetries ?? 3,
    });
  }

  /**
   * Send and confirm a transaction
   */
  async sendAndConfirmTransaction(
    signedTransaction: VersionedTransaction,
    lastValidBlockHeight: number,
    options?: {
      skipPreflight?: boolean;
      maxRetries?: number;
    }
  ): Promise<{
    success: boolean;
    signature?: string;
    error?: string;
  }> {
    try {
      const signature = await this.sendTransaction(signedTransaction, options);

      // Wait for confirmation
      const confirmation = await this.connection.confirmTransaction(
        {
          signature,
          blockhash: signedTransaction.message.recentBlockhash,
          lastValidBlockHeight,
        },
        "confirmed"
      );

      if (confirmation.value.err) {
        return {
          success: false,
          signature,
          error: JSON.stringify(confirmation.value.err),
        };
      }

      return {
        success: true,
        signature,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Transaction failed",
      };
    }
  }

  /**
   * Fetch address lookup tables
   */
  async getLookupTables(addresses: string[]): Promise<AddressLookupTableAccount[]> {
    const tables: AddressLookupTableAccount[] = [];

    for (const address of addresses) {
      // Check cache first
      if (this.lookupTableCache.has(address)) {
        tables.push(this.lookupTableCache.get(address)!);
        continue;
      }

      try {
        const pubkey = new PublicKey(address);
        const account = await this.connection.getAddressLookupTable(pubkey);

        if (account.value) {
          this.lookupTableCache.set(address, account.value);
          tables.push(account.value);
        }
      } catch (error) {
        console.warn(`Failed to fetch lookup table ${address}:`, error);
      }
    }

    return tables;
  }

  /**
   * Extract account keys from instructions for priority fee estimation
   */
  private extractAccountKeys(instructions: TransactionInstruction[]): string[] {
    const keys = new Set<string>();

    for (const instruction of instructions) {
      keys.add(instruction.programId.toBase58());
      for (const account of instruction.keys) {
        if (account.isWritable) {
          keys.add(account.pubkey.toBase58());
        }
      }
    }

    return Array.from(keys);
  }

  /**
   * Serialize transaction for client-side signing
   */
  serializeForSigning(transaction: VersionedTransaction): string {
    return Buffer.from(transaction.serialize()).toString("base64");
  }

  /**
   * Deserialize a signed transaction from client
   */
  deserializeSignedTransaction(serialized: string): VersionedTransaction {
    const buffer = Buffer.from(serialized, "base64");
    return VersionedTransaction.deserialize(buffer);
  }

  /**
   * Get the connection instance
   */
  getConnection(): Connection {
    return this.connection;
  }
}

// ============================================================
// Factory and Singleton
// ============================================================

export function createVersionedTransactionBuilder(rpcUrl?: string): VersionedTransactionBuilder {
  return new VersionedTransactionBuilder(rpcUrl);
}

export const versionedTxBuilder = new VersionedTransactionBuilder();
export default versionedTxBuilder;
