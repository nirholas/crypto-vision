/**
 * Portfolio Tracker Module
 * Aggregate and track crypto portfolio across multiple wallets and chains
 *
 * @author nich
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

// In-memory portfolio storage (would use database in production)
const portfolios = new Map<
  string,
  {
    name: string
    wallets: Array<{
      address: string
      chain: string
      label?: string
      addedAt: Date
    }>
    createdAt: Date
    lastUpdated: Date
  }
>()

// Price cache
const priceCache = new Map<string, { price: number; timestamp: Date }>()

// Mock prices for demo (in production, use real API)
const mockPrices: Record<string, number> = {
  BTC: 95000,
  ETH: 3500,
  BNB: 600,
  SOL: 180,
  MATIC: 0.85,
  ARB: 1.2,
  AVAX: 35,
  ATOM: 8,
  NEAR: 5,
  SUI: 3.5,
  APT: 9,
  USDT: 1,
  USDC: 1,
  DAI: 1,
}

export function registerPortfolioTracker(server: McpServer) {
  // Create portfolio
  server.tool(
    "portfolio_create",
    "Create a new portfolio to track wallets",
    {
      portfolioId: z.string().describe("Unique identifier for the portfolio"),
      name: z.string().describe("Display name for the portfolio"),
    },
    async ({ portfolioId, name }) => {
      if (portfolios.has(portfolioId)) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: "Portfolio already exists", portfolioId }, null, 2),
            },
          ],
          isError: true,
        }
      }

      portfolios.set(portfolioId, {
        name,
        wallets: [],
        createdAt: new Date(),
        lastUpdated: new Date(),
      })

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                portfolioId,
                name,
                message: "Portfolio created successfully",
                createdAt: new Date().toISOString(),
              },
              null,
              2
            ),
          },
        ],
      }
    }
  )

  // Add wallet to portfolio
  server.tool(
    "portfolio_add_wallet",
    "Add a wallet address to a portfolio",
    {
      portfolioId: z.string().describe("Portfolio ID"),
      address: z.string().describe("Wallet address"),
      chain: z
        .enum([
          "ethereum",
          "bsc",
          "polygon",
          "arbitrum",
          "avalanche",
          "solana",
          "cosmos",
          "near",
          "sui",
          "aptos",
        ])
        .describe("Blockchain network"),
      label: z.string().optional().describe("Optional label for the wallet"),
    },
    async ({ portfolioId, address, chain, label }) => {
      const portfolio = portfolios.get(portfolioId)

      if (!portfolio) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: "Portfolio not found", portfolioId }, null, 2),
            },
          ],
          isError: true,
        }
      }

      // Check if wallet already exists
      const exists = portfolio.wallets.some(
        (w) => w.address.toLowerCase() === address.toLowerCase() && w.chain === chain
      )

      if (exists) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: "Wallet already in portfolio", address, chain }, null, 2),
            },
          ],
          isError: true,
        }
      }

      portfolio.wallets.push({
        address,
        chain,
        label,
        addedAt: new Date(),
      })
      portfolio.lastUpdated = new Date()

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                portfolioId,
                wallet: { address, chain, label },
                message: "Wallet added successfully",
                totalWallets: portfolio.wallets.length,
              },
              null,
              2
            ),
          },
        ],
      }
    }
  )

  // Remove wallet from portfolio
  server.tool(
    "portfolio_remove_wallet",
    "Remove a wallet from a portfolio",
    {
      portfolioId: z.string().describe("Portfolio ID"),
      address: z.string().describe("Wallet address to remove"),
      chain: z.string().describe("Blockchain network"),
    },
    async ({ portfolioId, address, chain }) => {
      const portfolio = portfolios.get(portfolioId)

      if (!portfolio) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: "Portfolio not found", portfolioId }, null, 2),
            },
          ],
          isError: true,
        }
      }

      const initialLength = portfolio.wallets.length
      portfolio.wallets = portfolio.wallets.filter(
        (w) => !(w.address.toLowerCase() === address.toLowerCase() && w.chain === chain)
      )

      const removed = initialLength > portfolio.wallets.length

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                portfolioId,
                removed,
                address,
                chain,
                remainingWallets: portfolio.wallets.length,
              },
              null,
              2
            ),
          },
        ],
      }
    }
  )

  // Get portfolio summary
  server.tool(
    "portfolio_get_summary",
    "Get portfolio summary with total value and allocation",
    {
      portfolioId: z.string().describe("Portfolio ID"),
    },
    async ({ portfolioId }) => {
      const portfolio = portfolios.get(portfolioId)

      if (!portfolio) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: "Portfolio not found", portfolioId }, null, 2),
            },
          ],
          isError: true,
        }
      }

      // Simulate fetching balances (in production, call actual chain APIs)
      const holdings: Array<{
        wallet: string
        chain: string
        label?: string
        assets: Array<{
          symbol: string
          balance: number
          valueUSD: number
        }>
      }> = []

      let totalValueUSD = 0
      const assetTotals: Record<string, { balance: number; valueUSD: number }> = {}

      for (const wallet of portfolio.wallets) {
        // Mock data - in production, fetch real balances
        const nativeSymbol = {
          ethereum: "ETH",
          bsc: "BNB",
          polygon: "MATIC",
          arbitrum: "ETH",
          avalanche: "AVAX",
          solana: "SOL",
          cosmos: "ATOM",
          near: "NEAR",
          sui: "SUI",
          aptos: "APT",
        }[wallet.chain] || "ETH"

        const mockBalance = Math.random() * 10
        const price = mockPrices[nativeSymbol] || 0
        const valueUSD = mockBalance * price

        holdings.push({
          wallet: wallet.address,
          chain: wallet.chain,
          label: wallet.label,
          assets: [
            {
              symbol: nativeSymbol,
              balance: mockBalance,
              valueUSD,
            },
          ],
        })

        totalValueUSD += valueUSD

        if (!assetTotals[nativeSymbol]) {
          assetTotals[nativeSymbol] = { balance: 0, valueUSD: 0 }
        }
        assetTotals[nativeSymbol].balance += mockBalance
        assetTotals[nativeSymbol].valueUSD += valueUSD
      }

      // Calculate allocation percentages
      const allocation = Object.entries(assetTotals).map(([symbol, data]) => ({
        symbol,
        balance: data.balance,
        valueUSD: data.valueUSD,
        percentage: totalValueUSD > 0 ? (data.valueUSD / totalValueUSD) * 100 : 0,
      }))

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                portfolioId,
                name: portfolio.name,
                totalValueUSD,
                walletCount: portfolio.wallets.length,
                allocation: allocation.sort((a, b) => b.valueUSD - a.valueUSD),
                holdings,
                lastUpdated: new Date().toISOString(),
              },
              null,
              2
            ),
          },
        ],
      }
    }
  )

  // Get portfolio performance
  server.tool(
    "portfolio_get_performance",
    "Get portfolio performance over time",
    {
      portfolioId: z.string().describe("Portfolio ID"),
      period: z
        .enum(["24h", "7d", "30d", "90d", "1y", "all"])
        .default("7d")
        .describe("Time period"),
    },
    async ({ portfolioId, period }) => {
      const portfolio = portfolios.get(portfolioId)

      if (!portfolio) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: "Portfolio not found", portfolioId }, null, 2),
            },
          ],
          isError: true,
        }
      }

      // Mock performance data
      const periodDays: Record<string, number> = {
        "24h": 1,
        "7d": 7,
        "30d": 30,
        "90d": 90,
        "1y": 365,
        all: 1000,
      }

      const days = periodDays[period]
      const changePercent = (Math.random() - 0.3) * 20 // -7% to +14%

      // Generate historical data points
      const history = Array.from({ length: Math.min(days, 30) }, (_, i) => {
        const date = new Date()
        date.setDate(date.getDate() - (days - i * (days / 30)))
        const value = 50000 * (1 + ((changePercent / 100) * i) / 30)
        return {
          date: date.toISOString().split("T")[0],
          valueUSD: value + (Math.random() - 0.5) * 1000,
        }
      })

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                portfolioId,
                name: portfolio.name,
                period,
                performance: {
                  startValue: history[0]?.valueUSD || 0,
                  endValue: history[history.length - 1]?.valueUSD || 0,
                  changePercent,
                  changeUSD: (history[history.length - 1]?.valueUSD || 0) - (history[0]?.valueUSD || 0),
                },
                history: history.slice(-10), // Last 10 data points
              },
              null,
              2
            ),
          },
        ],
      }
    }
  )

  // List all portfolios
  server.tool("portfolio_list", "List all portfolios", {}, async () => {
    const portfolioList = Array.from(portfolios.entries()).map(([id, p]) => ({
      portfolioId: id,
      name: p.name,
      walletCount: p.wallets.length,
      createdAt: p.createdAt,
      lastUpdated: p.lastUpdated,
    }))

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              count: portfolioList.length,
              portfolios: portfolioList,
            },
            null,
            2
          ),
        },
      ],
    }
  })

  // Delete portfolio
  server.tool(
    "portfolio_delete",
    "Delete a portfolio",
    {
      portfolioId: z.string().describe("Portfolio ID to delete"),
    },
    async ({ portfolioId }) => {
      const existed = portfolios.delete(portfolioId)

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                portfolioId,
                deleted: existed,
                message: existed ? "Portfolio deleted" : "Portfolio not found",
              },
              null,
              2
            ),
          },
        ],
      }
    }
  )

  // Add manual holding (for CEX, cold storage, etc.)
  server.tool(
    "portfolio_add_manual_holding",
    "Add a manual holding (for CEX accounts, cold storage, etc.)",
    {
      portfolioId: z.string().describe("Portfolio ID"),
      symbol: z.string().describe("Asset symbol (e.g., BTC, ETH)"),
      amount: z.number().describe("Amount held"),
      source: z.string().describe("Source description (e.g., 'Coinbase', 'Cold Storage')"),
    },
    async ({ portfolioId, symbol, amount, source }) => {
      const portfolio = portfolios.get(portfolioId)

      if (!portfolio) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: "Portfolio not found", portfolioId }, null, 2),
            },
          ],
          isError: true,
        }
      }

      // Store as a special wallet entry
      portfolio.wallets.push({
        address: `manual:${source}:${symbol}:${amount}`,
        chain: "manual" as any,
        label: `${source} - ${symbol}`,
        addedAt: new Date(),
      })

      const price = mockPrices[symbol.toUpperCase()] || 0

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                portfolioId,
                added: {
                  symbol,
                  amount,
                  source,
                  estimatedValueUSD: amount * price,
                },
                message: "Manual holding added",
              },
              null,
              2
            ),
          },
        ],
      }
    }
  )

  // Export portfolio
  server.tool(
    "portfolio_export",
    "Export portfolio data as JSON",
    {
      portfolioId: z.string().describe("Portfolio ID"),
    },
    async ({ portfolioId }) => {
      const portfolio = portfolios.get(portfolioId)

      if (!portfolio) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: "Portfolio not found", portfolioId }, null, 2),
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
                exportedAt: new Date().toISOString(),
                portfolio: {
                  id: portfolioId,
                  ...portfolio,
                },
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
