// src/tools/binance-options/exerciseRecord.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { optionsClient } from "../../config/binanceClient.js";

export function registerBinanceOptionsExerciseRecord(server: McpServer) {
    server.tool(
        "BinanceOptionsExerciseRecord",
        "Get user's options exercise records.",
        {
            symbol: z.string().optional().describe("Option trading symbol (e.g., BTC-240126-42000-C)"),
            startTime: z.number().optional().describe("Start time in milliseconds"),
            endTime: z.number().optional().describe("End time in milliseconds"),
            limit: z.number().optional().describe("Number of records to return. Default 100; max 1000.")
        },
        async ({ symbol, startTime, endTime, limit }) => {
            try {
                const params: any = {};
                if (symbol) params.symbol = symbol;
                if (startTime !== undefined) params.startTime = startTime;
                if (endTime !== undefined) params.endTime = endTime;
                if (limit !== undefined) params.limit = limit;
                
                const data = await optionsClient.exerciseRecord(params);
                
                return {
                    content: [
                        {
                            type: "text",
                            text: `Exercise records retrieved. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to get exercise records: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
