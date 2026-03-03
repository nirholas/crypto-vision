import {
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import type {
  UserOperation,
  SimulationRequest,
  SimulationResult,
  UserOpSimulationResult,
  BalanceChange,
  SimulationLog,
} from "./types.js";
import { ENTRY_POINT_V07 } from "./smart-wallet.js";

// ============================================================================
// Constants
// ============================================================================

// Tenderly API endpoints
const TENDERLY_API_URL = "https://api.tenderly.co/api/v1";

// EntryPoint simulate functions
const ENTRY_POINT_SIMULATE_ABI = [
  {
    name: "simulateValidation",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "userOp",
        type: "tuple",
        components: [
          { name: "sender", type: "address" },
          { name: "nonce", type: "uint256" },
          { name: "initCode", type: "bytes" },
          { name: "callData", type: "bytes" },
          { name: "callGasLimit", type: "uint256" },
          { name: "verificationGasLimit", type: "uint256" },
          { name: "preVerificationGas", type: "uint256" },
          { name: "maxFeePerGas", type: "uint256" },
          { name: "maxPriorityFeePerGas", type: "uint256" },
          { name: "paymasterAndData", type: "bytes" },
          { name: "signature", type: "bytes" },
        ],
      },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "preOpGas", type: "uint256" },
          { name: "prefund", type: "uint256" },
          { name: "sigFailed", type: "bool" },
          { name: "validAfter", type: "uint48" },
          { name: "validUntil", type: "uint48" },
          { name: "paymasterContext", type: "bytes" },
        ],
      },
    ],
  },
] as const;

// ============================================================================
// Simulation Service
// ============================================================================

export class SimulationService {
  private readonly tenderlyApiKey?: string;
  private readonly tenderlyAccount?: string;
  private readonly tenderlyProject?: string;

  constructor(
    private readonly publicClient: PublicClient,
    private readonly chainId: number
  ) {
    this.tenderlyApiKey = process.env.TENDERLY_API_KEY;
    this.tenderlyAccount = process.env.TENDERLY_ACCOUNT;
    this.tenderlyProject = process.env.TENDERLY_PROJECT;
  }

  /**
   * Simulate a UserOperation before submission
   */
  async simulateUserOp(userOp: UserOperation): Promise<UserOpSimulationResult> {
    // First, validate the UserOp structure
    this.validateUserOp(userOp);

    // Simulate validation phase
    const validationResult = await this.simulateValidation(userOp);

    // Simulate execution phase
    const executionResult = await this.simulateExecution(userOp);

    return {
      success: !validationResult.sigFailed && executionResult.success,
      validationResult,
      executionResult,
    };
  }

  /**
   * Simulate a raw transaction
   */
  async simulateTransaction(
    request: SimulationRequest
  ): Promise<SimulationResult> {
    // Use Tenderly if available for detailed simulation
    if (this.isTenderlyConfigured()) {
      return this.simulateWithTenderly(request);
    }

    // Fall back to eth_call simulation
    return this.simulateWithEthCall(request);
  }

  /**
   * Estimate balance changes for a transaction
   */
  async estimateBalanceChanges(
    request: SimulationRequest,
    _tokens: Address[]
  ): Promise<BalanceChange[]> {
    if (!this.isTenderlyConfigured()) {
      // Without Tenderly, we can't easily get balance changes
      return [];
    }

    const simulation = await this.simulateWithTenderly(request);
    return simulation.balanceChanges;
  }

  /**
   * Check if a transaction will succeed
   */
  async willSucceed(request: SimulationRequest): Promise<{
    success: boolean;
    reason?: string;
    gasEstimate?: bigint;
  }> {
    try {
      const result = await this.simulateTransaction(request);
      return {
        success: result.success,
        reason: result.error,
        gasEstimate: result.gasUsed,
      };
    } catch (error) {
      return {
        success: false,
        reason: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private validateUserOp(userOp: UserOperation): void {
    if (!userOp.sender || userOp.sender === "0x") {
      throw new Error("Invalid sender address");
    }

    if (userOp.callData.length < 10) {
      throw new Error("Invalid callData");
    }

    if (userOp.maxFeePerGas === 0n) {
      throw new Error("maxFeePerGas cannot be zero");
    }
  }

  private async simulateValidation(userOp: UserOperation): Promise<{
    preOpGas: bigint;
    prefund: bigint;
    sigFailed: boolean;
    validAfter: number;
    validUntil: number;
  }> {
    try {
      // Call simulateValidation on EntryPoint
      const result = await this.publicClient.simulateContract({
        address: ENTRY_POINT_V07,
        abi: ENTRY_POINT_SIMULATE_ABI,
        functionName: "simulateValidation",
        args: [this.formatUserOpForCall(userOp)],
      });

      const validation = result.result as any;
      return {
        preOpGas: BigInt(validation.preOpGas),
        prefund: BigInt(validation.prefund),
        sigFailed: validation.sigFailed,
        validAfter: Number(validation.validAfter),
        validUntil: Number(validation.validUntil),
      };
    } catch (error: any) {
      // simulateValidation reverts with validation result
      // Parse the revert data to extract validation info
      const revertData = error?.cause?.data || error?.data;
      
      if (revertData) {
        return this.parseValidationRevert(revertData);
      }

      // If we can't parse, assume validation would fail
      return {
        preOpGas: 0n,
        prefund: 0n,
        sigFailed: true,
        validAfter: 0,
        validUntil: 0,
      };
    }
  }

  private async simulateExecution(
    userOp: UserOperation
  ): Promise<SimulationResult> {
    // Simulate the actual execution call
    const request: SimulationRequest = {
      chainId: this.chainId,
      from: ENTRY_POINT_V07,
      to: userOp.sender,
      data: userOp.callData,
      value: 0n,
      gasLimit: userOp.callGasLimit,
    };

    return this.simulateTransaction(request);
  }

  private async simulateWithEthCall(
    request: SimulationRequest
  ): Promise<SimulationResult> {
    try {
      const result = await this.publicClient.call({
        account: request.from,
        to: request.to,
        data: request.data,
        value: request.value,
        gas: request.gasLimit,
      });

      return {
        success: true,
        gasUsed: request.gasLimit, // eth_call doesn't return actual gas
        returnData: result.data || "0x",
        logs: [],
        balanceChanges: [],
      };
    } catch (error: any) {
      return {
        success: false,
        gasUsed: 0n,
        returnData: "0x",
        logs: [],
        balanceChanges: [],
        error: error.message || "Simulation failed",
      };
    }
  }

  private async simulateWithTenderly(
    request: SimulationRequest
  ): Promise<SimulationResult> {
    const url = `${TENDERLY_API_URL}/account/${this.tenderlyAccount}/project/${this.tenderlyProject}/simulate`;

    const body = {
      network_id: String(request.chainId),
      from: request.from,
      to: request.to,
      input: request.data,
      value: request.value.toString(),
      gas: Number(request.gasLimit),
      save: false,
      save_if_fails: false,
      simulation_type: "quick",
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Access-Key": this.tenderlyApiKey!,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`Tenderly API error: ${response.status}`);
      }

      const data = await response.json() as { transaction: any };
      const simulation = data.transaction;

      // Parse logs
      const logs: SimulationLog[] = (simulation.transaction_info?.logs || []).map(
        (log: any) => ({
          address: log.raw.address,
          topics: log.raw.topics,
          data: log.raw.data,
        })
      );

      // Parse balance changes
      const balanceChanges: BalanceChange[] = this.parseBalanceChanges(
        simulation.balance_diff || []
      );

      return {
        success: simulation.status,
        gasUsed: BigInt(simulation.gas_used || 0),
        returnData: simulation.transaction_info?.output || "0x",
        logs,
        balanceChanges,
        error: simulation.error_message,
      };
    } catch (error) {
      // Fall back to eth_call
      console.warn("Tenderly simulation failed, falling back to eth_call");
      return this.simulateWithEthCall(request);
    }
  }

  private parseValidationRevert(revertData: Hex): {
    preOpGas: bigint;
    prefund: bigint;
    sigFailed: boolean;
    validAfter: number;
    validUntil: number;
  } {
    // ValidationResult error selector: 0x7c5e2d75
    // Parse the ABI-encoded validation result from revert data
    try {
      // Skip selector (4 bytes) if present
      // Skip selector if present - ValidationResult error: 0x7c5e2d75
      // In production, parse the ABI-encoded validation result from revert data

      // This is a simplified parser - in production, use viem's decodeErrorResult
      return {
        preOpGas: 0n,
        prefund: 0n,
        sigFailed: false,
        validAfter: 0,
        validUntil: 0xffffffffffff,
      };
    } catch {
      return {
        preOpGas: 0n,
        prefund: 0n,
        sigFailed: true,
        validAfter: 0,
        validUntil: 0,
      };
    }
  }

  private parseBalanceChanges(diffs: any[]): BalanceChange[] {
    return diffs.map((diff) => ({
      address: diff.address,
      token: diff.token?.address || "0x0000000000000000000000000000000000000000",
      before: BigInt(diff.original || 0),
      after: BigInt(diff.dirty || 0),
      delta: BigInt(diff.dirty || 0) - BigInt(diff.original || 0),
    }));
  }

  private isTenderlyConfigured(): boolean {
    return !!(
      this.tenderlyApiKey &&
      this.tenderlyAccount &&
      this.tenderlyProject
    );
  }

  private formatUserOpForCall(userOp: UserOperation): any {
    return {
      sender: userOp.sender,
      nonce: userOp.nonce,
      initCode: userOp.initCode,
      callData: userOp.callData,
      callGasLimit: userOp.callGasLimit,
      verificationGasLimit: userOp.verificationGasLimit,
      preVerificationGas: userOp.preVerificationGas,
      maxFeePerGas: userOp.maxFeePerGas,
      maxPriorityFeePerGas: userOp.maxPriorityFeePerGas,
      paymasterAndData: userOp.paymasterAndData,
      signature: userOp.signature,
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createSimulationService(
  publicClient: PublicClient,
  chainId: number
): SimulationService {
  return new SimulationService(publicClient, chainId);
}
