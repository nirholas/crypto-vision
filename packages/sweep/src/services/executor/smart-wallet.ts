import {
  type Address,
  type Hex,
  type PublicClient,
  encodeFunctionData,
  encodePacked,
  keccak256,
  getContractAddress,
  concat,
} from "viem";
import type { SmartWallet, SmartWalletConfig } from "./types.js";

// ============================================================================
// Constants - Coinbase Smart Wallet
// ============================================================================

// Coinbase Smart Wallet Factory (same address across all EVM chains)
export const SMART_WALLET_FACTORY: Address =
  "0x0BA5ED0c6AA8c49038F819E587E2633c4A9F428a";

// EntryPoint v0.7 (ERC-4337)
export const ENTRY_POINT_V07: Address =
  "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

// Coinbase Smart Wallet implementation
export const SMART_WALLET_IMPLEMENTATION: Address =
  "0x000100abaad02f1cfC8Bbe32bD5a564817339E72";

// ============================================================================
// ABI Fragments
// ============================================================================

const FACTORY_ABI = [
  {
    name: "createAccount",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "owners", type: "bytes[]" },
      { name: "nonce", type: "uint256" },
    ],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "getAddress",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owners", type: "bytes[]" },
      { name: "nonce", type: "uint256" },
    ],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

const SMART_WALLET_ABI = [
  {
    name: "execute",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "target", type: "address" },
      { name: "value", type: "uint256" },
      { name: "data", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "executeBatch",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "calls",
        type: "tuple[]",
        components: [
          { name: "target", type: "address" },
          { name: "value", type: "uint256" },
          { name: "data", type: "bytes" },
        ],
      },
    ],
    outputs: [],
  },
  {
    name: "entryPoint",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "getNonce",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "isOwner",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "bytes" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

// ============================================================================
// Smart Wallet Service
// ============================================================================

export class SmartWalletService {
  constructor(
    private readonly publicClient: PublicClient,
    private readonly chainId: number
  ) {}

  /**
   * Get the counterfactual address for a smart wallet (before deployment)
   */
  async getSmartWalletAddress(config: SmartWalletConfig): Promise<Address> {
    const owners = this.encodeOwners([config.ownerAddress]);
    const salt = config.salt ?? 0n;

    try {
      const address = await this.publicClient.readContract({
        address: SMART_WALLET_FACTORY,
        abi: FACTORY_ABI,
        functionName: "getAddress",
        args: [owners, salt],
      });
      return address;
    } catch {
      // Fallback: compute address locally using CREATE2
      return this.computeAddress(owners, salt);
    }
  }

  /**
   * Check if a smart wallet is deployed
   */
  async isDeployed(address: Address): Promise<boolean> {
    const code = await this.publicClient.getBytecode({ address });
    return code !== undefined && code !== "0x";
  }

  /**
   * Get or create smart wallet info
   */
  async getSmartWallet(config: SmartWalletConfig): Promise<SmartWallet> {
    const address = await this.getSmartWalletAddress(config);
    const isDeployed = await this.isDeployed(address);

    return {
      address,
      ownerAddress: config.ownerAddress,
      chainId: this.chainId,
      isDeployed,
    };
  }

  /**
   * Generate init code for deploying a new smart wallet
   * This is used in the UserOperation if wallet is not yet deployed
   */
  getInitCode(config: SmartWalletConfig): Hex {
    const owners = this.encodeOwners([config.ownerAddress]);
    const salt = config.salt ?? 0n;

    const initCallData = encodeFunctionData({
      abi: FACTORY_ABI,
      functionName: "createAccount",
      args: [owners, salt],
    });

    return concat([SMART_WALLET_FACTORY, initCallData]);
  }

  /**
   * Encode a single call for execution
   */
  encodeExecute(target: Address, value: bigint, data: Hex): Hex {
    return encodeFunctionData({
      abi: SMART_WALLET_ABI,
      functionName: "execute",
      args: [target, value, data],
    });
  }

  /**
   * Encode multiple calls for batch execution
   */
  encodeExecuteBatch(
    calls: Array<{ target: Address; value: bigint; data: Hex }>
  ): Hex {
    return encodeFunctionData({
      abi: SMART_WALLET_ABI,
      functionName: "executeBatch",
      args: [calls],
    });
  }

  /**
   * Get the nonce for a deployed smart wallet
   */
  async getNonce(walletAddress: Address): Promise<bigint> {
    const isDeployed = await this.isDeployed(walletAddress);
    if (!isDeployed) {
      return 0n;
    }

    // Get nonce from EntryPoint (key = 0 for default nonce key)
    const nonce = await this.publicClient.readContract({
      address: ENTRY_POINT_V07,
      abi: [
        {
          name: "getNonce",
          type: "function",
          stateMutability: "view",
          inputs: [
            { name: "sender", type: "address" },
            { name: "key", type: "uint192" },
          ],
          outputs: [{ name: "", type: "uint256" }],
        },
      ],
      functionName: "getNonce",
      args: [walletAddress, 0n],
    });

    return nonce;
  }

  /**
   * Verify if an address is an owner of the smart wallet
   */
  async isOwner(walletAddress: Address, owner: Address): Promise<boolean> {
    const isDeployed = await this.isDeployed(walletAddress);
    if (!isDeployed) {
      return false;
    }

    const ownerBytes = this.encodeOwners([owner])[0];
    return this.publicClient.readContract({
      address: walletAddress,
      abi: SMART_WALLET_ABI,
      functionName: "isOwner",
      args: [ownerBytes],
    });
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Encode owner addresses as bytes array for Coinbase Smart Wallet
   * Supports both EOA addresses and passkey public keys
   */
  private encodeOwners(owners: Address[]): Hex[] {
    return owners.map((owner) => {
      // For EOA: encode as 32-byte padded address
      return encodePacked(["address"], [owner]) as Hex;
    });
  }

  /**
   * Compute CREATE2 address locally
   */
  private computeAddress(owners: Hex[], salt: bigint): Address {
    const initCodeHash = keccak256(
      encodePacked(
        ["bytes", "bytes"],
        [
          SMART_WALLET_IMPLEMENTATION,
          encodeFunctionData({
            abi: [
              {
                name: "initialize",
                type: "function",
                inputs: [{ name: "owners", type: "bytes[]" }],
                outputs: [],
              },
            ],
            functionName: "initialize",
            args: [owners],
          }),
        ]
      )
    );

    return getContractAddress({
      bytecodeHash: initCodeHash,
      from: SMART_WALLET_FACTORY,
      opcode: "CREATE2",
      salt: encodePacked(["uint256"], [salt]),
    });
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createSmartWalletService(
  publicClient: PublicClient,
  chainId: number
): SmartWalletService {
  return new SmartWalletService(publicClient, chainId);
}

// ============================================================================
// Exports
// ============================================================================

export { SMART_WALLET_ABI, FACTORY_ABI };
