// src/tools/binance-spot/userdatastream-api/deleteUserDataStream.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { spotClient } from "../../../config/binanceClient.js";

export function registerBinanceDeleteUserDataStream(server: McpServer) {
    server.tool(
        "BinanceDeleteUserDataStream",
        "Close a user data stream by invalidating the listen key.",
        {
            listenKey: z.string().describe("Listen key to close")
        },
        async ({ listenKey }) => {
            try {
                const response = await spotClient.restAPI.deleteUserDataStream({
                    listenKey: listenKey
                });

                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully closed user data stream with listen key: ${listenKey}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to close user data stream: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
