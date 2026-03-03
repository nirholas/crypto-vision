// src/tools/binance-crypto-loans/flexibleLoanLoanableAssets.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { cryptoLoanClient } from "../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCryptoLoanFlexibleLoanableAssets(server: McpServer) {
    server.tool(
        "BinanceCryptoLoanFlexibleLoanableAssets",
        "Get flexible loan loanable assets data.",
        {
            loanCoin: z.string().optional().describe("Loan coin"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const response = await cryptoLoanClient.restAPI.getFlexibleLoanAssets({
                    ...(params.loanCoin && { loanCoin: params.loanCoin }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                const data = await response.data();
                return {
                    content: [{ type: "text", text: `Flexible loan loanable assets: ${JSON.stringify(data)}` }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get flexible loan loanable assets: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
