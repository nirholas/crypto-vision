// src/tools/binance-futures-usdm/multiAssetsMode.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { futuresClient } from "../../config/binanceClient.js";

export function registerBinanceFuturesUSDMMultiAssetsMode(server: McpServer) {
    server.tool(
        "BinanceFuturesUSDMMultiAssetsMode",
        "Change multi-assets mode for USD-M Futures.",
        {
            multiAssetsMargin: z.boolean().describe("true: Enable multi-assets mode, false: Disable multi-assets mode")
        },
        async ({ multiAssetsMargin }) => {
            try {
                const data = await futuresClient.multiAssetsMargin({ multiAssetsMargin: multiAssetsMargin ? "true" : "false" });
                

                return {
                    content: [
                        {
                            type: "text",
                            text: `USD-M Futures multi-assets mode ${multiAssetsMargin ? 'enabled' : 'disabled'}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to change USD-M Futures multi-assets mode: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
