/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-futures-coinm/account-api/adlQuantile.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { deliveryClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceDeliveryAdlQuantile(server: McpServer) {
    server.tool(
        "BinanceDeliveryAdlQuantile",
        "Get ADL (Auto-Deleveraging) quantile estimation for COIN-M Futures positions. Higher values indicate higher priority for deleveraging.",
        {
            symbol: z.string().optional().describe("Contract symbol filter"),
            recvWindow: z.number().int().optional().describe("Recv window in milliseconds")
        },
        async (params) => {
            try {
                const response = await deliveryClient.restAPI.adlQuantile({
                    ...(params.symbol && { symbol: params.symbol }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `⚠️ COIN-M ADL Quantile${params.symbol ? ` for ${params.symbol}` : ''}\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to get ADL quantile: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
