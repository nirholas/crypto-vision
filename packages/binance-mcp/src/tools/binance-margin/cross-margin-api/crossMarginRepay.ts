// src/tools/binance-margin/cross-margin-api/crossMarginRepay.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { marginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCrossMarginRepay(server: McpServer) {
    server.tool(
        "BinanceCrossMarginRepay",
        "Repay loan for Cross Margin account. Repay the borrowed asset with the specified amount.",
        {
            asset: z.string().describe("Asset to repay (e.g., BTC, USDT)"),
            amount: z.string().describe("Amount to repay"),
            isIsolated: z.enum(["TRUE", "FALSE"]).optional().describe("For isolated margin or not, default FALSE"),
            symbol: z.string().optional().describe("Isolated symbol, required when isIsolated=TRUE"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const data = await marginClient.repay({
                    asset: params.asset,
                    amount: params.amount,
                    ...(params.isIsolated && { isIsolated: params.isIsolated }),
                    ...(params.symbol && { symbol: params.symbol }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                return {
                    content: [{
                        type: "text",
                        text: `Successfully repaid ${params.amount} ${params.asset} in Cross Margin. Response: ${JSON.stringify(data)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to repay: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
