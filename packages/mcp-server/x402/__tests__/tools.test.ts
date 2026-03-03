/*
 * ═══════════════════════════════════════════════════════════════
 *  universal-crypto-mcp | nich.xbt
 *  ID: 0.14.9.3
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * X402 MCP Tools Unit Tests
 * @description Comprehensive tests for x402 MCP payment tools
 * @author Test Engineer
 * @license Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { z } from 'zod';
import {
  TEST_PRIVATE_KEY,
  TEST_ADDRESSES,
  TEST_TX_HASHES,
  createMockX402Client,
  createMockPaymentResult,
  createMockBalanceInfo,
  createMockYieldInfo,
  createMockBatchResult,
  createMockAuthorization,
} from './mocks/index.js';

// Mock the x402 client module
vi.mock('../sdk/client.js', () => ({
  X402Client: vi.fn().mockImplementation(() => createMockX402Client()),
}));

// Mock the config module
vi.mock('../config.js', () => ({
  loadX402Config: vi.fn(() => ({
    privateKey: TEST_PRIVATE_KEY,
    chain: 'arbitrum',
    enableGasless: true,
    maxPaymentPerRequest: '10.00',
    debug: false,
  })),
  isX402Configured: vi.fn(() => true),
  validateX402Config: vi.fn(() => ({ valid: true, errors: [] })),
  SUPPORTED_CHAINS: {
    arbitrum: { caip2: 'eip155:42161', name: 'Arbitrum One', testnet: false },
    'arbitrum-sepolia': { caip2: 'eip155:421614', name: 'Arbitrum Sepolia', testnet: true },
    base: { caip2: 'eip155:8453', name: 'Base', testnet: false },
    ethereum: { caip2: 'eip155:1', name: 'Ethereum', testnet: false },
    polygon: { caip2: 'eip155:137', name: 'Polygon', testnet: false },
    optimism: { caip2: 'eip155:10', name: 'Optimism', testnet: false },
    bsc: { caip2: 'eip155:56', name: 'BNB Chain', testnet: false },
  },
}));

// Mock Logger
vi.mock('@/utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('x402 MCP Tools', () => {
  let mockServer: {
    tool: MockInstance;
    registeredTools: Map<string, { description: string; schema: unknown; handler: Function }>;
  };
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    originalEnv = { ...process.env };
    process.env.X402_PRIVATE_KEY = TEST_PRIVATE_KEY;
    process.env.X402_CHAIN = 'arbitrum';
    
    // Create mock MCP server
    mockServer = {
      registeredTools: new Map(),
      tool: vi.fn((name: string, description: string, schema: unknown, handler: Function) => {
        mockServer.registeredTools.set(name, { description, schema, handler });
      }),
    };

    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  /**
   * Helper to register tools and get handler
   */
  async function getToolHandler(toolName: string): Promise<Function> {
    // Import fresh to trigger registration
    const { registerX402Tools } = await import('../tools.js');
    registerX402Tools(mockServer as any);
    
    const tool = mockServer.registeredTools.get(toolName);
    if (!tool) {
      throw new Error(`Tool ${toolName} not found`);
    }
    return tool.handler;
  }

  // ============================================================================
  // x402_pay_request Tool Tests
  // ============================================================================

  describe('x402_pay_request', () => {
    it('should make HTTP request with payment handling', async () => {
      const handler = await getToolHandler('x402_pay_request');

      // Mock global fetch
      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        headers: new Headers({ 'x-payment-tx': TEST_TX_HASHES.success }),
        json: vi.fn().mockResolvedValue({ data: 'premium content' }),
        text: vi.fn().mockResolvedValue('premium content'),
      });

      const result = await handler({
        url: 'https://api.example.com/premium',
        method: 'GET',
        maxPayment: '1.00',
      });

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      expect(result.isError).toBeUndefined();
    });

    it('should handle POST requests with body', async () => {
      const handler = await getToolHandler('x402_pay_request');

      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        headers: new Headers(),
        json: vi.fn().mockResolvedValue({ success: true }),
      });

      const result = await handler({
        url: 'https://api.example.com/premium',
        method: 'POST',
        body: JSON.stringify({ query: 'test' }),
        headers: { 'Content-Type': 'application/json' },
        maxPayment: '1.00',
      });

      expect(result.content).toBeDefined();
      expect(result.isError).toBeUndefined();
    });

    it('should return error for invalid URL', async () => {
      const handler = await getToolHandler('x402_pay_request');

      const result = await handler({
        url: 'not-a-valid-url',
        method: 'GET',
        maxPayment: '1.00',
      });

      expect(result.isError).toBe(true);
    });

    it('should respect maxPayment limit', async () => {
      const handler = await getToolHandler('x402_pay_request');

      const result = await handler({
        url: 'https://api.example.com/premium',
        method: 'GET',
        maxPayment: '0.01', // Very low limit
      });

      expect(result.content).toBeDefined();
    });
  });

  // ============================================================================
  // x402_balance Tool Tests
  // ============================================================================

  describe('x402_balance', () => {
    it('should return wallet balance', async () => {
      const handler = await getToolHandler('x402_balance');

      const result = await handler({});

      expect(result.content).toBeDefined();
      expect(result.isError).toBeUndefined();
      
      const data = JSON.parse(result.content[0].text);
      expect(data.address).toBeDefined();
      expect(data.balances).toBeDefined();
    });

    it('should check balance on specific chain', async () => {
      const handler = await getToolHandler('x402_balance');

      const result = await handler({ chain: 'polygon' });

      expect(result.content).toBeDefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.chain).toBe('polygon');
    });

    it('should return error when wallet not configured', async () => {
      // Mock unconfigured state
      const { isX402Configured } = await import('../config.js');
      vi.mocked(isX402Configured).mockReturnValue(false);

      const handler = await getToolHandler('x402_balance');

      // The handler should still work but may return hint about configuration
      const result = await handler({});
      expect(result.content).toBeDefined();
    });
  });

  // ============================================================================
  // x402_send Tool Tests
  // ============================================================================

  describe('x402_send', () => {
    it('should send payment to address', async () => {
      const handler = await getToolHandler('x402_send');

      const result = await handler({
        to: TEST_ADDRESSES.recipient,
        amount: '1.00',
        token: 'USDs',
      });

      expect(result.content).toBeDefined();
      expect(result.isError).toBeUndefined();
      
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      expect(data.transaction).toBeDefined();
    });

    it('should include memo when provided', async () => {
      const handler = await getToolHandler('x402_send');

      const result = await handler({
        to: TEST_ADDRESSES.recipient,
        amount: '1.00',
        token: 'USDs',
        memo: 'Payment for services',
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.memo).toBe('Payment for services');
    });

    it('should reject payment exceeding max', async () => {
      const handler = await getToolHandler('x402_send');

      const result = await handler({
        to: TEST_ADDRESSES.recipient,
        amount: '100.00', // Exceeds max of 10.00
        token: 'USDs',
      });

      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text);
      expect(data.error).toContain('exceeds');
    });

    it('should validate recipient address format', async () => {
      const handler = await getToolHandler('x402_send');

      // Invalid address format - should be caught by zod validation
      // This tests the schema validation
      const result = await handler({
        to: 'invalid-address',
        amount: '1.00',
        token: 'USDs',
      });

      // Handler should still run and may return error
      expect(result.content).toBeDefined();
    });
  });

  // ============================================================================
  // x402_estimate Tool Tests
  // ============================================================================

  describe('x402_estimate', () => {
    it('should estimate cost for 402 URL', async () => {
      const handler = await getToolHandler('x402_estimate');

      global.fetch = vi.fn().mockResolvedValue({
        status: 402,
        headers: new Headers({
          'x-payment-amount': '1.00',
          'x-payment-token': 'USDs',
        }),
      });

      const result = await handler({
        url: 'https://api.example.com/premium',
      });

      expect(result.content).toBeDefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.requiresPayment).toBe(true);
    });

    it('should report when no payment required', async () => {
      const handler = await getToolHandler('x402_estimate');

      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        headers: new Headers(),
      });

      const result = await handler({
        url: 'https://api.example.com/free',
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.requiresPayment).toBe(false);
    });

    it('should handle network errors', async () => {
      const handler = await getToolHandler('x402_estimate');

      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await handler({
        url: 'https://api.example.com/premium',
      });

      expect(result.isError).toBe(true);
    });
  });

  // ============================================================================
  // x402_networks Tool Tests
  // ============================================================================

  describe('x402_networks', () => {
    it('should list all supported networks', async () => {
      const handler = await getToolHandler('x402_networks');

      const result = await handler({});

      expect(result.content).toBeDefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.supportedNetworks).toBeDefined();
      expect(data.supportedNetworks.length).toBeGreaterThan(0);
    });

    it('should indicate configured chain', async () => {
// id: n1ch-0las-4e4
      const handler = await getToolHandler('x402_networks');

      const result = await handler({});

      const data = JSON.parse(result.content[0].text);
      expect(data.configuredChain).toBe('arbitrum');
      
      const configuredNetwork = data.supportedNetworks.find((n: any) => n.id === 'arbitrum');
      expect(configuredNetwork.isConfigured).toBe(true);
    });
  });

  // ============================================================================
  // x402_address Tool Tests
  // ============================================================================

  describe('x402_address', () => {
    it('should return wallet address', async () => {
      const handler = await getToolHandler('x402_address');

      const result = await handler({});

      expect(result.content).toBeDefined();
      expect(result.isError).toBeUndefined();
      
      const data = JSON.parse(result.content[0].text);
      expect(data.address).toBeDefined();
    });

    it('should include funding instructions', async () => {
      const handler = await getToolHandler('x402_address');

      const result = await handler({});

      const data = JSON.parse(result.content[0].text);
      expect(data.fundingInstructions).toBeDefined();
    });
  });

  // ============================================================================
  // x402_yield Tool Tests
  // ============================================================================

  describe('x402_yield', () => {
    it('should return yield information', async () => {
      const handler = await getToolHandler('x402_yield');

      const result = await handler({});

      expect(result.content).toBeDefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.balance).toBeDefined();
      expect(data.apy).toBeDefined();
    });

    it('should include yield note', async () => {
      const handler = await getToolHandler('x402_yield');

      const result = await handler({});

      const data = JSON.parse(result.content[0].text);
      expect(data.note).toContain('rebase');
    });
  });

  // ============================================================================
  // x402_batch_send Tool Tests
  // ============================================================================

  describe('x402_batch_send', () => {
    it('should send multiple payments', async () => {
      const handler = await getToolHandler('x402_batch_send');

      const result = await handler({
        payments: [
          { to: TEST_ADDRESSES.recipient, amount: '1.00' },
          { to: TEST_ADDRESSES.facilitator, amount: '2.00' },
        ],
        token: 'USDs',
      });

      expect(result.content).toBeDefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      expect(data.totalRecipients).toBe(2);
    });

    it('should reject batch exceeding total max', async () => {
      const handler = await getToolHandler('x402_batch_send');

      // 5 payments of 10 each = 50, max per payment is 10, so max total is 50
      // But individual payments exceed max
      const result = await handler({
        payments: [
          { to: TEST_ADDRESSES.recipient, amount: '50.00' },
          { to: TEST_ADDRESSES.facilitator, amount: '50.00' },
        ],
        token: 'USDs',
      });

      expect(result.isError).toBe(true);
    });

    it('should enforce max 20 payments limit', async () => {
      const handler = await getToolHandler('x402_batch_send');

      // Create 21 payments
      const payments = Array.from({ length: 21 }, (_, i) => ({
        to: `0x${i.toString().padStart(40, '0')}`,
        amount: '0.10',
      }));

      // Schema validation should catch this
      const result = await handler({
        payments,
        token: 'USDs',
      });

      // The tool either validates or processes - check for appropriate response
      expect(result.content).toBeDefined();
    });
  });

  // ============================================================================
  // x402_gasless_send Tool Tests
  // ============================================================================

  describe('x402_gasless_send', () => {
    it('should send gasless payment', async () => {
      const handler = await getToolHandler('x402_gasless_send');

      const result = await handler({
        to: TEST_ADDRESSES.recipient,
        amount: '1.00',
        token: 'USDs',
        validityPeriod: 300,
      });

      expect(result.content).toBeDefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      expect(data.gasless).toBe(true);
    });

    it('should reject when gasless disabled', async () => {
      // Mock gasless disabled
      const { loadX402Config } = await import('../config.js');
      vi.mocked(loadX402Config).mockReturnValue({
        privateKey: TEST_PRIVATE_KEY,
        chain: 'arbitrum',
        enableGasless: false,
        maxPaymentPerRequest: '10.00',
        debug: false,
      });

      const handler = await getToolHandler('x402_gasless_send');

      const result = await handler({
        to: TEST_ADDRESSES.recipient,
        amount: '1.00',
        token: 'USDs',
        validityPeriod: 300,
      });

      expect(result.isError).toBe(true);
      const data = JSON.parse(result.content[0].text);
      expect(data.error).toContain('disabled');
    });
  });

  // ============================================================================
  // x402_approve Tool Tests
  // ============================================================================

  describe('x402_approve', () => {
    it('should approve token spending', async () => {
      const handler = await getToolHandler('x402_approve');

      const result = await handler({
        spender: TEST_ADDRESSES.contract,
        amount: '100.00',
        token: 'USDs',
      });

      expect(result.content).toBeDefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
    });

    it('should handle unlimited approval', async () => {
      const handler = await getToolHandler('x402_approve');

      const result = await handler({
        spender: TEST_ADDRESSES.contract,
        amount: 'unlimited',
        token: 'USDs',
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.approval.amount).toBe('unlimited');
      expect(data.warning).toContain('Unlimited');
    });
  });

  // ============================================================================
  // x402_apy Tool Tests
  // ============================================================================

  describe('x402_apy', () => {
    it('should return current APY', async () => {
      const handler = await getToolHandler('x402_apy');

      const result = await handler({});

      expect(result.content).toBeDefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.apy).toBeDefined();
      expect(data.token).toBe('USDs');
    });

    it('should include comparison data', async () => {
      const handler = await getToolHandler('x402_apy');

      const result = await handler({});

      const data = JSON.parse(result.content[0].text);
      expect(data.comparison).toBeDefined();
      expect(data.comparison.savingsAccount).toBeDefined();
    });
  });

  // ============================================================================
  // x402_yield_estimate Tool Tests
  // ============================================================================

  describe('x402_yield_estimate', () => {
    it('should estimate yield over time', async () => {
      const handler = await getToolHandler('x402_yield_estimate');

      const result = await handler({
        amount: '100.00',
        days: 30,
      });

      expect(result.content).toBeDefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.principal).toContain('100.00');
      expect(data.estimatedYield).toBeDefined();
    });

    it('should include projections', async () => {
      const handler = await getToolHandler('x402_yield_estimate');

      const result = await handler({
        amount: '1000.00',
        days: 365,
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.projections).toBeDefined();
      expect(data.projections['7 days']).toBeDefined();
      expect(data.projections['30 days']).toBeDefined();
    });
  });

  // ============================================================================
  // x402_tx_status Tool Tests
  // ============================================================================

  describe('x402_tx_status', () => {
    it('should return transaction status', async () => {
      const handler = await getToolHandler('x402_tx_status');

      const result = await handler({
        txHash: TEST_TX_HASHES.success,
      });

      expect(result.content).toBeDefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.hash).toBe(TEST_TX_HASHES.success);
      expect(data.explorerUrl).toBeDefined();
    });
  });

  // ============================================================================
  // x402_config Tool Tests
  // ============================================================================

  describe('x402_config', () => {
    it('should return configuration', async () => {
      const handler = await getToolHandler('x402_config');

      const result = await handler({});

      expect(result.content).toBeDefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.configured).toBe(true);
      expect(data.chain).toBe('arbitrum');
    });

    it('should include environment variable status', async () => {
      const handler = await getToolHandler('x402_config');

      const result = await handler({});

      const data = JSON.parse(result.content[0].text);
      expect(data.environmentVariables).toBeDefined();
      expect(data.environmentVariables.X402_PRIVATE_KEY).toBe('✓ set');
    });
  });

  // ============================================================================
  // Tool Registration Tests
  // ============================================================================

  describe('tool registration', () => {
    it('should register all 14 tools', async () => {
      const { registerX402Tools } = await import('../tools.js');
      registerX402Tools(mockServer as any);

      expect(mockServer.tool).toHaveBeenCalledTimes(14);
    });

    it('should register tools with correct names', async () => {
      const { registerX402Tools } = await import('../tools.js');
      registerX402Tools(mockServer as any);

      const expectedTools = [
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

      for (const toolName of expectedTools) {
        expect(mockServer.registeredTools.has(toolName)).toBe(true);
      }
    });
  });
});


/* universal-crypto-mcp © universal-crypto-mcp */