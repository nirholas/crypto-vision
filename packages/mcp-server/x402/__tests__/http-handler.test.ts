/**
 * @file http-handler.test.ts
 * @author universal-crypto-mcp
 * @copyright (c) 2026 nichxbt
 * @license MIT
 * @repository universal-crypto-mcp
 * @version 0.4.14.3
 * @checksum 0xN1CH
 */

/**
 * HTTP 402 Handler Unit Tests
 * @description Tests for HTTP 402 parsing and response creation
 * @author Test Engineer
 * @license Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HTTP402Handler } from '../sdk/http/handler.js';
import { X402Error, X402ErrorCode } from '../sdk/types.js';
import {
  TEST_ADDRESSES,
  createMock402Response,
  createMock402FetchResponse,
  createMockSuccessResponse,
} from './mocks/index.js';

describe('HTTP402Handler', () => {
  // ============================================================================
  // parse() Tests
  // ============================================================================

  describe('parse()', () => {
    it('should parse valid 402 response', () => {
      const response = createMock402Response();
      const result = HTTP402Handler.parse(response);

      expect(result.isPaymentRequired).toBe(true);
      expect(result.paymentRequest).toBeDefined();
      expect(result.paymentRequest?.amount).toBe('1.00');
      expect(result.paymentRequest?.token).toBe('USDs');
      expect(result.paymentRequest?.chain).toBe('arbitrum');
      expect(result.paymentRequest?.recipient).toBe(TEST_ADDRESSES.recipient);
    });

    it('should parse 402 with custom amount', () => {
      const response = createMock402Response({ amount: '5.50' });
      const result = HTTP402Handler.parse(response);

      expect(result.paymentRequest?.amount).toBe('5.50');
    });

    it('should parse 402 with different token', () => {
      const response = createMock402Response({ token: 'USDC' });
      const result = HTTP402Handler.parse(response);

      expect(result.paymentRequest?.token).toBe('USDC');
    });

    it('should parse 402 with different chain', () => {
      const response = createMock402Response({ chain: 'polygon' });
      const result = HTTP402Handler.parse(response);

      expect(result.paymentRequest?.chain).toBe('polygon');
    });

    it('should parse 402 with resource', () => {
      const response = createMock402Response({ resource: '/api/v1/premium' });
      const result = HTTP402Handler.parse(response);

      expect(result.paymentRequest?.resource).toBe('/api/v1/premium');
    });

    it('should parse 402 with deadline', () => {
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      const response = createMock402Response({ deadline });
      const result = HTTP402Handler.parse(response);

      expect(result.paymentRequest?.deadline).toBe(deadline);
    });

    it('should parse 402 with reference', () => {
      const response = createMock402Response({ reference: 'order-12345' });
      const result = HTTP402Handler.parse(response);

      expect(result.paymentRequest?.reference).toBe('order-12345');
    });

    it('should return not required for non-402 status', () => {
      const response = {
        status: 200 as const,
        headers: {
          'www-authenticate': 'X402 price="1.00 USDs"',
        },
      };

      // @ts-expect-error Testing invalid status
      const result = HTTP402Handler.parse(response);

      expect(result.isPaymentRequired).toBe(false);
      expect(result.error).toContain('not a 402');
    });

    it('should return error for missing WWW-Authenticate header', () => {
      const response = {
        status: 402 as const,
        headers: {} as any,
      };

      const result = HTTP402Handler.parse(response);

      expect(result.isPaymentRequired).toBe(false);
      expect(result.error).toContain('Missing WWW-Authenticate');
    });

    it('should return error for non-X402 authenticate header', () => {
      const response = {
        status: 402 as const,
        headers: {
          'www-authenticate': 'Basic realm="test"',
        },
      };

      const result = HTTP402Handler.parse(response);

      expect(result.isPaymentRequired).toBe(false);
      expect(result.error).toContain('Invalid X402');
    });

    it('should return error for invalid price format', () => {
      const response = {
        status: 402 as const,
        headers: {
          'www-authenticate': 'X402 price="invalid" chain="arbitrum" recipient="0x1234567890123456789012345678901234567890"',
        },
      };

      const result = HTTP402Handler.parse(response);

      expect(result.isPaymentRequired).toBe(false);
      expect(result.error).toContain('Invalid price format');
    });

    it('should return error for missing chain', () => {
      const response = {
        status: 402 as const,
        headers: {
          'www-authenticate': 'X402 price="1.00 USDs" recipient="0x1234567890123456789012345678901234567890"',
        },
      };

      const result = HTTP402Handler.parse(response);

      expect(result.isPaymentRequired).toBe(false);
      expect(result.error).toContain('Missing chain');
    });

    it('should return error for missing recipient', () => {
      const response = {
        status: 402 as const,
        headers: {
          'www-authenticate': 'X402 price="1.00 USDs" chain="arbitrum"',
        },
      };

      const result = HTTP402Handler.parse(response);

      expect(result.isPaymentRequired).toBe(false);
      expect(result.error).toContain('Missing recipient');
    });

    it('should return error for invalid recipient address', () => {
      const response = {
        status: 402 as const,
        headers: {
          'www-authenticate': 'X402 price="1.00 USDs" chain="arbitrum" recipient="invalid"',
        },
      };

      const result = HTTP402Handler.parse(response);

      expect(result.isPaymentRequired).toBe(false);
      expect(result.error).toContain('Invalid recipient');
    });
  });

  // ============================================================================
  // fromFetchResponse() Tests
  // ============================================================================

// [nich] implementation
  describe('fromFetchResponse()', () => {
    it('should parse fetch Response with 402 status', async () => {
      const response = createMock402FetchResponse();
      const result = await HTTP402Handler.fromFetchResponse(response);

      expect(result.isPaymentRequired).toBe(true);
      expect(result.paymentRequest).toBeDefined();
    });

    it('should return not required for non-402 fetch Response', async () => {
      const response = createMockSuccessResponse();
      const result = await HTTP402Handler.fromFetchResponse(response);

      expect(result.isPaymentRequired).toBe(false);
    });

    it('should handle fetch Response without WWW-Authenticate', async () => {
      const response = new Response('Payment Required', {
        status: 402,
        headers: {},
      });

      const result = await HTTP402Handler.fromFetchResponse(response);

      expect(result.isPaymentRequired).toBe(false);
      expect(result.error).toContain('Missing WWW-Authenticate');
    });

    it('should parse all fields from fetch Response', async () => {
      const response = createMock402FetchResponse({
        amount: '2.50',
        token: 'USDC',
        chain: 'polygon',
        resource: '/api/data',
      });

      const result = await HTTP402Handler.fromFetchResponse(response);

      expect(result.paymentRequest?.amount).toBe('2.50');
      expect(result.paymentRequest?.token).toBe('USDC');
      expect(result.paymentRequest?.chain).toBe('polygon');
      expect(result.paymentRequest?.resource).toBe('/api/data');
    });

    it('should handle Response with JSON body', async () => {
      const response = createMock402FetchResponse();
      const result = await HTTP402Handler.fromFetchResponse(response);

      expect(result.isPaymentRequired).toBe(true);
    });

    it('should handle Response with text body', async () => {
      const headers = new Headers();
      headers.set('www-authenticate', `X402 price="1.00 USDs" chain="arbitrum" recipient="${TEST_ADDRESSES.recipient}"`);
      headers.set('content-type', 'text/plain');

      const response = new Response('Payment Required', {
        status: 402,
        headers,
      });

      const result = await HTTP402Handler.fromFetchResponse(response);

      expect(result.isPaymentRequired).toBe(true);
    });
  });

  // ============================================================================
  // createResponse() Tests
  // ============================================================================

  describe('createResponse()', () => {
    it('should create valid 402 response', () => {
      const request = {
        amount: '1.00',
        token: 'USDs' as const,
        chain: 'arbitrum' as const,
        recipient: TEST_ADDRESSES.recipient,
      };

      const response = HTTP402Handler.createResponse(request);

      expect(response.status).toBe(402);
      expect(response.headers['WWW-Authenticate']).toBeDefined();
      expect(response.headers['Content-Type']).toBe('application/json');
      expect(response.headers['X-Payment-Version']).toBeDefined();
    });

    it('should include payment info in body', () => {
      const request = {
        amount: '5.00',
        token: 'USDs' as const,
        chain: 'arbitrum' as const,
        recipient: TEST_ADDRESSES.recipient,
      };

      const response = HTTP402Handler.createResponse(request);

      expect(response.body).toHaveProperty('error', 'Payment Required');
      expect(response.body).toHaveProperty('payment');
      expect((response.body as any).payment.amount).toBe('5.00');
    });

    it('should include custom message', () => {
      const request = {
        amount: '1.00',
        token: 'USDs' as const,
        chain: 'arbitrum' as const,
        recipient: TEST_ADDRESSES.recipient,
      };

      const response = HTTP402Handler.createResponse(request, 'Premium content requires payment');

      expect((response.body as any).message).toBe('Premium content requires payment');
    });

    it('should include resource in auth header', () => {
      const request = {
        amount: '1.00',
        token: 'USDs' as const,
        chain: 'arbitrum' as const,
        recipient: TEST_ADDRESSES.recipient,
        resource: '/api/premium',
      };

      const response = HTTP402Handler.createResponse(request);

      expect(response.headers['WWW-Authenticate']).toContain('resource="/api/premium"');
    });

    it('should include deadline in auth header', () => {
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      const request = {
        amount: '1.00',
        token: 'USDs' as const,
        chain: 'arbitrum' as const,
        recipient: TEST_ADDRESSES.recipient,
        deadline,
      };

      const response = HTTP402Handler.createResponse(request);

      expect(response.headers['WWW-Authenticate']).toContain(`deadline="${deadline}"`);
    });

    it('should include reference in auth header', () => {
      const request = {
        amount: '1.00',
        token: 'USDs' as const,
        chain: 'arbitrum' as const,
        recipient: TEST_ADDRESSES.recipient,
        reference: 'order-12345',
      };

      const response = HTTP402Handler.createResponse(request);

      expect(response.headers['WWW-Authenticate']).toContain('reference="order-12345"');
    });

    it('should format auth header correctly', () => {
      const request = {
        amount: '10.50',
        token: 'USDC' as const,
        chain: 'polygon' as const,
        recipient: TEST_ADDRESSES.recipient,
      };

      const response = HTTP402Handler.createResponse(request);
      const authHeader = response.headers['WWW-Authenticate'];

      expect(authHeader).toContain('X402 price="10.50 USDC"');
      expect(authHeader).toContain('chain="polygon"');
      expect(authHeader).toContain(`recipient="${TEST_ADDRESSES.recipient}"`);
    });
  });

  // ============================================================================
  // Round-trip Tests (Create -> Parse)
  // ============================================================================

  describe('round-trip (create -> parse)', () => {
    it('should create response that can be parsed back', () => {
      const originalRequest = {
        amount: '2.50',
        token: 'USDs' as const,
        chain: 'arbitrum' as const,
        recipient: TEST_ADDRESSES.recipient,
        resource: '/api/premium',
      };

      const created = HTTP402Handler.createResponse(originalRequest);
      
      const http402Response = {
        status: created.status,
        headers: {
          'www-authenticate': created.headers['WWW-Authenticate'],
          'content-type': created.headers['Content-Type'],
          'x-payment-version': created.headers['X-Payment-Version'],
        },
      };

      const parsed = HTTP402Handler.parse(http402Response);

      expect(parsed.isPaymentRequired).toBe(true);
      expect(parsed.paymentRequest?.amount).toBe(originalRequest.amount);
      expect(parsed.paymentRequest?.token).toBe(originalRequest.token);
      expect(parsed.paymentRequest?.chain).toBe(originalRequest.chain);
      expect(parsed.paymentRequest?.recipient).toBe(originalRequest.recipient);
      expect(parsed.paymentRequest?.resource).toBe(originalRequest.resource);
    });

    it('should preserve all optional fields in round-trip', () => {
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      const originalRequest = {
        amount: '1.00',
        token: 'USDs' as const,
        chain: 'arbitrum' as const,
        recipient: TEST_ADDRESSES.recipient,
        resource: '/api/v1/data',
        deadline,
        reference: 'ref-12345',
        description: 'Premium API access',
      };

      const created = HTTP402Handler.createResponse(originalRequest);
      
      const http402Response = {
        status: created.status,
        headers: {
          'www-authenticate': created.headers['WWW-Authenticate'],
        },
      };

      const parsed = HTTP402Handler.parse(http402Response);

      expect(parsed.paymentRequest?.resource).toBe(originalRequest.resource);
      expect(parsed.paymentRequest?.deadline).toBe(originalRequest.deadline);
      expect(parsed.paymentRequest?.reference).toBe(originalRequest.reference);
      expect(parsed.paymentRequest?.description).toBe(originalRequest.description);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    it('should handle amounts with many decimal places', () => {
      const response = createMock402Response({ amount: '0.123456789' });
      const result = HTTP402Handler.parse(response);

      expect(result.paymentRequest?.amount).toBe('0.123456789');
    });

    it('should handle very large amounts', () => {
      const response = createMock402Response({ amount: '1000000.00' });
      const result = HTTP402Handler.parse(response);

      expect(result.paymentRequest?.amount).toBe('1000000.00');
    });

    it('should handle special characters in resource', () => {
      const response = createMock402Response({ resource: '/api/v1/data?query=test&foo=bar' });
      const result = HTTP402Handler.parse(response);

      expect(result.paymentRequest?.resource).toBe('/api/v1/data?query=test&foo=bar');
    });

    it('should handle empty optional fields gracefully', () => {
      const response = {
        status: 402 as const,
        headers: {
          'www-authenticate': `X402 price="1.00 USDs" chain="arbitrum" recipient="${TEST_ADDRESSES.recipient}"`,
        },
      };

      const result = HTTP402Handler.parse(response);

      expect(result.isPaymentRequired).toBe(true);
      expect(result.paymentRequest?.resource).toBeUndefined();
      expect(result.paymentRequest?.deadline).toBeUndefined();
      expect(result.paymentRequest?.reference).toBeUndefined();
    });

    it('should handle different token symbols', () => {
      const tokens = ['USDs', 'USDC', 'USDT', 'DAI', 'ETH'];

      for (const token of tokens) {
        const response = createMock402Response({ token: token as any });
        const result = HTTP402Handler.parse(response);

        expect(result.paymentRequest?.token).toBe(token);
      }
    });

    it('should handle different address formats (checksummed)', () => {
      const addresses = [
        '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
        '0xD8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
      ];

      for (const address of addresses) {
        const response = createMock402Response({ recipient: address as any });
        const result = HTTP402Handler.parse(response);

        expect(result.isPaymentRequired).toBe(true);
        expect(result.paymentRequest?.recipient.toLowerCase()).toBe(address.toLowerCase());
      }
    });
  });

  // ============================================================================
  // Error Code Tests
  // ============================================================================

  describe('error codes', () => {
    it('should use INVALID_402_RESPONSE for invalid price format', () => {
      const response = {
        status: 402 as const,
        headers: {
          'www-authenticate': 'X402 price="invalid" chain="arbitrum" recipient="0x1234567890123456789012345678901234567890"',
        },
      };

      const result = HTTP402Handler.parse(response);

      expect(result.error).toContain('Invalid price format');
    });

    it('should use INVALID_402_RESPONSE for missing chain', () => {
      const response = {
        status: 402 as const,
        headers: {
          'www-authenticate': 'X402 price="1.00 USDs" recipient="0x1234567890123456789012345678901234567890"',
        },
      };

      const result = HTTP402Handler.parse(response);

      expect(result.error).toContain('chain');
    });

    it('should use INVALID_402_RESPONSE for missing recipient', () => {
      const response = {
        status: 402 as const,
        headers: {
          'www-authenticate': 'X402 price="1.00 USDs" chain="arbitrum"',
        },
      };

      const result = HTTP402Handler.parse(response);

      expect(result.error).toContain('recipient');
    });
  });
});


/* universal-crypto-mcp © nich.xbt */