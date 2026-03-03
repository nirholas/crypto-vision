// src/tools/binance-wallet/asset-api/tradeFee.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { walletClient } from "../../../config/binanceClient.js";

export function registerBinanceWalletTradeFee(server: McpServer) {
    server.tool(
        "BinanceWalletTradeFee",
        "Get trade fee.",
        {
            symbol: z.string().optional().describe("Trading pair symbol"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ symbol, recvWindow }) => {
            try {
                const params: any = {};
                if (symbol !== undefined) params.symbol = symbol;
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const response = await walletClient.restAPI.tradeFee(params);
                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved trade fee information. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve trade fee information: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}