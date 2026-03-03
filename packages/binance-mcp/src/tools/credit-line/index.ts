// src/tools/credit-line/index.ts
// Binance.US Credit Line Tools
// For institutional clients with credit line agreements

import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { makeSignedRequest } from "../../config/binanceUsClient.js";

/**
 * Register all Binance.US Credit Line tools
 * 
 * ⚠️ IMPORTANT: These APIs require a Credit Line API key type and an institutional 
 * credit line agreement with Binance.US. These are NOT available to retail users.
 * 
 * Credit Line allows institutional clients to:
 * - Borrow assets against collateral
 * - Trade with borrowed funds
 * - Manage margin call and liquidation thresholds
 * 
 * Key metrics:
 * - LTV (Loan-to-Value): Current loan amount / collateral value
 * - Margin Call LTV: Threshold that triggers margin call alerts
 * - Liquidation LTV: Threshold that triggers automatic liquidation
 */
export function registerCreditLineTools(server: McpServer) {
    // =====================================================================
    // GET /sapi/v2/cl/account - Get Credit Line Account Information
    // =====================================================================
    server.tool(
        "binance_us_cl_account",
        `Get current credit line account information including LTV ratios, balances, and loan details.

⚠️ REQUIRES CREDIT LINE API KEY - Standard API keys will not work.
⚠️ Requires institutional credit line agreement with Binance.US.

Returns comprehensive account information including:
- clAccountId: Credit line account ID
- masterAccountId: Master account ID
- LTV ratios: currentLTV, initialLTV, marginCallLTV, liquidationLTV
- interestRate: Current interest rate on borrowed assets
- liquidationFeeRate: Fee charged on liquidation
- contractStartTime/contractEndTime: Credit agreement validity period
- isActive, canTrade, canTransferIn, canTransferOut: Account status flags
- requiredDepositAmount: Additional collateral required (if any)
- availableAmountToTransferOut: How much can be withdrawn
- loanAssets: Details of borrowed assets
- balances: Current asset balances (collateral)`,
        {
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async (params) => {
            try {
                const requestParams: Record<string, any> = {};
                if (params.recvWindow) requestParams.recvWindow = params.recvWindow;

                const response = await makeSignedRequest("GET", "/sapi/v2/cl/account", requestParams);

                // Format key metrics for easy reading
                const summary = `Credit Line Account Summary:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Account ID: ${response.clAccountId}
Master Account: ${response.masterAccountId}

LTV Ratios:
  Current:     ${(parseFloat(response.currentLTV) * 100).toFixed(2)}%
  Initial:     ${(parseFloat(response.initialLTV) * 100).toFixed(2)}%
  Margin Call: ${(parseFloat(response.marginCallLTV) * 100).toFixed(2)}%
  Liquidation: ${(parseFloat(response.liquidationLTV) * 100).toFixed(2)}%

Rates:
  Interest:    ${(parseFloat(response.interestRate) * 100).toFixed(2)}%
  Liquidation: ${(parseFloat(response.liquidationFeeRate) * 100).toFixed(2)}%

Status:
  Active: ${response.isActive}
  Can Trade: ${response.canTrade}
  Can Transfer In: ${response.canTransferIn}
  Can Transfer Out: ${response.canTransferOut}

Contract Period:
  Start: ${new Date(response.contractStartTime).toISOString()}
  End:   ${new Date(response.contractEndTime).toISOString()}

Required Deposit: ${response.requiredDepositAmount}
Available to Withdraw: ${response.availableAmountToTransferOut}`;

                return {
                    content: [{
                        type: "text",
                        text: `${summary}\n\nFull Response:\n${JSON.stringify(response, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get credit line account: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );

    // =====================================================================
    // GET /sapi/v1/cl/alert/history - Get Alert History (Margin Calls/Liquidations)
    // =====================================================================
    server.tool(
        "binance_us_cl_alert_history",
        `Get margin call and liquidation alert history for your credit line account.

⚠️ REQUIRES CREDIT LINE API KEY - Standard API keys will not work.
⚠️ Requires institutional credit line agreement with Binance.US.

Returns alert records including:
- alertTime: When the alert was triggered
- alertType: MARGIN_CALL or LIQUIDATION_CALL
- currentLTV: LTV ratio at time of alert
- All LTV thresholds for reference
- totalBalance: Total collateral value at time of alert
- loanAssets: Borrowed assets at time of alert
- balances: Collateral balances at time of alert

Use this to monitor your account's health history and understand
when margin calls or liquidation warnings have occurred.`,
        {
            alertType: z.enum(["MARGIN_CALL", "LIQUIDATION_CALL"]).optional().describe("Filter by alert type"),
            startTime: z.number().optional().describe("Start time in milliseconds"),
            endTime: z.number().optional().describe("End time in milliseconds"),
            limit: z.number().optional().describe("Number of results. Default: 200"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async (params) => {
            try {
                const requestParams: Record<string, any> = {};
                if (params.alertType) requestParams.alertType = params.alertType;
                if (params.startTime) requestParams.startTime = params.startTime;
                if (params.endTime) requestParams.endTime = params.endTime;
                if (params.limit) requestParams.limit = params.limit;
                if (params.recvWindow) requestParams.recvWindow = params.recvWindow;

                const response = await makeSignedRequest("GET", "/sapi/v1/cl/alert/history", requestParams);

                // Format alerts for readability
                let alertSummary = "Credit Line Alert History:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
                if (Array.isArray(response) && response.length > 0) {
                    response.forEach((alert: any, index: number) => {
                        alertSummary += `\n[${index + 1}] ${alert.alertType}\n`;
                        alertSummary += `    Time: ${new Date(alert.alertTime).toISOString()}\n`;
                        alertSummary += `    Current LTV: ${(parseFloat(alert.currentLTV) * 100).toFixed(2)}%\n`;
                        alertSummary += `    Total Balance: $${alert.totalBalance}\n`;
                    });
                } else {
                    alertSummary += "No alerts found.\n";
                }

                return {
                    content: [{
                        type: "text",
                        text: `${alertSummary}\nFull Response:\n${JSON.stringify(response, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get alert history: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );

    // =====================================================================
    // GET /sapi/v1/cl/transferHistory - Get Transfer History
    // =====================================================================
    server.tool(
        "binance_us_cl_transfer_history",
        `Get transfer history for your credit line account.

⚠️ REQUIRES CREDIT LINE API KEY - Standard API keys will not work.
⚠️ Requires institutional credit line agreement with Binance.US.

Returns transfer records including:
- transferId: Unique transfer identifier
- transferType: TRANSFER_IN or TRANSFER_OUT
- asset: Asset that was transferred
- amount: Amount transferred
- status: SUCCESS, PENDING, or FAIL
- transferTime: When the transfer occurred

Use this to track deposits and withdrawals from your credit line account.`,
        {
            transferType: z.enum(["TRANSFER_IN", "TRANSFER_OUT"]).optional().describe("Filter by transfer type"),
            asset: z.string().optional().describe("Filter by asset, e.g., BTC, USD"),
            startTime: z.number().optional().describe("Start time in milliseconds"),
            endTime: z.number().optional().describe("End time in milliseconds"),
            limit: z.number().optional().describe("Number of results. Default: 20, Max: 100"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async (params) => {
            try {
                const requestParams: Record<string, any> = {};
                if (params.transferType) requestParams.transferType = params.transferType;
                if (params.asset) requestParams.asset = params.asset.toUpperCase();
                if (params.startTime) requestParams.startTime = params.startTime;
                if (params.endTime) requestParams.endTime = params.endTime;
                if (params.limit) requestParams.limit = params.limit;
                if (params.recvWindow) requestParams.recvWindow = params.recvWindow;

                const response = await makeSignedRequest("GET", "/sapi/v1/cl/transferHistory", requestParams);

                // Format transfers for readability
                let transferSummary = "Credit Line Transfer History:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
                if (Array.isArray(response) && response.length > 0) {
                    response.forEach((transfer: any, index: number) => {
                        const direction = transfer.transferType === "TRANSFER_IN" ? "→ IN" : "← OUT";
                        transferSummary += `\n[${index + 1}] ${direction} ${transfer.amount} ${transfer.asset}\n`;
                        transferSummary += `    ID: ${transfer.transferId}\n`;
                        transferSummary += `    Status: ${transfer.status}\n`;
                        transferSummary += `    Time: ${new Date(transfer.transferTime).toISOString()}\n`;
                    });
                } else {
                    transferSummary += "No transfers found.\n";
                }

                return {
                    content: [{
                        type: "text",
                        text: `${transferSummary}\nFull Response:\n${JSON.stringify(response, null, 2)}`
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

    // =====================================================================
    // POST /sapi/v1/cl/transfer - Execute Transfer
    // =====================================================================
    server.tool(
        "binance_us_cl_transfer",
        `Transfer assets in or out of your credit line account.

⚠️ REQUIRES CREDIT LINE API KEY - Standard API keys will not work.
⚠️ Requires institutional credit line agreement with Binance.US.
⚠️ This action moves funds - verify details carefully!

Transfer types:
- TRANSFER_IN: Move assets from master account to credit line account (add collateral)
- TRANSFER_OUT: Move assets from credit line account to master account (withdraw)

Note: Transferring out may be restricted if it would cause LTV to exceed limits.
Check availableAmountToTransferOut in binance_us_cl_account first.`,
        {
            transferType: z.enum(["TRANSFER_IN", "TRANSFER_OUT"]).describe("Direction: TRANSFER_IN (deposit) or TRANSFER_OUT (withdraw)"),
            transferAssetType: z.string().describe("Asset to transfer, e.g., BTC, USD"),
            quantity: z.number().positive().describe("Amount to transfer"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async (params) => {
            try {
                const requestParams: Record<string, any> = {
                    transferType: params.transferType,
                    transferAssetType: params.transferAssetType.toUpperCase(),
                    quantity: params.quantity
                };
                if (params.recvWindow) requestParams.recvWindow = params.recvWindow;

                const response = await makeSignedRequest("POST", "/sapi/v1/cl/transfer", requestParams);

                const direction = params.transferType === "TRANSFER_IN" ? "deposited to" : "withdrawn from";

                return {
                    content: [{
                        type: "text",
                        text: `Transfer completed!\n\nTransfer ID: ${response.transferId}\nStatus: ${response.status}\n${params.quantity} ${params.transferAssetType.toUpperCase()} ${direction} credit line account.\n\nFull Response:\n${JSON.stringify(response, null, 2)}`
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
}
