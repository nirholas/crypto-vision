/**
 * Multi-Agent Worker Example
 *
 * A specialized worker agent that the orchestrator can delegate to.
 *
 * Usage:
 *   PRIVATE_KEY=0x... npx tsx examples/multi-agent/worker.ts
 */

import { ERC8004Agent } from '../../src/index.js';

const worker = new ERC8004Agent({
  name: 'Token Analysis Worker',
  description: 'Specialized agent for token analysis — designed to be called by orchestrators',
  privateKey: process.env.PRIVATE_KEY!,
  chain: 'bsc-testnet',
  capabilities: ['analysis/token', 'analysis/risk'],
  pricing: {
    'analysis/token': { price: '0.0005', token: 'USDC' },
    'analysis/risk': { price: '0.001', token: 'USDC' },
  },
  trust: ['reputation'],
});

worker.onTask('analysis/token', async (task) => {
  const data = (task.message?.parts.find(
    (p) => p.type === 'data'
  ) as any)?.data;
  const token = data?.token ?? 'BNB';

  // Simulated analysis
  return {
    status: 'completed',
    result: {
      token,
      metrics: {
        marketCap: '$95B',
        volume24h: '$2.1B',
        holders: '1.2M',
        tvl: '$5.8B',
        volatility30d: '18.5%',
      },
      sentiment: {
        social: 'positive',
        onChain: 'accumulation',
        technical: 'bullish',
      },
    },
  };
});

worker.onTask('analysis/risk', async (task) => {
  const data = (task.message?.parts.find(
    (p) => p.type === 'data'
  ) as any)?.data;
  const token = data?.token ?? 'BNB';

  return {
    status: 'completed',
    result: {
      token,
      riskLevel: 'medium',
      riskScore: 4.2, // out of 10
      factors: [
        { factor: 'Smart contract risk', score: 2, note: 'Audited by multiple firms' },
        { factor: 'Market risk', score: 5, note: 'High correlation with BTC' },
        { factor: 'Liquidity risk', score: 3, note: 'Deep liquidity pools' },
        { factor: 'Regulatory risk', score: 6, note: 'Evolving regulatory landscape' },
      ],
    },
  };
});

await worker.start({
  port: 3003,
  skipRegistration: !process.env.PRIVATE_KEY,
  devMode: !process.env.PRIVATE_KEY,
});
