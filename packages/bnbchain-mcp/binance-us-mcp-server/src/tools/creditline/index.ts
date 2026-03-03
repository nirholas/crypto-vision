/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/creditline/index.ts
// Binance.US Credit Line Tools
// For institutional credit line agreements

import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { makeSignedRequest } from "../../config/binanceUsClient.js";

/**
 * Register all Binance.US Credit Line tools
 * 
 * ⚠️ IMPORTANT: These APIs require a Credit Line agreement with Binance.US.
 * They are only available to institutional users with approved credit facilities.
 * Standard Binance.US accounts do NOT have access to these endpoints.
 * 
 * Credit Line allows institutional traders to trade with borrowed funds,
 * similar to margin trading but with different risk parameters and
 * institutional-grade features.
 */
export function registerCreditLineTools(server: McpServer) {
    // =====================================================================
    // GET /sapi/v2/cl/account - Get Credit Line Account Information
    // =====================================================================
    server.tool(
        "binance_us_cl_account",
        `Get comprehensive credit line account information.

⚠️ REQUIRES INSTITUTIONAL CREDIT LINE AGREEMENT
This API is only available to institutional users with approved credit facilities.

Response includes:
- clAccountId: Credit line account ID
- masterAccountId: Associated master account ID
- notificationMailAddr: Email for notifications

LTV (Loan-to-Value) Ratios:
- currentLTV: Current loan-to-value ratio
- initialLTV: Initial LTV threshold
- marginCallLTV: LTV that triggers margin call
- liquidationLTV: LTV that triggers liquidation

Interest & Fees:
- interestRate: Annual interest rate on loans
- liquidationFeeRate: Fee charged on liquidation

Contract Details:
- contractStartTime/contractEndTime: Credit facility dates
- isActive: Whether credit line is active

Permissions:
- canTrade: Trading permission
- canTransferIn/canTransferOut: Transfer permissions

Loan Information:
- loanAssets: Array of loaned assets with quantities
- requiredDepositAmount: Additional collateral needed
- availableAmountToTransferOut: Funds available to withdraw

Balances:
- balances: Array of asset balances (free, locked)`,
        {
            recvWindow: z.number().int().max(60000).optional().describe("Request validity window in ms (max: 60000)")
        },
        async (params) => {
            try {
                const response = await makeSignedRequest("GET", "/sapi/v2/cl/account", {
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                // Calculate risk level based on LTV
                let riskLevel = "LOW";
                const currentLTV = parseFloat(response.currentLTV);
                const marginCallLTV = parseFloat(response.marginCallLTV);
                const liquidationLTV = parseFloat(response.liquidationLTV);
                
                if (currentLTV >= liquidationLTV) {
                    riskLevel = "CRITICAL - LIQUIDATION IMMINENT";
                } else if (currentLTV >= marginCallLTV) {
                    riskLevel = "HIGH - MARGIN CALL";
                } else if (currentLTV >= marginCallLTV * 0.9) {
                    riskLevel = "MEDIUM";
                }

                return {
                    content: [{
                        type: "text",
                        text: `Credit Line Account Info retrieved.

⚠️ Risk Level: ${riskLevel}
📊 Current LTV: ${(currentLTV * 100).toFixed(2)}%
📈 Margin Call LTV: ${(marginCallLTV * 100).toFixed(2)}%
🔴 Liquidation LTV: ${(liquidationLTV * 100).toFixed(2)}%
💰 Interest Rate: ${(parseFloat(response.interestRate) * 100).toFixed(2)}% annual

Full Response: ${JSON.stringify(response, null, 2)}`
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
    // GET /sapi/v1/cl/alert/history - Get Alert History (Margin Call & Liquidation)
    // =====================================================================
    server.tool(
        "binance_us_cl_alert_history",
        `Get margin call and liquidation alert history for credit line account.

⚠️ REQUIRES INSTITUTIONAL CREDIT LINE AGREEMENT

Alert Types:
- MARGIN_CALL: Warning that LTV is approaching liquidation threshold
- LIQUIDATION_CALL: Critical alert that liquidation is imminent/occurring

Each alert record includes:
- alertTime: When the alert was triggered
- alertType: MARGIN_CALL or LIQUIDATION_CALL
- currentLTV: LTV ratio at alert time
- initialLTV, marginCallLTV, liquidationLTV: Threshold values
- totalBalance: Total account balance at alert time
- loanAssets: Loan details at alert time
- balances: Asset balances with free, locked, freeze amounts

Use this to:
- Review past risk events
- Understand account risk patterns
- Audit margin call history`,
        {
            startTime: z.number().optional().describe("Start timestamp in milliseconds"),
            endTime: z.number().optional().describe("End timestamp in milliseconds"),
            limit: z.number().int().min(1).max(1000).optional().default(200).describe("Max records (default: 200)"),
            alertType: z.enum(["LIQUIDATION_CALL", "MARGIN_CALL"]).optional().describe("Filter by alert type"),
            recvWindow: z.number().int().max(60000).optional().describe("Request validity window (max: 60000)")
        },
        async (params) => {
            try {
                const response = await makeSignedRequest("GET", "/sapi/v1/cl/alert/history", {
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.limit && { limit: params.limit }),
                    ...(params.alertType && { alertType: params.alertType }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const alerts = Array.isArray(response) ? response : [];
                const marginCalls = alerts.filter((a: any) => a.alertType === "MARGIN_CALL").length;
                const liquidationCalls = alerts.filter((a: any) => a.alertType === "LIQUIDATION_CALL").length;

                return {
                    content: [{
                        type: "text",
                        text: `Credit Line Alert History retrieved.

📊 Total Alerts: ${alerts.length}
⚠️ Margin Calls: ${marginCalls}
🔴 Liquidation Calls: ${liquidationCalls}

Full Response: ${JSON.stringify(response, null, 2)}`
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
        `Get transfer history for credit line account.

⚠️ REQUIRES INSTITUTIONAL CREDIT LINE AGREEMENT

Transfer Types:
- TRANSFER_IN: Deposits into credit line account
- TRANSFER_OUT: Withdrawals from credit line account

Each transfer record includes:
- transferId: Unique transfer identifier
- transferType: TRANSFER_IN or TRANSFER_OUT
- asset: Transferred asset symbol
- amount: Transfer amount
- status: Transfer status (SUCCESS, PENDING, FAILED)
- transferTime: When the transfer occurred

Use this to:
- Track collateral movements
- Audit deposit/withdrawal history
- Reconcile account activity`,
        {
            startTime: z.number().optional().describe("Start timestamp in milliseconds"),
            endTime: z.number().optional().describe("End timestamp in milliseconds"),
            limit: z.number().int().min(1).max(100).optional().default(20).describe("Max records (default: 20, max: 100)"),
            transferType: z.enum(["TRANSFER_IN", "TRANSFER_OUT"]).optional().describe("Filter by transfer direction"),
            asset: z.string().optional().describe("Filter by asset (e.g., BTC, USD)"),
            recvWindow: z.number().int().max(60000).optional().describe("Request validity window (max: 60000)")
        },
        async (params) => {
            try {
                const response = await makeSignedRequest("GET", "/sapi/v1/cl/transferHistory", {
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.limit && { limit: params.limit }),
                    ...(params.transferType && { transferType: params.transferType }),
                    ...(params.asset && { asset: params.asset.toUpperCase() }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const transfers = Array.isArray(response) ? response : [];
                const transfersIn = transfers.filter((t: any) => t.transferType === "TRANSFER_IN").length;
                const transfersOut = transfers.filter((t: any) => t.transferType === "TRANSFER_OUT").length;

                return {
                    content: [{
                        type: "text",
                        text: `Credit Line Transfer History retrieved.

📊 Total Transfers: ${transfers.length}
📥 Transfers In: ${transfersIn}
📤 Transfers Out: ${transfersOut}

Full Response: ${JSON.stringify(response, null, 2)}`
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
        `Execute a transfer in or out of the credit line account.

⚠️ REQUIRES INSTITUTIONAL CREDIT LINE AGREEMENT

⚠️ WARNING: Transfers affect your LTV ratio!
- TRANSFER_OUT increases LTV (more risk)
- TRANSFER_IN decreases LTV (less risk)

Before transferring out, ensure:
1. Your LTV won't exceed marginCallLTV after transfer
2. You have sufficient availableAmountToTransferOut
3. You understand the impact on your credit position

Transfer Types:
- TRANSFER_IN: Add collateral to credit line account
- TRANSFER_OUT: Withdraw from credit line account

Response includes:
- transferId: Unique transfer identifier
- status: SUCCESS, PENDING, or FAILED`,
        {
            transferType: z.enum(["TRANSFER_IN", "TRANSFER_OUT"]).describe("Direction: TRANSFER_IN (deposit) or TRANSFER_OUT (withdraw)"),
            transferAssetType: z.string().describe("Asset to transfer (e.g., BTC, USD)"),
            quantity: z.number().positive().describe("Amount to transfer"),
            recvWindow: z.number().int().max(60000).optional().describe("Request validity window (max: 60000)")
        },
        async (params) => {
            try {
                const response = await makeSignedRequest("POST", "/sapi/v1/cl/transfer", {
                    transferType: params.transferType,
                    transferAssetType: params.transferAssetType.toUpperCase(),
                    quantity: params.quantity,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const actionText = params.transferType === "TRANSFER_IN" 
                    ? "deposited into" 
                    : "withdrawn from";

                return {
                    content: [{
                        type: "text",
                        text: `Credit Line Transfer executed.

${params.transferType === "TRANSFER_OUT" ? "⚠️ Your LTV ratio has increased. Monitor your position." : "✅ Collateral added. Your LTV ratio has decreased."}

💰 ${params.quantity} ${params.transferAssetType.toUpperCase()} ${actionText} credit line account
📋 Transfer ID: ${response.transferId}
✅ Status: ${response.status}

Full Response: ${JSON.stringify(response, null, 2)}`
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

    // =====================================================================
    // GET /sapi/v1/cl/liquidation/history - Get Liquidation History
    // =====================================================================
    server.tool(
        "binance_us_cl_liquidation_history",
        `Get liquidation history for credit line account.

⚠️ REQUIRES INSTITUTIONAL CREDIT LINE AGREEMENT

Liquidations occur when LTV exceeds liquidationLTV threshold.
This endpoint shows historical liquidation events.

Each liquidation record may include:
- Liquidated assets and amounts
- Liquidation timestamp
- LTV at time of liquidation
- Fees charged

Use this to:
- Review past liquidation events
- Understand liquidation patterns
- Audit risk management effectiveness`,
        {
            startTime: z.number().optional().describe("Start timestamp in milliseconds"),
            endTime: z.number().optional().describe("End timestamp in milliseconds"),
            limit: z.number().int().min(1).max(100).optional().default(20).describe("Max records (default: 20, max: 100)"),
            recvWindow: z.number().int().max(60000).optional().describe("Request validity window (max: 60000)")
        },
        async (params) => {
            try {
                const response = await makeSignedRequest("GET", "/sapi/v1/cl/liquidation/history", {
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.limit && { limit: params.limit }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const liquidations = Array.isArray(response) ? response : [];

                return {
                    content: [{
                        type: "text",
                        text: `Credit Line Liquidation History retrieved.

🔴 Total Liquidations: ${liquidations.length}
${liquidations.length > 0 ? "⚠️ Review your risk management strategy." : "✅ No liquidation events found."}

Full Response: ${JSON.stringify(response, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get liquidation history: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
