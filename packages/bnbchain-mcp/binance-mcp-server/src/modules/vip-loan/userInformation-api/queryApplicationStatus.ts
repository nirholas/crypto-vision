/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-vip-loan/userInformation-api/queryApplicationStatus.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { vipLoanClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceQueryApplicationStatus(server: McpServer) {
    server.tool(
        "BinanceQueryApplicationStatus",
        "Allows VIP users to check the status of their loan applications. It returns a list of loan requests with details such as loan coin, amount, term, collateral details, and current application status",
        {
            current: z
                .number()
                .int()
                .min(1)
                .max(1000)
                .optional()
                .describe("Currently querying page. Start from 1, default 1, max 1000"),
            limit: z.number().int().min(1).max(100).optional().describe("Default: 10, Max: 100"),
            recvWindow: z.number().int().optional().describe("Optional time window for request validity")
        },
        async (params) => {
            try {
                const response = await vipLoanClient.restAPI.queryApplicationStatus({
                    ...(params.current !== undefined && { current: params.current }),
                    ...(params.limit !== undefined && { limit: params.limit }),
                    ...(params.recvWindow !== undefined && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully retrieved status of their loan applications. Response: ${JSON.stringify(
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
                            text: `Failed to retrieve status of their loan applications.. ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
