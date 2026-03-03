
// src/tools/binance-wallet/asset-api/dustTransfer.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { walletClient } from "../../../config/binanceClient.js";

export function registerBinanceWalletDustTransfer(server: McpServer) {
    server.tool(
        "BinanceWalletDustTransfer",
        "Convert dust assets to BNB.",
        {
            asset: z.array(z.string()).describe("Array of asset symbols to convert"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ asset, recvWindow }) => {
            try {
                const params: any = { asset };
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const response = await walletClient.restAPI.dustTransfer(params);
                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Dust transfer completed. Total BNB received: ${data.totalServiceCharge || 0}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to process dust transfer: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}