/**
 * Cosmos/IBC Vendor Module
 * Provides tools for interacting with Cosmos SDK chains (ATOM, OSMO, etc.)
 *
 * @author nich
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

const COSMOS_RPC_ENDPOINTS: Record<string, string> = {
  cosmoshub: "https://cosmos-rest.publicnode.com",
  osmosis: "https://osmosis-rest.publicnode.com",
  juno: "https://juno-api.polkachu.com",
  stargaze: "https://stargaze-api.polkachu.com",
  akash: "https://akash-api.polkachu.com",
  injective: "https://injective-api.polkachu.com",
}

const CHAIN_DENOMS: Record<string, { denom: string; decimals: number; symbol: string }> = {
  cosmoshub: { denom: "uatom", decimals: 6, symbol: "ATOM" },
  osmosis: { denom: "uosmo", decimals: 6, symbol: "OSMO" },
  juno: { denom: "ujuno", decimals: 6, symbol: "JUNO" },
  stargaze: { denom: "ustars", decimals: 6, symbol: "STARS" },
  akash: { denom: "uakt", decimals: 6, symbol: "AKT" },
  injective: { denom: "inj", decimals: 18, symbol: "INJ" },
}

async function fetchCosmosAPI(chain: string, endpoint: string): Promise<any> {
  const baseUrl = COSMOS_RPC_ENDPOINTS[chain] || COSMOS_RPC_ENDPOINTS.cosmoshub
  const response = await fetch(`${baseUrl}${endpoint}`)
  if (!response.ok) {
    throw new Error(`Cosmos API error: ${response.status} ${response.statusText}`)
  }
  return response.json()
}

export function registerCosmos(server: McpServer) {
  // Get account balance
  server.tool(
    "cosmos_get_balance",
    "Get the balance of a Cosmos SDK chain address",
    {
      address: z.string().describe("The Cosmos address (cosmos1...)"),
      chain: z.string().default("cosmoshub").describe("Chain ID (cosmoshub, osmosis, juno, etc.)"),
    },
    async ({ address, chain }) => {
      try {
        const data = await fetchCosmosAPI(chain, `/cosmos/bank/v1beta1/balances/${address}`)
        const chainInfo = CHAIN_DENOMS[chain] || CHAIN_DENOMS.cosmoshub

        const nativeBalance = data.balances?.find((b: any) => b.denom === chainInfo.denom)
        const amount = nativeBalance ? parseInt(nativeBalance.amount) / Math.pow(10, chainInfo.decimals) : 0

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  address,
                  chain,
                  balance: amount,
                  symbol: chainInfo.symbol,
                  allBalances: data.balances,
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
    "cosmos_get_account",
    "Get account information including sequence and account number",
    {
      address: z.string().describe("The Cosmos address"),
      chain: z.string().default("cosmoshub").describe("Chain ID"),
    },
    async ({ address, chain }) => {
      try {
        const data = await fetchCosmosAPI(chain, `/cosmos/auth/v1beta1/accounts/${address}`)

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  address,
                  chain,
                  accountNumber: data.account?.account_number,
                  sequence: data.account?.sequence,
                  pubKey: data.account?.pub_key,
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

  // Get staking delegations
  server.tool(
    "cosmos_get_delegations",
    "Get staking delegations for an address",
    {
      address: z.string().describe("The delegator address"),
      chain: z.string().default("cosmoshub").describe("Chain ID"),
    },
    async ({ address, chain }) => {
      try {
        const data = await fetchCosmosAPI(chain, `/cosmos/staking/v1beta1/delegations/${address}`)
        const chainInfo = CHAIN_DENOMS[chain] || CHAIN_DENOMS.cosmoshub

        const delegations = data.delegation_responses?.map((d: any) => ({
          validator: d.delegation.validator_address,
          amount: parseInt(d.balance.amount) / Math.pow(10, chainInfo.decimals),
          symbol: chainInfo.symbol,
        }))

        const totalStaked = delegations?.reduce((sum: number, d: any) => sum + d.amount, 0) || 0

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  address,
                  chain,
                  totalStaked,
                  symbol: chainInfo.symbol,
                  delegations,
                },
                null,
                2
              ),
            },
          ],
        }
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error fetching delegations: ${error}` }],
          isError: true,
        }
      }
    }
  )

  // Get staking rewards
  server.tool(
    "cosmos_get_rewards",
    "Get pending staking rewards for an address",
    {
      address: z.string().describe("The delegator address"),
      chain: z.string().default("cosmoshub").describe("Chain ID"),
    },
    async ({ address, chain }) => {
      try {
        const data = await fetchCosmosAPI(
          chain,
          `/cosmos/distribution/v1beta1/delegators/${address}/rewards`
        )
        const chainInfo = CHAIN_DENOMS[chain] || CHAIN_DENOMS.cosmoshub

        const totalRewards =
          data.total?.find((r: any) => r.denom === chainInfo.denom)?.amount || "0"
        const rewardAmount = parseFloat(totalRewards) / Math.pow(10, chainInfo.decimals)

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  address,
                  chain,
                  pendingRewards: rewardAmount,
                  symbol: chainInfo.symbol,
                  rewardsByValidator: data.rewards,
                },
                null,
                2
              ),
            },
          ],
        }
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error fetching rewards: ${error}` }],
          isError: true,
        }
      }
    }
  )

  // Get validators
  server.tool(
    "cosmos_get_validators",
    "Get list of active validators",
    {
      chain: z.string().default("cosmoshub").describe("Chain ID"),
      status: z
        .enum(["BOND_STATUS_BONDED", "BOND_STATUS_UNBONDED", "BOND_STATUS_UNBONDING"])
        .default("BOND_STATUS_BONDED")
        .describe("Validator status filter"),
      limit: z.number().default(100).describe("Max validators to return"),
    },
    async ({ chain, status, limit }) => {
      try {
        const data = await fetchCosmosAPI(
          chain,
          `/cosmos/staking/v1beta1/validators?status=${status}&pagination.limit=${limit}`
        )
        const chainInfo = CHAIN_DENOMS[chain] || CHAIN_DENOMS.cosmoshub

        const validators = data.validators?.map((v: any) => ({
          name: v.description?.moniker,
          address: v.operator_address,
          tokens: parseInt(v.tokens) / Math.pow(10, chainInfo.decimals),
          commission: parseFloat(v.commission?.commission_rates?.rate) * 100,
          jailed: v.jailed,
          status: v.status,
        }))

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  chain,
                  validatorCount: validators?.length || 0,
                  validators: validators?.slice(0, 20), // Top 20 for display
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

  // Get IBC channels
  server.tool(
    "cosmos_get_ibc_channels",
    "Get IBC channels for cross-chain transfers",
    {
      chain: z.string().default("cosmoshub").describe("Chain ID"),
    },
    async ({ chain }) => {
      try {
        const data = await fetchCosmosAPI(chain, `/ibc/core/channel/v1/channels`)

        const channels = data.channels?.map((c: any) => ({
          channelId: c.channel_id,
          portId: c.port_id,
          state: c.state,
          counterparty: c.counterparty,
          connectionHops: c.connection_hops,
        }))

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  chain,
                  channelCount: channels?.length || 0,
                  channels: channels?.slice(0, 50),
                },
                null,
                2
              ),
            },
          ],
        }
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error fetching IBC channels: ${error}` }],
          isError: true,
        }
      }
    }
  )

  // Get governance proposals
  server.tool(
    "cosmos_get_proposals",
    "Get governance proposals",
    {
      chain: z.string().default("cosmoshub").describe("Chain ID"),
      status: z
        .enum([
          "PROPOSAL_STATUS_VOTING_PERIOD",
          "PROPOSAL_STATUS_PASSED",
          "PROPOSAL_STATUS_REJECTED",
          "PROPOSAL_STATUS_DEPOSIT_PERIOD",
        ])
        .optional()
        .describe("Filter by proposal status"),
    },
    async ({ chain, status }) => {
      try {
        let endpoint = `/cosmos/gov/v1beta1/proposals`
        if (status) {
          endpoint += `?proposal_status=${status}`
        }

        const data = await fetchCosmosAPI(chain, endpoint)

        const proposals = data.proposals?.map((p: any) => ({
          id: p.proposal_id,
          title: p.content?.title || p.title,
          status: p.status,
          submitTime: p.submit_time,
          votingEndTime: p.voting_end_time,
          totalDeposit: p.total_deposit,
        }))

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  chain,
                  proposalCount: proposals?.length || 0,
                  proposals,
                },
                null,
                2
              ),
            },
          ],
        }
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error fetching proposals: ${error}` }],
          isError: true,
        }
      }
    }
  )

  // Get transaction by hash
  server.tool(
    "cosmos_get_transaction",
    "Get transaction details by hash",
    {
      hash: z.string().describe("Transaction hash"),
      chain: z.string().default("cosmoshub").describe("Chain ID"),
    },
    async ({ hash, chain }) => {
      try {
        const data = await fetchCosmosAPI(chain, `/cosmos/tx/v1beta1/txs/${hash}`)

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  hash: data.tx_response?.txhash,
                  height: data.tx_response?.height,
                  code: data.tx_response?.code,
                  gasUsed: data.tx_response?.gas_used,
                  gasWanted: data.tx_response?.gas_wanted,
                  timestamp: data.tx_response?.timestamp,
                  messages: data.tx?.body?.messages,
                  logs: data.tx_response?.logs,
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

  // Get supported chains
  server.tool(
    "cosmos_get_supported_chains",
    "Get list of supported Cosmos SDK chains",
    {},
    async () => {
      const chains = Object.entries(CHAIN_DENOMS).map(([chain, info]) => ({
        chain,
        symbol: info.symbol,
        denom: info.denom,
        decimals: info.decimals,
        rpcEndpoint: COSMOS_RPC_ENDPOINTS[chain],
      }))

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ supportedChains: chains }, null, 2),
          },
        ],
      }
    }
  )
}
