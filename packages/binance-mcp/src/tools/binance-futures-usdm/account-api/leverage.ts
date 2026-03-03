/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-futures-usdm/account-api/leverage.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { futuresClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceFuturesLeverage(server: McpServer) {
    server.tool(
        "BinanceFuturesChangeLeverage",
        "Change initial leverage for a USD-M Futures symbol. ⚠️ Leverage changes affect your liquidation price and margin requirements.",
        {
            symbol: z.string().describe("Futures symbol (e.g., BTCUSDT)"),
            leverage: z.number().int().min(1).max(125).describe("Target leverage (1-125, varies by symbol)"),
            recvWindow: z.number().int().optional().describe("Recv window in milliseconds")
        },
        async (params) => {
            try {
                const response = await futuresClient.restAPI.changeInitialLeverage({
                    symbol: params.symbol,
                    leverage: params.leverage,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                const data = await response.data();
                return {
                    content: [{
                        type: "text",
                        text: `✅ Leverage changed for ${params.symbol}\nNew Leverage: ${data.leverage}x\nMax Notional Value: ${data.maxNotionalValue}\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to change leverage: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
