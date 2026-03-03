/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/staking/index.ts
// Binance.US Staking Tools
// Earn rewards by staking supported cryptocurrencies

import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { makeSignedRequest } from "../../config/binanceUsClient.js";

/**
 * Register all Binance.US Staking tools
 * 
 * Staking allows users to earn rewards by locking up their cryptocurrency
 * to support network operations. Binance.US offers staking for various assets.
 */
export function registerStakingTools(server: McpServer) {
    // =====================================================================
    // GET /sapi/v1/staking/asset - Get Staking Asset Information
    // =====================================================================
    server.tool(
        "binance_us_staking_asset_info",
        `Get staking information for supported assets on Binance.US.

Returns details about staking options including APR, APY, and staking limits.

Response includes for each asset:
- stakingAsset: Asset being staked (e.g., BNB, ETH)
- rewardAsset: Asset received as staking reward
- apr: Annual Percentage Rate (without compounding)
- apy: Annual Percentage Yield (with compounding/restaking)
- unstakingPeriod: Time to unstake in hours (e.g., 168 = 7 days)
- minStakingLimit: Minimum amount allowed for staking
- maxStakingLimit: Maximum amount allowed for staking
- autoRestake: Whether rewards are automatically restaked

If no asset is specified, returns information for all staking assets.`,
        {
            stakingAsset: z.string().optional().describe("Asset symbol (e.g., BNB, ETH). If empty, returns all staking assets")
        },
        async (params) => {
            try {
                const response = await makeSignedRequest("GET", "/sapi/v1/staking/asset", {
                    ...(params.stakingAsset && { stakingAsset: params.stakingAsset.toUpperCase() })
                });

                return {
                    content: [{
                        type: "text",
                        text: `Successfully retrieved staking asset information. Response: ${JSON.stringify(response, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get staking asset info: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );

    // =====================================================================
    // POST /sapi/v1/staking/stake - Stake Asset
    // =====================================================================
    server.tool(
        "binance_us_staking_stake",
        `Stake a supported asset on Binance.US to earn staking rewards.

⚠️ IMPORTANT:
- Staking locks your assets for a period of time
- Check unstakingPeriod using binance_us_staking_asset_info before staking
- Ensure you have sufficient balance before staking
- Verify min/max staking limits for the asset

Parameters:
- stakingAsset: The asset to stake (e.g., BNB, ETH)
- amount: Amount to stake
- autoRestake: Whether to automatically restake rewards (default: true)

Response includes:
- result: SUCCESS or failure status
- purchaseRecordId: Record ID for the staking transaction`,
        {
            stakingAsset: z.string().describe("Asset symbol to stake (e.g., BNB, ETH)"),
            amount: z.number().positive().describe("Amount to stake"),
            autoRestake: z.boolean().optional().default(true).describe("Automatically restake rewards (default: true)")
        },
        async (params) => {
            try {
                const response = await makeSignedRequest("POST", "/sapi/v1/staking/stake", {
                    stakingAsset: params.stakingAsset.toUpperCase(),
                    amount: params.amount,
                    autoRestake: params.autoRestake
                });

                return {
                    content: [{
                        type: "text",
                        text: `Staking request submitted. Result: ${response.data?.result || response.result}. Response: ${JSON.stringify(response, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to stake asset: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );

    // =====================================================================
    // POST /sapi/v1/staking/unstake - Unstake Asset
    // =====================================================================
    server.tool(
        "binance_us_staking_unstake",
        `Unstake a previously staked asset on Binance.US.

⚠️ IMPORTANT:
- Unstaking may take time (check unstakingPeriod in asset info)
- You will stop earning rewards once unstaking begins
- Some assets may have early unstaking penalties

Parameters:
- stakingAsset: The asset to unstake (e.g., BNB, ETH)
- amount: Amount to unstake

Response includes:
- result: SUCCESS or failure status`,
        {
            stakingAsset: z.string().describe("Asset symbol to unstake (e.g., BNB, ETH)"),
            amount: z.number().positive().describe("Amount to unstake")
        },
        async (params) => {
            try {
                const response = await makeSignedRequest("POST", "/sapi/v1/staking/unstake", {
                    stakingAsset: params.stakingAsset.toUpperCase(),
                    amount: params.amount
                });

                return {
                    content: [{
                        type: "text",
                        text: `Unstaking request submitted. Result: ${response.data?.result || response.result}. Response: ${JSON.stringify(response, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to unstake asset: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );

    // =====================================================================
    // GET /sapi/v1/staking/stakingBalance - Get Staking Balance
    // =====================================================================
    server.tool(
        "binance_us_staking_balance",
        `Get current staking balance for assets on Binance.US.

Returns your current staking positions and their details.

Response includes for each staked asset:
- asset: The staked asset symbol
- stakingAmount: Total amount currently staked
- rewardAsset: Asset received as rewards
- apr: Current APR for the asset
- apy: Current APY (with compounding)
- autoRestake: Whether auto-restaking is enabled

If no asset is specified, returns balances for all staked assets.`,
        {
            asset: z.string().optional().describe("Staked asset symbol. If empty, returns all assets with balances")
        },
        async (params) => {
            try {
                const response = await makeSignedRequest("GET", "/sapi/v1/staking/stakingBalance", {
                    ...(params.asset && { asset: params.asset.toUpperCase() })
                });

                return {
                    content: [{
                        type: "text",
                        text: `Successfully retrieved staking balance. Response: ${JSON.stringify(response, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get staking balance: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );

    // =====================================================================
    // GET /sapi/v1/staking/history - Get Staking History
    // =====================================================================
    server.tool(
        "binance_us_staking_history",
        `Get staking transaction history for assets on Binance.US.

Returns a history of staking and unstaking transactions.

Response includes for each transaction:
- asset: The asset involved
- amount: Transaction amount
- type: Transaction type (staked, unstaked, etc.)
- initiatedTime: Transaction initiation timestamp
- status: Transaction status (SUCCESS, PENDING, etc.)

If no asset is specified, returns history for all assets.`,
        {
            asset: z.string().optional().describe("Asset symbol. If empty, returns all assets with history"),
            startTime: z.number().optional().describe("Start timestamp in milliseconds"),
            endTime: z.number().optional().describe("End timestamp in milliseconds"),
            page: z.number().int().positive().optional().default(1).describe("Page number (default: 1)"),
            limit: z.number().int().min(1).max(500).optional().default(500).describe("Records per page (default: 500, max: 500)")
        },
        async (params) => {
            try {
                const response = await makeSignedRequest("GET", "/sapi/v1/staking/history", {
                    ...(params.asset && { asset: params.asset.toUpperCase() }),
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.page && { page: params.page }),
                    ...(params.limit && { limit: params.limit })
                });

                return {
                    content: [{
                        type: "text",
                        text: `Successfully retrieved staking history. Response: ${JSON.stringify(response, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get staking history: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );

    // =====================================================================
    // GET /sapi/v1/staking/stakingRewardsHistory - Get Staking Rewards History
    // =====================================================================
    server.tool(
        "binance_us_staking_rewards",
        `Get staking rewards history for assets on Binance.US.

Returns a history of staking rewards earned over time.

Response includes:
- total: Total number of reward records
- data: Array of reward records

Each reward record contains:
- asset: The reward asset
- amount: Reward amount
- usdValue: USD value at time of reward
- time: Reward timestamp
- tranId: Transaction ID
- autoRestaked: Whether the reward was automatically restaked

If no asset is specified, returns rewards for all staked assets.`,
        {
            asset: z.string().optional().describe("Staked asset. If empty, returns all assets with rewards"),
            startTime: z.number().optional().describe("Start timestamp in milliseconds"),
            endTime: z.number().optional().describe("End timestamp in milliseconds"),
            page: z.number().int().positive().optional().describe("Page/batch number"),
            limit: z.number().int().min(1).max(500).optional().default(500).describe("Records per batch (default: 500)")
        },
        async (params) => {
            try {
                const response = await makeSignedRequest("GET", "/sapi/v1/staking/stakingRewardsHistory", {
                    ...(params.asset && { asset: params.asset.toUpperCase() }),
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.page && { page: params.page }),
                    ...(params.limit && { limit: params.limit })
                });

                return {
                    content: [{
                        type: "text",
                        text: `Successfully retrieved staking rewards history. Total: ${response.total || 'N/A'}. Response: ${JSON.stringify(response, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get staking rewards history: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
