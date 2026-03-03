// src/tools/binance-nft/nft-api/getNFTTransactionHistory.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { nftClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceGetNFTTransactionHistory(server: McpServer) {
    server.tool(
        "BinanceGetNFTTransactionHistory",
        "Retrieves NFT transaction history, including purchase orders, sale orders, royalty income, primary market orders, and mint fees. It returns details about the NFT network, token IDs, contract addresses, transaction times, trade amounts, and the currencies used in the transactions.",
        {
            orderType: z
                .number()
                .describe(
                    "Order type: 0 for purchase order, 1 for sell order, 2 for royalty income, 3 for primary market order, 4 for mint fee"
                ),
            startTime: z.number().int().optional().describe("Start time in milliseconds"),
            endTime: z.number().int().optional().describe("End time in milliseconds"),
            limit: z
                .number()
                .int()
                .max(50, "Limit cannot be greater than 50")
                .default(50)
                .describe("Number of records to return, default 50, max 50"),
            page: z.number().int().default(1).describe("Page number, default is 1"),
            recvWindow: z.number().int().optional().describe("Optional time window for request validity")
        },
        async (params) => {
            try {
                const response = await nftClient.restAPI.getNFTTransactionHistory({
                    orderType: params.orderType,
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
                            text: `Successfully retrieved NFT transaction history. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Failed to retrieve NFT transaction history: ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
