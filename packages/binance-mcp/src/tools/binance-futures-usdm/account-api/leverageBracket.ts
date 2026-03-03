/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-futures-usdm/account-api/leverageBracket.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { futuresClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceFuturesLeverageBracket(server: McpServer) {
    server.tool(
        "BinanceFuturesLeverageBracket",
        "Get notional and leverage brackets for USD-M Futures symbols.",
        {
            symbol: z.string().optional().describe("Futures symbol. If omitted, returns all"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const response = await futuresClient.restAPI.leverageBracket({
                    ...(params.symbol && { symbol: params.symbol }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                const data = await response.data();
                return {
                    content: [{
                        type: "text",
                        text: `Leverage Brackets: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get leverage brackets: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
