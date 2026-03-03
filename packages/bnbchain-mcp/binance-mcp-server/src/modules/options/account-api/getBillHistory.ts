/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/options/account-api/getBillHistory.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { optionsClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerOptionsGetBillHistory(server: McpServer) {
    server.tool(
        "BinanceOptionsGetBillHistory",
        "Get options account funding flow (bill history). Shows transfers, fees, PnL, and other account activities.",
        {
            currency: z.string().describe("Currency (e.g., 'USDT')"),
            recordId: z.number().int().optional().describe("Record ID to start from"),
            startTime: z.number().int().optional().describe("Start time in milliseconds"),
            endTime: z.number().int().optional().describe("End time in milliseconds"),
            limit: z.number().int().min(1).max(1000).optional().describe("Number of records to return (default 100, max 1000)"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await optionsClient.restAPI.bill({
                    currency: params.currency,
                    ...(params.recordId && { recordId: params.recordId }),
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.limit && { limit: params.limit }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                let result = `✅ Options Bill History\n\n`;
                
                if (Array.isArray(data) && data.length > 0) {
                    result += `Total records: ${data.length}\n\n`;
                    data.slice(0, 20).forEach((record: any, index: number) => {
                        result += `**${index + 1}. ${record.type}**\n`;
                        result += `  ID: ${record.id}\n`;
                        result += `  Amount: ${record.amount} ${record.currency}\n`;
                        result += `  Balance: ${record.balance}\n`;
                        if (record.symbol) result += `  Symbol: ${record.symbol}\n`;
                        result += `  Time: ${new Date(record.createTime).toISOString()}\n\n`;
                    });
                    if (data.length > 20) {
                        result += `... and ${data.length - 20} more records`;
                    }
                } else {
                    result += `No bill history found`;
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
                        text: `❌ Failed to get options bill history: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
