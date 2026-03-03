/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-sub-account/assets-api/getFuturesPositionRisk.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { spotClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceSubAccountFuturesPositionRisk(server: McpServer) {
    server.tool(
        "BinanceSubAccountFuturesPositionRisk",
        "Get futures position risk for a sub-account. Shows all open positions with entry price, leverage, unrealized PnL, and liquidation price.",
        {
            email: z.string().email()
                .describe("Sub-account email to query position risk for"),
            futuresType: z.enum(["1", "2"]).optional()
                .describe("Futures type: 1 for USD-M, 2 for COIN-M"),
            recvWindow: z.number().int().optional()
                .describe("Time window for request validity in ms")
        },
        async (params) => {
            try {
                const response = await spotClient.restAPI.getSubAccountFuturesPositionRiskV2({
                    email: params.email,
                    ...(params.futuresType && { futuresType: params.futuresType }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [{
                        type: "text",
                        text: `Sub-Account Futures Position Risk for ${params.email}:\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to get position risk: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
