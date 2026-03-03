/**
 * AI Prompt Templates Module
 * Pre-built prompt templates for common crypto analysis tasks
 *
 * @author nich
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

// Prompt template definitions
const promptTemplates: Record<
  string,
  {
    name: string
    category: string
    description: string
    template: string
    variables: string[]
    example?: string
  }
> = {
  // Market Analysis
  token_analysis: {
    name: "Comprehensive Token Analysis",
    category: "market_analysis",
    description: "Deep dive analysis of a token including fundamentals, technicals, and sentiment",
    template: `Perform a comprehensive analysis of {token_symbol} ({token_name}):

1. **Fundamentals**:
   - Project overview and use case
   - Team and development activity
   - Tokenomics (supply, distribution, vesting)
   - Partnerships and ecosystem

2. **Technical Analysis**:
   - Current price: {current_price}
   - Price action and trend analysis
   - Key support/resistance levels
   - Volume analysis

3. **On-Chain Metrics**:
   - Holder distribution
   - Whale activity
   - Network activity (if applicable)

4. **Sentiment**:
   - Social media sentiment
   - Community engagement
   - Recent news and developments

5. **Risk Assessment**:
   - Key risks and concerns
   - Competitive landscape
   - Regulatory considerations

6. **Conclusion**:
   - Bull case
   - Bear case
   - Overall rating (1-10)`,
    variables: ["token_symbol", "token_name", "current_price"],
    example: "token_symbol=ETH, token_name=Ethereum, current_price=$3,500",
  },

  market_overview: {
    name: "Daily Market Overview",
    category: "market_analysis",
    description: "Generate a daily crypto market summary",
    template: `Generate a comprehensive daily crypto market overview for {date}:

**Market Summary**:
- Total Market Cap: {total_market_cap}
- 24h Volume: {volume_24h}
- BTC Dominance: {btc_dominance}
- Fear & Greed Index: {fear_greed}

**Top Performers (24h)**:
{top_gainers}

**Biggest Losers (24h)**:
{top_losers}

**Key Events & News**:
- Summarize any significant developments
- Regulatory news
- Major protocol updates

**Technical Outlook**:
- BTC key levels
- ETH key levels
- Market structure analysis

**What to Watch**:
- Upcoming events
- Key levels to monitor
- Potential catalysts`,
    variables: [
      "date",
      "total_market_cap",
      "volume_24h",
      "btc_dominance",
      "fear_greed",
      "top_gainers",
      "top_losers",
    ],
  },

  // Trading
  trade_setup: {
    name: "Trade Setup Analysis",
    category: "trading",
    description: "Analyze a potential trade setup with entry, targets, and risk management",
    template: `Analyze this trade setup for {token_symbol}:

**Current Setup**:
- Price: {current_price}
- Timeframe: {timeframe}
- Direction: {direction}

**Technical Analysis**:
1. Trend: Is the trend aligned with the trade direction?
2. Key Levels:
   - Resistance: {resistance_levels}
   - Support: {support_levels}
3. Indicators: RSI, MACD, Moving Averages
4. Volume: Is volume confirming the setup?

**Trade Plan**:
- Entry Zone: Calculate optimal entry
- Stop Loss: Define stop loss with reasoning
- Take Profit Targets: Set multiple targets
- Risk/Reward Ratio: Calculate R:R

**Risk Assessment**:
- Position sizing recommendation (based on {account_size} account)
- Maximum loss in USD
- Probability assessment

**Invalidation**:
- What would invalidate this trade?
- Warning signs to watch for`,
    variables: [
      "token_symbol",
      "current_price",
      "timeframe",
      "direction",
      "resistance_levels",
      "support_levels",
      "account_size",
    ],
  },

  // DeFi
  defi_yield: {
    name: "DeFi Yield Opportunity Analysis",
    category: "defi",
    description: "Analyze a DeFi yield farming opportunity",
    template: `Analyze this DeFi yield opportunity:

**Protocol**: {protocol_name}
**Chain**: {chain}
**Pool/Vault**: {pool_name}
**Current APY**: {apy}%

**Analysis Required**:

1. **Protocol Safety**:
   - Is the protocol audited?
   - TVL and history
   - Smart contract risk assessment

2. **Yield Breakdown**:
   - Base yield source
   - Reward token emissions
   - Is the yield sustainable?

3. **Risks**:
   - Impermanent loss (if LP)
   - Smart contract risk
   - Centralization risks
   - Liquidation risks (if lending)

4. **Strategy Recommendation**:
   - Optimal deposit amount
   - Compounding frequency
   - Exit strategy

5. **Comparison**:
   - How does this compare to similar opportunities?
   - Risk-adjusted return analysis

**Verdict**: Is this opportunity worth pursuing?`,
    variables: ["protocol_name", "chain", "pool_name", "apy"],
  },

  // Portfolio
  portfolio_review: {
    name: "Portfolio Review",
    category: "portfolio",
    description: "Review and optimize a crypto portfolio",
    template: `Review this crypto portfolio:

**Current Holdings**:
{portfolio_holdings}

**Total Value**: {total_value}

**Analysis Required**:

1. **Allocation Analysis**:
   - Current allocation breakdown
   - Concentration risk assessment
   - Diversification score

2. **Risk Assessment**:
   - Overall portfolio risk level
   - Correlation analysis
   - Exposure to different sectors

3. **Performance Review**:
   - Portfolio performance vs BTC
   - Portfolio performance vs ETH
   - Best/worst performers

4. **Optimization Suggestions**:
   - Rebalancing recommendations
   - Underweight/overweight positions
   - New positions to consider
   - Positions to reduce

5. **Risk Management**:
   - Stop loss recommendations
   - Hedging strategies
   - Stablecoin allocation

**Action Plan**:
- Immediate actions
- Short-term adjustments
- Long-term strategy`,
    variables: ["portfolio_holdings", "total_value"],
  },

  // Research
  new_token_research: {
    name: "New Token Due Diligence",
    category: "research",
    description: "Research checklist for evaluating a new token",
    template: `Perform due diligence on this new token:

**Token**: {token_name} ({token_symbol})
**Contract**: {contract_address}
**Chain**: {chain}

**Due Diligence Checklist**:

1. **Contract Analysis**:
   - Is the contract verified?
   - Are there any red flags in the code?
   - Ownership status (renounced?)
   - Mint/pause functions?

2. **Liquidity Analysis**:
   - Liquidity amount and locked status
   - Lock duration
   - Top LP holders

3. **Holder Analysis**:
   - Top holder distribution
   - Team/insider wallets
   - Wallet age of top holders

4. **Project Verification**:
   - Website and social media presence
   - Team information
   - Whitepaper/documentation
   - GitHub activity

5. **Red Flag Checklist**:
   [ ] Honeypot check
   [ ] High buy/sell tax
   [ ] Blacklist function
   [ ] Hidden mint function
   [ ] Suspicious team wallets

6. **Community Assessment**:
   - Telegram/Discord activity
   - Twitter engagement
   - Organic vs bot activity

**Risk Score**: 1-10 (10 = highest risk)
**Investment Recommendation**: Yes/No/Wait`,
    variables: ["token_name", "token_symbol", "contract_address", "chain"],
  },

  // Technical
  support_resistance: {
    name: "Support & Resistance Analysis",
    category: "technical",
    description: "Identify key support and resistance levels",
    template: `Analyze support and resistance levels for {token_symbol}:

**Current Price**: {current_price}
**Timeframe**: {timeframe}

**Analysis Required**:

1. **Major Resistance Levels**:
   - Identify 3 key resistance levels above current price
   - Explain why each level is significant
   - Volume at each level

2. **Major Support Levels**:
   - Identify 3 key support levels below current price
   - Explain why each level is significant
   - Volume at each level

3. **Trend Lines**:
   - Ascending/descending trend lines
   - Channel boundaries

4. **Fibonacci Levels**:
   - Key retracement levels
   - Extension targets

5. **Moving Averages**:
   - 20, 50, 100, 200 MA positions
   - MA crossover status

6. **Volume Profile**:
   - High volume nodes
   - Value area high/low

**Summary**:
- Most likely scenario
- Key levels to watch
- Invalidation points`,
    variables: ["token_symbol", "current_price", "timeframe"],
  },

  // Governance
  governance_proposal: {
    name: "Governance Proposal Analysis",
    category: "governance",
    description: "Analyze a DAO governance proposal",
    template: `Analyze this governance proposal:

**Protocol**: {protocol_name}
**Proposal ID**: {proposal_id}
**Title**: {proposal_title}

**Proposal Summary**:
{proposal_description}

**Analysis Required**:

1. **Impact Assessment**:
   - What changes if this passes?
   - Who benefits/loses?
   - Financial impact on protocol

2. **Technical Analysis**:
   - Is this technically feasible?
   - Any implementation risks?
   - Timeline considerations

3. **Tokenomics Impact**:
   - Effect on token supply
   - Effect on token utility
   - Price implications

4. **Community Sentiment**:
   - Forum discussion summary
   - Key stakeholder opinions
   - Voting power breakdown

5. **Historical Context**:
   - Similar past proposals
   - Previous voting patterns

6. **Recommendation**:
   - Vote: For/Against/Abstain
   - Reasoning
   - Potential amendments`,
    variables: ["protocol_name", "proposal_id", "proposal_title", "proposal_description"],
  },
}

export function registerAIPrompts(server: McpServer) {
  // List available prompts
  server.tool(
    "prompt_list",
    "List all available AI prompt templates",
    {
      category: z
        .enum(["all", "market_analysis", "trading", "defi", "portfolio", "research", "technical", "governance"])
        .default("all")
        .describe("Filter by category"),
    },
    async ({ category }) => {
      let templates = Object.entries(promptTemplates)

      if (category !== "all") {
        templates = templates.filter(([_, t]) => t.category === category)
      }

      const list = templates.map(([id, t]) => ({
        id,
        name: t.name,
        category: t.category,
        description: t.description,
        variables: t.variables,
      }))

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                count: list.length,
                categories: [...new Set(Object.values(promptTemplates).map((t) => t.category))],
                templates: list,
              },
              null,
              2
            ),
          },
        ],
      }
    }
  )

  // Get prompt template
  server.tool(
    "prompt_get",
    "Get a specific prompt template with variable placeholders",
    {
      templateId: z.string().describe("Template ID from prompt_list"),
    },
    async ({ templateId }) => {
      const template = promptTemplates[templateId]

      if (!template) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  error: "Template not found",
                  templateId,
                  availableTemplates: Object.keys(promptTemplates),
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        }
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                id: templateId,
                ...template,
              },
              null,
              2
            ),
          },
        ],
      }
    }
  )

  // Generate prompt with variables filled
  server.tool(
    "prompt_generate",
    "Generate a prompt by filling in template variables",
    {
      templateId: z.string().describe("Template ID"),
      variables: z.record(z.string()).describe("Variable values as key-value pairs"),
    },
    async ({ templateId, variables }) => {
      const template = promptTemplates[templateId]

      if (!template) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: "Template not found", templateId }, null, 2),
            },
          ],
          isError: true,
        }
      }

      // Check for missing variables
      const missing = template.variables.filter((v) => !variables[v])
      if (missing.length > 0) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  error: "Missing required variables",
                  missing,
                  provided: Object.keys(variables),
                  required: template.variables,
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        }
      }

      // Fill in variables
      let prompt = template.template
      for (const [key, value] of Object.entries(variables)) {
        prompt = prompt.replace(new RegExp(`{${key}}`, "g"), value)
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                templateId,
                name: template.name,
                generatedPrompt: prompt,
              },
              null,
              2
            ),
          },
        ],
      }
    }
  )

  // Quick prompts for common tasks
  server.tool(
    "prompt_quick",
    "Generate a quick prompt for common crypto analysis tasks",
    {
      task: z
        .enum([
          "price_prediction",
          "compare_tokens",
          "explain_defi",
          "gas_optimization",
          "security_check",
          "whale_analysis",
          "trend_analysis",
          "news_summary",
        ])
        .describe("Quick task type"),
      context: z.string().describe("Context or specific inputs for the task"),
    },
    async ({ task, context }) => {
      const quickPrompts: Record<string, string> = {
        price_prediction: `Based on the following data, provide a price prediction analysis for ${context}:

1. Analyze current market conditions
2. Identify key technical levels
3. Consider fundamental factors
4. Assess market sentiment
5. Provide short-term (24h, 7d) and medium-term (30d) predictions with confidence levels
6. List key assumptions and risks`,

        compare_tokens: `Compare and contrast the following tokens: ${context}

1. Technology & Use Case
2. Tokenomics comparison
3. Market metrics (market cap, volume, liquidity)
4. Team & Development
5. Community & Ecosystem
6. Investment thesis for each
7. Which would you recommend and why?`,

        explain_defi: `Explain the following DeFi concept/protocol in simple terms: ${context}

1. What is it and what problem does it solve?
2. How does it work (step by step)?
3. Key terms and concepts
4. Risks to be aware of
5. Best practices for using it
6. Comparison to alternatives`,

        gas_optimization: `Provide gas optimization strategies for: ${context}

1. Current gas conditions analysis
2. Best times to transact
3. Layer 2 alternatives
4. Transaction batching opportunities
5. Gas token strategies
6. Specific recommendations`,

        security_check: `Perform a security assessment for: ${context}

1. Contract verification status
2. Audit history
3. Known vulnerabilities
4. Team/ownership analysis
5. Red flags to watch for
6. Risk rating (1-10)
7. Safety recommendations`,

        whale_analysis: `Analyze whale activity for: ${context}

1. Top holder distribution
2. Recent large transactions
3. Exchange inflows/outflows
4. Whale wallet behaviors
5. Impact on price
6. What this means for retail investors`,

        trend_analysis: `Perform trend analysis for: ${context}

1. Current trend direction and strength
2. Trend line analysis
3. Moving average analysis
4. Momentum indicators
5. Volume confirmation
6. Potential trend reversal signals
7. Key levels to watch`,

        news_summary: `Summarize recent news and developments for: ${context}

1. Major announcements (last 7 days)
2. Partnerships and integrations
3. Technical updates
4. Market-moving events
5. Sentiment analysis
6. Impact assessment
7. What to watch for next`,
      }

      const prompt = quickPrompts[task]

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                task,
                context,
                generatedPrompt: prompt,
              },
              null,
              2
            ),
          },
        ],
      }
    }
  )

  // Custom prompt builder
  server.tool(
    "prompt_build_custom",
    "Build a custom prompt with guided structure",
    {
      topic: z.string().describe("Main topic or asset to analyze"),
      analysisTypes: z
        .array(
          z.enum([
            "fundamental",
            "technical",
            "on_chain",
            "sentiment",
            "risk",
            "comparison",
            "prediction",
          ])
        )
        .describe("Types of analysis to include"),
      timeframe: z.string().optional().describe("Analysis timeframe"),
      additionalContext: z.string().optional().describe("Additional context or requirements"),
    },
    async ({ topic, analysisTypes, timeframe, additionalContext }) => {
      const sections: string[] = [`Perform a comprehensive analysis of **${topic}**:`]

      if (timeframe) {
        sections.push(`\nTimeframe: ${timeframe}`)
      }

      if (analysisTypes.includes("fundamental")) {
        sections.push(`
## Fundamental Analysis
- Project overview and value proposition
- Team background and track record
- Tokenomics and distribution
- Competitive landscape
- Growth potential`)
      }

      if (analysisTypes.includes("technical")) {
        sections.push(`
## Technical Analysis
- Price action and trend
- Key support and resistance levels
- Moving averages (20, 50, 200)
- RSI, MACD, and other indicators
- Volume analysis
- Chart patterns`)
      }

      if (analysisTypes.includes("on_chain")) {
        sections.push(`
## On-Chain Analysis
- Active addresses and transactions
- Holder distribution
- Whale movements
- Network value metrics
- DeFi TVL (if applicable)`)
      }

      if (analysisTypes.includes("sentiment")) {
        sections.push(`
## Sentiment Analysis
- Social media trends
- News sentiment
- Community engagement
- Developer activity
- Market positioning`)
      }

      if (analysisTypes.includes("risk")) {
        sections.push(`
## Risk Assessment
- Market risks
- Technical risks
- Regulatory risks
- Competition risks
- Overall risk rating (1-10)`)
      }

      if (analysisTypes.includes("comparison")) {
        sections.push(`
## Comparative Analysis
- Comparison with similar projects
- Relative valuation
- Market share analysis
- Unique advantages/disadvantages`)
      }

      if (analysisTypes.includes("prediction")) {
        sections.push(`
## Predictions & Outlook
- Short-term outlook (1-7 days)
- Medium-term outlook (1-3 months)
- Long-term outlook (6-12 months)
- Key catalysts to watch
- Price targets with confidence levels`)
      }

      if (additionalContext) {
        sections.push(`\n## Additional Requirements\n${additionalContext}`)
      }

      sections.push(`
## Conclusion
- Summary of key findings
- Actionable recommendations
- Key metrics to monitor`)

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                topic,
                analysisTypes,
                generatedPrompt: sections.join("\n"),
              },
              null,
              2
            ),
          },
        ],
      }
    }
  )
}
