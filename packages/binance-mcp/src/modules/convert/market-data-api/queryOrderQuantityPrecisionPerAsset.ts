// src/tools/binance-convert/market-data-api/queryOrderQuantityPrecisionPerAsset.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { convertClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceConvertQueryOrderQuantityPrecisionPerAsset(server: McpServer) {
    server.tool(
        "BinanceConvertQueryOrderQuantityPrecisionPerAsset",
        "Retrieve decimal precision (fraction) information for each supported asset in the Convert feature.",
        {
            recvWindow: z
                .number()
                .int()
                .max(60000, "recvWindow cannot be greater than 60000")
                .optional()
                .describe("The value cannot be greater than 60000")
        },
        async (params) => {
            try {
                const response = await convertClient.restAPI.queryOrderQuantityPrecisionPerAsset({
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully retrieved decimal precision information for each supported asset. Response: ${JSON.stringify(
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
                            text: `Failed to retrieve decimal precision (fraction) information: ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
