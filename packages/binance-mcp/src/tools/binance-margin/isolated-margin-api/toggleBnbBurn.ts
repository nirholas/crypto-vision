// src/tools/binance-margin/isolated-margin-api/toggleBnbBurn.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { marginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceToggleBnbBurn(server: McpServer) {
    server.tool(
        "BinanceToggleBnbBurn",
        "Toggle BNB burn on spot trade and margin interest. When enabled, uses BNB to pay for trading fees and margin interest at a discount.",
        {
            spotBNBBurn: z.enum(["true", "false"]).optional().describe("Enable/disable BNB burn for spot trading fees"),
            interestBNBBurn: z.enum(["true", "false"]).optional().describe("Enable/disable BNB burn for margin interest"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const data = await marginClient.getAccount({
                    ...(params.spotBNBBurn && { spotBNBBurn: params.spotBNBBurn }),
                    ...(params.interestBNBBurn && { interestBNBBurn: params.interestBNBBurn }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                return {
                    content: [{
                        type: "text",
                        text: `BNB Burn settings updated: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to toggle BNB burn: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
