/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-futures-usdm/account-api/apiTradingStatus.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { futuresClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceFuturesApiTradingStatus(server: McpServer) {
    server.tool(
        "BinanceFuturesApiTradingStatus",
        "Get API trading quantitative rules indicators for USD-M Futures.",
        {
            symbol: z.string().optional().describe("Futures symbol"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const response = await futuresClient.restAPI.apiTradingStatus({
                    ...(params.symbol && { symbol: params.symbol }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                const data = await response.data();
                return {
                    content: [{
                        type: "text",
                        text: `API Trading Status: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get API trading status: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
