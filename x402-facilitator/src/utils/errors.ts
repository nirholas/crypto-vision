/**
 * Structured error class for the x402 facilitator.
 * Carries an HTTP status code and a machine-readable error code
 * alongside the human-readable message.
 */
export class FacilitatorError extends Error {
  constructor(
    message: string,
    public readonly code: FacilitatorErrorCode,
    public readonly statusCode: number = 400,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'FacilitatorError';
  }

  toJSON() {
    return {
      error: this.code,
      message: this.message,
      ...(this.details ? { details: this.details } : {}),
    };
  }
}

export type FacilitatorErrorCode =
  | 'UNSUPPORTED_CHAIN'
  | 'UNSUPPORTED_TOKEN'
  | 'INVALID_SIGNATURE'
  | 'EXPIRED_AUTHORIZATION'
  | 'NOT_YET_VALID'
  | 'INSUFFICIENT_BALANCE'
  | 'NONCE_ALREADY_USED'
  | 'SETTLEMENT_REVERTED'
  | 'SETTLEMENT_TIMEOUT'
  | 'INSUFFICIENT_GAS'
  | 'RPC_ERROR'
  | 'INVALID_PAYLOAD'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';
