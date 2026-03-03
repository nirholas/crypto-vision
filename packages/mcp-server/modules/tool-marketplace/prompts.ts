/**
 * Tool Marketplace Prompts
 * @description AI prompts for the decentralized tool marketplace
 * @author nirholas
 * @license Apache-2.0
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

/**
 * Register tool marketplace prompts with MCP server
 */
export function registerToolMarketplacePrompts(server: McpServer): void {
  // Prompt: Discover tools
  server.prompt(
    "discover-paid-tools",
    "Find paid AI tools in the marketplace that match your needs",
    {
      requirement: {
        type: "string",
        description: "What kind of tool are you looking for?",
        required: true,
      },
      maxBudget: {
        type: "string",
        description: "Maximum budget per call (e.g., '0.01')",
        required: false,
      },
    },
    async ({ requirement, maxBudget }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `I need to find paid AI tools for: ${requirement}

${maxBudget ? `My maximum budget per call is $${maxBudget}.` : ""}

Please use the marketplace_discover_tools tool to search for relevant tools.
Consider searching by:
1. Keywords in the description
2. Relevant categories
3. Price filters if I specified a budget

For each tool found, tell me:
- What it does
- How much it costs
- Its rating and popularity
- How to use it with x402 payments`,
        },
      }],
    })
  )

  // Prompt: Register a new tool
  server.prompt(
    "register-marketplace-tool",
    "Register your AI tool in the decentralized marketplace",
    {
      toolName: {
        type: "string",
        description: "Name for your tool",
        required: true,
      },
      toolDescription: {
        type: "string",
        description: "What does your tool do?",
        required: true,
      },
      endpoint: {
        type: "string",
        description: "Your API endpoint URL",
        required: true,
      },
      pricePerCall: {
        type: "string",
        description: "Price per call in USD",
        required: true,
      },
      ownerAddress: {
        type: "string",
        description: "Your wallet address",
        required: true,
      },
    },
    async ({ toolName, toolDescription, endpoint, pricePerCall, ownerAddress }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `I want to register a new tool in the marketplace:

**Tool Details:**
- Name: ${toolName}
- Description: ${toolDescription}
- Endpoint: ${endpoint}
- Price: $${pricePerCall} per call
- Owner: ${ownerAddress}

Please help me:
1. Choose the best category for this tool
2. Suggest relevant tags for discovery
3. Set up a fair revenue split (e.g., 80% creator, 20% platform)
4. Register the tool using marketplace_register_tool

After registration, explain how AI agents will be able to discover and pay for my tool.`,
        },
      }],
    })
  )

  // Prompt: Check creator earnings
  server.prompt(
    "creator-earnings-dashboard",
    "View your earnings and analytics as a tool creator",
    {
      creatorAddress: {
        type: "string",
        description: "Your wallet address",
        required: true,
      },
    },
    async ({ creatorAddress }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Show me my earnings dashboard for address: ${creatorAddress}

Use marketplace_creator_analytics to get:
1. Total revenue earned across all my tools
2. Breakdown by individual tool
3. Weekly revenue trends
4. Number of calls and average rating

Also check marketplace_tool_revenue for each of my tools to see:
- Pending payouts
- Weekly vs monthly performance
- Revenue split distribution

Present this as a clear dashboard summary.`,
        },
      }],
    })
  )

  // Prompt: Use a paid tool
  server.prompt(
    "use-paid-tool",
    "Use a paid tool from the marketplace with x402 payment",
    {
      toolName: {
        type: "string",
        description: "Name or ID of the tool to use",
        required: true,
      },
      request: {
        type: "string",
        description: "What you want the tool to do",
        required: true,
      },
    },
    async ({ toolName, request }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `I want to use the paid tool "${toolName}" from the marketplace.

My request: ${request}

Please:
1. First, use marketplace_get_tool to get the tool details and endpoint
2. Show me the price and payment requirements
3. If I approve, use x402_pay_request to make the paid API call
4. Return the results

Make sure to check:
- The tool is active
- The price is reasonable
- Payment will go through my configured x402 wallet`,
        },
      }],
    })
  )

  // Prompt: Marketplace overview
  server.prompt(
    "marketplace-overview",
    "Get an overview of the AI tool marketplace",
    {},
    async () => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Give me a comprehensive overview of the AI tool marketplace.

Use these tools to gather information:
1. marketplace_stats - Overall marketplace statistics
2. marketplace_discover_tools with sortBy: "popularity" - Top tools
3. marketplace_recent_events - Recent activity

Present a summary including:
- Total tools and active creators
- Trading volume (24h, 7d, all-time)
- Most popular categories
- Top earning tools
- Average tool pricing
- Recent marketplace activity

This will help me understand the marketplace landscape.`,
        },
      }],
    })
  )

  // Prompt: Price your tool
  server.prompt(
    "price-my-tool",
    "Get help pricing your AI tool for the marketplace",
    {
      toolDescription: {
        type: "string",
        description: "What does your tool do?",
        required: true,
      },
      category: {
        type: "string",
        description: "Tool category (data, ai, defi, etc.)",
        required: true,
      },
      uniqueFeatures: {
        type: "string",
        description: "What makes your tool unique?",
        required: true,
      },
    },
    async ({ toolDescription, category, uniqueFeatures }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Help me price my new AI tool for the marketplace.

**My Tool:**
- Description: ${toolDescription}
- Category: ${category}
- Unique Features: ${uniqueFeatures}

Please:
1. Use marketplace_discover_tools to find similar tools in my category
2. Analyze their pricing and popularity
3. Consider my unique features and value proposition
4. Recommend a competitive price point

Include:
- Suggested base price per call
- Pricing model recommendation (per-call, subscription, tiered, freemium)
- Revenue expectations based on similar tools
- Tips for maximizing adoption`,
        },
      }],
    })
  )
}
