/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/options/account-api/getAccount.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { optionsClient } from "../../../config/binanceClient.js";
import { z } from "zod";

export function registerOptionsGetAccount(server: McpServer) {
    server.tool(
        "BinanceOptionsGetAccount",
        "Get options account information including balances and Greeks.",
        {
            recvWindow: z.number().int().optional().describe("Request validity window in ms")
        },
        async (params) => {
            try {
                const response = await optionsClient.restAPI.account({
                    ...(params.recvWindow && { recvWindow: params.recvWindow })
                });
                
                const data = await response.data();
                
                let result = `✅ Options Account Information\n\n`;
                
                if (data) {
                    result += `**Account Details**\n`;
                    result += `Asset: ${data.asset}\n`;
                    result += `Margin Balance: ${data.marginBalance}\n`;
                    result += `Equity: ${data.equity}\n`;
                    result += `Available: ${data.available}\n`;
                    result += `Unrealized PnL: ${data.unrealizedPNL}\n`;
                    result += `Maintenance Margin: ${data.maintenanceMargin}\n`;
                    result += `Initial Margin: ${data.initialMargin}\n\n`;
                    
                    result += `**Greeks**\n`;
                    result += `Delta: ${data.delta || 'N/A'}\n`;
                    result += `Theta: ${data.theta || 'N/A'}\n`;
                    result += `Gamma: ${data.gamma || 'N/A'}\n`;
                    result += `Vega: ${data.vega || 'N/A'}\n`;
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
                        text: `❌ Failed to get options account: ${errorMessage}`
                    }],
                    isError: true
                };
            }
        }
    );
}
