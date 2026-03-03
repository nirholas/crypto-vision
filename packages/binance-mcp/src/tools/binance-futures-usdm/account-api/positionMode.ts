/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-futures-usdm/account-api/positionMode.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { futuresClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceFuturesPositionMode(server: McpServer) {
    server.tool(
        "BinanceFuturesGetPositionMode",
        "Get current position mode (Hedge Mode or One-way Mode) for USD-M Futures.",
        {
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const response = await futuresClient.restAPI.getPositionMode({
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                const data = await response.data();
                return {
                    content: [{
                        type: "text",
                        text: `Position Mode: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get position mode: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
