// src/tools/binance-options/listenKey.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { optionsClient } from "../../config/binanceClient.js";

export function registerBinanceOptionsCreateListenKey(server: McpServer) {
    server.tool(
        "BinanceOptionsCreateListenKey",
        "Create a new listen key for options user data stream.",
        {},
        async () => {
            try {
                const data = await optionsClient.createListenKey();
                
                return {
                    content: [
                        {
                            type: "text",
                            text: `Listen key created successfully. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to create listen key: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}

export function registerBinanceOptionsKeepAliveListenKey(server: McpServer) {
    server.tool(
        "BinanceOptionsKeepAliveListenKey",
        "Keep alive an existing listen key for options user data stream.",
        {
            listenKey: z.string().describe("The listen key to keep alive")
        },
        async ({ listenKey }) => {
            try {
                const data = await optionsClient.keepAliveListenKey();
                
                return {
                    content: [
                        {
                            type: "text",
                            text: `Listen key renewed successfully. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to renew listen key: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}

export function registerBinanceOptionsDeleteListenKey(server: McpServer) {
    server.tool(
        "BinanceOptionsDeleteListenKey",
        "Delete an existing listen key for options user data stream.",
        {
            listenKey: z.string().describe("The listen key to delete")
        },
        async ({ listenKey }) => {
            try {
                const data = await optionsClient.closeListenKey();
                
                return {
                    content: [
                        {
                            type: "text",
                            text: `Listen key deleted successfully. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to delete listen key: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
