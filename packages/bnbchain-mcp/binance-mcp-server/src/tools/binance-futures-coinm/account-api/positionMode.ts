/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-futures-coinm/account-api/positionMode.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { deliveryClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceDeliveryPositionMode(server: McpServer) {
    server.tool(
        "BinanceDeliveryPositionMode",
        "Get current COIN-M Futures position mode (Hedge Mode or One-way Mode).",
        {
            recvWindow: z.number().int().optional().describe("Recv window in milliseconds")
        },
        async (params) => {
            try {
                const response = await deliveryClient.restAPI.getPositionMode({
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                const mode = data.dualSidePosition ? "Hedge Mode (LONG/SHORT)" : "One-way Mode (BOTH)";
                
                return {
                    content: [{
                        type: "text",
                        text: `⚙️ COIN-M Position Mode\n\nCurrent Mode: ${mode}\ndualSidePosition: ${data.dualSidePosition}\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to get position mode: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
