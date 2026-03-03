/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/modules/portfolio-margin/um-trade/changeLeverage.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { portfolioMarginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerPortfolioMarginUmChangeLeverage(server: McpServer) {
    server.tool(
        "BinancePortfolioMarginUmChangeLeverage",
        "Change leverage for a USDT-M Futures symbol in Portfolio Margin mode. ⚠️ Higher leverage increases risk.",
        {
            symbol: z.string().describe("Trading pair symbol (e.g., 'BTCUSDT')"),
            leverage: z.number().int().min(1).max(125).describe("Target leverage (1-125)"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await portfolioMarginClient.restAPI.umLeverage({
                    symbol: params.symbol,
                    leverage: params.leverage,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `✅ Portfolio Margin UM Leverage Changed!\n\nSymbol: ${data.symbol}\nNew Leverage: ${data.leverage}x\nMax Notional Value: ${data.maxNotionalValue}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to change Portfolio Margin UM leverage: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
