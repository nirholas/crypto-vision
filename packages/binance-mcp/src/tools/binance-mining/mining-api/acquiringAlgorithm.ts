// src/tools/binance-mining/mining-api/acquiringAlgorithm.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { miningClient } from "../../../config/binanceClient.js";

export function registerBinanceAcquiringAlgorithm(server: McpServer) {
    server.tool(
        "BinanceAcquiringAlgorithm",
        "Retrieve a list of available mining algorithms, including their name, ID, sequence, and unit.",
        {},
        async () => {
            try {
                const response = await miningClient.restAPI.acquiringAlgorithm();

                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully retrieve a list of available mining algorithms. Response: ${JSON.stringify(
                                data
                            )}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Failed to retrieve a list of available mining algorithms: ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
