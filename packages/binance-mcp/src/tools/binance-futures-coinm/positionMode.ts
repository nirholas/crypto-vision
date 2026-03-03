// src/tools/binance-futures-coinm/positionMode.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { deliveryClient } from "../../config/binanceClient.js";

export function registerBinanceFuturesCOINMPositionMode(server: McpServer) {
    server.tool(
        "BinanceFuturesCOINMPositionMode",
        "Change position mode for COIN-M Futures (One-way or Hedge Mode).",
        {
            dualSidePosition: z.boolean().describe("true: Hedge Mode, false: One-way Mode")
        },
        async ({ dualSidePosition }) => {
            try {
                const data = await deliveryClient.positionSideDual({ dualSidePosition: dualSidePosition ? "true" : "false" });
                

                return {
                    content: [
                        {
                            type: "text",
                            text: `COIN-M Futures position mode changed to ${dualSidePosition ? 'Hedge Mode' : 'One-way Mode'}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to change COIN-M Futures position mode: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
