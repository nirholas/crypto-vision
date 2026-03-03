/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */

// src/tools/binance-wallet/asset-api/userUniversalTransfer.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { walletClient } from "../../../config/binanceClient.js";

export function registerBinanceWalletUserUniversalTransfer(server: McpServer) {
    server.tool(
        "BinanceWalletUserUniversalTransfer",
        "Make universal transfer between different accounts.",
        {
            type: z.string().describe("Transfer type"),
            asset: z.string().describe("Asset symbol"),
            amount: z.number().describe("Transfer amount"),
            fromSymbol: z.string().optional().describe("Symbol for spot/margin trade pair"),
            toSymbol: z.string().optional().describe("Symbol for spot/margin trade pair"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ type, asset, amount, fromSymbol, toSymbol, recvWindow }) => {
            try {
                const params: any = {
                    type,
                    asset,
                    amount
                };
                if (fromSymbol !== undefined) params.fromSymbol = fromSymbol;
                if (toSymbol !== undefined) params.toSymbol = toSymbol;
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const response = await walletClient.restAPI.userUniversalTransfer(params);
                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Universal transfer completed. Transfer ID: ${data.tranId}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to process universal transfer: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}