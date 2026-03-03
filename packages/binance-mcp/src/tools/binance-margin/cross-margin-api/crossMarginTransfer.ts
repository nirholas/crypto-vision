// src/tools/binance-margin/cross-margin-api/crossMarginTransfer.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { marginClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCrossMarginTransfer(server: McpServer) {
    server.tool(
        "BinanceCrossMarginTransfer",
        "Execute a cross margin account transfer. Transfer between spot and cross margin accounts.",
        {
            asset: z.string().describe("Asset to transfer (e.g., BTC, USDT)"),
            amount: z.string().describe("Amount to transfer"),
            type: z.enum(["1", "2"]).describe("1: Spot to Margin, 2: Margin to Spot"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const data = await marginClient.transfer({
                    asset: params.asset,
                    amount: params.amount,
                    type: parseInt(params.type),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                return {
                    content: [{
                        type: "text",
                        text: `Successfully transferred ${params.amount} ${params.asset}. Response: ${JSON.stringify(data)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to transfer: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
