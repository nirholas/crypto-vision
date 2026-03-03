/**
 * @file index.ts
 * @author nichxbt
 * @copyright (c) 2026 nicholas
 * @license MIT
 * @repository universal-crypto-mcp
 * @version 14.9.3.8
 * @checksum bmljaHhidA==
 */

/**
 * X402 Test Suite Index
 * @description Entry point for x402 test suite - exports utilities and provides test documentation
 * @author Test Engineer
 * @license Apache-2.0
 */

// Re-export all mocks for external usage
export * from './mocks/index.js';

/**
 * X402 Test Suite Structure:
 * 
 * __tests__/
 * ├── mocks/
 * │   └── index.ts           - Mock utilities (402 responses, RPC, wallets, etc.)
 * │
 * ├── client.test.ts         - X402Client unit tests
 * │   - Initialization (EVM signer, read-only mode)
 * │   - Payment methods (pay, payBatch)
 * │   - Gasless payments (createAuthorization, settleGasless)
 * │   - Balance and yield tracking
 * │   - Error handling
 * │
 * ├── tools.test.ts          - MCP Tools unit tests
 * │   - All 14 x402 tools
 * │   - Happy path tests
 * │   - Error handling tests
 * │   - Tool registration
 * │
 * ├── chains.test.ts         - Multi-chain tests
 * │   - CAIP-2 parsing/generation
 * │   - Chain detection
 * │   - Network configuration
 * │   - Token configuration
 * │   - RPC connectivity (mocked)
 * │
 * ├── config.test.ts         - Configuration tests
 * │   - Environment variable loading
 * │   - Configuration validation
 * │   - Default values
 * │
 * ├── http-handler.test.ts   - HTTP 402 Handler tests
 * │   - Parsing 402 responses
 * │   - Creating 402 responses
 * │   - Round-trip tests
 * │   - Edge cases
 * │
 * ├── integration/
 * │   ├── payment-flow.test.ts - Full payment flow tests
 * │   │   - 402 -> payment -> success flow
 * │   │   - Payment verification
 * │   │   - Auto-approve flow
 * │   │   - Error handling
 * │   │
 * │   └── testnet.test.ts    - Testnet payment tests
 * │       - Arbitrum Sepolia simulation
 * │       - Cross-chain payments
 * │       - Real testnet tests (conditional)
 * │
 * └── e2e/
 *     └── mcp-server.test.ts - End-to-end MCP tests
 *         - Server initialization
 *         - Tool invocation
 *         - Client-server communication
 *         - Full payment flows
 *         - Error recovery
 *         - Performance
 *         - Security
 * 
 * 
 * Running Tests:
 * 
 *   # Run all x402 tests
 *   npm test -- --testPathPattern="x402"
 * 
 *   # Run specific test file
 *   npm test -- src/x402/__tests__/client.test.ts
 * 
 *   # Run with coverage
 *   npm test -- --coverage --testPathPattern="x402"
 * 
 *   # Run testnet tests (requires funding)
 *   TESTNET_ENABLED=true npm test -- --testPathPattern="testnet"
 * 
 * 
 * Coverage Goals:
 * 
 *   - Lines: 90%+
 *   - Functions: 90%+
 *   - Branches: 85%+
 *   - Statements: 90%+
 */

// Test patterns for use in CI
export const TEST_PATTERNS = {
  unit: 'src/x402/__tests__/*.test.ts',
  integration: 'src/x402/__tests__/integration/**/*.test.ts',
  e2e: 'src/x402/__tests__/e2e/**/*.test.ts',
  all: 'src/x402/__tests__/**/*.test.ts',
};

// Supported test environments
export const TEST_ENVIRONMENTS = {
  unit: {
    pattern: TEST_PATTERNS.unit,
    description: 'Unit tests for core x402 functionality',
    requiresNetwork: false,
    requiresEnv: false,
  },
  integration: {
    pattern: TEST_PATTERNS.integration,
    description: 'Integration tests for payment flows',
    requiresNetwork: false,
    requiresEnv: false,
  },
  e2e: {
    pattern: TEST_PATTERNS.e2e,
    description: 'End-to-end MCP server tests',
    requiresNetwork: false,
    requiresEnv: true,
  },
  testnet: {
    pattern: 'src/x402/__tests__/integration/testnet.test.ts',
    description: 'Real testnet payment tests',
    requiresNetwork: true,
    requiresEnv: true,
    envVars: ['TESTNET_ENABLED', 'TESTNET_PRIVATE_KEY'],
  },
};


/* EOF - universal-crypto-mcp | bmljaCBuaXJob2xhcw== */