/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Address, Hex } from "viem"
import {
  generateMnemonic,
  mnemonicToAccount,
  english,
  privateKeyToAccount,
  HDKey
} from "viem/accounts"
import { z } from "zod"

import { getPublicClient, getWalletClient } from "@/evm/services/clients.js"
import * as services from "@/evm/services/index.js"
import { mcpToolRes } from "@/utils/helper"
import { defaultNetworkParam, privateKeyParam } from "../common/types"

export function registerWalletTools(server: McpServer) {
  // Get address from private key
  server.tool(
    "get_address_from_private_key",
    "Get the EVM address derived from a private key",
    {
      privateKey: privateKeyParam
    },
    async ({ privateKey }) => {
      try {
        // Ensure the private key has 0x prefix
        const formattedKey = privateKey.startsWith("0x")
          ? (privateKey as Hex)
          : (`0x${privateKey}` as Hex)

        const address = services.getAddressFromPrivateKey(formattedKey)

        return mcpToolRes.success({
          address
        })
      } catch (error) {
        return mcpToolRes.error(error, "deriving address from private key")
      }
    }
  )

  // Generate new mnemonic
  server.tool(
    "generate_mnemonic",
    "Generate a new BIP-39 mnemonic seed phrase for wallet creation",
    {
      wordCount: z
        .enum(["12", "24"])
        .default("12")
        .describe("Number of words in the mnemonic (12 or 24)")
    },
    async ({ wordCount }) => {
      try {
        const strength = wordCount === "24" ? 256 : 128
        const mnemonic = generateMnemonic(english, strength)
        const account = mnemonicToAccount(mnemonic)

        return mcpToolRes.success({
          mnemonic,
          wordCount: wordCount === "24" ? 24 : 12,
          address: account.address,
          publicKey: account.publicKey,
          warning:
            "IMPORTANT: Store this mnemonic securely. Anyone with access to it can control all derived wallets. Never share it with anyone."
        })
      } catch (error) {
        return mcpToolRes.error(error, "generating mnemonic")
      }
    }
  )

  // Derive addresses from mnemonic (HD wallet)
  server.tool(
    "derive_addresses_from_mnemonic",
    "Derive multiple addresses from a mnemonic using HD wallet derivation paths",
    {
      mnemonic: z.string().describe("BIP-39 mnemonic seed phrase"),
      count: z
        .number()
        .min(1)
        .max(20)
        .default(5)
        .describe("Number of addresses to derive (1-20)"),
      startIndex: z
        .number()
        .min(0)
        .default(0)
        .describe("Starting index for derivation"),
      path: z
        .string()
        .optional()
        .describe(
          "Custom derivation path template (default: m/44'/60'/0'/0/{index})"
        )
    },
    async ({ mnemonic, count, startIndex, path }) => {
      try {
        const addresses: any[] = []
        const basePath = path || "m/44'/60'/0'/0"

        for (let i = startIndex; i < startIndex + count; i++) {
          const derivationPath = `${basePath}/${i}`
          const account = mnemonicToAccount(mnemonic, {
            addressIndex: i
          })

          addresses.push({
            index: i,
            path: derivationPath,
            address: account.address,
            publicKey: account.publicKey
          })
        }

        return mcpToolRes.success({
          derivationBase: basePath,
          addresses,
          note: "Private keys are not returned for security. Use the mnemonic to access these wallets."
        })
      } catch (error) {
        return mcpToolRes.error(error, "deriving addresses from mnemonic")
      }
    }
  )

  // Create new wallet
  server.tool(
    "create_wallet",
    "Create a new random wallet with private key and address",
    {},
    async () => {
      try {
        const mnemonic = generateMnemonic(english)
        const account = mnemonicToAccount(mnemonic)

        return mcpToolRes.success({
          address: account.address,
          mnemonic,
          publicKey: account.publicKey,
          warning:
            "CRITICAL: Save the mnemonic securely. This is the ONLY way to recover this wallet. It will NOT be shown again."
        })
      } catch (error) {
        return mcpToolRes.error(error, "creating wallet")
      }
    }
  )

  // Import wallet from mnemonic
  server.tool(
    "import_wallet_from_mnemonic",
    "Import a wallet from a mnemonic seed phrase",
    {
      mnemonic: z.string().describe("BIP-39 mnemonic seed phrase"),
      addressIndex: z
        .number()
        .min(0)
        .default(0)
        .describe("Address index for HD derivation")
    },
    async ({ mnemonic, addressIndex }) => {
      try {
        const account = mnemonicToAccount(mnemonic, { addressIndex })

        return mcpToolRes.success({
          address: account.address,
          publicKey: account.publicKey,
          derivationPath: `m/44'/60'/0'/0/${addressIndex}`,
          imported: true
        })
      } catch (error) {
        return mcpToolRes.error(error, "importing wallet from mnemonic")
      }
    }
  )

  // Transfer native token
  server.tool(
    "transfer_native_token",
    "Transfer native tokens (BNB, ETH, MATIC, etc.) to an address",
    {
      privateKey: privateKeyParam,
      toAddress: z
        .string()
        .describe(
          "The recipient address or ENS name (e.g., '0x1234...' or 'vitalik.eth')"
        ),
      amount: z
        .string()
        .describe(
          "Amount to send in BNB (or the native token of the network), as a string (e.g., '0.1')"
        ),
      network: defaultNetworkParam
    },
    async ({ privateKey, toAddress, amount, network }) => {
      try {
        const hash = await services.transferETH(
          privateKey,
          toAddress,
          amount,
          network
        )

        return mcpToolRes.success({
          success: true,
          txHash: hash,
          toAddress,
          amount,
          network
        })
      } catch (error) {
        return mcpToolRes.error(error, "transferring native token")
      }
    }
  )

  // Approve ERC20 token spending
  server.tool(
    "approve_token_spending",
    "Approve another address (like a DeFi protocol or exchange) to spend your ERC20 tokens. This is often required before interacting with DeFi protocols.",
    {
      privateKey: privateKeyParam,
      tokenAddress: z
        .string()
        .describe(
          "The contract address of the ERC20 token to approve for spending (e.g., '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' for USDC on Ethereum)"
        ),
      spenderAddress: z
        .string()
        .describe(
          "The contract address being approved to spend your tokens (e.g., a DEX or lending protocol)"
        ),
      amount: z
        .string()
        .describe(
          "The amount of tokens to approve in token units, not wei (e.g., '1000' to approve spending 1000 tokens). Use a very large number for unlimited approval."
        ),
      network: defaultNetworkParam
    },
    async ({ privateKey, tokenAddress, spenderAddress, amount, network }) => {
      try {
        const result = await services.approveERC20(
          tokenAddress,
          spenderAddress,
          amount,
          privateKey,
          network
        )

        return mcpToolRes.success({
          success: true,
          txHash: result.txHash,
          tokenAddress,
          spenderAddress,
          amount: result.amount.formatted,
          symbol: result.token.symbol,
          network
        })
      } catch (error) {
        return mcpToolRes.error(error, "approving token spending")
      }
    }
  )

  // Transfer ERC20 tokens
  server.tool(
    "transfer_erc20",
    "Transfer ERC20 tokens to an address",
    {
      privateKey: privateKeyParam,
      tokenAddress: z
        .string()
        .describe(
          "The contract address or ENS name of the ERC20 token to transfer (e.g., '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' for USDC or 'uniswap.eth')"
        ),
      toAddress: z
        .string()
        .describe(
          "The recipient address or ENS name that will receive the tokens (e.g., '0x1234...' or 'vitalik.eth')"
        ),
      amount: z
        .string()
        .describe(
          "Amount of tokens to send as a string (e.g., '100' for 100 tokens). This will be adjusted for the token's decimals."
        ),
      network: defaultNetworkParam
    },
    async ({ privateKey, tokenAddress, toAddress, amount, network }) => {
      try {
        const result = await services.transferERC20(
          tokenAddress,
          toAddress,
          amount,
          privateKey,
          network
        )

        return mcpToolRes.success({
          success: true,
          txHash: result.txHash,
          tokenAddress,
          toAddress,
          amount: result.amount.formatted,
          symbol: result.token.symbol,
          network
        })
      } catch (error) {
        return mcpToolRes.error(error, "transferring tokens")
      }
    }
  )

  // Get all token approvals for an address
  server.tool(
    "get_token_approvals",
    "Get a list of token spending approvals for an address. Shows which contracts can spend your tokens.",
    {
      address: z.string().describe("The wallet address to check approvals for"),
      tokenAddresses: z
        .array(z.string())
        .optional()
        .describe("Optional list of specific token addresses to check"),
      network: defaultNetworkParam
    },
    async ({ address, tokenAddresses, network }) => {
      try {
        const publicClient = getPublicClient(network)

        // Common DEX/DeFi router addresses to check
        const commonSpenders: Record<string, string> = {
          "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D": "Uniswap V2 Router",
          "0xE592427A0AEce92De3Edee1F18E0157C05861564": "Uniswap V3 Router",
          "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45": "Uniswap V3 Router 2",
          "0x1111111254EEB25477B68fb85Ed929f73A960582": "1inch V5",
          "0x1111111254fb6c44bac0bed2854e76f90643097d": "1inch V4",
          "0xdef1c0ded9bec7f1a1670819833240f027b25eff": "0x Exchange Proxy",
          "0x10ED43C718714eb63d5aA57B78B54704E256024E": "PancakeSwap Router",
          "0x13f4EA83D0bd40E75C8222255bc855a974568Dd4": "PancakeSwap V3 Router"
        }

        // ERC20 allowance function
        const allowanceAbi = [
          {
            name: "allowance",
            type: "function",
            stateMutability: "view",
            inputs: [
              { name: "owner", type: "address" },
              { name: "spender", type: "address" }
            ],
            outputs: [{ name: "", type: "uint256" }]
          },
          {
            name: "symbol",
            type: "function",
            stateMutability: "view",
            inputs: [],
            outputs: [{ name: "", type: "string" }]
          },
          {
            name: "decimals",
            type: "function",
            stateMutability: "view",
            inputs: [],
            outputs: [{ name: "", type: "uint8" }]
          }
        ] as const

        const approvals: any[] = []
        const tokens = tokenAddresses || []

        // For each token, check allowances to common spenders
        for (const tokenAddress of tokens) {
          try {
            const [symbol, decimals] = await Promise.all([
              publicClient.readContract({
                address: tokenAddress as Address,
                abi: allowanceAbi,
                functionName: "symbol"
              }),
              publicClient.readContract({
                address: tokenAddress as Address,
                abi: allowanceAbi,
                functionName: "decimals"
              })
            ])

            for (const [spender, name] of Object.entries(commonSpenders)) {
              try {
                const allowance = await publicClient.readContract({
                  address: tokenAddress as Address,
                  abi: allowanceAbi,
                  functionName: "allowance",
                  args: [address as Address, spender as Address]
                })

                if (allowance > BigInt(0)) {
                  const isUnlimited =
                    allowance >=
                    BigInt(
                      "115792089237316195423570985008687907853269984665640564039457584007913129639935"
                    ) /
                      BigInt(2)

                  approvals.push({
                    token: tokenAddress,
                    symbol,
                    spender,
                    spenderName: name,
                    allowance: allowance.toString(),
                    allowanceFormatted: isUnlimited
                      ? "Unlimited"
                      : (Number(allowance) / 10 ** decimals).toFixed(4),
                    isUnlimited,
                    riskLevel: isUnlimited ? "high" : "medium"
                  })
                }
              } catch (e) {
                // Skip if allowance check fails
              }
            }
          } catch (e) {
            // Skip if token info fails
          }
        }

        return mcpToolRes.success({
          address,
          approvalsFound: approvals.length,
          approvals,
          note: "Provide token addresses to check specific tokens. Unlimited approvals carry higher risk.",
          network
        })
      } catch (error) {
        return mcpToolRes.error(error, "fetching token approvals")
      }
    }
  )

  // Revoke token approval
  server.tool(
    "revoke_token_approval",
    "Revoke a token spending approval by setting allowance to 0",
    {
      privateKey: privateKeyParam,
      tokenAddress: z
        .string()
        .describe("The token contract address to revoke approval for"),
      spenderAddress: z
        .string()
        .describe("The spender address to revoke approval from"),
      network: defaultNetworkParam
    },
    async ({ privateKey, tokenAddress, spenderAddress, network }) => {
      try {
        const result = await services.approveERC20(
          tokenAddress,
          spenderAddress,
          "0", // Set allowance to 0
          privateKey,
          network
        )

        return mcpToolRes.success({
          success: true,
          txHash: result.txHash,
          tokenAddress,
          spenderAddress,
          action: "revoked",
          newAllowance: "0",
          network
        })
      } catch (error) {
        return mcpToolRes.error(error, "revoking token approval")
      }
    }
  )

  // Sign message
  server.tool(
    "sign_message",
    "Sign a message with a private key (personal_sign)",
    {
      privateKey: privateKeyParam,
      message: z.string().describe("The message to sign")
    },
    async ({ privateKey, message }) => {
      try {
        const formattedKey = privateKey.startsWith("0x")
          ? (privateKey as Hex)
          : (`0x${privateKey}` as Hex)

        const account = privateKeyToAccount(formattedKey)
        const signature = await account.signMessage({ message })

        return mcpToolRes.success({
          message,
          signature,
          signer: account.address
        })
      } catch (error) {
        return mcpToolRes.error(error, "signing message")
      }
    }
  )

  // Verify message signature
  server.tool(
    "verify_message",
    "Verify a signed message and recover the signer address",
    {
      message: z.string().describe("The original message"),
      signature: z.string().describe("The signature to verify"),
      expectedAddress: z
        .string()
        .optional()
        .describe("Optional: expected signer address to verify against")
    },
    async ({ message, signature, expectedAddress }) => {
      try {
        const { verifyMessage } = await import("viem")
        const { recoverMessageAddress } = await import("viem")

        const recoveredAddress = await recoverMessageAddress({
          message,
          signature: signature as Hex
        })

        const isValid = expectedAddress
          ? recoveredAddress.toLowerCase() === expectedAddress.toLowerCase()
          : true

        return mcpToolRes.success({
          recoveredAddress,
          isValid,
          message,
          ...(expectedAddress && {
            expectedAddress,
            addressMatch:
              recoveredAddress.toLowerCase() === expectedAddress.toLowerCase()
          })
        })
      } catch (error) {
        return mcpToolRes.error(error, "verifying message")
      }
    }
  )

  // Get wallet portfolio summary
  server.tool(
    "get_wallet_portfolio",
    "Get a comprehensive portfolio summary for a wallet including native balance and common token balances",
    {
      address: z.string().describe("The wallet address to check"),
      network: defaultNetworkParam
    },
    async ({ address, network }) => {
      try {
        const publicClient = getPublicClient(network)

        // Get native balance
        const nativeBalance = await publicClient.getBalance({
          address: address as Address
        })

        // Get transaction count
        const txCount = await publicClient.getTransactionCount({
          address: address as Address
        })

        // Common stablecoins and major tokens to check (varies by network)
        const chainId = await publicClient.getChainId()

        const tokensToCheck: Record<number, Array<{ address: string; symbol: string }>> = {
          1: [
            // Ethereum
            { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", symbol: "USDC" },
            { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", symbol: "USDT" },
            { address: "0x6B175474E89094C44Da98b954EescdeCB5BE3830", symbol: "DAI" },
            { address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", symbol: "WBTC" },
            { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", symbol: "WETH" }
          ],
          56: [
            // BSC
            { address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", symbol: "USDC" },
            { address: "0x55d398326f99059fF775485246999027B3197955", symbol: "USDT" },
            { address: "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3", symbol: "DAI" },
            { address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", symbol: "WBNB" },
            { address: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8", symbol: "ETH" }
          ],
          137: [
            // Polygon
            { address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", symbol: "USDC" },
            { address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", symbol: "USDT" },
            { address: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063", symbol: "DAI" },
            { address: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", symbol: "WMATIC" }
          ]
        }

        const tokens = tokensToCheck[chainId] || []
        const tokenBalances: any[] = []

        const balanceOfAbi = [
          {
            name: "balanceOf",
            type: "function",
            stateMutability: "view",
            inputs: [{ name: "account", type: "address" }],
            outputs: [{ name: "", type: "uint256" }]
          },
          {
            name: "decimals",
            type: "function",
            stateMutability: "view",
            inputs: [],
            outputs: [{ name: "", type: "uint8" }]
          }
        ] as const

        for (const token of tokens) {
          try {
            const [balance, decimals] = await Promise.all([
              publicClient.readContract({
                address: token.address as Address,
                abi: balanceOfAbi,
                functionName: "balanceOf",
                args: [address as Address]
              }),
              publicClient.readContract({
                address: token.address as Address,
                abi: balanceOfAbi,
                functionName: "decimals"
              })
            ])

            if (balance > BigInt(0)) {
              tokenBalances.push({
                symbol: token.symbol,
                address: token.address,
                balance: balance.toString(),
                balanceFormatted: (Number(balance) / 10 ** decimals).toFixed(6),
                decimals
              })
            }
          } catch (e) {
            // Skip if token read fails
          }
        }

        return mcpToolRes.success({
          address,
          network,
          nativeBalance: {
            wei: nativeBalance.toString(),
            ether: (Number(nativeBalance) / 1e18).toFixed(6)
          },
          totalTransactions: txCount,
          tokens: tokenBalances,
          tokensWithBalance: tokenBalances.length
        })
      } catch (error) {
        return mcpToolRes.error(error, "fetching wallet portfolio")
      }
    }
  )
}
