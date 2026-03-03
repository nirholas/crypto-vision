// src/tools/binance-margin/cross-margin-api/crossMarginBorrow.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { marginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCrossMarginBorrow(server: McpServer) {
    server.tool(
        "BinanceCrossMarginBorrow",
        "Borrow assets in Cross Margin account. Apply for a loan with the specified asset and amount.",
        {
            asset: z.string().describe("Asset to borrow (e.g., BTC, USDT)"),
            amount: z.string().describe("Amount to borrow"),
            isIsolated: z.enum(["TRUE", "FALSE"]).optional().describe("For isolated margin or not, default FALSE"),
            symbol: z.string().optional().describe("Isolated symbol, required when isIsolated=TRUE"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const data = await marginClient.borrow({
                    asset: params.asset,
                    amount: params.amount,
                    ...(params.isIsolated && { isIsolated: params.isIsolated }),
                    ...(params.symbol && { symbol: params.symbol }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                return {
                    content: [{
                        type: "text",
                        text: `Successfully borrowed ${params.amount} ${params.asset} in Cross Margin. Response: ${JSON.stringify(data)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to borrow: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
