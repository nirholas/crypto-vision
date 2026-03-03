/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-wallet/travel-rule-api/brokerWithdraw.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { walletClient } from "../../../config/binanceClient.js";

export function registerBinanceWalletBrokerWithdraw(server: McpServer) {
    server.tool(
        "BinanceWalletBrokerWithdraw",
        "Initiate broker withdrawal with travel rule compliance.",
        {
            subAccountId: z.string().describe("Sub-account ID"),
            address: z.string().describe("Withdrawal address"),
            coin: z.string().describe("Coin symbol"),
            amount: z.number().describe("Withdrawal amount"),
            withdrawOrderId: z.string().describe("Client order id"),
            questionnaire: z.string().describe("Travel rule questionnaire"),
            originatorPii: z.string().describe("Originator PII information"),
            signature: z.string().describe("Signature"),
            network: z.string().optional().describe("Network"),
            addressTag: z.string().optional().describe("Secondary address identifier"),
            name: z.string().optional().describe("Address name"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ subAccountId, address, coin, amount, withdrawOrderId, questionnaire, originatorPii, signature, network, addressTag, name, recvWindow }) => {
            try {
                const params: any = {
                    subAccountId,
                    address,
                    coin,
                    amount,
                    withdrawOrderId,
                    questionnaire,
                    originatorPii,
                    signature
                };
                if (network !== undefined) params.network = network;
                if (addressTag !== undefined) params.addressTag = addressTag;
                if (name !== undefined) params.name = name;
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const response = await walletClient.restAPI.brokerWithdraw(params);
                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Broker withdraw request submitted. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to submit broker withdraw request: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}