/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-auto-invest/getIndexLinkedPlanPositionDetails.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { autoInvestClient } from "../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceAutoInvestGetIndexLinkedPlanPositionDetails(server: McpServer) {
    server.tool(
        "BinanceAutoInvestGetIndexLinkedPlanPositionDetails",
        "Get position details for an index-linked auto-invest plan.",
        {
            indexId: z.number().int().describe("Index ID"),
            recvWindow: z.number().int().optional().describe("Recv window in milliseconds")
        },
        async (params) => {
            try {
                const response = await autoInvestClient.restAPI.getIndexLinkedPlanPositionDetails({
                    indexId: params.indexId,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                const data = await response.data();
                return {
                    content: [{
                        type: "text",
                        text: `Index-linked plan position details:\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get position details: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
