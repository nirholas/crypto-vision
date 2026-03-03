// src/tools/binance-portfolio-margin/bnbTransfer.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { portfolioMarginClient } from "../../config/binanceClient.js";

export function registerBinancePortfolioMarginBnbTransfer(server: McpServer) {
    server.tool(
        "BinancePortfolioMarginBnbTransfer",
        "Transfer BNB in/out of portfolio margin account.",
        {
            amount: z.number().describe("Amount of BNB to transfer"),
            transferSide: z.enum(["TO_UM", "FROM_UM"]).describe("Transfer direction: TO_UM (to UM account) or FROM_UM (from UM account)"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ amount, transferSide, recvWindow }) => {
            try {
                const params: Record<string, any> = { amount, transferSide };
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const data = await portfolioMarginClient.bnbTransfer(params);

                return {
                    content: [
                        {
                            type: "text",
                            text: `BNB transfer completed. Amount: ${amount}, Direction: ${transferSide}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to transfer BNB: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
