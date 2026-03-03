/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-nft/nft-api/getNFTDepositHistory.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { nftClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceGetNFTDepositHistory(server: McpServer) {
    server.tool(
        "BinanceGetNFTDepositHistory",
        "Retrieves NFT deposit history, including network, contract address, token ID, transaction ID (if available), and timestamps.",
        {
            startTime: z.number().int().optional().describe("Start time in milliseconds"),
            endTime: z.number().int().optional().describe("End time in milliseconds"),
            limit: z
                .number()
                .int()
                .max(50, "Limit cannot be greater than 50")
                .optional()
                .describe("Number of records to return, default 50, max 50"),
            page: z.number().int().optional().describe("Page number, default is 1"),
            recvWindow: z.number().int().optional().describe("Optional time window for request validity")
        },
        async (params) => {
            try {
                const response = await nftClient.restAPI.getNFTDepositHistory({
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.limit && { limit: params.limit }),
                    ...(params.page && { page: params.page }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully retrieved NFT deposit history, including network, contract address, token ID. Response: ${JSON.stringify(
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
                            text: `Failed to retrieves NFT deposit history: ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
