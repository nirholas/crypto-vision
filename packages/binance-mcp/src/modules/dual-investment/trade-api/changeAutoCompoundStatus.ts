// src/tools/binance-dual-investment/trade-api/changeAutoCompoundStatus.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { dualInvestmentClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceChangeAutoCompoundStatus(server: McpServer) {
    server.tool(
        "registerBinanceChangeAutoCompoundStatus",
        "Change the Auto-Compound plan for a Dual Investment position to NONE, STANDARD, or ADVANCED using the position ID.",
        {
            positionId: z.string().describe("Get positionId from /sapi/v1/dci/product/positions"),
            autoCompoundPlan: z
                .enum(["NONE", "STANDARD", "ADVANCED"])
                .optional()
                .describe("Auto compound plan: NONE, STANDARD, or ADVANCED"),
            recvWindow: z
                .number()
                .int()
                .max(60000)
                .optional()
                .describe("Optional time window for request validity (max 60000)")
        },
        async (params) => {
            try {
                const response = await dualInvestmentClient.restAPI.changeAutoCompoundStatus({
                    positionId: params.positionId,
                    autoCompoundPlan: params.autoCompoundPlan,
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });

                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully Changed the Auto-Compound plan for a Dual Investment position. Response: ${JSON.stringify(
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
                            text: `Failed to change the Auto-Compound plan for a Dual Investment position: ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        }
    );
}
