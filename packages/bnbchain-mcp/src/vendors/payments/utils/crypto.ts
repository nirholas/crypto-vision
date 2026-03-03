/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// HMAC validation utilities for webhook signature verification

import { createHmac, timingSafeEqual } from 'node:crypto';
import { getLogger } from './logger.js';

const logger = getLogger();

export interface WebhookValidationResult {
  isValid: boolean;
  error?: string;
}

export class CryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CryptoError';
  }
}

/**
 * Validates webhook HMAC signature using timing-safe comparison
 * Formula: hex(hmac_sha256(device_secret, nonce + raw_body))
 *
 * @param deviceSecret - The device secret key
 * @param nonce - The nonce from X-NONCE header
 * @param rawBody - The raw webhook body
 * @param receivedSignature - The signature from X-SIGNATURE header
 */
export function validateWebhookSignature(
  deviceSecret: string,
  nonce: string,
  rawBody: string,
  receivedSignature: string
): WebhookValidationResult {
  try {
    // Input validation
    if (!deviceSecret || !nonce || !receivedSignature) {
      return {
        isValid: false,
        error: 'Missing required parameters for HMAC validation',
      };
    }

    // Normalize signature (remove potential 'hex:' prefix or other formatting)
    const normalizedSignature = receivedSignature
      .toLowerCase()
      .replace(/^hex:/, '');

    // Create HMAC using device secret (convert hex string to bytes)
    // Formula from Bitnovo backend: hex(hmac_sha256(bytes.fromhex(secret_key), nonce + body))
    const secretKeyBytes = Buffer.from(deviceSecret, 'hex');
    const hmac = createHmac('sha256', secretKeyBytes);
    hmac.update(nonce + rawBody, 'utf8');
    const calculatedSignature = hmac.digest('hex');

    logger.debug('HMAC validation', {
      nonceLength: nonce.length,
      bodyLength: rawBody.length,
      receivedSigLength: normalizedSignature.length,
      calculatedSigLength: calculatedSignature.length,
    });

    // Timing-safe comparison to prevent timing attacks
    if (normalizedSignature.length !== calculatedSignature.length) {
      return {
        isValid: false,
        error: 'Signature length mismatch',
      };
    }

    const receivedBuffer = Buffer.from(normalizedSignature, 'hex');
    const calculatedBuffer = Buffer.from(calculatedSignature, 'hex');

    if (receivedBuffer.length !== calculatedBuffer.length) {
      return {
        isValid: false,
        error: 'Invalid signature format',
      };
    }

    const isValid = timingSafeEqual(receivedBuffer, calculatedBuffer);

    if (!isValid) {
      logger.warn('HMAC signature validation failed', {
        nonce: nonce.slice(0, 8) + '...',
        operation: 'webhook_validation',
      });
    }

    return { isValid };
  } catch (error) {
    logger.error(
      'HMAC validation error',
      error instanceof Error ? error : new Error(String(error)),
      {
        operation: 'hmac_validation',
      }
    );

    return {
      isValid: false,
      error: 'HMAC validation failed due to internal error',
    };
  }
}

/**
 * Generates a secure random nonce for testing purposes
 */
export function generateNonce(length = 32): string {
  const crypto = require('node:crypto');
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Creates HMAC signature for testing purposes
 */
export function createTestSignature(
  deviceSecret: string,
  nonce: string,
  body: string
): string {
  const hmac = createHmac('sha256', deviceSecret);
  hmac.update(nonce + body, 'utf8');
  return hmac.digest('hex');
}

/**
 * Validates nonce format and freshness
 * Prevents replay attacks by ensuring nonces are unique within a timeframe
 */
export function validateNonce(
  nonce: string,
  maxAge = 5 * 60 * 1000, // 5 minutes default
  seenNonces = new Set<string>()
): { isValid: boolean; error?: string } {
  // Basic format validation
  if (!nonce || nonce.length < 16) {
    return {
      isValid: false,
      error: 'Nonce too short or missing',
    };
  }

  if (!/^[a-f0-9]+$/i.test(nonce)) {
    return {
      isValid: false,
      error: 'Invalid nonce format',
    };
  }

  // Check for replay attacks
  if (seenNonces.has(nonce)) {
    return {
      isValid: false,
      error: 'Nonce already used (replay attack)',
    };
  }

  // Add to seen nonces (caller should manage cleanup)
  seenNonces.add(nonce);

  return { isValid: true };
}

/**
 * Simple nonce cache for replay attack prevention
 * In production, consider using Redis or similar for distributed systems
 */
export class NonceCache {
  private cache = new Map<string, number>();
  private readonly maxAge: number;

  constructor(maxAge = 5 * 60 * 1000) {
    // 5 minutes
    this.maxAge = maxAge;
  }

  add(nonce: string): boolean {
    this.cleanup();

    if (this.cache.has(nonce)) {
      return false; // Already exists
    }

    this.cache.set(nonce, Date.now());
    return true;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [nonce, timestamp] of this.cache.entries()) {
      if (now - timestamp > this.maxAge) {
        this.cache.delete(nonce);
      }
    }
  }

  size(): number {
    this.cleanup();
    return this.cache.size;
  }

  clear(): void {
    this.cache.clear();
  }
}

// Global nonce cache instance for webhook validation
let globalNonceCache: NonceCache | null = null;

export function getNonceCache(): NonceCache {
  if (!globalNonceCache) {
    globalNonceCache = new NonceCache();
  }
  return globalNonceCache;
}

export function resetNonceCache(): void {
  globalNonceCache = null;
}
