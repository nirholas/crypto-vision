/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-wallet/asset-api/userAsset.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { walletClient } from "../../../config/binanceClient.js";

export function registerBinanceWalletUserAsset(server: McpServer) {
    server.tool(
        "BinanceWalletUserAsset",
        "Get user assets.",
        {
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000"),
            needBtcValuation: z.boolean().optional().describe("Whether to include BTC valuation")
        },
        async ({ recvWindow, needBtcValuation }) => {
            try {
                const params: any = {};
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                if (needBtcValuation !== undefined) params.needBtcValuation = needBtcValuation;
                
                const response = await walletClient.restAPI.userAsset(params);
                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved user assets. Number of assets: ${data.length || 0}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve user assets: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}