/**
 * Agent Skill Types
 *
 * Type system for structured agent skills — composable, discoverable
 * capabilities that agents expose via A2A protocol and ERC-8004 registration.
 *
 * Skills follow the OASF (Open Agent Skills Framework) patterns aligned
 * with the Sperax BNB Chain Toolkit.
 */

import type { TaskSendParams, TaskState } from '../protocols/a2a/types.js';

// ─── Skill Categories ──────────────────────────────────────────────

export type SkillCategory =
  | 'defi'
  | 'trading'
  | 'staking'
  | 'bridge'
  | 'portfolio'
  | 'security'
  | 'market-data'
  | 'nft'
  | 'governance'
  | 'wallet'
  | 'storage'
  | 'identity'
  | 'payments'
  | 'analytics'
  | 'development'
  | 'education'
  | 'social'
  | 'custom';

// ─── Parameter Schemas ─────────────────────────────────────────────

export interface SkillParameterSchema {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required?: boolean;
  default?: unknown;
  enum?: readonly string[];
  items?: SkillParameterSchema;
  properties?: Record<string, SkillParameterSchema>;
}

// ─── Skill Definition ──────────────────────────────────────────────

export interface SkillDefinition {
  /** Unique skill identifier (e.g., "defi/swap", "trading/limit-order") */
  id: string;

  /** Human-readable skill name */
  name: string;

  /** Detailed description of what this skill does */
  description: string;

  /** Skill category for discovery and filtering */
  category: SkillCategory;

  /** Version string (semver) */
  version: string;

  /** Tags for search/discovery */
  tags: string[];

  /** Supported input content types */
  inputModes: string[];

  /** Supported output content types */
  outputModes: string[];

  /** Input parameter schema */
  parameters?: Record<string, SkillParameterSchema>;

  /** Supported blockchain chains (e.g., ["bsc", "ethereum", "opbnb"]) */
  chains?: string[];

  /** Whether this skill requires x402 payment */
  requiresPayment?: boolean;

  /** Required environment variables / API keys */
  requiredConfig?: string[];

  /** Skills this depends on */
  dependencies?: string[];

  /** Examples of usage */
  examples?: SkillExample[];
}

export interface SkillExample {
  name: string;
  input: Record<string, unknown>;
  description?: string;
}

// ─── Skill Result ──────────────────────────────────────────────────

export interface SkillResult {
  status: TaskState;
  result?: Record<string, unknown>;
  message?: string;
}

// ─── Skill Handler ─────────────────────────────────────────────────

export type SkillHandler = (
  params: TaskSendParams,
  context: SkillContext
) => Promise<SkillResult>;

// ─── Skill Context ─────────────────────────────────────────────────

export interface SkillContext {
  /** The chain the agent is operating on */
  chain: string;

  /** Chain ID for the current network */
  chainId: number;

  /** Agent's wallet address */
  agentAddress: string;

  /** Agent's private key (for signing transactions) */
  privateKey: string;

  /** Logger for structured output */
  logger: SkillLogger;

  /** Call another skill within the same agent */
  callSkill: (skillId: string, input: Record<string, unknown>) => Promise<SkillResult>;

  /** Get configuration value */
  getConfig: (key: string) => string | undefined;
}

export interface SkillLogger {
  info: (message: string, data?: Record<string, unknown>) => void;
  warn: (message: string, data?: Record<string, unknown>) => void;
  error: (message: string, data?: Record<string, unknown>) => void;
  debug: (message: string, data?: Record<string, unknown>) => void;
}

// ─── Complete Skill (Definition + Handler) ─────────────────────────

export interface Skill {
  definition: SkillDefinition;
  handler: SkillHandler;
}

// ─── Skill Bundle (group of related skills) ────────────────────────

export interface SkillBundle {
  /** Bundle identifier (e.g., "bnb-defi") */
  id: string;

  /** Human-readable name */
  name: string;

  /** Description of the bundle */
  description: string;

  /** Version string */
  version: string;

  /** Skills in this bundle */
  skills: Skill[];

  /** Required configuration for the entire bundle */
  requiredConfig?: string[];
}

// ─── Skill Discovery Filter ───────────────────────────────────────

export interface SkillFilter {
  category?: SkillCategory;
  chain?: string;
  tags?: string[];
  requiresPayment?: boolean;
  search?: string;
}

// ─── Skill Validation Error ───────────────────────────────────────

export interface SkillValidationError {
  field: string;
  message: string;
  value?: unknown;
}
