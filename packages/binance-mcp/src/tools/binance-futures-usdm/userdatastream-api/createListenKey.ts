/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-futures-usdm/userdatastream-api/createListenKey.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { futuresClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceFuturesCreateListenKey(server: McpServer) {
    server.tool(
        "BinanceFuturesCreateListenKey",
        "Create a new USD-M Futures user data stream listen key. The listen key is valid for 60 minutes and can be used to receive account updates via WebSocket. Must be kept alive with keepAlive endpoint.",
        {
            recvWindow: z.number().int().optional().describe("Recv window in milliseconds")
        },
        async (params) => {
            try {
                const response = await futuresClient.restAPI.createListenKey({
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `✅ Listen Key Created Successfully!\n\nListen Key: ${data.listenKey}\n\n⚠️ Important:\n- Valid for 60 minutes\n- Use keepAlive endpoint to extend validity\n- Use this key to connect to futures websocket stream\n\nWebSocket URL: wss://fstream.binance.com/ws/${data.listenKey}`
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
