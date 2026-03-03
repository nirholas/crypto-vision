/**
 * Cryptographic Utilities
 *
 * Signing, verification, and hashing helpers.
 */

import { ethers } from 'ethers';

/**
 * Sign a message with a private key.
 */
export async function signMessage(
  privateKey: string,
  message: string
): Promise<string> {
  const wallet = new ethers.Wallet(privateKey);
  return wallet.signMessage(message);
}

/**
 * Verify a signed message and return the signer address.
 */
export function verifyMessage(
  message: string,
  signature: string
): string {
  return ethers.verifyMessage(message, signature);
}

/**
 * Sign typed data (EIP-712).
 */
export async function signTypedData(
  privateKey: string,
  domain: ethers.TypedDataDomain,
  types: Record<string, ethers.TypedDataField[]>,
  value: Record<string, unknown>
): Promise<string> {
  const wallet = new ethers.Wallet(privateKey);
  return wallet.signTypedData(domain, types, value);
}

/**
 * Verify EIP-712 typed data signature.
 */
export function verifyTypedData(
  domain: ethers.TypedDataDomain,
  types: Record<string, ethers.TypedDataField[]>,
  value: Record<string, unknown>,
  signature: string
): string {
  return ethers.verifyTypedData(domain, types, value, signature);
}

/**
 * Generate a random nonce (hex string).
 */
export function generateNonce(): string {
  return ethers.hexlify(ethers.randomBytes(32));
}

/**
 * Hash data using keccak256.
 */
export function keccak256(data: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(data));
}

/**
 * Compute address from private key.
 * If private key is empty/falsy, generates a random dev wallet.
 */
export function privateKeyToAddress(privateKey: string): string {
  if (!privateKey) {
    return ethers.Wallet.createRandom().address;
  }
  const wallet = new ethers.Wallet(privateKey);
  return wallet.address;
}

/**
 * Generate a random private key for dev mode.
 */
export function generateDevPrivateKey(): string {
  return ethers.Wallet.createRandom().privateKey;
}

/**
 * Sign an x402 payment header.
 */
export async function signPaymentHeader(
  privateKey: string,
  paymentData: {
    payer: string;
    payee: string;
    amount: string;
    token: string;
    chainId: number;
    nonce: string;
    expiry: number;
  }
): Promise<string> {
  const domain: ethers.TypedDataDomain = {
    name: 'x402Payment',
    version: '1',
    chainId: paymentData.chainId,
  };

  const types = {
    Payment: [
      { name: 'payer', type: 'address' },
      { name: 'payee', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'token', type: 'address' },
      { name: 'nonce', type: 'bytes32' },
      { name: 'expiry', type: 'uint256' },
    ],
  };

  return signTypedData(privateKey, domain, types, paymentData);
}

/**
 * Verify an x402 payment header signature.
 */
export function verifyPaymentHeader(
  paymentData: {
    payer: string;
    payee: string;
    amount: string;
    token: string;
    chainId: number;
    nonce: string;
    expiry: number;
  },
  signature: string
): string {
  const domain: ethers.TypedDataDomain = {
    name: 'x402Payment',
    version: '1',
    chainId: paymentData.chainId,
  };

  const types = {
    Payment: [
      { name: 'payer', type: 'address' },
      { name: 'payee', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'token', type: 'address' },
      { name: 'nonce', type: 'bytes32' },
      { name: 'expiry', type: 'uint256' },
    ],
  };

  return verifyTypedData(domain, types, paymentData, signature);
}
