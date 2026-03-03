/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-vip-loan/userInformation-api/checkVIPLoanCollateralAccount.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { vipLoanClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceCheckVIPLoanCollateralAccount(server: McpServer) {
    server.tool(
        "BinanceCheckVIPLoanCollateralAccount",
        "Allow users to check their collateral accounts and the coins held as collateral. If the logged-in account is a loan account, it will return all associated collateral accounts. If it's a collateral account, it returns details of the current account only.",
        {
            orderId: z.number().int().optional().describe("Optional order ID"),
            collateralAccountId: z.number().int().optional().describe("Optional collateral account ID"),
            recvWindow: z.number().int().optional().describe("Optional time window for request validity")
        },
        async (params) => {
            try {
                const response = await vipLoanClient.restAPI.checkVIPLoanCollateralAccount({
                    ...(params.orderId !== undefined && { orderId: params.orderId }),
                    ...(params.collateralAccountId !== undefined && {
                        collateralAccountId: params.collateralAccountId
                    }),
                    ...(params.recvWindow !== undefined && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully retrieved collateral accounts and the coins held as collateral. Response: ${JSON.stringify(
                                data
                            )}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Failed to retrieve collateral accounts and the coins held as collateral. ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
