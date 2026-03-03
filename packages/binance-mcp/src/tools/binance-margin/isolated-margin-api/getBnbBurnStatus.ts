// src/tools/binance-margin/isolated-margin-api/getBnbBurnStatus.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { marginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceGetBnbBurnStatus(server: McpServer) {
    server.tool(
        "BinanceGetBnbBurnStatus",
        "Get current BNB burn status for spot trading fees and margin interest.",
        {
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const data = await marginClient.getAccount({
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                return {
                    content: [{
                        type: "text",
                        text: `BNB Burn Status: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get BNB burn status: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
