// src/tools/binance-copy-trading/FutureCopyTrading-api/getFuturesLeadTradingSymbolWhitelist.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { copyTradingClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceGetFuturesLeadTradingSymbolWhitelist(server: McpServer) {
    server.tool(
        "BinanceGetFuturesLeadTradingSymbolWhitelist",
        "Whitelist of trading pairs (symbols) that are allowed for Futures Lead Traders in copy trading, including base and quote assets.",
        {
            recvWindow: z.number().int().optional().describe("Optional time window for request validity")
        },
        async (params) => {
            try {
                const response = await copyTradingClient.restAPI.getFuturesLeadTradingSymbolWhitelist({
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully retrieved trading pairs. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Failed to whitelist of trading pairs: ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
