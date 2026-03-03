/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-futures-usdm/market-api/time.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { futuresClient } from "../../../config/binanceClient.js";

export function registerBinanceFuturesTime(server: McpServer) {
    server.tool(
        "BinanceFuturesTime",
        "Get current USD-M Futures server time.",
        {},
        async () => {
            try {
                const response = await futuresClient.restAPI.time();
                const data = await response.data();
                return {
                    content: [{
                        type: "text",
                        text: `Futures server time: ${JSON.stringify(data)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get server time: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
