import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Address, Hex } from "viem"
import { formatUnits } from "viem"
import { z } from "zod"

import { getPublicClient } from "@/evm/services/clients.js"
import { mcpToolRes } from "@/utils/helper.js"
import { defaultNetworkParam } from "../common/types.js"

// Aave V3 Pool ABI (subset)
const AAVE_POOL_ABI = [
  {
    name: "getUserAccountData",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "totalCollateralBase", type: "uint256" },
      { name: "totalDebtBase", type: "uint256" },
      { name: "availableBorrowsBase", type: "uint256" },
      { name: "currentLiquidationThreshold", type: "uint256" },
      { name: "ltv", type: "uint256" },
      { name: "healthFactor", type: "uint256" }
    ]
  },
  {
    name: "getReserveData",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "asset", type: "address" }],
    outputs: [
      { name: "configuration", type: "tuple" },
      { name: "liquidityIndex", type: "uint128" },
      { name: "currentLiquidityRate", type: "uint128" },
      { name: "variableBorrowIndex", type: "uint128" },
      { name: "currentVariableBorrowRate", type: "uint128" },
      { name: "currentStableBorrowRate", type: "uint128" },
      { name: "lastUpdateTimestamp", type: "uint40" },
      { name: "id", type: "uint16" },
      { name: "aTokenAddress", type: "address" },
      { name: "stableDebtTokenAddress", type: "address" },
      { name: "variableDebtTokenAddress", type: "address" },
      { name: "interestRateStrategyAddress", type: "address" },
      { name: "accruedToTreasury", type: "uint128" },
      { name: "unbacked", type: "uint128" },
      { name: "isolationModeTotalDebt", type: "uint128" }
    ]
  }
] as const

// Compound V3 Comet ABI (subset)
const COMPOUND_COMET_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "borrowBalanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "getSupplyRate",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "utilization", type: "uint64" }],
    outputs: [{ name: "", type: "uint64" }]
  },
  {
    name: "getBorrowRate",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "utilization", type: "uint64" }],
    outputs: [{ name: "", type: "uint64" }]
  },
  {
    name: "getUtilization",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint64" }]
  }
] as const

// Lending protocol addresses
const LENDING_PROTOCOLS: Record<number, Record<string, { pool: Address; type: string }>> = {
  1: { // Ethereum
    "Aave V3": { pool: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2", type: "aave" },
    "Compound V3 USDC": { pool: "0xc3d688B66703497DAA19211EEdff47f25384cdc3", type: "compound" }
  },
  137: { // Polygon
    "Aave V3": { pool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD", type: "aave" }
  },
  42161: { // Arbitrum
    "Aave V3": { pool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD", type: "aave" }
  },
  8453: { // Base
    "Aave V3": { pool: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5", type: "aave" }
  }
}

export function registerLendingTools(server: McpServer) {
  // Get lending position
  server.tool(
    "get_lending_position",
    "Get a user's lending/borrowing position on a protocol",
    {
      network: defaultNetworkParam,
      protocol: z.string().describe("Lending protocol name"),
      userAddress: z.string().describe("User address to check")
    },
    async ({ network, protocol, userAddress }) => {
      try {
        const publicClient = getPublicClient(network)
        const chainId = await publicClient.getChainId()
        
        const protocolConfig = LENDING_PROTOCOLS[chainId]?.[protocol]
        if (!protocolConfig) {
          return mcpToolRes.error(new Error(`Protocol ${protocol} not found on this network`), "getting lending position")
        }

        if (protocolConfig.type === "aave") {
          const data = await publicClient.readContract({
            address: protocolConfig.pool,
            abi: AAVE_POOL_ABI,
            functionName: "getUserAccountData",
            args: [userAddress as Address]
          })

          const [totalCollateral, totalDebt, availableBorrows, liquidationThreshold, ltv, healthFactor] = data

          return mcpToolRes.success({
            network,
            protocol,
            userAddress,
            position: {
              totalCollateralUSD: formatUnits(totalCollateral, 8),
              totalDebtUSD: formatUnits(totalDebt, 8),
              availableBorrowsUSD: formatUnits(availableBorrows, 8),
              liquidationThreshold: (Number(liquidationThreshold) / 100).toFixed(2) + "%",
              ltv: (Number(ltv) / 100).toFixed(2) + "%",
              healthFactor: formatUnits(healthFactor, 18)
            },
            healthStatus: Number(healthFactor) >= 1e18 
              ? healthFactor > 2n * BigInt(1e18) ? "safe" : "moderate"
              : "at risk"
          })
        }

        if (protocolConfig.type === "compound") {
          const [supplyBalance, borrowBalance] = await Promise.all([
            publicClient.readContract({
              address: protocolConfig.pool,
              abi: COMPOUND_COMET_ABI,
              functionName: "balanceOf",
              args: [userAddress as Address]
            }),
            publicClient.readContract({
              address: protocolConfig.pool,
              abi: COMPOUND_COMET_ABI,
              functionName: "borrowBalanceOf",
              args: [userAddress as Address]
            })
          ])

          return mcpToolRes.success({
            network,
            protocol,
            userAddress,
            position: {
              supplyBalance: supplyBalance.toString(),
              supplyFormatted: formatUnits(supplyBalance, 6), // USDC
              borrowBalance: borrowBalance.toString(),
              borrowFormatted: formatUnits(borrowBalance, 6)
            }
          })
        }

        return mcpToolRes.error(new Error("Unknown protocol type"), "getting lending position")
      } catch (error) {
        return mcpToolRes.error(error, "getting lending position")
      }
    }
  )

  // Get market rates
  server.tool(
    "get_lending_rates",
    "Get current supply and borrow rates for a lending market",
    {
      network: defaultNetworkParam,
      protocol: z.string().describe("Lending protocol name"),
      asset: z.string().optional().describe("Asset address (for Aave)")
    },
    async ({ network, protocol, asset }) => {
      try {
        const publicClient = getPublicClient(network)
        const chainId = await publicClient.getChainId()
        
        const protocolConfig = LENDING_PROTOCOLS[chainId]?.[protocol]
        if (!protocolConfig) {
          return mcpToolRes.error(new Error(`Protocol ${protocol} not found`), "getting lending rates")
        }

        if (protocolConfig.type === "aave" && asset) {
          const reserveData = await publicClient.readContract({
            address: protocolConfig.pool,
            abi: AAVE_POOL_ABI,
            functionName: "getReserveData",
            args: [asset as Address]
          })

          // Rates are in RAY (27 decimals), convert to APY percentage
          const liquidityRate = reserveData[2]
          const variableBorrowRate = reserveData[4]
          
          const supplyAPY = (Number(liquidityRate) / 1e27 * 100).toFixed(2)
          const borrowAPY = (Number(variableBorrowRate) / 1e27 * 100).toFixed(2)

          return mcpToolRes.success({
            network,
            protocol,
            asset,
            rates: {
              supplyAPY: supplyAPY + "%",
              variableBorrowAPY: borrowAPY + "%",
              aTokenAddress: reserveData[8]
            }
          })
        }

        if (protocolConfig.type === "compound") {
          const utilization = await publicClient.readContract({
            address: protocolConfig.pool,
            abi: COMPOUND_COMET_ABI,
            functionName: "getUtilization"
          })

          const [supplyRate, borrowRate] = await Promise.all([
            publicClient.readContract({
              address: protocolConfig.pool,
              abi: COMPOUND_COMET_ABI,
              functionName: "getSupplyRate",
              args: [utilization]
            }),
            publicClient.readContract({
              address: protocolConfig.pool,
              abi: COMPOUND_COMET_ABI,
              functionName: "getBorrowRate",
              args: [utilization]
            })
          ])

          // Convert per-second rates to APY
          const secondsPerYear = 31536000n
          const supplyAPY = (Number(supplyRate * secondsPerYear) / 1e18 * 100).toFixed(2)
          const borrowAPY = (Number(borrowRate * secondsPerYear) / 1e18 * 100).toFixed(2)

          return mcpToolRes.success({
            network,
            protocol,
            rates: {
              supplyAPY: supplyAPY + "%",
              borrowAPY: borrowAPY + "%",
              utilization: (Number(utilization) / 1e18 * 100).toFixed(2) + "%"
            }
          })
        }

        return mcpToolRes.error(new Error("Could not fetch rates"), "getting lending rates")
      } catch (error) {
        return mcpToolRes.error(error, "getting lending rates")
      }
    }
  )

  // Get supported lending protocols
  server.tool(
    "get_lending_protocols",
    "Get list of supported lending protocols on a network",
    {
      network: defaultNetworkParam
    },
    async ({ network }) => {
      try {
        const publicClient = getPublicClient(network)
        const chainId = await publicClient.getChainId()
        
        const protocols = LENDING_PROTOCOLS[chainId] || {}

        return mcpToolRes.success({
          network,
          chainId,
          protocols: Object.entries(protocols).map(([name, config]) => ({
            name,
            pool: config.pool,
            type: config.type
          })),
          note: Object.keys(protocols).length === 0 
            ? "No lending protocols configured for this network"
            : "Use get_lending_position or get_lending_rates for details"
        })
      } catch (error) {
        return mcpToolRes.error(error, "getting lending protocols")
      }
    }
  )

  // Calculate health factor
  server.tool(
    "calculate_health_factor",
    "Calculate health factor after a potential action",
    {
      currentCollateral: z.string().describe("Current collateral in USD"),
      currentDebt: z.string().describe("Current debt in USD"),
      liquidationThreshold: z.string().describe("Liquidation threshold (e.g., '0.85')"),
      action: z.enum(["supply", "borrow", "withdraw", "repay"]).describe("Action type"),
      amount: z.string().describe("Action amount in USD")
    },
    async ({ currentCollateral, currentDebt, liquidationThreshold, action, amount }) => {
      try {
        let newCollateral = parseFloat(currentCollateral)
        let newDebt = parseFloat(currentDebt)
        const threshold = parseFloat(liquidationThreshold)
        const actionAmount = parseFloat(amount)

        switch (action) {
          case "supply":
            newCollateral += actionAmount
            break
          case "borrow":
            newDebt += actionAmount
            break
          case "withdraw":
            newCollateral -= actionAmount
            break
          case "repay":
            newDebt -= actionAmount
            break
        }

        const newHealthFactor = newDebt > 0 
          ? (newCollateral * threshold) / newDebt 
          : Infinity

        return mcpToolRes.success({
          before: {
            collateral: currentCollateral,
            debt: currentDebt,
            healthFactor: parseFloat(currentDebt) > 0 
              ? ((parseFloat(currentCollateral) * threshold) / parseFloat(currentDebt)).toFixed(4)
              : "∞"
          },
          action,
          amount,
          after: {
            collateral: newCollateral.toString(),
            debt: newDebt.toString(),
            healthFactor: newHealthFactor === Infinity ? "∞" : newHealthFactor.toFixed(4)
          },
          safe: newHealthFactor > 1.5,
          warning: newHealthFactor > 1 && newHealthFactor <= 1.5 
            ? "Health factor is low - consider adding collateral"
            : newHealthFactor <= 1 
            ? "DANGER: Position would be at liquidation risk"
            : null
        })
      } catch (error) {
        return mcpToolRes.error(error, "calculating health factor")
      }
    }
  )
}
