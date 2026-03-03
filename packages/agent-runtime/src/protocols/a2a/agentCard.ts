/**
 * A2A Agent Card Generator
 *
 * Generates the .well-known/agent.json discovery document
 * with ERC-8004 extensions.
 */

import type { AgentCard, AgentSkill, AgentCapability } from './types.js';
import type { ERC8004AgentConfig, PricingConfig } from '../erc8004/types.js';

export interface AgentCardOptions {
  config: ERC8004AgentConfig;
  baseUrl: string;
  agentId?: number;
  agentRegistry?: string;
  version?: string;
}

/**
 * Generate an A2A-compliant agent card with ERC-8004 extensions.
 */
export function generateAgentCard(options: AgentCardOptions): AgentCard {
  const { config, baseUrl, agentId, agentRegistry, version = '1.0.0' } = options;

  const skills: AgentSkill[] = (config.capabilities ?? []).map((cap) => ({
    id: cap,
    name: cap.replace(/[-_]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
    description: `${cap} capability`,
    inputModes: ['application/json'],
    outputModes: ['application/json'],
    tags: [cap],
  }));

  // Add skills from pricing config
  if (config.pricing) {
    for (const [route, pricing] of Object.entries(config.pricing)) {
      const existing = skills.find((s) => s.id === route);
      if (!existing) {
        skills.push({
          id: route,
          name: route.replace(/[/_-]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
          description: `${route} (${pricing.price} ${pricing.token}/request)`,
          inputModes: ['application/json'],
          outputModes: ['application/json'],
          tags: [route.split('/')[0]],
        });
      }
    }
  }

  const capabilities: AgentCapability = {
    streaming: false,
    pushNotifications: false,
    stateTransitionHistory: true,
  };

  const card: AgentCard = {
    name: config.name,
    description: config.description,
    url: baseUrl,
    version,
    capabilities,
    skills,
    defaultInputModes: ['application/json', 'text/plain'],
    defaultOutputModes: ['application/json', 'text/plain'],
    provider: {
      organization: config.name,
      url: baseUrl,
    },
    authentication: {
      schemes: ['x402', 'bearer'],
    },
  };

  // Add ERC-8004 extension
  if (agentId !== undefined && agentRegistry) {
    card.erc8004 = {
      agentId,
      chain: config.chain,
      agentRegistry,
      x402Support: config.pricing !== undefined && Object.keys(config.pricing).length > 0,
      trustModels: config.trust ?? ['reputation'],
    };
  }

  return card;
}

/**
 * Generate pricing info for the agent card.
 */
export function generatePricingInfo(
  pricing: Record<string, PricingConfig>
): Record<string, { price: string; token: string }> {
  const info: Record<string, { price: string; token: string }> = {};
  for (const [route, config] of Object.entries(pricing)) {
    info[route] = { price: config.price, token: config.token };
  }
  return info;
}
