/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-spot/userdatastream-api/newUserDataStream.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { spotClient } from "../../../config/binanceClient.js";

export function registerBinanceNewUserDataStream(server: McpServer) {
    server.tool(
        "BinanceNewUserDataStream",
        "Create a new user data stream to receive account updates via WebSocket.",
        {},
        async () => {
            try {
                const response = await spotClient.restAPI.newUserDataStream();

                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Created new listen key for user data stream. Listen key: ${data.listenKey}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to create user data stream: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
