/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Address, Hex } from "viem"
import { formatUnits, parseUnits, encodeFunctionData } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { z } from "zod"

import { getPublicClient, getWalletClient } from "@/evm/services/clients.js"
import { mcpToolRes } from "@/utils/helper.js"
import { defaultNetworkParam, privateKeyParam } from "../common/types.js"

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

  // Flash loan info
  server.tool(
    "get_flash_loan_info",
    "Get flash loan information and fees for a protocol",
    {
      network: defaultNetworkParam,
      protocol: z.string().describe("Lending protocol name (e.g., 'Aave V3')"),
      asset: z.string().describe("Asset address to flash loan")
    },
    async ({ network, protocol, asset }) => {
      try {
        const publicClient = getPublicClient(network)
        const chainId = await publicClient.getChainId()
        
        const protocolConfig = LENDING_PROTOCOLS[chainId]?.[protocol]
        if (!protocolConfig) {
          return mcpToolRes.error(new Error(`Protocol ${protocol} not found`), "getting flash loan info")
        }

        // Aave flash loan fee is typically 0.09%
        const flashLoanFee = protocolConfig.type === "aave" ? "0.09%" : "0.05%"

        // Get available liquidity
        let availableLiquidity = "0"
        if (protocolConfig.type === "aave") {
          try {
            const reserveData = await publicClient.readContract({
              address: protocolConfig.pool,
              abi: AAVE_POOL_ABI,
              functionName: "getReserveData",
              args: [asset as Address]
            })
            // aTokenAddress holds the liquidity
            const aTokenAddress = reserveData[8]
            const balance = await publicClient.readContract({
              address: asset as Address,
              abi: [{ name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] }],
              functionName: "balanceOf",
              args: [aTokenAddress]
            }) as bigint
            availableLiquidity = formatUnits(balance, 18)
          } catch {}
        }

        return mcpToolRes.success({
          network,
          protocol,
          asset,
          flashLoanFee,
          availableLiquidity,
          requirements: [
            "Must repay loan + fee in same transaction",
            "Must implement IFlashLoanReceiver interface",
            "Sufficient liquidity must be available"
          ],
          note: "Flash loans require a smart contract to receive and repay in the same tx"
        })
      } catch (error) {
        return mcpToolRes.error(error, "getting flash loan info")
      }
    }
  )

  // Get liquidatable positions
  server.tool(
    "get_liquidatable_positions",
    "Find positions that can be liquidated (health factor < 1)",
    {
      network: defaultNetworkParam,
      protocol: z.string().describe("Lending protocol name"),
      addresses: z.array(z.string()).describe("Array of addresses to check")
    },
    async ({ network, protocol, addresses }) => {
      try {
        const publicClient = getPublicClient(network)
        const chainId = await publicClient.getChainId()
        
        const protocolConfig = LENDING_PROTOCOLS[chainId]?.[protocol]
        if (!protocolConfig || protocolConfig.type !== "aave") {
          return mcpToolRes.error(new Error("Only Aave V3 supported for liquidation checks"), "getting liquidatable positions")
        }

        const liquidatable: Array<{
          address: string
          healthFactor: string
          totalDebt: string
          totalCollateral: string
        }> = []

        for (const addr of addresses) {
          try {
            const data = await publicClient.readContract({
              address: protocolConfig.pool,
              abi: AAVE_POOL_ABI,
              functionName: "getUserAccountData",
              args: [addr as Address]
            })

            const [totalCollateral, totalDebt, , , , healthFactor] = data
            const hf = Number(healthFactor) / 1e18

            if (hf < 1 && totalDebt > 0n) {
              liquidatable.push({
                address: addr,
                healthFactor: hf.toFixed(4),
                totalDebt: formatUnits(totalDebt, 8),
                totalCollateral: formatUnits(totalCollateral, 8)
              })
            }
          } catch {}
        }

        return mcpToolRes.success({
          network,
          protocol,
          addressesChecked: addresses.length,
          liquidatableCount: liquidatable.length,
          liquidatablePositions: liquidatable.sort((a, b) => parseFloat(a.healthFactor) - parseFloat(b.healthFactor))
        })
      } catch (error) {
        return mcpToolRes.error(error, "getting liquidatable positions")
      }
    }
  )

  // Supply to lending protocol
  server.tool(
    "supply_to_lending",
    "Supply/deposit assets to a lending protocol to earn interest",
    {
      network: defaultNetworkParam,
      protocol: z.string().describe("Lending protocol (e.g., 'Aave V3')"),
      asset: z.string().describe("Asset address to supply"),
      amount: z.string().describe("Amount to supply (in wei)"),
      privateKey: privateKeyParam
    },
    async ({ network, protocol, asset, amount, privateKey }) => {
      try {
        const publicClient = getPublicClient(network)
        const walletClient = getWalletClient(privateKey as Hex, network)
        const account = privateKeyToAccount(privateKey as Hex)
        const chainId = await publicClient.getChainId()
        
        const protocolConfig = LENDING_PROTOCOLS[chainId]?.[protocol]
        if (!protocolConfig || protocolConfig.type !== "aave") {
          return mcpToolRes.error(new Error("Only Aave V3 supported"), "supplying to lending")
        }

        // Approve first
        const approveHash = await walletClient.writeContract({
          address: asset as Address,
          abi: [{ name: "approve", type: "function", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] }],
          functionName: "approve",
          args: [protocolConfig.pool, BigInt(amount)],
          account
        })
        await publicClient.waitForTransactionReceipt({ hash: approveHash })

        // Supply
        const supplyAbi = [{
          name: "supply",
          type: "function",
          inputs: [
            { name: "asset", type: "address" },
            { name: "amount", type: "uint256" },
            { name: "onBehalfOf", type: "address" },
            { name: "referralCode", type: "uint16" }
          ],
          outputs: []
        }]

        const hash = await walletClient.writeContract({
          address: protocolConfig.pool,
          abi: supplyAbi,
          functionName: "supply",
          args: [asset as Address, BigInt(amount), account.address, 0],
          account
        })

        const receipt = await publicClient.waitForTransactionReceipt({ hash })

        return mcpToolRes.success({
          network,
          protocol,
          asset,
          amount,
          transactionHash: hash,
          status: receipt.status === "success" ? "success" : "failed"
        })
      } catch (error) {
        return mcpToolRes.error(error, "supplying to lending")
      }
    }
  )

  // Borrow from lending protocol
  server.tool(
    "borrow_from_lending",
    "Borrow assets from a lending protocol",
    {
      network: defaultNetworkParam,
      protocol: z.string().describe("Lending protocol (e.g., 'Aave V3')"),
      asset: z.string().describe("Asset address to borrow"),
      amount: z.string().describe("Amount to borrow (in wei)"),
      interestRateMode: z.enum(["stable", "variable"]).default("variable").describe("Interest rate mode"),
      privateKey: privateKeyParam
    },
    async ({ network, protocol, asset, amount, interestRateMode, privateKey }) => {
      try {
        const publicClient = getPublicClient(network)
        const walletClient = getWalletClient(privateKey as Hex, network)
        const account = privateKeyToAccount(privateKey as Hex)
        const chainId = await publicClient.getChainId()
        
        const protocolConfig = LENDING_PROTOCOLS[chainId]?.[protocol]
        if (!protocolConfig || protocolConfig.type !== "aave") {
          return mcpToolRes.error(new Error("Only Aave V3 supported"), "borrowing from lending")
        }

        // Check health factor first
        const userData = await publicClient.readContract({
          address: protocolConfig.pool,
          abi: AAVE_POOL_ABI,
          functionName: "getUserAccountData",
          args: [account.address]
        })
        const healthFactor = Number(userData[5]) / 1e18

        if (healthFactor < 1.1) {
          return mcpToolRes.error(new Error("Health factor too low to borrow safely"), "borrowing from lending")
        }

        const borrowAbi = [{
          name: "borrow",
          type: "function",
          inputs: [
            { name: "asset", type: "address" },
            { name: "amount", type: "uint256" },
            { name: "interestRateMode", type: "uint256" },
            { name: "referralCode", type: "uint16" },
            { name: "onBehalfOf", type: "address" }
          ],
          outputs: []
        }]

        const hash = await walletClient.writeContract({
          address: protocolConfig.pool,
          abi: borrowAbi,
          functionName: "borrow",
          args: [asset as Address, BigInt(amount), interestRateMode === "stable" ? 1n : 2n, 0, account.address],
          account
        })

        const receipt = await publicClient.waitForTransactionReceipt({ hash })

        return mcpToolRes.success({
          network,
          protocol,
          asset,
          amount,
          interestRateMode,
          transactionHash: hash,
          status: receipt.status === "success" ? "success" : "failed"
        })
      } catch (error) {
        return mcpToolRes.error(error, "borrowing from lending")
      }
    }
  )

  // Repay to lending protocol
  server.tool(
    "repay_to_lending",
    "Repay borrowed assets to a lending protocol",
    {
      network: defaultNetworkParam,
      protocol: z.string().describe("Lending protocol (e.g., 'Aave V3')"),
      asset: z.string().describe("Asset address to repay"),
      amount: z.string().describe("Amount to repay (in wei, use 'max' for full repay)"),
      interestRateMode: z.enum(["stable", "variable"]).default("variable").describe("Interest rate mode of the debt"),
      privateKey: privateKeyParam
    },
    async ({ network, protocol, asset, amount, interestRateMode, privateKey }) => {
      try {
        const publicClient = getPublicClient(network)
        const walletClient = getWalletClient(privateKey as Hex, network)
        const account = privateKeyToAccount(privateKey as Hex)
        const chainId = await publicClient.getChainId()
        
        const protocolConfig = LENDING_PROTOCOLS[chainId]?.[protocol]
        if (!protocolConfig || protocolConfig.type !== "aave") {
          return mcpToolRes.error(new Error("Only Aave V3 supported"), "repaying to lending")
        }

        const repayAmount = amount.toLowerCase() === "max" 
          ? BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")
          : BigInt(amount)

        // Approve first
        const approveHash = await walletClient.writeContract({
          address: asset as Address,
          abi: [{ name: "approve", type: "function", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] }],
          functionName: "approve",
          args: [protocolConfig.pool, repayAmount],
          account
        })
        await publicClient.waitForTransactionReceipt({ hash: approveHash })

        const repayAbi = [{
          name: "repay",
          type: "function",
          inputs: [
            { name: "asset", type: "address" },
            { name: "amount", type: "uint256" },
            { name: "interestRateMode", type: "uint256" },
            { name: "onBehalfOf", type: "address" }
          ],
          outputs: [{ type: "uint256" }]
        }]

        const hash = await walletClient.writeContract({
          address: protocolConfig.pool,
          abi: repayAbi,
          functionName: "repay",
          args: [asset as Address, repayAmount, interestRateMode === "stable" ? 1n : 2n, account.address],
          account
        })

        const receipt = await publicClient.waitForTransactionReceipt({ hash })

        return mcpToolRes.success({
          network,
          protocol,
          asset,
          amount,
          interestRateMode,
          transactionHash: hash,
          status: receipt.status === "success" ? "success" : "failed"
        })
      } catch (error) {
        return mcpToolRes.error(error, "repaying to lending")
      }
    }
  )

  // Withdraw from lending protocol
  server.tool(
    "withdraw_from_lending",
    "Withdraw supplied assets from a lending protocol",
    {
      network: defaultNetworkParam,
      protocol: z.string().describe("Lending protocol (e.g., 'Aave V3')"),
      asset: z.string().describe("Asset address to withdraw"),
      amount: z.string().describe("Amount to withdraw (in wei, use 'max' for full withdraw)"),
      privateKey: privateKeyParam
    },
    async ({ network, protocol, asset, amount, privateKey }) => {
      try {
        const publicClient = getPublicClient(network)
        const walletClient = getWalletClient(privateKey as Hex, network)
        const account = privateKeyToAccount(privateKey as Hex)
        const chainId = await publicClient.getChainId()
        
        const protocolConfig = LENDING_PROTOCOLS[chainId]?.[protocol]
        if (!protocolConfig || protocolConfig.type !== "aave") {
          return mcpToolRes.error(new Error("Only Aave V3 supported"), "withdrawing from lending")
        }

        const withdrawAmount = amount.toLowerCase() === "max" 
          ? BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")
          : BigInt(amount)

        const withdrawAbi = [{
          name: "withdraw",
          type: "function",
          inputs: [
            { name: "asset", type: "address" },
            { name: "amount", type: "uint256" },
            { name: "to", type: "address" }
          ],
          outputs: [{ type: "uint256" }]
        }]

        const hash = await walletClient.writeContract({
          address: protocolConfig.pool,
          abi: withdrawAbi,
          functionName: "withdraw",
          args: [asset as Address, withdrawAmount, account.address],
          account
        })

        const receipt = await publicClient.waitForTransactionReceipt({ hash })

        return mcpToolRes.success({
          network,
          protocol,
          asset,
          amount,
          transactionHash: hash,
          status: receipt.status === "success" ? "success" : "failed"
        })
      } catch (error) {
        return mcpToolRes.error(error, "withdrawing from lending")
      }
    }
  )
}
