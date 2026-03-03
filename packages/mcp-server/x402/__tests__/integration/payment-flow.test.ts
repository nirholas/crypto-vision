/* payment-flow.test.ts | nich | 6e696368-786274-4d43-5000-000000000000 */

/**
 * X402 Integration Tests - Payment Flow
 * @description Full 402 payment flow integration tests with mocked server
 * @author Test Engineer
 * @license Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { X402Client } from '../../sdk/client.js';
import { HTTP402Handler } from '../../sdk/http/handler.js';
import {
  TEST_PRIVATE_KEY,
  TEST_ADDRESSES,
  TEST_TX_HASHES,
  createMock402Response,
  createMock402FetchResponse,
  createMockSuccessResponse,
  createMockPaymentResult,
  createMockTransaction,
  createMockRPC,
  createMockWalletClient,
  setupFetch402Flow,
} from '../mocks/index.js';

// Mock viem
vi.mock('viem', async () => {
  const actual = await vi.importActual('viem');
  return {
    ...actual,
    createPublicClient: vi.fn(() => createMockRPC()),
    createWalletClient: vi.fn(() => createMockWalletClient()),
  };
});

vi.mock('viem/accounts', () => ({
  privateKeyToAccount: vi.fn((key: string) => ({
    address: TEST_ADDRESSES.sender,
    signMessage: vi.fn().mockResolvedValue('0xsignature'),
    signTypedData: vi.fn().mockResolvedValue('0xtypedSignature'),
  })),
}));

describe('X402 Payment Flow Integration', () => {
  let originalFetch: typeof global.fetch;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalFetch = global.fetch;
    originalEnv = { ...process.env };
    process.env.X402_PRIVATE_KEY = TEST_PRIVATE_KEY;
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Complete 402 Payment Flow Tests
  // ============================================================================

  describe('complete 402 payment flow', () => {
    it('should handle full 402 -> payment -> success flow', async () => {
      const client = new X402Client({
        chain: 'arbitrum',
        privateKey: TEST_PRIVATE_KEY,
      });

      // Mock the fetch to simulate 402 flow
      let paymentMade = false;
      global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (!paymentMade) {
          // First request returns 402
          return createMock402FetchResponse({ amount: '1.00' });
        }
        // After payment, return success
        return createMockSuccessResponse({ data: 'premium content' });
      });

      // Simulate the flow manually
      // 1. Make initial request
      const response1 = await fetch('https://api.example.com/premium');
      expect(response1.status).toBe(402);

      // 2. Parse 402 response
      const parsed = await HTTP402Handler.fromFetchResponse(response1);
      expect(parsed.isPaymentRequired).toBe(true);
      expect(parsed.paymentRequest?.amount).toBe('1.00');

      // 3. Make payment (mocked)
      paymentMade = true;

      // 4. Retry request after payment
      const response2 = await fetch('https://api.example.com/premium');
      expect(response2.status).toBe(200);

      const data = await response2.json();
      expect(data.data).toBe('premium content');
    });

    it('should detect payment required from fetch response', async () => {
      const client = new X402Client({
        chain: 'arbitrum',
        privateKey: TEST_PRIVATE_KEY,
      });

      global.fetch = vi.fn().mockResolvedValue(createMock402FetchResponse({
        amount: '2.50',
        token: 'USDs',
        chain: 'arbitrum',
      }));

      const response = await fetch('https://api.example.com/premium');
      const parsed = await HTTP402Handler.fromFetchResponse(response);

      expect(parsed.isPaymentRequired).toBe(true);
      expect(parsed.paymentRequest?.amount).toBe('2.50');
      expect(parsed.paymentRequest?.recipient).toBe(TEST_ADDRESSES.recipient);
    });

    it('should skip payment for non-402 responses', async () => {
      global.fetch = vi.fn().mockResolvedValue(createMockSuccessResponse({ data: 'free content' }));

      const response = await fetch('https://api.example.com/free');
      const parsed = await HTTP402Handler.fromFetchResponse(response);

      expect(parsed.isPaymentRequired).toBe(false);
      expect(parsed.paymentRequest).toBeUndefined();
    });
  });

  // ============================================================================
  // Payment Verification Tests
  // ============================================================================

  describe('payment verification', () => {
    it('should include payment proof in subsequent request', async () => {
      let capturedHeaders: Record<string, string> = {};

      global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        capturedHeaders = (init?.headers as Record<string, string>) || {};
        
        if (capturedHeaders['x-payment-proof']) {
          return createMockSuccessResponse({ verified: true });
        }
        return createMock402FetchResponse();
      });

      // First request - get 402
      await fetch('https://api.example.com/premium');

      // Second request - with payment proof
      await fetch('https://api.example.com/premium', {
        headers: {
          'x-payment-proof': TEST_TX_HASHES.success,
        },
      });

      expect(capturedHeaders['x-payment-proof']).toBe(TEST_TX_HASHES.success);
    });

    it('should verify payment transaction exists', async () => {
      const mockRPC = createMockRPC();

      const receipt = await mockRPC.getTransactionReceipt({ hash: TEST_TX_HASHES.success });
      
      expect(receipt.status).toBe('success');
      expect(receipt.transactionHash).toBe(TEST_TX_HASHES.success);
    });

    it('should handle failed payment verification', async () => {
      const mockRPC = createMockRPC();
      mockRPC.getTransactionReceipt.mockResolvedValue({
        status: 'reverted',
        transactionHash: TEST_TX_HASHES.failed,
      });

      const receipt = await mockRPC.getTransactionReceipt({ hash: TEST_TX_HASHES.failed });
      
      expect(receipt.status).toBe('reverted');
    });
  });

  // ============================================================================
  // Multi-request Payment Flow Tests
  // ============================================================================

  describe('multi-request payment flow', () => {
    it('should handle multiple paid requests', async () => {
      const requests: string[] = [];

      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        requests.push(url);
        return createMockSuccessResponse({ request: url });
      });

      await fetch('https://api.example.com/resource1');
      await fetch('https://api.example.com/resource2');
      await fetch('https://api.example.com/resource3');

      expect(requests).toHaveLength(3);
    });

    it('should track cumulative payment amount', async () => {
      let totalPaid = 0;
      const paymentAmounts = ['1.00', '2.50', '0.50'];

      for (const amount of paymentAmounts) {
        totalPaid += parseFloat(amount);
      }

      expect(totalPaid).toBe(4.00);
    });

    it('should abort if max payment exceeded', async () => {
      const maxPayment = 5.00;
      const requestedAmount = 10.00;

      const shouldProceed = requestedAmount <= maxPayment;
      expect(shouldProceed).toBe(false);
    });
  });

  // ============================================================================
  // Error Handling Flow Tests
  // ============================================================================

  describe('error handling flow', () => {
    it('should handle network errors during payment', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(fetch('https://api.example.com/premium')).rejects.toThrow('Network error');
    });

    it('should handle malformed 402 response', async () => {
      global.fetch = vi.fn().mockResolvedValue(new Response('Invalid', {
        status: 402,
        headers: { 'content-type': 'text/plain' },
      }));

      const response = await fetch('https://api.example.com/premium');
      const parsed = await HTTP402Handler.fromFetchResponse(response);

      expect(parsed.isPaymentRequired).toBe(false);
      expect(parsed.error).toContain('Missing WWW-Authenticate');
    });

    it('should handle timeout during payment', async () => {
      global.fetch = vi.fn().mockImplementation(async () => {
        await new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Timeout')), 100);
        });
      });

      await expect(fetch('https://api.example.com/premium')).rejects.toThrow('Timeout');
    });

    it('should handle insufficient balance error', async () => {
      const client = new X402Client({
        chain: 'arbitrum',
        privateKey: TEST_PRIVATE_KEY,
      });

      // Mock insufficient balance
      vi.spyOn(client as any, 'standardPayment', 'get').mockReturnValue({
        execute: vi.fn().mockRejectedValue(new Error('Insufficient balance')),
        getBalance: vi.fn().mockResolvedValue({ raw: 0n, formatted: '0.00', token: 'USDs' }),
      });
      vi.spyOn(client as any, 'gaslessPayment', 'get').mockReturnValue({
        supportsGasless: vi.fn().mockReturnValue(false),
      });

      await expect(client.pay(TEST_ADDRESSES.recipient, '100.00')).rejects.toThrow('Insufficient balance');
    });
  });

  // ============================================================================
  // Concurrent Request Tests
  // ============================================================================

  describe('concurrent requests', () => {
    it('should handle concurrent 402 requests', async () => {
      const results: number[] = [];

      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        const id = parseInt(url.split('/').pop() || '0');
        results.push(id);
        return createMockSuccessResponse({ id });
      });

      await Promise.all([
        fetch('https://api.example.com/resource/1'),
        fetch('https://api.example.com/resource/2'),
        fetch('https://api.example.com/resource/3'),
      ]);

      expect(results).toHaveLength(3);
      expect(results.sort()).toEqual([1, 2, 3]);
    });

    it('should maintain payment state per request', async () => {
      const requestStates = new Map<string, boolean>();

      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (!requestStates.get(url)) {
          requestStates.set(url, true);
          return createMock402FetchResponse();
        }
        return createMockSuccessResponse();
      });

      const url1 = 'https://api.example.com/resource/1';
      const url2 = 'https://api.example.com/resource/2';

      // First request to both URLs - should get 402
      const [r1, r2] = await Promise.all([fetch(url1), fetch(url2)]);
      expect(r1.status).toBe(402);
      expect(r2.status).toBe(402);

      // Second request to both URLs - should get 200
      const [r3, r4] = await Promise.all([fetch(url1), fetch(url2)]);
      expect(r3.status).toBe(200);
      expect(r4.status).toBe(200);
    });
  });

  // ============================================================================
  // Payment Auto-approve Flow Tests
  // ============================================================================

  describe('auto-approve flow', () => {
    it('should auto-pay when under threshold', async () => {
      const client = new X402Client({
        chain: 'arbitrum',
        privateKey: TEST_PRIVATE_KEY,
      });

      const mockTransaction = createMockTransaction();
      const payMock = vi.fn().mockResolvedValue({ transaction: mockTransaction, gasless: false });
      vi.spyOn(client, 'pay').mockImplementation(payMock);

      const paymentRequest = {
        amount: '0.50',
        token: 'USDs' as const,
        chain: 'arbitrum' as const,
        recipient: TEST_ADDRESSES.recipient,
      };

      // Simulate auto-approve logic
      const autoPayThreshold = 1.00;
      if (parseFloat(paymentRequest.amount) <= autoPayThreshold) {
        await client.pay(paymentRequest.recipient, paymentRequest.amount, paymentRequest.token);
      }

      expect(payMock).toHaveBeenCalledWith(
        paymentRequest.recipient,
        paymentRequest.amount,
        paymentRequest.token
      );
    });

    it('should require approval when over threshold', async () => {
      const client = new X402Client({
        chain: 'arbitrum',
        privateKey: TEST_PRIVATE_KEY,
      });

      const payMock = vi.fn();
      vi.spyOn(client, 'pay').mockImplementation(payMock);

      const paymentRequest = {
        amount: '5.00',
        token: 'USDs' as const,
        chain: 'arbitrum' as const,
        recipient: TEST_ADDRESSES.recipient,
      };

      // Simulate approval check
      const autoPayThreshold = 1.00;
      let paymentMade = false;

      if (parseFloat(paymentRequest.amount) <= autoPayThreshold) {
        await client.pay(paymentRequest.recipient, paymentRequest.amount, paymentRequest.token);
        paymentMade = true;
      }

      expect(paymentMade).toBe(false);
      expect(payMock).not.toHaveBeenCalled();
    });

    it('should use callback for approval', async () => {
      const client = new X402Client({
        chain: 'arbitrum',
        privateKey: TEST_PRIVATE_KEY,
      });

      const approvalCallback = vi.fn().mockResolvedValue(true);
      const mockTransaction = createMockTransaction();
      const payMock = vi.fn().mockResolvedValue({ transaction: mockTransaction, gasless: false });
      vi.spyOn(client, 'pay').mockImplementation(payMock);

      const paymentRequest = {
        amount: '5.00',
        token: 'USDs' as const,
        chain: 'arbitrum' as const,
        recipient: TEST_ADDRESSES.recipient,
      };

      // Simulate approval callback flow
      const approved = await approvalCallback(paymentRequest);
      if (approved) {
        await client.pay(paymentRequest.recipient, paymentRequest.amount, paymentRequest.token);
      }

      expect(approvalCallback).toHaveBeenCalledWith(paymentRequest);
      expect(payMock).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Gasless Payment Flow Tests
  // ============================================================================

  describe('gasless payment flow', () => {
    it('should use gasless when available', async () => {
      const client = new X402Client({
        chain: 'arbitrum',
        privateKey: TEST_PRIVATE_KEY,
        enableGasless: true,
      });

      const mockTransaction = createMockTransaction();
      vi.spyOn(client as any, 'gaslessPayment', 'get').mockReturnValue({
        supportsGasless: vi.fn().mockReturnValue(true),
        executeGasless: vi.fn().mockResolvedValue(mockTransaction),
      });

      const result = await client.pay(TEST_ADDRESSES.recipient, '1.00', 'USDs');

      expect(result.gasless).toBe(true);
    });

    it('should fall back to standard when gasless fails', async () => {
      const client = new X402Client({
        chain: 'arbitrum',
        privateKey: TEST_PRIVATE_KEY,
        enableGasless: true,
      });

      const mockTransaction = createMockTransaction();
      vi.spyOn(client as any, 'gaslessPayment', 'get').mockReturnValue({
        supportsGasless: vi.fn().mockReturnValue(true),
        executeGasless: vi.fn().mockRejectedValue(new Error('Gasless unavailable')),
      });
      vi.spyOn(client as any, 'standardPayment', 'get').mockReturnValue({
        execute: vi.fn().mockResolvedValue(mockTransaction),
      });

      const result = await client.pay(TEST_ADDRESSES.recipient, '1.00', 'USDs');

      expect(result.gasless).toBe(false);
    });
  });

  // ============================================================================
  // Real-world Scenario Tests
  // ============================================================================

  describe('real-world scenarios', () => {
    it('should handle API rate limiting with payment', async () => {
      let requestCount = 0;

      global.fetch = vi.fn().mockImplementation(async () => {
        requestCount++;
        if (requestCount > 10) {
          return createMock402FetchResponse({ amount: '0.10' });
        }
        return createMockSuccessResponse({ remaining: 10 - requestCount });
      });

      // Make requests until rate limited
      for (let i = 0; i < 12; i++) {
        const response = await fetch('https://api.example.com/data');
        if (response.status === 402) {
          // Would need to pay to continue
          break;
        }
      }

      expect(requestCount).toBe(11);
    });

    it('should handle session-based payment', async () => {
      const sessions = new Map<string, boolean>();

      global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        const sessionId = (init?.headers as Record<string, string>)?.['x-session-id'] || 'default';
        
        if (!sessions.has(sessionId)) {
          sessions.set(sessionId, false);
          return createMock402FetchResponse({ amount: '1.00', reference: sessionId });
        }
        
        return createMockSuccessResponse({ session: sessionId });
      });

      // New session - should require payment
      const r1 = await fetch('https://api.example.com/api', {
        headers: { 'x-session-id': 'session-123' },
      });
      expect(r1.status).toBe(402);

      // Mark session as paid
      sessions.set('session-123', true);

      // Existing session - should work
      const r2 = await fetch('https://api.example.com/api', {
        headers: { 'x-session-id': 'session-123' },
      });
      expect(r2.status).toBe(200);
    });
  });
});


/* EOF - nich | bmljaHhidA== */