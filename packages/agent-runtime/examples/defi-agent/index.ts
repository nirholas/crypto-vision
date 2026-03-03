/**
 * DeFi Agent Example
 *
 * A DeFi trading agent with on-chain reputation and x402 payments.
 *
 * Usage:
 *   PRIVATE_KEY=0x... npx tsx examples/defi-agent/index.ts
 */

import { ERC8004Agent } from '../../src/index.js';

const agent = new ERC8004Agent({
  name: 'DeFi Trading Agent',
  description: 'Executes DeFi trades with verified on-chain identity and reputation tracking',
  privateKey: process.env.PRIVATE_KEY!,
  chain: 'bsc-testnet',

  // A2A capabilities
  capabilities: ['trading', 'analysis', 'portfolio'],

  // x402 pricing per operation
  pricing: {
    'trading/execute': { price: '0.001', token: 'USDC' },
    'trading/quote': { price: '0.0001', token: 'USDC' },
    'analysis/report': { price: '0.0005', token: 'USDC' },
    'portfolio/balance': { price: '0.0001', token: 'USDC' },
  },

  // Trust models
  trust: ['reputation', 'crypto-economic'],
});

// ─── Trading Handlers ─────────────────────────────────────────────

agent.onTask('trading/execute', async (task) => {
  const data = (task.message?.parts.find(
    (p) => p.type === 'data'
  ) as any)?.data;

  const { tokenIn, tokenOut, amount, slippage } = data ?? {};

  // Simulated trade execution
  const trade = {
    status: 'executed',
    tokenIn: tokenIn ?? 'BNB',
    tokenOut: tokenOut ?? 'USDC',
    amountIn: amount ?? '1.0',
    amountOut: '700.50',
    price: '700.50',
    slippage: slippage ?? '0.5%',
    txHash: '0x' + 'a'.repeat(64),
    dex: 'PancakeSwap V3',
    route: [`${tokenIn ?? 'BNB'} → ${tokenOut ?? 'USDC'}`],
    gasUsed: '0.0012 BNB',
    timestamp: new Date().toISOString(),
  };

  return {
    status: 'completed',
    result: trade,
    message: `Swapped ${trade.amountIn} ${trade.tokenIn} for ${trade.amountOut} ${trade.tokenOut}`,
  };
});

agent.onTask('trading/quote', async (task) => {
  const data = (task.message?.parts.find(
    (p) => p.type === 'data'
  ) as any)?.data;

  return {
    status: 'completed',
    result: {
      tokenIn: data?.tokenIn ?? 'BNB',
      tokenOut: data?.tokenOut ?? 'USDC',
      amountIn: data?.amount ?? '1.0',
      quotes: [
        { dex: 'PancakeSwap V3', amountOut: '700.50', gasEstimate: '0.0012 BNB' },
        { dex: 'PancakeSwap V2', amountOut: '699.80', gasEstimate: '0.0015 BNB' },
        { dex: 'Thena', amountOut: '700.10', gasEstimate: '0.0013 BNB' },
      ],
      bestRoute: 'PancakeSwap V3',
      timestamp: new Date().toISOString(),
    },
  };
});

// ─── Analysis Handler ─────────────────────────────────────────────

agent.onTask('analysis/report', async (task) => {
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
      report: {
        price: '$700.50',
        change: '+5.2%',
        high: '$720.00',
        low: '$665.30',
        volume: '$2.1B',
        marketCap: '$95B',
        tvl: '$5.8B',
        dominance: '3.8%',
        indicators: {
          rsi: 62,
          macd: 'bullish crossover',
          ma50: '$680',
          ma200: '$620',
        },
        sentiment: 'moderately bullish',
        generatedAt: new Date().toISOString(),
      },
    },
  };
});

// ─── Portfolio Handler ────────────────────────────────────────────

agent.onTask('portfolio/balance', async (task) => {
  const data = (task.message?.parts.find(
    (p) => p.type === 'data'
  ) as any)?.data;
  const address = data?.address ?? '0x...';

  return {
    status: 'completed',
    result: {
      address,
      chain: 'BSC',
      balances: [
        { token: 'BNB', balance: '10.5', valueUSD: '$7,355.25' },
        { token: 'USDC', balance: '3,750.00', valueUSD: '$3,750.00' },
        { token: 'CAKE', balance: '500', valueUSD: '$1,250.00' },
      ],
      totalValueUSD: '$12,355.25',
      timestamp: new Date().toISOString(),
    },
  };
});

// ─── Event Listeners ──────────────────────────────────────────────

agent.on('registered', (identity) => {
  console.log(`  Registered with Agent ID: ${identity.agentId}`);
});

agent.on('task:completed', (taskId) => {
  console.log(`  Task completed: ${taskId}`);
});

agent.on('task:failed', (taskId, error) => {
  console.error(`  Task failed: ${taskId} — ${error.message}`);
});

// ─── Start ────────────────────────────────────────────────────────

await agent.start({
  port: 3000,
  skipRegistration: !process.env.PRIVATE_KEY,
  devMode: !process.env.PRIVATE_KEY,
});
