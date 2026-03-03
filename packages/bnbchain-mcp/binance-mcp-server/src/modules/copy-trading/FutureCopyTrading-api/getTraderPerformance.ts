/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/copy-trading/FutureCopyTrading-api/getTraderPerformance.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { copyTradingClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceGetTraderPerformance(server: McpServer) {
    server.tool(
        "BinanceCopyTradingGetTraderPerformance",
        "Get detailed performance statistics for a lead trader. Includes ROI, PNL, win rate, and other metrics.",
        {
            leadPortfolioId: z.string().describe("Lead trader's portfolio ID"),
            tradeType: z.enum(["PERPETUAL"]).optional().describe("Trade type"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await copyTradingClient.restAPI.getTraderPerformance({
                    leadPortfolioId: params.leadPortfolioId,
                    ...(params.tradeType && { tradeType: params.tradeType }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [{
                        type: "text",
                        text: `📊 Trader Performance\n\nPortfolio: ${params.leadPortfolioId}\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to get trader performance: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
