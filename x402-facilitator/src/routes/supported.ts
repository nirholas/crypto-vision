import { Hono } from 'hono';

import type { FacilitatorConfig, SupportedChainId } from '../types/index.js';
import { getNetworkName } from '../config/chains.js';
import { getTokensForChain } from '../config/tokens.js';

/**
 * GET /supported — returns payment kinds supported by this facilitator.
 * Required by the x402 SDK for discovery.
 * Response matches SupportedPaymentKindsResponseSchema: { kinds: [{ x402Version, scheme, network }] }
 */
export function createSupportedRoute(config: FacilitatorConfig): Hono {
  const route = new Hono();

  route.get('/', (c) => {
    const kinds = config.chains.flatMap((chain) => {
      const tokens = getTokensForChain(chain.chainId);
      return tokens.map((token) => ({
        x402Version: 1,
        scheme: 'exact' as const,
        network: getNetworkName(chain.chainId as SupportedChainId),
        extra: {
          name: token.symbol,
          decimals: token.decimals,
          token: token.address,
        },
      }));
    });

    return c.json({ kinds });
  });

  return route;
}
