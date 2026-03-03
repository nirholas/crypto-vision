/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-futures-usdm/userdatastream-api/keepAliveListenKey.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { futuresClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceFuturesKeepAliveListenKey(server: McpServer) {
    server.tool(
        "BinanceFuturesKeepAliveListenKey",
        "Keepalive a USD-M Futures user data stream listen key. Extends the validity by 60 minutes. Should be called every 30-50 minutes to maintain the connection.",
        {
            listenKey: z.string().optional().describe("Listen key to keep alive. If not provided, uses the default listen key."),
            recvWindow: z.number().int().optional().describe("Recv window in milliseconds")
        },
        async (params) => {
            try {
                const response = await futuresClient.restAPI.renewListenKey({
                    ...(params.listenKey && { listenKey: params.listenKey }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `✅ Listen Key Extended!\n\nThe listen key validity has been extended by 60 minutes.\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to keepalive listen key: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
