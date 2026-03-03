// src/tools/binance-fiat/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceGetNFTDepositHistory } from "./nft-api/getNFTDepositHistory.js";
import { registerBinanceGetNFTWithdrawHistory } from "./nft-api/getNFTWithdrawHistory.js";
import { registerBinanceGetNFTTransactionHistory } from "./nft-api/getNFTTransactionHistory.js";
import { registerBinanceGetNFTAsset } from "./nft-api/getNFTAsset.js";

export function registerBinanceNFTTools(server: McpServer) {
    registerBinanceGetNFTDepositHistory(server);
    registerBinanceGetNFTWithdrawHistory(server);
    registerBinanceGetNFTTransactionHistory(server);
    registerBinanceGetNFTAsset(server);
}
