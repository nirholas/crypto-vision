// src/tools/binance-mining/mining-api/acquiringCoinname.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { miningClient } from "../../../config/binanceClient.js";

export function registerBinanceAcquiringCoinName(server: McpServer) {
    server.tool(
        "BinanceAcquiringCoinName",
        "Fetch supported mining coins with details like coin name, ID, algorithm name, and associated algorithm ID.",
        {},
        async () => {
            try {
                const response = await miningClient.restAPI.acquiringCoinname();

                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully fetched supported mining coins. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Failed to fetched supported mining coins: ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
