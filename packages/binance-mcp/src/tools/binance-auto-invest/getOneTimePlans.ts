// src/tools/binance-auto-invest/getOneTimePlans.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { autoInvestClient } from "../../config/binanceClient.js";

export function registerBinanceAutoInvestGetOneTimePlans(server: McpServer) {
    server.tool(
        "BinanceAutoInvestGetOneTimePlans",
        "Query holding details of the plan.",
        {
            planId: z.number().describe("Plan ID"),
            requestId: z.string().optional().describe("Request ID")
        },
        async ({ planId, requestId }) => {
            try {
                const params: any = { planId };
                if (requestId) params.requestId = requestId;
                
                const response = await autoInvestClient.restAPI.queryOneTimeTransactionStatus(params);
                const data = await response.data();
                return {
                    content: [
                        {
                            type: "text",
                            text: `Plan details retrieved. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to get plan details: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
