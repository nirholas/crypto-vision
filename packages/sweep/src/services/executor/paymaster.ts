import {
  type Address,
  type Hex,
  type PublicClient,
  encodeAbiParameters,
  parseAbiParameters,
  keccak256,
  concat,
} from "viem";
import type {
  UserOperation,
  PaymasterData,
  PaymasterResponse,
  GasTokenConfig,
  SupportedGasToken,
} from "./types.js";

// ============================================================================
// Constants - Coinbase Verifying Paymaster
// ============================================================================

// Coinbase Paymaster addresses per chain
export const COINBASE_PAYMASTER: Record<number, Address> = {
  1: "0x2FAEB0760D4230Ef2aC21496Bb4F0b47D634FD4c", // Ethereum
  8453: "0x2FAEB0760D4230Ef2aC21496Bb4F0b47D634FD4c", // Base
  42161: "0x2FAEB0760D4230Ef2aC21496Bb4F0b47D634FD4c", // Arbitrum
  137: "0x2FAEB0760D4230Ef2aC21496Bb4F0b47D634FD4c", // Polygon
  10: "0x2FAEB0760D4230Ef2aC21496Bb4F0b47D634FD4c", // Optimism
  56: "0x2FAEB0760D4230Ef2aC21496Bb4F0b47D634FD4c", // BNB Chain
  59144: "0x2FAEB0760D4230Ef2aC21496Bb4F0b47D634FD4c", // Linea
};

// Supported gas tokens per chain
export const GAS_TOKENS: Record<number, Record<SupportedGasToken, GasTokenConfig>> = {
  1: {
    USDC: {
      symbol: "USDC",
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      decimals: 6,
      exchangeRate: 3000n * 10n ** 6n, // ~$3000 per ETH
    },
    USDT: {
      symbol: "USDT",
      address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      decimals: 6,
      exchangeRate: 3000n * 10n ** 6n,
    },
    DAI: {
      symbol: "DAI",
      address: "0x6B175474E89094C44Da98b954EesfdKAD3eF3eBF",
      decimals: 18,
      exchangeRate: 3000n * 10n ** 18n,
    },
  },
  8453: {
    USDC: {
      symbol: "USDC",
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      decimals: 6,
      exchangeRate: 3000n * 10n ** 6n,
    },
    USDT: {
      symbol: "USDT",
      address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
      decimals: 6,
      exchangeRate: 3000n * 10n ** 6n,
    },
    DAI: {
      symbol: "DAI",
      address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
      decimals: 18,
      exchangeRate: 3000n * 10n ** 18n,
    },
  },
  42161: {
    USDC: {
      symbol: "USDC",
      address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      decimals: 6,
      exchangeRate: 3000n * 10n ** 6n,
    },
    USDT: {
      symbol: "USDT",
      address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
      decimals: 6,
      exchangeRate: 3000n * 10n ** 6n,
    },
    DAI: {
      symbol: "DAI",
      address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
      decimals: 18,
      exchangeRate: 3000n * 10n ** 18n,
    },
  },
  137: {
    USDC: {
      symbol: "USDC",
      address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
      decimals: 6,
      exchangeRate: 3000n * 10n ** 6n,
    },
    USDT: {
      symbol: "USDT",
      address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
      decimals: 6,
      exchangeRate: 3000n * 10n ** 6n,
    },
    DAI: {
      symbol: "DAI",
      address: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
      decimals: 18,
      exchangeRate: 3000n * 10n ** 18n,
    },
  },
  10: {
    USDC: {
      symbol: "USDC",
      address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
      decimals: 6,
      exchangeRate: 3000n * 10n ** 6n,
    },
    USDT: {
      symbol: "USDT",
      address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
      decimals: 6,
      exchangeRate: 3000n * 10n ** 6n,
    },
    DAI: {
      symbol: "DAI",
      address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
      decimals: 18,
      exchangeRate: 3000n * 10n ** 18n,
    },
  },
  56: {
    USDC: {
      symbol: "USDC",
      address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
      decimals: 18,
      exchangeRate: 3000n * 10n ** 18n,
    },
    USDT: {
      symbol: "USDT",
      address: "0x55d398326f99059fF775485246999027B3197955",
      decimals: 18,
      exchangeRate: 3000n * 10n ** 18n,
    },
    DAI: {
      symbol: "DAI",
      address: "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3",
      decimals: 18,
      exchangeRate: 3000n * 10n ** 18n,
    },
  },
  59144: {
    USDC: {
      symbol: "USDC",
      address: "0x176211869cA2b568f2A7D4EE941E073a821EE1ff",
      decimals: 6,
      exchangeRate: 3000n * 10n ** 6n,
    },
    USDT: {
      symbol: "USDT",
      address: "0xA219439258ca9da29E9Cc4cE5596924745e12B93",
      decimals: 6,
      exchangeRate: 3000n * 10n ** 6n,
    },
    DAI: {
      symbol: "DAI",
      address: "0x4AF15ec2A0BD43Db75dd04E62FAA3B8EF36b00d5",
      decimals: 18,
      exchangeRate: 3000n * 10n ** 18n,
    },
  },
};

// ============================================================================
// Paymaster Service
// ============================================================================

export class PaymasterService {
  private readonly paymasterAddress: Address;
  private readonly signerPrivateKey: Hex;

  constructor(
    private readonly publicClient: PublicClient,
    private readonly chainId: number,
    signerPrivateKey: Hex
  ) {
    const paymaster = COINBASE_PAYMASTER[chainId];
    if (!paymaster) {
      throw new Error(`Paymaster not supported on chain ${chainId}`);
    }
    this.paymasterAddress = paymaster;
    this.signerPrivateKey = signerPrivateKey;
  }

  /**
   * Get supported gas tokens for the current chain
   */
  getSupportedGasTokens(): GasTokenConfig[] {
    const tokens = GAS_TOKENS[this.chainId];
    if (!tokens) {
      return [];
    }
    return Object.values(tokens);
  }

  /**
   * Check if a gas token is supported
   */
  isGasTokenSupported(tokenAddress: Address): boolean {
    const tokens = GAS_TOKENS[this.chainId];
    if (!tokens) return false;
    return Object.values(tokens).some(
      (t) => t.address.toLowerCase() === tokenAddress.toLowerCase()
    );
  }

  /**
   * Get gas token config by address
   */
  getGasTokenConfig(tokenAddress: Address): GasTokenConfig | undefined {
    const tokens = GAS_TOKENS[this.chainId];
    if (!tokens) return undefined;
    return Object.values(tokens).find(
      (t) => t.address.toLowerCase() === tokenAddress.toLowerCase()
    );
  }

  /**
   * Estimate gas cost in the selected token
   */
  async estimateGasCostInToken(
    userOp: UserOperation,
    gasTokenAddress: Address
  ): Promise<bigint> {
    const gasToken = this.getGasTokenConfig(gasTokenAddress);
    if (!gasToken) {
      throw new Error(`Gas token ${gasTokenAddress} not supported`);
    }

    // Calculate total gas
    const totalGas =
      userOp.preVerificationGas +
      userOp.verificationGasLimit +
      userOp.callGasLimit;

    // Calculate ETH cost
    const ethCost = totalGas * userOp.maxFeePerGas;

    // Convert to token amount using exchange rate
    // exchangeRate = tokens per ETH, so tokenCost = ethCost * exchangeRate / 1e18
    const tokenCost = (ethCost * gasToken.exchangeRate) / 10n ** 18n;

    // Add 10% buffer for price fluctuations
    return (tokenCost * 110n) / 100n;
  }

  /**
   * Generate paymaster data for a UserOperation
   * This sponsors the gas cost and allows the user to pay with ERC-20
   */
  async getPaymasterData(
    userOp: UserOperation,
    gasTokenAddress: Address
  ): Promise<PaymasterResponse> {
    const gasToken = this.getGasTokenConfig(gasTokenAddress);
    if (!gasToken) {
      throw new Error(`Gas token ${gasTokenAddress} not supported`);
    }

    // Create paymaster data
    const paymasterData: PaymasterData = {
      validUntil: Math.floor(Date.now() / 1000) + 3600, // 1 hour validity
      validAfter: 0,
      gasToken: gasToken.address,
      exchangeRate: gasToken.exchangeRate,
      postOpGas: 50000n, // Gas for postOp callback
    };

    // Encode paymaster data
    const encodedPaymasterData = this.encodePaymasterData(paymasterData);

    // Generate paymaster signature
    const hash = await this.getPaymasterHash(userOp, paymasterData);
    const signature = await this.signPaymasterHash(hash);

    // Combine paymaster address + data + signature
    const paymasterAndData = concat([
      this.paymasterAddress,
      encodedPaymasterData,
      signature,
    ]);

    return {
      paymasterAndData,
      preVerificationGas: userOp.preVerificationGas,
      verificationGasLimit: userOp.verificationGasLimit + 50000n, // Extra for paymaster
      callGasLimit: userOp.callGasLimit,
    };
  }

  /**
   * Encode paymaster data into bytes
   */
  private encodePaymasterData(data: PaymasterData): Hex {
    return encodeAbiParameters(
      parseAbiParameters(
        "uint48 validUntil, uint48 validAfter, address gasToken, uint256 exchangeRate, uint128 postOpGas"
      ),
      [
        data.validUntil,
        data.validAfter,
        data.gasToken,
        data.exchangeRate,
        data.postOpGas,
      ]
    );
  }

  /**
   * Compute the hash that needs to be signed by the paymaster
   */
  private async getPaymasterHash(
    userOp: UserOperation,
    paymasterData: PaymasterData
  ): Promise<Hex> {
    // Hash the UserOp fields that the paymaster commits to
    const userOpHash = keccak256(
      encodeAbiParameters(
        parseAbiParameters(
          "address sender, uint256 nonce, bytes32 initCodeHash, bytes32 callDataHash, uint256 callGasLimit, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas"
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
        ]
      )
    );

    // Combine with paymaster-specific data
    return keccak256(
      encodeAbiParameters(
        parseAbiParameters(
          "bytes32 userOpHash, address paymaster, uint48 validUntil, uint48 validAfter, address gasToken, uint256 exchangeRate"
        ),
        [
          userOpHash,
          this.paymasterAddress,
          paymasterData.validUntil,
          paymasterData.validAfter,
          paymasterData.gasToken,
          paymasterData.exchangeRate,
        ]
      )
    );
  }

  /**
   * Sign the paymaster hash with the verifying signer
   */
  private async signPaymasterHash(hash: Hex): Promise<Hex> {
    // In production, use a secure signing service (AWS KMS, etc.)
    // For now, we import from viem
    const { privateKeyToAccount } = await import("viem/accounts");
    const account = privateKeyToAccount(this.signerPrivateKey);
    return account.signMessage({ message: { raw: hash } });
  }

  /**
   * Verify user has sufficient gas token balance
   */
  async verifyGasTokenBalance(
    userAddress: Address,
    gasTokenAddress: Address,
    estimatedGasCost: bigint
  ): Promise<{ sufficient: boolean; balance: bigint; required: bigint }> {
    const balance = await this.publicClient.readContract({
      address: gasTokenAddress,
      abi: [
        {
          name: "balanceOf",
          type: "function",
          stateMutability: "view",
          inputs: [{ name: "account", type: "address" }],
          outputs: [{ name: "", type: "uint256" }],
        },
      ],
      functionName: "balanceOf",
      args: [userAddress],
    });

    return {
      sufficient: balance >= estimatedGasCost,
      balance,
      required: estimatedGasCost,
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createPaymasterService(
  publicClient: PublicClient,
  chainId: number,
  signerPrivateKey?: Hex
): PaymasterService {
  const key =
    signerPrivateKey ||
    (process.env.PAYMASTER_SIGNER_KEY as Hex) ||
    ("0x" + "0".repeat(64) as Hex);
  return new PaymasterService(publicClient, chainId, key);
}
