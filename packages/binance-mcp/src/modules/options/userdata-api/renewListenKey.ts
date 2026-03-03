/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/modules/options/userdata-api/renewListenKey.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { optionsClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerOptionsRenewListenKey(server: McpServer) {
    server.tool(
        "BinanceOptionsRenewListenKey",
        "Extend the validity of an options listen key by 60 minutes. Should be called periodically to keep the user data stream active.",
        {
            listenKey: z.string().optional().describe("Listen key to renew. If not provided, renews the current active key")
        },
        async (params) => {
            try {
                const response = await optionsClient.restAPI.renewListenKey({
                    ...(params.listenKey && { listenKey: params.listenKey })
                });
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `✅ Options Listen Key Renewed\n\nThe listen key validity has been extended by 60 minutes.\n\nResponse: ${JSON.stringify(data)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to renew options listen key: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
