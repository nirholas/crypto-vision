/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/portfolio-margin/userdata/createListenKey.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { portfolioMarginClient } from "../../../config/binanceClient.js";

export function registerPortfolioMarginCreateListenKey(server: McpServer) {
    server.tool(
        "BinancePortfolioMarginCreateListenKey",
        "Create a listen key for Portfolio Margin user data stream. The listen key is used to subscribe to account updates via WebSocket.",
        {},
        async () => {
            try {
                const response = await portfolioMarginClient.restAPI.createListenKey();
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `✅ Portfolio Margin Listen Key Created\n\nListen Key: ${data.listenKey}\n\n**Note**: This listen key is valid for 60 minutes. Use BinancePortfolioMarginRenewListenKey to extend validity.`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to create Portfolio Margin listen key: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
