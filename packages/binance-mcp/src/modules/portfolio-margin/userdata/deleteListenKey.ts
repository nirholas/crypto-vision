/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/modules/portfolio-margin/userdata/deleteListenKey.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { portfolioMarginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerPortfolioMarginDeleteListenKey(server: McpServer) {
    server.tool(
        "BinancePortfolioMarginDeleteListenKey",
        "Close/delete a Portfolio Margin listen key. This will terminate the user data stream connection.",
        {
            listenKey: z.string().optional().describe("Listen key to delete")
        },
        async (params) => {
            try {
                const response = await portfolioMarginClient.restAPI.deleteListenKey({
                    ...(params.listenKey && { listenKey: params.listenKey })
                });
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `✅ Portfolio Margin Listen Key Deleted\n\nThe listen key has been invalidated.\n\nResponse: ${JSON.stringify(data)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to delete Portfolio Margin listen key: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
