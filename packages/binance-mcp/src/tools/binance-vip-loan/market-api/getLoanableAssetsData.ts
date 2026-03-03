// src/tools/binance-vip-loan/market-api/getLoanableAssetsData.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { vipLoanClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceGetLoanableAssetsData(server: McpServer) {
    server.tool(
        "BinanceGetLoanableAssetsData",
        "Retrieves interest rates and borrowing limits for loanable assets. The borrow limit is expressed in USD. You can request information for specific assets or leave it empty to query all available assets.",
        {
            loanCoin: z.string().optional().describe("Optional: Coin for the loan"),
            vipLevel: z.number().int().optional().describe("Optional: User's VIP level (default is user's vip level)"),
            recvWindow: z.number().int().optional().describe("Optional time window for request validity")
        },
        async (params) => {
            try {
                const response = await vipLoanClient.restAPI.getLoanableAssetsData({
                    ...(params.loanCoin && { loanCoin: params.loanCoin }),
                    ...(params.vipLevel && { vipLevel: params.vipLevel }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully retrieved interest rates and borrowing limits for loanable assets. Response: ${JSON.stringify(
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
                            text: `Failed to retrieve interest rates and borrowing limits for loanable assets. ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
