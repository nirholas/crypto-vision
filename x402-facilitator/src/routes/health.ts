import { Hono } from 'hono';
import { createPublicClient, http } from 'viem';
import { base, arbitrum, mainnet, baseSepolia, arbitrumSepolia } from 'viem/chains';

import type { FacilitatorConfig, HealthResponse, SupportedChainId } from '../types/index.js';
import { getNetworkName } from '../config/chains.js';

const viemChains: Record<number, any> = {
  1: mainnet,
  8453: base,
  84532: baseSepolia,
  42161: arbitrum,
  421614: arbitrumSepolia,
};

const startTime = Date.now();

export function createHealthRoute(config: FacilitatorConfig): Hono {
  const route = new Hono();

  route.get('/', async (c) => {
    const chainStatuses = await Promise.all(
      config.chains.map(async (chain) => {
        try {
          const client = createPublicClient({
            chain: viemChains[chain.chainId],
            transport: http(chain.rpcUrl),
          });
          const blockNumber = await client.getBlockNumber();
          return {
            chainId: chain.chainId as SupportedChainId,
            network: getNetworkName(chain.chainId),
            connected: true,
            blockNumber: Number(blockNumber),
          };
        } catch {
          return {
            chainId: chain.chainId as SupportedChainId,
            network: getNetworkName(chain.chainId),
            connected: false,
          };
        }
      }),
    );

    const allConnected = chainStatuses.every((s) => s.connected);

    const response: HealthResponse = {
      status: allConnected ? 'ok' : 'degraded',
      version: '1.0.0',
      uptime: Math.floor((Date.now() - startTime) / 1000),
      chains: chainStatuses,
    };

    return c.json(response, allConnected ? 200 : 503);
  });

  return route;
}
