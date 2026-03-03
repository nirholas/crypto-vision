/**
 * ERC8004Agent — Main Agent Class
 *
 * The primary developer-facing class for creating ERC-8004 registered agents
 * with A2A messaging and x402 micropayments.
 *
 * @example
 * ```typescript
 * const agent = new ERC8004Agent({
 *   name: "My Trading Agent",
 *   description: "Executes DeFi trades",
 *   privateKey: process.env.PRIVATE_KEY!,
 *   chain: "bsc-testnet",
 *   capabilities: ["trading", "analysis"],
 *   pricing: {
 *     "trading/execute": { price: "0.001", token: "USDC" },
 *   },
 *   trust: ["reputation", "crypto-economic"],
 * });
 *
 * agent.onTask("trading/execute", async (task) => {
 *   return { status: "completed", result: { txHash: "0x..." } };
 * });
 *
 * await agent.start({ port: 3000 });
 * ```
 */

import { EventEmitter } from 'eventemitter3';
import type {
  ERC8004AgentConfig,
  PricingConfig,
  AgentIdentity,
  ERC8004Registration,
  ERC8004Service,
  TrustModel,
  ReputationSummary,
} from './protocols/erc8004/types.js';
import type {
  TaskHandler,
  TaskSendParams,
  TaskState,
  AgentCard,
} from './protocols/a2a/types.js';
import type { DiscoveredAgent, DiscoveryQuery } from './discovery/search.js';
import type { AgentConnection, CallOptions } from './discovery/connect.js';
import { IdentityManager } from './protocols/erc8004/identity.js';
import { ReputationManager } from './protocols/erc8004/reputation.js';
import { ValidationManager } from './protocols/erc8004/validation.js';
import { TaskManager } from './protocols/a2a/taskManager.js';
import { generateAgentCard } from './protocols/a2a/agentCard.js';
import { PricingManager } from './protocols/x402/pricing.js';
import { PaymentFacilitator } from './protocols/x402/facilitator.js';
import { searchAgents, fetchAgentCard } from './discovery/search.js';
import { connectToAgent, callAgent } from './discovery/connect.js';
import { resolveChain } from './utils/chains.js';
import { privateKeyToAddress, generateDevPrivateKey } from './utils/crypto.js';
import { createAgentServer, type AgentServerConfig } from './server.js';
import { createLogger } from './middleware/logging.js';

export interface AgentStartOptions {
  /** Port to listen on (default: 3000) */
  port?: number;
  /** Hostname to bind (default: 0.0.0.0) */
  hostname?: string;
  /** Skip on-chain registration (for development) */
  skipRegistration?: boolean;
  /** Development mode (skips x402 verification) */
  devMode?: boolean;
  /** Base URL override (default: http://hostname:port) */
  baseUrl?: string;
}

export interface AgentEvents {
  'started': (info: { port: number; agentId?: number }) => void;
  'registered': (identity: AgentIdentity) => void;
  'task:received': (params: TaskSendParams) => void;
  'task:completed': (taskId: string, result: unknown) => void;
  'task:failed': (taskId: string, error: Error) => void;
  'payment:received': (payment: { payer: string; amount: string; route: string }) => void;
  'error': (error: Error) => void;
  'stopped': () => void;
}

export class ERC8004Agent extends EventEmitter<AgentEvents> {
  readonly config: ERC8004AgentConfig;
  readonly address: string;

  private readonly identityManager: IdentityManager;
  private readonly reputationManager: ReputationManager;
  private readonly validationManager: ValidationManager;
  private readonly taskManager: TaskManager;
  private readonly pricingManager: PricingManager;
  private readonly facilitator: PaymentFacilitator;
  private readonly logger;

  private _identity: AgentIdentity | null = null;
  private _agentCard: AgentCard | null = null;
  private _server: ReturnType<typeof createAgentServer> | null = null;
  private _running = false;

  constructor(config: ERC8004AgentConfig) {
    super();

    // Generate a random dev key if none provided
    if (!config.privateKey) {
      config = { ...config, privateKey: generateDevPrivateKey() };
    }

    this.config = config;
    this.address = privateKeyToAddress(config.privateKey);
    this.logger = createLogger('ERC8004Agent');

    // Initialize chain config
    const chain = resolveChain(config.chain);

    // Initialize protocol managers
    this.identityManager = new IdentityManager({
      privateKey: config.privateKey,
      chain: config.chain,
    });

    this.reputationManager = new ReputationManager(config.chain, config.privateKey);
    this.validationManager = new ValidationManager(config.chain, config.privateKey);
    this.taskManager = new TaskManager();

    // Initialize x402 pricing
    this.pricingManager = new PricingManager(chain.chainId);
    if (config.pricing) {
      this.pricingManager.addFromConfig(config.pricing);
    }

    // Initialize payment facilitator
    this.facilitator = new PaymentFacilitator({
      chainId: chain.chainId,
      payeeAddress: this.address,
      tokens: [],
    });

    // Wire up task events
    this.taskManager.on('task:completed', (task) => {
      this.emit('task:completed', task.id, task.artifacts);
    });
    this.taskManager.on('task:failed', (task, error) => {
      this.emit('task:failed', task.id, error);
    });
  }

  // ─── Task Handlers ──────────────────────────────────────────────

  /**
   * Register a handler for a task type / skill.
   */
  onTask(
    skillId: string,
    handler: (task: TaskSendParams) => Promise<{ status: TaskState; result?: unknown; message?: string }>
  ): void {
    this.taskManager.registerHandler(skillId, handler);
  }

  /**
   * Register a default handler for unmatched tasks.
   */
  onDefault(
    handler: (task: TaskSendParams) => Promise<{ status: TaskState; result?: unknown; message?: string }>
  ): void {
    this.taskManager.registerHandler('*', handler);
  }

  // ─── Lifecycle ──────────────────────────────────────────────────

  /**
   * Start the agent: register on-chain, start server, enable payments.
   */
  async start(options: AgentStartOptions = {}): Promise<void> {
    const {
      port = 3000,
      hostname = '0.0.0.0',
      skipRegistration = false,
      devMode = false,
      baseUrl,
    } = options;

    const effectiveBaseUrl = baseUrl ?? `http://${hostname === '0.0.0.0' ? 'localhost' : hostname}:${port}`;

    this.logger.info('Starting ERC-8004 agent...', {
      name: this.config.name,
      chain: this.config.chain,
      address: this.address,
    });

    // Step 1: On-chain registration
    if (!skipRegistration) {
      await this.registerOnChain(effectiveBaseUrl);
    } else {
      this.logger.info('Skipping on-chain registration (dev mode)');
    }

    // Step 2: Generate agent card
    this._agentCard = generateAgentCard({
      config: this.config,
      baseUrl: effectiveBaseUrl,
      agentId: this._identity?.agentId,
      agentRegistry: this.identityManager.chainConfig.agentRegistry,
    });

    // Step 3: Build and start server
    const chain = resolveChain(this.config.chain);
    const serverConfig: AgentServerConfig = {
      agentCard: this._agentCard,
      taskManager: this.taskManager,
      pricingManager: this.pricingManager,
      payeeAddress: this.address,
      chainId: chain.chainId,
      chain: this.config.chain,
      devMode,
      identity: this._identity ?? undefined,
      port,
      hostname,
    };

    this._server = createAgentServer(serverConfig);
    this._running = true;

    this.logger.info(`Agent started successfully`, {
      port,
      agentId: this._identity?.agentId,
      skills: this.taskManager.getRegisteredSkills(),
      x402Routes: this.pricingManager.getAllRoutes().map((r) => r.route),
    });

    this.emit('started', { port, agentId: this._identity?.agentId });

    console.log(`\n  ERC-8004 Agent: ${this.config.name}`);
    console.log(`  Address: ${this.address}`);
    console.log(`  Chain: ${this.config.chain}`);
    if (this._identity) {
      console.log(`  Agent ID: ${this._identity.agentId}`);
    }
    console.log(`\n  Server: ${effectiveBaseUrl}`);
    console.log(`  A2A Discovery: ${effectiveBaseUrl}/.well-known/agent.json`);
    console.log(`  Health: ${effectiveBaseUrl}/health`);
    if (this.pricingManager.getAllRoutes().length > 0) {
      console.log(`  x402 Payments: enabled`);
    }
    console.log('');
  }

  /**
   * Stop the agent server.
   */
  async stop(): Promise<void> {
    this._running = false;
    this._server = null;
    this.emit('stopped');
    this.logger.info('Agent stopped');
  }

  // ─── On-chain Registration ─────────────────────────────────────

  /**
   * Register the agent on-chain (or find existing registration).
   */
  private async registerOnChain(baseUrl: string): Promise<void> {
    this.logger.info('Checking for existing on-chain registration...');

    // Check if already registered
    const existing = await this.identityManager.getExistingAgent();
    if (existing) {
      this._identity = existing;
      this.logger.info('Found existing registration', {
        agentId: existing.agentId,
      });

      // Update URI with current service endpoints
      await this.updateServiceEndpoints(baseUrl);
      this.emit('registered', existing);
      return;
    }

    // Register new agent
    this.logger.info('Registering new agent on-chain...');

    const services: ERC8004Service[] = [
      { name: 'A2A', endpoint: `${baseUrl}/.well-known/agent-card.json`, version: '1.0' },
      ...(this.config.services ?? []),
    ];

    try {
      this._identity = await this.identityManager.register({
        name: this.config.name,
        description: this.config.description,
        image: this.config.image,
        services,
        x402Support: this.config.pricing !== undefined && Object.keys(this.config.pricing).length > 0,
        trust: this.config.trust,
        metadata: this.config.metadata,
      });

      this.logger.info('Agent registered on-chain', {
        agentId: this._identity.agentId,
        txHash: 'confirmed',
      });

      this.emit('registered', this._identity);
    } catch (error) {
      this.logger.warn('On-chain registration failed (continuing without)', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Update service endpoints in the on-chain registration.
   */
  private async updateServiceEndpoints(baseUrl: string): Promise<void> {
    if (!this._identity?.registrationData) return;

    const registration = this._identity.registrationData;
    const a2aService = registration.services.find((s) => s.name === 'A2A');

    if (a2aService && a2aService.endpoint !== `${baseUrl}/.well-known/agent-card.json`) {
      a2aService.endpoint = `${baseUrl}/.well-known/agent-card.json`;
      try {
        await this.identityManager.updateURI(registration);
      } catch (error) {
        this.logger.warn('Failed to update service endpoints on-chain', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  // ─── Discovery & Communication ─────────────────────────────────

  /**
   * Discover other agents on-chain.
   */
  async discover(query: Omit<DiscoveryQuery, 'chain'> & { chain?: string }): Promise<DiscoveredAgent[]> {
    return searchAgents({
      ...query,
      chain: query.chain ?? this.config.chain,
    });
  }

  /**
   * Connect to another agent.
   */
  async connect(endpointOrAgentId: string | number): Promise<AgentConnection> {
    if (typeof endpointOrAgentId === 'string') {
      return connectToAgent(endpointOrAgentId);
    }

    // Look up agent by ID on-chain
    const agents = await this.discover({
      maxResults: 1,
    });
    const agent = agents.find((a) => a.agentId === endpointOrAgentId);
    if (!agent?.endpoint) {
      throw new Error(`Agent ${endpointOrAgentId} not found or has no endpoint`);
    }
    return connectToAgent(agent.endpoint, agent.agentId);
  }

  /**
   * Call another agent (with automatic x402 payment).
   */
  async callAgent(
    target: AgentConnection | string,
    options: CallOptions
  ): Promise<unknown> {
    const connection = typeof target === 'string'
      ? await connectToAgent(target)
      : target;

    const chain = resolveChain(this.config.chain);

    return callAgent(connection, options, {
      privateKey: this.config.privateKey,
      chainId: chain.chainId,
    });
  }

  // ─── Reputation ─────────────────────────────────────────────────

  /**
   * Get this agent's reputation.
   */
  async getReputation(): Promise<ReputationSummary | null> {
    if (!this._identity) return null;
    try {
      return await this.reputationManager.getSummary(this._identity.agentId);
    } catch {
      return null;
    }
  }

  /**
   * Submit feedback for another agent.
   */
  async submitFeedback(
    agentId: number,
    score: number,
    comment: string
  ): Promise<string> {
    return this.reputationManager.submitFeedback(agentId, score, comment);
  }

  // ─── Getters ────────────────────────────────────────────────────

  get identity(): AgentIdentity | null {
    return this._identity;
  }

  get agentId(): number | null {
    return this._identity?.agentId ?? null;
  }

  get agentCard(): AgentCard | null {
    return this._agentCard;
  }

  get isRunning(): boolean {
    return this._running;
  }

  get registeredSkills(): string[] {
    return this.taskManager.getRegisteredSkills();
  }

  get taskStats() {
    return this.taskManager.getStats();
  }
}
