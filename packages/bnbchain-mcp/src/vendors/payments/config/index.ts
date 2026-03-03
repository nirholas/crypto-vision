/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// Configuration management with environment variable validation and defaults

import type { Configuration } from '../types/index.js';

const requiredEnvVars = ['UNIVERSAL_CRYPTO_DEVICE_ID', 'UNIVERSAL_CRYPTO_BASE_URL'] as const;

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

function validateEnvironment(): void {
  const missing: string[] = [];

  for (const varName of requiredEnvVars) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    throw new ConfigurationError(
      `Missing required environment variables: ${missing.join(', ')}. ` +
        'Please configure these in your .mcp.json env section.'
    );
  }
}

function parseNumber(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function validateDeviceId(deviceId: string): void {
  if (deviceId.length < 8) {
    throw new ConfigurationError(
      'UNIVERSAL_CRYPTO_DEVICE_ID must be at least 8 characters'
    );
  }
  // Additional validation can be added here
}

function validateBaseUrl(baseUrl: string): void {
  try {
    const url = new URL(baseUrl);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('Invalid protocol');
    }
  } catch {
    throw new ConfigurationError(
      `UNIVERSAL_CRYPTO_BASE_URL must be a valid HTTP/HTTPS URL, got: ${baseUrl}`
    );
  }
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) return defaultValue;
  return value === 'true' || value === '1';
}

export function loadConfiguration(): Configuration {
  validateEnvironment();

  const deviceId = process.env.UNIVERSAL_CRYPTO_DEVICE_ID!;
  const baseUrl = process.env.UNIVERSAL_CRYPTO_BASE_URL!;

  // Validate critical configuration
  validateDeviceId(deviceId);
  validateBaseUrl(baseUrl);

  const config: Configuration = {
    deviceId,
    baseUrl,
    deviceSecret: process.env.UNIVERSAL_CRYPTO_DEVICE_SECRET,
    logLevel: process.env.LOG_LEVEL || 'info',
    nodeEnv: process.env.NODE_ENV || 'production',
    // Optimized defaults based on testing and analysis
    apiTimeout: parseNumber(process.env.API_TIMEOUT, 10000), // Increased for better reliability
    maxRetries: parseNumber(process.env.MAX_RETRIES, 3), // Increased for better resilience
    retryDelay: parseNumber(process.env.RETRY_DELAY, 1500), // Slightly increased for stability
    // Webhook configuration
    webhookEnabled: parseBoolean(process.env.WEBHOOK_ENABLED, false),
    webhookPort: parseNumber(process.env.WEBHOOK_PORT, 3000),
    webhookHost: process.env.WEBHOOK_HOST || '0.0.0.0',
    webhookPath: process.env.WEBHOOK_PATH || '/webhook/bitnovo',
    // Tunnel configuration
    tunnelEnabled: parseBoolean(process.env.TUNNEL_ENABLED, true),
    tunnelProvider: (process.env.TUNNEL_PROVIDER as 'ngrok' | 'zrok' | 'manual') || 'ngrok',
    tunnelPublicUrl: process.env.WEBHOOK_PUBLIC_URL,
    ngrokAuthToken: process.env.NGROK_AUTHTOKEN,
    ngrokDomain: process.env.NGROK_DOMAIN,
    zrokToken: process.env.ZROK_TOKEN,
    zrokUniqueName: process.env.ZROK_UNIQUE_NAME,
    tunnelHealthCheckInterval: parseNumber(process.env.TUNNEL_HEALTH_CHECK_INTERVAL, 60000),
    tunnelReconnectMaxRetries: parseNumber(process.env.TUNNEL_RECONNECT_MAX_RETRIES, 10),
    tunnelReconnectBackoffMs: parseNumber(process.env.TUNNEL_RECONNECT_BACKOFF_MS, 5000),
  };

  // Validate numeric ranges
  if (config.apiTimeout < 1000 || config.apiTimeout > 30000) {
    throw new ConfigurationError(
      'API_TIMEOUT must be between 1000ms and 30000ms'
    );
  }

  if (config.maxRetries < 0 || config.maxRetries > 5) {
    throw new ConfigurationError('MAX_RETRIES must be between 0 and 5');
  }

  if (config.retryDelay < 100 || config.retryDelay > 10000) {
    throw new ConfigurationError(
      'RETRY_DELAY must be between 100ms and 10000ms'
    );
  }

  if (config.webhookPort && (config.webhookPort < 1024 || config.webhookPort > 65535)) {
    throw new ConfigurationError(
      'WEBHOOK_PORT must be between 1024 and 65535'
    );
  }

  return config;
}

export function getMaskedConfig(
  config: Configuration
): Record<string, unknown> {
  return {
    deviceId: maskDeviceId(config.deviceId),
    baseUrl: config.baseUrl,
    hasDeviceSecret: !!config.deviceSecret,
    logLevel: config.logLevel,
    nodeEnv: config.nodeEnv,
    apiTimeout: config.apiTimeout,
    maxRetries: config.maxRetries,
    retryDelay: config.retryDelay,
  };
}

export function maskDeviceId(deviceId: string): string {
  if (deviceId.length <= 8) {
    return '****';
  }
  return `${deviceId.slice(0, 4)}****${deviceId.slice(-4)}`;
}

// Global configuration instance
let globalConfig: Configuration | null = null;

export function getConfig(): Configuration {
  if (!globalConfig) {
    globalConfig = loadConfiguration();
  }
  return globalConfig;
}

export function resetConfig(): void {
  globalConfig = null;
}

// Environment helpers
export function isDevelopment(): boolean {
  return getConfig().nodeEnv === 'development';
}

export function isProduction(): boolean {
  return getConfig().nodeEnv === 'production';
}

export function isTest(): boolean {
  return getConfig().nodeEnv === 'test';
}
