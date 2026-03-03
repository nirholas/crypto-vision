/**
 * Agent Discovery
 *
 * Search for other ERC-8004 registered agents on-chain.
 */

import { RegistryReader } from '../protocols/erc8004/registry.js';
import { ReputationManager } from '../protocols/erc8004/reputation.js';
import type { AgentIdentity, ERC8004Registration } from '../protocols/erc8004/types.js';
import type { AgentCard } from '../protocols/a2a/types.js';

export interface DiscoveryQuery {
  /** Service type to search for (A2A, MCP, web, etc.) */
  service?: string;
  /** Minimum reputation score */
  minReputation?: number;
  /** Chain to search on */
  chain: string;
  /** Max results */
  maxResults?: number;
  /** Only return agents with x402 support */
  x402Only?: boolean;
  /** Required trust models */
  trustModels?: string[];
}

export interface DiscoveredAgent {
  agentId: number;
  name: string;
  description: string;
  owner: string;
  chain: string;
  endpoint?: string;
  reputation?: number;
  x402Support: boolean;
  services: { name: string; endpoint: string }[];
  trustModels: string[];
}

/**
 * Search for agents matching criteria.
 */
export async function searchAgents(
  query: DiscoveryQuery
): Promise<DiscoveredAgent[]> {
  const reader = new RegistryReader(query.chain);
  const repManager = new ReputationManager(query.chain);

  // Search by service type or get all recent registrations
  const agents = query.service
    ? await reader.findAgentsByService(query.service, query.maxResults ?? 50)
    : await reader.findAgentsByService('A2A', query.maxResults ?? 50);

  const discovered: DiscoveredAgent[] = [];

  for (const agent of agents) {
    const reg = agent.registrationData as ERC8004Registration | undefined;
    if (!reg) continue;

    // Filter by x402 support
    if (query.x402Only && !reg.x402Support) continue;

    // Filter by trust models
    if (query.trustModels?.length) {
      const hasRequired = query.trustModels.every((t) =>
        reg.supportedTrust.includes(t as any)
      );
      if (!hasRequired) continue;
    }

    // Check reputation
    let reputation: number | undefined;
    if (query.minReputation !== undefined) {
      try {
        reputation = await repManager.getAverageScore(agent.agentId);
        if (reputation < query.minReputation) continue;
      } catch {
        continue; // Can't verify reputation
      }
    }

    // Find primary endpoint
    const a2aService = reg.services.find((s) => s.name === 'A2A');
    const primaryEndpoint = a2aService?.endpoint ?? reg.services[0]?.endpoint;

    discovered.push({
      agentId: agent.agentId,
      name: reg.name,
      description: reg.description,
      owner: agent.owner,
      chain: query.chain,
      endpoint: primaryEndpoint,
      reputation,
      x402Support: reg.x402Support,
      services: reg.services.map((s) => ({ name: s.name, endpoint: s.endpoint })),
      trustModels: reg.supportedTrust,
    });

    if (discovered.length >= (query.maxResults ?? 50)) break;
  }

  return discovered;
}

/**
 * Fetch an agent card from a remote agent's .well-known endpoint.
 */
export async function fetchAgentCard(
  endpoint: string
): Promise<AgentCard | null> {
  const urls = [
    `${endpoint}/.well-known/agent.json`,
    `${endpoint}/.well-known/agent-card.json`,
  ];

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10000),
      });
      if (response.ok) {
        return (await response.json()) as AgentCard;
      }
    } catch {
      continue;
    }
  }

  return null;
}
