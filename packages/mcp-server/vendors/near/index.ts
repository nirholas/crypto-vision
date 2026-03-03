/**
 * Near Protocol Vendor Module
 * Provides tools for interacting with the Near blockchain
 *
 * @author nich
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

const NEAR_RPC_URL = process.env.NEAR_RPC_URL || "https://rpc.mainnet.near.org"
const NEAR_DECIMALS = 24
const YOCTO_PER_NEAR = BigInt("1000000000000000000000000")

interface NearRpcResponse<T> {
  jsonrpc: string
  id: string
  result?: T
  error?: { code: number; message: string; data?: any }
}

async function nearRpcCall<T>(method: string, params: any): Promise<T> {
  const response = await fetch(NEAR_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "dontcare",
      method,
      params,
    }),
  })

  const data: NearRpcResponse<T> = await response.json()
  if (data.error) {
    throw new Error(`Near RPC error: ${data.error.message}`)
  }
  return data.result as T
}

function yoctoToNear(yocto: string): number {
  return Number(BigInt(yocto) * BigInt(1000000) / YOCTO_PER_NEAR) / 1000000
}

export function registerNear(server: McpServer) {
  // Get NEAR balance
  server.tool(
    "near_get_balance",
    "Get NEAR token balance for an account",
    {
      accountId: z.string().describe("The Near account ID (e.g., example.near)"),
    },
    async ({ accountId }) => {
      try {
        const result = await nearRpcCall<{
          amount: string
          locked: string
          code_hash: string
          storage_usage: number
          storage_paid_at: number
          block_height: number
          block_hash: string
        }>("query", {
          request_type: "view_account",
          finality: "final",
          account_id: accountId,
        })

        const balance = yoctoToNear(result.amount)
        const locked = yoctoToNear(result.locked)

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  accountId,
                  balance,
                  balanceRaw: result.amount,
                  locked,
                  lockedRaw: result.locked,
                  storageUsage: result.storage_usage,
                  codeHash: result.code_hash,
                  symbol: "NEAR",
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

  // Get account state
  server.tool(
    "near_get_account",
    "Get detailed account information",
    {
      accountId: z.string().describe("The Near account ID"),
    },
    async ({ accountId }) => {
      try {
        const result = await nearRpcCall<{
          amount: string
          locked: string
          code_hash: string
          storage_usage: number
          storage_paid_at: number
          block_height: number
          block_hash: string
        }>("query", {
          request_type: "view_account",
          finality: "final",
          account_id: accountId,
        })

        const hasContract = result.code_hash !== "11111111111111111111111111111111"

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  accountId,
                  balance: yoctoToNear(result.amount),
                  locked: yoctoToNear(result.locked),
                  storageUsageBytes: result.storage_usage,
                  hasContract,
                  codeHash: result.code_hash,
                  blockHeight: result.block_height,
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

  // Get access keys
  server.tool(
    "near_get_access_keys",
    "Get all access keys for an account",
    {
      accountId: z.string().describe("The Near account ID"),
    },
    async ({ accountId }) => {
      try {
        const result = await nearRpcCall<{
          keys: Array<{
            public_key: string
            access_key: {
              nonce: number
              permission: string | { FunctionCall: any }
            }
          }>
        }>("query", {
          request_type: "view_access_key_list",
          finality: "final",
          account_id: accountId,
        })

        const keys = result.keys.map((k) => ({
          publicKey: k.public_key,
          nonce: k.access_key.nonce,
          permission:
            typeof k.access_key.permission === "string"
              ? k.access_key.permission
              : "FunctionCall",
          functionCallDetails:
            typeof k.access_key.permission === "object"
              ? k.access_key.permission.FunctionCall
              : null,
        }))

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  accountId,
                  keyCount: keys.length,
                  keys,
                },
                null,
                2
              ),
            },
          ],
        }
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error fetching access keys: ${error}` }],
          isError: true,
        }
      }
    }
  )

  // Get transaction status
  server.tool(
    "near_get_transaction",
    "Get transaction details by hash",
    {
      txHash: z.string().describe("The transaction hash"),
      senderAccountId: z.string().describe("The sender account ID"),
    },
    async ({ txHash, senderAccountId }) => {
      try {
        const result = await nearRpcCall<{
          status: any
          transaction: any
          transaction_outcome: any
          receipts_outcome: any[]
        }>("tx", [txHash, senderAccountId])

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  txHash,
                  sender: senderAccountId,
                  status: result.status,
                  receiver: result.transaction?.receiver_id,
                  actions: result.transaction?.actions,
                  gasUsed: result.transaction_outcome?.outcome?.gas_burnt,
                  tokensBurnt: result.transaction_outcome?.outcome?.tokens_burnt,
                  logs: result.transaction_outcome?.outcome?.logs,
                  receiptsOutcome: result.receipts_outcome?.length,
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

  // Get block
  server.tool(
    "near_get_block",
    "Get block information",
    {
      blockId: z
        .union([z.string(), z.number()])
        .optional()
        .describe("Block hash or height (omit for latest)"),
    },
    async ({ blockId }) => {
      try {
        const params = blockId
          ? typeof blockId === "number"
            ? { block_id: blockId }
            : { block_id: blockId }
          : { finality: "final" }

        const result = await nearRpcCall<{
          author: string
          header: {
            height: number
            hash: string
            timestamp: number
            gas_price: string
            total_supply: string
            chunks_included: number
          }
          chunks: any[]
        }>("block", params)

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  height: result.header.height,
                  hash: result.header.hash,
                  author: result.author,
                  timestamp: new Date(result.header.timestamp / 1000000).toISOString(),
                  gasPrice: result.header.gas_price,
                  totalSupply: yoctoToNear(result.header.total_supply),
                  chunksIncluded: result.header.chunks_included,
                  chunkCount: result.chunks?.length,
                },
                null,
                2
              ),
            },
          ],
        }
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error fetching block: ${error}` }],
          isError: true,
        }
      }
    }
  )

  // Call view function
  server.tool(
    "near_view_function",
    "Call a view method on a contract (read-only)",
    {
      contractId: z.string().describe("The contract account ID"),
      methodName: z.string().describe("The method name to call"),
      args: z.record(z.any()).default({}).describe("Arguments as JSON object"),
    },
    async ({ contractId, methodName, args }) => {
      try {
        const argsBase64 = Buffer.from(JSON.stringify(args)).toString("base64")

        const result = await nearRpcCall<{
          result: number[]
          logs: string[]
        }>("query", {
          request_type: "call_function",
          finality: "final",
          account_id: contractId,
          method_name: methodName,
          args_base64: argsBase64,
        })

        let parsedResult
        try {
          const resultStr = Buffer.from(result.result).toString()
          parsedResult = JSON.parse(resultStr)
        } catch {
          parsedResult = Buffer.from(result.result).toString()
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  contractId,
                  methodName,
                  args,
                  result: parsedResult,
                  logs: result.logs,
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

  // Get contract state
  server.tool(
    "near_get_contract_state",
    "Get all state keys/values for a contract",
    {
      contractId: z.string().describe("The contract account ID"),
      prefix: z.string().default("").describe("Key prefix to filter"),
    },
    async ({ contractId, prefix }) => {
      try {
        const prefixBase64 = Buffer.from(prefix).toString("base64")

        const result = await nearRpcCall<{
          values: Array<{ key: string; value: string }>
        }>("query", {
          request_type: "view_state",
          finality: "final",
          account_id: contractId,
          prefix_base64: prefixBase64,
        })

        const state = result.values.map((v) => ({
          key: Buffer.from(v.key, "base64").toString(),
          value: Buffer.from(v.value, "base64").toString(),
        }))

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  contractId,
                  stateCount: state.length,
                  state: state.slice(0, 50), // Limit display
                },
                null,
                2
              ),
            },
          ],
        }
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error fetching contract state: ${error}` }],
          isError: true,
        }
      }
    }
  )

  // Get validators
  server.tool(
    "near_get_validators",
    "Get information about current validators",
    {},
    async () => {
      try {
        const result = await nearRpcCall<{
          current_validators: Array<{
            account_id: string
            stake: string
            num_produced_blocks: number
            num_expected_blocks: number
          }>
          current_fishermen: any[]
          next_validators: any[]
          epoch_start_height: number
        }>("validators", [null])

        const validators = result.current_validators.map((v) => ({
          accountId: v.account_id,
          stake: yoctoToNear(v.stake),
          blocksProduced: v.num_produced_blocks,
          blocksExpected: v.num_expected_blocks,
          uptime:
            v.num_expected_blocks > 0
              ? ((v.num_produced_blocks / v.num_expected_blocks) * 100).toFixed(2)
              : "N/A",
        }))

        const totalStake = validators.reduce((sum, v) => sum + v.stake, 0)

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  validatorCount: validators.length,
                  totalStake,
                  epochStartHeight: result.epoch_start_height,
                  validators: validators.slice(0, 20), // Top 20
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

  // Get gas price
  server.tool(
    "near_get_gas_price",
    "Get current gas price",
    {
      blockId: z.string().optional().describe("Block hash (omit for latest)"),
    },
    async ({ blockId }) => {
      try {
        const result = await nearRpcCall<{
          gas_price: string
        }>("gas_price", [blockId || null])

        const gasPriceYocto = BigInt(result.gas_price)
        const gasPriceNear = Number(gasPriceYocto) / Number(YOCTO_PER_NEAR)

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  gasPriceYocto: result.gas_price,
                  gasPriceNear,
                  estimatedTxCost: gasPriceNear * 300_000_000_000_000, // ~300 TGas typical
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

  // Get network status
  server.tool(
    "near_get_network_info",
    "Get network status and connected peers",
    {},
    async () => {
      try {
        const result = await nearRpcCall<{
          active_peers: Array<{ id: string; addr: string }>
          num_active_peers: number
          sent_bytes_per_sec: number
          received_bytes_per_sec: number
        }>("network_info", {})

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  activePeers: result.num_active_peers,
                  sentBytesPerSec: result.sent_bytes_per_sec,
                  receivedBytesPerSec: result.received_bytes_per_sec,
                  peers: result.active_peers?.slice(0, 10),
                },
                null,
                2
              ),
            },
          ],
        }
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error fetching network info: ${error}` }],
          isError: true,
        }
      }
    }
  )
}
