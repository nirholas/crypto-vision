/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-wallet/asset-api/fundingWallet.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { walletClient } from "../../../config/binanceClient.js";

export function registerBinanceWalletFundingWallet(server: McpServer) {
    server.tool(
        "BinanceWalletFundingWallet",
        "Get funding wallet balance.",
        {
            asset: z.string().optional().describe("Asset symbol"),
            needBtcValuation: z.boolean().optional().describe("Whether to include BTC valuation"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ asset, needBtcValuation, recvWindow }) => {
            try {
                const params: any = {};
                if (asset !== undefined) params.asset = asset;
                if (needBtcValuation !== undefined) params.needBtcValuation = needBtcValuation;
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const response = await walletClient.restAPI.fundingWallet(params);
                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved funding wallet balance. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve funding wallet balance: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}