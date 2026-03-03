/**
 * Sui Blockchain Vendor Module
 * Provides tools for interacting with the Sui blockchain
 *
 * @author nich
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

const SUI_RPC_URL = process.env.SUI_RPC_URL || "https://fullnode.mainnet.sui.io"
const SUI_DECIMALS = 9
const MIST_PER_SUI = 1_000_000_000

interface SuiRpcResponse<T> {
  jsonrpc: string
  id: number
  result?: T
  error?: { code: number; message: string }
}

async function suiRpcCall<T>(method: string, params: any[]): Promise<T> {
  const response = await fetch(SUI_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
  })

  const data: SuiRpcResponse<T> = await response.json()
  if (data.error) {
    throw new Error(`Sui RPC error: ${data.error.message}`)
  }
  return data.result as T
}

export function registerSui(server: McpServer) {
  // Get SUI balance
  server.tool(
    "sui_get_balance",
    "Get SUI token balance for an address",
    {
      address: z.string().describe("The Sui address (0x...)"),
    },
    async ({ address }) => {
      try {
        const balance = await suiRpcCall<{
          totalBalance: string
          coinObjectCount: number
        }>("suix_getBalance", [address, "0x2::sui::SUI"])

        const suiAmount = parseInt(balance.totalBalance) / MIST_PER_SUI

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  address,
                  balance: suiAmount,
                  balanceRaw: balance.totalBalance,
                  coinObjectCount: balance.coinObjectCount,
                  symbol: "SUI",
                },
                null,
                2
              ),
            },
          ],
        }
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error fetching balance: ${error}` }],
          isError: true,
        }
      }
    }
  )

  // Get all coin balances
  server.tool(
    "sui_get_all_balances",
    "Get all token balances for an address",
    {
      address: z.string().describe("The Sui address"),
    },
    async ({ address }) => {
      try {
        const balances = await suiRpcCall<
          Array<{
            coinType: string
            totalBalance: string
            coinObjectCount: number
          }>
        >("suix_getAllBalances", [address])

        const formattedBalances = balances.map((b) => {
          const coinName = b.coinType.split("::").pop() || b.coinType
          return {
            coinType: b.coinType,
            name: coinName,
            balance: parseInt(b.totalBalance) / MIST_PER_SUI,
            balanceRaw: b.totalBalance,
            coinObjectCount: b.coinObjectCount,
          }
        })

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  address,
                  tokenCount: formattedBalances.length,
                  balances: formattedBalances,
                },
                null,
                2
              ),
            },
          ],
        }
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error fetching balances: ${error}` }],
          isError: true,
        }
      }
    }
  )

  // Get owned objects
  server.tool(
    "sui_get_owned_objects",
    "Get objects owned by an address (NFTs, coins, etc.)",
    {
      address: z.string().describe("The Sui address"),
      limit: z.number().default(50).describe("Max objects to return"),
    },
    async ({ address, limit }) => {
      try {
        const objects = await suiRpcCall<{
          data: Array<{
            data: {
              objectId: string
              type: string
              version: string
            }
          }>
          hasNextPage: boolean
        }>("suix_getOwnedObjects", [
          address,
          {
            options: {
              showType: true,
              showContent: true,
            },
          },
          null,
          limit,
        ])

        const formattedObjects = objects.data.map((o) => ({
          objectId: o.data.objectId,
          type: o.data.type,
          version: o.data.version,
        }))

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  address,
                  objectCount: formattedObjects.length,
                  hasMore: objects.hasNextPage,
                  objects: formattedObjects,
                },
                null,
                2
              ),
            },
          ],
        }
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error fetching objects: ${error}` }],
          isError: true,
        }
      }
    }
  )

  // Get object details
  server.tool(
    "sui_get_object",
    "Get details of a specific object",
    {
      objectId: z.string().describe("The object ID"),
    },
    async ({ objectId }) => {
      try {
        const object = await suiRpcCall<{
          data: {
            objectId: string
            type: string
            version: string
            content: any
            owner: any
          }
        }>("sui_getObject", [
          objectId,
          {
            showType: true,
            showContent: true,
            showOwner: true,
            showPreviousTransaction: true,
          },
        ])

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  objectId: object.data.objectId,
                  type: object.data.type,
                  version: object.data.version,
                  owner: object.data.owner,
                  content: object.data.content,
                },
                null,
                2
              ),
            },
          ],
        }
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error fetching object: ${error}` }],
          isError: true,
        }
      }
    }
  )

  // Get transaction details
  server.tool(
    "sui_get_transaction",
    "Get transaction details by digest",
    {
      digest: z.string().describe("The transaction digest"),
    },
    async ({ digest }) => {
      try {
        const tx = await suiRpcCall<{
          digest: string
          transaction: any
          effects: any
          timestampMs: string
          checkpoint: string
        }>("sui_getTransactionBlock", [
          digest,
          {
            showInput: true,
            showEffects: true,
            showEvents: true,
            showObjectChanges: true,
            showBalanceChanges: true,
          },
        ])

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  digest: tx.digest,
                  timestamp: tx.timestampMs ? new Date(parseInt(tx.timestampMs)).toISOString() : null,
                  checkpoint: tx.checkpoint,
                  status: tx.effects?.status,
                  gasUsed: tx.effects?.gasUsed,
                  transaction: tx.transaction,
                },
                null,
                2
              ),
            },
          ],
        }
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error fetching transaction: ${error}` }],
          isError: true,
        }
      }
    }
  )

  // Get latest checkpoint
  server.tool(
    "sui_get_latest_checkpoint",
    "Get the latest checkpoint information",
    {},
    async () => {
      try {
        const checkpoint = await suiRpcCall<{
          sequenceNumber: string
          digest: string
          timestampMs: string
          epoch: string
          networkTotalTransactions: string
        }>("sui_getLatestCheckpointSequenceNumber", [])

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  checkpointNumber: checkpoint,
                },
                null,
                2
              ),
            },
          ],
        }
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error fetching checkpoint: ${error}` }],
          isError: true,
        }
      }
    }
  )

  // Get gas price
  server.tool(
    "sui_get_gas_price",
    "Get the current reference gas price",
    {},
    async () => {
      try {
        const gasPrice = await suiRpcCall<string>("suix_getReferenceGasPrice", [])

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  referenceGasPrice: gasPrice,
                  gasPriceMist: parseInt(gasPrice),
                  gasPriceSui: parseInt(gasPrice) / MIST_PER_SUI,
                },
                null,
                2
              ),
            },
          ],
        }
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error fetching gas price: ${error}` }],
          isError: true,
        }
      }
    }
  )

  // Get coin metadata
  server.tool(
    "sui_get_coin_metadata",
    "Get metadata for a coin type",
    {
      coinType: z.string().default("0x2::sui::SUI").describe("The coin type"),
    },
    async ({ coinType }) => {
      try {
        const metadata = await suiRpcCall<{
          decimals: number
          description: string
          iconUrl: string
          name: string
          symbol: string
        }>("suix_getCoinMetadata", [coinType])

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  coinType,
                  ...metadata,
                },
                null,
                2
              ),
            },
          ],
        }
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error fetching coin metadata: ${error}` }],
          isError: true,
        }
      }
    }
  )

  // Get total supply
  server.tool(
    "sui_get_total_supply",
    "Get total supply of a coin type",
    {
      coinType: z.string().default("0x2::sui::SUI").describe("The coin type"),
    },
    async ({ coinType }) => {
      try {
        const supply = await suiRpcCall<{ value: string }>("suix_getTotalSupply", [coinType])

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  coinType,
                  totalSupply: supply.value,
                  totalSupplyFormatted: parseInt(supply.value) / MIST_PER_SUI,
                },
                null,
                2
              ),
            },
          ],
        }
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error fetching total supply: ${error}` }],
          isError: true,
        }
      }
    }
  )

  // Get validators
  server.tool(
    "sui_get_validators",
    "Get information about active validators",
    {},
    async () => {
      try {
        const validators = await suiRpcCall<{
          activeValidators: Array<{
            name: string
            suiAddress: string
            stakingPoolSuiBalance: string
            commissionRate: string
            votingPower: string
          }>
        }>("suix_getLatestSuiSystemState", [])

        const formattedValidators = validators.activeValidators?.map((v) => ({
          name: v.name,
          address: v.suiAddress,
          stakedSui: parseInt(v.stakingPoolSuiBalance) / MIST_PER_SUI,
          commissionRate: parseInt(v.commissionRate) / 100,
          votingPower: v.votingPower,
        }))

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  validatorCount: formattedValidators?.length || 0,
                  validators: formattedValidators?.slice(0, 20), // Top 20
                },
                null,
                2
              ),
            },
          ],
        }
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error fetching validators: ${error}` }],
          isError: true,
        }
      }
    }
  )
}
