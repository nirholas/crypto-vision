/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-auto-invest/changeIndexPlanStatus.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { autoInvestClient } from "../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceAutoInvestChangeIndexPlanStatus(server: McpServer) {
    server.tool(
        "BinanceAutoInvestChangeIndexPlanStatus",
        "Change the status of an index-linked auto-invest plan (pause/resume).",
        {
            indexId: z.number().int().describe("Index ID"),
            status: z.enum(["PAUSED", "ONGOING"]).describe("New plan status"),
            recvWindow: z.number().int().optional().describe("Recv window in milliseconds")
        },
        async (params) => {
            try {
                const response = await autoInvestClient.restAPI.changeIndexPlanStatus({
                    indexId: params.indexId,
                    status: params.status,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                const data = await response.data();
                return {
                    content: [{
                        type: "text",
                        text: `✅ Index plan status changed to ${params.status}\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to change index plan status: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
