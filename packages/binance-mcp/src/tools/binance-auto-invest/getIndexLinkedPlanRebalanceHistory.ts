// src/tools/binance-auto-invest/getIndexLinkedPlanRebalanceHistory.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { autoInvestClient } from "../../config/binanceClient.js";

export function registerBinanceAutoInvestGetIndexLinkedPlanRebalanceHistory(server: McpServer) {
    server.tool(
        "BinanceAutoInvestGetIndexLinkedPlanRebalanceHistory",
        "Query index linked plan rebalance history for auto-invest.",
        {
            indexId: z.number().describe("Index ID"),
            startTime: z.number().optional().describe("Start time in milliseconds"),
            endTime: z.number().optional().describe("End time in milliseconds"),
            current: z.number().optional().describe("Current page"),
            size: z.number().optional().describe("Page size")
        },
        async ({ indexId, startTime, endTime, current, size }) => {
            try {
                const params: any = { indexId };
                if (startTime !== undefined) params.startTime = startTime;
                if (endTime !== undefined) params.endTime = endTime;
                if (current !== undefined) params.current = current;
                if (size !== undefined) params.size = size;
                
                const response = await autoInvestClient.restAPI.indexLinkedPlanRebalanceDetails(params);
                const data = await response.data();
                return {
                    content: [
                        {
                            type: "text",
                            text: `Index linked plan rebalance history retrieved. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to get index linked plan rebalance history: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
