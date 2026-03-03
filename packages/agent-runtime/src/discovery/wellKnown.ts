/**
 * .well-known Discovery Endpoints
 *
 * Serves /.well-known/agent.json and related discovery documents.
 */

import type { Context } from 'hono';
import type { AgentCard } from '../protocols/a2a/types.js';
import type { ReputationSummary } from '../protocols/erc8004/types.js';

export interface WellKnownConfig {
  agentCard: AgentCard;
  reputationSummary?: ReputationSummary;
  pricing?: Record<string, { price: string; token: string }>;
}

/**
 * Handle /.well-known/agent.json request.
 */
export function handleAgentJson(config: WellKnownConfig) {
  return (c: Context) => {
    c.header('Content-Type', 'application/json');
    c.header('Cache-Control', 'public, max-age=300');
    c.header('Access-Control-Allow-Origin', '*');
    return c.json(config.agentCard);
  };
}

/**
 * Handle /.well-known/agent-card.json (alternative discovery).
 */
export function handleAgentCardJson(config: WellKnownConfig) {
  return (c: Context) => {
    c.header('Content-Type', 'application/json');
    c.header('Cache-Control', 'public, max-age=300');
    c.header('Access-Control-Allow-Origin', '*');
    return c.json({
      ...config.agentCard,
      pricing: config.pricing,
      reputation: config.reputationSummary,
    });
  };
}

/**
 * Handle /.well-known/reputation request.
 */
export function handleReputation(config: WellKnownConfig) {
  return (c: Context) => {
    c.header('Content-Type', 'application/json');
    c.header('Cache-Control', 'public, max-age=60');
    c.header('Access-Control-Allow-Origin', '*');

    if (!config.reputationSummary) {
      return c.json({ error: 'Reputation not available' }, 404);
    }

    return c.json(config.reputationSummary);
  };
}

/**
 * Handle /health endpoint.
 */
export function handleHealth(
  agentCard: AgentCard,
  startTime: number
) {
  return (c: Context) => {
    return c.json({
      status: 'healthy',
      agent: agentCard.name,
      version: agentCard.version,
      uptime: Math.floor((Date.now() - startTime) / 1000),
      erc8004: agentCard.erc8004
        ? {
            agentId: agentCard.erc8004.agentId,
            chain: agentCard.erc8004.chain,
            registered: true,
          }
        : { registered: false },
    });
  };
}
