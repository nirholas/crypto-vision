// src/tools/binance-futures-usdm/listenKey.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { futuresClient } from "../../config/binanceClient.js";

export function registerBinanceFuturesUSDMListenKeyCreate(server: McpServer) {
    server.tool(
        "BinanceFuturesUSDMListenKeyCreate",
        "Start a new user data stream for USD-M Futures. Returns a listenKey for WebSocket connection.",
        {},
        async () => {
            try {
                const data = await futuresClient.createListenKey();
                

                return {
                    content: [
                        {
                            type: "text",
                            text: `USD-M Futures listen key created. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to create USD-M Futures listen key: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}

export function registerBinanceFuturesUSDMListenKeyRenew(server: McpServer) {
    server.tool(
        "BinanceFuturesUSDMListenKeyRenew",
        "Keepalive a user data stream to prevent timeout for USD-M Futures.",
        {},
        async () => {
            try {
                const data = await futuresClient.keepAliveListenKey();
                

                return {
                    content: [
                        {
                            type: "text",
                            text: `USD-M Futures listen key renewed. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to renew USD-M Futures listen key: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}

export function registerBinanceFuturesUSDMListenKeyClose(server: McpServer) {
    server.tool(
        "BinanceFuturesUSDMListenKeyClose",
        "Close a user data stream for USD-M Futures.",
        {},
        async () => {
            try {
                const data = await futuresClient.closeListenKey();
                

                return {
                    content: [
                        {
                            type: "text",
                            text: `USD-M Futures listen key closed. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to close USD-M Futures listen key: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
