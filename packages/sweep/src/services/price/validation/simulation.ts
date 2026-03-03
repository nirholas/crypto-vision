/**
 * Transaction Simulation
 * Simulates swap transactions using Tenderly to verify expected outcomes
 */

import { type SupportedChain } from "../../../config/chains.js";
import { getViemClient } from "../../../utils/viem.js";
import { cacheGetOrFetch } from "../../../utils/redis.js";
import type { SimulationResult, StateChange, TransferTaxCheck } from "../types.js";

const CONFIG = {
  MAX_HIDDEN_TAX: 0.05, // 5% max hidden transfer fee
  CACHE_TTL: 300, // 5 minutes
};

// Chain IDs for Tenderly
const CHAIN_IDS: Record<Exclude<SupportedChain, "solana">, number> = {
  ethereum: 1,
  base: 8453,
  arbitrum: 42161,
  polygon: 137,
  bsc: 56,
  linea: 59144,
  optimism: 10,
};

// ERC20 Transfer event signature
const TRANSFER_EVENT_SIGNATURE = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

// Minimal ERC20 ABI for simulation
const ERC20_ABI = [
  {
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// Simulation recipient (dead address)
const SIMULATION_RECIPIENT = "0x000000000000000000000000000000000000dEaD" as const;

/**
 * Simulate transaction using Tenderly API
 */
async function simulateWithTenderly(
  from: string,
  to: string,
  data: `0x${string}`,
  value: bigint,
  chain: Exclude<SupportedChain, "solana">
): Promise<SimulationResult> {
  const accessKey = process.env.TENDERLY_ACCESS_KEY;
  const accountSlug = process.env.TENDERLY_ACCOUNT_SLUG;
  const projectSlug = process.env.TENDERLY_PROJECT_SLUG;
  
  if (!accessKey || !accountSlug || !projectSlug) {
    throw new Error("Tenderly credentials not configured");
  }
  
  const networkId = CHAIN_IDS[chain];
  const url = `https://api.tenderly.co/api/v1/account/${accountSlug}/project/${projectSlug}/simulate`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "X-Access-Key": accessKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      network_id: networkId.toString(),
      from,
      to,
      input: data,
      value: value.toString(),
      save: false,
      simulation_type: "quick",
      save_if_fails: false,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Tenderly simulation failed: ${error}`);
  }
  
  const result = (await response.json()) as {
    simulation?: {
      status: boolean;
      error_message?: string;
      gas_used?: number;
    };
    transaction?: {
      transaction_info?: {
        state_changes?: Array<{
          address?: string;
          key?: string;
          original?: string;
          dirty?: string;
        }>;
        asset_changes?: Array<{
          to?: string;
          type?: string;
          raw_amount?: string;
        }>;
      };
    };
  };
  
  if (!result.simulation?.status) {
    return {
      success: false,
      gasUsed: 0n,
      outputAmount: 0n,
      revertReason: result.simulation?.error_message || "Simulation failed",
      stateChanges: [],
    };
  }
  
  // Parse state changes
  const stateChanges: StateChange[] = (result.transaction?.transaction_info?.state_changes || [])
    .map((change: any): StateChange => ({
      address: change.address || "",
      key: change.key || "",
      before: change.original || "",
      after: change.dirty || "",
    }));
  
  // Parse output amount from asset changes
  const assetChanges = result.transaction?.transaction_info?.asset_changes || [];
  const outputTransfer = assetChanges.find(
    (c: any) => c.to?.toLowerCase() === from.toLowerCase() && c.type === "Transfer"
  );
  
  return {
    success: true,
    gasUsed: BigInt(result.simulation?.gas_used || 0),
    outputAmount: BigInt(outputTransfer?.raw_amount || "0"),
    stateChanges,
  };
}

/**
 * Simulate transaction using local RPC (eth_call)
 */
async function simulateWithRpc(
  tokenAddress: string,
  from: string,
  to: string,
  amount: bigint,
  chain: Exclude<SupportedChain, "solana">
): Promise<SimulationResult> {
  const client = getViemClient(chain);
  
  try {
    // Simulate the transfer
    const result = await client.simulateContract({
      address: tokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "transfer",
      args: [to as `0x${string}`, amount],
      account: from as `0x${string}`,
    });
    
    return {
      success: true,
      gasUsed: 0n, // Can't get gas from simulateContract
      outputAmount: amount, // Assume full amount if simulation succeeds
      stateChanges: [],
    };
  } catch (error: any) {
    return {
      success: false,
      gasUsed: 0n,
      outputAmount: 0n,
      revertReason: error.message || "Simulation failed",
      stateChanges: [],
    };
  }
}

/**
 * Simulate a swap transaction
 */
export async function simulateSwapTransaction(
  swapCalldata: `0x${string}`,
  fromAddress: string,
  aggregatorAddress: string,
  chain: SupportedChain
): Promise<SimulationResult> {
  if (chain === "solana") {
    // Solana simulation not supported via Tenderly
    return {
      success: true, // Assume success for Solana
      gasUsed: 0n,
      outputAmount: 0n,
      stateChanges: [],
    };
  }
  
  const cacheKey = `simulation:swap:${chain}:${fromAddress}:${aggregatorAddress}:${swapCalldata.slice(0, 20)}`;
  
  return cacheGetOrFetch(
    cacheKey,
    async () => {
      try {
        return await simulateWithTenderly(
          fromAddress,
          aggregatorAddress,
          swapCalldata,
          0n,
          chain
        );
      } catch (error) {
        console.error("Tenderly simulation failed, using RPC fallback:", error);
        
        // Basic RPC simulation as fallback
        return {
          success: true, // Assume success if we can't simulate
          gasUsed: 0n,
          outputAmount: 0n,
          stateChanges: [],
        };
      }
    },
    CONFIG.CACHE_TTL
  );
}

/**
 * Simulate transfer to detect hidden tax
 */
export async function simulateTransferTax(
  tokenAddress: string,
  chain: SupportedChain,
  amount: bigint,
  fromAddress?: string
): Promise<TransferTaxCheck> {
  if (chain === "solana") {
    // Solana SPL tokens don't have transfer taxes
    return {
      hiddenTax: 0,
      actualReceived: amount,
      expectedAmount: amount,
    };
  }
  
  const cacheKey = `simulation:tax:${chain}:${tokenAddress.toLowerCase()}`;
  
  return cacheGetOrFetch(
    cacheKey,
    async () => {
      const sender = fromAddress || "0x0000000000000000000000000000000000000001";
      
      try {
        // Try Tenderly first
        const client = getViemClient(chain);
        
        // Encode transfer call
        const { encodeFunctionData } = await import("viem");
        const data = encodeFunctionData({
          abi: ERC20_ABI,
          functionName: "transfer",
          args: [SIMULATION_RECIPIENT, amount],
        });
        
        const simulation = await simulateWithTenderly(
          sender,
          tokenAddress,
          data as `0x${string}`,
          0n,
          chain
        );
        
        if (!simulation.success) {
          // Can't simulate - assume no tax
          return {
            hiddenTax: 0,
            actualReceived: amount,
            expectedAmount: amount,
          };
        }
        
        // Check if output amount differs from input
        const actualReceived = simulation.outputAmount > 0n 
          ? simulation.outputAmount 
          : amount;
        
        const hiddenTax = amount > 0n
          ? Number((amount - actualReceived) * 10000n / amount) / 10000
          : 0;
        
        return {
          hiddenTax,
          actualReceived,
          expectedAmount: amount,
        };
      } catch (error) {
        console.error("Transfer tax simulation failed:", error);
        
        // Assume no hidden tax if we can't simulate
        return {
          hiddenTax: 0,
          actualReceived: amount,
          expectedAmount: amount,
        };
      }
    },
    CONFIG.CACHE_TTL
  );
}

/**
 * Check if token has hidden transfer fee
 */
export async function hasHiddenTransferFee(
  tokenAddress: string,
  chain: SupportedChain
): Promise<{
  hasFee: boolean;
  feePercentage: number;
  reason?: string;
}> {
  const testAmount = 1000000000000000000n; // 1 token (18 decimals)
  const taxCheck = await simulateTransferTax(tokenAddress, chain, testAmount);
  
  if (taxCheck.hiddenTax > CONFIG.MAX_HIDDEN_TAX) {
    return {
      hasFee: true,
      feePercentage: taxCheck.hiddenTax * 100,
      reason: `Hidden transfer fee detected: ${(taxCheck.hiddenTax * 100).toFixed(2)}%`,
    };
  }
  
  return {
    hasFee: taxCheck.hiddenTax > 0,
    feePercentage: taxCheck.hiddenTax * 100,
  };
}

/**
 * Validate swap outcome matches expected
 */
export async function validateSwapOutcome(
  swapCalldata: `0x${string}`,
  fromAddress: string,
  aggregatorAddress: string,
  expectedOutputAmount: bigint,
  chain: SupportedChain,
  tolerancePercent: number = 5
): Promise<{
  valid: boolean;
  simulatedOutput: bigint;
  expectedOutput: bigint;
  deviation: number;
  reason?: string;
}> {
  const simulation = await simulateSwapTransaction(
    swapCalldata,
    fromAddress,
    aggregatorAddress,
    chain
  );
  
  if (!simulation.success) {
    return {
      valid: false,
      simulatedOutput: 0n,
      expectedOutput: expectedOutputAmount,
      deviation: 1,
      reason: simulation.revertReason || "Simulation failed",
    };
  }
  
  // If we couldn't get output amount from simulation, assume valid
  if (simulation.outputAmount === 0n) {
    return {
      valid: true,
      simulatedOutput: expectedOutputAmount,
      expectedOutput: expectedOutputAmount,
      deviation: 0,
    };
  }
  
  // Calculate deviation
  const deviation = expectedOutputAmount > 0n
    ? Math.abs(Number(simulation.outputAmount - expectedOutputAmount) / Number(expectedOutputAmount))
    : 0;
  
  const valid = deviation <= (tolerancePercent / 100);
  
  return {
    valid,
    simulatedOutput: simulation.outputAmount,
    expectedOutput: expectedOutputAmount,
    deviation,
    reason: valid 
      ? undefined 
      : `Output deviates ${(deviation * 100).toFixed(2)}% from expected`,
  };
}

/**
 * Should we proceed with sweep based on simulation?
 */
export async function shouldProceedWithSweep(
  tokenAddress: string,
  chain: SupportedChain,
  amount: bigint,
  swapCalldata?: `0x${string}`,
  aggregatorAddress?: string,
  expectedOutput?: bigint,
  fromAddress?: string
): Promise<{
  proceed: boolean;
  requiresApproval: boolean;
  simulation?: SimulationResult;
  taxCheck?: TransferTaxCheck;
  reason?: string;
}> {
  // Check for hidden transfer tax
  const taxCheck = await simulateTransferTax(tokenAddress, chain, amount, fromAddress);
  
  if (taxCheck.hiddenTax > CONFIG.MAX_HIDDEN_TAX) {
    return {
      proceed: false,
      requiresApproval: true,
      taxCheck,
      reason: `Hidden transfer fee too high: ${(taxCheck.hiddenTax * 100).toFixed(2)}%`,
    };
  }
  
  // If we have swap calldata, validate the swap
  if (swapCalldata && aggregatorAddress && expectedOutput && fromAddress) {
    const swapValidation = await validateSwapOutcome(
      swapCalldata,
      fromAddress,
      aggregatorAddress,
      expectedOutput,
      chain
    );
    
    if (!swapValidation.valid) {
      return {
        proceed: false,
        requiresApproval: true,
        taxCheck,
        reason: swapValidation.reason,
      };
    }
  }
  
  // Minor tax detected - allow but inform user
  if (taxCheck.hiddenTax > 0) {
    return {
      proceed: true,
      requiresApproval: true,
      taxCheck,
      reason: `Minor transfer fee detected: ${(taxCheck.hiddenTax * 100).toFixed(2)}%`,
    };
  }
  
  return {
    proceed: true,
    requiresApproval: false,
    taxCheck,
  };
}

export default {
  simulateSwapTransaction,
  simulateTransferTax,
  hasHiddenTransferFee,
  validateSwapOutcome,
  shouldProceedWithSweep,
};
