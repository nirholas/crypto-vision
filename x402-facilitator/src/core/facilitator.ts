import type { Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, baseSepolia, mainnet, arbitrum, arbitrumSepolia } from 'viem/chains';
import { createPublicClient, createWalletClient, http } from 'viem';
import type { PublicClient, WalletClient } from 'viem';

import type {
  Address,
  FacilitatorConfig,
  SettleResponse,
  SupportedChainId,
  VerifyResponse,
  X402Payment,
  PaymentRequirements,
} from '../types/index.js';
import { ERC20_TRANSFER_WITH_AUTHORIZATION_ABI } from '../abi/erc20-permit.js';
import { verifyPayment } from './verifier.js';
import { logger } from '../utils/logger.js';
import { metrics } from '../utils/metrics.js';

/**
 * Map SupportedChainId → viem chain object.
 */
function getViemChain(chainId: SupportedChainId) {
  switch (chainId) {
    case 1: return mainnet;
    case 8453: return base;
    case 84532: return baseSepolia;
    case 42161: return arbitrum;
    case 421614: return arbitrumSepolia;
    default: throw new Error(`Unknown chain: ${chainId}`);
  }
}

/**
 * Decompose a 65-byte EIP-712 signature (0x-prefixed) into v, r, s.
 */
function decomposeSignature(signature: Hex): { v: number; r: Hex; s: Hex } {
  const sig = signature.slice(2);
  if (sig.length !== 130) {
    throw new Error(`Invalid signature length: expected 130 hex chars, got ${sig.length}`);
  }
  const r = `0x${sig.slice(0, 64)}` as Hex;
  const s = `0x${sig.slice(64, 128)}` as Hex;
  let v = parseInt(sig.slice(128, 130), 16);
  if (v < 27) v += 27;
  return { v, r, s };
}

/**
 * Facilitator — orchestrates payment verification and on-chain settlement.
 */
export class Facilitator {
  private walletClients: Map<SupportedChainId, WalletClient> = new Map();
  private publicClients: Map<SupportedChainId, PublicClient> = new Map();
  private readonly address: Address;
  private inflightNonces: Set<string> = new Set();

  constructor(config: FacilitatorConfig) {
    const account = privateKeyToAccount(config.privateKey);
    this.address = account.address;

    for (const chain of config.chains) {
      const viemChain = getViemChain(chain.chainId);

      this.walletClients.set(
        chain.chainId,
        createWalletClient({ account, chain: viemChain, transport: http(chain.rpcUrl) }),
      );
      this.publicClients.set(
        chain.chainId,
        createPublicClient({ chain: viemChain, transport: http(chain.rpcUrl) }) as PublicClient,
      );
    }
  }

  getAddress(): Address {
    return this.address;
  }

  /**
   * Verify a payment without settling.
   */
  async verify(
    payment: X402Payment,
    _requirements?: PaymentRequirements,
  ): Promise<VerifyResponse> {
    const start = Date.now();

    try {
      const result = await verifyPayment(payment);

      metrics.verifyRequests.inc({ valid: String(result.valid) });
      metrics.verifyLatency.observe(Date.now() - start);

      if (!result.valid) {
        logger.info({ reason: result.reason }, 'Payment verification failed');
        return { valid: false, isValid: false, invalidReason: result.reason ?? 'Unknown' };
      }

      return { valid: true, isValid: true, payer: result.signer ?? payment.authorization.from };
    } catch (error: unknown) {
      metrics.verifyErrors.inc();
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: message }, 'Verification threw');
      return { valid: false, isValid: false, invalidReason: `Verification error: ${message}` };
    }
  }

  /**
   * Verify and settle a payment on-chain.
   */
  async settle(
    payment: X402Payment,
    requirements?: PaymentRequirements,
  ): Promise<SettleResponse> {
    const start = Date.now();
    const nonceKey = `${payment.chainId}:${payment.authorization.from}:${payment.authorization.nonce}`;

    if (this.inflightNonces.has(nonceKey)) {
      return { success: false, errorReason: 'Settlement already in progress for this nonce' };
    }

    this.inflightNonces.add(nonceKey);

    try {
      // Step 1: Verify
      const verification = await this.verify(payment, requirements);
      if (!verification.isValid) {
        metrics.settleRejected.inc();
        return {
          success: false,
          errorReason: `Verification failed: ${'invalidReason' in verification ? verification.invalidReason : 'Unknown'}`,
        };
      }

      // Step 2: Settle on-chain
      const walletClient = this.walletClients.get(payment.chainId);
      const publicClient = this.publicClients.get(payment.chainId);
      if (!walletClient || !publicClient) {
        return { success: false, errorReason: `Unsupported chain: ${payment.chainId}` };
      }

      const { v, r, s } = decomposeSignature(payment.signature);

      const txHash = await (walletClient as any).writeContract({
        address: payment.token,
        abi: ERC20_TRANSFER_WITH_AUTHORIZATION_ABI,
        functionName: 'transferWithAuthorization',
        args: [
          payment.authorization.from,
          payment.authorization.to,
          payment.authorization.value,
          payment.authorization.validAfter,
          payment.authorization.validBefore,
          payment.authorization.nonce,
          v,
          r,
          s,
        ],
      }) as Hex;

      logger.info({ txHash, chainId: payment.chainId }, 'Settlement tx submitted');

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        confirmations: 1,
        timeout: 60_000,
      });

      if (receipt.status === 'success') {
        metrics.settleSuccess.inc({ chainId: String(payment.chainId) });
        metrics.settleLatency.observe(Date.now() - start);
        return {
          success: true,
          txHash,
          transaction: txHash,
          network: this.getNetworkForChain(payment.chainId),
          payer: payment.authorization.from,
        };
      }

      metrics.settleFailed.inc({ chainId: String(payment.chainId) });
      return { success: false, errorReason: 'Transaction reverted on-chain' };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown settlement error';
      logger.error({ error: message }, 'Settlement failed');
      metrics.settleFailed.inc({ chainId: String(payment.chainId) });
      return { success: false, errorReason: message };
    } finally {
      this.inflightNonces.delete(nonceKey);
    }
  }

  private getNetworkForChain(chainId: SupportedChainId): string {
    const names: Record<SupportedChainId, string> = {
      1: 'ethereum',
      8453: 'base',
      84532: 'base-sepolia',
      42161: 'arbitrum',
      421614: 'arbitrum-sepolia',
    };
    return names[chainId] ?? 'unknown';
  }
}
