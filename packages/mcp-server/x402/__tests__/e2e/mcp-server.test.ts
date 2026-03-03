/**
 * @file mcp-server.test.ts
 * @author nich.xbt
 * @copyright (c) 2026 nich.xbt
 * @license MIT
 * @repository universal-crypto-mcp
 * @version 0.4.14.3
 * @checksum 78738
 */

/**
 * X402 End-to-End Tests - MCP Server
 * @description End-to-end tests for x402 MCP server integration
 * @author Test Engineer
 * @license Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import {
  TEST_PRIVATE_KEY,
  TEST_ADDRESSES,
  TEST_TX_HASHES,
  createMockX402Client,
  createMockRPC,
  createMockWalletClient,
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

// Mock the client module
vi.mock('../../sdk/client.js', () => ({
  X402Client: vi.fn().mockImplementation(() => createMockX402Client()),
}));

describe('X402 MCP Server E2E', () => {
  let mockServer: {
    tool: ReturnType<typeof vi.fn>;
    registeredTools: Map<string, { description: string; schema: unknown; handler: Function }>;
    connect: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  };
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.X402_PRIVATE_KEY = TEST_PRIVATE_KEY;
    process.env.X402_CHAIN = 'arbitrum';

    // Create mock server that captures tool registrations
    mockServer = {
      registeredTools: new Map(),
      tool: vi.fn((name: string, description: string, schema: unknown, handler: Function) => {
        mockServer.registeredTools.set(name, { description, schema, handler });
      }),
      connect: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    };

    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Server Initialization Tests
  // ============================================================================

  describe('server initialization', () => {
    it('should start MCP server with x402 tools', async () => {
      const { registerX402Tools } = await import('../../tools.js');
      registerX402Tools(mockServer as any);

      expect(mockServer.tool).toHaveBeenCalled();
      expect(mockServer.registeredTools.size).toBe(14);
    });

    it('should register all required tools', async () => {
      const { registerX402Tools } = await import('../../tools.js');
      registerX402Tools(mockServer as any);

      const requiredTools = [
        'x402_pay_request',
        'x402_balance',
        'x402_send',
        'x402_estimate',
        'x402_networks',
        'x402_address',
        'x402_yield',
        'x402_batch_send',
        'x402_gasless_send',
        'x402_approve',
        'x402_apy',
        'x402_yield_estimate',
        'x402_tx_status',
        'x402_config',
      ];

      for (const tool of requiredTools) {
        expect(mockServer.registeredTools.has(tool)).toBe(true);
      }
    });

    it('should handle server start without private key', async () => {
      delete process.env.X402_PRIVATE_KEY;

      const { registerX402Tools } = await import('../../tools.js');
      
      // Should still register tools but some will fail when called
      expect(() => registerX402Tools(mockServer as any)).not.toThrow();
    });
  });

  // ============================================================================
  // Tool Invocation Tests
  // ============================================================================

  describe('tool invocation', () => {
    beforeEach(async () => {
      const { registerX402Tools } = await import('../../tools.js');
      registerX402Tools(mockServer as any);
    });

    it('should invoke x402_config tool', async () => {
      const tool = mockServer.registeredTools.get('x402_config');
      expect(tool).toBeDefined();

      const result = await tool!.handler({});

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      
      const data = JSON.parse(result.content[0].text);
      expect(data.chain).toBe('arbitrum');
    });

    it('should invoke x402_networks tool', async () => {
      const tool = mockServer.registeredTools.get('x402_networks');
      expect(tool).toBeDefined();

      const result = await tool!.handler({});

      expect(result.content).toBeDefined();
      
      const data = JSON.parse(result.content[0].text);
      expect(data.supportedNetworks).toBeDefined();
      expect(data.supportedNetworks.length).toBeGreaterThan(0);
    });

    it('should invoke x402_balance tool', async () => {
      const tool = mockServer.registeredTools.get('x402_balance');
      expect(tool).toBeDefined();

      const result = await tool!.handler({});

      expect(result.content).toBeDefined();
    });

    it('should invoke x402_address tool', async () => {
      const tool = mockServer.registeredTools.get('x402_address');
      expect(tool).toBeDefined();

      const result = await tool!.handler({});

      expect(result.content).toBeDefined();
      
      const data = JSON.parse(result.content[0].text);
      expect(data.address).toBeDefined();
    });

    it('should invoke x402_send tool with valid params', async () => {
      const tool = mockServer.registeredTools.get('x402_send');
      expect(tool).toBeDefined();

      const result = await tool!.handler({
        to: TEST_ADDRESSES.recipient,
        amount: '1.00',
        token: 'USDs',
      });

      expect(result.content).toBeDefined();
    });

    it('should handle tool errors gracefully', async () => {
      const tool = mockServer.registeredTools.get('x402_send');
      expect(tool).toBeDefined();

      // Invalid amount should be handled
      const result = await tool!.handler({
        to: TEST_ADDRESSES.recipient,
        amount: '100.00', // Exceeds max
        token: 'USDs',
      });

      expect(result.isError).toBe(true);
    });
  });

  // ============================================================================
  // Client-Server Communication Tests
  // ============================================================================

  describe('client-server communication (simulated)', () => {
    it('should simulate client requesting tool list', async () => {
      const { registerX402Tools } = await import('../../tools.js');
      registerX402Tools(mockServer as any);

      // Simulate client listing tools
      const toolNames = Array.from(mockServer.registeredTools.keys());

      expect(toolNames).toContain('x402_pay_request');
      expect(toolNames).toContain('x402_balance');
      expect(toolNames).toContain('x402_send');
    });

    it('should simulate client invoking tool', async () => {
      const { registerX402Tools } = await import('../../tools.js');
      registerX402Tools(mockServer as any);

      // Simulate client invoking a tool
      const tool = mockServer.registeredTools.get('x402_config');
      const response = await tool!.handler({});

      expect(response.content).toBeDefined();
      expect(response.content[0].type).toBe('text');
    });

    it('should simulate multiple sequential tool calls', async () => {
      const { registerX402Tools } = await import('../../tools.js');
      registerX402Tools(mockServer as any);

      // Call 1: Get config
      const configResult = await mockServer.registeredTools.get('x402_config')!.handler({});
      expect(configResult.content).toBeDefined();

      // Call 2: Get networks
      const networksResult = await mockServer.registeredTools.get('x402_networks')!.handler({});
      expect(networksResult.content).toBeDefined();

      // Call 3: Get address
      const addressResult = await mockServer.registeredTools.get('x402_address')!.handler({});
      expect(addressResult.content).toBeDefined();
    });

    it('should simulate concurrent tool calls', async () => {
      const { registerX402Tools } = await import('../../tools.js');
// @nichxbt
      registerX402Tools(mockServer as any);

      const results = await Promise.all([
        mockServer.registeredTools.get('x402_config')!.handler({}),
        mockServer.registeredTools.get('x402_networks')!.handler({}),
        mockServer.registeredTools.get('x402_apy')!.handler({}),
      ]);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.content).toBeDefined();
      });
    });
  });

  // ============================================================================
  // Full Payment Flow E2E Tests
  // ============================================================================

  describe('full payment flow E2E', () => {
    beforeEach(async () => {
      const { registerX402Tools } = await import('../../tools.js');
      registerX402Tools(mockServer as any);

      // Mock fetch for pay_request
      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        headers: new Headers({ 'x-payment-tx': TEST_TX_HASHES.success }),
        json: vi.fn().mockResolvedValue({ data: 'premium content' }),
        text: vi.fn().mockResolvedValue('premium content'),
      });
    });

    it('should complete full payment flow', async () => {
      // Step 1: Check balance
      const balanceTool = mockServer.registeredTools.get('x402_balance');
      const balanceResult = await balanceTool!.handler({});
      expect(balanceResult.content).toBeDefined();

      // Step 2: Estimate cost
      const estimateTool = mockServer.registeredTools.get('x402_estimate');
      const estimateResult = await estimateTool!.handler({
        url: 'https://api.example.com/premium',
      });
      expect(estimateResult.content).toBeDefined();

      // Step 3: Make paid request
      const payRequestTool = mockServer.registeredTools.get('x402_pay_request');
      const payResult = await payRequestTool!.handler({
        url: 'https://api.example.com/premium',
        method: 'GET',
        maxPayment: '1.00',
      });
      expect(payResult.content).toBeDefined();

      // Step 4: Check balance after
      const balanceAfterResult = await balanceTool!.handler({});
      expect(balanceAfterResult.content).toBeDefined();
    });

    it('should complete batch payment flow', async () => {
      // Step 1: Check balance
      const balanceTool = mockServer.registeredTools.get('x402_balance');
      await balanceTool!.handler({});

      // Step 2: Execute batch payment
      const batchTool = mockServer.registeredTools.get('x402_batch_send');
      const batchResult = await batchTool!.handler({
        payments: [
          { to: TEST_ADDRESSES.recipient, amount: '1.00' },
          { to: TEST_ADDRESSES.facilitator, amount: '2.00' },
        ],
        token: 'USDs',
      });

      expect(batchResult.content).toBeDefined();
    });

    it('should complete gasless payment flow', async () => {
      // Step 1: Check if gasless is supported
      const configTool = mockServer.registeredTools.get('x402_config');
      const configResult = await configTool!.handler({});
      const config = JSON.parse(configResult.content[0].text);
      expect(config.gaslessEnabled).toBe(true);

      // Step 2: Execute gasless payment
      const gaslessTool = mockServer.registeredTools.get('x402_gasless_send');
      const gaslessResult = await gaslessTool!.handler({
        to: TEST_ADDRESSES.recipient,
        amount: '1.00',
        token: 'USDs',
        validityPeriod: 300,
      });

      expect(gaslessResult.content).toBeDefined();
    });
  });

  // ============================================================================
  // Error Recovery Tests
  // ============================================================================

  describe('error recovery', () => {
    beforeEach(async () => {
      const { registerX402Tools } = await import('../../tools.js');
      registerX402Tools(mockServer as any);
    });

    it('should recover from network error', async () => {
      global.fetch = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          status: 200,
          json: vi.fn().mockResolvedValue({ data: 'success' }),
        });

      const payRequestTool = mockServer.registeredTools.get('x402_pay_request');
      
      // First call fails
      const result1 = await payRequestTool!.handler({
        url: 'https://api.example.com/premium',
        method: 'GET',
        maxPayment: '1.00',
      });
      expect(result1.isError).toBe(true);

      // Second call succeeds
      const result2 = await payRequestTool!.handler({
        url: 'https://api.example.com/premium',
        method: 'GET',
        maxPayment: '1.00',
      });
      expect(result2.isError).toBeUndefined();
    });

    it('should handle invalid input gracefully', async () => {
      const sendTool = mockServer.registeredTools.get('x402_send');

      // Various invalid inputs
      const invalidInputs = [
        { to: 'invalid-address', amount: '1.00', token: 'USDs' },
        { to: TEST_ADDRESSES.recipient, amount: 'invalid', token: 'USDs' },
        { to: TEST_ADDRESSES.recipient, amount: '-1.00', token: 'USDs' },
      ];

      for (const input of invalidInputs) {
        const result = await sendTool!.handler(input);
        // Should handle error, not crash
        expect(result.content).toBeDefined();
      }
    });

    it('should handle server restart simulation', async () => {
      // Clear registrations
      mockServer.registeredTools.clear();

      // Re-register tools (simulating restart)
      const { registerX402Tools } = await import('../../tools.js');
      registerX402Tools(mockServer as any);

      // Tools should work after restart
      const configTool = mockServer.registeredTools.get('x402_config');
      const result = await configTool!.handler({});
      expect(result.content).toBeDefined();
    });
  });

  // ============================================================================
  // Performance Tests
  // ============================================================================

  describe('performance', () => {
    beforeEach(async () => {
      const { registerX402Tools } = await import('../../tools.js');
      registerX402Tools(mockServer as any);
    });

    it('should handle rapid tool calls', async () => {
      const configTool = mockServer.registeredTools.get('x402_config');
      
      const start = Date.now();
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        await configTool!.handler({});
      }

      const duration = Date.now() - start;
      const avgTime = duration / iterations;

      expect(avgTime).toBeLessThan(100); // Less than 100ms per call
    });

    it('should handle parallel tool calls efficiently', async () => {
      const configTool = mockServer.registeredTools.get('x402_config');
      
      const start = Date.now();
      const promises = Array(50).fill(null).map(() => configTool!.handler({}));
      
      await Promise.all(promises);
      
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(5000); // All 50 calls under 5 seconds
    });
  });

  // ============================================================================
  // Security Tests
  // ============================================================================

  describe('security', () => {
    beforeEach(async () => {
      const { registerX402Tools } = await import('../../tools.js');
      registerX402Tools(mockServer as any);
    });

    it('should not expose private key in responses', async () => {
      const configTool = mockServer.registeredTools.get('x402_config');
      const result = await configTool!.handler({});
      
      const responseText = JSON.stringify(result);
      expect(responseText).not.toContain(TEST_PRIVATE_KEY);
      expect(responseText).not.toContain('privateKey');
    });

    it('should enforce max payment limit', async () => {
      const sendTool = mockServer.registeredTools.get('x402_send');
      
      const result = await sendTool!.handler({
        to: TEST_ADDRESSES.recipient,
        amount: '1000.00', // Way over limit
        token: 'USDs',
      });

      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text);
      expect(data.error).toContain('exceeds');
    });

    it('should validate address format', async () => {
      const sendTool = mockServer.registeredTools.get('x402_send');
      
      const result = await sendTool!.handler({
        to: 'malicious-address',
        amount: '1.00',
        token: 'USDs',
      });

      // Should either reject or handle safely
      expect(result.content).toBeDefined();
    });
  });
});


/* EOF - universal-crypto-mcp | 14.9.3.8 */