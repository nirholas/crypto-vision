/**
 * ERC-8004 Registry Contract Interactions
 *
 * High-level API for querying the IdentityRegistry.
 */

import { ethers } from 'ethers';
import { type ChainConfig, resolveChain, CHAINS } from '../../utils/chains.js';
import {
  identityRegistry,
  decodeOnChainURI,
} from '../../utils/contracts.js';
import type { AgentIdentity, ERC8004Registration } from './types.js';

export class RegistryReader {
  private readonly chain: ChainConfig;

  constructor(chain: string | number) {
    this.chain = resolveChain(chain);
  }

  /**
   * Get an agent's identity by ID.
   */
  async getAgent(agentId: number): Promise<AgentIdentity | null> {
    const registry = identityRegistry(this.chain);
    try {
      const [owner, uri] = await Promise.all([
        registry.ownerOf(agentId),
        registry.tokenURI(agentId),
      ]);

      const registrationData = decodeOnChainURI(uri) as ERC8004Registration | null;

      return {
        agentId,
        owner,
        agentURI: uri,
        chain: this.chain.name,
        registrationData: registrationData ?? undefined,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get the owner of an agent.
   */
  async getOwner(agentId: number): Promise<string | null> {
    const registry = identityRegistry(this.chain);
    try {
      return await registry.ownerOf(agentId);
    } catch {
      return null;
    }
  }

  /**
   * Search for agents by service type (scans recent registrations).
   */
  async findAgentsByService(
    serviceType: string,
    maxResults = 50
  ): Promise<AgentIdentity[]> {
    const registry = identityRegistry(this.chain);
    const filter = registry.filters.Registered();
    const events = await registry.queryFilter(filter, -10000); // Last 10k blocks

    const agents: AgentIdentity[] = [];

    for (const event of events.slice(-maxResults * 2)) {
      try {
        const parsedLog = registry.interface.parseLog({
          topics: [...event.topics],
          data: event.data,
        });
        if (!parsedLog) continue;

        const agentId = Number(parsedLog.args[0]);
        const agentURI = parsedLog.args[1];
        const owner = parsedLog.args[2];

        const data = decodeOnChainURI(agentURI) as ERC8004Registration | null;

        if (
          data?.services?.some(
            (s) => s.name.toLowerCase() === serviceType.toLowerCase()
          )
        ) {
          agents.push({
            agentId,
            owner,
            agentURI,
            chain: this.chain.name,
            registrationData: data,
          });
        }

        if (agents.length >= maxResults) break;
      } catch {
        continue;
      }
    }

    return agents;
  }

  /**
   * Get agent metadata.
   */
  async getMetadata(
    agentId: number,
    key: string
  ): Promise<string | null> {
    const registry = identityRegistry(this.chain);
    try {
      const data = await registry.getMetadata(agentId, key);
      return ethers.toUtf8String(data);
    } catch {
      return null;
    }
  }

  /**
   * Search for agents across all supported chains.
   */
  static async searchAllChains(
    serviceType: string,
    maxResults = 10
  ): Promise<AgentIdentity[]> {
    const allAgents: AgentIdentity[] = [];

    const searches = Object.keys(CHAINS).map(async (chainKey) => {
      try {
        const reader = new RegistryReader(chainKey);
        const agents = await reader.findAgentsByService(serviceType, maxResults);
        return agents;
      } catch {
        return [];
      }
    });

    const results = await Promise.allSettled(searches);
    for (const result of results) {
      if (result.status === 'fulfilled') {
        allAgents.push(...result.value);
      }
    }

    return allAgents.slice(0, maxResults);
  }
}
