/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/options/market-api/exerciseHistory.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { optionsClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerOptionsMarketExerciseHistory(server: McpServer) {
    server.tool(
        "BinanceOptionsExerciseHistory",
        "Get the exercise history for options contracts. Shows historical exercise records and settlement prices.",
        {
            underlying: z.string().optional()
                .describe("Underlying asset (e.g., 'BTCUSDT')"),
            startTime: z.number().int().optional()
                .describe("Start time in milliseconds"),
            endTime: z.number().int().optional()
                .describe("End time in milliseconds"),
            limit: z.number().int().min(1).max(100).optional()
                .describe("Number of records to return (default 100, max 100)")
        },
        async (params) => {
            try {
                const response = await optionsClient.restAPI.exerciseHistory({
                    ...(params.underlying && { underlying: params.underlying }),
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.limit && { limit: params.limit })
                });
                
                const data = await response.data();
                
                let result = `✅ Options Exercise History\n\n`;
                
                if (Array.isArray(data) && data.length > 0) {
                    result += `Total records: ${data.length}\n\n`;
                    data.forEach((record: any) => {
                        const exerciseTime = new Date(record.expiryDate).toISOString();
                        result += `**${record.symbol}**\n`;
                        result += `  Strike Price: ${record.strikePrice}\n`;
                        result += `  Real Strike Price: ${record.realStrikePrice}\n`;
                        result += `  Exercise Price: ${record.exercisePrice}\n`;
                        result += `  Expiry Date: ${exerciseTime}\n\n`;
                    });
                } else {
                    result += `No exercise history found`;
                }
                
                return {
                    content: [{
                        type: "text",
                        text: result
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to get Options exercise history: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
