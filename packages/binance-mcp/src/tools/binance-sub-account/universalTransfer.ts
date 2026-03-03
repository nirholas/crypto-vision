// src/tools/binance-sub-account/universalTransfer.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { subAccountApiClient } from "../../config/binanceClient.js";

export function registerBinanceSubAccountUniversalTransfer(server: McpServer) {
    server.tool(
        "BinanceSubAccountUniversalTransfer",
        "Universal transfer between sub-accounts or between master and sub-accounts.",
        {
            fromEmail: z.string().optional().describe("Sender email (leave empty for master account)"),
            toEmail: z.string().optional().describe("Recipient email (leave empty for master account)"),
            fromAccountType: z.string().describe("Sender account type: SPOT, USDT_FUTURE, COIN_FUTURE, MARGIN, ISOLATED_MARGIN"),
            toAccountType: z.string().describe("Recipient account type: SPOT, USDT_FUTURE, COIN_FUTURE, MARGIN, ISOLATED_MARGIN"),
            asset: z.string().describe("Asset to transfer"),
            amount: z.number().describe("Amount to transfer"),
            symbol: z.string().optional().describe("Required when fromAccountType or toAccountType is ISOLATED_MARGIN"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ fromEmail, toEmail, fromAccountType, toAccountType, asset, amount, symbol, recvWindow }) => {
            try {
                const params: any = { fromAccountType, toAccountType, asset, amount };
                if (fromEmail !== undefined) params.fromEmail = fromEmail;
                if (toEmail !== undefined) params.toEmail = toEmail;
                if (symbol !== undefined) params.symbol = symbol;
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const data = await subAccountApiClient.subAccountUniversalTransfer(params);

                return {
                    content: [
                        {
                            type: "text",
                            text: `Universal transfer completed: ${amount} ${asset}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to execute universal transfer: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
