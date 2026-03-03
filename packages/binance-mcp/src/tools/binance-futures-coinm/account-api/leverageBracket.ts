/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/tools/binance-futures-coinm/account-api/leverageBracket.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { deliveryClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerBinanceDeliveryLeverageBracket(server: McpServer) {
    server.tool(
        "BinanceDeliveryLeverageBracket",
        "Get notional and leverage bracket information for COIN-M Futures. Shows max leverage at different position sizes.",
        {
            pair: z.string().optional().describe("Filter by underlying pair (e.g., BTCUSD)"),
            recvWindow: z.number().int().optional().describe("Recv window in milliseconds")
        },
        async (params) => {
            try {
                const response = await deliveryClient.restAPI.leverageBracket({
                    ...(params.pair && { pair: params.pair }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                return {
                    content: [{
                        type: "text",
                        text: `📊 COIN-M Leverage Brackets${params.pair ? ` for ${params.pair}` : ''}\n\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `❌ Failed to get leverage brackets: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
