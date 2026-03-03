/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/modules/options/trade-api/cancelBySymbol.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { optionsClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerOptionsCancelBySymbol(server: McpServer) {
    server.tool(
        "BinanceOptionsCancelByUnderlying",
        "Cancel all open options orders for all contracts of an underlying asset (e.g., all BTC options). ⚠️ This will cancel ALL open orders for the underlying.",
        {
            underlying: z.string().describe("Underlying asset (e.g., 'BTCUSDT')"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await optionsClient.restAPI.cancelAllOpenOrdersByUnderlying({
                    underlying: params.underlying,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `✅ All open orders cancelled for underlying ${params.underlying}\n\nResponse: ${JSON.stringify(data)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to cancel orders by underlying: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
