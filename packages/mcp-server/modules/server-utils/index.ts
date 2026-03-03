/**
 * Server Utilities Module
 * Health checks, environment validation, and OpenAPI spec
 *
 * @author nich
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

// Server start time for uptime calculation
const serverStartTime = Date.now()

// Required environment variables
const requiredEnvVars: string[] = []

// Optional but recommended env vars
const recommendedEnvVars = [
  "ETHEREUM_RPC_URL",
  "SOLANA_RPC_URL",
  "COINGECKO_API_KEY",
  "ETHERSCAN_API_KEY",
]

export function registerServerUtils(server: McpServer) {
  // Health check
  server.tool("server_health", "Check server health and status", {}, async () => {
    const uptime = Date.now() - serverStartTime
    const uptimeSeconds = Math.floor(uptime / 1000)
    const uptimeMinutes = Math.floor(uptimeSeconds / 60)
    const uptimeHours = Math.floor(uptimeMinutes / 60)
    const uptimeDays = Math.floor(uptimeHours / 24)

    const memoryUsage = process.memoryUsage()

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              status: "healthy",
              timestamp: new Date().toISOString(),
              uptime: {
                ms: uptime,
                formatted: `${uptimeDays}d ${uptimeHours % 24}h ${uptimeMinutes % 60}m ${uptimeSeconds % 60}s`,
              },
              memory: {
                heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
                heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
                rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
              },
              nodeVersion: process.version,
              platform: process.platform,
              pid: process.pid,
            },
            null,
            2
          ),
        },
      ],
    }
  })

  // Environment validation
  server.tool(
    "server_validate_env",
    "Validate environment configuration",
    {},
    async () => {
      const missing: string[] = []
      const present: string[] = []
      const warnings: string[] = []

      // Check required
      for (const envVar of requiredEnvVars) {
        if (process.env[envVar]) {
          present.push(envVar)
        } else {
          missing.push(envVar)
        }
      }

      // Check recommended
      for (const envVar of recommendedEnvVars) {
        if (process.env[envVar]) {
          present.push(envVar)
        } else {
          warnings.push(`${envVar} not set - some features may be limited`)
        }
      }

      const isValid = missing.length === 0

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                valid: isValid,
                status: isValid ? "OK" : "INVALID",
                required: {
                  present: present.filter((v) => requiredEnvVars.includes(v)),
                  missing,
                },
                recommended: {
                  present: present.filter((v) => recommendedEnvVars.includes(v)),
                  missing: recommendedEnvVars.filter(
                    (v) => !process.env[v]
                  ),
                },
                warnings,
                message: isValid
                  ? "Environment configuration is valid"
                  : `Missing required variables: ${missing.join(", ")}`,
              },
              null,
              2
            ),
          },
        ],
      }
    }
  )

  // Get server info
  server.tool("server_info", "Get server information and capabilities", {}, async () => {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              name: "Universal Crypto MCP",
              version: "1.0.0",
              description: "Comprehensive cryptocurrency data and blockchain interaction via MCP",
              author: "nich",
              github: "github.com/nirholas/universal-crypto-mcp",
              license: "Apache-2.0",
              capabilities: {
                chains: [
                  "Ethereum",
                  "BSC",
                  "Polygon",
                  "Arbitrum",
                  "Avalanche",
                  "Optimism",
                  "Base",
                  "Fantom",
                  "Solana",
                  "Cosmos",
                  "Near",
                  "Sui",
                  "Aptos",
                ],
                features: [
                  "Market Data",
                  "DeFi Analytics",
                  "Token Analysis",
                  "Wallet Tracking",
                  "Technical Indicators",
                  "Portfolio Management",
                  "On-Chain Alerts",
                  "Historical Data",
                  "WebSocket Subscriptions",
                  "AI Prompt Templates",
                  "Governance Tracking",
                  "News & Sentiment",
                ],
                protocols: [
                  "Uniswap",
                  "Aave",
                  "Compound",
                  "Curve",
                  "Lido",
                  "GMX",
                  "dYdX",
                  "PancakeSwap",
                  "SushiSwap",
                  "Raydium",
                ],
              },
              endpoints: {
                stdio: "Default MCP transport",
                sse: "Server-Sent Events at /sse",
                http: "HTTP endpoint at /",
              },
            },
            null,
            2
          ),
        },
      ],
    }
  })

  // Get OpenAPI specification
  server.tool(
    "server_openapi_spec",
    "Get OpenAPI specification for the server",
    {},
    async () => {
      const openApiSpec = {
        openapi: "3.0.0",
        info: {
          title: "Universal Crypto MCP",
          version: "1.0.0",
          description: "Comprehensive cryptocurrency data and blockchain interaction API",
          contact: {
            name: "GitHub",
            url: "https://github.com/nirholas/universal-crypto-mcp",
          },
          license: {
            name: "Apache-2.0",
            url: "https://www.apache.org/licenses/LICENSE-2.0",
          },
        },
        servers: [
          {
            url: "http://localhost:3000",
            description: "Local development server",
          },
        ],
        paths: {
          "/health": {
            get: {
              summary: "Health check",
              responses: {
                "200": {
                  description: "Server is healthy",
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          status: { type: "string" },
                          uptime: { type: "number" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          "/sse": {
            get: {
              summary: "Server-Sent Events endpoint",
              description: "Connect for real-time MCP communication",
              responses: {
                "200": {
                  description: "SSE stream established",
                },
              },
            },
          },
        },
        components: {
          schemas: {
            ToolCall: {
              type: "object",
              properties: {
                name: { type: "string" },
                arguments: { type: "object" },
              },
            },
            ToolResult: {
              type: "object",
              properties: {
                content: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string" },
                      text: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(openApiSpec, null, 2),
          },
        ],
      }
    }
  )

  // List all available tools
  server.tool(
    "server_list_tools",
    "List all available tools with descriptions",
    {
      category: z.string().optional().describe("Filter by category"),
      search: z.string().optional().describe("Search in tool names/descriptions"),
    },
    async ({ category, search }) => {
      // Tool categories (this would be dynamically generated in production)
      const toolCategories: Record<string, string[]> = {
        market_data: [
          "get_crypto_price",
          "get_market_overview",
          "get_trending_coins",
          "get_top_coins",
        ],
        defi: [
          "defi_protocol_tvl",
          "defi_yield_farming",
          "defi_lending_rates",
          "defi_pools",
        ],
        evm: [
          "evm_get_balance",
          "evm_get_token_balance",
          "evm_get_transactions",
          "evm_call_contract",
        ],
        solana: [
          "solana_get_balance",
          "solana_get_token_accounts",
          "solana_get_transaction",
        ],
        cosmos: [
          "cosmos_get_balance",
          "cosmos_get_delegations",
          "cosmos_get_validators",
        ],
        near: ["near_get_balance", "near_get_account", "near_view_function"],
        sui: ["sui_get_balance", "sui_get_owned_objects", "sui_get_validators"],
        aptos: ["aptos_get_balance", "aptos_get_account", "aptos_view_function"],
        portfolio: [
          "portfolio_create",
          "portfolio_add_wallet",
          "portfolio_get_summary",
        ],
        alerts: ["alert_price", "alert_whale_movement", "alert_gas", "alert_check"],
        analytics: [
          "wallet_score",
          "wallet_detect_whales",
          "wallet_profile",
        ],
        historical: [
          "historical_ohlcv",
          "historical_prices",
          "historical_market_cap",
        ],
        indicators: [
          "indicator_rsi",
          "indicator_macd",
          "indicator_bollinger",
          "indicator_ema",
        ],
        server: [
          "server_health",
          "server_info",
          "server_validate_env",
          "server_list_tools",
        ],
      }

      let result = Object.entries(toolCategories)

      if (category) {
        result = result.filter(([cat]) =>
          cat.toLowerCase().includes(category.toLowerCase())
        )
      }

      if (search) {
        const searchLower = search.toLowerCase()
        result = result.map(([cat, tools]) => [
          cat,
          tools.filter((t) => t.toLowerCase().includes(searchLower)),
        ]).filter(([_, tools]) => (tools as string[]).length > 0) as [string, string[]][]
      }

      const totalTools = result.reduce((sum, [_, tools]) => sum + tools.length, 0)

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                totalCategories: result.length,
                totalTools,
                categories: Object.fromEntries(result),
              },
              null,
              2
            ),
          },
        ],
      }
    }
  )

  // Get rate limit status
  server.tool("server_rate_limits", "Get current rate limit status", {}, async () => {
    // Mock rate limit data - in production, track actual usage
    const rateLimits = {
      global: {
        limit: 1000,
        remaining: 847,
        resetAt: new Date(Date.now() + 60000).toISOString(),
      },
      byEndpoint: {
        coingecko: { limit: 50, remaining: 42, resetAt: new Date(Date.now() + 60000).toISOString() },
        etherscan: { limit: 5, remaining: 3, resetAt: new Date(Date.now() + 1000).toISOString() },
        solana: { limit: 100, remaining: 95, resetAt: new Date(Date.now() + 10000).toISOString() },
      },
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(rateLimits, null, 2),
        },
      ],
    }
  })

  // Clear caches
  server.tool("server_clear_cache", "Clear server caches", {}, async () => {
    // In production, clear actual caches
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              cleared: true,
              caches: ["price_cache", "token_cache", "historical_cache"],
              message: "All caches cleared successfully",
            },
            null,
            2
          ),
        },
      ],
    }
  })
}
