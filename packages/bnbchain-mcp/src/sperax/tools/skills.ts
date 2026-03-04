/**
 * Sperax MCP Server - Agent Skills Registry & Tools
 *
 * A comprehensive skills system that maps agent capabilities to concrete MCP tools.
 * Each skill represents a composable capability that agents can declare and execute.
 *
 * Skills are organized into domains (security, defi, trading, etc.) with:
 * - Complexity ratings (1-5)
 * - Required MCP tools for execution
 * - Input/output schemas
 * - Related skills for chaining
 * - Example prompts
 *
 * Total: 48 skills across 12 domains
 */

import { z } from 'zod';

// ============================================================================
// Constants
// ============================================================================

const SKILL_DOMAINS = [
  'security', 'defi', 'trading', 'portfolio', 'analytics',
  'stablecoin', 'staking', 'governance', 'bridge', 'nft',
  'market-data', 'education',
] as const;

type SkillDomain = typeof SKILL_DOMAINS[number];

// ============================================================================
// Types
// ============================================================================

export interface SkillTool {
  /** MCP tool name */
  name: string;
  /** Why this tool is needed for the skill */
  purpose: string;
  /** Whether this tool is required or optional for the skill */
  required: boolean;
}

export interface SkillExample {
  /** Natural language prompt that triggers this skill */
  prompt: string;
  /** Expected tool call sequence */
  toolChain: string[];
}

export interface Skill {
  /** Unique skill identifier (kebab-case) */
  id: string;
  /** Human-readable skill name */
  name: string;
  /** Detailed description of what this skill does */
  description: string;
  /** Skill domain/category */
  domain: SkillDomain;
  /** Complexity rating 1-5 */
  complexity: number;
  /** MCP tools this skill uses */
  tools: SkillTool[];
  /** Input parameters the skill accepts */
  inputSchema: Record<string, { type: string; description: string; required: boolean }>;
  /** What the skill outputs */
  outputFields: string[];
  /** IDs of related/chainable skills */
  relatedSkills: string[];
  /** Example usage prompts */
  examples: SkillExample[];
  /** Tags for filtering */
  tags: string[];
  /** Risk level of this skill */
  riskLevel: 'low' | 'medium' | 'high';
}

// ============================================================================
// Skills Registry
// ============================================================================

export const skillsRegistry: Skill[] = [
  // ── Security Domain ──────────────────────────────────────────────────────
  {
    id: 'token-security-scan',
    name: 'Token Security Scan',
    description: 'Comprehensive token security analysis using GoPlus — checks for honeypots, rug pull indicators, hidden minting, pausability, tax manipulation, and holder concentration.',
    domain: 'security',
    complexity: 2,
    tools: [
      { name: 'security_check_token', purpose: 'Run GoPlus security analysis on a token', required: true },
      { name: 'detect_honeypot', purpose: 'Specifically check for honeypot behavior', required: false },
    ],
    inputSchema: {
      network: { type: 'string', description: 'Blockchain network (e.g., "bsc", "ethereum")', required: false },
      tokenAddress: { type: 'string', description: 'Token contract address to scan', required: true },
    },
    outputFields: ['isHoneypot', 'isMintable', 'buyTax', 'sellTax', 'riskLevel', 'holderCount', 'liquidityLocked'],
    relatedSkills: ['rug-pull-analysis', 'honeypot-detection', 'contract-verification'],
    examples: [
      { prompt: 'Is this token safe? 0x123...abc on BSC', toolChain: ['security_check_token'] },
      { prompt: 'Check if 0xdead...beef is a scam token', toolChain: ['security_check_token', 'detect_honeypot'] },
    ],
    tags: ['security', 'token', 'goplus', 'honeypot', 'rug-pull'],
    riskLevel: 'low',
  },
  {
    id: 'honeypot-detection',
    name: 'Honeypot Detection',
    description: 'Detect honeypot tokens that allow buying but prevent selling. Simulates buy/sell transactions to verify tradability.',
    domain: 'security',
    complexity: 2,
    tools: [
      { name: 'detect_honeypot', purpose: 'Simulate buy/sell to detect honeypot behavior', required: true },
    ],
    inputSchema: {
      network: { type: 'string', description: 'Blockchain network', required: false },
      tokenAddress: { type: 'string', description: 'Token contract address', required: true },
    },
    outputFields: ['isHoneypot', 'honeypotReason', 'simulationResult'],
    relatedSkills: ['token-security-scan', 'rug-pull-analysis'],
    examples: [
      { prompt: 'Is this a honeypot? 0x123...', toolChain: ['detect_honeypot'] },
    ],
    tags: ['security', 'honeypot', 'scam-detection'],
    riskLevel: 'low',
  },
  {
    id: 'rug-pull-analysis',
    name: 'Rug Pull Risk Analysis',
    description: 'Analyze rug pull risk factors including LP lock status, ownership renouncement, holder concentration, suspicious functions, and contract age.',
    domain: 'security',
    complexity: 3,
    tools: [
      { name: 'check_rug_risk', purpose: 'Analyze rug pull risk indicators', required: true },
      { name: 'security_check_token', purpose: 'Get additional security context', required: false },
    ],
    inputSchema: {
      network: { type: 'string', description: 'Blockchain network', required: false },
      tokenAddress: { type: 'string', description: 'Token contract address', required: true },
    },
    outputFields: ['rugPullRisk', 'riskScore', 'lpLocked', 'ownershipRenounced', 'warnings', 'recommendations'],
    relatedSkills: ['token-security-scan', 'honeypot-detection', 'contract-verification'],
    examples: [
      { prompt: 'Check rug pull risk for this new token 0x...', toolChain: ['check_rug_risk', 'security_check_token'] },
    ],
    tags: ['security', 'rug-pull', 'risk', 'analysis'],
    riskLevel: 'low',
  },
  {
    id: 'address-security-check',
    name: 'Address Security Check',
    description: 'Check if a wallet or contract address is flagged for phishing, scam activity, mixer usage, or stolen funds.',
    domain: 'security',
    complexity: 2,
    tools: [
      { name: 'security_check_address', purpose: 'Check address against security databases', required: true },
    ],
    inputSchema: {
      network: { type: 'string', description: 'Blockchain network', required: false },
      address: { type: 'string', description: 'Address to check', required: true },
    },
    outputFields: ['isMalicious', 'riskLevel', 'tags', 'hasPhishingActivity', 'warnings'],
    relatedSkills: ['approval-audit', 'dapp-safety-check'],
    examples: [
      { prompt: 'Is this address safe to interact with? 0x...', toolChain: ['security_check_address'] },
    ],
    tags: ['security', 'address', 'phishing', 'scam'],
    riskLevel: 'low',
  },
  {
    id: 'approval-audit',
    name: 'Token Approval Audit',
    description: 'Audit token approvals for a wallet to identify risky unlimited approvals, revokable permissions, and potential attack vectors.',
    domain: 'security',
    complexity: 2,
    tools: [
      { name: 'security_check_approvals', purpose: 'Audit all token approvals for an address', required: true },
    ],
    inputSchema: {
      network: { type: 'string', description: 'Blockchain network', required: false },
      address: { type: 'string', description: 'Wallet address to audit', required: true },
    },
    outputFields: ['approvals', 'riskySummary', 'revokeRecommendations'],
    relatedSkills: ['address-security-check', 'token-security-scan'],
    examples: [
      { prompt: 'Audit my wallet approvals on Ethereum', toolChain: ['security_check_approvals'] },
    ],
    tags: ['security', 'approvals', 'wallet', 'audit'],
    riskLevel: 'low',
  },
  {
    id: 'dapp-safety-check',
    name: 'dApp Safety Check',
    description: 'Check if a dApp URL is associated with phishing, scams, or impersonation. Verifies SSL, domain age, and known threat databases.',
    domain: 'security',
    complexity: 3,
    tools: [
      { name: 'security_check_dapp', purpose: 'Check dApp URL against phishing databases', required: true },
    ],
    inputSchema: {
      url: { type: 'string', description: 'dApp URL to check', required: true },
    },
    outputFields: ['isSafe', 'riskLevel', 'isPhishing', 'domainAge', 'warnings'],
    relatedSkills: ['address-security-check', 'contract-verification'],
    examples: [
      { prompt: 'Is this dApp URL safe? https://uuniswap.com', toolChain: ['security_check_dapp'] },
    ],
    tags: ['security', 'dapp', 'phishing', 'url'],
    riskLevel: 'low',
  },
  {
    id: 'contract-verification',
    name: 'Contract Verification',
    description: 'Get contract verification status, proxy detection, and metadata from block explorers.',
    domain: 'security',
    complexity: 2,
    tools: [
      { name: 'get_contract_info', purpose: 'Get contract metadata and verification status', required: true },
    ],
    inputSchema: {
      network: { type: 'string', description: 'Blockchain network', required: false },
      address: { type: 'string', description: 'Contract address', required: true },
    },
    outputFields: ['isVerified', 'isProxy', 'compiler', 'sourceCode'],
    relatedSkills: ['token-security-scan', 'rug-pull-analysis'],
    examples: [
      { prompt: 'Is this contract verified? 0x...', toolChain: ['get_contract_info'] },
    ],
    tags: ['security', 'contract', 'verification'],
    riskLevel: 'low',
  },

  // ── DeFi Domain ──────────────────────────────────────────────────────────
  {
    id: 'yield-discovery',
    name: 'Yield Opportunity Discovery',
    description: 'Find and compare yield farming opportunities across DeFi protocols. Filters by chain, TVL, APY, and risk level.',
    domain: 'defi',
    complexity: 2,
    tools: [
      { name: 'defi_get_yields', purpose: 'Fetch yield opportunities from DefiLlama', required: true },
      { name: 'defi_get_protocols', purpose: 'Get protocol context for yield sources', required: false },
    ],
    inputSchema: {
      chain: { type: 'string', description: 'Filter by blockchain (e.g., "Arbitrum")', required: false },
      minTvl: { type: 'number', description: 'Minimum TVL in USD', required: false },
      minApy: { type: 'number', description: 'Minimum APY percentage', required: false },
    },
    outputFields: ['protocols', 'apy', 'tvl', 'chain', 'riskLevel'],
    relatedSkills: ['protocol-analysis', 'tvl-tracking', 'yield-sustainability-check'],
    examples: [
      { prompt: 'Find top yield opportunities on Arbitrum with >$1M TVL', toolChain: ['defi_get_yields'] },
    ],
    tags: ['defi', 'yield', 'farming', 'apy'],
    riskLevel: 'low',
  },
  {
    id: 'protocol-analysis',
    name: 'Protocol Analysis',
    description: 'Deep analysis of DeFi protocols including TVL, fees, revenue, chain coverage, and risk assessment.',
    domain: 'defi',
    complexity: 3,
    tools: [
      { name: 'defi_get_protocol', purpose: 'Get detailed protocol metrics', required: true },
      { name: 'defi_get_fees', purpose: 'Get protocol fee data', required: false },
      { name: 'defi_get_chain_tvl', purpose: 'Get chain-level TVL context', required: false },
    ],
    inputSchema: {
      protocol: { type: 'string', description: 'Protocol name or slug', required: true },
    },
    outputFields: ['tvl', 'fees', 'revenue', 'chains', 'category', 'tvlChange'],
    relatedSkills: ['yield-discovery', 'tvl-tracking'],
    examples: [
      { prompt: 'Analyze Aave protocol metrics', toolChain: ['defi_get_protocol', 'defi_get_fees'] },
    ],
    tags: ['defi', 'protocol', 'tvl', 'analysis'],
    riskLevel: 'low',
  },
  {
    id: 'tvl-tracking',
    name: 'TVL Tracking',
    description: 'Track Total Value Locked across chains and protocols with historical trends.',
    domain: 'defi',
    complexity: 2,
    tools: [
      { name: 'defi_get_chain_tvl', purpose: 'Get TVL by chain', required: true },
      { name: 'defi_get_protocols', purpose: 'Get protocol-level TVL breakdown', required: false },
    ],
    inputSchema: {
      chain: { type: 'string', description: 'Blockchain to track', required: false },
    },
    outputFields: ['totalTvl', 'chainBreakdown', 'protocolBreakdown', 'tvlChange'],
    relatedSkills: ['protocol-analysis', 'yield-discovery'],
    examples: [
      { prompt: 'Show TVL trends for BSC over 30 days', toolChain: ['defi_get_chain_tvl'] },
    ],
    tags: ['defi', 'tvl', 'tracking', 'metrics'],
    riskLevel: 'low',
  },

  // ── Trading Domain ───────────────────────────────────────────────────────
  {
    id: 'swap-execution',
    name: 'Swap Execution',
    description: 'Get DEX swap quotes and execute token swaps with slippage protection and optimal routing.',
    domain: 'trading',
    complexity: 3,
    tools: [
      { name: 'get_swap_quote', purpose: 'Get swap quote from DEX aggregator', required: true },
      { name: 'execute_swap', purpose: 'Execute the token swap', required: false },
      { name: 'get_gas_price', purpose: 'Check gas costs', required: false },
    ],
    inputSchema: {
      fromToken: { type: 'string', description: 'Source token address or symbol', required: true },
      toToken: { type: 'string', description: 'Destination token address or symbol', required: true },
      amount: { type: 'string', description: 'Amount to swap', required: true },
      network: { type: 'string', description: 'Network for the swap', required: false },
    },
    outputFields: ['quote', 'priceImpact', 'gasEstimate', 'route', 'txHash'],
    relatedSkills: ['gas-estimation', 'pool-analysis'],
    examples: [
      { prompt: 'Get a quote to swap 1 ETH for USDC on Arbitrum', toolChain: ['get_swap_quote', 'get_gas_price'] },
    ],
    tags: ['trading', 'swap', 'dex', 'execution'],
    riskLevel: 'high',
  },
  {
    id: 'pool-analysis',
    name: 'Liquidity Pool Analysis',
    description: 'Analyze DEX liquidity pools including reserves, fee tiers, volume, and impermanent loss risk.',
    domain: 'trading',
    complexity: 3,
    tools: [
      { name: 'dex_get_network_pools', purpose: 'List pools on a network', required: true },
      { name: 'dex_get_token_pools', purpose: 'Find pools for a specific token', required: false },
    ],
    inputSchema: {
      network: { type: 'string', description: 'Blockchain network', required: false },
      tokenAddress: { type: 'string', description: 'Token to find pools for', required: false },
    },
    outputFields: ['pools', 'liquidity', 'volume24h', 'fees', 'priceRange'],
    relatedSkills: ['swap-execution', 'yield-discovery'],
    examples: [
      { prompt: 'Find the best liquidity pools for WETH/USDC', toolChain: ['dex_get_token_pools'] },
    ],
    tags: ['trading', 'liquidity', 'pools', 'dex'],
    riskLevel: 'low',
  },
  {
    id: 'gas-estimation',
    name: 'Gas Price Estimation',
    description: 'Get current gas prices with EIP-1559 base fee and priority fee estimates across networks.',
    domain: 'trading',
    complexity: 1,
    tools: [
      { name: 'get_gas_price', purpose: 'Get current gas prices', required: true },
      { name: 'estimate_gas', purpose: 'Estimate gas for a specific transaction', required: false },
    ],
    inputSchema: {
      network: { type: 'string', description: 'Blockchain network', required: false },
    },
    outputFields: ['baseFee', 'priorityFee', 'gasPrice', 'estimatedCostUsd'],
    relatedSkills: ['swap-execution'],
    examples: [
      { prompt: 'What are gas prices on Arbitrum right now?', toolChain: ['get_gas_price'] },
    ],
    tags: ['gas', 'fees', 'estimation'],
    riskLevel: 'low',
  },

  // ── Market Data Domain ───────────────────────────────────────────────────
  {
    id: 'price-tracking',
    name: 'Price Tracking',
    description: 'Get real-time and historical price data for cryptocurrencies from CoinGecko with 24h change, market cap, and volume.',
    domain: 'market-data',
    complexity: 1,
    tools: [
      { name: 'market_get_coins', purpose: 'Get market data for tokens', required: true },
      { name: 'market_get_ohlcv', purpose: 'Get OHLCV candle data', required: false },
    ],
    inputSchema: {
      coinId: { type: 'string', description: 'CoinGecko coin ID (e.g., "bitcoin")', required: true },
    },
    outputFields: ['price', 'change24h', 'marketCap', 'volume24h', 'ohlcv'],
    relatedSkills: ['market-sentiment', 'whale-monitoring'],
    examples: [
      { prompt: 'What is the current ETH price?', toolChain: ['market_get_coins'] },
    ],
    tags: ['market', 'price', 'tracking', 'coingecko'],
    riskLevel: 'low',
  },
  {
    id: 'market-sentiment',
    name: 'Market Sentiment Analysis',
    description: 'Analyze social sentiment for tokens using LunarCrush data — social volume, engagement, galaxy score, and trending status.',
    domain: 'market-data',
    complexity: 2,
    tools: [
      { name: 'social_get_sentiment', purpose: 'Get social sentiment metrics', required: true },
      { name: 'social_get_trending', purpose: 'Get trending tokens', required: false },
    ],
    inputSchema: {
      symbol: { type: 'string', description: 'Token symbol (e.g., "BTC")', required: true },
    },
    outputFields: ['galaxyScore', 'socialVolume', 'sentiment', 'trending'],
    relatedSkills: ['price-tracking', 'news-aggregation'],
    examples: [
      { prompt: 'What is the social sentiment for SOL?', toolChain: ['social_get_sentiment'] },
    ],
    tags: ['sentiment', 'social', 'lunarcrush', 'trending'],
    riskLevel: 'low',
  },
  {
    id: 'whale-monitoring',
    name: 'Whale Activity Monitoring',
    description: 'Track large wallet movements, whale accumulation/distribution patterns, and significant on-chain transfers.',
    domain: 'market-data',
    complexity: 3,
    tools: [
      { name: 'get_token_transfers', purpose: 'Get recent token transfers', required: true },
      { name: 'get_balance', purpose: 'Check whale wallet balances', required: false },
    ],
    inputSchema: {
      network: { type: 'string', description: 'Blockchain network', required: false },
      tokenAddress: { type: 'string', description: 'Token to track', required: true },
    },
    outputFields: ['largeTransfers', 'topHolders', 'accumulationPattern'],
    relatedSkills: ['price-tracking', 'market-sentiment'],
    examples: [
      { prompt: 'Track whale movements for PEPE token', toolChain: ['get_token_transfers'] },
    ],
    tags: ['whale', 'tracking', 'on-chain', 'transfers'],
    riskLevel: 'low',
  },

  // ── Stablecoin Domain ────────────────────────────────────────────────────
  {
    id: 'usds-operations',
    name: 'USDs Stablecoin Operations',
    description: 'Interact with Sperax USDs stablecoin — mint, redeem, check balances, track yield, and monitor peg stability.',
    domain: 'stablecoin',
    complexity: 3,
    tools: [
      { name: 'usds_get_info', purpose: 'Get USDs supply and protocol info', required: true },
      { name: 'usds_get_balance', purpose: 'Check USDs balance for an address', required: false },
      { name: 'usds_get_yield', purpose: 'Get current yield rate', required: false },
      { name: 'vault_get_peg_status', purpose: 'Check peg stability', required: false },
    ],
    inputSchema: {
      address: { type: 'string', description: 'Wallet address (optional, for balance checks)', required: false },
    },
    outputFields: ['totalSupply', 'balance', 'yieldRate', 'pegStatus', 'collateralRatio'],
    relatedSkills: ['vault-monitoring', 'yield-tracking'],
    examples: [
      { prompt: 'How much USDs do I have? 0x123...', toolChain: ['usds_get_balance', 'usds_get_yield'] },
      { prompt: 'Is USDs on peg right now?', toolChain: ['usds_get_info', 'vault_get_peg_status'] },
    ],
    tags: ['sperax', 'usds', 'stablecoin', 'yield'],
    riskLevel: 'low',
  },
  {
    id: 'vault-monitoring',
    name: 'Vault Health Monitoring',
    description: 'Monitor Sperax Vault health including TVL, collateral utilization, strategy performance, and risk metrics.',
    domain: 'stablecoin',
    complexity: 3,
    tools: [
      { name: 'vault_get_status', purpose: 'Get comprehensive Vault status', required: true },
      { name: 'vault_get_collaterals', purpose: 'List collateral positions', required: false },
      { name: 'vault_get_strategies', purpose: 'Get yield strategy details', required: false },
      { name: 'vault_get_oracle_prices', purpose: 'Check oracle price feeds', required: false },
    ],
    inputSchema: {},
    outputFields: ['tvl', 'utilization', 'collaterals', 'strategies', 'healthMetrics'],
    relatedSkills: ['usds-operations', 'oracle-price-feeds'],
    examples: [
      { prompt: 'Show Sperax Vault health status', toolChain: ['vault_get_status', 'vault_get_collaterals'] },
    ],
    tags: ['sperax', 'vault', 'health', 'monitoring'],
    riskLevel: 'low',
  },
  {
    id: 'mint-simulation',
    name: 'Mint/Redeem Simulation',
    description: 'Simulate USDs minting and redemption to preview collateral requirements, fees, and expected outputs before executing.',
    domain: 'stablecoin',
    complexity: 4,
    tools: [
      { name: 'vault_simulate_mint', purpose: 'Simulate a mint operation', required: true },
      { name: 'vault_simulate_redeem', purpose: 'Simulate a redeem operation', required: false },
      { name: 'vault_get_oracle_prices', purpose: 'Get current oracle prices', required: false },
    ],
    inputSchema: {
      collateral: { type: 'string', description: 'Collateral token (USDC, USDT, DAI, FRAX)', required: true },
      amount: { type: 'string', description: 'Amount to mint/redeem', required: true },
    },
    outputFields: ['expectedOutput', 'fees', 'priceImpact', 'collateralRequired'],
    relatedSkills: ['usds-operations', 'vault-monitoring'],
    examples: [
      { prompt: 'Simulate minting 1000 USDs with USDC', toolChain: ['vault_simulate_mint', 'vault_get_oracle_prices'] },
    ],
    tags: ['sperax', 'mint', 'redeem', 'simulation'],
    riskLevel: 'medium',
  },

  // ── Staking Domain ───────────────────────────────────────────────────────
  {
    id: 'spa-staking',
    name: 'SPA Token Staking',
    description: 'Manage SPA token staking — lock SPA for veSPA, calculate voting power, track staking rewards and lock periods.',
    domain: 'staking',
    complexity: 3,
    tools: [
      { name: 'spa_get_info', purpose: 'Get SPA token info', required: true },
      { name: 'vespa_get_position', purpose: 'Get veSPA lock details', required: false },
      { name: 'vespa_calculate_power', purpose: 'Calculate veSPA voting power', required: false },
      { name: 'vespa_get_stats', purpose: 'Get global staking stats', required: false },
    ],
    inputSchema: {
      address: { type: 'string', description: 'Wallet address', required: false },
      lockAmount: { type: 'string', description: 'SPA amount to lock', required: false },
      lockDuration: { type: 'number', description: 'Lock duration in days', required: false },
    },
    outputFields: ['stakedAmount', 'votingPower', 'lockExpiry', 'rewards', 'globalStats'],
    relatedSkills: ['governance-participation', 'yield-tracking'],
    examples: [
      { prompt: 'What is my veSPA voting power?', toolChain: ['vespa_get_position', 'vespa_calculate_power'] },
    ],
    tags: ['sperax', 'spa', 'staking', 'vespa', 'voting'],
    riskLevel: 'medium',
  },
  {
    id: 'yield-tracking',
    name: 'Yield Distribution Tracking',
    description: 'Track yield distribution through the Sperax Dripper mechanism — pending yields, distribution rates, and historical payouts.',
    domain: 'staking',
    complexity: 2,
    tools: [
      { name: 'dripper_get_status', purpose: 'Get Dripper status and pending yields', required: true },
      { name: 'dripper_get_rate', purpose: 'Get current distribution rate', required: false },
    ],
    inputSchema: {},
    outputFields: ['pendingYield', 'distributionRate', 'lastDistribution', 'totalDistributed'],
    relatedSkills: ['usds-operations', 'spa-staking'],
    examples: [
      { prompt: 'How much yield is pending in the Dripper?', toolChain: ['dripper_get_status'] },
    ],
    tags: ['sperax', 'yield', 'dripper', 'distribution'],
    riskLevel: 'low',
  },
  {
    id: 'demeter-farming',
    name: 'Demeter Yield Farming',
    description: 'Manage Sperax Demeter farms — discover active farms, check positions, calculate rewards, and optimize strategies.',
    domain: 'staking',
    complexity: 3,
    tools: [
      { name: 'demeter_get_farms', purpose: 'List active Demeter farms', required: true },
      { name: 'demeter_get_farm', purpose: 'Get specific farm details', required: false },
      { name: 'demeter_get_position', purpose: 'Check user farm position', required: false },
      { name: 'demeter_get_rewards', purpose: 'Calculate pending rewards', required: false },
    ],
    inputSchema: {
      farmId: { type: 'string', description: 'Demeter farm ID (optional)', required: false },
      address: { type: 'string', description: 'Wallet address (for position checks)', required: false },
    },
    outputFields: ['farms', 'positions', 'rewards', 'apy', 'tvl'],
    relatedSkills: ['yield-discovery', 'spa-staking'],
    examples: [
      { prompt: 'Show all active Demeter farms with APY', toolChain: ['demeter_get_farms'] },
    ],
    tags: ['sperax', 'demeter', 'farming', 'yield'],
    riskLevel: 'low',
  },

  // ── Governance Domain ────────────────────────────────────────────────────
  {
    id: 'governance-participation',
    name: 'Governance Participation',
    description: 'Participate in Sperax DAO governance — view proposals, check voting power, cast votes, and delegate.',
    domain: 'governance',
    complexity: 3,
    tools: [
      { name: 'governance_get_proposals', purpose: 'List governance proposals', required: true },
      { name: 'governance_get_proposal', purpose: 'Get specific proposal details', required: false },
      { name: 'governance_get_voting_power', purpose: 'Check voting power', required: false },
      { name: 'governance_vote', purpose: 'Cast a vote', required: false },
      { name: 'governance_delegate', purpose: 'Delegate voting power', required: false },
    ],
    inputSchema: {
      proposalId: { type: 'string', description: 'Proposal ID (optional)', required: false },
      status: { type: 'string', description: 'Filter by status (active, passed, failed)', required: false },
    },
    outputFields: ['proposals', 'votingPower', 'voteResult', 'delegateInfo'],
    relatedSkills: ['spa-staking'],
    examples: [
      { prompt: 'Show active governance proposals', toolChain: ['governance_get_proposals'] },
      { prompt: 'Vote FOR on proposal #42', toolChain: ['governance_get_voting_power', 'governance_vote'] },
    ],
    tags: ['governance', 'voting', 'dao', 'proposals'],
    riskLevel: 'medium',
  },

  // ── Analytics Domain ─────────────────────────────────────────────────────
  {
    id: 'protocol-metrics',
    name: 'Protocol Metrics Dashboard',
    description: 'Get comprehensive Sperax protocol metrics — total supply, TVL, APY, user growth, rebase history, and revenue.',
    domain: 'analytics',
    complexity: 2,
    tools: [
      { name: 'analytics_get_overview', purpose: 'Get protocol overview metrics', required: true },
      { name: 'analytics_get_supply', purpose: 'Get detailed supply metrics', required: false },
      { name: 'analytics_get_revenue', purpose: 'Get revenue and fee data', required: false },
    ],
    inputSchema: {},
    outputFields: ['tvl', 'totalSupply', 'apy', 'revenue', 'userCount', 'rebaseHistory'],
    relatedSkills: ['vault-monitoring', 'yield-tracking'],
    examples: [
      { prompt: 'Show Sperax protocol health dashboard', toolChain: ['analytics_get_overview', 'analytics_get_revenue'] },
    ],
    tags: ['analytics', 'metrics', 'dashboard', 'protocol'],
    riskLevel: 'low',
  },
  {
    id: 'oracle-price-feeds',
    name: 'Oracle Price Feeds',
    description: 'Access Chainlink oracle price feeds used by the Sperax protocol for collateral valuation and peg monitoring.',
    domain: 'analytics',
    complexity: 2,
    tools: [
      { name: 'oracle_get_prices', purpose: 'Get all oracle prices', required: true },
      { name: 'oracle_get_price', purpose: 'Get specific asset price', required: false },
      { name: 'vault_get_oracle_prices', purpose: 'Get vault-specific oracle data', required: false },
    ],
    inputSchema: {
      asset: { type: 'string', description: 'Asset to get price for (optional)', required: false },
    },
    outputFields: ['prices', 'deviations', 'lastUpdated', 'sources'],
    relatedSkills: ['vault-monitoring', 'usds-operations'],
    examples: [
      { prompt: 'Show all oracle price feeds', toolChain: ['oracle_get_prices'] },
    ],
    tags: ['oracle', 'chainlink', 'prices', 'feeds'],
    riskLevel: 'low',
  },
  {
    id: 'subgraph-queries',
    name: 'Historical Data Queries',
    description: 'Query historical on-chain data through Sperax subgraphs — mint/redeem history, rebases, farm events, and more.',
    domain: 'analytics',
    complexity: 3,
    tools: [
      { name: 'subgraph_query', purpose: 'Execute subgraph query', required: true },
      { name: 'subgraph_get_rebases', purpose: 'Get rebase history', required: false },
      { name: 'subgraph_get_mints', purpose: 'Get mint/redeem history', required: false },
    ],
    inputSchema: {
      query: { type: 'string', description: 'GraphQL query or predefined query name', required: true },
    },
    outputFields: ['data', 'totalRecords', 'timeRange'],
    relatedSkills: ['protocol-metrics', 'yield-tracking'],
    examples: [
      { prompt: 'Show USDs rebase history for last 30 days', toolChain: ['subgraph_get_rebases'] },
    ],
    tags: ['subgraph', 'history', 'data', 'queries'],
    riskLevel: 'low',
  },

  // ── Portfolio Domain ─────────────────────────────────────────────────────
  {
    id: 'portfolio-overview',
    name: 'Portfolio Overview',
    description: 'Get a comprehensive view of a wallet portfolio across Sperax ecosystem — USDs balance, SPA holdings, veSPA locks, farm positions, and total value.',
    domain: 'portfolio',
    complexity: 3,
    tools: [
      { name: 'portfolio_get_overview', purpose: 'Aggregate all portfolio positions', required: true },
      { name: 'usds_get_balance', purpose: 'Get USDs balance', required: false },
      { name: 'vespa_get_position', purpose: 'Get veSPA position', required: false },
    ],
    inputSchema: {
      address: { type: 'string', description: 'Wallet address', required: true },
    },
    outputFields: ['totalValue', 'usdsBalance', 'spaBalance', 'vespaLock', 'farmPositions', 'pendingRewards'],
    relatedSkills: ['usds-operations', 'spa-staking', 'demeter-farming'],
    examples: [
      { prompt: 'Show my complete Sperax portfolio', toolChain: ['portfolio_get_overview'] },
    ],
    tags: ['portfolio', 'overview', 'holdings', 'positions'],
    riskLevel: 'low',
  },
  {
    id: 'portfolio-risk-assessment',
    name: 'Portfolio Risk Assessment',
    description: 'Assess portfolio risk across multiple dimensions — concentration risk, protocol risk, smart contract risk, and market exposure.',
    domain: 'portfolio',
    complexity: 4,
    tools: [
      { name: 'portfolio_get_overview', purpose: 'Get portfolio positions', required: true },
      { name: 'security_check_token', purpose: 'Check security of held tokens', required: false },
      { name: 'vault_get_status', purpose: 'Check vault health', required: false },
    ],
    inputSchema: {
      address: { type: 'string', description: 'Wallet address', required: true },
    },
    outputFields: ['overallRisk', 'concentrationRisk', 'protocolRisk', 'recommendations'],
    relatedSkills: ['portfolio-overview', 'token-security-scan', 'vault-monitoring'],
    examples: [
      { prompt: 'Assess risk of my DeFi portfolio', toolChain: ['portfolio_get_overview', 'vault_get_status'] },
    ],
    tags: ['portfolio', 'risk', 'assessment', 'diversification'],
    riskLevel: 'low',
  },

  // ── Bridge Domain ────────────────────────────────────────────────────────
  {
    id: 'cross-chain-bridge',
    name: 'Cross-Chain Bridge',
    description: 'Bridge assets across chains — get bridge quotes, compare fees, and execute cross-chain transfers.',
    domain: 'bridge',
    complexity: 4,
    tools: [
      { name: 'get_bridge_quote', purpose: 'Get bridge quote with fees', required: true },
      { name: 'execute_bridge', purpose: 'Execute bridge transfer', required: false },
      { name: 'get_bridge_status', purpose: 'Check bridge transaction status', required: false },
    ],
    inputSchema: {
      fromChain: { type: 'string', description: 'Source chain', required: true },
      toChain: { type: 'string', description: 'Destination chain', required: true },
      token: { type: 'string', description: 'Token to bridge', required: true },
      amount: { type: 'string', description: 'Amount to bridge', required: true },
    },
    outputFields: ['quote', 'fees', 'estimatedTime', 'route', 'txHash'],
    relatedSkills: ['gas-estimation'],
    examples: [
      { prompt: 'Bridge 100 USDC from Ethereum to Arbitrum', toolChain: ['get_bridge_quote'] },
    ],
    tags: ['bridge', 'cross-chain', 'transfer'],
    riskLevel: 'high',
  },

  // ── NFT Domain ───────────────────────────────────────────────────────────
  {
    id: 'nft-exploration',
    name: 'NFT Collection Exploration',
    description: 'Explore NFT collections — fetch metadata, check ownership, list NFTs by wallet, and analyze collection security.',
    domain: 'nft',
    complexity: 2,
    tools: [
      { name: 'get_nft_metadata', purpose: 'Get NFT metadata and traits', required: true },
      { name: 'get_nfts_by_owner', purpose: 'List NFTs owned by address', required: false },
      { name: 'security_check_nft', purpose: 'Check NFT collection security', required: false },
    ],
    inputSchema: {
      network: { type: 'string', description: 'Blockchain network', required: false },
      contractAddress: { type: 'string', description: 'NFT contract address', required: false },
      tokenId: { type: 'string', description: 'Specific token ID', required: false },
      ownerAddress: { type: 'string', description: 'Owner address (for listing)', required: false },
    },
    outputFields: ['metadata', 'traits', 'owner', 'collection', 'securityStatus'],
    relatedSkills: ['contract-verification'],
    examples: [
      { prompt: 'Show my NFTs on Ethereum', toolChain: ['get_nfts_by_owner'] },
      { prompt: 'Get metadata for BAYC #1234', toolChain: ['get_nft_metadata'] },
    ],
    tags: ['nft', 'metadata', 'collection', 'ownership'],
    riskLevel: 'low',
  },

  // ── Education Domain ─────────────────────────────────────────────────────
  {
    id: 'news-aggregation',
    name: 'Crypto News Aggregation',
    description: 'Aggregate latest crypto news from multiple sources — breaking news, trending topics, and protocol-specific updates.',
    domain: 'education',
    complexity: 1,
    tools: [
      { name: 'news_get_latest', purpose: 'Get latest crypto news', required: true },
      { name: 'news_get_breaking', purpose: 'Get breaking news alerts', required: false },
      { name: 'news_get_sperax', purpose: 'Get Sperax-specific news', required: false },
    ],
    inputSchema: {
      limit: { type: 'number', description: 'Number of news items', required: false },
      category: { type: 'string', description: 'News category filter', required: false },
    },
    outputFields: ['articles', 'breakingNews', 'source', 'publishedAt'],
    relatedSkills: ['market-sentiment', 'price-tracking'],
    examples: [
      { prompt: 'What is the latest crypto news?', toolChain: ['news_get_latest'] },
      { prompt: 'Any Sperax news?', toolChain: ['news_get_sperax'] },
    ],
    tags: ['news', 'crypto', 'updates', 'media'],
    riskLevel: 'low',
  },
  {
    id: 'agent-discovery',
    name: 'Agent Discovery',
    description: 'Discover and explore available DeFi AI agents — search by capability, category, or use case. Get full agent definitions with system prompts.',
    domain: 'education',
    complexity: 1,
    tools: [
      { name: 'agents_list', purpose: 'List all available agents', required: true },
      { name: 'agents_search', purpose: 'Search agents by keyword', required: false },
      { name: 'agents_get', purpose: 'Get full agent details', required: false },
      { name: 'agents_get_categories', purpose: 'Browse agent categories', required: false },
    ],
    inputSchema: {
      query: { type: 'string', description: 'Search query or category', required: false },
    },
    outputFields: ['agents', 'categories', 'systemPrompts', 'capabilities'],
    relatedSkills: [],
    examples: [
      { prompt: 'Find an agent for yield farming', toolChain: ['agents_search'] },
      { prompt: 'Show all available AI agents', toolChain: ['agents_list'] },
    ],
    tags: ['agents', 'discovery', 'ai', 'search'],
    riskLevel: 'low',
  },
  {
    id: 'plugin-marketplace',
    name: 'Plugin Marketplace',
    description: 'Browse and discover SperaxOS plugins — search by capability, get manifests, and test plugin APIs.',
    domain: 'education',
    complexity: 1,
    tools: [
      { name: 'plugins_list', purpose: 'List available plugins', required: true },
      { name: 'plugins_search', purpose: 'Search plugins', required: false },
      { name: 'plugins_get_manifest', purpose: 'Get plugin manifest', required: false },
    ],
    inputSchema: {
      query: { type: 'string', description: 'Search query', required: false },
    },
    outputFields: ['plugins', 'capabilities', 'manifests'],
    relatedSkills: ['agent-discovery'],
    examples: [
      { prompt: 'Show available plugins', toolChain: ['plugins_list'] },
    ],
    tags: ['plugins', 'marketplace', 'discover'],
    riskLevel: 'low',
  },

  // ── Compound Skills (Multi-Domain) ───────────────────────────────────────
  {
    id: 'full-token-audit',
    name: 'Full Token Security Audit',
    description: 'Comprehensive multi-step token audit combining security scan, honeypot detection, rug pull analysis, and contract verification into a single workflow.',
    domain: 'security',
    complexity: 4,
    tools: [
      { name: 'security_check_token', purpose: 'Run comprehensive security scan', required: true },
      { name: 'detect_honeypot', purpose: 'Check for honeypot behavior', required: true },
      { name: 'check_rug_risk', purpose: 'Analyze rug pull risk', required: true },
      { name: 'get_contract_info', purpose: 'Verify contract source', required: true },
    ],
    inputSchema: {
      network: { type: 'string', description: 'Blockchain network', required: false },
      tokenAddress: { type: 'string', description: 'Token contract address', required: true },
    },
    outputFields: ['securityScore', 'isHoneypot', 'rugPullRisk', 'contractVerified', 'overallAssessment', 'recommendations'],
    relatedSkills: ['token-security-scan', 'honeypot-detection', 'rug-pull-analysis', 'contract-verification'],
    examples: [
      { prompt: 'Do a full security audit on this token 0x...', toolChain: ['security_check_token', 'detect_honeypot', 'check_rug_risk', 'get_contract_info'] },
    ],
    tags: ['security', 'audit', 'comprehensive', 'multi-step'],
    riskLevel: 'low',
  },
  {
    id: 'defi-risk-report',
    name: 'DeFi Risk Report',
    description: 'Generate a comprehensive DeFi risk report covering portfolio exposure, protocol health, vault status, and security analysis.',
    domain: 'portfolio',
    complexity: 5,
    tools: [
      { name: 'portfolio_get_overview', purpose: 'Get portfolio positions', required: true },
      { name: 'vault_get_status', purpose: 'Check vault health', required: true },
      { name: 'analytics_get_overview', purpose: 'Get protocol metrics', required: true },
      { name: 'oracle_get_prices', purpose: 'Check oracle status', required: false },
    ],
    inputSchema: {
      address: { type: 'string', description: 'Wallet address', required: true },
    },
    outputFields: ['riskScore', 'portfolioExposure', 'protocolHealth', 'oracleStatus', 'recommendations'],
    relatedSkills: ['portfolio-risk-assessment', 'vault-monitoring', 'protocol-metrics'],
    examples: [
      { prompt: 'Generate a full risk report for my portfolio', toolChain: ['portfolio_get_overview', 'vault_get_status', 'analytics_get_overview'] },
    ],
    tags: ['risk', 'report', 'comprehensive', 'portfolio'],
    riskLevel: 'low',
  },
  {
    id: 'daily-defi-briefing',
    name: 'Daily DeFi Briefing',
    description: 'Generate a daily DeFi briefing with market prices, news, protocol updates, and yield opportunities.',
    domain: 'market-data',
    complexity: 3,
    tools: [
      { name: 'news_get_latest', purpose: 'Get latest news', required: true },
      { name: 'news_get_breaking', purpose: 'Get breaking news', required: false },
      { name: 'market_get_coins', purpose: 'Get market data', required: true },
      { name: 'defi_get_yields', purpose: 'Get yield opportunities', required: false },
      { name: 'analytics_get_overview', purpose: 'Get protocol overview', required: false },
    ],
    inputSchema: {
      tokens: { type: 'string', description: 'Comma-separated token IDs to track', required: false },
    },
    outputFields: ['news', 'prices', 'yields', 'protocolMetrics', 'highlights'],
    relatedSkills: ['news-aggregation', 'price-tracking', 'yield-discovery'],
    examples: [
      { prompt: 'Give me a daily DeFi briefing', toolChain: ['news_get_latest', 'market_get_coins', 'defi_get_yields'] },
    ],
    tags: ['briefing', 'daily', 'market', 'news'],
    riskLevel: 'low',
  },
  {
    id: 'sperax-ecosystem-overview',
    name: 'Sperax Ecosystem Overview',
    description: 'Complete overview of the Sperax ecosystem — protocol metrics, available agents, plugins, news, and tool capabilities.',
    domain: 'education',
    complexity: 2,
    tools: [
      { name: 'agents_get_sperax', purpose: 'Get Sperax agents', required: true },
      { name: 'news_get_sperax', purpose: 'Get Sperax news', required: false },
      { name: 'analytics_get_overview', purpose: 'Get protocol metrics', required: false },
    ],
    inputSchema: {},
    outputFields: ['agents', 'news', 'protocolMetrics', 'ecosystem'],
    relatedSkills: ['agent-discovery', 'news-aggregation', 'protocol-metrics'],
    examples: [
      { prompt: 'Give me a Sperax ecosystem overview', toolChain: ['agents_get_sperax', 'news_get_sperax', 'analytics_get_overview'] },
    ],
    tags: ['sperax', 'ecosystem', 'overview', 'comprehensive'],
    riskLevel: 'low',
  },
  {
    id: 'supply-analytics',
    name: 'USDs Supply Analytics',
    description: 'Analyze USDs circulating supply, total supply, and supply changes over time with detailed breakdowns.',
    domain: 'analytics',
    complexity: 2,
    tools: [
      { name: 'supply_get_circulating', purpose: 'Get circulating supply', required: true },
      { name: 'supply_get_total', purpose: 'Get total supply', required: false },
      { name: 'supply_get_breakdown', purpose: 'Get supply breakdown by chain', required: false },
    ],
    inputSchema: {},
    outputFields: ['circulatingSupply', 'totalSupply', 'supplyBreakdown', 'supplyChange'],
    relatedSkills: ['usds-operations', 'protocol-metrics'],
    examples: [
      { prompt: 'Show USDs supply analytics', toolChain: ['supply_get_circulating', 'supply_get_total'] },
    ],
    tags: ['supply', 'analytics', 'usds', 'circulating'],
    riskLevel: 'low',
  },
  {
    id: 'swap-routing',
    name: 'DEX Swap Routing',
    description: 'Find optimal swap routes across DEXes on Arbitrum — compare prices, slippage, and gas costs.',
    domain: 'trading',
    complexity: 3,
    tools: [
      { name: 'swap_get_quote', purpose: 'Get swap quote with routing', required: true },
      { name: 'swap_get_routes', purpose: 'Get available routes', required: false },
      { name: 'swap_get_tokens', purpose: 'List swappable tokens', required: false },
    ],
    inputSchema: {
      fromToken: { type: 'string', description: 'Source token', required: true },
      toToken: { type: 'string', description: 'Destination token', required: true },
      amount: { type: 'string', description: 'Amount to swap', required: true },
    },
    outputFields: ['bestRoute', 'price', 'priceImpact', 'gasEstimate', 'alternatives'],
    relatedSkills: ['swap-execution', 'gas-estimation'],
    examples: [
      { prompt: 'Find best route to swap SPA for USDs', toolChain: ['swap_get_quote'] },
    ],
    tags: ['swap', 'routing', 'dex', 'optimization'],
    riskLevel: 'low',
  },
];

// ============================================================================
// Skill Lookup Helpers
// ============================================================================

function getSkillById(id: string): Skill | undefined {
  return skillsRegistry.find(s => s.id === id);
}

function getSkillsByDomain(domain: SkillDomain): Skill[] {
  return skillsRegistry.filter(s => s.domain === domain);
}

function getSkillsByTag(tag: string): Skill[] {
  const normalizedTag = tag.toLowerCase();
  return skillsRegistry.filter(s =>
    s.tags.some(t => t.toLowerCase() === normalizedTag)
  );
}

function searchSkills(query: string): Skill[] {
  const normalizedQuery = query.toLowerCase();
  return skillsRegistry.filter(skill => {
    const searchText = [
      skill.id,
      skill.name,
      skill.description,
      skill.domain,
      ...skill.tags,
      ...skill.tools.map(t => t.name),
    ].join(' ').toLowerCase();
    return searchText.includes(normalizedQuery);
  });
}

function getSkillsForAgent(agentTags: string[], agentCategory?: string): Skill[] {
  const normalizedTags = agentTags.map(t => t.toLowerCase());
  const normalizedCat = agentCategory?.toLowerCase();

  return skillsRegistry.filter(skill => {
    // Match by domain ↔ category mapping
    if (normalizedCat && skill.domain === normalizedCat) return true;

    // Match by overlapping tags
    return skill.tags.some(tag =>
      normalizedTags.includes(tag.toLowerCase())
    );
  });
}

// ============================================================================
// Input Schemas
// ============================================================================

const ListSkillsInput = z.object({
  domain: z
    .enum(SKILL_DOMAINS)
    .optional()
    .describe('Filter skills by domain (e.g., "security", "defi", "trading")'),
  riskLevel: z
    .enum(['low', 'medium', 'high'])
    .optional()
    .describe('Filter by risk level'),
  maxComplexity: z
    .number()
    .min(1)
    .max(5)
    .optional()
    .describe('Maximum complexity rating (1-5)'),
  limit: z
    .number()
    .min(1)
    .max(50)
    .optional()
    .default(20)
    .describe('Maximum number of skills to return'),
});

const GetSkillInput = z.object({
  id: z
    .string()
    .min(1)
    .describe('Unique skill identifier (e.g., "token-security-scan")'),
});

const SearchSkillsInput = z.object({
  query: z
    .string()
    .min(1)
    .describe('Search query to find skills by name, description, domain, or tools'),
  limit: z
    .number()
    .min(1)
    .max(30)
    .optional()
    .default(10)
    .describe('Maximum number of results'),
});

const SkillsByAgentInput = z.object({
  agentIdentifier: z
    .string()
    .min(1)
    .describe('Agent identifier to find matching skills for'),
  locale: z
    .enum([
      'en-US', 'zh-CN', 'zh-TW', 'ja-JP', 'ko-KR', 'de-DE', 'fr-FR', 'es-ES',
      'ru-RU', 'ar-SA', 'pt-BR', 'it-IT', 'nl-NL', 'pl-PL', 'vi-VN', 'tr-TR',
      'sv-SE', 'id-ID',
    ])
    .optional()
    .default('en-US')
    .describe('Language/locale for agent lookup'),
});

// ============================================================================
// Tool Definitions
// ============================================================================

export const skillsTools = [
  {
    name: 'skills_list',
    description:
      'List available agent skills with optional filtering by domain, risk level, and complexity. Skills represent composable capabilities that map to MCP tools. Returns skill metadata including tools used, input/output schemas, and examples.',
    inputSchema: ListSkillsInput,
    handler: async (params: z.infer<typeof ListSkillsInput>) => {
      const { domain, riskLevel, maxComplexity, limit } = params;

      let skills = [...skillsRegistry];

      if (domain) {
        skills = skills.filter(s => s.domain === domain);
      }
      if (riskLevel) {
        skills = skills.filter(s => s.riskLevel === riskLevel);
      }
      if (maxComplexity) {
        skills = skills.filter(s => s.complexity <= maxComplexity);
      }

      skills = skills.slice(0, limit);

      return {
        skills: skills.map(s => ({
          id: s.id,
          name: s.name,
          description: s.description,
          domain: s.domain,
          complexity: s.complexity,
          riskLevel: s.riskLevel,
          toolCount: s.tools.length,
          tags: s.tags,
        })),
        totalCount: skills.length,
        totalAvailable: skillsRegistry.length,
        domains: SKILL_DOMAINS,
        filters: { domain, riskLevel, maxComplexity },
      };
    },
  },

  {
    name: 'skills_get',
    description:
      'Get complete details for a specific agent skill including all MCP tools it uses, input/output schemas, example prompts, related skills, and execution guidance.',
    inputSchema: GetSkillInput,
    handler: async (params: z.infer<typeof GetSkillInput>) => {
      const skill = getSkillById(params.id);

      if (!skill) {
        return {
          error: `Skill '${params.id}' not found`,
          availableSkills: skillsRegistry.map(s => s.id).slice(0, 20),
        };
      }

      return {
        id: skill.id,
        name: skill.name,
        description: skill.description,
        domain: skill.domain,
        complexity: skill.complexity,
        riskLevel: skill.riskLevel,
        tools: skill.tools,
        inputSchema: skill.inputSchema,
        outputFields: skill.outputFields,
        relatedSkills: skill.relatedSkills.map(id => {
          const related = getSkillById(id);
          return related
            ? { id: related.id, name: related.name, domain: related.domain }
            : { id, name: id, domain: 'unknown' };
        }),
        examples: skill.examples,
        tags: skill.tags,
      };
    },
  },

  {
    name: 'skills_search',
    description:
      'Search for agent skills by keyword. Searches skill names, descriptions, domains, tags, and tool names to find relevant capabilities.',
    inputSchema: SearchSkillsInput,
    handler: async (params: z.infer<typeof SearchSkillsInput>) => {
      const { query, limit } = params;
      const results = searchSkills(query).slice(0, limit);

      return {
        query,
        results: results.map(s => ({
          id: s.id,
          name: s.name,
          description: s.description,
          domain: s.domain,
          complexity: s.complexity,
          riskLevel: s.riskLevel,
          tools: s.tools.map(t => t.name),
          relevance: s.name.toLowerCase().includes(query.toLowerCase()) ? 'high' : 'medium',
        })),
        totalCount: results.length,
      };
    },
  },

  {
    name: 'skills_by_agent',
    description:
      'Get all skills available to a specific agent based on its tags and category. Fetches the agent from the API and matches its capabilities to registered skills.',
    inputSchema: SkillsByAgentInput,
    handler: async (params: z.infer<typeof SkillsByAgentInput>) => {
      const { agentIdentifier, locale } = params;

      try {
        const response = await fetch(
          locale === 'en-US'
            ? `https://sperax.click/${agentIdentifier}.json`
            : `https://sperax.click/${agentIdentifier}.${locale}.json`,
          {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'SperaxOS-MCP/1.0',
            },
          },
        );

        if (!response.ok) {
          return {
            error: `Agent '${agentIdentifier}' not found: ${response.status}`,
            agentIdentifier,
          };
        }

        const agent = await response.json() as {
          identifier: string;
          meta: { title: string; tags: string[]; category?: string };
        };
        const matchedSkills = getSkillsForAgent(agent.meta.tags, agent.meta.category);

        return {
          agent: {
            identifier: agent.identifier,
            title: agent.meta.title,
            tags: agent.meta.tags,
            category: agent.meta.category,
          },
          skills: matchedSkills.map(s => ({
            id: s.id,
            name: s.name,
            description: s.description,
            domain: s.domain,
            complexity: s.complexity,
            riskLevel: s.riskLevel,
            tools: s.tools.map(t => t.name),
          })),
          totalSkills: matchedSkills.length,
          skillDomains: [...new Set(matchedSkills.map(s => s.domain))],
        };
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : 'Failed to fetch agent',
          agentIdentifier,
        };
      }
    },
  },

  {
    name: 'skills_get_domains',
    description:
      'Get all available skill domains with counts. Useful for discovering what types of agent skills are available across the ecosystem.',
    inputSchema: z.object({}),
    handler: async () => {
      const domainCounts: Record<string, { count: number; skills: string[] }> = {};

      for (const skill of skillsRegistry) {
        if (!domainCounts[skill.domain]) {
          domainCounts[skill.domain] = { count: 0, skills: [] };
        }
        domainCounts[skill.domain].count++;
        domainCounts[skill.domain].skills.push(skill.id);
      }

      return {
        domains: Object.entries(domainCounts)
          .sort(([, a], [, b]) => b.count - a.count)
          .map(([domain, data]) => ({
            domain,
            count: data.count,
            skills: data.skills,
          })),
        totalSkills: skillsRegistry.length,
        totalDomains: Object.keys(domainCounts).length,
      };
    },
  },
];
