/**
 * Simple Agent Example
 *
 * Minimal ERC-8004 agent in ~20 lines.
 *
 * Usage:
 *   PRIVATE_KEY=0x... npx tsx examples/simple-agent/index.ts
 */

import { ERC8004Agent } from '../../src/index.js';

const agent = new ERC8004Agent({
  name: 'Hello Agent',
  description: 'A minimal ERC-8004 agent that responds to greetings',
  privateKey: process.env.PRIVATE_KEY!,
  chain: 'bsc-testnet',
  capabilities: ['greeting'],
  trust: ['reputation'],
});

agent.onTask('greeting', async (task) => {
  const name = (task.message?.parts[0] as any)?.text ?? 'World';
  return {
    status: 'completed',
    result: { greeting: `Hello, ${name}! I'm an ERC-8004 agent.` },
  };
});

agent.onDefault(async (task) => {
  return {
    status: 'completed',
    result: { message: 'I received your message!' },
    message: 'Default handler: message received',
  };
});

await agent.start({
  port: 3000,
  skipRegistration: !process.env.PRIVATE_KEY,
  devMode: !process.env.PRIVATE_KEY,
});
