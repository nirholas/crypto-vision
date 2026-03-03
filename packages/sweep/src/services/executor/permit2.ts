import {
  type Address,
  type Hex,
  type PublicClient,
  encodePacked,
  keccak256,
  encodeAbiParameters,
  parseAbiParameters,
  concat,
  toHex,
} from "viem";
import type {
  PermitTransferFrom,
  PermitBatch,
} from "./types.js";

// ============================================================================
// Constants
// ============================================================================

// Permit2 universal address (same on all EVM chains)
export const PERMIT2_ADDRESS: Address =
  "0x000000000022D473030F116dDEE9F6B43aC78BA3";

// EIP-712 type hashes
const PERMIT_TRANSFER_FROM_TYPEHASH = keccak256(
  toHex(
    "PermitTransferFrom(TokenPermissions permitted,address spender,uint256 nonce,uint256 deadline)TokenPermissions(address token,uint256 amount)"
  )
);

const TOKEN_PERMISSIONS_TYPEHASH = keccak256(
  toHex("TokenPermissions(address token,uint256 amount)")
);

const PERMIT_BATCH_TRANSFER_FROM_TYPEHASH = keccak256(
  toHex(
    "PermitBatchTransferFrom(TokenPermissions[] permitted,address spender,uint256 nonce,uint256 deadline)TokenPermissions(address token,uint256 amount)"
  )
);

// Permit2 ABI fragments
const PERMIT2_ABI = [
  {
    name: "permitTransferFrom",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "permit",
        type: "tuple",
        components: [
          {
            name: "permitted",
            type: "tuple",
            components: [
              { name: "token", type: "address" },
              { name: "amount", type: "uint256" },
            ],
          },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
      {
        name: "transferDetails",
        type: "tuple",
        components: [
          { name: "to", type: "address" },
          { name: "requestedAmount", type: "uint256" },
        ],
      },
      { name: "owner", type: "address" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "permitBatchTransferFrom",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "permit",
        type: "tuple",
        components: [
          {
            name: "permitted",
            type: "tuple[]",
            components: [
              { name: "token", type: "address" },
              { name: "amount", type: "uint256" },
            ],
          },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
      {
        name: "transferDetails",
        type: "tuple[]",
        components: [
          { name: "to", type: "address" },
          { name: "requestedAmount", type: "uint256" },
        ],
      },
      { name: "owner", type: "address" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "token", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [
      { name: "amount", type: "uint160" },
      { name: "expiration", type: "uint48" },
      { name: "nonce", type: "uint48" },
    ],
  },
] as const;

// ============================================================================
// Permit2 Service
// ============================================================================

export class Permit2Service {
  private readonly domainSeparator: Hex;

  constructor(
    private readonly publicClient: PublicClient,
    private readonly chainId: number
  ) {
    this.domainSeparator = this.computeDomainSeparator();
  }

  /**
   * Get a unique nonce for Permit2 signature transfer
   */
  async getNonce(owner: Address, token: Address, spender: Address): Promise<bigint> {
    try {
      const [, , nonce] = await this.publicClient.readContract({
        address: PERMIT2_ADDRESS,
        abi: PERMIT2_ABI,
        functionName: "allowance",
        args: [owner, token, spender],
      });
      return BigInt(nonce);
    } catch {
      // If no allowance exists, start from 0
      return 0n;
    }
  }

  /**
   * Generate a random nonce for one-time permit signatures
   * Uses word-based nonces (higher 248 bits = word, lower 8 bits = bitmap)
   */
  generateNonce(): bigint {
    // Use timestamp + random for uniqueness
    const timestamp = BigInt(Date.now());
    const random = BigInt(Math.floor(Math.random() * 256));
    return (timestamp << 8n) | random;
  }

  /**
   * Create permit data for a single token transfer
   */
  createPermit(
    token: Address,
    amount: bigint,
    spender: Address,
    deadline?: number
  ): PermitTransferFrom {
    return {
      permitted: {
        token,
        amount,
      },
      spender,
      nonce: this.generateNonce(),
      deadline: deadline || Math.floor(Date.now() / 1000) + 3600, // 1 hour default
    };
  }

  /**
   * Create batch permit data for multiple token transfers
   */
  createBatchPermit(
    tokens: Array<{ token: Address; amount: bigint }>,
    spender: Address,
    deadline?: number
  ): PermitBatch {
    return {
      permitted: tokens.map((t) => ({
        token: t.token,
        amount: t.amount,
      })),
      spender,
      nonce: this.generateNonce(),
      deadline: deadline || Math.floor(Date.now() / 1000) + 3600,
    };
  }

  /**
   * Get the EIP-712 typed data for signing a single permit
   */
  getPermitTypedData(permit: PermitTransferFrom): {
    domain: any;
    types: any;
    primaryType: string;
    message: any;
  } {
    return {
      domain: {
        name: "Permit2",
        chainId: this.chainId,
        verifyingContract: PERMIT2_ADDRESS,
      },
      types: {
        PermitTransferFrom: [
          { name: "permitted", type: "TokenPermissions" },
          { name: "spender", type: "address" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
        TokenPermissions: [
          { name: "token", type: "address" },
          { name: "amount", type: "uint256" },
        ],
      },
      primaryType: "PermitTransferFrom",
      message: {
        permitted: permit.permitted,
        spender: permit.spender,
        nonce: permit.nonce,
        deadline: permit.deadline,
      },
    };
  }

  /**
   * Get the EIP-712 typed data for signing a batch permit
   */
  getBatchPermitTypedData(permit: PermitBatch): {
    domain: any;
    types: any;
    primaryType: string;
    message: any;
  } {
    return {
      domain: {
        name: "Permit2",
        chainId: this.chainId,
        verifyingContract: PERMIT2_ADDRESS,
      },
      types: {
        PermitBatchTransferFrom: [
          { name: "permitted", type: "TokenPermissions[]" },
          { name: "spender", type: "address" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
        TokenPermissions: [
          { name: "token", type: "address" },
          { name: "amount", type: "uint256" },
        ],
      },
      primaryType: "PermitBatchTransferFrom",
      message: {
        permitted: permit.permitted,
        spender: permit.spender,
        nonce: permit.nonce,
        deadline: permit.deadline,
      },
    };
  }

  /**
   * Compute the permit hash for manual signing
   */
  getPermitHash(permit: PermitTransferFrom): Hex {
    const tokenPermissionsHash = keccak256(
      encodeAbiParameters(parseAbiParameters("bytes32, address, uint256"), [
        TOKEN_PERMISSIONS_TYPEHASH,
        permit.permitted.token,
        permit.permitted.amount,
      ])
    );

    const structHash = keccak256(
      encodeAbiParameters(
        parseAbiParameters("bytes32, bytes32, address, uint256, uint256"),
        [
          PERMIT_TRANSFER_FROM_TYPEHASH,
          tokenPermissionsHash,
          permit.spender,
          permit.nonce,
          BigInt(permit.deadline),
        ]
      )
    );

    return keccak256(
      concat([toHex("\x19\x01"), this.domainSeparator, structHash])
    );
  }

  /**
   * Compute the batch permit hash for manual signing
   */
  getBatchPermitHash(permit: PermitBatch): Hex {
    const tokenPermissionsHashes = permit.permitted.map((p) =>
      keccak256(
        encodeAbiParameters(parseAbiParameters("bytes32, address, uint256"), [
          TOKEN_PERMISSIONS_TYPEHASH,
          p.token,
          p.amount,
        ])
      )
    );

    const permittedHash = keccak256(
      encodeAbiParameters(
        parseAbiParameters(`bytes32[${permit.permitted.length}]`),
        [tokenPermissionsHashes]
      )
    );

    const structHash = keccak256(
      encodeAbiParameters(
        parseAbiParameters("bytes32, bytes32, address, uint256, uint256"),
        [
          PERMIT_BATCH_TRANSFER_FROM_TYPEHASH,
          permittedHash,
          permit.spender,
          permit.nonce,
          BigInt(permit.deadline),
        ]
      )
    );

    return keccak256(
      concat([toHex("\x19\x01"), this.domainSeparator, structHash])
    );
  }

  /**
   * Encode the permitTransferFrom call data
   */
  encodePermitTransferFrom(
    permit: PermitTransferFrom,
    to: Address,
    amount: bigint,
    owner: Address,
    signature: Hex
  ): Hex {
    return encodePacked(
      ["bytes4", "bytes"],
      [
        "0x30f28b7a", // permitTransferFrom selector
        encodeAbiParameters(
          parseAbiParameters(
            "(((address token, uint256 amount) permitted, uint256 nonce, uint256 deadline) permit, (address to, uint256 requestedAmount) transferDetails, address owner, bytes signature)"
          ),
          [
            {
              permit: {
                permitted: permit.permitted,
                nonce: permit.nonce,
                deadline: BigInt(permit.deadline),
              },
              transferDetails: {
                to,
                requestedAmount: amount,
              },
              owner,
              signature,
            },
          ]
        ),
      ]
    );
  }

  /**
   * Encode the permitBatchTransferFrom call data
   */
  encodePermitBatchTransferFrom(
    permit: PermitBatch,
    transferDetails: Array<{ to: Address; amount: bigint }>,
    owner: Address,
    signature: Hex
  ): Hex {
    return encodePacked(
      ["bytes4", "bytes"],
      [
        "0xedd9444b", // permitBatchTransferFrom selector
        encodeAbiParameters(
          parseAbiParameters(
            "(((address token, uint256 amount)[] permitted, uint256 nonce, uint256 deadline) permit, (address to, uint256 requestedAmount)[] transferDetails, address owner, bytes signature)"
          ),
          [
            {
              permit: {
                permitted: permit.permitted,
                nonce: permit.nonce,
                deadline: BigInt(permit.deadline),
              },
              transferDetails: transferDetails.map((d) => ({
                to: d.to,
                requestedAmount: d.amount,
              })),
              owner,
              signature,
            },
          ]
        ),
      ]
    );
  }

  /**
   * Check if token has Permit2 approval
   */
  async hasPermit2Approval(
    token: Address,
    owner: Address,
    amount: bigint
  ): Promise<boolean> {
    const allowance = await this.publicClient.readContract({
      address: token,
      abi: [
        {
          name: "allowance",
          type: "function",
          stateMutability: "view",
          inputs: [
            { name: "owner", type: "address" },
            { name: "spender", type: "address" },
          ],
          outputs: [{ name: "", type: "uint256" }],
        },
      ],
      functionName: "allowance",
      args: [owner, PERMIT2_ADDRESS],
    });

    return allowance >= amount;
  }

  /**
   * Get the approval call data for Permit2
   */
  encodeApprovePermit2(_token: Address): Hex {
    return encodePacked(
      ["bytes4", "bytes"],
      [
        "0x095ea7b3", // approve selector
        encodeAbiParameters(parseAbiParameters("address, uint256"), [
          PERMIT2_ADDRESS,
          2n ** 256n - 1n, // Max approval
        ]),
      ]
    );
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private computeDomainSeparator(): Hex {
    return keccak256(
      encodeAbiParameters(
        parseAbiParameters("bytes32, bytes32, uint256, address"),
        [
          keccak256(
            toHex(
              "EIP712Domain(string name,uint256 chainId,address verifyingContract)"
            )
          ),
          keccak256(toHex("Permit2")),
          BigInt(this.chainId),
          PERMIT2_ADDRESS,
        ]
      )
    );
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createPermit2Service(
  publicClient: PublicClient,
  chainId: number
): Permit2Service {
  return new Permit2Service(publicClient, chainId);
}

// ============================================================================
// Exports
// ============================================================================

export { PERMIT2_ABI };
