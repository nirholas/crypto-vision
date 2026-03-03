// src/tools/binance-vip-loan/userInformation-api/getVIPLoanOngoingOrders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { vipLoanClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceGetVIPLoanOngoingOrders(server: McpServer) {
    server.tool(
        "BinanceGetVIPLoanOngoingOrders",
        "Allows VIP users to retrieve a list of their current active loan orders. Users can filter results by loan coin, collateral coin, order ID, or collateral account ID.",
        {
            orderId: z.number().int().optional().describe("Optional order ID"),
            collateralAccountId: z.number().int().optional().describe("Optional collateral account ID"),
            loanCoin: z.string().optional().describe("Optional loan coin"),
            collateralCoin: z.string().optional().describe("Optional collateral coin"),
            current: z.number().int().min(1).max(1000).optional().describe("Current page, start from 1, max 1000"),
            limit: z.number().int().min(1).max(100).optional().describe("Results per page, default 10, max 100"),
            recvWindow: z.number().int().optional().describe("Optional time window for request validity")
        },
        async (params) => {
            try {
                const response = await vipLoanClient.restAPI.getVIPLoanOngoingOrders({
                    ...(params.orderId !== undefined && { orderId: params.orderId }),
                    ...(params.collateralAccountId !== undefined && {
                        collateralAccountId: params.collateralAccountId
                    }),
                    ...(params.loanCoin !== undefined && { loanCoin: params.loanCoin }),
                    ...(params.collateralCoin !== undefined && { collateralCoin: params.collateralCoin }),
                    ...(params.current !== undefined && { current: params.current }),
                    ...(params.limit !== undefined && { limit: params.limit }),
                    ...(params.recvWindow !== undefined && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully retrieved list of their current active loan orders. Response: ${JSON.stringify(
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
                            text: `Failed to retrieve list of their current active loan orders. ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
