/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-futures-coinm/market-api/premiumIndex.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { deliveryClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceDeliveryPremiumIndex(server: McpServer) {
    server.tool(
        "BinanceDeliveryPremiumIndex",
        "Get mark price and funding rate for COIN-M Futures contracts.",
        {
            symbol: z.string().optional().describe("Contract symbol (e.g., BTCUSD_PERP). If not provided, returns all symbols")
        },
        async (params) => {
            try {
                const response = await deliveryClient.restAPI.premiumIndex({
                    ...(params.symbol && { symbol: params.symbol })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `💰 Premium Index${params.symbol ? ` for ${params.symbol}` : ''}\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to get premium index: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
