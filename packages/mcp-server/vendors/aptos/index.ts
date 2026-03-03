/**
 * Aptos Blockchain Vendor Module
 * Provides tools for interacting with the Aptos blockchain
 *
 * @author nich
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

const APTOS_API_URL = process.env.APTOS_API_URL || "https://fullnode.mainnet.aptoslabs.com/v1"
const APT_DECIMALS = 8
const OCTAS_PER_APT = 100_000_000

async function aptosApiCall(endpoint: string): Promise<any> {
  const response = await fetch(`${APTOS_API_URL}${endpoint}`)
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Aptos API error: ${response.status} - ${error}`)
  }
  return response.json()
}

export function registerAptos(server: McpServer) {
  // Get APT balance
  server.tool(
    "aptos_get_balance",
    "Get APT token balance for an address",
    {
      address: z.string().describe("The Aptos address (0x...)"),
    },
    async ({ address }) => {
      try {
        const resources = await aptosApiCall(`/accounts/${address}/resources`)
        const coinStore = resources.find(
          (r: any) => r.type === "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>"
        )

        const balance = coinStore?.data?.coin?.value || "0"
        const aptAmount = parseInt(balance) / OCTAS_PER_APT

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  address,
                  balance: aptAmount,
                  balanceRaw: balance,
                  symbol: "APT",
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

  // Get account info
  server.tool(
    "aptos_get_account",
    "Get account information including sequence number",
    {
      address: z.string().describe("The Aptos address"),
    },
    async ({ address }) => {
      try {
        const account = await aptosApiCall(`/accounts/${address}`)

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  address,
                  sequenceNumber: account.sequence_number,
                  authenticationKey: account.authentication_key,
                },
                null,
                2
              ),
            },
          ],
        }
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error fetching account: ${error}` }],
          isError: true,
        }
      }
    }
  )

  // Get account resources
  server.tool(
    "aptos_get_resources",
    "Get all resources owned by an account",
    {
      address: z.string().describe("The Aptos address"),
      limit: z.number().default(100).describe("Max resources to return"),
    },
    async ({ address, limit }) => {
      try {
        const resources = await aptosApiCall(`/accounts/${address}/resources?limit=${limit}`)

        const summary = resources.map((r: any) => ({
          type: r.type,
          data: r.data,
        }))

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  address,
                  resourceCount: summary.length,
                  resources: summary,
                },
                null,
                2
              ),
            },
          ],
        }
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error fetching resources: ${error}` }],
          isError: true,
        }
      }
    }
  )

  // Get account modules (deployed code)
  server.tool(
    "aptos_get_modules",
    "Get Move modules deployed by an account",
    {
      address: z.string().describe("The Aptos address"),
    },
    async ({ address }) => {
      try {
        const modules = await aptosApiCall(`/accounts/${address}/modules`)

        const summary = modules.map((m: any) => ({
          name: m.abi?.name,
          exposedFunctions: m.abi?.exposed_functions?.map((f: any) => f.name),
          structs: m.abi?.structs?.map((s: any) => s.name),
        }))

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  address,
                  moduleCount: summary.length,
                  modules: summary,
                },
                null,
                2
              ),
            },
          ],
        }
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error fetching modules: ${error}` }],
          isError: true,
        }
      }
    }
  )

  // Get transaction by hash
  server.tool(
    "aptos_get_transaction",
    "Get transaction details by hash",
    {
      hash: z.string().describe("The transaction hash"),
    },
    async ({ hash }) => {
      try {
        const tx = await aptosApiCall(`/transactions/by_hash/${hash}`)

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  hash: tx.hash,
                  type: tx.type,
                  version: tx.version,
                  sender: tx.sender,
                  sequenceNumber: tx.sequence_number,
                  gasUsed: tx.gas_used,
                  gasUnitPrice: tx.gas_unit_price,
                  success: tx.success,
                  vmStatus: tx.vm_status,
                  timestamp: tx.timestamp
                    ? new Date(parseInt(tx.timestamp) / 1000).toISOString()
                    : null,
                  payload: tx.payload,
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

  // Get account transactions
  server.tool(
    "aptos_get_account_transactions",
    "Get transactions for an account",
    {
      address: z.string().describe("The Aptos address"),
      limit: z.number().default(25).describe("Max transactions to return"),
    },
    async ({ address, limit }) => {
      try {
        const transactions = await aptosApiCall(
          `/accounts/${address}/transactions?limit=${limit}`
        )

        const summary = transactions.map((tx: any) => ({
          hash: tx.hash,
          type: tx.type,
          success: tx.success,
          timestamp: tx.timestamp
            ? new Date(parseInt(tx.timestamp) / 1000).toISOString()
            : null,
          gasUsed: tx.gas_used,
          payload: tx.payload?.function || tx.payload?.type,
        }))

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  address,
                  transactionCount: summary.length,
                  transactions: summary,
                },
                null,
                2
              ),
            },
          ],
        }
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error fetching transactions: ${error}` }],
          isError: true,
        }
      }
    }
  )

  // Get ledger info
  server.tool(
    "aptos_get_ledger_info",
    "Get current ledger information",
    {},
    async () => {
      try {
        const ledger = await aptosApiCall("/")

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  chainId: ledger.chain_id,
                  epoch: ledger.epoch,
                  ledgerVersion: ledger.ledger_version,
                  oldestLedgerVersion: ledger.oldest_ledger_version,
                  ledgerTimestamp: new Date(parseInt(ledger.ledger_timestamp) / 1000).toISOString(),
                  nodeRole: ledger.node_role,
                  gitHash: ledger.git_hash,
                },
                null,
                2
              ),
            },
          ],
        }
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error fetching ledger info: ${error}` }],
          isError: true,
        }
      }
    }
  )

  // Get gas estimation
  server.tool(
    "aptos_estimate_gas",
    "Estimate gas price for transactions",
    {},
    async () => {
      try {
        const gasEstimate = await aptosApiCall("/estimate_gas_price")

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  gasEstimate: gasEstimate.gas_estimate,
                  deprioritizedGasEstimate: gasEstimate.deprioritized_gas_estimate,
                  prioritizedGasEstimate: gasEstimate.prioritized_gas_estimate,
                },
                null,
                2
              ),
            },
          ],
        }
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error estimating gas: ${error}` }],
          isError: true,
        }
      }
    }
  )

  // Get events by event handle
  server.tool(
    "aptos_get_events",
    "Get events emitted by a module",
    {
      address: z.string().describe("The account address"),
      eventHandle: z.string().describe("The event handle struct (e.g., 0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>)"),
      fieldName: z.string().describe("The field name of the event handle"),
      limit: z.number().default(25).describe("Max events to return"),
    },
    async ({ address, eventHandle, fieldName, limit }) => {
      try {
        const events = await aptosApiCall(
          `/accounts/${address}/events/${eventHandle}/${fieldName}?limit=${limit}`
        )

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  address,
                  eventHandle,
                  fieldName,
                  eventCount: events.length,
                  events,
                },
                null,
                2
              ),
            },
          ],
        }
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error fetching events: ${error}` }],
          isError: true,
        }
      }
    }
  )

  // View function (read-only call)
  server.tool(
    "aptos_view_function",
    "Call a view function (read-only)",
    {
      function: z.string().describe("The function identifier (e.g., 0x1::coin::balance)"),
      typeArguments: z.array(z.string()).default([]).describe("Type arguments"),
      arguments: z.array(z.string()).default([]).describe("Function arguments"),
    },
    async ({ function: func, typeArguments, arguments: args }) => {
      try {
        const response = await fetch(`${APTOS_API_URL}/view`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            function: func,
            type_arguments: typeArguments,
            arguments: args,
          }),
        })

        if (!response.ok) {
          throw new Error(`View function failed: ${response.status}`)
        }

        const result = await response.json()

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  function: func,
                  typeArguments,
                  arguments: args,
                  result,
                },
                null,
                2
              ),
            },
          ],
        }
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error calling view function: ${error}` }],
          isError: true,
        }
      }
    }
  )

  // Get coin info
  server.tool(
    "aptos_get_coin_info",
    "Get information about a coin type",
    {
      coinType: z.string().default("0x1::aptos_coin::AptosCoin").describe("The coin type"),
    },
    async ({ coinType }) => {
      try {
        // Extract address from coin type (e.g., 0x1 from 0x1::aptos_coin::AptosCoin)
        const address = coinType.split("::")[0]
        const resources = await aptosApiCall(`/accounts/${address}/resources`)

        const coinInfo = resources.find(
          (r: any) => r.type === `0x1::coin::CoinInfo<${coinType}>`
        )

        if (!coinInfo) {
          return {
            content: [{ type: "text", text: `Coin info not found for ${coinType}` }],
            isError: true,
          }
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  coinType,
                  name: coinInfo.data.name,
                  symbol: coinInfo.data.symbol,
                  decimals: coinInfo.data.decimals,
                  supply: coinInfo.data.supply?.vec?.[0]?.integer?.vec?.[0]?.value,
                },
                null,
                2
              ),
            },
          ],
        }
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error fetching coin info: ${error}` }],
          isError: true,
        }
      }
    }
  )
}
