/**
 * A2A Protocol Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TaskManager } from '../src/protocols/a2a/taskManager.js';
import { A2AHandler } from '../src/protocols/a2a/handler.js';
import { generateAgentCard } from '../src/protocols/a2a/agentCard.js';
import { A2A_ERROR_CODES } from '../src/protocols/a2a/types.js';
import type { A2ARequest, TaskSendParams } from '../src/protocols/a2a/types.js';

describe('TaskManager', () => {
  let taskManager: TaskManager;

  beforeEach(() => {
    taskManager = new TaskManager();
  });

  it('should register handlers', () => {
    taskManager.registerHandler('test', async () => ({
      status: 'completed',
      result: { ok: true },
    }));

    expect(taskManager.getRegisteredSkills()).toContain('test');
  });

  it('should process a task with matching handler', async () => {
    taskManager.registerHandler('echo', async (params) => {
      const text = (params.message?.parts[0] as any)?.text ?? '';
      return { status: 'completed', result: { echo: text } };
    });

    const params: TaskSendParams = {
      id: 'task-1',
      message: {
        role: 'user',
        parts: [{ type: 'text', text: 'Hello echo' }],
      },
      metadata: { skill: 'echo' },
    };

    const task = await taskManager.processTask(params);
    expect(task.status.state).toBe('completed');
    expect(task.artifacts).toBeDefined();
    expect(task.artifacts!.length).toBeGreaterThan(0);
  });

  it('should handle unknown skills', async () => {
    const params: TaskSendParams = {
      id: 'task-2',
      message: {
        role: 'user',
        parts: [{ type: 'text', text: 'Unknown skill' }],
      },
      metadata: { skill: 'nonexistent' },
    };

    const task = await taskManager.processTask(params);
    expect(task.status.state).toBe('failed');
  });

  it('should use default handler for unmatched tasks', async () => {
    taskManager.registerHandler('*', async () => ({
      status: 'completed',
      result: { default: true },
    }));

    const params: TaskSendParams = {
      id: 'task-3',
      message: {
        role: 'user',
        parts: [{ type: 'text', text: 'Anything' }],
      },
      metadata: { skill: 'anything' },
    };

    const task = await taskManager.processTask(params);
    expect(task.status.state).toBe('completed');
  });

  it('should cancel a task', async () => {
    taskManager.registerHandler('slow', async () => {
      return { status: 'working' as any };
    });

    const params: TaskSendParams = {
      id: 'task-4',
      message: { role: 'user', parts: [{ type: 'text', text: 'Start' }] },
      metadata: { skill: 'slow' },
    };

    await taskManager.processTask(params);
    const canceled = taskManager.cancelTask('task-4');
    expect(canceled).not.toBeNull();
  });

  it('should get a task by ID', async () => {
    taskManager.registerHandler('test', async () => ({
      status: 'completed',
      result: {},
    }));

    const params: TaskSendParams = {
      id: 'task-5',
      message: { role: 'user', parts: [{ type: 'text', text: 'test' }] },
      metadata: { skill: 'test' },
    };

    await taskManager.processTask(params);
    const task = taskManager.getTask({ id: 'task-5' });
    expect(task).not.toBeNull();
    expect(task!.id).toBe('task-5');
  });

  it('should return null for unknown task', () => {
    const task = taskManager.getTask({ id: 'nonexistent' });
    expect(task).toBeNull();
  });

  it('should track stats', async () => {
    taskManager.registerHandler('test', async () => ({
      status: 'completed',
      result: {},
    }));

    await taskManager.processTask({
      id: 'task-s1',
      message: { role: 'user', parts: [{ type: 'text', text: 'test' }] },
      metadata: { skill: 'test' },
    });

    const stats = taskManager.getStats();
    expect(stats.completed).toBe(1);
  });
});

describe('A2AHandler', () => {
  let handler: A2AHandler;
  let taskManager: TaskManager;

  beforeEach(() => {
    taskManager = new TaskManager();
    taskManager.registerHandler('test', async () => ({
      status: 'completed',
      result: { ok: true },
    }));
    handler = new A2AHandler(taskManager);
  });

  it('should handle tasks/send', async () => {
    const request: A2ARequest = {
      jsonrpc: '2.0',
      id: '1',
      method: 'tasks/send',
      params: {
        id: 'task-1',
        message: {
          role: 'user',
          parts: [{ type: 'text', text: 'Hello' }],
        },
        metadata: { skill: 'test' },
      },
    };

    const response = await handler.handleRequest(request);
    expect(response.result).toBeDefined();
    expect(response.error).toBeUndefined();
  });

  it('should handle tasks/get', async () => {
    // First, create a task
    await handler.handleRequest({
      jsonrpc: '2.0',
      id: '1',
      method: 'tasks/send',
      params: {
        id: 'task-get',
        message: { role: 'user', parts: [{ type: 'text', text: 'test' }] },
        metadata: { skill: 'test' },
      },
    });

    const response = await handler.handleRequest({
      jsonrpc: '2.0',
      id: '2',
      method: 'tasks/get',
      params: { id: 'task-get' },
    });

    expect(response.result).toBeDefined();
    expect((response.result as any).id).toBe('task-get');
  });

  it('should return error for missing task', async () => {
    const response = await handler.handleRequest({
      jsonrpc: '2.0',
      id: '1',
      method: 'tasks/get',
      params: { id: 'nonexistent' },
    });

    expect(response.error).toBeDefined();
    expect(response.error!.code).toBe(A2A_ERROR_CODES.TASK_NOT_FOUND);
  });

  it('should return error for unknown method', async () => {
    const response = await handler.handleRequest({
      jsonrpc: '2.0',
      id: '1',
      method: 'unknown/method' as any,
    });

    expect(response.error).toBeDefined();
    expect(response.error!.code).toBe(A2A_ERROR_CODES.METHOD_NOT_FOUND);
  });

  it('should reject invalid tasks/send without message', async () => {
    const response = await handler.handleRequest({
      jsonrpc: '2.0',
      id: '1',
      method: 'tasks/send',
      params: { id: 'bad-task' },
    });

    expect(response.error).toBeDefined();
    expect(response.error!.code).toBe(A2A_ERROR_CODES.INVALID_PARAMS);
  });
});

describe('AgentCard', () => {
  it('should generate a valid agent card', () => {
    const card = generateAgentCard({
      config: {
        name: 'Test Agent',
        description: 'A test agent',
        privateKey: '0x' + 'ab'.repeat(32),
        chain: 'bsc-testnet',
        capabilities: ['trading', 'analysis'],
        pricing: {
          'trading/execute': { price: '0.001', token: 'USDC' },
        },
        trust: ['reputation'],
      },
      baseUrl: 'http://localhost:3000',
      agentId: 42,
      agentRegistry: 'eip155:97:0x8004A818BFB912233c491871b3d84c89A494BD9e',
    });

    expect(card.name).toBe('Test Agent');
    expect(card.url).toBe('http://localhost:3000');
    expect(card.skills.length).toBeGreaterThan(0);
    expect(card.erc8004).toBeDefined();
    expect(card.erc8004!.agentId).toBe(42);
    expect(card.erc8004!.x402Support).toBe(true);
  });

  it('should include skills from pricing config', () => {
    const card = generateAgentCard({
      config: {
        name: 'Test',
        description: 'Test',
        privateKey: '0x' + 'ab'.repeat(32),
        chain: 'bsc-testnet',
        pricing: {
          'skill/a': { price: '0.001', token: 'USDC' },
          'skill/b': { price: '0.002', token: 'USDC' },
        },
      },
      baseUrl: 'http://localhost:3000',
    });

    const skillIds = card.skills.map((s) => s.id);
    expect(skillIds).toContain('skill/a');
    expect(skillIds).toContain('skill/b');
  });
});
