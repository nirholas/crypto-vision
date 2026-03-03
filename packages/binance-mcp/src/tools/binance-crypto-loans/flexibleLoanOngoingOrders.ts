// src/tools/binance-crypto-loans/flexibleLoanOngoingOrders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { cryptoLoanClient } from "../../config/binanceClient.js";

export function registerBinanceCryptoLoanFlexibleLoanOngoingOrders(server: McpServer) {
    server.tool(
        "BinanceCryptoLoanFlexibleLoanOngoingOrders",
        "Get flexible loan ongoing orders.",
        {
            loanCoin: z.string().optional().describe("Loan coin (e.g., USDT)"),
            collateralCoin: z.string().optional().describe("Collateral coin (e.g., BTC)"),
            current: z.number().optional().describe("Current page"),
            limit: z.number().optional().describe("Page size, max 100")
        },
        async ({ loanCoin, collateralCoin, current, limit }) => {
            try {
                const params: any = {};
                if (loanCoin) params.loanCoin = loanCoin;
                if (collateralCoin) params.collateralCoin = collateralCoin;
                if (current !== undefined) params.current = current;
                if (limit !== undefined) params.limit = limit;
                
                const response = await cryptoLoanClient.restAPI.flexibleLoanOngoingOrders(params);
                const data = await response.data();
                return {
                    content: [
                        {
                            type: "text",
                            text: `Flexible loan ongoing orders retrieved. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to get flexible loan ongoing orders: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
