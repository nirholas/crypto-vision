/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-futures-coinm/trade-api/changeLeverage.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { deliveryClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceDeliveryChangeLeverage(server: McpServer) {
    server.tool(
        "BinanceDeliveryChangeLeverage",
        "Change initial leverage for a COIN-M Futures symbol. ⚠️ Higher leverage = higher risk.",
        {
            symbol: z.string().describe("Contract symbol (e.g., BTCUSD_PERP)"),
            leverage: z.number().int().min(1).max(125).describe("Target leverage (1-125)"),
            recvWindow: z.number().int().optional().describe("Recv window in milliseconds")
        },
        async (params) => {
            try {
                const response = await deliveryClient.restAPI.changeInitialLeverage({
                    symbol: params.symbol,
                    leverage: params.leverage,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `✅ Leverage changed!\n\nSymbol: ${data.symbol}\nNew Leverage: ${data.leverage}x\nMax Notional: ${data.maxQty}\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to change leverage: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
