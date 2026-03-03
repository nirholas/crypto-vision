/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-staking/ETHStaking-api/wrapBeth.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { stakingClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceWrapBeth(server: McpServer) {
    server.tool(
        "BinanceWrapBeth",
        "Wrap BETH API allows users to convert BETH into WBETH, providing the wrapped WBETH amount and the exchange rate from BETH to WBETH.",
        {
            amount: z.number().min(0).describe("Amount in BETH, limit 4 decimals (mandatory)"),
            recvWindow: z.number().int().optional().describe("Time window for request validity")
        },
        async (params) => {
            try {
                const response = await stakingClient.restAPI.wrapBeth({
                    amount: params.amount,
                    ...(params.recvWindow !== undefined && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully convert BETH into WBETH. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Failed to convert BETH into WBETH. ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
