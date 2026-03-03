/**
 * Multi-Agent Orchestrator Example
 *
 * An agent that discovers and delegates work to other ERC-8004 agents.
 *
 * Usage:
 *   PRIVATE_KEY=0x... npx tsx examples/multi-agent/orchestrator.ts
 */

import { ERC8004Agent } from '../../src/index.js';
import type { TaskSendParams } from '../../src/index.js';

const orchestrator = new ERC8004Agent({
  name: 'DeFi Orchestrator',
  description: 'Orchestrates multi-step DeFi tasks by delegating to specialized agents',
  privateKey: process.env.PRIVATE_KEY!,
  chain: 'bsc-testnet',
  capabilities: ['orchestrate', 'portfolio/rebalance', 'portfolio/report'],
  trust: ['reputation'],
});

// Orchestrate a portfolio rebalance across multiple agents
orchestrator.onTask('portfolio/rebalance', async (task: TaskSendParams) => {
  const data = (task.message?.parts.find(
    (p) => p.type === 'data'
  ) as any)?.data;

  // Step 1: Discover analysis agents
  const analysts = await orchestrator.discover({
    service: 'A2A',
    minReputation: 3.0,
  });

  // Step 2: Discover trading agents
  const traders = await orchestrator.discover({
    service: 'A2A',
    minReputation: 4.0,
  });

  // Step 3: Build the rebalance plan
  const plan = {
    portfolio: data?.portfolio ?? ['BNB', 'ETH', 'USDC'],
    analystsFound: analysts.length,
    tradersFound: traders.length,
    steps: [
      { step: 1, action: 'Analyze current positions', agent: analysts[0]?.name ?? 'pending' },
      { step: 2, action: 'Generate rebalance targets', agent: 'self' },
      { step: 3, action: 'Execute trades', agent: traders[0]?.name ?? 'pending' },
      { step: 4, action: 'Verify execution', agent: 'self' },
    ],
  };

  // In production, you would:
  // const analysisResult = await orchestrator.callAgent(analysts[0].endpoint, {
  //   task: 'analysis/detailed',
  //   data: { tokens: plan.portfolio },
  // });

  return {
    status: 'completed',
    result: {
      plan,
      status: 'Plan generated — ready for execution',
      agentsDiscovered: { analysts: analysts.length, traders: traders.length },
    },
    message: `Rebalance plan created with ${analysts.length} analyst(s) and ${traders.length} trader(s)`,
  };
});

// Generate a portfolio report by aggregating data from multiple agents
orchestrator.onTask('portfolio/report', async (task: TaskSendParams) => {
  return {
    status: 'completed',
    result: {
      report: {
        generatedAt: new Date().toISOString(),
        portfolio: {
          BNB: { balance: '10.5', valueUSD: '$7,350', allocation: '45%' },
          ETH: { balance: '2.1', valueUSD: '$5,250', allocation: '32%' },
          USDC: { balance: '3,750', valueUSD: '$3,750', allocation: '23%' },
        },
        totalValue: '$16,350',
        pnl24h: '+3.2%',
        recommendation: 'Portfolio is well-balanced. Consider DCA into BNB.',
      },
    },
  };
});

await orchestrator.start({
  port: 3002,
  skipRegistration: !process.env.PRIVATE_KEY,
  devMode: !process.env.PRIVATE_KEY,
});
