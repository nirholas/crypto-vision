/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/portfolio-margin/userdata/renewListenKey.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { portfolioMarginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerPortfolioMarginRenewListenKey(server: McpServer) {
    server.tool(
        "BinancePortfolioMarginRenewListenKey",
        "Extend the validity of a Portfolio Margin listen key by 60 minutes.",
        {
            listenKey: z.string().optional().describe("Listen key to renew")
        },
        async (params) => {
            try {
                const response = await portfolioMarginClient.restAPI.renewListenKey({
                    ...(params.listenKey && { listenKey: params.listenKey })
                });
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `✅ Portfolio Margin Listen Key Renewed\n\nThe listen key validity has been extended by 60 minutes.\n\nResponse: ${JSON.stringify(data)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to renew Portfolio Margin listen key: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
