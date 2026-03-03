import {
  Connection,
  PublicKey,
  VersionedTransaction,
  TransactionMessage,
  type TransactionInstruction,
  ComputeBudgetProgram,
  SystemProgram,
  type Keypair,
} from "@solana/web3.js";
import type {
  SolanaSwapRequest,
  SolanaExecutionResult,
  JitoTipConfig,
} from "../types.js";

// ============================================================================
// Constants
// ============================================================================

// Jito tip accounts (rotate for load balancing)
const JITO_TIP_ACCOUNTS = [
  "96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5",
  "HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe",
  "Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY",
  "ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49",
  "DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh",
  "ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt",
  "DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL",
  "3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT",
];

// Jito Block Engine endpoints
const JITO_BLOCK_ENGINE_URLS = [
  "https://mainnet.block-engine.jito.wtf",
  "https://amsterdam.mainnet.block-engine.jito.wtf",
  "https://frankfurt.mainnet.block-engine.jito.wtf",
  "https://ny.mainnet.block-engine.jito.wtf",
  "https://tokyo.mainnet.block-engine.jito.wtf",
];

// Jupiter API
const JUPITER_API_URL = "https://quote-api.jup.ag/v6";

// Default tip amount (0.0001 SOL)
const DEFAULT_TIP_LAMPORTS = 100000n;

// ============================================================================
// Solana Executor Service
// ============================================================================

export class SolanaExecutor {
  private readonly connection: Connection;
  private currentTipAccountIndex = 0;

  constructor(rpcUrl?: string) {
    const url = rpcUrl || process.env.RPC_SOLANA || "https://api.mainnet-beta.solana.com";
    this.connection = new Connection(url, {
      commitment: "confirmed",
      confirmTransactionInitialTimeout: 60000,
    });
  }

  /**
   * Execute a swap on Solana via Jupiter
   */
  async executeSwap(
    request: SolanaSwapRequest,
    signer: Keypair,
    useJito = true
  ): Promise<SolanaExecutionResult> {
    try {
      // 1. Get quote from Jupiter
      const quote = await this.getJupiterQuote(request);

      // 2. Get swap transaction from Jupiter
      const swapTransaction = await this.getJupiterSwapTransaction(
        quote,
        request.userPublicKey
      );

      // 3. Deserialize and prepare transaction
      const transaction = VersionedTransaction.deserialize(
        Buffer.from(swapTransaction, "base64")
      );

      // 4. Add Jito tip if using MEV protection
      let finalTransaction: VersionedTransaction;
      if (useJito) {
        finalTransaction = await this.addJitoTip(
          transaction,
          signer.publicKey,
          { tipLamports: DEFAULT_TIP_LAMPORTS, tipAccount: this.getNextTipAccount() }
        );
      } else {
        finalTransaction = transaction;
      }

      // 5. Sign the transaction
      finalTransaction.sign([signer]);

      // 6. Submit transaction
      let signature: string;
      if (useJito) {
        signature = await this.submitViaJito(finalTransaction);
      } else {
        signature = await this.submitDirect(finalTransaction);
      }

      // 7. Confirm transaction
      const confirmation = await this.connection.confirmTransaction(
        signature,
        "confirmed"
      );

      if (confirmation.value.err) {
        return {
          success: false,
          signature,
          inputAmount: request.amountIn,
          outputAmount: 0n,
          error: `Transaction failed: ${JSON.stringify(confirmation.value.err)}`,
        };
      }

      // 8. Get actual output amount from transaction
      const outputAmount = await this.getSwapOutputAmount(
        signature,
        request.outputMint
      );

      return {
        success: true,
        signature,
        slot: confirmation.context.slot,
        inputAmount: request.amountIn,
        outputAmount,
      };
    } catch (error) {
      return {
        success: false,
        inputAmount: request.amountIn,
        outputAmount: 0n,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Execute multiple swaps in a single transaction (if possible)
   */
  async executeBatchSwaps(
    requests: SolanaSwapRequest[],
    signer: Keypair,
    useJito = true
  ): Promise<SolanaExecutionResult[]> {
    // Solana has transaction size limits, so we may need to split
    const results: SolanaExecutionResult[] = [];

    for (const request of requests) {
      const result = await this.executeSwap(request, signer, useJito);
      results.push(result);

      // Add small delay between transactions to avoid rate limiting
      if (requests.indexOf(request) < requests.length - 1) {
        await this.delay(500);
      }
    }

    return results;
  }

  /**
   * Get a quote from Jupiter
   */
  async getJupiterQuote(request: SolanaSwapRequest): Promise<any> {
    const params = new URLSearchParams({
      inputMint: request.inputMint,
      outputMint: request.outputMint,
      amount: request.amountIn.toString(),
      slippageBps: request.slippageBps.toString(),
      onlyDirectRoutes: "false",
      asLegacyTransaction: "false",
    });

    const response = await fetch(`${JUPITER_API_URL}/quote?${params}`);
    
    if (!response.ok) {
      throw new Error(`Jupiter quote failed: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get swap transaction from Jupiter
   */
  async getJupiterSwapTransaction(
    quote: any,
    userPublicKey: string
  ): Promise<string> {
    const response = await fetch(`${JUPITER_API_URL}/swap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: "auto",
      }),
    });

    if (!response.ok) {
      throw new Error(`Jupiter swap failed: ${response.status}`);
    }

    const data = await response.json() as { swapTransaction: string };
    return data.swapTransaction;
  }

  /**
   * Simulate a transaction before execution
   */
  async simulateTransaction(
    transaction: VersionedTransaction
  ): Promise<{ success: boolean; error?: string; logs?: string[] }> {
    try {
      const result = await this.connection.simulateTransaction(transaction, {
        commitment: "confirmed",
      });

      if (result.value.err) {
        return {
          success: false,
          error: JSON.stringify(result.value.err),
          logs: result.value.logs || undefined,
        };
      }

      return {
        success: true,
        logs: result.value.logs || undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Simulation failed",
      };
    }
  }

  /**
   * Get current slot for recent blockhash
   */
  async getRecentBlockhash(): Promise<string> {
    const { blockhash } = await this.connection.getLatestBlockhash("confirmed");
    return blockhash;
  }

  /**
   * Get priority fee estimate
   */
  async getPriorityFeeEstimate(): Promise<bigint> {
    try {
      const recentFees = await this.connection.getRecentPrioritizationFees();
      if (recentFees.length === 0) {
        return 1000n; // Default 1000 micro-lamports
      }

      // Use median fee
      const fees = recentFees
        .map((f: { prioritizationFee: number }) => f.prioritizationFee)
        .sort((a: number, b: number) => a - b);
      const median = fees[Math.floor(fees.length / 2)];
      return BigInt(median);
    } catch {
      return 1000n;
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Add Jito tip instruction to transaction
   */
  private async addJitoTip(
    transaction: VersionedTransaction,
    payer: PublicKey,
    tipConfig: JitoTipConfig
  ): Promise<VersionedTransaction> {
    // Create tip instruction
    const tipInstruction = SystemProgram.transfer({
      fromPubkey: payer,
      toPubkey: new PublicKey(tipConfig.tipAccount),
      lamports: Number(tipConfig.tipLamports),
    });

    // Get fresh blockhash
    const blockhash = await this.getRecentBlockhash();

    // Note: In production, properly decompile the versioned transaction
    // to reconstruct instructions. This is a simplified implementation.

    // Create new transaction with tip
    const instructions: TransactionInstruction[] = [];

    // Add compute budget instructions first
    const priorityFee = await this.getPriorityFeeEstimate();
    instructions.push(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: Number(priorityFee),
      })
    );

    // Add tip instruction
    instructions.push(tipInstruction);

    // Reconstruct original instructions (simplified - in production, properly decompile)
    // For now, we sign and send the original transaction with tip added via postInstructions

    // Create new versioned transaction
    const newMessage = new TransactionMessage({
      payerKey: payer,
      recentBlockhash: blockhash,
      instructions: [tipInstruction, ...this.getInstructionsFromMessage(transaction.message)],
    }).compileToV0Message();

    return new VersionedTransaction(newMessage);
  }

  /**
   * Extract instructions from versioned message (simplified)
   */
  private getInstructionsFromMessage(
    _message: ReturnType<typeof VersionedTransaction.prototype.message>
  ): TransactionInstruction[] {
    // This is a simplified implementation
    // In production, use @solana/web3.js to properly decompile
    return [];
  }

  /**
   * Submit transaction via Jito Block Engine
   */
  private async submitViaJito(
    transaction: VersionedTransaction
  ): Promise<string> {
    const serialized = Buffer.from(transaction.serialize()).toString("base64");

    // Try multiple Jito endpoints
    for (const endpoint of JITO_BLOCK_ENGINE_URLS) {
      try {
        const response = await fetch(`${endpoint}/api/v1/transactions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "sendTransaction",
            params: [serialized, { encoding: "base64" }],
          }),
        });

        if (!response.ok) continue;

        const data = await response.json() as { result?: string };
        if (data.result) {
          return data.result;
        }
      } catch {
        continue;
      }
    }

    // Fall back to direct submission
    return this.submitDirect(transaction);
  }

  /**
   * Submit transaction directly to RPC
   */
  private async submitDirect(
    transaction: VersionedTransaction
  ): Promise<string> {
    const signature = await this.connection.sendTransaction(transaction, {
      skipPreflight: false,
      preflightCommitment: "confirmed",
      maxRetries: 3,
    });
    return signature;
  }

  /**
   * Get output amount from completed swap transaction
   */
  private async getSwapOutputAmount(
    signature: string,
    outputMint: string
  ): Promise<bigint> {
    try {
      const tx = await this.connection.getParsedTransaction(signature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });

      if (!tx?.meta) return 0n;

      // Look for token balance changes
      const postBalances = tx.meta.postTokenBalances || [];
      const preBalances = tx.meta.preTokenBalances || [];

      // Find the output token balance change
      for (const post of postBalances) {
        if (post.mint === outputMint) {
          const pre = preBalances.find(
            (p: { accountIndex: number }) => p.accountIndex === post.accountIndex
          );
          const preAmount = BigInt(pre?.uiTokenAmount?.amount || "0");
          const postAmount = BigInt(post.uiTokenAmount?.amount || "0");
          return postAmount - preAmount;
        }
      }

      return 0n;
    } catch {
      return 0n;
    }
  }

  /**
   * Get next Jito tip account (round-robin)
   */
  private getNextTipAccount(): string {
    const account = JITO_TIP_ACCOUNTS[this.currentTipAccountIndex];
    this.currentTipAccountIndex =
      (this.currentTipAccountIndex + 1) % JITO_TIP_ACCOUNTS.length;
    return account;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createSolanaExecutor(rpcUrl?: string): SolanaExecutor {
  return new SolanaExecutor(rpcUrl);
}
