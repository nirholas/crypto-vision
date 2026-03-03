import {
  type Address,
  type Hex,
  type PublicClient,
  createPublicClient,
  http,
} from "viem";
import type {
  ExecutionRequest,
  ExecutionResult,
  SwapCall,
  SolanaSwapRequest,
  SolanaExecutionResult,
  UserOpReceipt,
} from "./types.js";
import {
  type SmartWalletService,
  createSmartWalletService,
} from "./smart-wallet.js";
import { type PaymasterService, createPaymasterService } from "./paymaster.js";
import { type BundlerService, createBundlerService } from "./bundler.js";
import { type Permit2Service, createPermit2Service } from "./permit2.js";
import { type SimulationService, createSimulationService } from "./simulation.js";
import { type UserOpBuilder, createUserOpBuilder } from "./userops/builder.js";
import {
  type BatchSwapBuilder,
  createBatchSwapBuilder,
} from "./userops/batch.js";
import { type SolanaExecutor, createSolanaExecutor } from "./solana/executor.js";
import { CHAIN_CONFIG, type SupportedChain } from "../../config/chains.js";

// ============================================================================
// Types
// ============================================================================

export interface ExecutorConfig {
  chainId: number;
  rpcUrl: string;
  pimlicoApiKey?: string;
  alchemyApiKey?: string;
  paymasterSignerKey?: Hex;
}

export interface SweepExecutorServices {
  smartWallet: SmartWalletService;
  paymaster: PaymasterService;
  bundler: BundlerService;
  permit2: Permit2Service;
  simulation: SimulationService;
  userOpBuilder: UserOpBuilder;
  batchBuilder: BatchSwapBuilder;
}

// ============================================================================
// Sweep Executor
// ============================================================================

export class SweepExecutor {
  private readonly services: Map<number, SweepExecutorServices> = new Map();
  private readonly publicClients: Map<number, PublicClient> = new Map();
  private readonly solanaExecutor: SolanaExecutor;

  constructor(
    configs: ExecutorConfig[],
    solanaRpcUrl?: string
  ) {
    // Initialize services for each configured chain
    for (const config of configs) {
      const services = this.initializeServices(config);
      this.services.set(config.chainId, services);
    }

    // Initialize Solana executor
    this.solanaExecutor = createSolanaExecutor(solanaRpcUrl);
  }

  /**
   * Execute a sweep on an EVM chain
   */
  async executeSweep(request: ExecutionRequest): Promise<ExecutionResult> {
    const services = this.services.get(request.chainId);
    if (!services) {
      return {
        success: false,
        swapsExecuted: 0,
        totalInputValue: 0n,
        totalOutputValue: 0n,
        gasCost: 0n,
        gasToken: request.gasToken,
        error: `Chain ${request.chainId} not configured`,
      };
    }

    try {
      // 1. Validate the request
      const validation = services.batchBuilder.validateBatch(request.swaps);
      if (!validation.valid) {
        return {
          success: false,
          swapsExecuted: 0,
          totalInputValue: this.sumInputValues(request.swaps),
          totalOutputValue: 0n,
          gasCost: 0n,
          gasToken: request.gasToken,
          error: validation.errors.join(", "),
        };
      }

      // 2. Build UserOperations
      const userOps = await services.batchBuilder.buildBatchUserOps({
        owner: request.owner,
        swaps: request.swaps,
        gasToken: request.gasToken,
        recipient: request.recipient,
        permitSignatures: request.permitSignatures,
      });

      // 3. Simulate all UserOps
      for (const userOp of userOps) {
        const simResult = await services.simulation.simulateUserOp(userOp);
        if (!simResult.success) {
          return {
            success: false,
            swapsExecuted: 0,
            totalInputValue: this.sumInputValues(request.swaps),
            totalOutputValue: 0n,
            gasCost: 0n,
            gasToken: request.gasToken,
            error: `Simulation failed: ${simResult.executionResult.error}`,
          };
        }
      }

      // 4. Submit UserOperations and collect receipts
      const receipts: UserOpReceipt[] = [];
      let totalGasCost = 0n;

      for (const userOp of userOps) {
        // Submit to bundler
        const userOpHash = await services.bundler.sendUserOperation(userOp);

        // Wait for receipt
        const receipt = await services.bundler.waitForUserOperationReceipt(
          userOpHash,
          120000 // 2 minute timeout
        );

        receipts.push(receipt);
        totalGasCost += receipt.actualGasCost;

        if (!receipt.success) {
          return {
            success: false,
            userOpHash,
            transactionHash: receipt.transactionHash,
            swapsExecuted: receipts.filter((r) => r.success).length,
            totalInputValue: this.sumInputValues(request.swaps),
            totalOutputValue: 0n,
            gasCost: totalGasCost,
            gasToken: request.gasToken,
            error: receipt.reason || "UserOp execution failed",
          };
        }
      }

      // 5. Calculate results
      const lastReceipt = receipts[receipts.length - 1];
      
      return {
        success: true,
        userOpHash: lastReceipt.userOpHash,
        transactionHash: lastReceipt.transactionHash,
        swapsExecuted: request.swaps.length,
        totalInputValue: this.sumInputValues(request.swaps),
        totalOutputValue: this.sumOutputValues(request.swaps),
        gasCost: totalGasCost,
        gasToken: request.gasToken,
      };
    } catch (error) {
      return {
        success: false,
        swapsExecuted: 0,
        totalInputValue: this.sumInputValues(request.swaps),
        totalOutputValue: 0n,
        gasCost: 0n,
        gasToken: request.gasToken,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Execute a sweep on Solana
   */
  async executeSolanaSweep(
    requests: SolanaSwapRequest[],
    signerKeypair: any, // Keypair
    useJito = true
  ): Promise<SolanaExecutionResult[]> {
    return this.solanaExecutor.executeBatchSwaps(
      requests,
      signerKeypair,
      useJito
    );
  }

  /**
   * Get a quote for a batch of swaps (gas estimation)
   */
  async estimateSweepCost(
    chainId: number,
    swaps: SwapCall[],
    gasToken: Address
  ): Promise<{
    estimatedGasCost: bigint;
    estimatedGasTokenCost: bigint;
    batchCount: number;
  }> {
    const services = this.services.get(chainId);
    if (!services) {
      throw new Error(`Chain ${chainId} not configured`);
    }

    // Estimate gas
    const gasEstimate = await services.batchBuilder.estimateBatchGas(swaps);

    // Get gas token config for cost calculation
    const gasTokenConfig = services.paymaster.getGasTokenConfig(gasToken);
    if (!gasTokenConfig) {
      throw new Error(`Gas token ${gasToken} not supported`);
    }

    // Calculate token cost
    const publicClient = this.publicClients.get(chainId)!;
    const gasPrice = await publicClient.getGasPrice();
    const ethCost = gasEstimate.totalGas * gasPrice;
    const tokenCost =
      (ethCost * gasTokenConfig.exchangeRate) / 10n ** 18n;

    return {
      estimatedGasCost: gasEstimate.totalGas,
      estimatedGasTokenCost: (tokenCost * 110n) / 100n, // 10% buffer
      batchCount: gasEstimate.batchCount,
    };
  }

  /**
   * Get the smart wallet address for a user
   */
  async getSmartWalletAddress(
    chainId: number,
    ownerAddress: Address
  ): Promise<Address> {
    const services = this.services.get(chainId);
    if (!services) {
      throw new Error(`Chain ${chainId} not configured`);
    }

    const wallet = await services.smartWallet.getSmartWallet({
      ownerAddress,
      chainId,
    });

    return wallet.address;
  }

  /**
   * Check if a smart wallet is deployed
   */
  async isSmartWalletDeployed(
    chainId: number,
    ownerAddress: Address
  ): Promise<boolean> {
    const services = this.services.get(chainId);
    if (!services) {
      throw new Error(`Chain ${chainId} not configured`);
    }

    const wallet = await services.smartWallet.getSmartWallet({
      ownerAddress,
      chainId,
    });

    return wallet.isDeployed;
  }

  /**
   * Create permit data for signing
   */
  createPermitData(
    chainId: number,
    swaps: SwapCall[],
    spender: Address,
    deadline?: number
  ): { permit: any; typedData: any } {
    const services = this.services.get(chainId);
    if (!services) {
      throw new Error(`Chain ${chainId} not configured`);
    }

    return services.batchBuilder.createBatchPermit(swaps, spender, deadline);
  }

  /**
   * Get supported gas tokens for a chain
   */
  getSupportedGasTokens(chainId: number): Address[] {
    const services = this.services.get(chainId);
    if (!services) {
      return [];
    }

    return services.paymaster.getSupportedGasTokens().map((t) => t.address);
  }

  /**
   * Get configured chain IDs
   */
  getConfiguredChains(): number[] {
    return Array.from(this.services.keys());
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private initializeServices(config: ExecutorConfig): SweepExecutorServices {
    // Create public client
    const publicClient = createPublicClient({
      transport: http(config.rpcUrl),
      batch: { multicall: true },
    });
    this.publicClients.set(config.chainId, publicClient);

    // Create services
    const smartWallet = createSmartWalletService(publicClient, config.chainId);
    const paymaster = createPaymasterService(
      publicClient,
      config.chainId,
      config.paymasterSignerKey
    );
    const bundler = createBundlerService(
      config.chainId,
      config.pimlicoApiKey,
      config.alchemyApiKey
    );
    const permit2 = createPermit2Service(publicClient, config.chainId);
    const simulation = createSimulationService(publicClient, config.chainId);

    const userOpBuilder = createUserOpBuilder(
      publicClient,
      config.chainId,
      smartWallet,
      bundler,
      paymaster,
      permit2
    );

    const batchBuilder = createBatchSwapBuilder(
      publicClient,
      config.chainId,
      userOpBuilder,
      permit2
    );

    return {
      smartWallet,
      paymaster,
      bundler,
      permit2,
      simulation,
      userOpBuilder,
      batchBuilder,
    };
  }

  private sumInputValues(swaps: SwapCall[]): bigint {
    return swaps.reduce((sum, swap) => sum + swap.amountIn, 0n);
  }

  private sumOutputValues(swaps: SwapCall[]): bigint {
    return swaps.reduce((sum, swap) => sum + swap.minAmountOut, 0n);
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a sweep executor from environment variables
 */
export function createSweepExecutor(): SweepExecutor {
  const configs: ExecutorConfig[] = [];

  // Load chain configs from environment
  const chainNames = Object.keys(CHAIN_CONFIG) as Exclude<
    SupportedChain,
    "solana"
  >[];

  for (const chainName of chainNames) {
    const chainConfig = CHAIN_CONFIG[chainName];
    const rpcUrl = process.env[chainConfig.rpcEnvKey];

    if (!rpcUrl) continue;

    configs.push({
      chainId: chainConfig.chain.id,
      rpcUrl,
      pimlicoApiKey: process.env.PIMLICO_API_KEY,
      alchemyApiKey: process.env.ALCHEMY_API_KEY,
      paymasterSignerKey: process.env.PAYMASTER_SIGNER_KEY as Hex | undefined,
    });
  }

  if (configs.length === 0) {
    throw new Error("No chain RPC URLs configured. Set RPC_* environment variables.");
  }

  return new SweepExecutor(configs, process.env.RPC_SOLANA);
}

/**
 * Create a sweep executor with explicit configuration
 */
export function createSweepExecutorWithConfig(
  configs: ExecutorConfig[],
  solanaRpcUrl?: string
): SweepExecutor {
  return new SweepExecutor(configs, solanaRpcUrl);
}

// ============================================================================
// Re-exports
// ============================================================================

export * from "./types.js";
export * from "./smart-wallet.js";
export * from "./paymaster.js";
export * from "./bundler.js";
export * from "./permit2.js";
export * from "./simulation.js";
export { UserOpBuilder } from "./userops/builder.js";
export { BatchSwapBuilder } from "./userops/batch.js";
export { SolanaExecutor } from "./solana/executor.js";
