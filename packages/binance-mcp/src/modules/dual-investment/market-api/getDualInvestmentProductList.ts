// src/tools/binance-dual-investment/market-api/getDualInvestmentProductList.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { dualInvestmentClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceGetDualInvestmentProductList(server: McpServer) {
    server.tool(
        "BinanceGetDualInvestmentProductList",
        "Retrieve available Dual Investment products (CALL or PUT options), specifying invest and exercised coins, to view details like APR, strike price, duration, and purchase availability.",
        {
            optionType: z.enum(["CALL", "PUT"]).describe("Input CALL or PUT"),
            exercisedCoin: z.string().describe("Target exercised asset, e.g., USDT or BNB"),
            investCoin: z.string().describe("Asset used for subscribing, e.g., BNB or USDT"),
            pageSize: z
                .number()
                .int()
                .max(100, "Maximum pageSize is 100")
                .default(10)
                .optional()
                .describe("Number of records per page, default 10, max 100"),
            pageIndex: z.number().int().default(1).optional().describe("Page index, default is 1"),
            recvWindow: z
                .number()
                .int()
                .max(60000, "recvWindow cannot be greater than 60000")
                .optional()
                .describe("Optional time window for request validity")
        },
        async (params) => {
            try {
                const response = await dualInvestmentClient.restAPI.getDualInvestmentProductList({
                    optionType: params.optionType,
                    exercisedCoin: params.exercisedCoin,
                    investCoin: params.investCoin,
                    ...(params.pageSize && { pageSize: params.pageSize }),
                    ...(params.pageIndex && { pageIndex: params.pageIndex }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully retrieved available Dual Investment products. Response: ${JSON.stringify(
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
                            text: `Failed to retrieve available Dual Investment products: ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
