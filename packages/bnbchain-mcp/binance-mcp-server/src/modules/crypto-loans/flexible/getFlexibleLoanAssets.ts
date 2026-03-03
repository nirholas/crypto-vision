/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/crypto-loans/flexible/getFlexibleLoanAssets.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { cryptoLoanClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerFlexibleLoanAssets(server: McpServer) {
    server.tool(
        "BinanceCryptoLoanFlexibleAssets",
        "Get available assets for flexible crypto loans. Shows which assets you can borrow and their rates.",
        {
            loanCoin: z.string().optional().describe("Filter by loan coin (e.g., 'USDT', 'BUSD')"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await cryptoLoanClient.restAPI.getFlexibleLoanAssets({
                    ...(params.loanCoin && { loanCoin: params.loanCoin }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [{
                        type: "text",
                        text: `💰 Flexible Loan Assets\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to get flexible loan assets: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
