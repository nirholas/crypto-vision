// src/tools/binance-options/openInterest.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { optionsClient } from "../../config/binanceClient.js";

export function registerBinanceOptionsOpenInterest(server: McpServer) {
    server.tool(
        "BinanceOptionsOpenInterest",
        "Get open interest for an option symbol.",
        {
            underlyingAsset: z.string().describe("Underlying asset (e.g., BTC)"),
            expiration: z.string().describe("Expiration date (e.g., 240126)")
        },
        async ({ underlyingAsset, expiration }) => {
            try {
                const params: any = { underlyingAsset, expiration };
                
                const data = await optionsClient.openInterest(params);
                
                return {
                    content: [
                        {
                            type: "text",
                            text: `Open interest retrieved. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to get open interest: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
