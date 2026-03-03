/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// Request/response logging middleware for MCP operations

import { getLogger } from './logger.js';

const logger = getLogger();

export interface RequestLogContext {
  requestId: string;
  operation: string;
  startTime: number;
  toolName?: string;
  userId?: string;
}

export class RequestLogger {
  private static requestCounter = 0;

  /**
   * Generate unique request ID
   */
  static generateRequestId(): string {
    const timestamp = Date.now().toString(36);
    const counter = (++this.requestCounter).toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    return `req_${timestamp}_${counter}_${random}`;
  }

  /**
   * Log MCP tool request start
   */
  static logToolRequestStart(
    toolName: string,
    args?: unknown
  ): RequestLogContext {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    logger.info('MCP tool request started', {
      requestId,
      toolName,
      operation: 'tool_request_start',
      timestamp: new Date().toISOString(),
      hasArgs: !!args,
    });

    return {
      requestId,
      operation: 'tool_request',
      startTime,
      toolName,
    };
  }

  /**
   * Log MCP tool request completion
   */
  static logToolRequestComplete(
    context: RequestLogContext,
    success: boolean,
    error?: unknown
  ): void {
    const duration = Date.now() - context.startTime;

    if (success) {
      logger.info('MCP tool request completed', {
        requestId: context.requestId,
        toolName: context.toolName,
        operation: 'tool_request_complete',
        duration,
        timestamp: new Date().toISOString(),
      });
    } else {
      logger.error('MCP tool request failed', error as Error, {
        requestId: context.requestId,
        toolName: context.toolName,
        operation: 'tool_request_error',
        duration,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Log API request start
   */
  static logApiRequestStart(
    method: string,
    url: string,
    operation?: string
  ): RequestLogContext {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    logger.info('API request started', {
      requestId,
      method: method.toUpperCase(),
      url: this.maskSensitiveUrl(url),
      operation: operation || 'api_request_start',
      timestamp: new Date().toISOString(),
    });

    return {
      requestId,
      operation: operation || 'api_request',
      startTime,
    };
  }

  /**
   * Log API request completion
   */
  static logApiRequestComplete(
    context: RequestLogContext,
    statusCode: number,
    responseSize?: number,
    error?: unknown
  ): void {
    const duration = Date.now() - context.startTime;
    const success = statusCode >= 200 && statusCode < 300;

    if (success) {
      logger.info('API request completed', {
        requestId: context.requestId,
        statusCode,
        duration,
        responseSize,
        operation: 'api_request_complete',
        timestamp: new Date().toISOString(),
      });
    } else {
      logger.warn('API request completed with error', {
        requestId: context.requestId,
        statusCode,
        duration,
        operation: 'api_request_error',
        error: error ? String(error) : undefined,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Mask sensitive information in URLs
   */
  private static maskSensitiveUrl(url: string): string {
    try {
      const urlObj = new URL(url);

      // Mask query parameters that might contain sensitive data
      const sensitiveParams = ['key', 'token', 'secret', 'password', 'auth'];

      sensitiveParams.forEach(param => {
        if (urlObj.searchParams.has(param)) {
          urlObj.searchParams.set(param, '***');
        }
      });

      return urlObj.toString();
    } catch {
      return url; // Return original if URL parsing fails
    }
  }
}

export default RequestLogger;
