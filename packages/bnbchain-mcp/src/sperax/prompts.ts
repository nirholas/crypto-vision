/**
 * MCP Prompts - Pre-built conversation starters
 */

import { z } from 'zod';

// ============================================================================
// Prompt Definitions
// ============================================================================

export const prompts = [
  {
    name: 'what_is_usds',
    description: 'Learn about USDs auto-yield stablecoin',
    arguments: [],
    template: `Explain what USDs is in simple terms. Include:
1. What makes it different from other stablecoins
2. How the auto-yield works
3. Current APY and how to earn it
4. How to mint and redeem

Use the usds_get_info tool to get current data.`,
  },
  {
    name: 'how_to_mint',
    description: 'Guide for minting USDs with collateral',
    arguments: [
      {
        name: 'collateral',
        description: 'Collateral type to use (USDC, USDT, DAI, FRAX)',
        required: false,
      },
    ],
    template: (args: { collateral?: string }) => `Provide a step-by-step guide for minting USDs${args.collateral ? ` using ${args.collateral}` : ''}.

Include:
1. What collaterals are supported
2. Current mint fees (use usds_get_mint_params)
3. Step-by-step process
4. What to expect after minting (auto-yield)

${args.collateral ? `Focus specifically on using ${args.collateral} as collateral.` : ''}`,
  },
  {
    name: 'how_to_redeem',
    description: 'Guide for redeeming USDs to stablecoins',
    arguments: [
      {
        name: 'amount',
        description: 'Amount of USDs to redeem',
        required: false,
      },
    ],
    template: (args: { amount?: string }) => `Explain how to redeem USDs back to stablecoins.

Include:
1. Available collaterals to receive
2. Current redemption fees (use usds_get_mint_params)
3. Step-by-step process
4. Any considerations or warnings

${args.amount ? `The user wants to redeem ${args.amount} USDs.` : ''}`,
  },
  {
    name: 'my_usds_balance',
    description: 'Check USDs balance and yield info for an address',
    arguments: [
      {
        name: 'address',
        description: 'Ethereum address to check',
        required: true,
      },
    ],
    template: (args: { address: string }) => `Check the USDs balance and status for address ${args.address}.

Use these tools:
1. usds_get_balance for current balance and rebase state
2. usds_get_yield_info for current APR

Explain:
- Current balance in USD
- Whether they're receiving yield rebases
- Projected daily/monthly/yearly earnings at current APR`,
  },
  {
    name: 'my_yield_earnings',
    description: 'Calculate potential yield earnings',
    arguments: [
      {
        name: 'address',
        description: 'Ethereum address to check',
        required: true,
      },
      {
        name: 'days',
        description: 'Number of days to project',
        required: false,
      },
    ],
    template: (args: { address: string; days?: number }) => `Calculate yield earnings for ${args.address}.

1. Get current balance using usds_get_balance
2. Get current APR using usds_get_yield_info
3. Calculate projected earnings for ${args.days || 30} days

Present earnings breakdown:
- Daily yield
- Weekly yield
- Monthly yield
- Yearly yield (if applicable)`,
  },
  {
    name: 'stake_spa',
    description: 'Guide for staking SPA to get veSPA',
    arguments: [
      {
        name: 'amount',
        description: 'Amount of SPA to stake',
        required: false,
      },
      {
        name: 'duration',
        description: 'Lock duration (e.g., "1 year", "6 months")',
        required: false,
      },
    ],
    template: (args: { amount?: string; duration?: string }) => `Explain how to stake SPA and get veSPA voting power.

${args.amount ? `User wants to stake ${args.amount} SPA.` : ''}
${args.duration ? `User is considering a ${args.duration} lock.` : ''}

Include:
1. What veSPA is and its benefits
2. Lock duration options (7 days to 4 years)
3. Voting power calculation (use vespa_calculate_power if amount/duration provided)
4. How power decays over time
5. Important: Cannot unlock early!`,
  },
  {
    name: 'my_staking_position',
    description: 'Check veSPA staking position',
    arguments: [
      {
        name: 'address',
        description: 'Ethereum address to check',
        required: true,
      },
    ],
    template: (args: { address: string }) => `Check the staking position for ${args.address}.

Use these tools:
1. spa_get_balance for all SPA-related balances
2. vespa_get_position for lock details
3. xspa_get_position if they have xSPA

Present:
- Locked SPA amount
- Current voting power
- Time until unlock
- xSPA balance and redemption options`,
  },
  {
    name: 'best_yield_farms',
    description: 'Find the best Demeter yield farms',
    arguments: [
      {
        name: 'minApr',
        description: 'Minimum APR threshold',
        required: false,
      },
    ],
    template: (args: { minApr?: number }) => `Find the best yield farming opportunities on Demeter.

Use demeter_get_top_farms with:
${args.minApr ? `- Minimum APR: ${args.minApr}%` : '- No minimum APR filter'}
- Show top 5 farms

Present results in a table with:
- Farm name/tokens
- APR
- TVL
- Days remaining
- Risk assessment (based on TVL and duration)`,
  },
  {
    name: 'my_farm_rewards',
    description: 'Check pending farm rewards',
    arguments: [
      {
        name: 'address',
        description: 'Ethereum address to check',
        required: true,
      },
    ],
    template: (args: { address: string }) => `Check all pending farm rewards for ${args.address}.

Use demeter_get_user_position to find all positions.

Present:
- Each farm with staked amount
- Pending rewards per farm
- Total pending rewards
- Recommendations (claim now vs. wait)`,
  },
  {
    name: 'protocol_health',
    description: 'Get overall protocol health report',
    arguments: [],
    template: `Generate a comprehensive Sperax protocol health report.

Use these tools:
1. usds_get_info - Total supply and rebase info
2. usds_get_collateral_ratio - Collateralization health
3. usds_get_yield_info - Current yield metrics
4. vespa_get_stats - Staking participation
5. buyback_get_stats - SPA burn metrics

Present a health dashboard with:
- ✅/⚠️/❌ status indicators
- Key metrics with context
- Overall protocol health score
- Any concerns or recommendations`,
  },
  {
    name: 'spa_tokenomics',
    description: 'Explain SPA token economics',
    arguments: [],
    template: `Explain SPA tokenomics in detail.

Use:
1. spa_get_info for current supply and staking stats
2. buyback_get_stats for burn statistics

Cover:
- Total and circulating supply
- How SPA is used (governance, staking)
- Buyback & burn mechanism (30% of yield)
- veSPA value proposition
- Price drivers and demand sources`,
  },
  {
    name: 'compare_yields',
    description: 'Compare USDs yield to other stablecoins',
    arguments: [],
    template: `Compare USDs yield to other stablecoin yield options.

Get USDs current APR using usds_get_yield_info.

Compare to:
- Traditional stablecoins (0% yield)
- Aave USDC/USDT lending (~2-4%)
- Compound lending (~2-4%)
- Other yield-bearing stablecoins

Highlight USDs advantages:
- Auto-yield (no claiming)
- Competitive APR
- Simple UX`,
  },
  {
    name: 'rebase_calculator',
    description: 'Calculate potential rebase earnings',
    arguments: [
      {
        name: 'amount',
        description: 'USDs amount to calculate',
        required: true,
      },
      {
        name: 'days',
        description: 'Number of days to project',
        required: true,
      },
    ],
    template: (args: { amount: string; days: string }) => `Calculate rebase earnings for ${args.amount} USDs over ${args.days} days.

1. Get current APR using usds_get_yield_info
2. Calculate:
   - Daily yield
   - Total yield over ${args.days} days
   - Ending balance
   - Compound effect explanation

Present clearly with USD values and percentages.`,
  },
  {
    name: 'vespa_calculator',
    description: 'Calculate veSPA voting power',
    arguments: [
      {
        name: 'amount',
        description: 'SPA amount to lock',
        required: true,
      },
      {
        name: 'days',
        description: 'Lock duration in days',
        required: true,
      },
    ],
    template: (args: { amount: string; days: string }) => `Calculate veSPA voting power for locking ${args.amount} SPA for ${args.days} days.

Use vespa_calculate_power tool.

Present:
- Resulting veSPA amount
- Multiplier achieved
- Comparison to other durations
- Power decay over time
- Recommendations`,
  },
  {
    name: 'portfolio_summary',
    description: 'Get complete portfolio summary across all Sperax products',
    arguments: [
      {
        name: 'address',
        description: 'Ethereum address to check',
        required: true,
      },
    ],
    template: (args: { address: string }) => `Generate a complete portfolio summary for ${args.address}.

Use these tools:
1. usds_get_balance - USDs holdings and yield status
2. spa_get_balance - SPA, veSPA, xSPA balances
3. vespa_get_position - Staking details
4. demeter_get_user_position - Farm positions

Present a comprehensive dashboard:
- Total portfolio value in USD
- USDs balance with projected yield
- SPA holdings breakdown
- Active farm positions with pending rewards
- Governance voting power
- Recommendations for optimization`,
  },
  {
    name: 'optimize_my_yield',
    description: 'Get AI recommendations to optimize yield',
    arguments: [
      {
        name: 'address',
        description: 'Ethereum address to analyze',
        required: true,
      },
    ],
    template: (args: { address: string }) => `Analyze ${args.address}'s positions and recommend optimizations.

Gather data:
1. usds_get_balance - Current USDs position
2. spa_get_balance - SPA positions
3. vespa_get_position - Lock status
4. demeter_get_user_position - Farm positions
5. demeter_get_top_farms - Best available farms
6. usds_get_yield_info - Current APR

Provide recommendations:
- Unstaked assets that should be staked
- Better farm opportunities
- veSPA optimization (extend lock?)
- xSPA redemption timing
- Overall yield optimization strategy`,
  },
  {
    name: 'risk_assessment',
    description: 'Assess risks of Sperax positions',
    arguments: [
      {
        name: 'address',
        description: 'Ethereum address to assess',
        required: true,
      },
    ],
    template: (args: { address: string }) => `Provide a risk assessment for ${args.address}'s Sperax positions.

Gather data on positions:
1. usds_get_balance
2. vespa_get_position
3. demeter_get_user_position

Get protocol health:
1. usds_get_collateral_ratio
2. oracle_check_staleness
3. analytics_get_protocol_health

Assess:
- Smart contract risk
- Collateral risk (depeg exposure)
- Lock-up risk (veSPA)
- Farm risk (impermanent loss, rug risk)
- Oracle risk
- Overall risk score

Provide risk-appropriate recommendations.`,
  },
  {
    name: 'weekly_report',
    description: 'Generate weekly portfolio and protocol report',
    arguments: [
      {
        name: 'address',
        description: 'Ethereum address for personalized report',
        required: false,
      },
    ],
    template: (args: { address?: string }) => `Generate a weekly report for Sperax${args.address ? ` focused on ${args.address}` : ''}.

Get protocol data:
1. analytics_get_tvl - Protocol TVL
2. analytics_get_revenue - Weekly revenue
3. analytics_get_apy_history - APY trend
4. usds_get_info - USDs metrics
5. buyback_get_stats - SPA burns

${args.address ? `Get personal data:
1. usds_get_balance
2. spa_get_balance
3. demeter_get_user_position

Calculate:
- Weekly yield earned
- Position changes
- Pending rewards` : ''}

Format as a professional weekly report with:
- Executive summary
- Key metrics table
- Week-over-week changes
- Notable events
- Outlook and recommendations`,
  },
  {
    name: 'new_user_guide',
    description: 'Complete onboarding guide for new users',
    arguments: [],
    template: `Create a comprehensive onboarding guide for new Sperax users.

Cover:
1. What is Sperax and why it matters
2. Getting started with USDs
   - How to get USDs (mint or buy)
   - Understanding auto-yield
   - Use usds_get_mint_params for current fees
3. Staking SPA for veSPA
   - Benefits of staking
   - Lock duration considerations
4. Yield farming on Demeter
   - How it works
   - Best farms (use demeter_get_top_farms)
5. Safety considerations
   - Risks to be aware of
   - Best practices

Make it beginner-friendly with clear steps.`,
  },
  {
    name: 'governance_participation',
    description: 'Guide to participating in Sperax governance',
    arguments: [
      {
        name: 'address',
        description: 'Address to check voting power',
        required: false,
      },
    ],
    template: (args: { address?: string }) => `Guide for participating in Sperax DAO governance.

${args.address ? `Check voting power for ${args.address}:
1. governance_get_voting_power
2. vespa_get_position

Show:
- Current voting power
- How to increase it
` : ''}

Get current governance state:
1. governance_get_overview
2. governance_get_proposals (status: active)

Explain:
- How voting power works (veSPA)
- Current active proposals
- How to vote
- How to create proposals
- Delegation options`,
  },

  // ============================================================================
  // Ecosystem Integration Prompts
  // ============================================================================

  {
    name: 'find_defi_agent',
    description: 'Find a specialized DeFi AI agent for a specific task',
    arguments: [
      {
        name: 'task',
        description: 'The DeFi task you need help with (e.g., "yield farming", "portfolio management")',
        required: true,
      },
    ],
    template: (args: { task: string }) => `Find the best AI agent for: "${args.task}"

Use these tools:
1. agents_search with query "${args.task}"
2. agents_get_categories to see all available categories

Present results showing:
- Agent name and description
- What it specializes in
- Available tags/capabilities
- How to use the agent's system prompt

If searching for Sperax-specific tasks, also use agents_get_sperax.`,
  },
  {
    name: 'crypto_market_update',
    description: 'Get a comprehensive crypto market update with news and prices',
    arguments: [
      {
        name: 'tokens',
        description: 'Comma-separated token IDs (e.g., "bitcoin,ethereum,sperax")',
        required: false,
      },
    ],
    template: (args: { tokens?: string }) => `Get a comprehensive crypto market update.

1. **Latest News**
   Use news_get_latest with limit 5

2. **Breaking News**
   Use news_get_breaking with limit 3

3. **Market Prices**
   ${args.tokens 
     ? `Get prices for: ${args.tokens.split(',').map(t => t.trim()).join(', ')}
   Use plugins_coingecko_price for each token`
     : `Get prices for major tokens:
   - plugins_coingecko_price with coinId "bitcoin"
   - plugins_coingecko_price with coinId "ethereum"
   - plugins_coingecko_price with coinId "sperax"`
   }

Present a market summary including:
- Top headlines with sources
- Price changes (24h)
- Any breaking news that might affect markets`,
  },
  {
    name: 'defi_research',
    description: 'Research a DeFi protocol using news, TVL data, and available agents',
    arguments: [
      {
        name: 'protocol',
        description: 'Protocol name to research (e.g., "aave", "uniswap", "sperax")',
        required: true,
      },
    ],
    template: (args: { protocol: string }) => `Research the ${args.protocol} protocol comprehensively.

1. **TVL & Metrics**
   Use plugins_defillama_tvl with protocol "${args.protocol}"

2. **Recent News**
   Use news_search with keywords "${args.protocol}"

3. **Available AI Agents**
   Use agents_search with query "${args.protocol}"

Present findings including:
- Total Value Locked (TVL)
- TVL change (24h, 7d)
- Supported chains
- Recent news and developments
- Any specialized AI agents for this protocol`,
  },
  {
    name: 'sperax_ecosystem_overview',
    description: 'Get a complete overview of the Sperax ecosystem including tools, agents, and news',
    arguments: [],
    template: `Provide a complete Sperax ecosystem overview.

1. **Sperax AI Agents**
   Use agents_get_sperax to find all Sperax-specialized agents

2. **Latest Sperax News**
   Use news_get_sperax to get recent news

3. **Protocol Metrics**
   Use plugins_defillama_tvl with protocol "sperax"

4. **Current Prices**
   Use plugins_coingecko_price with coinId "sperax"

Present:
- Available Sperax AI agents and their capabilities
- Recent protocol news
- TVL and market data
- Links to key resources`,
  },
  {
    name: 'discover_plugins',
    description: 'Discover available plugins for a specific use case',
    arguments: [
      {
        name: 'useCase',
        description: 'What you want to accomplish (e.g., "price data", "market analysis")',
        required: true,
      },
    ],
    template: (args: { useCase: string }) => `Find plugins for: "${args.useCase}"

1. **Search Plugins**
   Use plugins_search with query "${args.useCase}"

2. **List All Plugins**
   Use plugins_list to see all available

3. **Get Details**
   For promising matches, use plugins_get_manifest to see available functions

Present:
- Matching plugins with descriptions
- Available functions and their parameters
- How to use each plugin`,
  },
  {
    name: 'daily_defi_briefing',
    description: 'Get a daily DeFi briefing with news, yields, and market data',
    arguments: [],
    template: `Create a comprehensive daily DeFi briefing.

1. **DeFi News**
   Use news_get_defi with limit 5

2. **Breaking Updates**
   Use news_get_breaking with limit 3

3. **Top Protocols by TVL**
   Use plugins_defillama_tvl (without protocol param for top list)

4. **Sperax Protocol Status**
   - analytics_get_tvl for Sperax TVL
   - usds_get_yield_info for current APY
   - analytics_get_protocol_revenue for revenue

Present as a structured briefing:
- Top DeFi headlines
- Breaking news summary
- Market overview (top protocols by TVL)
- Sperax ecosystem status`,
  },
];

// ============================================================================
// Prompt Schema for MCP
// ============================================================================

export const getPromptSchema = (promptName: string) => {
  const prompt = prompts.find(p => p.name === promptName);
  if (!prompt) return null;
  
  const schemaProps: Record<string, z.ZodTypeAny> = {};
  for (const arg of prompt.arguments || []) {
    schemaProps[arg.name] = arg.required 
      ? z.string().describe(arg.description)
      : z.string().optional().describe(arg.description);
  }
  
  return z.object(schemaProps);
};
