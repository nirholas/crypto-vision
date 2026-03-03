/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/modules/options/userdata-api/deleteListenKey.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { optionsClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerOptionsDeleteListenKey(server: McpServer) {
    server.tool(
        "BinanceOptionsDeleteListenKey",
        "Close/delete an options listen key. This will terminate the user data stream connection.",
        {
            listenKey: z.string().optional().describe("Listen key to delete. If not provided, deletes the current active key")
        },
        async (params) => {
            try {
                const response = await optionsClient.restAPI.deleteListenKey({
                    ...(params.listenKey && { listenKey: params.listenKey })
                });
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `✅ Options Listen Key Deleted\n\nThe listen key has been invalidated and the user data stream will be closed.\n\nResponse: ${JSON.stringify(data)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to delete options listen key: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
