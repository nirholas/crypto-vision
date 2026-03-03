// src/tools/binance-spot/general-api/ping.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { spotClient } from "../../../config/binanceClient.js";

export function registerBinancePing(server: McpServer) {
    server.tool(
        "BinancePing",
        "Test connectivity to the Binance API.",
        {},
        async () => {
            try {
                const response = await spotClient.restAPI.ping();


                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully pinged Binance API. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to ping Binance API: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
