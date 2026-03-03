/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-futures-coinm/userdatastream-api/keepAliveListenKey.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { deliveryClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceDeliveryKeepAliveListenKey(server: McpServer) {
    server.tool(
        "BinanceDeliveryKeepAliveListenKey",
        "Keep alive a COIN-M Futures user data stream listen key. Extends validity by 60 minutes. Should be called at least every 60 minutes to prevent timeout.",
        {
            listenKey: z.string().optional().describe("Listen key to keep alive"),
            recvWindow: z.number().int().optional().describe("Recv window in milliseconds")
        },
        async (params) => {
            try {
                const response = await deliveryClient.restAPI.renewListenKey({
                    ...(params.listenKey && { listenKey: params.listenKey }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `✅ Listen Key Extended!\n\nYour COIN-M Futures listen key has been renewed for another 60 minutes.`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to extend listen key: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
