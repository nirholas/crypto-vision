/**
 * Paid Agent Example
 *
 * An ERC-8004 agent with x402 micropayments per request.
 *
 * Usage:
 *   PRIVATE_KEY=0x... npx tsx examples/paid-agent/index.ts
 */

import { ERC8004Agent } from '../../src/index.js';

const agent = new ERC8004Agent({
  name: 'Premium Analysis Agent',
  description: 'AI-powered market analysis with x402 micropayments',
  privateKey: process.env.PRIVATE_KEY!,
  chain: 'bsc-testnet',
  capabilities: ['analysis', 'prediction'],

  // x402 pricing per endpoint
  pricing: {
    'analysis/basic': { price: '0.0001', token: 'USDC' },
    'analysis/detailed': { price: '0.001', token: 'USDC' },
    'prediction/price': { price: '0.005', token: 'USDC' },
  },

  trust: ['reputation', 'crypto-economic'],
});

// Basic analysis — cheapest tier
agent.onTask('analysis/basic', async (task) => {
  const data = (task.message?.parts.find(
    (p) => p.type === 'data'
  ) as any)?.data;
  const token = data?.token ?? 'BNB';

  return {
    status: 'completed',
    result: {
      token,
      analysis: 'basic',
      sentiment: 'bullish',
      confidence: 0.72,
      timestamp: new Date().toISOString(),
    },
  };
});

// Detailed analysis — mid tier
agent.onTask('analysis/detailed', async (task) => {
  const data = (task.message?.parts.find(
    (p) => p.type === 'data'
  ) as any)?.data;
  const token = data?.token ?? 'BNB';

  return {
    status: 'completed',
    result: {
      token,
      analysis: 'detailed',
      sentiment: 'bullish',
      confidence: 0.85,
      priceTarget: '$750',
      supportLevels: ['$680', '$650', '$620'],
      resistanceLevels: ['$720', '$750', '$800'],
      volume24h: '2.1B',
      recommendation: 'Accumulate on dips',
      timestamp: new Date().toISOString(),
    },
  };
});

// Price prediction — premium tier
agent.onTask('prediction/price', async (task) => {
  const data = (task.message?.parts.find(
    (p) => p.type === 'data'
  ) as any)?.data;
  const token = data?.token ?? 'BNB';
  const timeframe = data?.timeframe ?? '7d';

  return {
    status: 'completed',
    result: {
      token,
      timeframe,
      prediction: {
        low: '$680',
        mid: '$720',
        high: '$780',
        confidence: 0.68,
      },
      factors: [
        'Strong on-chain metrics',
        'Increasing DeFi TVL',
        'Positive market sentiment',
      ],
      timestamp: new Date().toISOString(),
    },
  };
});

await agent.start({
  port: 3001,
  skipRegistration: !process.env.PRIVATE_KEY,
  devMode: !process.env.PRIVATE_KEY,
});
