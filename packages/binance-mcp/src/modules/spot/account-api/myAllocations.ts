// src/tools/binance-spot/account-api/myAllocations.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { spotClient } from "../../../config/binanceClient.js";

export function registerBinanceMyAllocations(server: McpServer) {
    server.tool(
        "BinanceMyAllocations",
        "Get SOR allocations for Self-Trade Prevention.",
        {
            symbol: z.string().describe("Symbol of the trading pair (e.g., BTCUSDT)"),
            allocationId: z.number().optional().describe("Allocation ID"),
            orderId: z.number().optional().describe("Order ID"),
            fromAllocationId: z.number().optional().describe("Allocation ID to fetch from"),
            limit: z.number().optional().describe("Default 500; max 1000"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000")
        },
        async ({ symbol, allocationId, orderId, fromAllocationId, limit, recvWindow }) => {
            try {
                const params: any = { symbol };
                
                if (allocationId !== undefined) params.allocationId = allocationId;
                if (orderId !== undefined) params.orderId = orderId;
                if (fromAllocationId !== undefined) params.fromAllocationId = fromAllocationId;
                if (limit !== undefined) params.limit = limit;
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const response = await spotClient.restAPI.myAllocations(params);


                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved SOR allocations for ${symbol}. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve SOR allocations: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}
