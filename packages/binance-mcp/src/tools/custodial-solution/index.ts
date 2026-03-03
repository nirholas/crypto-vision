// src/tools/custodial-solution/index.ts
// Binance.US Custodial Solution API Tools
// ⚠️ REQUIRES CUSTODIAL SOLUTION API KEY - Not available to regular users
// Only for users with a Custody Exchange Network agreement

import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { makeSignedRequest } from "../../config/binanceUsClient.js";

/**
 * Register all Binance.US Custodial Solution tools
 * 
 * ⚠️ IMPORTANT: These endpoints require a Custodial Solution API Key
 * Regular Exchange API Keys will NOT work with these endpoints.
 * 
 * Custodial Solution API is for institutional users who have entered into
 * a Custody Exchange Network agreement with a participating custody partner.
 * 
 * Categories:
 * - User Account Data (balance, supported assets)
 * - Transfer (wallet transfer, custodian transfer, undo transfer)
 * - Settlement (to custodial partner)
 */
export function registerCustodialSolutionTools(server: McpServer) {
    // =====================================================================
    // GET /sapi/v1/custodian/balance - Get Account Balance
    // =====================================================================
    server.tool(
        "binance_us_custodial_balance",
        `Get balance information for Binance.US exchange wallet and custodial sub-account.

⚠️ REQUIRES CUSTODIAL SOLUTION API KEY - Regular API keys will not work.

Returns two balance arrays:
- exchangeWalletBalance: Balances in your Binance.US exchange wallet
- custodialAcctBalance: Balances in your Binance.US custodial sub-account

Each balance includes:
- asset: Asset symbol (e.g., BTC, ETH)
- free: Available balance
- locked: Locked balance (in orders, etc.)
- inSettlement: Amount in settlement process (custodial only)
- lastUpdatedTime: Last update timestamp`,
        {
            rail: z.string().describe("Custodial partner identifier (all uppercase, e.g., 'FIREBLOCKS')")
        },
        async ({ rail }) => {
            try {
                const response = await makeSignedRequest("GET", "/sapi/v1/custodian/balance", {
                    rail: rail.toUpperCase()
                });

                return {
                    content: [{
                        type: "text",
                        text: `Custodial Balance Information:\n${JSON.stringify(response, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get custodial balance: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );

    // =====================================================================
    // GET /sapi/v1/custodian/supportedAssetList - Get Supported Assets
    // =====================================================================
    server.tool(
        "binance_us_custodial_supported_assets",
        `Get list of assets supported for custodial transfers and settlements.

⚠️ REQUIRES CUSTODIAL SOLUTION API KEY

Returns two lists:
- transferEligible: Assets that can be transferred FROM custodial partner
- settlementEligible: Assets that can be settled TO custodial partner

Each asset includes:
- asset: Asset symbol
- precision: Decimal precision
- network: Supported networks for the asset`,
        {
            rail: z.string().describe("Custodial partner identifier (all uppercase)")
        },
        async ({ rail }) => {
            try {
                const response = await makeSignedRequest("GET", "/sapi/v1/custodian/supportedAssetList", {
                    rail: rail.toUpperCase()
                });

                return {
                    content: [{
                        type: "text",
                        text: `Custodial Supported Assets:\n${JSON.stringify(response, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get supported assets: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );

    // =====================================================================
    // POST /sapi/v1/custodian/walletTransfer - Transfer From Exchange Wallet
    // =====================================================================
    server.tool(
        "binance_us_custodial_wallet_transfer",
        `Transfer assets from your Binance.US exchange wallet to your custodial sub-account.

⚠️ REQUIRES CUSTODIAL SOLUTION API KEY
⚠️ This moves funds - verify details carefully!

This transfers from your main Binance.US account to your custodial sub-account,
which can then be traded or settled to your custodial partner.`,
        {
            rail: z.string().describe("Custodial partner identifier (all uppercase)"),
            asset: z.string().describe("Asset to transfer (e.g., BTC, ETH)"),
            amount: z.number().positive().describe("Amount to transfer"),
            clientOrderId: z.string().optional().describe("Your reference ID (auto-generated if not provided)")
        },
        async ({ rail, asset, amount, clientOrderId }) => {
            try {
                const params: Record<string, any> = {
                    rail: rail.toUpperCase(),
                    asset: asset.toUpperCase(),
                    amount
                };
                if (clientOrderId) params.clientOrderId = clientOrderId;

                const response = await makeSignedRequest("POST", "/sapi/v1/custodian/walletTransfer", params);

                return {
                    content: [{
                        type: "text",
                        text: `Wallet Transfer Submitted!\n\nTransfer ID: ${response.transferId}\nAsset: ${response.asset}\nAmount: ${response.amount}\nStatus: ${response.status}\n\nFull Response:\n${JSON.stringify(response, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to execute wallet transfer: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );

    // =====================================================================
    // POST /sapi/v1/custodian/custodianTransfer - Transfer From Custodian
    // =====================================================================
    server.tool(
        "binance_us_custodial_custodian_transfer",
        `Request asset transfer from a custodial partner account to Binance.US custodial sub-account.

⚠️ REQUIRES CUSTODIAL SOLUTION API KEY
⚠️ This initiates a transfer request to your custody partner!

This requests your custodial partner to transfer assets to your Binance.US account.
The actual transfer is executed by the custody partner.`,
        {
            rail: z.string().describe("Custodial partner identifier (all uppercase)"),
            asset: z.string().describe("Asset to transfer (e.g., BTC, ETH)"),
            amount: z.number().positive().describe("Amount to transfer"),
            clientOrderId: z.string().optional().describe("Your reference ID (auto-generated if not provided)")
        },
        async ({ rail, asset, amount, clientOrderId }) => {
            try {
                const params: Record<string, any> = {
                    rail: rail.toUpperCase(),
                    asset: asset.toUpperCase(),
                    amount
                };
                if (clientOrderId) params.clientOrderId = clientOrderId;

                const response = await makeSignedRequest("POST", "/sapi/v1/custodian/custodianTransfer", params);

                return {
                    content: [{
                        type: "text",
                        text: `Custodian Transfer Requested!\n\nTransfer ID: ${response.transferId}\nAsset: ${response.asset}\nAmount: ${response.amount}\nStatus: ${response.status}\n\nFull Response:\n${JSON.stringify(response, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to request custodian transfer: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );

    // =====================================================================
    // POST /sapi/v1/custodian/undoTransfer - Undo Transfer
    // =====================================================================
    server.tool(
        "binance_us_custodial_undo_transfer",
        `Undo a previous transfer from your custodial partner.

⚠️ REQUIRES CUSTODIAL SOLUTION API KEY
⚠️ Only certain transfers can be undone - check with your custodial partner.

This reverses a previous custodian transfer by its transfer ID.`,
        {
            rail: z.string().describe("Custodial partner identifier (all uppercase)"),
            originTransferId: z.string().describe("The transfer ID of the original transfer to undo")
        },
        async ({ rail, originTransferId }) => {
            try {
                const response = await makeSignedRequest("POST", "/sapi/v1/custodian/undoTransfer", {
                    rail: rail.toUpperCase(),
                    originTransferId
                });

                return {
                    content: [{
                        type: "text",
                        text: `Transfer Undone!\n\nUndo Transfer ID: ${response.transferId}\nAsset: ${response.asset}\nAmount: ${response.amount}\n\nFull Response:\n${JSON.stringify(response, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to undo transfer: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );

    // =====================================================================
    // GET /sapi/v1/custodian/walletTransferHistory - Wallet Transfer History
    // =====================================================================
    server.tool(
        "binance_us_custodial_wallet_transfer_history",
        `Get history of transfers from Binance.US exchange wallet to custodial sub-account.

⚠️ REQUIRES CUSTODIAL SOLUTION API KEY

Returns transfer history with status, amounts, and timestamps.`,
        {
            rail: z.string().describe("Custodial partner identifier (all uppercase)"),
            transferId: z.string().optional().describe("Filter by specific transfer ID"),
            clientOrderId: z.string().optional().describe("Filter by your reference ID"),
            asset: z.string().optional().describe("Filter by asset (e.g., BTC)"),
            startTime: z.number().optional().describe("Start time in milliseconds (default: 90 days ago)"),
            endTime: z.number().optional().describe("End time in milliseconds (default: now)"),
            page: z.number().optional().describe("Page number (default: 1)"),
            limit: z.number().optional().describe("Results per page (default: 20, max: 100)")
        },
        async ({ rail, transferId, clientOrderId, asset, startTime, endTime, page, limit }) => {
            try {
                const params: Record<string, any> = { rail: rail.toUpperCase() };
                if (transferId) params.transferId = transferId;
                if (clientOrderId) params.clientOrderId = clientOrderId;
                if (asset) params.asset = asset.toUpperCase();
                if (startTime) params.startTime = startTime;
                if (endTime) params.endTime = endTime;
                if (page) params.page = page;
                if (limit) params.limit = limit;

                const response = await makeSignedRequest("GET", "/sapi/v1/custodian/walletTransferHistory", params);

                return {
                    content: [{
                        type: "text",
                        text: `Wallet Transfer History:\n\nTotal: ${response.total}\n\n${JSON.stringify(response.data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get wallet transfer history: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );

    // =====================================================================
    // GET /sapi/v1/custodian/custodianTransferHistory - Custodian Transfer History
    // =====================================================================
    server.tool(
        "binance_us_custodial_custodian_transfer_history",
        `Get history of transfers from custodial partner, including ExpressTrade and Undo transfers.

⚠️ REQUIRES CUSTODIAL SOLUTION API KEY

Returns transfer history with status, amounts, and timestamps.`,
        {
            rail: z.string().describe("Custodial partner identifier (all uppercase)"),
            transferId: z.string().optional().describe("Filter by specific transfer ID"),
            clientOrderId: z.string().optional().describe("Filter by your reference ID"),
            expressTradeTransfer: z.boolean().optional().describe("Filter by ExpressTrade transfers only"),
            asset: z.string().optional().describe("Filter by asset (e.g., BTC)"),
            startTime: z.number().optional().describe("Start time in milliseconds"),
            endTime: z.number().optional().describe("End time in milliseconds"),
            page: z.number().optional().describe("Page number (default: 1)"),
            limit: z.number().optional().describe("Results per page (default: 20, max: 100)")
        },
        async ({ rail, transferId, clientOrderId, expressTradeTransfer, asset, startTime, endTime, page, limit }) => {
            try {
                const params: Record<string, any> = { rail: rail.toUpperCase() };
                if (transferId) params.transferId = transferId;
                if (clientOrderId) params.clientOrderId = clientOrderId;
                if (expressTradeTransfer !== undefined) params.expressTradeTransfer = expressTradeTransfer;
                if (asset) params.asset = asset.toUpperCase();
                if (startTime) params.startTime = startTime;
                if (endTime) params.endTime = endTime;
                if (page) params.page = page;
                if (limit) params.limit = limit;

                const response = await makeSignedRequest("GET", "/sapi/v1/custodian/custodianTransferHistory", params);

                return {
                    content: [{
                        type: "text",
                        text: `Custodian Transfer History:\n\nTotal: ${response.total}\n\n${JSON.stringify(response.data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get custodian transfer history: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );

    // =====================================================================
    // POST /sapi/v1/custodian/settlement - Request Settlement
    // =====================================================================
    server.tool(
        "binance_us_custodial_settlement",
        `Request settlement of assets from custodial sub-account to custodial partner.

⚠️ REQUIRES CUSTODIAL SOLUTION API KEY
⚠️ This sends funds to your custodial partner!

This settles (withdraws) assets from your Binance.US custodial sub-account
to your custody partner's vault.`,
        {
            rail: z.string().describe("Custodial partner identifier (all uppercase)"),
            asset: z.string().describe("Asset to settle (e.g., BTC, ETH)"),
            amount: z.number().positive().describe("Amount to settle"),
            clientOrderId: z.string().optional().describe("Your reference ID (auto-generated if not provided)")
        },
        async ({ rail, asset, amount, clientOrderId }) => {
            try {
                const params: Record<string, any> = {
                    rail: rail.toUpperCase(),
                    asset: asset.toUpperCase(),
                    amount
                };
                if (clientOrderId) params.clientOrderId = clientOrderId;

                const response = await makeSignedRequest("POST", "/sapi/v1/custodian/settlement", params);

                return {
                    content: [{
                        type: "text",
                        text: `Settlement Requested!\n\nSettlement ID: ${response.settlementId}\nAsset: ${response.asset}\nAmount: ${response.amount}\nStatus: ${response.status}\n\nFull Response:\n${JSON.stringify(response, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to request settlement: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );

    // =====================================================================
    // GET /sapi/v1/custodian/settlementHistory - Settlement History
    // =====================================================================
    server.tool(
        "binance_us_custodial_settlement_history",
        `Get history of settlements from custodial sub-account to custodial partner.

⚠️ REQUIRES CUSTODIAL SOLUTION API KEY

Returns settlement history with status, amounts, and timestamps.`,
        {
            rail: z.string().describe("Custodial partner identifier (all uppercase)"),
            settlementId: z.string().optional().describe("Filter by specific settlement ID"),
            clientOrderId: z.string().optional().describe("Filter by your reference ID"),
            asset: z.string().optional().describe("Filter by asset (e.g., BTC)"),
            startTime: z.number().optional().describe("Start time in milliseconds"),
            endTime: z.number().optional().describe("End time in milliseconds"),
            page: z.number().optional().describe("Page number (default: 1)"),
            limit: z.number().optional().describe("Results per page (default: 20, max: 100)")
        },
        async ({ rail, settlementId, clientOrderId, asset, startTime, endTime, page, limit }) => {
            try {
                const params: Record<string, any> = { rail: rail.toUpperCase() };
                if (settlementId) params.settlementId = settlementId;
                if (clientOrderId) params.clientOrderId = clientOrderId;
                if (asset) params.asset = asset.toUpperCase();
                if (startTime) params.startTime = startTime;
                if (endTime) params.endTime = endTime;
                if (page) params.page = page;
                if (limit) params.limit = limit;

                const response = await makeSignedRequest("GET", "/sapi/v1/custodian/settlementHistory", params);

                return {
                    content: [{
                        type: "text",
                        text: `Settlement History:\n\nTotal: ${response.total}\n\n${JSON.stringify(response.data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get settlement history: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
