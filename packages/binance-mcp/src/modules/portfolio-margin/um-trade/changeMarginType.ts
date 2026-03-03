/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/modules/portfolio-margin/um-trade/changeMarginType.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { portfolioMarginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerPortfolioMarginUmChangeMarginType(server: McpServer) {
    server.tool(
        "BinancePortfolioMarginUmChangeMarginType",
        "Change margin type (ISOLATED/CROSSED) for a USDT-M Futures symbol in Portfolio Margin mode.",
        {
            symbol: z.string().describe("Trading pair symbol (e.g., 'BTCUSDT')"),
            marginType: z.enum(["ISOLATED", "CROSSED"]).describe("Margin type"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await portfolioMarginClient.restAPI.umMarginType({
                    symbol: params.symbol,
                    marginType: params.marginType,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `✅ Portfolio Margin UM Margin Type Changed!\n\nSymbol: ${params.symbol}\nNew Margin Type: ${params.marginType}\n\nResponse: ${JSON.stringify(data)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to change Portfolio Margin UM margin type: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
