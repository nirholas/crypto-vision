// src/tools/binance-auto-invest/getIndexLinkedPlanPositionList.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { autoInvestClient } from "../../config/binanceClient.js";

export function registerBinanceAutoInvestGetIndexLinkedPlanPositionList(server: McpServer) {
    server.tool(
        "BinanceAutoInvestGetIndexLinkedPlanPositionList",
        "Query index linked plan position details for auto-invest.",
        {
            indexId: z.number().describe("Index ID")
        },
        async ({ indexId }) => {
            try {
                const params: any = { indexId };
                
                const response = await autoInvestClient.restAPI.queryIndexLinkedPlanPositionDetails(params);
                const data = await response.data();
                return {
                    content: [
                        {
                            type: "text",
                            text: `Index linked plan position list retrieved. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to get index linked plan position list: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
