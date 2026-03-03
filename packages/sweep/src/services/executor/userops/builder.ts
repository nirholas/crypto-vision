import {
  type Address,
  type Hex,
  type PublicClient,
  keccak256,
  encodeAbiParameters,
  parseAbiParameters,
} from "viem";
import type {
  UserOperation,
  SwapCall,
  GasEstimate,
  SignedPermitBatch,
} from "../types.js";
import {
  type SmartWalletService,
  ENTRY_POINT_V07,
} from "../smart-wallet.js";
import { type BundlerService } from "../bundler.js";
import { type PaymasterService } from "../paymaster.js";
import { type Permit2Service, PERMIT2_ADDRESS } from "../permit2.js";

// ============================================================================
// Constants
// ============================================================================

// Dummy signature for gas estimation (65 bytes)
const DUMMY_SIGNATURE: Hex =
  "0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c";

// ============================================================================
// UserOp Builder
// ============================================================================

export class UserOpBuilder {
  constructor(
    private readonly _publicClient: PublicClient,
    private readonly chainId: number,
    private readonly smartWalletService: SmartWalletService,
    private readonly bundlerService: BundlerService,
    private readonly paymasterService: PaymasterService,
    private readonly permit2Service: Permit2Service
  ) {}

  /**
   * Build a UserOperation for a single swap
   */
  async buildSwapUserOp(params: {
    owner: Address;
    swap: SwapCall;
    gasToken: Address;
    permitSignature?: { permit: any; signature: Hex };
  }): Promise<UserOperation> {
    const smartWallet = await this.smartWalletService.getSmartWallet({
      ownerAddress: params.owner,
      chainId: this.chainId,
    });

    // Build call data for the swap
    const callData = await this.buildSwapCallData(
      params.swap,
      params.owner,
      params.permitSignature
    );

    // Build base UserOp
    const userOp = await this.buildBaseUserOp({
      sender: smartWallet.address,
      owner: params.owner,
      callData,
      isDeployed: smartWallet.isDeployed,
    });

    // Add paymaster data
    const paymasterResponse = await this.paymasterService.getPaymasterData(
      userOp,
      params.gasToken
    );

    return {
      ...userOp,
      paymasterAndData: paymasterResponse.paymasterAndData,
      verificationGasLimit: paymasterResponse.verificationGasLimit,
      callGasLimit: paymasterResponse.callGasLimit,
      preVerificationGas: paymasterResponse.preVerificationGas,
    };
  }

  /**
   * Build a UserOperation for batch swaps
   */
  async buildBatchSwapUserOp(params: {
    owner: Address;
    swaps: SwapCall[];
    gasToken: Address;
    recipient: Address;
    permitSignatures?: SignedPermitBatch;
  }): Promise<UserOperation> {
    const smartWallet = await this.smartWalletService.getSmartWallet({
      ownerAddress: params.owner,
      chainId: this.chainId,
    });

    // Build batch call data
    const callData = await this.buildBatchSwapCallData(
      params.swaps,
      params.owner,
      params.recipient,
      params.permitSignatures
    );

    // Build base UserOp
    const userOp = await this.buildBaseUserOp({
      sender: smartWallet.address,
      owner: params.owner,
      callData,
      isDeployed: smartWallet.isDeployed,
    });

    // Add paymaster data
    const paymasterResponse = await this.paymasterService.getPaymasterData(
      userOp,
      params.gasToken
    );

    return {
      ...userOp,
      paymasterAndData: paymasterResponse.paymasterAndData,
      verificationGasLimit: paymasterResponse.verificationGasLimit,
      callGasLimit: paymasterResponse.callGasLimit,
      preVerificationGas: paymasterResponse.preVerificationGas,
    };
  }

  /**
   * Build the UserOperation hash for signing
   */
  getUserOpHash(userOp: UserOperation): Hex {
    const packed = this.packUserOp(userOp);
    const userOpHash = keccak256(packed);

    return keccak256(
      encodeAbiParameters(
        parseAbiParameters("bytes32, address, uint256"),
        [userOpHash, ENTRY_POINT_V07, BigInt(this.chainId)]
      )
    );
  }

  /**
   * Add signature to UserOperation
   */
  addSignature(userOp: UserOperation, signature: Hex): UserOperation {
    return {
      ...userOp,
      signature,
    };
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private async buildBaseUserOp(params: {
    sender: Address;
    owner: Address;
    callData: Hex;
    isDeployed: boolean;
  }): Promise<UserOperation> {
    const nonce = await this.smartWalletService.getNonce(params.sender);
    const gasPrices = await this.bundlerService.getGasPrices();

    // Get init code if wallet not deployed
    const initCode = params.isDeployed
      ? "0x"
      : this.smartWalletService.getInitCode({
          ownerAddress: params.owner,
          chainId: this.chainId,
        });

    // Create partial UserOp for gas estimation
    const partialUserOp: UserOperation = {
      sender: params.sender,
      nonce,
      initCode: initCode as Hex,
      callData: params.callData,
      callGasLimit: 0n,
      verificationGasLimit: 0n,
      preVerificationGas: 0n,
      maxFeePerGas: gasPrices.maxFeePerGas,
      maxPriorityFeePerGas: gasPrices.maxPriorityFeePerGas,
      paymasterAndData: "0x",
      signature: DUMMY_SIGNATURE,
    };

    // Estimate gas
    let gasEstimate: GasEstimate;
    try {
      gasEstimate = await this.bundlerService.estimateUserOperationGas(
        partialUserOp
      );
    } catch {
      // Use defaults if estimation fails
      gasEstimate = {
        preVerificationGas: 50000n,
        verificationGasLimit: params.isDeployed ? 150000n : 500000n,
        callGasLimit: 300000n,
        maxFeePerGas: gasPrices.maxFeePerGas,
        maxPriorityFeePerGas: gasPrices.maxPriorityFeePerGas,
      };
    }

    // Add 20% buffer to gas limits
    return {
      ...partialUserOp,
      preVerificationGas: (gasEstimate.preVerificationGas * 120n) / 100n,
      verificationGasLimit: (gasEstimate.verificationGasLimit * 120n) / 100n,
      callGasLimit: (gasEstimate.callGasLimit * 120n) / 100n,
    };
  }

  private async buildSwapCallData(
    swap: SwapCall,
    owner: Address,
    permitSignature?: { permit: any; signature: Hex }
  ): Promise<Hex> {
    const calls: Array<{ target: Address; value: bigint; data: Hex }> = [];

    // Add permit transfer call if provided
    if (permitSignature) {
      const permitCall = this.permit2Service.encodePermitTransferFrom(
        permitSignature.permit,
        swap.to,
        swap.amountIn,
        owner,
        permitSignature.signature
      );

      calls.push({
        target: PERMIT2_ADDRESS,
        value: 0n,
        data: permitCall,
      });
    }

    // Add the swap call
    calls.push({
      target: swap.to,
      value: swap.value,
      data: swap.callData,
    });

    // Encode as batch execute
    return this.smartWalletService.encodeExecuteBatch(calls);
  }

  private async buildBatchSwapCallData(
    swaps: SwapCall[],
    owner: Address,
    _recipient: Address,
    permitSignatures?: SignedPermitBatch
  ): Promise<Hex> {
    const calls: Array<{ target: Address; value: bigint; data: Hex }> = [];

    // Add batch permit transfer if provided
    if (permitSignatures) {
      const transferDetails = swaps.map((swap) => ({
        to: swap.to,
        amount: swap.amountIn,
      }));

      const permitCall = this.permit2Service.encodePermitBatchTransferFrom(
        permitSignatures.permit,
        transferDetails,
        owner,
        permitSignatures.signature
      );

      calls.push({
        target: PERMIT2_ADDRESS,
        value: 0n,
        data: permitCall,
      });
    }

    // Add all swap calls
    for (const swap of swaps) {
      calls.push({
        target: swap.to,
        value: swap.value,
        data: swap.callData,
      });
    }

    // Encode as batch execute
    return this.smartWalletService.encodeExecuteBatch(calls);
  }

  private packUserOp(userOp: UserOperation): Hex {
    return encodeAbiParameters(
      parseAbiParameters(
        "address sender, uint256 nonce, bytes32 initCodeHash, bytes32 callDataHash, uint256 callGasLimit, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, bytes32 paymasterAndDataHash"
      ),
      [
        userOp.sender,
        userOp.nonce,
        keccak256(userOp.initCode),
        keccak256(userOp.callData),
        userOp.callGasLimit,
        userOp.verificationGasLimit,
        userOp.preVerificationGas,
        userOp.maxFeePerGas,
        userOp.maxPriorityFeePerGas,
        keccak256(userOp.paymasterAndData),
      ]
    );
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createUserOpBuilder(
  publicClient: PublicClient,
  chainId: number,
  smartWalletService: SmartWalletService,
  bundlerService: BundlerService,
  paymasterService: PaymasterService,
  permit2Service: Permit2Service
): UserOpBuilder {
  return new UserOpBuilder(
    publicClient,
    chainId,
    smartWalletService,
    bundlerService,
    paymasterService,
    permit2Service
  );
}
