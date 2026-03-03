// src/tools/binance-wallet/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceWalletAccountApiTools } from "./account-api/index.js";
import { registerBinanceWalletOthersApiTools } from "./others-api/index.js";
import { registerBinanceWalletTravelRuleApiTools } from "./travel-rule-api/index.js";
import { registerBinanceWalletAssetApiTools } from "./asset-api/index.js";
import { registerBinanceWalletCapitalApiTools } from "./capital-api/index.js";

export function registerBinanceWalletTools(server: McpServer) {
    // Account API tools
    registerBinanceWalletAccountApiTools(server);
    
    // Others API tools
    registerBinanceWalletOthersApiTools(server);
    
    // Travel Rule API tools
    registerBinanceWalletTravelRuleApiTools(server);
    
    // Asset API tools
    registerBinanceWalletAssetApiTools(server);
    
    // Capital API tools
    registerBinanceWalletCapitalApiTools(server);
}

// Alias for binance.ts compatibility
export { registerBinanceWalletTools as registerWallet };