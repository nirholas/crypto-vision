import { Hono } from 'hono';

import type { Facilitator } from '../core/facilitator.js';
import type { FacilitatorConfig, FacilitatorInfo, SupportedChainId } from '../types/index.js';
import { getNetworkName } from '../config/chains.js';
import { getTokensForChain } from '../config/tokens.js';

export function createInfoRoute(facilitator: Facilitator, config: FacilitatorConfig): Hono {
  const route = new Hono();

  route.get('/', (c) => {
    const info: FacilitatorInfo = {
      name: 'SperaxOS x402 Facilitator',
      version: '1.0.0',
      x402Version: 1,
      facilitatorAddress: facilitator.getAddress(),
      supportedChains: config.chains.map((chain) => ({
        chainId: chain.chainId as SupportedChainId,
        network: getNetworkName(chain.chainId),
        tokens: getTokensForChain(chain.chainId),
      })),
      operator: {
        name: 'SperaxOS',
        url: 'https://chat.sperax.io',
      },
    };

    return c.json(info);
  });

  return route;
}
