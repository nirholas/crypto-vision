// src/tools/binance-nft/nft-api/getNFTAsset.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { nftClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceGetNFTAsset(server: McpServer) {
    server.tool(
        "BinanceGetNFTAsset",
        "Retrieve NFT assets associated with a user's account. It returns details about the network, contract address, and token IDs for each NFT asset.",
        {
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
                const response = await nftClient.restAPI.getNFTAsset({
                    ...(params.limit && { limit: params.limit }),
                    ...(params.page && { page: params.page }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully retrieved NFT assets associated with a user's account. Response: ${JSON.stringify(
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
                            text: `Failed to retrieve NFT assets : ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
