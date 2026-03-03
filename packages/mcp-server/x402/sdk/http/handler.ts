/**
 * @fileoverview HTTP 402 Response Handler
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import type {
  HTTP402Response,
  HTTP402ParseResult,
  PaymentRequest,
  X402Token,
  X402Chain,
} from '../types';
import { X402Error, X402ErrorCode } from '../types';
import { X402_VERSION } from '../constants';

/**
 * HTTP 402 Payment Required response handler
 */
export class HTTP402Handler {
  /**
   * Parse a 402 response to extract payment details
   */
  static parse(response: HTTP402Response): HTTP402ParseResult {
    if (response.status !== 402) {
      return {
        isPaymentRequired: false,
        error: 'Response is not a 402 Payment Required',
      };
    }

    const authHeader = response.headers['www-authenticate'];
    if (!authHeader) {
      return {
        isPaymentRequired: false,
        error: 'Missing WWW-Authenticate header',
      };
    }

    if (!authHeader.startsWith('X402 ')) {
      return {
        isPaymentRequired: false,
        error: 'Invalid X402 authentication header format',
      };
    }

    try {
      const paymentRequest = this.parseAuthHeader(authHeader);
      return {
        isPaymentRequired: true,
        paymentRequest,
      };
    } catch (error) {
      return {
        isPaymentRequired: false,
        error: error instanceof Error ? error.message : 'Failed to parse payment request',
      };
    }
  }

  /**
   * Check if a fetch Response is a 402 payment required
   */
  static async fromFetchResponse(response: Response): Promise<HTTP402ParseResult> {
    if (response.status !== 402) {
      return { isPaymentRequired: false };
    }

    const authHeader = response.headers.get('www-authenticate');
    if (!authHeader) {
      return {
        isPaymentRequired: false,
        error: 'Missing WWW-Authenticate header',
      };
    }

    const http402: HTTP402Response = {
      status: 402,
      headers: {
        'www-authenticate': authHeader,
        'content-type': response.headers.get('content-type') ?? undefined,
        'x-payment-version': response.headers.get('x-payment-version') ?? undefined,
      },
      body: await response.json().catch(() => undefined),
    };

    return this.parse(http402);
  }

  /**
   * Create a 402 response for servers
   */
  static createResponse(
    request: PaymentRequest,
    message?: string
  ): {
    status: 402;
    headers: Record<string, string>;
    body: object;
  } {
    const authValue = this.buildAuthHeader(request);

    return {
      status: 402,
      headers: {
        'WWW-Authenticate': authValue,
        'Content-Type': 'application/json',
        'X-Payment-Version': String(X402_VERSION),
      },
      body: {
        error: 'Payment Required',
        message: message ?? `Payment of ${request.amount} ${request.token} required`,
        payment: {
          amount: request.amount,
          token: request.token,
          chain: request.chain,
          recipient: request.recipient,
          resource: request.resource,
          deadline: request.deadline,
        },
      },
    };
  }

  /**
   * Parse WWW-Authenticate header
   * Format: X402 price="10.00 USDs" chain="arbitrum" recipient="0x..." [resource="..."] [deadline="..."]
   */
  private static parseAuthHeader(header: string): PaymentRequest {
    const params: Record<string, string> = {};
    const regex = /(\w+)="([^"]+)"/g;
    let match;

    while ((match = regex.exec(header)) !== null) {
      params[match[1]!] = match[2]!;
    }

    // Parse price (format: "10.00 USDs")
    const priceMatch = params['price']?.match(/^([\d.]+)\s+(\w+)$/);
    if (!priceMatch) {
      throw new X402Error(
        'Invalid price format. Expected "amount token" (e.g., "10.00 USDs")',
        X402ErrorCode.INVALID_402_RESPONSE
      );
    }

    const [, amount, token] = priceMatch;

    // Validate required fields
    if (!params['chain']) {
      throw new X402Error('Missing chain in payment request', X402ErrorCode.INVALID_402_RESPONSE);
    }

    if (!params['recipient']) {
      throw new X402Error('Missing recipient in payment request', X402ErrorCode.INVALID_402_RESPONSE);
    }

    // Validate recipient address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(params['recipient'])) {
      throw new X402Error('Invalid recipient address format', X402ErrorCode.INVALID_402_RESPONSE);
    }

    return {
      amount: amount!,
      token: token as X402Token,
      chain: params['chain'] as X402Chain,
      recipient: params['recipient'] as `0x${string}`,
      reference: params['reference'],
      deadline: params['deadline'] ? parseInt(params['deadline'], 10) : undefined,
      resource: params['resource'],
      description: params['description'],
    };
  }

  /**
   * Build WWW-Authenticate header from payment request
   */
  private static buildAuthHeader(request: PaymentRequest): string {
    const parts = [
      `X402 price="${request.amount} ${request.token}"`,
      `chain="${request.chain}"`,
      `recipient="${request.recipient}"`,
    ];

    if (request.resource) {
      parts.push(`resource="${request.resource}"`);
    }

    if (request.deadline) {
      parts.push(`deadline="${request.deadline}"`);
    }

    if (request.reference) {
      parts.push(`reference="${request.reference}"`);
    }

    if (request.description) {
      parts.push(`description="${request.description}"`);
    }

    return parts.join(' ');
  }
}

/**
 * Utility function to wrap fetch with 402 handling
 */
export async function fetchWith402Handling(
  url: string | URL,
  options: RequestInit & {
    onPaymentRequired?: (request: PaymentRequest) => Promise<string | null>;
  } = {}
): Promise<Response> {
  const { onPaymentRequired, ...fetchOptions } = options;

  let response = await fetch(url, fetchOptions);

  if (response.status === 402 && onPaymentRequired) {
    const parseResult = await HTTP402Handler.fromFetchResponse(response);

    if (parseResult.isPaymentRequired && parseResult.paymentRequest) {
      // Call payment handler, get payment proof (transaction hash)
      const paymentProof = await onPaymentRequired(parseResult.paymentRequest);

      if (paymentProof) {
        // Retry request with payment proof
        response = await fetch(url, {
          ...fetchOptions,
          headers: {
            ...fetchOptions.headers,
            'X-Payment-Proof': paymentProof,
          },
        });
      }
    }
  }

  return response;
}
