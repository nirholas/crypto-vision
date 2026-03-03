/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-sub-account/transfer-api/transferToMaster.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { spotClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceSubAccountTransferToMaster(server: McpServer) {
    server.tool(
        "BinanceSubAccountTransferToMaster",
        "Transfer assets from a sub-account back to the master account.",
        {
            asset: z.string()
                .describe("Asset to transfer (e.g., 'BTC', 'USDT')"),
            amount: z.number().positive()
                .describe("Amount to transfer"),
            recvWindow: z.number().int().optional()
                .describe("Time window for request validity in ms")
        },
        async (params) => {
            try {
                const response = await spotClient.restAPI.subAccountTransferSubToMaster({
                    asset: params.asset,
                    amount: params.amount,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [{
                        type: "text",
                        text: `✅ Transfer to master successful!\n\nAsset: ${params.asset}\nAmount: ${params.amount}\n\nTransaction: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to transfer to master: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
