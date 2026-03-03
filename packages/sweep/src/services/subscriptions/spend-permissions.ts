import {
  type Address,
  type Hex,
  type PublicClient,
  keccak256,
  encodeAbiParameters,
  parseAbiParameters,
  toHex,
  concat,
  recoverAddress,
  hashTypedData,
  verifyTypedData,
} from "viem";
import {
  type SpendPermission,
  type SignedSpendPermission,
  type SpendPermissionStatus,
  SPEND_PERMISSION_MANAGER,
  SWEEP_EXECUTOR_ADDRESS,
  NATIVE_TOKEN_ADDRESS,
} from "./types.js";

// ============================================================================
// Constants
// ============================================================================

// EIP-712 domain for Spend Permissions
const SPEND_PERMISSION_DOMAIN = {
  name: "SpendPermissionManager",
  version: "1",
} as const;

// EIP-712 type hash for SpendPermission
const SPEND_PERMISSION_TYPEHASH = keccak256(
  toHex(
    "SpendPermission(address account,address spender,address token,uint160 allowance,uint48 period,uint48 start,uint48 end,uint256 salt,bytes extraData)"
  )
);

// Spend Permission Manager ABI fragments
const SPEND_PERMISSION_MANAGER_ABI = [
  {
    name: "isValidSpendPermission",
    type: "function",
    stateMutability: "view",
    inputs: [
      {
        name: "permission",
        type: "tuple",
        components: [
          { name: "account", type: "address" },
          { name: "spender", type: "address" },
          { name: "token", type: "address" },
          { name: "allowance", type: "uint160" },
          { name: "period", type: "uint48" },
          { name: "start", type: "uint48" },
          { name: "end", type: "uint48" },
          { name: "salt", type: "uint256" },
          { name: "extraData", type: "bytes" },
        ],
      },
      { name: "signature", type: "bytes" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "getCurrentPeriod",
    type: "function",
    stateMutability: "view",
    inputs: [
      {
        name: "permission",
        type: "tuple",
        components: [
          { name: "account", type: "address" },
          { name: "spender", type: "address" },
          { name: "token", type: "address" },
          { name: "allowance", type: "uint160" },
          { name: "period", type: "uint48" },
          { name: "start", type: "uint48" },
          { name: "end", type: "uint48" },
          { name: "salt", type: "uint256" },
          { name: "extraData", type: "bytes" },
        ],
      },
    ],
    outputs: [
      { name: "start", type: "uint48" },
      { name: "end", type: "uint48" },
    ],
  },
  {
    name: "getSpendUsage",
    type: "function",
    stateMutability: "view",
    inputs: [
      {
        name: "permission",
        type: "tuple",
        components: [
          { name: "account", type: "address" },
          { name: "spender", type: "address" },
          { name: "token", type: "address" },
          { name: "allowance", type: "uint160" },
          { name: "period", type: "uint48" },
          { name: "start", type: "uint48" },
          { name: "end", type: "uint48" },
          { name: "salt", type: "uint256" },
          { name: "extraData", type: "bytes" },
        ],
      },
    ],
    outputs: [{ name: "used", type: "uint160" }],
  },
  {
    name: "isRevoked",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "permissionHash", type: "bytes32" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "spend",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "permission",
        type: "tuple",
        components: [
          { name: "account", type: "address" },
          { name: "spender", type: "address" },
          { name: "token", type: "address" },
          { name: "allowance", type: "uint160" },
          { name: "period", type: "uint48" },
          { name: "start", type: "uint48" },
          { name: "end", type: "uint48" },
          { name: "salt", type: "uint256" },
          { name: "extraData", type: "bytes" },
        ],
      },
      { name: "signature", type: "bytes" },
      { name: "amount", type: "uint160" },
    ],
    outputs: [],
  },
] as const;

// ============================================================================
// Spend Permissions Service
// ============================================================================

export class SpendPermissionsService {
  constructor(
    private readonly publicClient: PublicClient,
    private readonly chainId: number
  ) {}

  /**
   * Get the SpendPermissionManager contract address for the current chain
   */
  getManagerAddress(): Address {
    const address = SPEND_PERMISSION_MANAGER[this.chainId];
    if (!address) {
      throw new Error(`SpendPermissionManager not deployed on chain ${this.chainId}`);
    }
    return address;
  }

  /**
   * Build EIP-712 typed data for a spend permission
   * User signs this to grant permission for auto-sweeping
   */
  buildSpendPermissionTypedData(permission: SpendPermission) {
    return {
      domain: {
        ...SPEND_PERMISSION_DOMAIN,
        chainId: this.chainId,
        verifyingContract: this.getManagerAddress(),
      },
      types: {
        SpendPermission: [
          { name: "account", type: "address" },
          { name: "spender", type: "address" },
          { name: "token", type: "address" },
          { name: "allowance", type: "uint160" },
          { name: "period", type: "uint48" },
          { name: "start", type: "uint48" },
          { name: "end", type: "uint48" },
          { name: "salt", type: "uint256" },
          { name: "extraData", type: "bytes" },
        ],
      },
      primaryType: "SpendPermission" as const,
      message: {
        account: permission.account,
        spender: permission.spender,
        token: permission.token,
        allowance: permission.allowance,
        period: permission.period,
        start: permission.start,
        end: permission.end,
        salt: permission.salt,
        extraData: permission.extraData,
      },
    };
  }

  /**
   * Create a new spend permission request for user to sign
   */
  createSpendPermissionRequest(params: {
    account: Address;
    token: Address;
    maxAmountPerPeriod: bigint;
    periodSeconds: number;
    expiryTimestamp: number;
    sourceChainIds: number[];
  }): SpendPermission {
    const now = Math.floor(Date.now() / 1000);
    
    // Encode source chain IDs as extra data
    const extraData = encodeAbiParameters(
      parseAbiParameters("uint256[]"),
      [params.sourceChainIds.map(id => BigInt(id))]
    );

    return {
      account: params.account,
      spender: SWEEP_EXECUTOR_ADDRESS,
      token: params.token,
      allowance: params.maxAmountPerPeriod,
      period: params.periodSeconds,
      start: now,
      end: params.expiryTimestamp,
      salt: BigInt(Date.now()), // Use timestamp as unique salt
      extraData,
    };
  }

  /**
   * Compute the hash of a spend permission (for storage/lookup)
   */
  computePermissionHash(permission: SpendPermission): Hex {
    const typedData = this.buildSpendPermissionTypedData(permission);
    return hashTypedData(typedData);
  }

  /**
   * Validate a spend permission signature
   * Returns true if the signature is valid and was signed by the account owner
   */
  async validateSpendPermissionSignature(
    signedPermission: SignedSpendPermission
  ): Promise<boolean> {
    const { permission, signature } = signedPermission;

    // First, verify the signature locally
    const typedData = this.buildSpendPermissionTypedData(permission);
    
    try {
      const isValid = await verifyTypedData({
        ...typedData,
        signature,
        address: permission.account,
      });

      if (!isValid) {
        return false;
      }

      // For smart wallets, also verify on-chain
      try {
        const onChainValid = await this.publicClient.readContract({
          address: this.getManagerAddress(),
          abi: SPEND_PERMISSION_MANAGER_ABI,
          functionName: "isValidSpendPermission",
          args: [
            {
              account: permission.account,
              spender: permission.spender,
              token: permission.token,
              allowance: permission.allowance,
              period: permission.period,
              start: permission.start,
              end: permission.end,
              salt: permission.salt,
              extraData: permission.extraData,
            },
            signature,
          ],
        });
        return onChainValid;
      } catch {
        // Contract call failed, fall back to local validation
        return isValid;
      }
    } catch {
      return false;
    }
  }

  /**
   * Check the status of a spend permission
   * Returns allowance info, usage, and expiry status
   */
  async getSpendPermissionStatus(
    permission: SpendPermission
  ): Promise<SpendPermissionStatus> {
    const now = Math.floor(Date.now() / 1000);
    const permissionHash = this.computePermissionHash(permission);

    // Check if expired
    const isExpired = now >= permission.end;

    // Check if not yet started
    if (now < permission.start) {
      return {
        isValid: false,
        remainingAllowance: 0n,
        usedInPeriod: 0n,
        periodStart: permission.start,
        periodEnd: permission.start + permission.period,
        isExpired: false,
        isRevoked: false,
      };
    }

    // Check if revoked on-chain
    let isRevoked = false;
    try {
      isRevoked = await this.publicClient.readContract({
        address: this.getManagerAddress(),
        abi: SPEND_PERMISSION_MANAGER_ABI,
        functionName: "isRevoked",
        args: [permission.account, permissionHash],
      });
    } catch {
      // Contract call failed, assume not revoked
    }

    // Get current period
    let periodStart = permission.start;
    let periodEnd = permission.start + permission.period;
    try {
      const [start, end] = await this.publicClient.readContract({
        address: this.getManagerAddress(),
        abi: SPEND_PERMISSION_MANAGER_ABI,
        functionName: "getCurrentPeriod",
        args: [
          {
            account: permission.account,
            spender: permission.spender,
            token: permission.token,
            allowance: permission.allowance,
            period: permission.period,
            start: permission.start,
            end: permission.end,
            salt: permission.salt,
            extraData: permission.extraData,
          },
        ],
      });
      periodStart = start;
      periodEnd = end;
    } catch {
      // Calculate locally
      const elapsedPeriods = Math.floor((now - permission.start) / permission.period);
      periodStart = permission.start + elapsedPeriods * permission.period;
      periodEnd = periodStart + permission.period;
    }

    // Get usage in current period
    let usedInPeriod = 0n;
    try {
      usedInPeriod = await this.publicClient.readContract({
        address: this.getManagerAddress(),
        abi: SPEND_PERMISSION_MANAGER_ABI,
        functionName: "getSpendUsage",
        args: [
          {
            account: permission.account,
            spender: permission.spender,
            token: permission.token,
            allowance: permission.allowance,
            period: permission.period,
            start: permission.start,
            end: permission.end,
            salt: permission.salt,
            extraData: permission.extraData,
          },
        ],
      });
    } catch {
      // Usage query failed, assume zero
    }

    const remainingAllowance = BigInt(permission.allowance) - BigInt(usedInPeriod);

    return {
      isValid: !isExpired && !isRevoked && remainingAllowance > 0n,
      remainingAllowance: remainingAllowance > 0n ? remainingAllowance : 0n,
      usedInPeriod,
      periodStart,
      periodEnd,
      isExpired,
      isRevoked,
    };
  }

  /**
   * Check if there's enough allowance remaining to execute a sweep
   */
  async hasEnoughAllowance(
    permission: SpendPermission,
    requiredAmount: bigint
  ): Promise<boolean> {
    const status = await this.getSpendPermissionStatus(permission);
    return status.isValid && status.remainingAllowance >= requiredAmount;
  }

  /**
   * Encode the spend call data for executing a sweep
   */
  encodeSpendCallData(
    permission: SpendPermission,
    signature: Hex,
    amount: bigint
  ): Hex {
    return encodeAbiParameters(
      parseAbiParameters(
        "(address,address,address,uint160,uint48,uint48,uint48,uint256,bytes),bytes,uint160"
      ),
      [
        [
          permission.account,
          permission.spender,
          permission.token,
          permission.allowance,
          permission.period,
          permission.start,
          permission.end,
          permission.salt,
          permission.extraData,
        ],
        signature,
        amount,
      ]
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse a stored spend permission from database
 */
export function parseStoredSpendPermission(data: {
  account: string;
  spender: string;
  token: string;
  allowance: string;
  period: number;
  start: number;
  end: number;
  salt: string;
  extraData: string;
}): SpendPermission {
  return {
    account: data.account as Address,
    spender: data.spender as Address,
    token: data.token as Address,
    allowance: BigInt(data.allowance),
    period: data.period,
    start: data.start,
    end: data.end,
    salt: BigInt(data.salt),
    extraData: data.extraData as Hex,
  };
}

/**
 * Serialize a spend permission for database storage
 */
export function serializeSpendPermission(permission: SpendPermission): {
  account: string;
  spender: string;
  token: string;
  allowance: string;
  period: number;
  start: number;
  end: number;
  salt: string;
  extraData: string;
} {
  return {
    account: permission.account,
    spender: permission.spender,
    token: permission.token,
    allowance: permission.allowance.toString(),
    period: permission.period,
    start: permission.start,
    end: permission.end,
    salt: permission.salt.toString(),
    extraData: permission.extraData,
  };
}

/**
 * Create a spend permission for USDC (common case)
 */
export function createUsdcSpendPermission(
  chainId: number,
  account: Address,
  maxAmountPerPeriod: bigint,
  periodDays: number,
  expiryDays: number,
  sourceChainIds: number[]
): SpendPermission {
  // USDC addresses per chain
  const USDC_ADDRESSES: Record<number, Address> = {
    1: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    42161: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    137: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    10: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
  };

  const usdcAddress = USDC_ADDRESSES[chainId];
  if (!usdcAddress) {
    throw new Error(`USDC not configured for chain ${chainId}`);
  }

  const now = Math.floor(Date.now() / 1000);
  const periodSeconds = periodDays * 24 * 60 * 60;
  const expiryTimestamp = now + expiryDays * 24 * 60 * 60;

  const extraData = encodeAbiParameters(
    parseAbiParameters("uint256[]"),
    [sourceChainIds.map(id => BigInt(id))]
  );

  return {
    account,
    spender: SWEEP_EXECUTOR_ADDRESS,
    token: usdcAddress,
    allowance: maxAmountPerPeriod,
    period: periodSeconds,
    start: now,
    end: expiryTimestamp,
    salt: BigInt(Date.now()),
    extraData,
  };
}
