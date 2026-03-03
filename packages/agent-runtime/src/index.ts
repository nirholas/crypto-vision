/**
 * @nirholas/erc8004-agent-runtime
 *
 * ERC-8004 agent runtime with A2A messaging and x402 micropayments.
 *
 * Quick start:
 * ```typescript
 * import { ERC8004Agent } from '@nirholas/erc8004-agent-runtime';
 *
 * const agent = new ERC8004Agent({
 *   name: "My Agent",
 *   description: "An AI agent with on-chain identity",
 *   privateKey: process.env.PRIVATE_KEY!,
 *   chain: "bsc-testnet",
 * });
 *
 * agent.onTask("hello", async () => ({
 *   status: "completed",
 *   result: { message: "Hello from ERC-8004!" },
 * }));
 *
 * await agent.start({ port: 3000 });
 * ```
 */

// ─── Main Agent Class ─────────────────────────────────────────────
export { ERC8004Agent } from './agent.js';
export type { AgentStartOptions, AgentEvents } from './agent.js';

// ─── Server ───────────────────────────────────────────────────────
export { createAgentServer } from './server.js';
export type { AgentServerConfig } from './server.js';

// ─── A2A Protocol ─────────────────────────────────────────────────
export { A2AHandler } from './protocols/a2a/handler.js';
export { TaskManager } from './protocols/a2a/taskManager.js';
export { generateAgentCard, generatePricingInfo } from './protocols/a2a/agentCard.js';
export type {
  AgentCard,
  AgentSkill,
  AgentCapability,
  Task,
  TaskState,
  TaskStatus,
  TaskSendParams,
  TaskQueryParams,
  Message,
  MessagePart,
  TextPart,
  FilePart,
  DataPart,
  Artifact,
  A2ARequest,
  A2AResponse,
  A2AError,
  A2AMethod,
  TaskHandler,
} from './protocols/a2a/types.js';
export { A2A_ERROR_CODES } from './protocols/a2a/types.js';

// ─── x402 Protocol ────────────────────────────────────────────────
export { createX402Middleware } from './protocols/x402/middleware.js';
export type { X402MiddlewareConfig } from './protocols/x402/middleware.js';
export { PaymentFacilitator } from './protocols/x402/facilitator.js';
export { PricingManager } from './protocols/x402/pricing.js';
export type {
  X402PricingConfig,
  X402PaymentHeader,
  X402PaymentRequired,
  X402PaymentMethod,
  PaymentVerification,
  PaymentReceipt,
  FacilitatorConfig,
  TokenConfig,
} from './protocols/x402/types.js';
export { BSC_TOKENS, BSC_TESTNET_TOKENS } from './protocols/x402/types.js';

// ─── ERC-8004 Protocol ───────────────────────────────────────────
export { IdentityManager } from './protocols/erc8004/identity.js';
export { ReputationManager } from './protocols/erc8004/reputation.js';
export { ValidationManager } from './protocols/erc8004/validation.js';
export { RegistryReader } from './protocols/erc8004/registry.js';
export type {
  ERC8004Registration,
  ERC8004Service,
  ERC8004RegistrationEntry,
  ERC8004AgentConfig,
  TrustModel,
  AgentIdentity,
  MetadataEntry,
  PricingConfig,
  Feedback,
  ReputationSummary,
  ValidationRecord,
  ValidationStatus,
  RegisteredEvent,
  FeedbackEvent,
} from './protocols/erc8004/types.js';

// ─── Discovery ────────────────────────────────────────────────────
export { searchAgents, fetchAgentCard } from './discovery/search.js';
export type { DiscoveryQuery, DiscoveredAgent } from './discovery/search.js';
export { connectToAgent, callAgent, PaymentRequiredError, A2ACallError } from './discovery/connect.js';
export type { AgentConnection, CallOptions } from './discovery/connect.js';

// ─── Middleware ───────────────────────────────────────────────────
export { createAuthMiddleware } from './middleware/auth.js';
export type { AuthConfig } from './middleware/auth.js';
export { createRateLimitMiddleware } from './middleware/rateLimit.js';
export type { RateLimitConfig } from './middleware/rateLimit.js';
export { createLoggingMiddleware, createLogger } from './middleware/logging.js';
export type { LoggingConfig, LogEntry } from './middleware/logging.js';

// ─── Utilities ────────────────────────────────────────────────────
export { resolveChain, getSupportedChains, getTestnetChains, getMainnetChains, CHAINS } from './utils/chains.js';
export type { ChainConfig } from './utils/chains.js';
export {
  identityRegistry,
  reputationRegistry,
  validationRegistry,
  createProvider,
  createSigner,
  decodeOnChainURI,
  encodeAsDataURI,
  IDENTITY_ABI,
  REPUTATION_ABI,
  VALIDATION_ABI,
  ERC20_ABI,
} from './utils/contracts.js';
export {
  signMessage,
  verifyMessage,
  signTypedData,
  verifyTypedData,
  generateNonce,
  keccak256,
  privateKeyToAddress,
  generateDevPrivateKey,
  signPaymentHeader,
  verifyPaymentHeader,
} from './utils/crypto.js';
