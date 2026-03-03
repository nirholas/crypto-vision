/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-futures-coinm/account-api/account.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { deliveryClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceDeliveryAccount(server: McpServer) {
    server.tool(
        "BinanceDeliveryAccount",
        "Get current COIN-M Futures account information including assets, positions, and risk metrics.",
        {
            recvWindow: z.number().int().optional().describe("Recv window in milliseconds")
        },
        async (params) => {
            try {
                const response = await deliveryClient.restAPI.account({
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `📊 COIN-M Futures Account Information\n\nCan Trade: ${data.canTrade}\nCan Deposit: ${data.canDeposit}\nCan Withdraw: ${data.canWithdraw}\nUpdate Time: ${new Date(data.updateTime).toISOString()}\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to get account info: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
