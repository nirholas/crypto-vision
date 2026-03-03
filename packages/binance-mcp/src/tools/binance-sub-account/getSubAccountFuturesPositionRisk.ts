// src/tools/binance-sub-account/getSubAccountFuturesPositionRisk.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { subAccountApiClient } from "../../config/binanceClient.js";

export function registerBinanceSubAccountGetFuturesPositionRisk(server: McpServer) {
    server.tool(
        "BinanceSubAccountGetFuturesPositionRisk",
        "Query sub-account futures position risk.",
        {
            email: z.string().describe("Sub-account email"),
            futuresType: z.number().optional().describe("1: USDT Margined Futures, 2: COIN Margined Futures"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ email, futuresType, recvWindow }) => {
            try {
                const params: any = { email };
                if (futuresType !== undefined) params.futuresType = futuresType;
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const data = await subAccountApiClient.getSubAccountFuturesPositionRisk(params);

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved futures position risk for ${email}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to get sub-account futures position risk: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
