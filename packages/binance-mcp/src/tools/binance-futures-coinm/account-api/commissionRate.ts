/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-futures-coinm/account-api/commissionRate.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { deliveryClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceDeliveryCommissionRate(server: McpServer) {
    server.tool(
        "BinanceDeliveryCommissionRate",
        "Get user's COIN-M Futures commission rate for a symbol.",
        {
            symbol: z.string().describe("Contract symbol (e.g., BTCUSD_PERP)"),
            recvWindow: z.number().int().optional().describe("Recv window in milliseconds")
        },
        async (params) => {
            try {
                const response = await deliveryClient.restAPI.commissionRate({
                    symbol: params.symbol,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `💰 COIN-M Commission Rate for ${params.symbol}\n\nMaker: ${data.makerCommissionRate}\nTaker: ${data.takerCommissionRate}\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to get commission rate: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
