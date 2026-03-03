// src/tools/binance-vip-loan/trade-api/vipLoanRepay.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { vipLoanClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceVipLoanRepay(server: McpServer) {
    server.tool(
        "BinanceVipLoanRepay",
        "Allow VIP users to repay a specified amount of their active loan, partially or fully. It updates the remaining principal and interest, and provides the repayment status.",
        {
            orderId: z.number().int().describe("Order ID of the loan request"),
            amount: z.number().describe("Amount to be processed (decimal allowed)"),
            recvWindow: z.number().int().optional().describe("Optional time window for request validity")
        },
        async (params) => {
            try {
                const response = await vipLoanClient.restAPI.vipLoanRepay({
                    orderId: params.orderId,
                    amount: params.amount,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully repay the active loan. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Failed to repay the active loan. ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
