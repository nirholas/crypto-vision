/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// src/modules/options/account-api/getPosition.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { optionsClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerOptionsGetPosition(server: McpServer) {
    server.tool(
        "BinanceOptionsGetPosition",
        "Get current options positions. Shows all active option contracts held.",
        {
            symbol: z.string().optional().describe("Option symbol to filter by"),
            underlying: z.string().optional().describe("Underlying asset to filter by (e.g., 'BTCUSDT')"),
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await optionsClient.restAPI.position({
                    ...(params.symbol && { symbol: params.symbol }),
                    ...(params.underlying && { underlying: params.underlying }),
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                let result = `✅ Options Positions\n\n`;
                
                if (Array.isArray(data) && data.length > 0) {
                    result += `Total positions: ${data.length}\n\n`;
                    data.forEach((pos: any, index: number) => {
                        result += `**${index + 1}. ${pos.symbol}**\n`;
                        result += `  Side: ${pos.side}\n`;
                        result += `  Quantity: ${pos.quantity}\n`;
                        result += `  Entry Price: ${pos.entryPrice}\n`;
                        result += `  Mark Price: ${pos.markPrice}\n`;
                        result += `  Unrealized PnL: ${pos.unrealizedPNL}\n`;
                        result += `  Maintenance Margin: ${pos.maintMargin}\n`;
                        result += `  Expiry Date: ${pos.expiryDate}\n\n`;
                    });
                } else {
                    result += `No positions found`;
                }
                
                return {
                    content: [{
                        type: "text",
                        text: result
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{
                        type: "text",
                        text: `❌ Failed to get options positions: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
