/**
 * @fileoverview Batch Payment Implementation
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import {
  type PublicClient,
  type WalletClient,
  type Address,
  type Chain,
  parseUnits,
  formatUnits,
  encodeFunctionData,
} from 'viem';
import { arbitrum, arbitrumSepolia, base, mainnet, polygon, optimism, bsc } from 'viem/chains';
import type {
  BatchPaymentItem,
  BatchPaymentResult,
  PaymentTransaction,
  X402Token,
  X402Chain,
} from '../types';
import { X402Error, X402ErrorCode } from '../types';
import { TOKENS, NETWORKS, ERC20_ABI, REVENUE_SPLITTER_ABI } from '../constants';

const VIEM_CHAINS: Record<X402Chain, Chain> = {
  arbitrum,
  'arbitrum-sepolia': arbitrumSepolia,
  base,
  ethereum: mainnet,
  polygon,
  optimism,
  bsc,
};

/**
 * Batch payment handler for multiple transfers
 */
export class BatchPayment {
  constructor(
    private readonly publicClient: PublicClient,
    private readonly walletClient: WalletClient | undefined,
    private readonly chain: X402Chain
  ) {}

  /**
   * Execute multiple payments in separate transactions
   * Each payment is independent - failures don't affect others
   */
  async executeMultiple(
    items: BatchPaymentItem[],
    token: X402Token,
    options: { continueOnError?: boolean } = {}
  ): Promise<BatchPaymentResult> {
    if (!this.walletClient?.account) {
      throw new X402Error(
        'Wallet not configured',
        X402ErrorCode.MISSING_PRIVATE_KEY
      );
    }

    const tokenConfig = this.getTokenConfig(token);
    const successful: PaymentTransaction[] = [];
    const failed: Array<{ item: BatchPaymentItem; error: string }> = [];

    let totalAmount = BigInt(0);
    let totalGasUsed = BigInt(0);
    const viemChain = VIEM_CHAINS[this.chain];

    for (const item of items) {
      try {
        const amount = parseUnits(item.amount, tokenConfig.decimals);
        totalAmount += amount;

        const hash = await this.walletClient.writeContract({
          account: this.walletClient.account,
          chain: viemChain,
          address: tokenConfig.address,
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [item.recipient, amount],
        });

        const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
        totalGasUsed += receipt.gasUsed;

        successful.push({
          hash,
          chainId: NETWORKS[this.chain].chainId,
          from: this.walletClient.account.address,
          to: item.recipient,
          amount: amount.toString(),
          formattedAmount: item.amount,
          token,
          tokenAddress: tokenConfig.address,
          status: receipt.status === 'success' ? 'confirmed' : 'failed',
          blockNumber: Number(receipt.blockNumber),
          gasUsed: receipt.gasUsed.toString(),
          timestamp: Math.floor(Date.now() / 1000),
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        failed.push({ item, error: errorMessage });

        if (!options.continueOnError) {
          break;
        }
      }
    }

    return {
      successful,
      failed,
      totalAmount: formatUnits(totalAmount, tokenConfig.decimals),
      totalGasUsed: totalGasUsed.toString(),
    };
  }

  /**
   * Execute batch payments through a revenue splitter contract
   * More gas efficient for multiple payments
   */
  async executeViaSplitter(
    splitterAddress: Address,
    toolNames: string[],
    amounts: string[],
    token: X402Token
  ): Promise<PaymentTransaction> {
    if (!this.walletClient?.account) {
      throw new X402Error(
        'Wallet not configured',
        X402ErrorCode.MISSING_PRIVATE_KEY
      );
    }

    if (toolNames.length !== amounts.length) {
      throw new X402Error(
        'Tool names and amounts arrays must have same length',
        X402ErrorCode.INVALID_PAYMENT_REQUEST
      );
    }

    const tokenConfig = this.getTokenConfig(token);
    const amountsParsed = amounts.map((a) => parseUnits(a, tokenConfig.decimals));
    const totalAmount = amountsParsed.reduce((sum, a) => sum + a, BigInt(0));
    const viemChain = VIEM_CHAINS[this.chain];

    // First approve the splitter contract
    const allowance = await this.publicClient.readContract({
      address: tokenConfig.address,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [this.walletClient.account.address, splitterAddress],
    }) as bigint;

    if (allowance < totalAmount) {
      const approveHash = await this.walletClient.writeContract({
        account: this.walletClient.account,
        chain: viemChain,
        address: tokenConfig.address,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [splitterAddress, totalAmount],
      });
      await this.publicClient.waitForTransactionReceipt({ hash: approveHash });
    }

    // Execute batch payment
    const hash = await this.walletClient.writeContract({
      account: this.walletClient.account,
      chain: viemChain,
      address: splitterAddress,
      abi: REVENUE_SPLITTER_ABI,
      functionName: 'batchProcessPayments',
      args: [toolNames, tokenConfig.address, amountsParsed],
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

    return {
      hash,
      chainId: NETWORKS[this.chain].chainId,
      from: this.walletClient.account.address,
      to: splitterAddress,
      amount: totalAmount.toString(),
      formattedAmount: formatUnits(totalAmount, tokenConfig.decimals),
      token,
      tokenAddress: tokenConfig.address,
      status: receipt.status === 'success' ? 'confirmed' : 'failed',
      blockNumber: Number(receipt.blockNumber),
      gasUsed: receipt.gasUsed.toString(),
      timestamp: Math.floor(Date.now() / 1000),
    };
  }

  /**
   * Estimate gas for batch payment
   */
  async estimateGas(
    items: BatchPaymentItem[],
    token: X402Token
  ): Promise<{ gasEstimate: bigint; formattedGas: string }> {
    if (!this.walletClient?.account) {
      throw new X402Error(
        'Wallet not configured',
        X402ErrorCode.MISSING_PRIVATE_KEY
      );
    }

    const tokenConfig = this.getTokenConfig(token);
    let totalGas = BigInt(0);

    for (const item of items) {
      const amount = parseUnits(item.amount, tokenConfig.decimals);
      
      const gas = await this.publicClient.estimateContractGas({
        address: tokenConfig.address,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [item.recipient, amount],
        account: this.walletClient.account,
      });

      totalGas += gas;
    }

    return {
      gasEstimate: totalGas,
      formattedGas: totalGas.toString(),
    };
  }

  /**
   * Create batch payment data for multicall
   */
  createMulticallData(
    items: BatchPaymentItem[],
    token: X402Token
  ): Array<{ to: Address; data: `0x${string}` }> {
    const tokenConfig = this.getTokenConfig(token);

    return items.map((item) => {
      const amount = parseUnits(item.amount, tokenConfig.decimals);
      const data = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [item.recipient, amount],
      });

      return {
        to: tokenConfig.address,
        data,
      };
    });
  }

  /**
   * Get token configuration
   */
  private getTokenConfig(token: X402Token) {
    const config = TOKENS[this.chain]?.[token];
    if (!config) {
      throw new X402Error(
        `Token ${token} not available on ${this.chain}`,
        X402ErrorCode.UNSUPPORTED_TOKEN
      );
    }
    return config;
  }
}
