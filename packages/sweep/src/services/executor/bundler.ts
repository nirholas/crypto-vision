import {
  type Address,
  type Hash,
  http,
} from "viem";
import {
  createPimlicoClient,
  type PimlicoClient,
} from "permissionless/clients/pimlico";
import {
  type UserOperation,
  type UserOpReceipt,
  type GasEstimate,
  type BundlerConfig,
  type BundlerProvider,
} from "./types.js";
import { ENTRY_POINT_V07 } from "./smart-wallet.js";

// ============================================================================
// Constants
// ============================================================================

// Pimlico RPC endpoints per chain
const PIMLICO_ENDPOINTS: Record<number, string> = {
  1: "https://api.pimlico.io/v2/ethereum/rpc",
  8453: "https://api.pimlico.io/v2/base/rpc",
  42161: "https://api.pimlico.io/v2/arbitrum/rpc",
  137: "https://api.pimlico.io/v2/polygon/rpc",
  10: "https://api.pimlico.io/v2/optimism/rpc",
  56: "https://api.pimlico.io/v2/binance/rpc",
  59144: "https://api.pimlico.io/v2/linea/rpc",
};

// Alchemy bundler endpoints per chain (fallback)
const ALCHEMY_ENDPOINTS: Record<number, string> = {
  1: "https://eth-mainnet.g.alchemy.com/v2",
  8453: "https://base-mainnet.g.alchemy.com/v2",
  42161: "https://arb-mainnet.g.alchemy.com/v2",
  137: "https://polygon-mainnet.g.alchemy.com/v2",
  10: "https://opt-mainnet.g.alchemy.com/v2",
};

// ============================================================================
// Bundler Client Interface
// ============================================================================

interface BundlerClient {
  provider: BundlerProvider;
  chainId: number;
  sendUserOperation(userOp: UserOperation): Promise<Hash>;
  estimateUserOperationGas(userOp: UserOperation): Promise<GasEstimate>;
  getUserOperationReceipt(hash: Hash): Promise<UserOpReceipt | null>;
  waitForUserOperationReceipt(
    hash: Hash,
    timeout?: number
  ): Promise<UserOpReceipt>;
  getSupportedEntryPoints(): Promise<Address[]>;
}

// ============================================================================
// Pimlico Bundler Implementation
// ============================================================================

class PimlicoBundler implements BundlerClient {
  public readonly provider: BundlerProvider = "pimlico";
  private client: PimlicoClient;

  constructor(
    public readonly chainId: number,
    apiKey: string
  ) {
    const endpoint = PIMLICO_ENDPOINTS[chainId];
    if (!endpoint) {
      throw new Error(`Pimlico not supported on chain ${chainId}`);
    }

    this.client = createPimlicoClient({
      transport: http(`${endpoint}?apikey=${apiKey}`),
      entryPoint: {
        address: ENTRY_POINT_V07,
        version: "0.7",
      },
    });
  }

  async sendUserOperation(userOp: UserOperation): Promise<Hash> {
    const hash = await (this.client as any).sendUserOperation({
      userOperation: this.formatUserOp(userOp),
    });
    return hash;
  }

  async estimateUserOperationGas(userOp: UserOperation): Promise<GasEstimate> {
    const estimate = await (this.client as any).estimateUserOperationGas({
      userOperation: this.formatUserOp(userOp),
    });

    return {
      preVerificationGas: estimate.preVerificationGas,
      verificationGasLimit: estimate.verificationGasLimit,
      callGasLimit: estimate.callGasLimit,
      maxFeePerGas: userOp.maxFeePerGas,
      maxPriorityFeePerGas: userOp.maxPriorityFeePerGas,
    };
  }

  async getUserOperationReceipt(hash: Hash): Promise<UserOpReceipt | null> {
    try {
      const receipt = await this.client.getUserOperationReceipt({
        hash,
      });

      if (!receipt) return null;

      return {
        userOpHash: hash,
        transactionHash: receipt.receipt.transactionHash,
        success: receipt.success,
        reason: receipt.reason,
        actualGasCost: receipt.actualGasCost,
        actualGasUsed: receipt.actualGasUsed,
      };
    } catch {
      return null;
    }
  }

  async waitForUserOperationReceipt(
    hash: Hash,
    timeout = 60000
  ): Promise<UserOpReceipt> {
    const receipt = await this.client.waitForUserOperationReceipt({
      hash,
      timeout,
    });

    return {
      userOpHash: hash,
      transactionHash: receipt.receipt.transactionHash,
      success: receipt.success,
      reason: receipt.reason,
      actualGasCost: receipt.actualGasCost,
      actualGasUsed: receipt.actualGasUsed,
    };
  }

  async getSupportedEntryPoints(): Promise<Address[]> {
    return [ENTRY_POINT_V07];
  }

  private formatUserOp(userOp: UserOperation): any {
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
// Alchemy Bundler Implementation (Fallback)
// ============================================================================

class AlchemyBundler implements BundlerClient {
  public readonly provider: BundlerProvider = "alchemy";
  private endpoint: string;

  constructor(
    public readonly chainId: number,
    apiKey: string
  ) {
    const baseEndpoint = ALCHEMY_ENDPOINTS[chainId];
    if (!baseEndpoint) {
      throw new Error(`Alchemy bundler not supported on chain ${chainId}`);
    }

    this.endpoint = `${baseEndpoint}/${apiKey}`;
  }

  async sendUserOperation(userOp: UserOperation): Promise<Hash> {
    const result = await this.rpcRequest("eth_sendUserOperation", [
      this.formatUserOp(userOp),
      ENTRY_POINT_V07,
    ]);
    return result as Hash;
  }

  async estimateUserOperationGas(userOp: UserOperation): Promise<GasEstimate> {
    const result = await this.rpcRequest("eth_estimateUserOperationGas", [
      this.formatUserOp(userOp),
      ENTRY_POINT_V07,
    ]);

    return {
      preVerificationGas: BigInt(result.preVerificationGas),
      verificationGasLimit: BigInt(result.verificationGasLimit),
      callGasLimit: BigInt(result.callGasLimit),
      maxFeePerGas: userOp.maxFeePerGas,
      maxPriorityFeePerGas: userOp.maxPriorityFeePerGas,
    };
  }

  async getUserOperationReceipt(hash: Hash): Promise<UserOpReceipt | null> {
    try {
      const result = await this.rpcRequest("eth_getUserOperationReceipt", [
        hash,
      ]);
      if (!result) return null;

      return {
        userOpHash: hash,
        transactionHash: result.receipt.transactionHash,
        success: result.success,
        reason: result.reason,
        actualGasCost: BigInt(result.actualGasCost),
        actualGasUsed: BigInt(result.actualGasUsed),
      };
    } catch {
      return null;
    }
  }

  async waitForUserOperationReceipt(
    hash: Hash,
    timeout = 60000
  ): Promise<UserOpReceipt> {
    const startTime = Date.now();
    const pollInterval = 2000;

    while (Date.now() - startTime < timeout) {
      const receipt = await this.getUserOperationReceipt(hash);
      if (receipt) return receipt;
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new Error(`Timeout waiting for UserOp receipt: ${hash}`);
  }

  async getSupportedEntryPoints(): Promise<Address[]> {
    const result = await this.rpcRequest("eth_supportedEntryPoints", []);
    return result as Address[];
  }

  private async rpcRequest(method: string, params: any[]): Promise<any> {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method,
        params,
      }),
    });

    const data = await response.json() as { error?: { message: string }; result: any };
    if (data.error) {
      throw new Error(data.error.message);
    }
    return data.result;
  }

  private formatUserOp(userOp: UserOperation): any {
    return {
      sender: userOp.sender,
      nonce: `0x${userOp.nonce.toString(16)}`,
      initCode: userOp.initCode,
      callData: userOp.callData,
      callGasLimit: `0x${userOp.callGasLimit.toString(16)}`,
      verificationGasLimit: `0x${userOp.verificationGasLimit.toString(16)}`,
      preVerificationGas: `0x${userOp.preVerificationGas.toString(16)}`,
      maxFeePerGas: `0x${userOp.maxFeePerGas.toString(16)}`,
      maxPriorityFeePerGas: `0x${userOp.maxPriorityFeePerGas.toString(16)}`,
      paymasterAndData: userOp.paymasterAndData,
      signature: userOp.signature,
    };
  }
}

// ============================================================================
// Multi-Bundler Service with Failover
// ============================================================================

export class BundlerService {
  private bundlers: BundlerClient[] = [];

  constructor(
    private readonly chainId: number,
    configs: BundlerConfig[]
  ) {
    // Sort by priority and initialize bundlers
    const sorted = [...configs].sort((a, b) => a.priority - b.priority);

    for (const config of sorted) {
      if (config.chainId !== chainId) continue;

      try {
        const bundler = this.createBundler(config);
        this.bundlers.push(bundler);
      } catch (error) {
        console.warn(
          `Failed to initialize ${config.provider} bundler:`,
          error
        );
      }
    }

    if (this.bundlers.length === 0) {
      throw new Error(`No bundlers available for chain ${chainId}`);
    }
  }

  /**
   * Send UserOperation with automatic failover
   */
  async sendUserOperation(userOp: UserOperation): Promise<Hash> {
    let lastError: Error | undefined;

    for (const bundler of this.bundlers) {
      try {
        console.log(
          `Submitting UserOp via ${bundler.provider} on chain ${this.chainId}`
        );
        const hash = await bundler.sendUserOperation(userOp);
        console.log(`UserOp submitted: ${hash}`);
        return hash;
      } catch (error) {
        console.warn(`Bundler ${bundler.provider} failed:`, error);
        lastError = error as Error;
      }
    }

    throw new Error(
      `All bundlers failed. Last error: ${lastError?.message}`
    );
  }

  /**
   * Estimate gas with failover
   */
  async estimateUserOperationGas(userOp: UserOperation): Promise<GasEstimate> {
    let lastError: Error | undefined;

    for (const bundler of this.bundlers) {
      try {
        return await bundler.estimateUserOperationGas(userOp);
      } catch (error) {
        lastError = error as Error;
      }
    }

    throw new Error(
      `Gas estimation failed on all bundlers: ${lastError?.message}`
    );
  }

  /**
   * Get UserOp receipt with failover
   */
  async getUserOperationReceipt(hash: Hash): Promise<UserOpReceipt | null> {
    for (const bundler of this.bundlers) {
      try {
        const receipt = await bundler.getUserOperationReceipt(hash);
        if (receipt) return receipt;
      } catch {
        // Try next bundler
      }
    }
    return null;
  }

  /**
   * Wait for UserOp receipt with failover
   */
  async waitForUserOperationReceipt(
    hash: Hash,
    timeout = 60000
  ): Promise<UserOpReceipt> {
    // Try primary bundler first
    try {
      return await this.bundlers[0].waitForUserOperationReceipt(hash, timeout);
    } catch {
      // Fall back to polling all bundlers
      const startTime = Date.now();
      const pollInterval = 2000;

      while (Date.now() - startTime < timeout) {
        for (const bundler of this.bundlers) {
          try {
            const receipt = await bundler.getUserOperationReceipt(hash);
            if (receipt) return receipt;
          } catch {
            // Continue
          }
        }
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      }

      throw new Error(`Timeout waiting for UserOp receipt: ${hash}`);
    }
  }

  /**
   * Get current gas prices
   */
  async getGasPrices(): Promise<{
    maxFeePerGas: bigint;
    maxPriorityFeePerGas: bigint;
  }> {
    // Use Pimlico's gas price oracle if available
    const pimlicoClient = this.bundlers.find(
      (b) => b.provider === "pimlico"
    ) as PimlicoBundler | undefined;

    if (pimlicoClient) {
      try {
        // Pimlico provides optimized gas prices
        const prices = await (pimlicoClient as any).client.getUserOperationGasPrice();
        return {
          maxFeePerGas: prices.fast.maxFeePerGas,
          maxPriorityFeePerGas: prices.fast.maxPriorityFeePerGas,
        };
      } catch {
        // Fall through to default
      }
    }

    // Default conservative gas prices
    return {
      maxFeePerGas: 50000000000n, // 50 gwei
      maxPriorityFeePerGas: 2000000000n, // 2 gwei
    };
  }

  private createBundler(config: BundlerConfig): BundlerClient {
    switch (config.provider) {
      case "pimlico":
        return new PimlicoBundler(config.chainId, config.apiKey);
      case "alchemy":
        return new AlchemyBundler(config.chainId, config.apiKey);
      default:
        throw new Error(`Unknown bundler provider: ${config.provider}`);
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createBundlerService(
  chainId: number,
  pimlicoApiKey?: string,
  alchemyApiKey?: string
): BundlerService {
  const configs: BundlerConfig[] = [];

  // Add Pimlico as primary
  if (pimlicoApiKey || process.env.PIMLICO_API_KEY) {
    configs.push({
      provider: "pimlico",
      apiKey: pimlicoApiKey || process.env.PIMLICO_API_KEY!,
      chainId,
      priority: 1,
    });
  }

  // Add Alchemy as fallback
  if (alchemyApiKey || process.env.ALCHEMY_API_KEY) {
    configs.push({
      provider: "alchemy",
      apiKey: alchemyApiKey || process.env.ALCHEMY_API_KEY!,
      chainId,
      priority: 2,
    });
  }

  if (configs.length === 0) {
    throw new Error(
      "No bundler API keys provided. Set PIMLICO_API_KEY or ALCHEMY_API_KEY"
    );
  }

  return new BundlerService(chainId, configs);
}
