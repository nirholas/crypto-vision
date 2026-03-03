// src/tools/binance-vip-loan/trade-api/vipLoanRenew.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { vipLoanClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceVipLoanRenew(server: McpServer) {
    server.tool(
        "BinanceVipLoanRenew",
        "Allow VIP users to renew an existing VIP loan for a specified term, either 30 or 60 days.",
        {
            orderId: z.number().int().describe("The order ID for the loan request"),
            loanTerm: z.union([z.literal(30), z.literal(60)]).describe("Loan term in days, either 30 or 60"),
            recvWindow: z.number().int().optional().describe("Optional: Time window for request validity")
        },
        async (params) => {
            try {
                const response = await vipLoanClient.restAPI.vipLoanRenew({
                    orderId: params.orderId,
                    loanTerm: params.loanTerm,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully renew an existing VIP loan. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Failed to renew an existing VIP loan. ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
