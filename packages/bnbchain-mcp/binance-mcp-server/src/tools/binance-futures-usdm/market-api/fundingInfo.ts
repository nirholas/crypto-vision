/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-futures-usdm/market-api/fundingInfo.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { futuresClient } from "../../../config/binanceClient.js";

export function registerBinanceFuturesFundingInfo(server: McpServer) {
    server.tool(
        "BinanceFuturesFundingInfo",
        "Get funding rate info for all perpetual symbols on USD-M Futures.",
        {},
        async () => {
            try {
                const response = await futuresClient.restAPI.fundingInfo();
                const data = await response.data();
                return {
                    content: [{
                        type: "text",
                        text: `Funding Info: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get funding info: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
