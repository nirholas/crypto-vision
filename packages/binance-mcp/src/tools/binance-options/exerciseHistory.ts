// src/tools/binance-options/exerciseHistory.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { optionsClient } from "../../config/binanceClient.js";

export function registerBinanceOptionsExerciseHistory(server: McpServer) {
    server.tool(
        "BinanceOptionsExerciseHistory",
        "Get historical exercise records for options.",
        {
            underlying: z.string().optional().describe("Underlying asset (e.g., BTCUSDT)"),
            startTime: z.number().optional().describe("Start time in milliseconds"),
            endTime: z.number().optional().describe("End time in milliseconds"),
            limit: z.number().optional().describe("Number of records to return. Default 100; max 100.")
        },
        async ({ underlying, startTime, endTime, limit }) => {
            try {
                const params: any = {};
                if (underlying) params.underlying = underlying;
                if (startTime !== undefined) params.startTime = startTime;
                if (endTime !== undefined) params.endTime = endTime;
                if (limit !== undefined) params.limit = limit;
                
                const data = await optionsClient.exerciseHistory(params);
                
                return {
                    content: [
                        {
                            type: "text",
                            text: `Exercise history retrieved. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to get exercise history: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
