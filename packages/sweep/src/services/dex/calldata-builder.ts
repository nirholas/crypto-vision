import { encodeFunctionData, type Hex } from "viem";
import type { SupportedChain } from "../../config/chains.js";
import {
  type DexQuote,
  NATIVE_TOKEN_ADDRESS,
  WRAPPED_NATIVE_TOKEN,
  isNativeToken,
} from "./types.js";

// ERC20 ABI for approve
const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// WETH ABI for wrapping/unwrapping
const WETH_ABI = [
  {
    name: "deposit",
    type: "function",
    inputs: [],
    outputs: [],
  },
  {
    name: "withdraw",
    type: "function",
    inputs: [{ name: "wad", type: "uint256" }],
    outputs: [],
  },
] as const;

// Permit2 ABI for gasless approvals
const PERMIT2_ABI = [
  {
    name: "permit",
    type: "function",
    inputs: [
      { name: "owner", type: "address" },
      {
        name: "permitSingle",
        type: "tuple",
        components: [
          {
            name: "details",
            type: "tuple",
            components: [
              { name: "token", type: "address" },
              { name: "amount", type: "uint160" },
              { name: "expiration", type: "uint48" },
              { name: "nonce", type: "uint48" },
            ],
          },
          { name: "spender", type: "address" },
          { name: "sigDeadline", type: "uint256" },
        ],
      },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

// Permit2 address (same on all chains)
const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3";

export interface SwapCalldata {
  to: string;
  data: Hex;
  value: bigint;
}

export interface ApprovalCalldata {
  to: string;
  data: Hex;
  value: bigint;
}

export interface WrapCalldata {
  to: string;
  data: Hex;
  value: bigint;
}

export interface BatchSwapCalldata {
  approvals: ApprovalCalldata[];
  wraps: WrapCalldata[];
  swaps: SwapCalldata[];
  totalValue: bigint; // Total ETH value needed
}

export class CalldataBuilder {
  /**
   * Build calldata for a single swap
   */
  buildSwapCalldata(quote: DexQuote): SwapCalldata {
    if (!quote.calldata || !quote.to) {
      throw new Error("Quote does not contain calldata - request with includeCalldata: true");
    }

    return {
      to: quote.to,
      data: quote.calldata as Hex,
      value: BigInt(quote.value || "0"),
    };
  }

  /**
   * Build approval calldata for a token
   */
  buildApprovalCalldata(
    tokenAddress: string,
    spender: string,
    amount: bigint = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff") // Max uint256
  ): ApprovalCalldata {
    const data = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: "approve",
      args: [spender as `0x${string}`, amount],
    });

    return {
      to: tokenAddress,
      data,
      value: 0n,
    };
  }

  /**
   * Build WETH wrap calldata (ETH → WETH)
   */
  buildWrapCalldata(chain: SupportedChain, amount: bigint): WrapCalldata {
    const wethAddress = WRAPPED_NATIVE_TOKEN[chain];
    if (!wethAddress) {
      throw new Error(`No wrapped native token for chain: ${chain}`);
    }

    const data = encodeFunctionData({
      abi: WETH_ABI,
      functionName: "deposit",
      args: [],
    });

    return {
      to: wethAddress,
      data,
      value: amount,
    };
  }

  /**
   * Build WETH unwrap calldata (WETH → ETH)
   */
  buildUnwrapCalldata(chain: SupportedChain, amount: bigint): WrapCalldata {
    const wethAddress = WRAPPED_NATIVE_TOKEN[chain];
    if (!wethAddress) {
      throw new Error(`No wrapped native token for chain: ${chain}`);
    }

    const data = encodeFunctionData({
      abi: WETH_ABI,
      functionName: "withdraw",
      args: [amount],
    });

    return {
      to: wethAddress,
      data,
      value: 0n,
    };
  }

  /**
   * Build complete calldata for a swap including approvals and wrapping
   */
  async buildCompleteSwapCalldata(
    quote: DexQuote,
    chain: SupportedChain,
    needsApproval: boolean,
    needsWrap: boolean
  ): Promise<BatchSwapCalldata> {
    const approvals: ApprovalCalldata[] = [];
    const wraps: WrapCalldata[] = [];
    let totalValue = 0n;

    // Handle native token wrapping if needed
    if (needsWrap && isNativeToken(quote.inputToken.address)) {
      const wrapCalldata = this.buildWrapCalldata(
        chain,
        BigInt(quote.inputAmount)
      );
      wraps.push(wrapCalldata);
      totalValue += wrapCalldata.value;
    }

    // Build approval if needed
    if (needsApproval && quote.allowanceTarget) {
      // For wrapped tokens after wrapping, approve the WETH
      const tokenToApprove = needsWrap
        ? WRAPPED_NATIVE_TOKEN[chain]
        : quote.inputToken.address;

      const approvalCalldata = this.buildApprovalCalldata(
        tokenToApprove,
        quote.allowanceTarget,
        BigInt(quote.inputAmount)
      );
      approvals.push(approvalCalldata);
    }

    // Build swap calldata
    const swapCalldata = this.buildSwapCalldata(quote);

    // Add any ETH value from the swap itself
    if (!needsWrap) {
      totalValue += swapCalldata.value;
    }

    return {
      approvals,
      wraps,
      swaps: [swapCalldata],
      totalValue,
    };
  }

  /**
   * Build batch swap calldata for multiple dust tokens
   */
  async buildBatchSwapCalldata(
    quotes: DexQuote[],
    chain: SupportedChain,
    approvalStatus: Map<string, boolean> // token address -> needs approval
  ): Promise<BatchSwapCalldata> {
    const approvals: ApprovalCalldata[] = [];
    const wraps: WrapCalldata[] = [];
    const swaps: SwapCalldata[] = [];
    let totalValue = 0n;

    for (const quote of quotes) {
      const needsApproval = approvalStatus.get(quote.inputToken.address) ?? true;
      const needsWrap = isNativeToken(quote.inputToken.address);

      // Handle wrapping
      if (needsWrap) {
        const wrapCalldata = this.buildWrapCalldata(
          chain,
          BigInt(quote.inputAmount)
        );
        wraps.push(wrapCalldata);
        totalValue += wrapCalldata.value;
      }

      // Handle approval
      if (needsApproval && quote.allowanceTarget) {
        const tokenToApprove = needsWrap
          ? WRAPPED_NATIVE_TOKEN[chain]
          : quote.inputToken.address;

        // Check if we already have an approval for this token+spender
        const existingApproval = approvals.find(
          (a) =>
            a.to.toLowerCase() === tokenToApprove.toLowerCase()
        );

        if (!existingApproval) {
          const approvalCalldata = this.buildApprovalCalldata(
            tokenToApprove,
            quote.allowanceTarget
          );
          approvals.push(approvalCalldata);
        }
      }

      // Build swap
      if (quote.calldata && quote.to) {
        swaps.push(this.buildSwapCalldata(quote));
      }
    }

    return {
      approvals,
      wraps,
      swaps,
      totalValue,
    };
  }

  /**
   * Build Permit2 batch permit calldata for gasless approvals
   */
  buildPermit2BatchCalldata(
    permits: Array<{
      token: string;
      amount: bigint;
      spender: string;
      nonce: number;
      deadline: number;
      signature: string;
    }>,
    owner: string
  ): ApprovalCalldata[] {
    return permits.map((permit) => {
      const data = encodeFunctionData({
        abi: PERMIT2_ABI,
        functionName: "permit",
        args: [
          owner as `0x${string}`,
          {
            details: {
              token: permit.token as `0x${string}`,
              amount: BigInt(permit.amount),
              expiration: permit.deadline,
              nonce: permit.nonce,
            },
            spender: permit.spender as `0x${string}`,
            sigDeadline: BigInt(permit.deadline),
          },
          permit.signature as Hex,
        ],
      });

      return {
        to: PERMIT2_ADDRESS,
        data,
        value: 0n,
      };
    });
  }

  /**
   * Encode multiple calls for a multicall/batch transaction
   */
  encodeMulticall(calls: Array<{ to: string; data: Hex; value: bigint }>): {
    targets: string[];
    calldatas: Hex[];
    values: bigint[];
    totalValue: bigint;
  } {
    const targets: string[] = [];
    const calldatas: Hex[] = [];
    const values: bigint[] = [];
    let totalValue = 0n;

    for (const call of calls) {
      targets.push(call.to);
      calldatas.push(call.data);
      values.push(call.value);
      totalValue += call.value;
    }

    return { targets, calldatas, values, totalValue };
  }
}

export const calldataBuilder = new CalldataBuilder();
