/**
 * A2A Task Manager
 *
 * Manages task lifecycle: creation, status updates, completion.
 */

import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'eventemitter3';
import type {
  Task,
  TaskState,
  TaskStatus,
  TaskSendParams,
  TaskQueryParams,
  Message,
  Artifact,
  TaskHandler,
} from './types.js';

export interface TaskManagerEvents {
  'task:created': (task: Task) => void;
  'task:updated': (task: Task) => void;
  'task:completed': (task: Task) => void;
  'task:failed': (task: Task, error: Error) => void;
  'task:canceled': (task: Task) => void;
}

export class TaskManager extends EventEmitter<TaskManagerEvents> {
  private readonly tasks = new Map<string, Task>();
  private readonly handlers = new Map<string, TaskHandler>();
  private readonly maxTaskAge: number;

  constructor(maxTaskAge = 3600000) {
    super();
    this.maxTaskAge = maxTaskAge;

    // Periodic cleanup of old tasks
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Register a handler for a task type / skill.
   */
  registerHandler(skillId: string, handler: TaskHandler): void {
    this.handlers.set(skillId, handler);
  }

  /**
   * Get all registered skill IDs.
   */
  getRegisteredSkills(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Process an incoming task request.
   */
  async processTask(params: TaskSendParams): Promise<Task> {
    // Get or create task
    let task = this.tasks.get(params.id);
    if (!task) {
      task = {
        id: params.id,
        sessionId: params.sessionId ?? uuidv4(),
        status: { state: 'submitted', timestamp: new Date().toISOString() },
        history: [],
        artifacts: [],
        metadata: params.metadata,
      };
      this.tasks.set(task.id, task);
      this.emit('task:created', task);
    }

    // Add incoming message to history
    if (params.message) {
      task.history = task.history ?? [];
      task.history.push(params.message);
    }

    // Determine skill from message content or metadata
    const skillId = this.resolveSkill(params);
    const handler = skillId ? this.handlers.get(skillId) : null;

    if (!handler) {
      // Try default handler
      const defaultHandler = this.handlers.get('*');
      if (defaultHandler) {
        return this.executeHandler(task, params, defaultHandler);
      }

      task.status = {
        state: 'failed',
        message: {
          role: 'agent',
          parts: [{ type: 'text', text: `Unknown skill: ${skillId ?? 'none'}` }],
        },
        timestamp: new Date().toISOString(),
      };
      this.tasks.set(task.id, task);
      this.emit('task:failed', task, new Error(`Unknown skill: ${skillId}`));
      return task;
    }

    return this.executeHandler(task, params, handler);
  }

  /**
   * Execute a handler for a task.
   */
  private async executeHandler(
    task: Task,
    params: TaskSendParams,
    handler: TaskHandler
  ): Promise<Task> {
    // Update status to working
    task.status = { state: 'working', timestamp: new Date().toISOString() };
    this.tasks.set(task.id, task);
    this.emit('task:updated', task);

    try {
      const result = await handler(params);

      const agentMessage: Message = {
        role: 'agent',
        parts: [
          {
            type: 'text',
            text: result.message ?? JSON.stringify(result.result ?? 'Task completed'),
          },
        ],
      };

      task.status = {
        state: result.status,
        message: agentMessage,
        timestamp: new Date().toISOString(),
      };

      task.history = task.history ?? [];
      task.history.push(agentMessage);

      if (result.result) {
        const artifact: Artifact = {
          name: 'result',
          parts: [{ type: 'data', data: result.result as Record<string, unknown> }],
          index: (task.artifacts?.length ?? 0),
          lastChunk: true,
        };
        task.artifacts = task.artifacts ?? [];
        task.artifacts.push(artifact);
      }

      this.tasks.set(task.id, task);

      if (result.status === 'completed') {
        this.emit('task:completed', task);
      }

      return task;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      task.status = {
        state: 'failed',
        message: {
          role: 'agent',
          parts: [{ type: 'text', text: `Error: ${err.message}` }],
        },
        timestamp: new Date().toISOString(),
      };
      this.tasks.set(task.id, task);
      this.emit('task:failed', task, err);
      return task;
    }
  }

  /**
   * Get a task by ID.
   */
  getTask(params: TaskQueryParams): Task | null {
    const task = this.tasks.get(params.id);
    if (!task) return null;

    // Optionally trim history
    if (params.historyLength !== undefined && task.history) {
      const trimmed = { ...task };
      trimmed.history = task.history.slice(-params.historyLength);
      return trimmed;
    }

    return task;
  }

  /**
   * Cancel a task.
   */
  cancelTask(taskId: string): Task | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    if (['completed', 'failed', 'canceled'].includes(task.status.state)) {
      return task; // Already terminal
    }

    task.status = {
      state: 'canceled',
      message: {
        role: 'agent',
        parts: [{ type: 'text', text: 'Task canceled by request' }],
      },
      timestamp: new Date().toISOString(),
    };

    this.tasks.set(task.id, task);
    this.emit('task:canceled', task);
    return task;
  }

  /**
   * Resolve which skill/handler to use from the task params.
   */
  private resolveSkill(params: TaskSendParams): string | null {
    // Check metadata for explicit skill
    if (params.metadata?.skill) {
      return String(params.metadata.skill);
    }

    // Check message for task routing (e.g., "trading/execute")
    if (params.message?.parts) {
      for (const part of params.message.parts) {
        if (part.type === 'data' && 'task' in (part as { type: 'data'; data: Record<string, unknown> }).data) {
          return String((part as { type: 'data'; data: Record<string, unknown> }).data.task);
        }
        if (part.type === 'text') {
          // Check if any registered handler matches
          for (const skillId of this.handlers.keys()) {
            if (skillId !== '*' && part.text.includes(skillId)) {
              return skillId;
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * Clean up old tasks.
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [id, task] of this.tasks) {
      const timestamp = task.status.timestamp
        ? new Date(task.status.timestamp).getTime()
        : 0;
      if (now - timestamp > this.maxTaskAge) {
        this.tasks.delete(id);
      }
    }
  }

  /**
   * Get all active tasks.
   */
  getActiveTasks(): Task[] {
    return Array.from(this.tasks.values()).filter(
      (t) => !['completed', 'failed', 'canceled'].includes(t.status.state)
    );
  }

  /**
   * Get task count by state.
   */
  getStats(): Record<TaskState, number> {
    const stats: Record<TaskState, number> = {
      submitted: 0,
      working: 0,
      'input-required': 0,
      completed: 0,
      canceled: 0,
      failed: 0,
      unknown: 0,
    };
    for (const task of this.tasks.values()) {
      stats[task.status.state]++;
    }
    return stats;
  }
}
