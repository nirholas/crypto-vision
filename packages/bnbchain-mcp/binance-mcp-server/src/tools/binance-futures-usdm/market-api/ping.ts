/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-futures-usdm/market-api/ping.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { futuresClient } from "../../../config/binanceClient.js";

export function registerBinanceFuturesPing(server: McpServer) {
    server.tool(
        "BinanceFuturesPing",
        "Test connectivity to the USD-M Futures REST API.",
        {},
        async () => {
            try {
                const response = await futuresClient.restAPI.ping();
                const data = await response.data();
                return {
                    content: [{
                        type: "text",
                        text: `Futures API connection successful: ${JSON.stringify(data)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Futures ping failed: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
