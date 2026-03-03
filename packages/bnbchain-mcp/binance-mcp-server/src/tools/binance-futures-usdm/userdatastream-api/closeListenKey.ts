/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-futures-usdm/userdatastream-api/closeListenKey.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { futuresClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceFuturesCloseListenKey(server: McpServer) {
    server.tool(
        "BinanceFuturesCloseListenKey",
        "Close a USD-M Futures user data stream listen key. This invalidates the listen key and closes the associated WebSocket stream.",
        {
            listenKey: z.string().optional().describe("Listen key to close. If not provided, closes the default listen key."),
            recvWindow: z.number().int().optional().describe("Recv window in milliseconds")
        },
        async (params) => {
            try {
                const response = await futuresClient.restAPI.closeListenKey({
                    ...(params.listenKey && { listenKey: params.listenKey }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `✅ Listen Key Closed!\n\nThe listen key has been invalidated and the stream is closed.\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to close listen key: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
