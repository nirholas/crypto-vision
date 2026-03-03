/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-futures-usdm/trade-api/changePositionMode.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { futuresClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceFuturesChangePositionMode(server: McpServer) {
    server.tool(
        "BinanceFuturesChangePositionMode",
        "Change position mode between Hedge Mode and One-way Mode. HEDGE: Can hold both LONG and SHORT positions simultaneously. ONE-WAY: Only one direction at a time (positionSide=BOTH).",
        {
            dualSidePosition: z.boolean().describe("true = Hedge Mode (Long/Short), false = One-way Mode (BOTH)"),
            recvWindow: z.number().int().optional().describe("Recv window in milliseconds")
        },
        async (params) => {
            try {
                const response = await futuresClient.restAPI.changePositionMode({
                    dualSidePosition: params.dualSidePosition,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                const mode = params.dualSidePosition ? "Hedge Mode (LONG/SHORT)" : "One-way Mode (BOTH)";
                
                return {
                    content: [{
                        type: "text",
                        text: `✅ Position mode changed successfully!\n\nNew Mode: ${mode}\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to change position mode: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
