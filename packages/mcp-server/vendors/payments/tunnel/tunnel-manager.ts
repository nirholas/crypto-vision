/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// Tunnel Manager - Manages external tunnel providers for webhook access
// Supports: ngrok (persistent URL), zrok (open-source persistent URL), manual (server with public IP)

import ngrok from '@ngrok/ngrok';
import { getLogger } from '../utils/logger.js';

const logger = getLogger();

export enum TunnelProvider {
  NGROK = 'ngrok',
  ZROK = 'zrok',
  MANUAL = 'manual', // For servers with public IP (N8N, Opal, VPS)
}

export enum TunnelStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error',
}

export interface TunnelConfiguration {
  enabled: boolean;
  provider: TunnelProvider;
  localPort: number;
  publicUrl?: string; // For manual provider

  // ngrok specific
  ngrokAuthToken?: string;
  ngrokDomain?: string; // Free static domain

  // zrok specific
  zrokToken?: string;
  zrokUniqueName?: string; // Reserved share name

  // Health monitoring
  healthCheckInterval: number; // ms
  reconnectMaxRetries: number;
  reconnectBackoffMs: number;
}

export interface TunnelInfo {
  provider: TunnelProvider;
  status: TunnelStatus;
  publicUrl: string | null;
  connectedAt: Date | null;
  lastError: string | null;
  reconnectAttempts: number;
  healthCheckEnabled: boolean;
}

/**
 * Abstract base class for tunnel providers
 */
abstract class TunnelProviderBase {
  protected config: TunnelConfiguration;
  protected status: TunnelStatus = TunnelStatus.DISCONNECTED;
  protected publicUrl: string | null = null;
  protected connectedAt: Date | null = null;
  protected lastError: string | null = null;
  protected reconnectAttempts = 0;
  protected healthCheckTimer: NodeJS.Timeout | null = null;

  constructor(config: TunnelConfiguration) {
    this.config = config;
  }

  abstract connect(): Promise<string>;
  abstract disconnect(): Promise<void>;
  abstract checkHealth(): Promise<boolean>;

  getInfo(): TunnelInfo {
    return {
      provider: this.config.provider,
      status: this.status,
      publicUrl: this.publicUrl,
      connectedAt: this.connectedAt,
      lastError: this.lastError,
      reconnectAttempts: this.reconnectAttempts,
      healthCheckEnabled: this.healthCheckTimer !== null,
    };
  }

  protected startHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(async () => {
      try {
        const isHealthy = await this.checkHealth();
        if (!isHealthy) {
          logger.warn('Tunnel health check failed', {
            provider: this.config.provider,
            operation: 'health_check',
          });
          await this.reconnect();
        }
      } catch (error) {
        logger.error(
          'Health check error',
          error instanceof Error ? error : new Error(String(error)),
          {
            provider: this.config.provider,
            operation: 'health_check',
          }
        );
      }
    }, this.config.healthCheckInterval);
  }

  protected stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  protected async reconnect(): Promise<void> {
    if (this.status === TunnelStatus.RECONNECTING) {
      return; // Already reconnecting
    }

    this.status = TunnelStatus.RECONNECTING;
    this.reconnectAttempts++;

    const backoffMs =
      this.config.reconnectBackoffMs * Math.pow(2, this.reconnectAttempts - 1);
    const maxBackoff = 60000; // 1 minute max

    logger.info('Attempting tunnel reconnection', {
      provider: this.config.provider,
      attempt: this.reconnectAttempts,
      backoffMs: Math.min(backoffMs, maxBackoff),
      operation: 'reconnect',
    });

    await new Promise(resolve =>
      setTimeout(resolve, Math.min(backoffMs, maxBackoff))
    );

    try {
      await this.disconnect();
      await this.connect();
      this.reconnectAttempts = 0; // Reset on success
      this.lastError = null;
    } catch (error) {
      this.lastError =
        error instanceof Error ? error.message : 'Reconnection failed';
      logger.error(
        'Tunnel reconnection failed',
        error instanceof Error ? error : new Error(String(error)),
        {
          provider: this.config.provider,
          attempt: this.reconnectAttempts,
          operation: 'reconnect',
        }
      );

      if (this.reconnectAttempts < this.config.reconnectMaxRetries) {
        await this.reconnect(); // Recursive retry with backoff
      } else {
        this.status = TunnelStatus.ERROR;
        logger.error('Tunnel reconnection exhausted', new Error(this.lastError), {
          provider: this.config.provider,
          maxRetries: this.config.reconnectMaxRetries,
          operation: 'reconnect_exhausted',
        });
      }
    }
  }
}

/**
 * ngrok Provider - Persistent URL with free static domain
 * Requires: NGROK_AUTHTOKEN, NGROK_DOMAIN (optional)
 */
class NgrokProvider extends TunnelProviderBase {
  private listener: any = null;

  async connect(): Promise<string> {
    try {
      this.status = TunnelStatus.CONNECTING;

      logger.info('Starting ngrok tunnel', {
        localPort: this.config.localPort,
        domain: this.config.ngrokDomain || 'auto',
        operation: 'ngrok_connect',
      });

      const connectOptions: any = {
        addr: this.config.localPort,
        authtoken: this.config.ngrokAuthToken,
      };

      // Use static domain if provided
      if (this.config.ngrokDomain) {
        connectOptions.domain = this.config.ngrokDomain;
      }

      this.listener = await ngrok.connect(connectOptions);
      this.publicUrl = this.listener.url();
      this.status = TunnelStatus.CONNECTED;
      this.connectedAt = new Date();

      logger.info('ngrok tunnel connected', {
        publicUrl: this.publicUrl,
        operation: 'ngrok_connected',
      });

      this.startHealthCheck();

      if (!this.publicUrl) {
        throw new Error('ngrok public URL not available');
      }
      return this.publicUrl;
    } catch (error) {
      this.status = TunnelStatus.ERROR;
      this.lastError = error instanceof Error ? error.message : 'ngrok failed';
      logger.error(
        'ngrok connection failed',
        error instanceof Error ? error : new Error(String(error)),
        {
          operation: 'ngrok_connect_error',
        }
      );
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.stopHealthCheck();

    if (this.listener) {
      try {
        await this.listener.close();
        logger.info('ngrok tunnel disconnected', {
          operation: 'ngrok_disconnect',
        });
      } catch (error) {
        logger.error(
          'ngrok disconnect error',
          error instanceof Error ? error : new Error(String(error)),
          {
            operation: 'ngrok_disconnect_error',
          }
        );
      }
      this.listener = null;
    }

    this.status = TunnelStatus.DISCONNECTED;
    this.publicUrl = null;
    this.connectedAt = null;
  }

  async checkHealth(): Promise<boolean> {
    // ngrok SDK manages connection internally
    // Check if listener is still valid
    return this.listener !== null && this.status === TunnelStatus.CONNECTED;
  }
}

/**
 * Zrok Provider - Open-source persistent URL with reserved shares
 * Requires: ZROK_TOKEN, ZROK_UNIQUE_NAME
 * URL format: https://{unique_name}.share.zrok.io
 */
class ZrokProvider extends TunnelProviderBase {
  private process: any = null;

  async connect(): Promise<string> {
    try {
      this.status = TunnelStatus.CONNECTING;

      logger.info('Starting zrok tunnel', {
        localPort: this.config.localPort,
        uniqueName: this.config.zrokUniqueName || 'auto',
        operation: 'zrok_connect',
      });

      const { spawn } = await import('child_process');

      // Construct zrok share command
      // zrok share reserved {unique_name}
      const args = ['share', 'reserved', this.config.zrokUniqueName!];

      this.process = spawn('zrok', args, {
        env: {
          ...process.env,
          ZROK_API_ENDPOINT: 'https://api.zrok.io',
        },
      });

      // Parse URL from stdout
      await new Promise<void>((resolve, reject) => {
        let output = '';
        const timeout = setTimeout(() => {
          reject(new Error('zrok connection timeout'));
        }, 30000);

        this.process.stdout.on('data', (data: Buffer) => {
          output += data.toString();
          // Look for URL in output
          const urlMatch = output.match(/https?:\/\/[^\s]+/);
          if (urlMatch) {
            this.publicUrl = urlMatch[0];
            this.status = TunnelStatus.CONNECTED;
            this.connectedAt = new Date();
            clearTimeout(timeout);
            resolve();
          }
        });

        this.process.stderr.on('data', (data: Buffer) => {
          logger.warn('zrok stderr', {
            output: data.toString(),
            operation: 'zrok_stderr',
          });
        });

        this.process.on('error', (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        });

        this.process.on('exit', (code: number) => {
          if (code !== 0 && this.status !== TunnelStatus.CONNECTED) {
            clearTimeout(timeout);
            reject(new Error(`zrok exited with code ${code}`));
          }
        });
      });

      logger.info('zrok tunnel connected', {
        publicUrl: this.publicUrl,
        operation: 'zrok_connected',
      });

      this.startHealthCheck();

      if (!this.publicUrl) {
        throw new Error('zrok public URL not available');
      }
      return this.publicUrl;
    } catch (error) {
      this.status = TunnelStatus.ERROR;
      this.lastError = error instanceof Error ? error.message : 'zrok failed';
      logger.error(
        'zrok connection failed',
        error instanceof Error ? error : new Error(String(error)),
        {
          operation: 'zrok_connect_error',
        }
      );
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.stopHealthCheck();

    if (this.process) {
      try {
        this.process.kill('SIGTERM');
        logger.info('zrok tunnel disconnected', {
          operation: 'zrok_disconnect',
        });
      } catch (error) {
        logger.error(
          'zrok disconnect error',
          error instanceof Error ? error : new Error(String(error)),
          {
            operation: 'zrok_disconnect_error',
          }
        );
      }
      this.process = null;
    }

    this.status = TunnelStatus.DISCONNECTED;
    this.publicUrl = null;
    this.connectedAt = null;
  }

  async checkHealth(): Promise<boolean> {
    // Check if process is still running
    if (!this.process || this.process.killed) {
      return false;
    }

    // Optional: HTTP health check to the public URL
    try {
      const response = await fetch(this.publicUrl + '/health', {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false; // Health check failed
    }
  }
}

/**
 * Manual Provider - For servers with public IP (N8N, Opal, VPS)
 * Requires: WEBHOOK_PUBLIC_URL
 */
class ManualProvider extends TunnelProviderBase {
  async connect(): Promise<string> {
    if (!this.config.publicUrl) {
      throw new Error(
        'Manual provider requires WEBHOOK_PUBLIC_URL to be configured'
      );
    }

    this.status = TunnelStatus.CONNECTED;
    this.publicUrl = this.config.publicUrl;
    this.connectedAt = new Date();

    logger.info('Manual tunnel configured', {
      publicUrl: this.publicUrl,
      operation: 'manual_connect',
    });

    return this.publicUrl;
  }

  async disconnect(): Promise<void> {
    this.status = TunnelStatus.DISCONNECTED;
    logger.info('Manual tunnel disconnected', {
      operation: 'manual_disconnect',
    });
  }

  async checkHealth(): Promise<boolean> {
    // Manual provider doesn't need health checks
    // URL is assumed to be always available
    return true;
  }
}

/**
 * Tunnel Manager - Factory and lifecycle management
 */
export class TunnelManager {
  private provider: TunnelProviderBase | null = null;
  private config: TunnelConfiguration;

  constructor(config: TunnelConfiguration) {
    this.config = config;

    if (!this.config.enabled) {
      logger.info('Tunnel disabled', {
        operation: 'tunnel_manager_init',
      });
      return;
    }

    logger.info('Initializing tunnel manager', {
      provider: this.config.provider,
      operation: 'tunnel_manager_init',
    });
  }

  async start(): Promise<string> {
    if (!this.config.enabled) {
      throw new Error('Tunnel is disabled');
    }

    // Create provider instance
    switch (this.config.provider) {
      case TunnelProvider.NGROK:
        this.provider = new NgrokProvider(this.config);
        break;
      case TunnelProvider.ZROK:
        this.provider = new ZrokProvider(this.config);
        break;
      case TunnelProvider.MANUAL:
        this.provider = new ManualProvider(this.config);
        break;
      default:
        throw new Error(`Unknown tunnel provider: ${this.config.provider}`);
    }

    // Connect tunnel
    const publicUrl = await this.provider.connect();

    logger.info('Tunnel started successfully', {
      provider: this.config.provider,
      publicUrl,
      operation: 'tunnel_started',
    });

    return publicUrl;
  }

  async stop(): Promise<void> {
    if (this.provider) {
      await this.provider.disconnect();
      this.provider = null;
      logger.info('Tunnel stopped', {
        operation: 'tunnel_stopped',
      });
    }
  }

  getInfo(): TunnelInfo | null {
    if (!this.provider) {
      return null;
    }
    return this.provider.getInfo();
  }

  isConnected(): boolean {
    return (
      this.provider !== null &&
      this.provider.getInfo().status === TunnelStatus.CONNECTED
    );
  }

  getPublicUrl(): string | null {
    if (!this.provider) {
      return null;
    }
    return this.provider.getInfo().publicUrl;
  }
}

export default TunnelManager;