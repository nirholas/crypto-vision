// src/tools/binance-options/bill.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { optionsClient } from "../../config/binanceClient.js";

export function registerBinanceOptionsBill(server: McpServer) {
    server.tool(
        "BinanceOptionsBill",
        "Get options account funding flow (bill history).",
        {
            currency: z.string().optional().describe("Currency (e.g., USDT)"),
            recordId: z.number().optional().describe("Record ID to fetch from"),
            startTime: z.number().optional().describe("Start time in milliseconds"),
            endTime: z.number().optional().describe("End time in milliseconds"),
            limit: z.number().optional().describe("Number of records to return. Default 100; max 1000.")
        },
        async ({ currency, recordId, startTime, endTime, limit }) => {
            try {
                const params: any = {};
                if (currency) params.currency = currency;
                if (recordId !== undefined) params.recordId = recordId;
                if (startTime !== undefined) params.startTime = startTime;
                if (endTime !== undefined) params.endTime = endTime;
                if (limit !== undefined) params.limit = limit;
                
                const data = await optionsClient.bill(params);
                
                return {
                    content: [
                        {
                            type: "text",
                            text: `Bill history retrieved. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to get bill history: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
