/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-sub-account/deposit-api/getDepositAddress.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { spotClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceSubAccountDepositAddress(server: McpServer) {
    server.tool(
        "BinanceSubAccountDepositAddress",
        "Get deposit address for a sub-account. Returns the address and tag/memo if required for the specified asset and network.",
        {
            email: z.string().email()
                .describe("Sub-account email to get deposit address for"),
            coin: z.string()
                .describe("Coin/asset to get deposit address for (e.g., 'BTC', 'ETH')"),
            network: z.string().optional()
                .describe("Network (e.g., 'BTC', 'ETH', 'TRX', 'BSC')"),
            recvWindow: z.number().int().optional()
                .describe("Time window for request validity in ms")
        },
        async (params) => {
            try {
                const response = await spotClient.restAPI.getSubAccountDepositAddress({
                    email: params.email,
                    coin: params.coin,
                    ...(params.network && { network: params.network }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [{
                        type: "text",
                        text: `Deposit Address for ${params.email}:\n\nCoin: ${params.coin}\nNetwork: ${params.network || 'Default'}\nAddress: ${data.address}\n${data.tag ? `Tag/Memo: ${data.tag}` : ''}\n\n⚠️ Always verify the address before sending funds!`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to get deposit address: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
