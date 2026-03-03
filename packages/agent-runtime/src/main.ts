// src/main.ts — Executable entry point for the agent runtime
import { ERC8004Agent } from './agent.js';

const agent = new ERC8004Agent({
  name: process.env.AGENT_NAME || 'BNB Chain AI Agent',
  description: process.env.AGENT_DESCRIPTION || 'An autonomous AI agent on BNB Chain with on-chain identity, reputation, and x402 micropayments.',
  privateKey: process.env.PRIVATE_KEY || '',
  chain: process.env.CHAIN || 'bsc-testnet',
  capabilities: ['chat', 'analysis', 'on-chain-execution'],
  services: [
    {
      name: 'A2A',
      endpoint: process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`,
    },
  ],
});

// Register default task handler
agent.onDefault(async (task) => {
  const text = task.message?.parts?.[0]?.type === 'text'
    ? (task.message.parts[0] as { type: 'text'; text: string }).text
    : '';

  return {
    status: 'completed' as const,
    result: { response: `[${agent.config.name}] Received: "${text}". Agent is running on ${agent.config.chain} with on-chain identity.` },
    message: `Processed message: "${text}"`,
  };
});

// Start
const port = parseInt(process.env.PORT || '3000');
agent.start({
  port,
  skipRegistration: !process.env.PRIVATE_KEY,
  devMode: !process.env.PRIVATE_KEY,
  baseUrl: process.env.BASE_URL,
}).then(() => {
  console.log(`Agent "${agent.config.name}" started on port ${port}`);
  console.log(`  Chain: ${agent.config.chain}`);
  console.log(`  Dev mode: ${!process.env.PRIVATE_KEY}`);
  console.log(`  A2A endpoint: http://localhost:${port}/a2a`);
  console.log(`  Agent card: http://localhost:${port}/.well-known/agent.json`);
  console.log(`  Health: http://localhost:${port}/health`);
}).catch((err) => {
  console.error('Failed to start agent:', err);
  process.exit(1);
});
