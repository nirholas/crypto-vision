/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-auto-invest/getIndexInfo.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { autoInvestClient } from "../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceAutoInvestGetIndexInfo(server: McpServer) {
    server.tool(
        "BinanceAutoInvestGetIndexInfo",
        "Get information about auto-invest index portfolios. Index portfolios are pre-built diversified portfolios.",
        {
            indexId: z.number().int().optional().describe("Specific index ID to query"),
            recvWindow: z.number().int().optional().describe("Recv window in milliseconds")
        },
        async (params) => {
            try {
                const response = await autoInvestClient.restAPI.getIndexInfo({
                    ...(params.indexId && { indexId: params.indexId }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                const data = await response.data();
                return {
                    content: [{
                        type: "text",
                        text: `Index portfolio info:\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get index info: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
