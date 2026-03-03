/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-crypto-loans/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceCryptoLoansFlexibleTools } from "./flexible-api/index.js";
import { registerBinanceCryptoLoansFixedTools } from "./fixed-api/index.js";

export function registerBinanceCryptoLoansTools(server: McpServer) {
    // Flexible loan tools
    registerBinanceCryptoLoansFlexibleTools(server);
    
    // Fixed-term loan tools
    registerBinanceCryptoLoansFixedTools(server);
}
