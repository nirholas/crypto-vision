/**
 * A2A Message Handler
 *
 * Processes incoming A2A JSON-RPC requests and delegates to TaskManager.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  A2ARequest,
  A2AResponse,
  A2AError,
  TaskSendParams,
  TaskQueryParams,
  Task,
} from './types.js';
import { A2A_ERROR_CODES } from './types.js';
import { type TaskManager } from './taskManager.js';

export class A2AHandler {
  private readonly taskManager: TaskManager;

  constructor(taskManager: TaskManager) {
    this.taskManager = taskManager;
  }

  /**
   * Process an incoming A2A JSON-RPC request.
   */
  async handleRequest(request: A2ARequest): Promise<A2AResponse> {
    try {
      this.validateRequest(request);

      switch (request.method) {
        case 'tasks/send':
          return this.handleTaskSend(request);
        case 'tasks/get':
          return this.handleTaskGet(request);
        case 'tasks/cancel':
          return this.handleTaskCancel(request);
        case 'tasks/pushNotification/set':
        case 'tasks/pushNotification/get':
          return this.errorResponse(request.id, {
            code: A2A_ERROR_CODES.PUSH_NOTIFICATION_NOT_SUPPORTED,
            message: 'Push notifications not supported',
          });
        default:
          return this.errorResponse(request.id, {
            code: A2A_ERROR_CODES.METHOD_NOT_FOUND,
            message: `Method not found: ${request.method}`,
          });
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return this.errorResponse(request.id, {
        code: A2A_ERROR_CODES.INTERNAL_ERROR,
        message: err.message,
      });
    }
  }

  /**
   * Handle tasks/send — creates or continues a task.
   */
  private async handleTaskSend(request: A2ARequest): Promise<A2AResponse> {
    const params = request.params as TaskSendParams;

    if (!params?.message) {
      return this.errorResponse(request.id, {
        code: A2A_ERROR_CODES.INVALID_PARAMS,
        message: 'Missing required field: message',
      });
    }

    // Ensure task has an ID
    if (!params.id) {
      params.id = uuidv4();
    }

    const task = await this.taskManager.processTask(params);

    return {
      jsonrpc: '2.0',
      id: request.id,
      result: this.serializeTask(task),
    };
  }

  /**
   * Handle tasks/get — retrieves task status.
   */
  private async handleTaskGet(request: A2ARequest): Promise<A2AResponse> {
    const params = request.params as TaskQueryParams;

    if (!params?.id) {
      return this.errorResponse(request.id, {
        code: A2A_ERROR_CODES.INVALID_PARAMS,
        message: 'Missing required field: id',
      });
    }

    const task = this.taskManager.getTask(params);

    if (!task) {
      return this.errorResponse(request.id, {
        code: A2A_ERROR_CODES.TASK_NOT_FOUND,
        message: `Task not found: ${params.id}`,
      });
    }

    return {
      jsonrpc: '2.0',
      id: request.id,
      result: this.serializeTask(task),
    };
  }

  /**
   * Handle tasks/cancel — cancels a task.
   */
  private async handleTaskCancel(request: A2ARequest): Promise<A2AResponse> {
    const params = request.params as { id: string };

    if (!params?.id) {
      return this.errorResponse(request.id, {
        code: A2A_ERROR_CODES.INVALID_PARAMS,
        message: 'Missing required field: id',
      });
    }

    const task = this.taskManager.cancelTask(params.id);

    if (!task) {
      return this.errorResponse(request.id, {
        code: A2A_ERROR_CODES.TASK_NOT_FOUND,
        message: `Task not found: ${params.id}`,
      });
    }

    if (['completed', 'failed'].includes(task.status.state)) {
      return this.errorResponse(request.id, {
        code: A2A_ERROR_CODES.TASK_NOT_CANCELABLE,
        message: `Task is in terminal state: ${task.status.state}`,
      });
    }

    return {
      jsonrpc: '2.0',
      id: request.id,
      result: this.serializeTask(task),
    };
  }

  /**
   * Validate the JSON-RPC request envelope.
   */
  private validateRequest(request: A2ARequest): void {
    if (request.jsonrpc !== '2.0') {
      throw Object.assign(new Error('Invalid JSON-RPC version'), {
        code: A2A_ERROR_CODES.INVALID_REQUEST,
      });
    }
    if (!request.method) {
      throw Object.assign(new Error('Missing method'), {
        code: A2A_ERROR_CODES.INVALID_REQUEST,
      });
    }
    if (request.id === undefined || request.id === null) {
      throw Object.assign(new Error('Missing request id'), {
        code: A2A_ERROR_CODES.INVALID_REQUEST,
      });
    }
  }

  /**
   * Build an error response.
   */
  private errorResponse(
    id: string | number,
    error: A2AError
  ): A2AResponse {
    return {
      jsonrpc: '2.0',
      id,
      error,
    };
  }

  /**
   * Serialize a task for the response (strips internal fields).
   */
  private serializeTask(task: Task): Record<string, unknown> {
    return {
      id: task.id,
      sessionId: task.sessionId,
      status: task.status,
      artifacts: task.artifacts,
      history: task.history,
      metadata: task.metadata,
    };
  }
}
