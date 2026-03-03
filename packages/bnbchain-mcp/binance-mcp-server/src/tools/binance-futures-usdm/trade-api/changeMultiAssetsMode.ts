/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-futures-usdm/trade-api/changeMultiAssetsMode.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { futuresClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceFuturesChangeMultiAssetsMode(server: McpServer) {
    server.tool(
        "BinanceFuturesChangeMultiAssetsMode",
        "Change Multi-Assets Mode setting. When enabled, margin from multiple assets (USDT, BUSD) can be used to avoid liquidation.",
        {
            multiAssetsMargin: z.boolean().describe("true = Enable Multi-Assets Mode, false = Disable"),
            recvWindow: z.number().int().optional().describe("Recv window in milliseconds")
        },
        async (params) => {
            try {
                const response = await futuresClient.restAPI.changeMultiAssetsMode({
                    multiAssetsMargin: params.multiAssetsMargin,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                const mode = params.multiAssetsMargin ? "Enabled" : "Disabled";
                
                return {
                    content: [{
                        type: "text",
                        text: `✅ Multi-Assets Mode ${mode}!\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to change multi-assets mode: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
