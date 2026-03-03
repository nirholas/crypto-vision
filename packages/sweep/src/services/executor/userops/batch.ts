import {
  type Address,
  type PublicClient,
} from "viem";
import type {
  UserOperation,
  SwapCall,
  SignedPermitBatch,
} from "../types.js";
import { type UserOpBuilder } from "./builder.js";
import { type Permit2Service } from "../permit2.js";

// ============================================================================
// Constants
// ============================================================================

// Maximum number of swaps per UserOp (gas limit constraint)
const MAX_SWAPS_PER_USEROP = 10;

// Maximum calldata size (to avoid gas issues)
const MAX_CALLDATA_SIZE = 100000; // ~100KB

// ============================================================================
// Batch Builder
// ============================================================================

export class BatchSwapBuilder {
  constructor(
    private readonly _publicClient: PublicClient,
    private readonly _chainId: number,
    private readonly userOpBuilder: UserOpBuilder,
    private readonly permit2Service: Permit2Service
  ) {}

  /**
   * Build optimized batch UserOperations for multiple swaps
   * Automatically splits into multiple UserOps if needed
   */
  async buildBatchUserOps(params: {
    owner: Address;
    swaps: SwapCall[];
    gasToken: Address;
    recipient: Address;
    permitSignatures?: SignedPermitBatch;
  }): Promise<UserOperation[]> {
    // Validate input
    if (params.swaps.length === 0) {
      throw new Error("No swaps provided");
    }

    // Optimize swap order for better gas efficiency
    const optimizedSwaps = this.optimizeSwapOrder(params.swaps);

    // Split swaps into batches if necessary
    const batches = this.splitIntoBatches(optimizedSwaps);

    // Build UserOps for each batch
    const userOps: UserOperation[] = [];

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      
      // Split permit signatures for this batch if provided
      const batchPermits = params.permitSignatures
        ? this.splitPermitForBatch(params.permitSignatures, batch, params.swaps)
        : undefined;

      const userOp = await this.userOpBuilder.buildBatchSwapUserOp({
        owner: params.owner,
        swaps: batch,
        gasToken: params.gasToken,
        recipient: params.recipient,
        permitSignatures: batchPermits,
      });

      userOps.push(userOp);
    }

    return userOps;
  }

  /**
   * Create a batch permit for all swaps
   */
  createBatchPermit(
    swaps: SwapCall[],
    spender: Address,
    deadline?: number
  ): { permit: any; typedData: any } {
    const tokens = swaps.map((swap) => ({
      token: swap.tokenIn,
      amount: swap.amountIn,
    }));

    // Deduplicate tokens (combine amounts for same token)
    const deduped = this.deduplicateTokens(tokens);

    const permit = this.permit2Service.createBatchPermit(
      deduped,
      spender,
      deadline
    );

    const typedData = this.permit2Service.getBatchPermitTypedData(permit);

    return { permit, typedData };
  }

  /**
   * Estimate total gas for a batch of swaps
   */
  async estimateBatchGas(swaps: SwapCall[]): Promise<{
    totalGas: bigint;
    perSwapGas: bigint[];
    batchCount: number;
  }> {
    const batches = this.splitIntoBatches(swaps);
    
    // Base gas per UserOp
    const baseGasPerOp = 50000n;
    
    // Estimate gas per swap (varies by DEX and path)
    const perSwapGas = swaps.map((swap) => {
      // Base estimate + calldata cost
      const calldataGas = BigInt(swap.callData.length) * 16n;
      return 100000n + calldataGas;
    });

    const totalGas =
      BigInt(batches.length) * baseGasPerOp +
      perSwapGas.reduce((a, b) => a + b, 0n);

    return {
      totalGas,
      perSwapGas,
      batchCount: batches.length,
    };
  }

  /**
   * Validate a batch of swaps
   */
  validateBatch(swaps: SwapCall[]): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for empty swaps
    if (swaps.length === 0) {
      errors.push("No swaps provided");
      return { valid: false, errors, warnings };
    }

    // Check individual swaps
    for (let i = 0; i < swaps.length; i++) {
      const swap = swaps[i];

      if (swap.amountIn === 0n) {
        errors.push(`Swap ${i}: Zero amount`);
      }

      if (swap.minAmountOut === 0n) {
        warnings.push(`Swap ${i}: Zero minAmountOut (vulnerable to slippage)`);
      }

      if (swap.tokenIn === swap.tokenOut) {
        errors.push(`Swap ${i}: Same input and output token`);
      }

      if (swap.callData.length < 10) {
        errors.push(`Swap ${i}: Invalid calldata`);
      }
    }

    // Check batch size
    if (swaps.length > MAX_SWAPS_PER_USEROP * 5) {
      warnings.push(
        `Large batch (${swaps.length} swaps) will be split into multiple transactions`
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Optimize swap order for gas efficiency
   * Groups swaps by input/output token to reduce state changes
   */
  private optimizeSwapOrder(swaps: SwapCall[]): SwapCall[] {
    // Group swaps by output token
    const groups = new Map<string, SwapCall[]>();
    
    for (const swap of swaps) {
      const key = swap.tokenOut.toLowerCase();
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(swap);
    }

    // Flatten groups, keeping same-output swaps together
    const optimized: SwapCall[] = [];
    for (const group of groups.values()) {
      // Sort by amount within group (larger first for better routing)
      group.sort((a, b) => (b.amountIn > a.amountIn ? 1 : -1));
      optimized.push(...group);
    }

    return optimized;
  }

  /**
   * Split swaps into batches based on limits
   */
  private splitIntoBatches(swaps: SwapCall[]): SwapCall[][] {
    const batches: SwapCall[][] = [];
    let currentBatch: SwapCall[] = [];
    let currentCalldataSize = 0;

    for (const swap of swaps) {
      const swapCalldataSize = swap.callData.length;

      // Check if adding this swap would exceed limits
      const wouldExceedSwapLimit =
        currentBatch.length >= MAX_SWAPS_PER_USEROP;
      const wouldExceedSizeLimit =
        currentCalldataSize + swapCalldataSize > MAX_CALLDATA_SIZE;

      if (wouldExceedSwapLimit || wouldExceedSizeLimit) {
        if (currentBatch.length > 0) {
          batches.push(currentBatch);
        }
        currentBatch = [];
        currentCalldataSize = 0;
      }

      currentBatch.push(swap);
      currentCalldataSize += swapCalldataSize;
    }

    // Don't forget the last batch
    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }

    return batches;
  }

  /**
   * Split permit for a specific batch
   */
  private splitPermitForBatch(
    fullPermit: SignedPermitBatch,
    batchSwaps: SwapCall[],
    allSwaps: SwapCall[]
  ): SignedPermitBatch {
    // Find indices of batch swaps in original array
    const indices = batchSwaps.map((swap) =>
      allSwaps.findIndex(
        (s) =>
          s.tokenIn === swap.tokenIn &&
          s.amountIn === swap.amountIn &&
          s.callData === swap.callData
      )
    );

    // Extract corresponding permits
    const batchPermitted = indices.map(
      (i) => fullPermit.permit.permitted[i]
    );

    return {
      permit: {
        permitted: batchPermitted,
        spender: fullPermit.permit.spender,
        nonce: fullPermit.permit.nonce,
        deadline: fullPermit.permit.deadline,
      },
      signature: fullPermit.signature,
    };
  }

  /**
   * Deduplicate tokens and combine amounts
   */
  private deduplicateTokens(
    tokens: Array<{ token: Address; amount: bigint }>
  ): Array<{ token: Address; amount: bigint }> {
    const tokenMap = new Map<string, bigint>();

    for (const { token, amount } of tokens) {
      const key = token.toLowerCase();
      const existing = tokenMap.get(key) || 0n;
      tokenMap.set(key, existing + amount);
    }

    return Array.from(tokenMap.entries()).map(([token, amount]) => ({
      token: token as Address,
      amount,
    }));
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createBatchSwapBuilder(
  publicClient: PublicClient,
  chainId: number,
  userOpBuilder: UserOpBuilder,
  permit2Service: Permit2Service
): BatchSwapBuilder {
  return new BatchSwapBuilder(
    publicClient,
    chainId,
    userOpBuilder,
    permit2Service
  );
}
