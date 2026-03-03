/**
 * Solana Account Cleanup Service
 * Close vacant token accounts and recover rent-exempt SOL
 * 
 * Based on Sol-Incinerator approach:
 * - Identify token accounts with zero balance
 * - Close accounts to recover ~0.002 SOL rent per account
 * - Batch close operations for efficiency
 * - Support both Token and Token-2022 programs
 */

import {
  Connection,
  PublicKey,
  Transaction,
  type TransactionInstruction,
  VersionedTransaction,
  TransactionMessage,
  SystemProgram,
} from "@solana/web3.js";
import {
  createCloseAccountInstruction,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import type { VacantTokenAccount } from "../wallet/chains/solana.js";

// ============================================================
// Types
// ============================================================

export interface CloseAccountResult {
  success: boolean;
  accountsClosed: number;
  rentRecovered: bigint;
  signature?: string;
  error?: string;
}

export interface CloseAccountBatch {
  accounts: VacantTokenAccount[];
  instructions: TransactionInstruction[];
  estimatedRent: bigint;
}

export interface AccountCleanupQuote {
  vacantAccounts: VacantTokenAccount[];
  totalAccounts: number;
  totalRecoverableRent: bigint;
  totalRecoverableRentSol: number;
  totalRecoverableRentUsd: number;
  estimatedTransactions: number;
  estimatedGasLamports: bigint;
  netRecoverableLamports: bigint;
}

// ============================================================
// Constants
// ============================================================

// Maximum accounts to close per transaction (limited by tx size)
const MAX_ACCOUNTS_PER_TX = 20;

// Base transaction fee (5000 lamports)
const BASE_TX_FEE = 5000n;

// Priority fee per compute unit
const PRIORITY_FEE_PER_CU = 1000n;

// Compute units per close account instruction
const CU_PER_CLOSE = 10000n;

// ============================================================
// Account Cleanup Service
// ============================================================

export class AccountCleanupService {
  private readonly connection: Connection;

  constructor(rpcUrl?: string) {
    const url = rpcUrl || process.env.RPC_SOLANA || "https://api.mainnet-beta.solana.com";
    this.connection = new Connection(url, {
      commitment: "confirmed",
    });
  }

  /**
   * Get a quote for closing vacant accounts
   */
  async getCleanupQuote(
    vacantAccounts: VacantTokenAccount[],
    solPriceUsd: number
  ): Promise<AccountCleanupQuote> {
    const totalAccounts = vacantAccounts.length;
    const totalRecoverableRent = vacantAccounts.reduce(
      (sum, acc) => sum + acc.rentLamports,
      0n
    );

    // Calculate number of transactions needed
    const estimatedTransactions = Math.ceil(totalAccounts / MAX_ACCOUNTS_PER_TX);

    // Estimate gas costs
    const computeUnitsPerTx = BigInt(MAX_ACCOUNTS_PER_TX) * CU_PER_CLOSE;
    const priorityFeePerTx = computeUnitsPerTx * PRIORITY_FEE_PER_CU / 1_000_000n;
    const estimatedGasLamports = BigInt(estimatedTransactions) * (BASE_TX_FEE + priorityFeePerTx);

    // Calculate net recoverable
    const netRecoverableLamports = totalRecoverableRent - estimatedGasLamports;

    return {
      vacantAccounts,
      totalAccounts,
      totalRecoverableRent,
      totalRecoverableRentSol: Number(totalRecoverableRent) / 1e9,
      totalRecoverableRentUsd: (Number(totalRecoverableRent) / 1e9) * solPriceUsd,
      estimatedTransactions,
      estimatedGasLamports,
      netRecoverableLamports: netRecoverableLamports > 0n ? netRecoverableLamports : 0n,
    };
  }

  /**
   * Build close account instructions
   */
  buildCloseInstructions(
    vacantAccounts: VacantTokenAccount[],
    ownerPubkey: PublicKey
  ): TransactionInstruction[] {
    const instructions: TransactionInstruction[] = [];

    for (const account of vacantAccounts) {
      const programId = account.isToken2022
        ? TOKEN_2022_PROGRAM_ID
        : TOKEN_PROGRAM_ID;

      const closeIx = createCloseAccountInstruction(
        new PublicKey(account.address), // Account to close
        ownerPubkey, // Destination for rent
        ownerPubkey, // Owner (authority)
        [], // Multi-sig signers (none)
        programId
      );

      instructions.push(closeIx);
    }

    return instructions;
  }

  /**
   * Create batched transactions for closing accounts
   */
  async createBatchedTransactions(
    vacantAccounts: VacantTokenAccount[],
    ownerPubkey: PublicKey,
    priorityFeeMicroLamports?: number
  ): Promise<CloseAccountBatch[]> {
    const batches: CloseAccountBatch[] = [];

    // Split accounts into batches
    for (let i = 0; i < vacantAccounts.length; i += MAX_ACCOUNTS_PER_TX) {
      const batchAccounts = vacantAccounts.slice(i, i + MAX_ACCOUNTS_PER_TX);
      const instructions = this.buildCloseInstructions(batchAccounts, ownerPubkey);
      const estimatedRent = batchAccounts.reduce(
        (sum, acc) => sum + acc.rentLamports,
        0n
      );

      batches.push({
        accounts: batchAccounts,
        instructions,
        estimatedRent,
      });
    }

    return batches;
  }

  /**
   * Build a versioned transaction for a batch of close operations
   */
  async buildVersionedTransaction(
    batch: CloseAccountBatch,
    payerPubkey: PublicKey,
    priorityFeeMicroLamports: number = 1000
  ): Promise<VersionedTransaction> {
    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash("confirmed");

    // Calculate compute units
    const totalComputeUnits = batch.accounts.length * 10000;

    // Create compute budget instructions
    const computeBudgetIx = this.createComputeBudgetInstructions(
      totalComputeUnits,
      priorityFeeMicroLamports
    );

    // Combine all instructions
    const allInstructions = [...computeBudgetIx, ...batch.instructions];

    // Create versioned transaction message
    const messageV0 = new TransactionMessage({
      payerKey: payerPubkey,
      recentBlockhash: blockhash,
      instructions: allInstructions,
    }).compileToV0Message();

    return new VersionedTransaction(messageV0);
  }

  /**
   * Build legacy transaction for a batch (for wallets that don't support versioned)
   */
  buildLegacyTransaction(
    batch: CloseAccountBatch,
    payerPubkey: PublicKey,
    recentBlockhash: string,
    priorityFeeMicroLamports: number = 1000
  ): Transaction {
    const transaction = new Transaction();
    transaction.recentBlockhash = recentBlockhash;
    transaction.feePayer = payerPubkey;

    // Add compute budget
    const computeBudgetIx = this.createComputeBudgetInstructions(
      batch.accounts.length * 10000,
      priorityFeeMicroLamports
    );

    for (const ix of computeBudgetIx) {
      transaction.add(ix);
    }

    // Add close instructions
    for (const ix of batch.instructions) {
      transaction.add(ix);
    }

    return transaction;
  }

  /**
   * Create compute budget instructions
   */
  private createComputeBudgetInstructions(
    computeUnits: number,
    microLamports: number
  ): TransactionInstruction[] {
    const { ComputeBudgetProgram } = require("@solana/web3.js");

    return [
      ComputeBudgetProgram.setComputeUnitLimit({
        units: computeUnits,
      }),
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports,
      }),
    ];
  }

  /**
   * Simulate a close transaction
   */
  async simulateTransaction(
    transaction: VersionedTransaction | Transaction
  ): Promise<{ success: boolean; error?: string; logs?: string[] }> {
    try {
      let result;
      if (transaction instanceof VersionedTransaction) {
        result = await this.connection.simulateTransaction(transaction, {
          commitment: "confirmed",
        });
      } else {
        result = await this.connection.simulateTransaction(transaction);
      }

      if (result.value.err) {
        return {
          success: false,
          error: JSON.stringify(result.value.err),
          logs: result.value.logs ?? undefined,
        };
      }

      return {
        success: true,
        logs: result.value.logs ?? undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Simulation failed",
      };
    }
  }

  /**
   * Execute a close transaction (requires signed transaction)
   */
  async executeTransaction(
    signedTransaction: VersionedTransaction | Transaction
  ): Promise<CloseAccountResult> {
    try {
      let signature: string;

      if (signedTransaction instanceof VersionedTransaction) {
        signature = await this.connection.sendTransaction(signedTransaction, {
          skipPreflight: false,
          preflightCommitment: "confirmed",
          maxRetries: 3,
        });
      } else {
        signature = await this.connection.sendRawTransaction(
          signedTransaction.serialize(),
          {
            skipPreflight: false,
            preflightCommitment: "confirmed",
            maxRetries: 3,
          }
        );
      }

      // Confirm transaction
      const confirmation = await this.connection.confirmTransaction(
        signature,
        "confirmed"
      );

      if (confirmation.value.err) {
        return {
          success: false,
          accountsClosed: 0,
          rentRecovered: 0n,
          signature,
          error: JSON.stringify(confirmation.value.err),
        };
      }

      // Get transaction details to verify
      const txDetails = await this.connection.getTransaction(signature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });

      // Count successful closes by looking at post balances
      const accountsClosed = txDetails?.meta?.postBalances
        ? txDetails.meta.postBalances.filter((b) => b === 0).length
        : 0;

      // Calculate rent recovered from balance changes
      const rentRecovered = txDetails?.meta
        ? BigInt(
            (txDetails.meta.postBalances[0] || 0) -
              (txDetails.meta.preBalances[0] || 0)
          )
        : 0n;

      return {
        success: true,
        accountsClosed,
        rentRecovered: rentRecovered > 0n ? rentRecovered : 0n,
        signature,
      };
    } catch (error) {
      return {
        success: false,
        accountsClosed: 0,
        rentRecovered: 0n,
        error: error instanceof Error ? error.message : "Transaction failed",
      };
    }
  }

  /**
   * Get serialized transaction for frontend signing
   */
  async getSerializedTransaction(
    vacantAccounts: VacantTokenAccount[],
    ownerAddress: string,
    priorityFeeMicroLamports: number = 1000,
    useLegacy: boolean = false
  ): Promise<{
    batches: Array<{
      serializedTransaction: string;
      accountsToClose: string[];
      estimatedRent: string;
    }>;
    totalTransactions: number;
    totalRent: string;
  }> {
    const ownerPubkey = new PublicKey(ownerAddress);
    const batches = await this.createBatchedTransactions(
      vacantAccounts,
      ownerPubkey,
      priorityFeeMicroLamports
    );

    const serializedBatches = await Promise.all(
      batches.map(async (batch) => {
        let serializedTransaction: string;

        if (useLegacy) {
          const { blockhash } = await this.connection.getLatestBlockhash("confirmed");
          const tx = this.buildLegacyTransaction(
            batch,
            ownerPubkey,
            blockhash,
            priorityFeeMicroLamports
          );
          serializedTransaction = tx.serialize({ verifySignatures: false }).toString("base64");
        } else {
          const tx = await this.buildVersionedTransaction(
            batch,
            ownerPubkey,
            priorityFeeMicroLamports
          );
          serializedTransaction = Buffer.from(tx.serialize()).toString("base64");
        }

        return {
          serializedTransaction,
          accountsToClose: batch.accounts.map((a) => a.address),
          estimatedRent: batch.estimatedRent.toString(),
        };
      })
    );

    const totalRent = batches.reduce(
      (sum, b) => sum + b.estimatedRent,
      0n
    );

    return {
      batches: serializedBatches,
      totalTransactions: batches.length,
      totalRent: totalRent.toString(),
    };
  }
}

// ============================================================
// Factory and Singleton
// ============================================================

export function createAccountCleanupService(rpcUrl?: string): AccountCleanupService {
  return new AccountCleanupService(rpcUrl);
}

export const accountCleanupService = new AccountCleanupService();
export default accountCleanupService;
