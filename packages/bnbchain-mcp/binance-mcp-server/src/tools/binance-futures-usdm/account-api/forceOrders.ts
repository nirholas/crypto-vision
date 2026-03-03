/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-futures-usdm/account-api/forceOrders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { futuresClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceFuturesForceOrders(server: McpServer) {
    server.tool(
        "BinanceFuturesForceOrders",
        "Get user's force orders (liquidation orders) for USD-M Futures.",
        {
            symbol: z.string().optional().describe("Futures symbol"),
            autoCloseType: z.enum(["LIQUIDATION", "ADL"]).optional().describe("Type of force order"),
            startTime: z.number().int().optional().describe("Start timestamp in ms"),
            endTime: z.number().int().optional().describe("End timestamp in ms"),
            limit: z.number().int().optional().describe("Number of results. Default 50, max 100"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const response = await futuresClient.restAPI.forceOrders({
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
                        text: `Force Orders: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get force orders: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
