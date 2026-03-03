/**
 * ERC8004Agent Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ERC8004Agent } from '../src/agent.js';

// Mock private key (DO NOT use in production)
const TEST_PRIVATE_KEY = '0x' + 'ab'.repeat(32);

describe('ERC8004Agent', () => {
  let agent: ERC8004Agent;

  beforeEach(() => {
    agent = new ERC8004Agent({
      name: 'Test Agent',
      description: 'A test agent',
      privateKey: TEST_PRIVATE_KEY,
      chain: 'bsc-testnet',
      capabilities: ['test', 'echo'],
      pricing: {
        'test/echo': { price: '0.001', token: 'USDC' },
      },
      trust: ['reputation'],
    });
  });

  describe('constructor', () => {
    it('should create an agent with correct config', () => {
      expect(agent.config.name).toBe('Test Agent');
      expect(agent.config.chain).toBe('bsc-testnet');
      expect(agent.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });

    it('should derive address from private key', () => {
      expect(agent.address).toBeTruthy();
      expect(agent.address.length).toBe(42);
    });

    it('should initialize without identity', () => {
      expect(agent.identity).toBeNull();
      expect(agent.agentId).toBeNull();
      expect(agent.agentCard).toBeNull();
    });

    it('should not be running initially', () => {
      expect(agent.isRunning).toBe(false);
    });
  });

  describe('onTask', () => {
    it('should register task handlers', () => {
      agent.onTask('test/echo', async (task) => ({
        status: 'completed',
        result: { echo: 'hello' },
      }));

      expect(agent.registeredSkills).toContain('test/echo');
    });

    it('should register default handler', () => {
      agent.onDefault(async () => ({
        status: 'completed',
        result: { default: true },
      }));

      expect(agent.registeredSkills).toContain('*');
    });

    it('should register multiple handlers', () => {
      agent.onTask('skill/a', async () => ({ status: 'completed' }));
      agent.onTask('skill/b', async () => ({ status: 'completed' }));
      agent.onTask('skill/c', async () => ({ status: 'completed' }));

      expect(agent.registeredSkills).toHaveLength(3);
      expect(agent.registeredSkills).toContain('skill/a');
      expect(agent.registeredSkills).toContain('skill/b');
      expect(agent.registeredSkills).toContain('skill/c');
    });
  });

  describe('taskStats', () => {
    it('should report empty stats initially', () => {
      const stats = agent.taskStats;
      expect(stats.completed).toBe(0);
      expect(stats.working).toBe(0);
      expect(stats.failed).toBe(0);
    });
  });

  describe('events', () => {
    it('should emit events', () => {
      const handler = vi.fn();
      agent.on('started', handler);
      agent.emit('started', { port: 3000 });
      expect(handler).toHaveBeenCalledWith({ port: 3000 });
    });
  });
});
