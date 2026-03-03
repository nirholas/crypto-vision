// src/modules/crypto-loans/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceCryptoLoansTools } from "../../tools/binance-crypto-loans/index.js";

export function registerCryptoLoans(server: McpServer) {
    registerBinanceCryptoLoansTools(server);
}
