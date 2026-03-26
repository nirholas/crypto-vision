import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/config/env.js', () => ({
  env: {
    FACILITATOR_PRIVATE_KEY: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    BASE_RPC_URL: 'https://base.example.com',
    BASE_SEPOLIA_RPC_URL: 'https://base-sepolia.example.com',
    ARBITRUM_RPC_URL: 'https://arb.example.com',
    ARBITRUM_SEPOLIA_RPC_URL: 'https://arb-sepolia.example.com',
    ETHEREUM_RPC_URL: 'https://eth.example.com',
    PORT: 3402,
    HOST: '0.0.0.0',
    RATE_LIMIT_MAX: 100,
    RATE_LIMIT_WINDOW_MS: 60_000,
    CORS_ORIGINS: '*',
    LOG_LEVEL: 'error',
  },
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../src/utils/metrics.js', () => ({
  metrics: {
    verifyRequests: { inc: vi.fn() },
    verifyLatency: { observe: vi.fn() },
    verifyErrors: { inc: vi.fn() },
    settleSuccess: { inc: vi.fn() },
    settleFailed: { inc: vi.fn() },
    settleRejected: { inc: vi.fn() },
    settleLatency: { observe: vi.fn() },
  },
}));

describe('Facilitator', () => {
  it('should export Facilitator class', async () => {
    const mod = await import('../../src/core/facilitator.js');
    expect(mod.Facilitator).toBeDefined();
    expect(typeof mod.Facilitator).toBe('function');
  });
});
