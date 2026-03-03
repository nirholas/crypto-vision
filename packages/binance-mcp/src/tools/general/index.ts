// src/tools/general/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { binanceUsRequest } from "../../config/binanceUsClient.js";

export function registerGeneralTools(server: McpServer) {
    // binance_us_ping - Test connectivity to Binance.US
    server.tool(
        "binance_us_ping",
        "Test connectivity to the Binance.US API. Returns empty object if successful.",
        {},
        async () => {
            try {
                const result = await binanceUsRequest("GET", "/api/v3/ping", {}, false);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Binance.US API connection successful. Response: ${JSON.stringify(result)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to ping Binance.US API: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );

    // binance_us_server_time - Get server time
    server.tool(
        "binance_us_server_time",
        "Get the current server time from Binance.US exchange.",
        {},
        async () => {
            try {
                const result = await binanceUsRequest("GET", "/api/v3/time", {}, false);
                const serverTime = new Date(result.serverTime).toISOString();
                return {
                    content: [
                        {
                            type: "text",
                            text: `Binance.US server time: ${serverTime} (${result.serverTime}). Response: ${JSON.stringify(result)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to get server time: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );

    // binance_us_system_status - Get system maintenance status (SIGNED)
    server.tool(
        "binance_us_system_status",
        "Check if Binance.US system is under maintenance. Status 0 = normal, 1 = system maintenance. Requires API key authentication.",
        {},
        async () => {
            try {
                const result = await binanceUsRequest("GET", "/sapi/v1/system/status", {}, true);
                const statusText = result.status === 0 ? "Normal" : "System Maintenance";
                return {
                    content: [
                        {
                            type: "text",
                            text: `Binance.US system status: ${statusText} (${result.status}). Response: ${JSON.stringify(result)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to get system status: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );

    // binance_us_exchange_info - Get exchange information
    server.tool(
        "binance_us_exchange_info",
        "Get current exchange trading rules and trading pair information from Binance.US. Can filter by specific symbol(s) or permissions.",
        {
            symbol: z.string().optional().describe("Single trading pair symbol to filter (e.g., BTCUSD). Cannot be used with 'symbols' parameter."),
            symbols: z.array(z.string()).optional().describe("Array of trading pair symbols to filter (e.g., ['BTCUSD', 'ETHUSD']). Cannot be used with 'symbol' parameter."),
            permissions: z.array(z.string()).optional().describe("Filter by trading permissions. Default is ['SPOT'].")
        },
        async ({ symbol, symbols, permissions }) => {
            try {
                const params: Record<string, any> = {};
                
                // symbol and symbols are mutually exclusive
                if (symbol && symbols) {
                    return {
                        content: [
                            { type: "text", text: "Error: Cannot specify both 'symbol' and 'symbols' parameters. Use one or the other." }
                        ],
                        isError: true
                    };
                }
                
                if (symbol) {
                    params.symbol = symbol;
                } else if (symbols && symbols.length > 0) {
                    params.symbols = JSON.stringify(symbols);
                }
                
                if (permissions && permissions.length > 0) {
                    params.permissions = permissions.join(",");
                }
                
                const result = await binanceUsRequest("GET", "/api/v3/exchangeInfo", params, false);
                
                const symbolCount = result.symbols?.length || 0;
                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved exchange info. Total symbols: ${symbolCount}. Server time: ${result.serverTime}. Timezone: ${result.timezone}. Response: ${JSON.stringify(result, null, 2)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to get exchange info: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
