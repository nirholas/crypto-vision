/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { Client as ThorchainClient } from "@xchainjs/xchain-thorchain"
import { Thornode } from "@xchainjs/xchain-thorchain-query"
import { Network } from "@xchainjs/xchain-client"
import { assetFromString, assetToString } from "@xchainjs/xchain-util"
import { BigNumber } from "bignumber.js"

import Logger from "@/utils/logger.js"

// Initialize Thorchain clients
const thorchainClient = new ThorchainClient({
  network: Network.Mainnet,
  phrase: process.env.THORCHAIN_MNEMONIC || ""
})

const thornode = new Thornode(Network.Mainnet)

// Helper function to format base amounts
function formatBaseAmount(baseAmount: any): string {
  return baseAmount.amount().toString()
}

export function registerThorchainTools(server: McpServer) {
  // ==================== BALANCE ====================

  server.tool(
    "thorchain_get_balance",
    "Get RUNE balance for a THORChain address",
    {
      address: z.string().describe("THORChain address to check")
    },
    async ({ address }) => {
      try {
        const balances = await thorchainClient.getBalance(address)
        return {
          content: [
            {
              type: "text" as const,
              text: `THORChain Balance for ${address}:\n${formatBaseAmount(balances[0].amount)} RUNE`
            }
          ]
        }
      } catch (err) {
        const error = err as Error
        return {
          content: [
            { type: "text" as const, text: `Failed to retrieve RUNE balance: ${error.message}` }
          ]
        }
      }
    }
  )

  // ==================== POOL INFO ====================

  server.tool(
    "thorchain_get_pool_info",
    "Get information about a THORChain liquidity pool",
    {
      asset: z.string().describe("Asset symbol (e.g., 'BTC.BTC', 'ETH.ETH')")
    },
    async ({ asset }) => {
      try {
        const pool = await thornode.getPool(asset)
        return {
          content: [
            {
              type: "text" as const,
              text: `Pool Information for ${asset}:
Status: ${pool.status}
Asset Depth: ${pool.balance_asset}
RUNE Depth: ${pool.balance_rune}
LP Units: ${pool.LP_units}
Synth Units: ${pool.synth_units}`
            }
          ]
        }
      } catch (err) {
        const error = err as Error
        return {
          content: [
            { type: "text" as const, text: `Failed to retrieve pool information: ${error.message}` }
          ]
        }
      }
    }
  )

  // ==================== SWAP QUOTE ====================

  server.tool(
    "thorchain_get_swap_quote",
    "Get a quote for swapping assets on THORChain",
    {
      fromAsset: z.string().describe("Source asset (e.g., 'BTC.BTC')"),
      toAsset: z.string().describe("Destination asset (e.g., 'ETH.ETH')"),
      amount: z.string().describe("Amount to swap")
    },
    async ({ fromAsset: fromAssetString, toAsset: toAssetString, amount: amountString }) => {
      try {
        // Parse assets
        const fromAsset = assetFromString(fromAssetString)
        const toAsset = assetFromString(toAssetString)
        if (!fromAsset || !toAsset) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Invalid asset format. Expected format: 'CHAIN.SYMBOL' (e.g., 'BTC.BTC', 'ETH.ETH')`
              }
            ]
          }
        }

        // Parse amount
        let numAmount
        try {
          numAmount = new BigNumber(amountString)
          if (numAmount.isNaN() || numAmount.isLessThanOrEqualTo(0)) {
            throw new Error("Invalid amount")
          }
        } catch (error) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Invalid amount format. Please provide a valid positive number.`
              }
            ]
          }
        }

        // Convert amount to base units
        const amountInBaseUnits = numAmount.multipliedBy(10 ** 8).toFixed(0)

        // Format the quote request parameters
        const quoteParams = {
          amount: amountInBaseUnits,
          from_asset: assetToString(fromAsset),
          to_asset: assetToString(toAsset).replace("-B1A", ""),
          destination: "",
          streaming_interval: "1",
          streaming_quantity: "0"
        }

        // Get quote from THORNode directly
        const response = await fetch(
          `https://thornode.ninerealms.com/thorchain/quote/swap?${new URLSearchParams(quoteParams)}`
        )
        if (!response.ok) {
          throw new Error(`THORNode API error: ${response.status} ${response.statusText}`)
        }
        const quote = await response.json()

        // Helper function to format asset amounts with proper decimals
        const formatAssetAmount = (amount: string | number, decimals: number = 8) => {
          const num = Number(amount) / Math.pow(10, decimals)
          return num.toLocaleString("en-US", { maximumFractionDigits: decimals })
        }

        return {
          content: [
            {
              type: "text" as const,
              text: `Swap Quote:
Expected Output: ${formatAssetAmount(quote.expected_amount_out)} ${quoteParams.to_asset}
Fees:
- Affiliate Fee: ${formatAssetAmount(quote.fees.affiliate)} ${quote.fees.asset}
- Outbound Fee: ${formatAssetAmount(quote.fees.outbound)} ${quote.fees.asset}
- Liquidity Fee: ${formatAssetAmount(quote.fees.liquidity)} ${quote.fees.asset}
- Total Fee: ${formatAssetAmount(quote.fees.total)} ${quote.fees.asset}
Slippage: ${quote.fees.slippage_bps / 100}%
Expires: ${new Date(quote.expiry * 1000).toLocaleString()}
Total Swap Time: ~${quote.total_swap_seconds} seconds`
            }
          ]
        }
      } catch (err) {
        const error = err as Error
        return {
          content: [{ type: "text" as const, text: `Failed to get swap quote: ${error.message}` }]
        }
      }
    }
  )

  // ==================== ALL POOLS ====================

  server.tool(
    "thorchain_get_pools",
    "Get all available THORChain liquidity pools",
    {},
    async () => {
      try {
        const response = await fetch("https://thornode.ninerealms.com/thorchain/pools")
        if (!response.ok) {
          throw new Error(`THORNode API error: ${response.status}`)
        }
        const pools = await response.json()

        const poolList = pools
          .filter((pool: any) => pool.status === "Available")
          .slice(0, 20)
          .map((pool: any) => {
            const assetDepth = Number(pool.balance_asset) / 1e8
            const runeDepth = Number(pool.balance_rune) / 1e8
            return `${pool.asset}: Asset: ${assetDepth.toFixed(4)}, RUNE: ${runeDepth.toFixed(4)}`
          })
          .join("\n")

        return {
          content: [
            {
              type: "text" as const,
              text: `THORChain Available Pools (Top 20):\n${poolList}`
            }
          ]
        }
      } catch (err) {
        const error = err as Error
        return {
          content: [{ type: "text" as const, text: `Failed to retrieve pools: ${error.message}` }]
        }
      }
    }
  )

  // ==================== NETWORK INFO ====================

  server.tool(
    "thorchain_get_network_info",
    "Get THORChain network information including mimir values",
    {},
    async () => {
      try {
        const [networkResponse, mimirResponse] = await Promise.all([
          fetch("https://thornode.ninerealms.com/thorchain/network"),
          fetch("https://thornode.ninerealms.com/thorchain/mimir")
        ])

        if (!networkResponse.ok || !mimirResponse.ok) {
          throw new Error("THORNode API error")
        }

        const network = await networkResponse.json()
        const mimir = await mimirResponse.json()

        return {
          content: [
            {
              type: "text" as const,
              text: `THORChain Network Information:
Bond Reward RUNE: ${(Number(network.bond_reward_rune) / 1e8).toFixed(2)} RUNE
Total Bond: ${(Number(network.total_bond_units) / 1e8).toFixed(2)}
Total Reserve: ${(Number(network.total_reserve) / 1e8).toFixed(2)} RUNE
Vaults Migrating: ${network.vaults_migrating}

Key Mimir Settings:
- Halt Trading: ${mimir.HALTTRADING || 0}
- Halt LP: ${mimir.PAUSELP || 0}
- Max Synth Per Pool: ${mimir.MAXSYNTHPERPOOLDEPTH || "N/A"}`
            }
          ]
        }
      } catch (err) {
        const error = err as Error
        return {
          content: [
            { type: "text" as const, text: `Failed to retrieve network info: ${error.message}` }
          ]
        }
      }
    }
  )

  // ==================== INBOUND ADDRESSES ====================

  server.tool(
    "thorchain_get_inbound_addresses",
    "Get inbound vault addresses for depositing assets to THORChain",
    {
      chain: z.string().optional().describe("Filter by chain (e.g., 'BTC', 'ETH')")
    },
    async ({ chain }) => {
      try {
        const response = await fetch("https://thornode.ninerealms.com/thorchain/inbound_addresses")
        if (!response.ok) {
          throw new Error(`THORNode API error: ${response.status}`)
        }
        let inboundAddresses = await response.json()

        if (chain) {
          inboundAddresses = inboundAddresses.filter(
            (addr: any) => addr.chain.toUpperCase() === chain.toUpperCase()
          )
        }

        const addressList = inboundAddresses
          .map((addr: any) => {
            return `${addr.chain}:
  Address: ${addr.address}
  Halted: ${addr.halted}
  Gas Rate: ${addr.gas_rate}`
          })
          .join("\n\n")

        return {
          content: [
            {
              type: "text" as const,
              text: `THORChain Inbound Addresses:\n\n${addressList}`
            }
          ]
        }
      } catch (err) {
        const error = err as Error
        return {
          content: [
            { type: "text" as const, text: `Failed to retrieve inbound addresses: ${error.message}` }
          ]
        }
      }
    }
  )
}
