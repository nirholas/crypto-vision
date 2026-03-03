/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-futures-coinm/account-api/forceOrders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { deliveryClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceDeliveryForceOrders(server: McpServer) {
    server.tool(
        "BinanceDeliveryForceOrders",
        "Get user's COIN-M Futures force (liquidation) order history.",
        {
            symbol: z.string().optional().describe("Contract symbol filter"),
            autoCloseType: z.enum(["LIQUIDATION", "ADL"]).optional().describe("LIQUIDATION or ADL"),
            startTime: z.number().int().optional().describe("Start timestamp in milliseconds"),
            endTime: z.number().int().optional().describe("End timestamp in milliseconds"),
            limit: z.number().int().optional().describe("Number of results (default 50, max 100)"),
            recvWindow: z.number().int().optional().describe("Recv window in milliseconds")
        },
        async (params) => {
            try {
                const response = await deliveryClient.restAPI.forceOrders({
                    ...(params.symbol && { symbol: params.symbol }),
                    ...(params.autoCloseType && { autoCloseType: params.autoCloseType }),
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.limit && { limit: params.limit }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `⚠️ COIN-M Force Orders (Liquidations)\n\nOrders: ${Array.isArray(data) ? data.length : 0}\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to get force orders: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
