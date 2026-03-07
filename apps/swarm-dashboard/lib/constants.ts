export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4200';
export const API_V1 = `${API_BASE_URL}/api/v1`;
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4200';
export const SOLANA_NETWORK = (process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'mainnet-beta') as
  | 'mainnet-beta'
  | 'devnet'
  | 'testnet';
export const SOLANA_RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

export const LAMPORTS_PER_SOL = 1_000_000_000;

export const AGENT_ROLES = [
  'creator',
  'bundleBuyer',
  'marketMaker',
  'volumeBot',
  'accumulator',
  'seller',
  'sniper',
  'monitor',
  'coordinator',
  'analyst',
  'exit',
] as const;

export type AgentRole = (typeof AGENT_ROLES)[number];

export const ROLE_COLORS: Record<AgentRole, string> = {
  creator: '#aa66ff',
  bundleBuyer: '#ffaa33',
  marketMaker: '#448aff',
  volumeBot: '#00e676',
  accumulator: '#00bcd4',
  seller: '#ff5252',
  sniper: '#ff9800',
  monitor: '#8b8fa3',
  coordinator: '#e040fb',
  analyst: '#69f0ae',
  exit: '#ff7043',
};

export const ROLE_LABELS: Record<AgentRole, string> = {
  creator: 'Creator',
  bundleBuyer: 'Bundle Buyer',
  marketMaker: 'Market Maker',
  volumeBot: 'Volume Bot',
  accumulator: 'Accumulator',
  seller: 'Seller',
  sniper: 'Sniper',
  monitor: 'Monitor',
  coordinator: 'Coordinator',
  analyst: 'Analyst',
  exit: 'Exit Manager',
};

export const ROLE_DESCRIPTIONS: Record<AgentRole, string> = {
  creator: 'Mints the token on pump.fun',
  bundleBuyer: 'Executes the initial bundle buy via Jito',
  marketMaker: 'Maintains spread, provides liquidity',
  volumeBot: 'Creates wash trading volume',
  accumulator: 'Slowly accumulates tokens over time',
  seller: 'Distributes sell pressure gradually',
  sniper: 'Buys at launch with fast execution',
  monitor: 'Tracks price/MC targets, triggers alerts',
  coordinator: 'Orchestrates phase transitions',
  analyst: 'Computes P&L, metrics, scoring',
  exit: 'Manages exit strategy (graduation or dump)',
};

export const SWARM_PHASES = [
  'idle',
  'configuring',
  'wallet_creation',
  'funding',
  'pre_launch',
  'minting',
  'bundle_buying',
  'post_launch',
  'market_making',
  'volume_generation',
  'accumulation',
  'distribution',
  'monitoring',
  'exit_prep',
  'exiting',
  'cleanup',
  'completed',
  'error',
] as const;

export type SwarmPhase = (typeof SWARM_PHASES)[number];
