/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-futures-coinm/userdatastream-api/closeListenKey.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { deliveryClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceDeliveryCloseListenKey(server: McpServer) {
    server.tool(
        "BinanceDeliveryCloseListenKey",
        "Close a COIN-M Futures user data stream listen key.",
        {
            listenKey: z.string().optional().describe("Listen key to close"),
            recvWindow: z.number().int().optional().describe("Recv window in milliseconds")
        },
        async (params) => {
            try {
                const response = await deliveryClient.restAPI.closeListenKey({
                    ...(params.listenKey && { listenKey: params.listenKey }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `✅ Listen Key Closed!\n\n${JSON.stringify(data, null, 2)}`
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
