// src/tools/binance-wallet/capital-api/withdraw.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { walletClient } from "../../../config/binanceClient.js";

export function registerBinanceWalletWithdraw(server: McpServer) {
    server.tool(
        "BinanceWalletWithdraw",
        "Submit a withdraw request.",
        {
            coin: z.string().describe("Coin symbol"),
            address: z.string().describe("Withdrawal address"),
            amount: z.number().describe("Withdrawal amount"),
            withdrawOrderId: z.string().optional().describe("Client order id"),
            network: z.string().optional().describe("Network"),
            addressTag: z.string().optional().describe("Secondary address identifier (tag/memo)"),
            name: z.string().optional().describe("Address name"),
            walletType: z.number().optional().describe("Wallet type"),
            transactionFeeFlag: z.boolean().optional().describe("Pay fee with BNB"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ coin, address, amount, withdrawOrderId, network, addressTag, name, walletType, transactionFeeFlag, recvWindow }) => {
            try {
                const params: any = {
                    coin,
                    address,
                    amount
                };
                if (withdrawOrderId !== undefined) params.withdrawOrderId = withdrawOrderId;
                if (network !== undefined) params.network = network;
                if (addressTag !== undefined) params.addressTag = addressTag;
                if (name !== undefined) params.name = name;
                if (walletType !== undefined) params.walletType = walletType;
                if (transactionFeeFlag !== undefined) params.transactionFeeFlag = transactionFeeFlag;
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const response = await walletClient.restAPI.withdraw(params);
                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Withdraw request submitted. Withdrawal ID: ${data.id}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to submit withdraw request: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}