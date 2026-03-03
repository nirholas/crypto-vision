// src/tools/binance-crypto-loans/getLoanableAssetsData.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { cryptoLoanClient } from "../../config/binanceClient.js";

export function registerBinanceCryptoLoanGetLoanableAssetsDataV2(server: McpServer) {
    server.tool(
        "BinanceCryptoLoanGetLoanableAssetsDataV2",
        "Get loanable assets data V2 for flexible crypto loans.",
        {
            loanCoin: z.string().optional().describe("Loan coin (e.g., USDT)"),
            vipLevel: z.number().optional().describe("VIP level")
        },
        async ({ loanCoin, vipLevel }) => {
            try {
                const params: any = {};
                if (loanCoin) params.loanCoin = loanCoin;
                if (vipLevel !== undefined) params.vipLevel = vipLevel;
                
                const response = await cryptoLoanClient.restAPI.getFlexibleLoanAssetsData(params);
                const data = await response.data();
                return {
                    content: [
                        {
                            type: "text",
                            text: `Loanable assets data V2 retrieved. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to get loanable assets data V2: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
