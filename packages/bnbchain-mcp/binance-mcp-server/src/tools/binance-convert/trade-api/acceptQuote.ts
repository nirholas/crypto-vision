/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-convert/trade-api/acceptQuote.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { convertClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceConvertAcceptQuote(server: McpServer) {
    server.tool(
        "BinanceConvertAcceptQuote",
        "The API confirms and executes a token conversion using a previously received quote ID.",
        {
            quoteId: z.string().describe("Quote ID"),
            recvWindow: z
                .number()
                .int()
                .max(60000, "recvWindow cannot be greater than 60000")
                .optional()
                .describe("The value cannot be greater than 60000")
        },
        async (params) => {
            try {
                const response = await convertClient.restAPI.acceptQuote({
                    quoteId: params.quoteId,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully executed the token conversion. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Failed to execute a token conversion : ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
