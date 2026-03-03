/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// Input validation utilities using zod for schema validation and type safety

import { z } from 'zod';
import type {
  CreatePaymentOnchainInput,
  CreatePaymentRedirectInput,
  GetPaymentStatusInput,
  ListCurrenciesCatalogInput,
  PaymentStatusCode,
} from '../types/index.js';

// Custom zod validators for domain-specific types
const uuidSchema = z.string().uuid('Invalid UUID format');
const currencySymbolSchema = z
  .string()
  .regex(
    /^[A-Z0-9_]+$/,
    'Currency symbol must be uppercase alphanumeric with underscores'
  );
const fiatCurrencySchema = z
  .string()
  .regex(
    /^[A-Z]{3}$/,
    'Fiat currency must be 3-letter uppercase code (e.g., EUR, USD)'
  );
const positiveNumberSchema = z.number().positive('Amount must be positive');
const urlSchema = z.string().url('Invalid URL format');
const notesSchema = z
  .string()
  .max(256, 'Notes cannot exceed 256 characters')
  .optional();

// Payment status code validation
const paymentStatusSchema = z.enum([
  'NR',
  'PE',
  'AC',
  'IA',
  'OC',
  'CO',
  'CA',
  'EX',
  'FA',
]);

// MCP Tool Input Schemas
export const createPaymentOnchainSchema = z.object({
  amount_eur: positiveNumberSchema,
  input_currency: currencySymbolSchema,
  fiat: fiatCurrencySchema.default('EUR').optional(),
  notes: notesSchema,
}) satisfies z.ZodType<CreatePaymentOnchainInput>;

export const createPaymentRedirectSchema = z.object({
  amount_eur: positiveNumberSchema,
  url_ok: urlSchema.optional(),
  url_ko: urlSchema.optional(),
  fiat: fiatCurrencySchema.default('EUR').optional(),
  notes: notesSchema,
}) satisfies z.ZodType<CreatePaymentRedirectInput>;

export const getPaymentStatusSchema = z.object({
  identifier: uuidSchema,
}) satisfies z.ZodType<GetPaymentStatusInput>;

export const listCurrenciesCatalogSchema = z.object({
  filter_by_amount: positiveNumberSchema.optional(),
}) satisfies z.ZodType<ListCurrenciesCatalogInput>;

// Validation result types
export interface ValidationSuccess<T> {
  success: true;
  data: T;
}

export interface ValidationError {
  success: false;
  error: {
    message: string;
    field?: string;
    code: string;
  };
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationError;

// Generic validation function
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  input: unknown
): ValidationResult<T> {
  try {
    const result = schema.safeParse(input);

    if (result.success) {
      return {
        success: true,
        data: result.data,
      };
    }

    // Extract first validation error
    const firstError = result.error.errors[0];
    if (!firstError) {
      return {
        success: false,
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
        },
      };
    }
    return {
      success: false,
      error: {
        message: firstError.message,
        field: firstError.path.join('.'),
        code: firstError.code,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: {
        message: 'Validation failed due to internal error',
        code: 'INTERNAL_ERROR',
      },
    };
  }
}

// Specific validation functions for each MCP tool
export function validateCreatePaymentOnchain(
  input: unknown
): ValidationResult<CreatePaymentOnchainInput> {
  return validateInput(createPaymentOnchainSchema, input);
}

export function validateCreatePaymentRedirect(
  input: unknown
): ValidationResult<CreatePaymentRedirectInput> {
  return validateInput(createPaymentRedirectSchema, input);
}

export function validateGetPaymentStatus(
  input: unknown
): ValidationResult<GetPaymentStatusInput> {
  return validateInput(getPaymentStatusSchema, input);
}

export function validateListCurrenciesCatalog(
  input: unknown
): ValidationResult<ListCurrenciesCatalogInput> {
  return validateInput(listCurrenciesCatalogSchema, input);
}

// Additional business logic validators
export function validateAmountForCurrency(
  amount: number,
  currency: { minAmount: number; maxAmount: number | null }
): ValidationResult<number> {
  if (amount < currency.minAmount) {
    return {
      success: false,
      error: {
        message: `Amount ${amount} is below minimum ${currency.minAmount} for this currency`,
        code: 'AMOUNT_BELOW_MINIMUM',
      },
    };
  }

  if (currency.maxAmount !== null && amount > currency.maxAmount) {
    return {
      success: false,
      error: {
        message: `Amount ${amount} exceeds maximum ${currency.maxAmount} for this currency`,
        code: 'AMOUNT_ABOVE_MAXIMUM',
      },
    };
  }

  return {
    success: true,
    data: amount,
  };
}

export function validatePaymentStatus(
  status: string
): ValidationResult<PaymentStatusCode> {
  const result = paymentStatusSchema.safeParse(status);

  if (result.success) {
    return {
      success: true,
      data: result.data,
    };
  }

  return {
    success: false,
    error: {
      message: `Invalid payment status: ${status}. Must be one of: NR, PE, AC, IA, OC, CO, CA, EX, FA`,
      code: 'INVALID_STATUS',
    },
  };
}

// Environment variable validation schemas
export const envConfigSchema = z.object({
  UNIVERSAL_CRYPTO_DEVICE_ID: z
    .string()
    .min(8, 'Device ID must be at least 8 characters'),
  UNIVERSAL_CRYPTO_BASE_URL: z.string().url('Base URL must be valid HTTP/HTTPS URL'),
  UNIVERSAL_CRYPTO_DEVICE_SECRET: z.string().optional(),
  LOG_LEVEL: z
    .enum(['error', 'warn', 'info', 'debug'])
    .default('info')
    .optional(),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('production')
    .optional(),
  API_TIMEOUT: z.coerce
    .number()
    .int()
    .min(1000)
    .max(30000)
    .default(5000)
    .optional(),
  MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2).optional(),
  RETRY_DELAY: z.coerce
    .number()
    .int()
    .min(100)
    .max(10000)
    .default(1000)
    .optional(),
  // Webhook configuration
  WEBHOOK_ENABLED: z.preprocess(
    val => (val === 'true' || val === '1'),
    z.boolean().default(false)
  ),
  WEBHOOK_PORT: z.coerce
    .number()
    .int()
    .min(1024)
    .max(65535)
    .default(3000)
    .optional(),
  WEBHOOK_HOST: z.string().default('0.0.0.0').optional(),
  WEBHOOK_PATH: z.string().default('/webhook/bitnovo').optional(),
  WEBHOOK_MAX_EVENTS: z.coerce
    .number()
    .int()
    .min(100)
    .max(10000)
    .default(1000)
    .optional(),
  WEBHOOK_EVENT_TTL_MS: z.coerce
    .number()
    .int()
    .min(60000) // 1 minute
    .max(86400000) // 24 hours
    .default(3600000) // 1 hour
    .optional(),
  // Tunnel configuration
  TUNNEL_ENABLED: z.preprocess(
    val => (val === 'true' || val === '1'),
    z.boolean().default(true)
  ),
  TUNNEL_PROVIDER: z
    .enum(['ngrok', 'zrok', 'manual'])
    .default('ngrok')
    .optional(),
  // ngrok specific
  NGROK_AUTHTOKEN: z.string().optional(),
  NGROK_DOMAIN: z.string().optional(), // Free static domain
  // zrok specific
  ZROK_TOKEN: z.string().optional(),
  ZROK_UNIQUE_NAME: z.string().optional(), // Reserved share name
  // Manual provider
  WEBHOOK_PUBLIC_URL: z.string().url().optional(), // For manual provider (N8N, Opal, VPS)
  // Tunnel health and reconnection
  TUNNEL_HEALTH_CHECK_INTERVAL: z.coerce
    .number()
    .int()
    .min(30000) // 30 seconds
    .max(300000) // 5 minutes
    .default(60000) // 1 minute
    .optional(),
  TUNNEL_RECONNECT_MAX_RETRIES: z.coerce
    .number()
    .int()
    .min(1)
    .max(20)
    .default(10)
    .optional(),
  TUNNEL_RECONNECT_BACKOFF_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .max(30000)
    .default(5000)
    .optional(),
});

export function validateEnvironmentConfig(
  env: Record<string, string | undefined>
): ValidationResult<z.infer<typeof envConfigSchema>> {
  const result = envConfigSchema.safeParse(env);

  if (!result.success) {
    const firstError = result.error.errors[0] || {
      message: 'Validation failed',
      path: [],
      code: 'custom',
    };
    return {
      success: false,
      error: {
        message: firstError.message,
        field: firstError.path.join('.'),
        code: firstError.code,
      },
    };
  }

  return {
    success: true,
    data: result.data,
  };
}

// Utility functions for common validations
export function isValidUuid(value: string): boolean {
  return uuidSchema.safeParse(value).success;
}

export function isValidCurrencySymbol(value: string): boolean {
  return currencySymbolSchema.safeParse(value).success;
}

export function isValidUrl(value: string): boolean {
  return urlSchema.safeParse(value).success;
}

export function sanitizeNotes(notes: string | undefined): string | undefined {
  if (!notes) return undefined;

  // Trim and limit length
  const trimmed = notes.trim();
  if (trimmed.length === 0) return undefined;

  // Remove potentially dangerous characters (basic XSS prevention)
  const sanitized = trimmed
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .slice(0, 256);

  return sanitized || undefined;
}

export function normalizeAmount(amount: number): number {
  // Round to 2 decimal places to avoid floating point precision issues
  return Math.round(amount * 100) / 100;
}

// Error type mapping for HTTP responses
export function getHttpStatusForValidationError(code: string): number {
  const statusMap: Record<string, number> = {
    INVALID_UUID: 400,
    INVALID_CURRENCY: 400,
    INVALID_URL: 400,
    AMOUNT_BELOW_MINIMUM: 400,
    AMOUNT_ABOVE_MAXIMUM: 400,
    INVALID_STATUS: 400,
    REQUIRED_FIELD: 400,
    INTERNAL_ERROR: 500,
  };

  return statusMap[code] ?? 400;
}
