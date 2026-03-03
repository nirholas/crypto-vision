/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// Context Detector - Auto-detect execution environment for optimal tunnel strategy
// Detects: N8N, Opal, VPS/server, Docker, Kubernetes, or local development

import { getLogger } from '../utils/logger.js';
import { TunnelProvider } from './tunnel-manager.js';

const logger = getLogger();

export enum ExecutionContext {
  N8N = 'n8n',
  OPAL = 'opal',
  DOCKER = 'docker',
  KUBERNETES = 'kubernetes',
  SERVER = 'server', // Generic VPS/server with public IP
  LOCAL = 'local', // Local development machine
  UNKNOWN = 'unknown',
}

export interface ContextDetectionResult {
  context: ExecutionContext;
  confidence: number; // 0-1
  suggestedProvider: TunnelProvider;
  indicators: string[];
  publicUrl?: string; // Auto-detected public URL if available
}

/**
 * Detects the current execution context
 */
export function detectContext(): ContextDetectionResult {
  const indicators: string[] = [];
  let context = ExecutionContext.UNKNOWN;
  let confidence = 0;
  let suggestedProvider = TunnelProvider.NGROK; // Default
  let publicUrl: string | undefined;

  // Check for N8N
  if (process.env.N8N_HOST || process.env.N8N_PROTOCOL) {
    context = ExecutionContext.N8N;
    confidence = 0.95;
    suggestedProvider = TunnelProvider.MANUAL;
    indicators.push('N8N_HOST or N8N_PROTOCOL environment variable detected');

    // Try to construct N8N public URL
    const n8nProtocol = process.env.N8N_PROTOCOL || 'https';
    const n8nHost = process.env.N8N_HOST || process.env.WEBHOOK_URL;
    if (n8nHost) {
      publicUrl = `${n8nProtocol}://${n8nHost}`;
      indicators.push(`N8N public URL detected: ${publicUrl}`);
    }
  }

  // Check for Opal
  else if (
    process.env.OPAL_WEBHOOK_URL ||
    process.env.OPAL_HOST ||
    process.cwd().includes('opal')
  ) {
    context = ExecutionContext.OPAL;
    confidence = 0.9;
    suggestedProvider = TunnelProvider.MANUAL;
    indicators.push('Opal environment detected');

    publicUrl = process.env.OPAL_WEBHOOK_URL || process.env.OPAL_HOST;
    if (publicUrl) {
      indicators.push(`Opal public URL detected: ${publicUrl}`);
    }
  }

  // Check for Kubernetes
  else if (
    process.env.KUBERNETES_SERVICE_HOST ||
    process.env.KUBERNETES_PORT
  ) {
    context = ExecutionContext.KUBERNETES;
    confidence = 0.95;
    suggestedProvider = TunnelProvider.MANUAL;
    indicators.push('Kubernetes service host detected');

    // Look for ingress/service URL
    publicUrl =
      process.env.WEBHOOK_URL ||
      process.env.PUBLIC_URL ||
      process.env.INGRESS_HOST;
    if (publicUrl) {
      indicators.push(`Kubernetes public URL detected: ${publicUrl}`);
    }
  }

  // Check for Docker
  else if (
    process.env.DOCKER_HOST ||
    process.env.HOSTNAME?.match(/^[a-f0-9]{12}$/) ||
    require('fs').existsSync('/.dockerenv')
  ) {
    context = ExecutionContext.DOCKER;
    confidence = 0.85;
    indicators.push('Docker environment detected');

    // Docker could be local or server - check for public URL
    publicUrl = process.env.WEBHOOK_URL || process.env.PUBLIC_URL;
    if (publicUrl) {
      suggestedProvider = TunnelProvider.MANUAL;
      indicators.push(`Docker with public URL: ${publicUrl}`);
    } else {
      // Docker in local dev - use tunnel
      suggestedProvider = TunnelProvider.NGROK;
      indicators.push('Docker in local development mode');
    }
  }

  // Check for generic server (VPS, cloud instance)
  else if (isServerEnvironment()) {
    context = ExecutionContext.SERVER;
    confidence = 0.8;
    indicators.push('Server environment detected');

    // Look for configured public URL
    publicUrl = process.env.WEBHOOK_URL || process.env.PUBLIC_URL;
    if (publicUrl) {
      suggestedProvider = TunnelProvider.MANUAL;
      indicators.push(`Server with public URL: ${publicUrl}`);
    } else {
      // Server without explicit URL - check if we can detect external IP
      suggestedProvider = TunnelProvider.NGROK; // Fallback to tunnel
      indicators.push('Server without explicit public URL');
    }
  }

  // Local development
  else {
    context = ExecutionContext.LOCAL;
    confidence = 0.7;
    suggestedProvider = TunnelProvider.NGROK;
    indicators.push('Local development environment detected');
  }

  const result: ContextDetectionResult = {
    context,
    confidence,
    suggestedProvider,
    indicators,
    publicUrl,
  };

  logger.info('Execution context detected', {
    context,
    confidence,
    suggestedProvider,
    indicatorCount: indicators.length,
    operation: 'context_detection',
  });

  return result;
}

/**
 * Detects if running in a server environment (VPS, cloud instance)
 */
function isServerEnvironment(): boolean {
  const indicators = [
    // Common server environment variables
    process.env.SERVER_NAME,
    process.env.SERVER_ADDR,
    process.env.HOSTNAME?.includes('server'),
    process.env.HOSTNAME?.includes('vps'),
    process.env.HOSTNAME?.includes('cloud'),

    // Cloud provider indicators
    process.env.AWS_EXECUTION_ENV,
    process.env.GCP_PROJECT,
    process.env.AZURE_HTTP_USER_AGENT,

    // PM2 process manager (common on servers)
    process.env.PM2_HOME,
    process.env.PM2_JSON_PROCESSING,

    // systemd (Linux servers)
    process.env.INVOCATION_ID,

    // Check if running as a service (not interactive terminal)
    !process.stdin.isTTY,
  ];

  // Count positive indicators
  const positiveCount = indicators.filter(Boolean).length;

  // Need at least 2 indicators to be confident it's a server
  return positiveCount >= 2;
}

/**
 * Validates if a detected public URL is actually accessible
 */
export async function validatePublicUrl(
  url: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch(url + '/health', {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      return { valid: true };
    } else {
      return {
        valid: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

/**
 * Gets recommended tunnel configuration based on context
 */
export function getRecommendedTunnelConfig(
  detectionResult: ContextDetectionResult
): {
  provider: TunnelProvider;
  reason: string;
  publicUrl?: string;
} {
  const { context, suggestedProvider, publicUrl } = detectionResult;

  let reason = '';

  switch (context) {
    case ExecutionContext.N8N:
      reason =
        'N8N environment detected. Use manual provider with N8N webhook URL.';
      break;

    case ExecutionContext.OPAL:
      reason =
        'Opal environment detected. Use manual provider with Opal webhook URL.';
      break;

    case ExecutionContext.KUBERNETES:
      reason =
        'Kubernetes environment detected. Use manual provider with ingress URL.';
      break;

    case ExecutionContext.DOCKER:
      reason = publicUrl
        ? 'Docker with public URL. Use manual provider.'
        : 'Docker in local development. Use ngrok tunnel.';
      break;

    case ExecutionContext.SERVER:
      reason = publicUrl
        ? 'Server with public URL. Use manual provider.'
        : 'Server without explicit URL. Use ngrok tunnel.';
      break;

    case ExecutionContext.LOCAL:
      reason =
        'Local development environment. Use ngrok tunnel with persistent domain.';
      break;

    default:
      reason = 'Unknown environment. Defaulting to ngrok tunnel.';
  }

  return {
    provider: suggestedProvider,
    reason,
    publicUrl,
  };
}

export default detectContext;