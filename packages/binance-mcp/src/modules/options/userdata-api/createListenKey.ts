/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/modules/options/userdata-api/createListenKey.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { optionsClient } from "../../../config/binanceClient.js";

export function registerOptionsCreateListenKey(server: McpServer) {
    server.tool(
        "BinanceOptionsCreateListenKey",
        "Create a listen key for options user data stream. The listen key is used to subscribe to account updates via WebSocket.",
        {},
        async () => {
            try {
                const response = await optionsClient.restAPI.createListenKey();
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `✅ Options Listen Key Created\n\nListen Key: ${data.listenKey}\n\n**Note**: This listen key is valid for 60 minutes. Use BinanceOptionsRenewListenKey to extend validity. Use this key to connect to the WebSocket user data stream.`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to create options listen key: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
