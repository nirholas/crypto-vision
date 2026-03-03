// src/tools/binance-vip-loan/market-api/getBorrowInterestRate.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { vipLoanClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceGetBorrowInterestRate(server: McpServer) {
    server.tool(
        "BinanceGetBorrowInterestRate",
        "Retrieves the interest rates for borrowing assets. It provides both daily and yearly interest rates for multiple assets (e.g., BUSD, BTC). You can specify the assets by using a comma-separated list.",
        {
            loanCoin: z.string().min(1).describe("Max 10 assets, multiple split by ','"),
            recvWindow: z.number().int().optional().describe("Optional time window for request validity")
        },
        async (params) => {
            try {
                const response = await vipLoanClient.restAPI.getBorrowInterestRate({
                    loanCoin: params.loanCoin,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully retrieved the interest rates for borrowing assets. Response: ${JSON.stringify(
                                data
                            )}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Failed to retrieve the interest rates for borrowing assets. ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
