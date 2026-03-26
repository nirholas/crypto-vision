import {
  type Address,
  type Hex,
  type PublicClient,
  createPublicClient,
  http,
  verifyTypedData,
} from 'viem';
import { base, arbitrum, mainnet, baseSepolia, arbitrumSepolia } from 'viem/chains';

import type { SupportedChainId, VerifyResult, X402Payment, PaymentRequirements } from '../types/index.js';
import { getChainConfig } from '../config/chains.js';
import { getTokenConfig, getTokenDomain } from '../config/tokens.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const chainMap = {
  1: mainnet,
  8453: base,
  42161: arbitrum,
  84532: baseSepolia,
  421614: arbitrumSepolia,
} as const;

const rpcUrlMap: Record<number, string | undefined> = {
  1: env.ETHEREUM_RPC_URL,
  8453: env.BASE_RPC_URL,
  42161: env.ARBITRUM_RPC_URL,
  84532: env.BASE_SEPOLIA_RPC_URL,
  421614: env.ARBITRUM_SEPOLIA_RPC_URL,
};

const TRANSFER_WITH_AUTHORIZATION_TYPES = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const;

function getClient(chainId: SupportedChainId) {
  const rpcUrl = rpcUrlMap[chainId];
  if (!rpcUrl) throw new Error(`No RPC URL configured for chain ${chainId}`);
  const chain = chainMap[chainId];
  return createPublicClient({ chain, transport: http(rpcUrl) });
}

/**
 * Full payment verifier that validates against requirements.
 * Used by tests and the Facilitator.
 */
export class PaymentVerifier {
  /**
   * Verify a payment against its requirements.
   *
   * Checks: chain match, asset match, recipient match, amount, timing,
   * requirements expiry, EIP-712 signature, and on-chain balance.
   */
  async verify(payment: X402Payment, requirements: PaymentRequirements): Promise<VerifyResult> {
    const { chainId, token, authorization, signature } = payment;

    // Chain ID match
    if (chainId !== requirements.chainId) {
      return { valid: false, reason: 'Chain ID mismatch' };
    }

    // Asset match (case-insensitive)
    if (token.toLowerCase() !== requirements.asset.toLowerCase()) {
      return { valid: false, reason: 'Asset mismatch' };
    }

    // Recipient match
    if (authorization.to.toLowerCase() !== requirements.payTo.toLowerCase()) {
      return { valid: false, reason: 'Recipient mismatch' };
    }

    // Amount sufficient
    if (authorization.value < requirements.maxAmountRequired) {
      return { valid: false, reason: 'Insufficient payment amount' };
    }

    // Timing constraints
    const now = BigInt(Math.floor(Date.now() / 1000));
    if (authorization.validAfter > now) {
      return { valid: false, reason: 'Authorization not yet valid' };
    }
    if (authorization.validBefore <= now) {
      return { valid: false, reason: 'Authorization expired' };
    }

    // Requirements expiry
    if (requirements.expiry != null) {
      const nowSec = Math.floor(Date.now() / 1000);
      if (requirements.expiry <= nowSec) {
        return { valid: false, reason: 'Payment requirement expired' };
      }
    }

    // Value must be positive
    if (authorization.value <= 0n) {
      return { valid: false, reason: 'Value must be positive' };
    }

    // Check chain is supported
    try {
      getChainConfig(chainId);
    } catch {
      return { valid: false, reason: `Unsupported chain: ${chainId}` };
    }

    // Check token has EIP-712 domain
    const tokenConfig = getTokenConfig(chainId, token);
    if (!tokenConfig) {
      return { valid: false, reason: `No EIP-712 domain for token ${token} on chain ${chainId}` };
    }

    try {
      // EIP-712 signature verification
      const domain = getTokenDomain(token, chainId);
      const valid = await verifyTypedData({
        address: authorization.from,
        domain,
        types: TRANSFER_WITH_AUTHORIZATION_TYPES,
        primaryType: 'TransferWithAuthorization',
        message: {
          from: authorization.from,
          to: authorization.to,
          value: authorization.value,
          validAfter: authorization.validAfter,
          validBefore: authorization.validBefore,
          nonce: authorization.nonce,
        },
        signature,
      });

      if (!valid) {
        return { valid: false, reason: 'Invalid signature — signer does not match from address' };
      }

      logger.info(`Payment verified: ${authorization.from} → ${authorization.to} (${authorization.value} on chain ${chainId})`);
      return { valid: true, signer: authorization.from };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown verification error';
      return { valid: false, reason: message };
    }
  }
}

/**
 * Standalone verify function (legacy API).
 * Verifies signature + timing + on-chain balance but NOT against requirements.
 */
export async function verifyPayment(payment: X402Payment): Promise<VerifyResult> {
  const { chainId, token, authorization, signature } = payment;

  try {
    getChainConfig(chainId);
  } catch {
    return { valid: false, reason: `Unsupported chain: ${chainId}` };
  }

  const tokenConfig = getTokenConfig(chainId, token);
  if (!tokenConfig) {
    return { valid: false, reason: `Unsupported token ${token} on chain ${chainId}` };
  }

  const now = BigInt(Math.floor(Date.now() / 1000));
  if (authorization.validAfter > now) {
    return { valid: false, reason: 'Authorization not yet valid' };
  }
  if (authorization.validBefore <= now) {
    return { valid: false, reason: 'Authorization has expired' };
  }
  if (authorization.value <= 0n) {
    return { valid: false, reason: 'Value must be positive' };
  }

  try {
    const domain = getTokenDomain(token, chainId);
    const valid = await verifyTypedData({
      address: authorization.from,
      domain,
      types: TRANSFER_WITH_AUTHORIZATION_TYPES,
      primaryType: 'TransferWithAuthorization',
      message: {
        from: authorization.from,
        to: authorization.to,
        value: authorization.value,
        validAfter: authorization.validAfter,
        validBefore: authorization.validBefore,
        nonce: authorization.nonce,
      },
      signature,
    });

    if (!valid) {
      return { valid: false, reason: 'Invalid signature — signer does not match from address' };
    }

    const client = getClient(chainId);
    const balance = await client.readContract({
      address: token,
      abi: [{ inputs: [{ name: 'account', type: 'address' }], name: 'balanceOf', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' }],
      functionName: 'balanceOf',
      args: [authorization.from],
    }) as bigint;

    if (balance < authorization.value) {
      return { valid: false, reason: 'Insufficient token balance', signer: authorization.from };
    }

    logger.info(`Payment verified: ${authorization.from} → ${authorization.to} (${authorization.value} on chain ${chainId})`);
    return { valid: true, signer: authorization.from };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown verification error';
    logger.error(`Verification failed: ${message}`);
    return { valid: false, reason: message };
  }
}
