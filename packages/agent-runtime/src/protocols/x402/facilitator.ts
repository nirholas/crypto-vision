/**
 * x402 Payment Facilitator
 *
 * Handles payment facilitation and settlement.
 */

import { ethers } from 'ethers';
import type {
  FacilitatorConfig,
  TokenConfig,
  PaymentReceipt,
  X402PaymentHeader,
} from './types.js';
import { ERC20_ABI } from '../../utils/contracts.js';
import { type ChainConfig, resolveChain } from '../../utils/chains.js';

export class PaymentFacilitator {
  private readonly config: FacilitatorConfig;
  private readonly receipts: Map<string, PaymentReceipt> = new Map();

  constructor(config: FacilitatorConfig) {
    this.config = config;
  }

  /**
   * Verify a payment on-chain by checking token transfer.
   */
  async verifyOnChainPayment(
    payment: X402PaymentHeader,
    chain: ChainConfig
  ): Promise<boolean> {
    if (!payment.txHash) return false;

    try {
      const provider = new ethers.JsonRpcProvider(chain.rpcUrl);
      const receipt = await provider.getTransactionReceipt(payment.txHash);

      if (!receipt || receipt.status !== 1) return false;

      // Check for ERC-20 Transfer event
      const tokenContract = new ethers.Contract(
        payment.token,
        ERC20_ABI,
        provider
      );

      const transferEvents = receipt.logs
        .map((log) => {
          try {
            return tokenContract.interface.parseLog({
              topics: [...log.topics],
              data: log.data,
            });
          } catch {
            return null;
          }
        })
        .filter(
          (e) =>
            e?.name === 'Transfer' &&
            e.args[0].toLowerCase() === payment.payer.toLowerCase() &&
            e.args[1].toLowerCase() === payment.payee.toLowerCase()
        );

      if (transferEvents.length === 0) return false;

      const transferredAmount = transferEvents[0]!.args[2];
      return BigInt(transferredAmount) >= BigInt(payment.amount);
    } catch {
      return false;
    }
  }

  /**
   * Record a payment receipt.
   */
  recordReceipt(receipt: PaymentReceipt): void {
    this.receipts.set(receipt.paymentId, receipt);
  }

  /**
   * Get a payment receipt.
   */
  getReceipt(paymentId: string): PaymentReceipt | undefined {
    return this.receipts.get(paymentId);
  }

  /**
   * Get all receipts for a route.
   */
  getReceiptsForRoute(route: string): PaymentReceipt[] {
    return Array.from(this.receipts.values()).filter(
      (r) => r.route === route
    );
  }

  /**
   * Get total revenue for a route.
   */
  getRouteRevenue(route: string): bigint {
    return this.getReceiptsForRoute(route).reduce(
      (sum, r) => sum + BigInt(r.amount),
      0n
    );
  }

  /**
   * Get total revenue across all routes.
   */
  getTotalRevenue(): bigint {
    return Array.from(this.receipts.values()).reduce(
      (sum, r) => sum + BigInt(r.amount),
      0n
    );
  }

  /**
   * Find a supported token by symbol.
   */
  findToken(symbol: string): TokenConfig | undefined {
    return this.config.tokens.find(
      (t) => t.symbol.toLowerCase() === symbol.toLowerCase()
    );
  }

  /**
   * Get the payee address.
   */
  get payeeAddress(): string {
    return this.config.payeeAddress;
  }
}
