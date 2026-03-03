/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-spot/userdatastream-api/putUserDataStream.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { spotClient } from "../../../config/binanceClient.js";

export function registerBinancePutUserDataStream(server: McpServer) {
    server.tool(
        "BinancePutUserDataStream",
        "Extend the validity of a user data stream listen key.",
        {
            listenKey: z.string().describe("Listen key to keep alive")
        },
        async ({ listenKey }) => {
            try {
                const response = await spotClient.restAPI.putUserDataStream({
                    listenKey: listenKey
                });

                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully extended validity of listen key: ${listenKey}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to extend listen key validity: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
