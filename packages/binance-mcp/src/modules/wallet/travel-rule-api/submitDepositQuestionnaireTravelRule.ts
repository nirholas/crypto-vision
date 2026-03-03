// src/tools/binance-wallet/travel-rule-api/submitDepositQuestionnaireTravelRule.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { walletClient } from "../../../config/binanceClient.js";

export function registerBinanceWalletSubmitDepositQuestionnaireTravelRule(server: McpServer) {
    server.tool(
        "BinanceWalletSubmitDepositQuestionnaireTravelRule",
        "Submit deposit questionnaire for travel rule.",
        {
            tranId: z.number().describe("Transaction ID"),
            questionnaire: z.string().describe("Travel rule questionnaire"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ tranId, questionnaire, recvWindow }) => {
            try {
                const params: any = {
                    tranId,
                    questionnaire
                };
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const response = await walletClient.restAPI.submitDepositQuestionnaireTravelRule(params);
                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Submitted deposit questionnaire for travel rule. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to submit deposit questionnaire: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}