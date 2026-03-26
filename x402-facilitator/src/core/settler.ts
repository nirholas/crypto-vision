import {
  type Hex,
  type Address,
  createWalletClient,
  createPublicClient,
  http,
} from 'viem';
import type { PublicClient, WalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, arbitrum, mainnet, baseSepolia, arbitrumSepolia } from 'viem/chains';

import type { ChainConfig, SettleResult, SupportedChainId, X402Payment } from '../types/index.js';
import { ERC20_TRANSFER_WITH_AUTHORIZATION_ABI } from '../abi/erc20-permit.js';
import { getChainConfig, SUPPORTED_CHAINS } from '../config/chains.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const chainMap: Record<number, any> = {
  1: mainnet,
  8453: base,
  42161: arbitrum,
  84532: baseSepolia,
  421614: arbitrumSepolia,
};

/**
 * Decompose a 65-byte EIP-712 signature into v, r, s.
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
 * Class-based settler for on-chain settlement.
 * Creates clients once at construction time for efficiency.
 */
export class PaymentSettler {
  private walletClients: Map<SupportedChainId, WalletClient> = new Map();
  private publicClients: Map<SupportedChainId, PublicClient> = new Map();
  private readonly address: Address;

  constructor(privateKey: Hex, chains: Array<Omit<ChainConfig, 'rpcUrl'>>) {
    const account = privateKeyToAccount(privateKey);
    this.address = account.address;

    for (const chain of chains) {
      const viemChain = chainMap[chain.chainId];
      if (!viemChain) continue;

      // Use env RPC URLs
      const rpcUrls: Record<number, string | undefined> = {
        1: env.ETHEREUM_RPC_URL,
        8453: env.BASE_RPC_URL,
        42161: env.ARBITRUM_RPC_URL,
        84532: env.BASE_SEPOLIA_RPC_URL,
        421614: env.ARBITRUM_SEPOLIA_RPC_URL,
      };
      const rpcUrl = rpcUrls[chain.chainId];
      if (!rpcUrl) continue;

      this.walletClients.set(
        chain.chainId,
        createWalletClient({ account, chain: viemChain, transport: http(rpcUrl) }),
      );
      this.publicClients.set(
        chain.chainId,
        createPublicClient({ chain: viemChain, transport: http(rpcUrl) }) as PublicClient,
      );
    }
  }

  getAddress(): Address {
    return this.address;
  }

  /**
   * Check if a nonce has already been consumed on-chain.
   */
  async isNonceUsed(
    chainId: SupportedChainId,
    tokenAddress: Address,
    authorizer: Address,
    nonce: Hex,
  ): Promise<boolean> {
    const client = this.publicClients.get(chainId);
    if (!client) return false;

    const used = await client.readContract({
      address: tokenAddress,
      abi: ERC20_TRANSFER_WITH_AUTHORIZATION_ABI,
      functionName: 'authorizationState',
      args: [authorizer, nonce],
    });

    return Boolean(used);
  }

  /**
   * Settle a payment on-chain.
   */
  async settle(payment: X402Payment): Promise<SettleResult> {
    const { chainId, token, authorization, signature } = payment;

    const walletClient = this.walletClients.get(chainId);
    const publicClient = this.publicClients.get(chainId);
    if (!walletClient || !publicClient) {
      return { success: false, error: `Unsupported chain: ${chainId}`, chainId };
    }

    // Pre-check nonce (non-fatal if RPC fails)
    try {
      const used = await this.isNonceUsed(chainId, token, authorization.from, authorization.nonce);
      if (used) {
        return { success: false, error: 'Authorization nonce already used on-chain', chainId };
      }
    } catch {
      // Proceed — the on-chain tx will fail if nonce is consumed
    }

    try {
      const { v, r, s } = decomposeSignature(signature);

      const txHash = await (walletClient as any).writeContract({
        address: token,
        abi: ERC20_TRANSFER_WITH_AUTHORIZATION_ABI,
        functionName: 'transferWithAuthorization',
        args: [
          authorization.from,
          authorization.to,
          authorization.value,
          authorization.validAfter,
          authorization.validBefore,
          authorization.nonce,
          v,
          r,
          s,
        ],
      }) as Hex;

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        confirmations: 1,
        timeout: 60_000,
      });

      const chainConfig = getChainConfig(chainId);

      if (receipt.status === 'reverted') {
        logger.error(`Settlement reverted: ${txHash}`);
        return {
          success: false,
          error: 'Transaction reverted on-chain',
          txHash,
          chainId,
          network: chainConfig.network,
          blockNumber: Number(receipt.blockNumber),
        };
      }

      logger.info(`Settlement confirmed: ${txHash} on chain ${chainId}`);
      return {
        success: true,
        txHash,
        chainId,
        network: chainConfig.network,
        blockNumber: Number(receipt.blockNumber),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown settlement error';
      logger.error(`Settlement failed: ${message}`);

      // Classify common errors
      if (message.includes('timed out') || message.includes('timeout')) {
        return { success: false, error: `Settlement timed out: ${message}`, chainId };
      }
      if (message.includes('insufficient funds') || message.includes('insufficient gas')) {
        return { success: false, error: `Facilitator has insufficient gas: ${message}`, chainId };
      }

      return { success: false, error: message, chainId };
    }
  }
}

/**
 * Standalone settle function (legacy API).
 */
export async function settlePayment(payment: X402Payment): Promise<SettleResult> {
  const settler = new PaymentSettler(env.FACILITATOR_PRIVATE_KEY as Hex, SUPPORTED_CHAINS);
  return settler.settle(payment);
}
