// src/tools/binance-futures-usdm/positionMode.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { futuresClient } from "../../config/binanceClient.js";

export function registerBinanceFuturesUSDMPositionMode(server: McpServer) {
    server.tool(
        "BinanceFuturesUSDMPositionMode",
        "Change position mode for USD-M Futures (One-way or Hedge Mode).",
        {
            dualSidePosition: z.boolean().describe("true: Hedge Mode, false: One-way Mode")
        },
        async ({ dualSidePosition }) => {
            try {
                const data = await futuresClient.changePositionMode({ dualSidePosition: dualSidePosition ? "true" : "false" });
                

                return {
                    content: [
                        {
                            type: "text",
                            text: `USD-M Futures position mode changed to ${dualSidePosition ? 'Hedge Mode' : 'One-way Mode'}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to change USD-M Futures position mode: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
