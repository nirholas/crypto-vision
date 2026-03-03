// src/tools/binance-futures-coinm/account.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { deliveryClient } from "../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceFuturesCOINMAccount(server: McpServer) {
    server.tool(
        "BinanceFuturesCOINMAccount",
        "Get current COIN-M futures account information.",
        {
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const data = await deliveryClient.getAccount({
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                return {
                    content: [{ type: "text", text: `COIN-M account info: ${JSON.stringify(data)}` }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get COIN-M account: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
