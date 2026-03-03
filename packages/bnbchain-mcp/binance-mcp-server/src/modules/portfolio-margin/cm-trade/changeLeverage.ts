/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/portfolio-margin/cm-trade/changeLeverage.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { portfolioMarginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerPortfolioMarginCmChangeLeverage(server: McpServer) {
    server.tool(
        "BinancePortfolioMarginCmChangeLeverage",
        "Change leverage for a COIN-M Futures symbol in Portfolio Margin mode. ⚠️ Higher leverage increases risk.",
        {
            symbol: z.string().describe("Trading pair symbol (e.g., 'BTCUSD_PERP')"),
            leverage: z.number().int().min(1).max(125).describe("Target leverage (1-125)"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await portfolioMarginClient.restAPI.cmLeverage({
                    symbol: params.symbol,
                    leverage: params.leverage,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `✅ Portfolio Margin CM Leverage Changed!\n\nSymbol: ${data.symbol}\nNew Leverage: ${data.leverage}x\nMax Qty: ${data.maxQty}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to change Portfolio Margin CM leverage: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
