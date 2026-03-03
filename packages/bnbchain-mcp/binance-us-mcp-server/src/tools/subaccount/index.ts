/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/subaccount/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { makeSignedRequest } from "../../config/binanceUsClient.js";

/**
 * Register all Sub-account related tools for Binance.US
 * 
 * Sub-account endpoints provide access to:
 * - List sub-accounts
 * - Transfer history between accounts
 * - Execute transfers
 * - Sub-account balances
 * - Master account summary
 * - Sub-account status
 */
export function registerSubaccountTools(server: McpServer) {
    // =====================================================
    // binance_us_subaccount_list
    // GET /sapi/v3/sub-account/list
    // =====================================================
    server.tool(
        "binance_us_subaccount_list",
        "Get a list of all sub-accounts. Filter by email or status (enabled/disabled).",
        {
            email: z.string().optional().describe("Filter by sub-account email"),
            status: z.string().optional().describe("Filter by status: 'enabled' or 'disabled'"),
            page: z.number().optional().describe("Page number. Default: 1"),
            limit: z.number().optional().describe("Results per page. Default: 500"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000"),
        },
        async ({ email, status, page, limit, recvWindow }) => {
            try {
                const params: Record<string, any> = {};
                if (email !== undefined) params.email = email;
                if (status !== undefined) params.status = status;
                if (page !== undefined) params.page = page;
                if (limit !== undefined) params.limit = limit;
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const data = await makeSignedRequest("GET", "/sapi/v3/sub-account/list", params);
                
                return {
                    content: [{
                        type: "text",
                        text: `Sub-accounts:\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get sub-account list: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );

    // =====================================================
    // binance_us_subaccount_transfer_history
    // GET /sapi/v3/sub-account/transfer/history
    // =====================================================
    server.tool(
        "binance_us_subaccount_transfer_history",
        "Get transfer history between master and sub-accounts.",
        {
            email: z.string().optional().describe("Sub-account email to filter by"),
            startTime: z.number().optional().describe("Start time in milliseconds"),
            endTime: z.number().optional().describe("End time in milliseconds"),
            page: z.number().optional().describe("Page number. Each page contains up to 500 records"),
            limit: z.number().optional().describe("Results per page. Default: 500"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000"),
        },
        async ({ email, startTime, endTime, page, limit, recvWindow }) => {
            try {
                const params: Record<string, any> = {};
                if (email !== undefined) params.email = email;
                if (startTime !== undefined) params.startTime = startTime;
                if (endTime !== undefined) params.endTime = endTime;
                if (page !== undefined) params.page = page;
                if (limit !== undefined) params.limit = limit;
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const data = await makeSignedRequest("GET", "/sapi/v3/sub-account/transfer/history", params);
                
                return {
                    content: [{
                        type: "text",
                        text: `Sub-account Transfer History:\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get transfer history: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );

    // =====================================================
    // binance_us_subaccount_transfer
    // POST /sapi/v3/sub-account/transfer
    // =====================================================
    server.tool(
        "binance_us_subaccount_transfer",
        "Execute an asset transfer between master account and a sub-account. ⚠️ This moves funds between accounts!",
        {
            fromEmail: z.string().email().describe("Sender email address"),
            toEmail: z.string().email().describe("Recipient email address"),
            asset: z.string().describe("Asset symbol to transfer, e.g., BTC, ETH"),
            amount: z.number().describe("Amount to transfer"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000"),
        },
        async ({ fromEmail, toEmail, asset, amount, recvWindow }) => {
            try {
                const params: Record<string, any> = {
                    fromEmail,
                    toEmail,
                    asset,
                    amount
                };
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const data = await makeSignedRequest("POST", "/sapi/v3/sub-account/transfer", params);
                
                return {
                    content: [{
                        type: "text",
                        text: `Transfer completed successfully!\nTransaction ID: ${data.txnId}\nFrom: ${fromEmail}\nTo: ${toEmail}\nAsset: ${asset}\nAmount: ${amount}\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to execute transfer: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );

    // =====================================================
    // binance_us_subaccount_assets
    // GET /sapi/v3/sub-account/assets
    // =====================================================
    server.tool(
        "binance_us_subaccount_assets",
        "Get asset balances for a specific sub-account.",
        {
            email: z.string().email().describe("Sub-account email address"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000"),
        },
        async ({ email, recvWindow }) => {
            try {
                const params: Record<string, any> = { email };
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const data = await makeSignedRequest("GET", "/sapi/v3/sub-account/assets", params);
                
                // Filter to show only non-zero balances
                const nonZeroBalances = data.balances?.filter(
                    (b: { free: string | number; locked: string | number }) => 
                        parseFloat(String(b.free)) > 0 || parseFloat(String(b.locked)) > 0
                ) || [];
                
                return {
                    content: [{
                        type: "text",
                        text: `Sub-account Assets for ${email}:\n\nNon-zero balances:\n${JSON.stringify(nonZeroBalances, null, 2)}\n\nFull response:\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get sub-account assets: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );

    // =====================================================
    // binance_us_subaccount_summary
    // GET /sapi/v1/sub-account/spotSummary
    // =====================================================
    server.tool(
        "binance_us_subaccount_summary",
        "Get the total USD value of assets in the master account and all sub-accounts.",
        {
            email: z.string().optional().describe("Filter by specific sub-account email"),
            page: z.number().optional().describe("Page number"),
            size: z.number().optional().describe("Results per page"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000"),
        },
        async ({ email, page, size, recvWindow }) => {
            try {
                const params: Record<string, any> = {};
                if (email !== undefined) params.email = email;
                if (page !== undefined) params.page = page;
                if (size !== undefined) params.size = size;
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const data = await makeSignedRequest("GET", "/sapi/v1/sub-account/spotSummary", params);
                
                return {
                    content: [{
                        type: "text",
                        text: `Sub-account Summary:\nTotal Accounts: ${data.totalCount}\nMaster Account Total Asset (USD): ${data.masterAccountTotalAsset}\n\nSub-account Details:\n${JSON.stringify(data.spotSubUserAssetBtcVoList, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get sub-account summary: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );

    // =====================================================
    // binance_us_subaccount_status
    // GET /sapi/v1/sub-account/status
    // =====================================================
    server.tool(
        "binance_us_subaccount_status",
        "Get status list of sub-accounts including activation status and enabled features.",
        {
            email: z.string().optional().describe("Sub-account email to check status for"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000"),
        },
        async ({ email, recvWindow }) => {
            try {
                const params: Record<string, any> = {};
                if (email !== undefined) params.email = email;
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const data = await makeSignedRequest("GET", "/sapi/v1/sub-account/status", params);
                
                return {
                    content: [{
                        type: "text",
                        text: `Sub-account Status:\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get sub-account status: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
