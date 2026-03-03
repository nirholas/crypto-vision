/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-futures-coinm/trade-api/countdownCancelAll.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { deliveryClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceDeliveryCountdownCancelAll(server: McpServer) {
    server.tool(
        "BinanceDeliveryCountdownCancelAll",
        "Set countdown timer to cancel all COIN-M orders. Dead man's switch. Set to 0 to cancel.",
        {
            symbol: z.string().describe("Contract symbol (e.g., BTCUSD_PERP)"),
            countdownTime: z.number().int().describe("Countdown in milliseconds. 0 to cancel. Min 10000"),
            recvWindow: z.number().int().optional().describe("Recv window in milliseconds")
        },
        async (params) => {
            try {
                const response = await deliveryClient.restAPI.autoCancelAllOpenOrders({
                    symbol: params.symbol,
                    countdownTime: params.countdownTime,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: params.countdownTime === 0 
                            ? `✅ Countdown cancelled!\n\n${JSON.stringify(data, null, 2)}`
                            : `⏱️ Countdown set! Orders will cancel in ${params.countdownTime / 1000}s\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to set countdown: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
