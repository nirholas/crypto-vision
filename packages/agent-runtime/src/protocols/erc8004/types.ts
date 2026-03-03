/**
 * ERC-8004 Protocol Types
 *
 * On-chain agent identity, reputation, and validation types
 * aligned with the ERC-8004 specification.
 *
 * @see https://erc8004.agency
 */

// ─── Registration JSON (agent URI payload) ─────────────────────────

export interface ERC8004Registration {
  type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1';
  name: string;
  description: string;
  image?: string;
  services: ERC8004Service[];
  x402Support: boolean;
  active: boolean;
  registrations: ERC8004RegistrationEntry[];
  supportedTrust: TrustModel[];
}

export interface ERC8004Service {
  name: 'A2A' | 'MCP' | 'web' | 'OASF' | 'ENS' | 'DID' | string;
  endpoint: string;
  version?: string;
}

export interface ERC8004RegistrationEntry {
  agentId: number;
  agentRegistry: string; // CAIP-10: eip155:{chainId}:{contractAddress}
}

export type TrustModel =
  | 'reputation'
  | 'crypto-economic'
  | 'tee-attestation'
  | 'verifiable-credentials';

// ─── Identity Registry ─────────────────────────────────────────────

export interface AgentIdentity {
  agentId: number;
  owner: string;
  agentURI: string;
  chain: string;
  registrationData?: ERC8004Registration;
}

export interface MetadataEntry {
  metadataKey: string;
  metadataValue: string; // hex-encoded bytes
}

// ─── Reputation Registry ───────────────────────────────────────────

export interface Feedback {
  reviewer: string;
  score: number; // int8: -128 to 127
  comment: string;
  timestamp: number;
}

export interface ReputationSummary {
  agentId: number;
  averageScore: number;
  feedbackCount: number;
  recentFeedback: Feedback[];
}

// ─── Validation Registry ───────────────────────────────────────────

export interface ValidationRecord {
  validator: string;
  attestationType: string;
  attestationData: string; // hex
  timestamp: number;
}

export interface ValidationStatus {
  agentId: number;
  validated: boolean;
  records: ValidationRecord[];
}

// ─── Agent Configuration ───────────────────────────────────────────

export interface ERC8004AgentConfig {
  name: string;
  description: string;
  privateKey: string;
  chain: string;
  image?: string;
  capabilities?: string[];
  pricing?: Record<string, PricingConfig>;
  trust?: TrustModel[];
  metadata?: MetadataEntry[];
  services?: ERC8004Service[];
}

export interface PricingConfig {
  price: string;
  token: string;
  tokenAddress?: string;
  decimals?: number;
}

// ─── Events ────────────────────────────────────────────────────────

export interface RegisteredEvent {
  agentId: number;
  agentURI: string;
  owner: string;
  transactionHash: string;
}

export interface FeedbackEvent {
  agentId: number;
  reviewer: string;
  score: number;
  comment: string;
  transactionHash: string;
}
