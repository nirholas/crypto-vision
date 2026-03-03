/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-futures-coinm/userdatastream-api/createListenKey.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { deliveryClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceDeliveryCreateListenKey(server: McpServer) {
    server.tool(
        "BinanceDeliveryCreateListenKey",
        "Create a new COIN-M Futures user data stream listen key. The listen key is valid for 60 minutes and can be used to receive account updates via WebSocket.",
        {
            recvWindow: z.number().int().optional().describe("Recv window in milliseconds")
        },
        async (params) => {
            try {
                const response = await deliveryClient.restAPI.createListenKey({
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `✅ COIN-M Listen Key Created!\n\nListen Key: ${data.listenKey}\n\n⚠️ Important:\n- Valid for 60 minutes\n- Use keepAlive endpoint to extend validity\n\nWebSocket URL: wss://dstream.binance.com/ws/${data.listenKey}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to create listen key: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
