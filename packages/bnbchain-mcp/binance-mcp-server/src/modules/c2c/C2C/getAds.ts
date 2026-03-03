/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/c2c/C2C/getAds.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { c2cClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceC2CGetAds(server: McpServer) {
    server.tool(
        "BinanceC2CGetAds",
        "Get available C2C/P2P trading advertisements. Browse buy/sell offers from other users.",
        {
            asset: z.string().optional().describe("Filter by crypto asset (e.g., 'BTC', 'USDT')"),
            fiat: z.string().optional().describe("Filter by fiat currency (e.g., 'USD', 'EUR')"),
            tradeType: z.enum(["BUY", "SELL"]).optional().describe("Filter by trade type"),
            page: z.number().int().min(1).default(1).optional().describe("Page number"),
            rows: z.number().int().min(1).max(20).default(10).optional().describe("Number of rows"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await c2cClient.restAPI.getAds({
                    ...(params.asset && { asset: params.asset }),
                    ...(params.fiat && { fiat: params.fiat }),
                    ...(params.tradeType && { tradeType: params.tradeType }),
                    ...(params.page && { page: params.page }),
                    ...(params.rows && { rows: params.rows }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [{
                        type: "text",
                        text: `📋 C2C Advertisements\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to get C2C ads: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
