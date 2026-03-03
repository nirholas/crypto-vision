// src/tools/binance-wallet/travel-rule-api/withdrawTravelRule.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { walletClient } from "../../../config/binanceClient.js";

export function registerBinanceWalletWithdrawTravelRule(server: McpServer) {
    server.tool(
        "BinanceWalletWithdrawTravelRule",
        "Withdraw with travel rule compliance.",
        {
            coin: z.string().describe("Coin symbol"),
            address: z.string().describe("Withdrawal address"),
            amount: z.number().describe("Withdrawal amount"),
            withdrawOrderId: z.string().optional().describe("Client order id"),
            network: z.string().optional().describe("Network"),
            addressTag: z.string().optional().describe("Secondary address identifier"),
            name: z.string().optional().describe("Address name"),
            questionnaire: z.string().describe("Travel rule questionnaire"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ coin, address, amount, withdrawOrderId, network, addressTag, name, questionnaire, recvWindow }) => {
            try {
                const params: any = { 
                    coin, 
                    address, 
                    amount,
                    questionnaire 
                };
                if (withdrawOrderId !== undefined) params.withdrawOrderId = withdrawOrderId;
                if (network !== undefined) params.network = network;
                if (addressTag !== undefined) params.addressTag = addressTag;
                if (name !== undefined) params.name = name;
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const response = await walletClient.restAPI.withdrawTravelRule(params);
                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Withdraw travel rule request submitted. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to submit withdraw travel rule request: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}