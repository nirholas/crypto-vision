/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/modules/copy-trading/FutureCopyTrading-api/getTraderPositions.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { copyTradingClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceGetTraderPositions(server: McpServer) {
    server.tool(
        "BinanceCopyTradingGetTraderPositions",
        "View a lead trader's current open positions. See what positions they are holding to understand their strategy.",
        {
            leadPortfolioId: z.string().describe("Lead trader's portfolio ID"),
            tradeType: z.enum(["PERPETUAL"]).optional().describe("Trade type"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await copyTradingClient.restAPI.getTraderPositions({
                    leadPortfolioId: params.leadPortfolioId,
                    ...(params.tradeType && { tradeType: params.tradeType }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [{
                        type: "text",
                        text: `📈 Trader Positions\n\nPortfolio: ${params.leadPortfolioId}\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to get trader positions: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
