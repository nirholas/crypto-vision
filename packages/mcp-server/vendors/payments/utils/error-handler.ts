/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// Error handling middleware with HTTP status mapping and structured error responses

import { getLogger } from './logger.js';

const logger = getLogger();

export interface ErrorDetails {
  code: string;
  message: string;
  statusCode: number;
  details?: unknown;
  timestamp: string;
  operation?: string;
}

export interface ValidationErrorDetail {
  field?: string;
  message: string;
  code: string;
}

export class MCPError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly operation?: string;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    details?: unknown,
    operation?: string
  ) {
    super(message);
    this.name = 'MCPError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.operation = operation;
  }
}

export class ValidationError extends MCPError {
  constructor(message: string, field?: string, code = 'VALIDATION_ERROR') {
    super(message, 400, code, { field }, 'validation');
  }
}

export class AuthenticationError extends MCPError {
  constructor(message = 'Authentication failed', details?: unknown) {
    super(message, 401, 'AUTHENTICATION_ERROR', details, 'authentication');
  }
}

export class AuthorizationError extends MCPError {
  constructor(message = 'Access denied', details?: unknown) {
    super(message, 403, 'AUTHORIZATION_ERROR', details, 'authorization');
  }
}

export class NotFoundError extends MCPError {
  constructor(message = 'Resource not found', details?: unknown) {
    super(message, 404, 'NOT_FOUND', details, 'lookup');
  }
}

export class ConflictError extends MCPError {
  constructor(message = 'Resource conflict', details?: unknown) {
    super(message, 409, 'CONFLICT_ERROR', details, 'conflict');
  }
}

export class RateLimitError extends MCPError {
  constructor(message = 'Rate limit exceeded', details?: unknown) {
    super(message, 429, 'RATE_LIMIT_ERROR', details, 'rate_limit');
  }
}

export class ServiceUnavailableError extends MCPError {
  constructor(message = 'Service temporarily unavailable', details?: unknown) {
    super(message, 503, 'SERVICE_UNAVAILABLE', details, 'service_availability');
  }
}

export class TimeoutError extends MCPError {
  constructor(message = 'Request timeout', details?: unknown) {
    super(message, 408, 'TIMEOUT_ERROR', details, 'timeout');
  }
}

export class InternalServerError extends MCPError {
  constructor(message = 'Internal server error', details?: unknown) {
    super(message, 500, 'INTERNAL_ERROR', details, 'internal');
  }
}

/**
 * Error handler class for processing and formatting errors
 */
export class ErrorHandler {
  /**
   * Process error and return structured error details
   */
  static processError(error: unknown, operation?: string): ErrorDetails {
    const timestamp = new Date().toISOString();

    // Handle known MCP errors
    if (error instanceof MCPError) {
      logger.error(
        `MCP Error in ${operation || error.operation || 'unknown'}`,
        error,
        {
          code: error.code,
          statusCode: error.statusCode,
          operation: operation || error.operation,
        }
      );

      return {
        code: error.code,
        message: error.message,
        statusCode: error.statusCode,
        details: error.details,
        timestamp,
        operation: operation || error.operation,
      };
    }

    // Handle API client errors (axios, etc.)
    if (error && typeof error === 'object' && 'statusCode' in error) {
      const apiError = error as any;

      logger.error(`API Error in ${operation || 'unknown'}`, apiError, {
        statusCode: apiError.statusCode,
        operation,
      });

      return {
        code: apiError.code || 'API_ERROR',
        message: apiError.message || 'External API error',
        statusCode: apiError.statusCode || 500,
        details: apiError.details,
        timestamp,
        operation,
      };
    }

    // Handle validation errors from zod or similar
    if (error && typeof error === 'object' && 'issues' in error) {
      const zodError = error as any;

      logger.warn(`Validation Error in ${operation || 'unknown'}`, {
        issues: zodError.issues,
        operation,
      });

      return {
        code: 'VALIDATION_ERROR',
        message: 'Input validation failed',
        statusCode: 400,
        details: {
          issues: zodError.issues?.map((issue: any) => ({
            field: issue.path?.join('.'),
            message: issue.message,
            code: issue.code,
          })),
        },
        timestamp,
        operation,
      };
    }

    // Handle standard JavaScript errors
    if (error instanceof Error) {
      logger.error(`Unexpected Error in ${operation || 'unknown'}`, error, {
        operation,
      });

      // Check for specific error types by message patterns
      if (
        error.message.includes('timeout') ||
        error.message.includes('ECONNABORTED')
      ) {
        return {
          code: 'TIMEOUT_ERROR',
          message: 'Request timed out',
          statusCode: 408,
          details: { originalMessage: error.message },
          timestamp,
          operation,
        };
      }

      if (
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('ENOTFOUND')
      ) {
        return {
          code: 'SERVICE_UNAVAILABLE',
          message: 'External service unavailable',
          statusCode: 503,
          details: { originalMessage: error.message },
          timestamp,
          operation,
        };
      }

      return {
        code: 'INTERNAL_ERROR',
        message: error.message || 'Internal server error',
        statusCode: 500,
        details: { stack: error.stack },
        timestamp,
        operation,
      };
    }

    // Handle unknown error types
    logger.info(`Unknown Error in ${operation || 'unknown'}`, {
      errorType: typeof error,
      operation,
    });

    return {
      code: 'UNKNOWN_ERROR',
      message: 'An unexpected error occurred',
      statusCode: 500,
      details: { originalError: String(error) },
      timestamp,
      operation,
    };
  }

  /**
   * Format error for MCP response
   */
  static formatMCPError(
    error: unknown,
    operation?: string
  ): {
    content: Array<{ type: 'text'; text: string }>;
    isError: true;
  } {
    const errorDetails = this.processError(error, operation);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              error: {
                code: errorDetails.code,
                message: errorDetails.message,
                statusCode: errorDetails.statusCode,
                timestamp: errorDetails.timestamp,
                details: errorDetails.details,
              },
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }

  /**
   * Check if error is retryable
   */
  static isRetryableError(error: unknown): boolean {
    if (error instanceof MCPError) {
      const retryableStatusCodes = [408, 429, 502, 503, 504];
      return retryableStatusCodes.includes(error.statusCode);
    }

    if (error instanceof Error) {
      const retryableMessages = [
        'timeout',
        'ECONNRESET',
        'ECONNABORTED',
        'ETIMEDOUT',
        'socket hang up',
      ];

      return retryableMessages.some(msg =>
        error.message.toLowerCase().includes(msg.toLowerCase())
      );
    }

    return false;
  }

  /**
   * Get HTTP status code from error
   */
  static getStatusCode(error: unknown): number {
    if (error instanceof MCPError) {
      return error.statusCode;
    }

    if (error && typeof error === 'object' && 'statusCode' in error) {
      return (error as any).statusCode || 500;
    }

    if (error instanceof Error) {
      // Map common error patterns to status codes
      const message = error.message.toLowerCase();

      if (message.includes('validation') || message.includes('invalid')) {
        return 400;
      }

      if (
        message.includes('unauthorized') ||
        message.includes('authentication')
      ) {
        return 401;
      }

      if (message.includes('forbidden') || message.includes('access denied')) {
        return 403;
      }

      if (message.includes('not found')) {
        return 404;
      }

      if (message.includes('timeout')) {
        return 408;
      }

      if (message.includes('rate limit')) {
        return 429;
      }

      if (message.includes('unavailable') || message.includes('econnrefused')) {
        return 503;
      }
    }

    return 500; // Default to internal server error
  }

  /**
   * Create error response for different contexts
   */
  static createErrorResponse(
    error: unknown,
    context: 'mcp' | 'api' | 'log',
    operation?: string
  ): any {
    const errorDetails = this.processError(error, operation);

    switch (context) {
      case 'mcp':
        return this.formatMCPError(error, operation);

      case 'api':
        return {
          error: {
            code: errorDetails.code,
            message: errorDetails.message,
            statusCode: errorDetails.statusCode,
            timestamp: errorDetails.timestamp,
          },
        };

      case 'log':
        return {
          error: errorDetails.message,
          code: errorDetails.code,
          statusCode: errorDetails.statusCode,
          operation: errorDetails.operation,
          timestamp: errorDetails.timestamp,
        };

      default:
        return errorDetails;
    }
  }

  /**
   * Sanitize error details for client response (remove sensitive information)
   */
  static sanitizeErrorForClient(errorDetails: ErrorDetails): ErrorDetails {
    const sanitized = { ...errorDetails };

    // Remove sensitive information from details
    if (sanitized.details && typeof sanitized.details === 'object') {
      const details = { ...(sanitized.details as any) };

      // Remove stack traces in production
      if (process.env.NODE_ENV === 'production') {
        delete details.stack;
        delete details.originalError;
      }

      // Remove potentially sensitive fields
      delete details.config;
      delete details.request;
      delete details.response;
      delete details.headers;

      sanitized.details = details;
    }

    return sanitized;
  }
}

/**
 * Utility functions for common error scenarios
 */
export function createValidationError(
  message: string,
  field?: string
): ValidationError {
  return new ValidationError(message, field);
}

export function createNotFoundError(
  resource: string,
  identifier?: string
): NotFoundError {
  const message = identifier
    ? `${resource} with identifier '${identifier}' not found`
    : `${resource} not found`;

  return new NotFoundError(message, { resource, identifier });
}

export function createTimeoutError(
  operation: string,
  timeout: number
): TimeoutError {
  return new TimeoutError(
    `Operation '${operation}' timed out after ${timeout}ms`,
    { operation, timeout }
  );
}

export function createServiceUnavailableError(
  service: string,
  reason?: string
): ServiceUnavailableError {
  const message = reason
    ? `${service} is unavailable: ${reason}`
    : `${service} is temporarily unavailable`;

  return new ServiceUnavailableError(message, { service, reason });
}

// Export the main error handler functions for easy importing
export const { processError, formatMCPError, isRetryableError, getStatusCode } =
  ErrorHandler;
