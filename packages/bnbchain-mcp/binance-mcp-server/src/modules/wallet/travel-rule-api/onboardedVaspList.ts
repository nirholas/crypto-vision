/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-wallet/travel-rule-api/onboardedVaspList.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { walletClient } from "../../../config/binanceClient.js";

export function registerBinanceWalletOnboardedVaspList(server: McpServer) {
    server.tool(
        "BinanceWalletOnboardedVaspList",
        "Get list of onboarded VASPs (Virtual Asset Service Providers).",
        {},
        async () => {
            try {                
                const response = await walletClient.restAPI.onboardedVaspList();
                const data = await response.data();

                return {
                    content: [
                        {
                            type: "text",
                            text: `Retrieved onboarded VASP list. Response: ${JSON.stringify(data)}`
                        }
                    ]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        { type: "text", text: `Failed to retrieve onboarded VASP list: ${errorMessage}` }
                    ],
                    isError: true
                };
            }
        }
    );
}