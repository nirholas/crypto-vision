/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-futures-usdm/trade-api/countdownCancelAll.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { futuresClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceFuturesCountdownCancelAll(server: McpServer) {
    server.tool(
        "BinanceFuturesCountdownCancelAll",
        "Set auto-cancel all open orders after countdown. Use as dead man's switch for protection. ⚠️ System will cancel orders automatically if no heartbeat received.",
        {
            symbol: z.string().describe("Futures symbol (e.g., BTCUSDT)"),
            countdownTime: z.number().int().describe("Countdown time in milliseconds. 0 to cancel the countdown."),
            recvWindow: z.number().int().optional().describe("Recv window in milliseconds")
        },
        async (params) => {
            try {
                const response = await futuresClient.restAPI.autoCancelAllOpenOrders({
                    symbol: params.symbol,
                    countdownTime: params.countdownTime,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                const message = params.countdownTime === 0 
                    ? `✅ Countdown cancelled for ${params.symbol}`
                    : `✅ Countdown set for ${params.symbol}\nOrders will be cancelled in ${params.countdownTime}ms if no heartbeat received`;
                
                return {
                    content: [{
                        type: "text",
                        text: `${message}\n\n${JSON.stringify(data, null, 2)}`
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
