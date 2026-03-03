// src/tools/binance-dual-investment/trade-api/getDualInvestmentPositions.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { dualInvestmentClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceGetDualInvestmentPositions(server: McpServer) {
    server.tool(
        "BinanceGetDualInvestmentPositions",
        "Fetch Dual Investment positions in batch, including status, subscription details, APR, and settlement info. Filter by status or paginate results.",
        {
            status: z
                .enum([
                    "PENDING",
                    "PURCHASE_SUCCESS",
                    "SETTLED",
                    "PURCHASE_FAIL",
                    "REFUNDING",
                    "REFUND_SUCCESS",
                    "SETTLING"
                ])
                .optional()
                .describe(
                    "Position status: PENDING (awaiting results), PURCHASE_SUCCESS, SETTLED, PURCHASE_FAIL, REFUNDING, REFUND_SUCCESS, or SETTLING. If not provided, returns all."
                ),
            pageSize: z
                .number()
                .int()
                .min(1)
                .max(100)
                .optional()
                .describe("Number of items per page, default 10, max 100"),
            pageIndex: z.number().int().min(1).optional().describe("Page index, default 1"),
            recvWindow: z
                .number()
                .int()
                .max(60000)
                .optional()
                .describe("Optional time window for request validity (max 60000)")
        },
        async (params) => {
            try {
                const response = await dualInvestmentClient.restAPI.getDualInvestmentPositions({
                    ...(params.status && { status: params.status }),
                    ...(params.pageSize && { pageSize: params.pageSize }),
                    ...(params.pageIndex && { pageIndex: params.pageIndex }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully Fetched Dual Investment positions in batch, including status, subscription details, APR, and settlement info. Response: ${JSON.stringify(
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
                            text: `Failed to fetch dual investment positions: ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
