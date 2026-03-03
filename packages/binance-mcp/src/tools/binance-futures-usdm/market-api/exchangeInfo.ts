/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-futures-usdm/market-api/exchangeInfo.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { futuresClient } from "../../../config/binanceClient.js";

export function registerBinanceFuturesExchangeInfo(server: McpServer) {
    server.tool(
        "BinanceFuturesExchangeInfo",
        "Get current USD-M Futures exchange trading rules and symbol information.",
        {},
        async () => {
            try {
                const response = await futuresClient.restAPI.exchangeInfo();
                const data = await response.data();
                return {
                    content: [{
                        type: "text",
                        text: `Futures Exchange Info: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get exchange info: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
