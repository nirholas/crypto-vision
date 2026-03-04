/**
 * SkillRegistry Tests
 *
 * Covers registration, validation, filtering, dependency resolution,
 * agent card conversion, and task manager wiring.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SkillRegistry } from '../src/skills/registry.js';
import type { Skill, SkillBundle, SkillContext, SkillResult } from '../src/skills/types.js';
import type { TaskSendParams } from '../src/protocols/a2a/types.js';
import { TaskManager } from '../src/protocols/a2a/taskManager.js';

// ─── Helpers ───────────────────────────────────────────────────────

function createTestSkill(overrides: Partial<Skill['definition']> = {}): Skill {
  return {
    definition: {
      id: overrides.id ?? 'defi/swap',
      name: overrides.name ?? 'Token Swap',
      description: overrides.description ?? 'Swap one token for another',
      category: overrides.category ?? 'defi',
      version: overrides.version ?? '1.0.0',
      tags: overrides.tags ?? ['defi', 'swap'],
      inputModes: overrides.inputModes ?? ['application/json'],
      outputModes: overrides.outputModes ?? ['application/json'],
      chains: overrides.chains ?? ['bsc', 'bsc-testnet'],
      parameters: overrides.parameters ?? {
        tokenIn: { type: 'string', description: 'Input token address', required: true },
        tokenOut: { type: 'string', description: 'Output token address', required: true },
      },
      requiresPayment: overrides.requiresPayment,
      requiredConfig: overrides.requiredConfig,
      dependencies: overrides.dependencies,
    },
    handler: vi.fn(async (): Promise<SkillResult> => ({
      status: 'completed',
      result: { txHash: '0x123' },
      message: 'Swap completed',
    })),
  };
}

function createTestContext(overrides: Partial<SkillContext> = {}): SkillContext {
  return {
    chain: overrides.chain ?? 'bsc-testnet',
    chainId: overrides.chainId ?? 97,
    agentAddress: overrides.agentAddress ?? '0x' + 'aa'.repeat(20),
    privateKey: overrides.privateKey ?? '0x' + 'ab'.repeat(32),
    logger: overrides.logger ?? {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    callSkill: overrides.callSkill ?? vi.fn(),
    getConfig: overrides.getConfig ?? (() => undefined),
  };
}

// ─── Registration ──────────────────────────────────────────────────

describe('SkillRegistry', () => {
  let registry: SkillRegistry;

  beforeEach(() => {
    registry = new SkillRegistry();
  });

  describe('register', () => {
    it('should register a valid skill', () => {
      const skill = createTestSkill();
      registry.register(skill);
      expect(registry.has('defi/swap')).toBe(true);
      expect(registry.get('defi/swap')).toBe(skill);
    });

    it('should overwrite existing skill with same ID', () => {
      const skill1 = createTestSkill();
      const skill2 = createTestSkill({ description: 'Updated swap' });
      registry.register(skill1);
      registry.register(skill2);
      expect(registry.get('defi/swap')?.definition.description).toBe('Updated swap');
    });

    it('should throw on invalid skill ID format', () => {
      expect(() => {
        registry.register(createTestSkill({ id: 'INVALID' }));
      }).toThrow(/Invalid skill/);
    });

    it('should throw on missing required fields', () => {
      expect(() => {
        registry.register(createTestSkill({ name: '' }));
      }).toThrow(/name/i);
    });

    it('should throw on empty input modes', () => {
      expect(() => {
        registry.register(createTestSkill({ inputModes: [] }));
      }).toThrow(/inputModes/i);
    });

    it('should throw on invalid category', () => {
      expect(() => {
        registry.register(createTestSkill({ category: 'invalid-category' as 'defi' }));
      }).toThrow(/Invalid category|category/i);
    });

    it('should accept hyphenated skill IDs', () => {
      const skill = createTestSkill({ id: 'market-data/fear-greed' });
      registry.register(skill);
      expect(registry.has('market-data/fear-greed')).toBe(true);
    });

    it('should accept multi-segment skill IDs', () => {
      const skill = createTestSkill({ id: 'defi/lending/supply' });
      registry.register(skill);
      expect(registry.has('defi/lending/supply')).toBe(true);
    });
  });

  describe('registerBundle', () => {
    it('should register all skills in a bundle', () => {
      const bundle: SkillBundle = {
        name: 'test-bundle',
        description: 'Test bundle',
        skills: [
          createTestSkill({ id: 'defi/swap' }),
          createTestSkill({ id: 'defi/quote' }),
        ],
      };
      registry.registerBundle(bundle);
      expect(registry.has('defi/swap')).toBe(true);
      expect(registry.has('defi/quote')).toBe(true);
      expect(registry.getBundles()).toHaveLength(1);
    });

    it('should use name as bundle identifier when id is absent', () => {
      const bundle: SkillBundle = {
        name: 'my-bundle',
        description: 'Test',
        skills: [createTestSkill()],
      };
      registry.registerBundle(bundle);
      expect(registry.getBundles()).toHaveLength(1);
      expect(registry.getBundles()[0].name).toBe('my-bundle');
    });

    it('should use id field as bundle identifier when present', () => {
      const bundle: SkillBundle = {
        id: 'custom-id',
        name: 'my-bundle',
        description: 'Test',
        skills: [createTestSkill()],
      };
      registry.registerBundle(bundle);
      expect(registry.getBundles()).toHaveLength(1);
    });
  });

  describe('unregister', () => {
    it('should remove a registered skill', () => {
      registry.register(createTestSkill());
      expect(registry.unregister('defi/swap')).toBe(true);
      expect(registry.has('defi/swap')).toBe(false);
    });

    it('should return false for non-existent skill', () => {
      expect(registry.unregister('nonexistent')).toBe(false);
    });
  });

  // ─── Querying ──────────────────────────────────────────────────

  describe('getAll and getSkillIds', () => {
    it('should return all registered skills', () => {
      registry.register(createTestSkill({ id: 'defi/swap' }));
      registry.register(createTestSkill({ id: 'trading/limit-order', category: 'trading' }));
      expect(registry.getAll()).toHaveLength(2);
      expect(registry.getSkillIds()).toEqual(expect.arrayContaining(['defi/swap', 'trading/limit-order']));
    });

    it('should return empty arrays when no skills registered', () => {
      expect(registry.getAll()).toHaveLength(0);
      expect(registry.getSkillIds()).toHaveLength(0);
    });
  });

  describe('filter', () => {
    beforeEach(() => {
      registry.register(createTestSkill({ id: 'defi/swap', category: 'defi', tags: ['defi', 'swap'], chains: ['bsc'] }));
      registry.register(createTestSkill({ id: 'trading/limit-order', category: 'trading', tags: ['trading', 'limit'], chains: ['bsc', 'ethereum'] }));
      registry.register(createTestSkill({ id: 'nft/transfer', category: 'nft', tags: ['nft', 'transfer'], chains: ['bsc'], requiresPayment: true }));
    });

    it('should filter by category', () => {
      const result = registry.filter({ category: 'defi' });
      expect(result).toHaveLength(1);
      expect(result[0].definition.id).toBe('defi/swap');
    });

    it('should filter by chain', () => {
      const result = registry.filter({ chain: 'ethereum' });
      expect(result).toHaveLength(1);
      expect(result[0].definition.id).toBe('trading/limit-order');
    });

    it('should filter by tags', () => {
      const result = registry.filter({ tags: ['swap'] });
      expect(result).toHaveLength(1);
      expect(result[0].definition.id).toBe('defi/swap');
    });

    it('should filter by requiresPayment', () => {
      const result = registry.filter({ requiresPayment: true });
      expect(result).toHaveLength(1);
      expect(result[0].definition.id).toBe('nft/transfer');
    });

    it('should filter by search text', () => {
      const result = registry.filter({ search: 'limit' });
      expect(result).toHaveLength(1);
      expect(result[0].definition.id).toBe('trading/limit-order');
    });

    it('should combine multiple filters', () => {
      const result = registry.filter({ category: 'defi', chain: 'bsc' });
      expect(result).toHaveLength(1);
    });

    it('should return empty for no matches', () => {
      const result = registry.filter({ category: 'governance' });
      expect(result).toHaveLength(0);
    });
  });

  describe('getByCategory', () => {
    it('should group skills by category', () => {
      registry.register(createTestSkill({ id: 'defi/swap', category: 'defi' }));
      registry.register(createTestSkill({ id: 'defi/quote', category: 'defi' }));
      registry.register(createTestSkill({ id: 'trading/price', category: 'trading' }));

      const grouped = registry.getByCategory();
      expect(grouped.get('defi')?.length).toBe(2);
      expect(grouped.get('trading')?.length).toBe(1);
    });
  });

  // ─── Agent Card Conversion ────────────────────────────────────

  describe('toAgentSkills', () => {
    it('should convert to A2A AgentSkill format', () => {
      registry.register(createTestSkill({
        id: 'defi/swap',
        name: 'Token Swap',
        description: 'Swap tokens',
        tags: ['defi', 'swap'],
      }));

      const agentSkills = registry.toAgentSkills();
      expect(agentSkills).toHaveLength(1);
      expect(agentSkills[0]).toEqual({
        id: 'defi/swap',
        name: 'Token Swap',
        description: 'Swap tokens',
        inputModes: ['application/json'],
        outputModes: ['application/json'],
        tags: ['defi', 'swap'],
      });
    });
  });

  // ─── Task Manager Wiring ─────────────────────────────────────

  describe('wireToTaskManager', () => {
    it('should register all skills as task handlers', () => {
      const handler = vi.fn(async (): Promise<SkillResult> => ({
        status: 'completed',
        result: { done: true },
      }));

      registry.register({
        definition: {
          id: 'test/echo',
          name: 'Echo',
          description: 'Echo test',
          category: 'custom',
          version: '1.0.0',
          tags: ['test'],
          inputModes: ['application/json'],
          outputModes: ['application/json'],
        },
        handler,
      });

      const taskManager = new TaskManager();
      const ctx = createTestContext();
      registry.wireToTaskManager(taskManager, ctx);

      expect(taskManager.getRegisteredSkills()).toContain('test/echo');
    });
  });

  // ─── Execution ───────────────────────────────────────────────

  describe('execute', () => {
    it('should execute a registered skill', async () => {
      const handler = vi.fn(async (params: TaskSendParams, context: SkillContext): Promise<SkillResult> => ({
        status: 'completed',
        result: { value: 42 },
        message: 'Done',
      }));

      registry.register({
        definition: {
          id: 'test/calc',
          name: 'Calculator',
          description: 'Returns 42',
          category: 'custom',
          version: '1.0.0',
          tags: ['test'],
          inputModes: ['application/json'],
          outputModes: ['application/json'],
        },
        handler,
      });

      const ctx = createTestContext();
      const params: TaskSendParams = {
        id: 'task-1',
        message: { role: 'user', parts: [{ type: 'text', text: 'calculate' }] },
      };

      const result = await registry.execute('test/calc', params, ctx);
      expect(result.status).toBe('completed');
      expect(result.result?.value).toBe(42);
      expect(handler).toHaveBeenCalledWith(params, ctx);
    });

    it('should return failed for non-existent skill', async () => {
      const result = await registry.execute('nonexistent', { id: 't', message: { role: 'user', parts: [] } }, createTestContext());
      expect(result.status).toBe('failed');
      expect(result.message).toContain('not found');
    });

    it('should catch handler errors', async () => {
      registry.register({
        definition: {
          id: 'test/error',
          name: 'Error Skill',
          description: 'Always fails',
          category: 'custom',
          version: '1.0.0',
          tags: ['test'],
          inputModes: ['application/json'],
          outputModes: ['application/json'],
        },
        handler: async () => { throw new Error('boom'); },
      });

      const result = await registry.execute('test/error', { id: 't', message: { role: 'user', parts: [] } }, createTestContext());
      expect(result.status).toBe('failed');
      expect(result.message).toContain('boom');
    });
  });

  // ─── Configuration Checks ────────────────────────────────────

  describe('checkConfig', () => {
    it('should return empty array when all config is present', () => {
      registry.register(createTestSkill({
        id: 'defi/swap',
        requiredConfig: ['PRIVATE_KEY', 'API_KEY'],
      }));

      const missing = registry.checkConfig('defi/swap', (key) =>
        ({ PRIVATE_KEY: '0x123', API_KEY: 'abc' })[key]
      );
      expect(missing).toHaveLength(0);
    });

    it('should return missing config keys', () => {
      registry.register(createTestSkill({
        id: 'defi/swap',
        requiredConfig: ['PRIVATE_KEY', 'API_KEY'],
      }));

      const missing = registry.checkConfig('defi/swap', () => undefined);
      expect(missing).toEqual(['PRIVATE_KEY', 'API_KEY']);
    });

    it('should return error for non-existent skill', () => {
      const missing = registry.checkConfig('nonexistent', () => 'val');
      expect(missing).toHaveLength(1);
      expect(missing[0]).toContain('not found');
    });
  });

  // ─── Dependency Resolution ────────────────────────────────────

  describe('resolveDependencies', () => {
    it('should resolve a skill with no dependencies', () => {
      registry.register(createTestSkill({ id: 'defi/swap' }));
      const { resolved, missing } = registry.resolveDependencies('defi/swap');
      expect(resolved).toEqual(['defi/swap']);
      expect(missing).toHaveLength(0);
    });

    it('should resolve transitive dependencies', () => {
      registry.register(createTestSkill({ id: 'defi/swap', dependencies: ['trading/price'] }));
      registry.register(createTestSkill({ id: 'trading/price', category: 'trading' }));

      const { resolved, missing } = registry.resolveDependencies('defi/swap');
      expect(resolved).toContain('defi/swap');
      expect(resolved).toContain('trading/price');
      expect(missing).toHaveLength(0);
    });

    it('should track missing dependencies', () => {
      registry.register(createTestSkill({ id: 'defi/swap', dependencies: ['nonexistent'] }));
      const { missing } = registry.resolveDependencies('defi/swap');
      expect(missing).toContain('nonexistent');
    });
  });

  // ─── Statistics ──────────────────────────────────────────────

  describe('getStats', () => {
    it('should return correct stats', () => {
      registry.register(createTestSkill({ id: 'defi/swap', category: 'defi' }));
      registry.register(createTestSkill({ id: 'defi/quote', category: 'defi' }));
      registry.register(createTestSkill({ id: 'nft/transfer', category: 'nft', requiresPayment: true }));

      const stats = registry.getStats();
      expect(stats.totalSkills).toBe(3);
      expect(stats.byCategory['defi']).toBe(2);
      expect(stats.byCategory['nft']).toBe(1);
      expect(stats.paidSkills).toBe(1);
      expect(stats.freeSkills).toBe(2);
    });

    it('should return zero stats when empty', () => {
      const stats = registry.getStats();
      expect(stats.totalSkills).toBe(0);
      expect(stats.totalBundles).toBe(0);
      expect(stats.paidSkills).toBe(0);
    });
  });
});
