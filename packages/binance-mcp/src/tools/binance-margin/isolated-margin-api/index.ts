// src/tools/binance-margin/isolated-margin-api/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceIsolatedMarginTransfer } from "./isolatedMarginTransfer.js";
import { registerBinanceIsolatedMarginAccount } from "./isolatedMarginAccount.js";
import { registerBinanceIsolatedMarginPair } from "./isolatedMarginPair.js";
import { registerBinanceIsolatedMarginAllPairs } from "./isolatedMarginAllPairs.js";
import { registerBinanceIsolatedMarginTierData } from "./isolatedMarginTierData.js";
import { registerBinanceIsolatedMarginAccountLimit } from "./isolatedMarginAccountLimit.js";
import { registerBinanceIsolatedMarginFee } from "./isolatedMarginFee.js";
import { registerBinanceIsolatedMarginNewOrder } from "./isolatedMarginNewOrder.js";
import { registerBinanceIsolatedMarginCancelOrder } from "./isolatedMarginCancelOrder.js";
import { registerBinanceIsolatedMarginOpenOrders } from "./isolatedMarginOpenOrders.js";
import { registerBinanceIsolatedMarginAllOrders } from "./isolatedMarginAllOrders.js";
import { registerBinanceIsolatedMarginMyTrades } from "./isolatedMarginMyTrades.js";
import { registerBinanceToggleBnbBurn } from "./toggleBnbBurn.js";
import { registerBinanceGetBnbBurnStatus } from "./getBnbBurnStatus.js";

export function registerBinanceIsolatedMarginTools(server: McpServer) {
    // Transfer
    registerBinanceIsolatedMarginTransfer(server);
    
    // Account Info
    registerBinanceIsolatedMarginAccount(server);
    registerBinanceIsolatedMarginAccountLimit(server);
    
    // Pairs & Info
    registerBinanceIsolatedMarginPair(server);
    registerBinanceIsolatedMarginAllPairs(server);
    registerBinanceIsolatedMarginTierData(server);
    registerBinanceIsolatedMarginFee(server);
    
    // Trading
    registerBinanceIsolatedMarginNewOrder(server);
    registerBinanceIsolatedMarginCancelOrder(server);
    registerBinanceIsolatedMarginOpenOrders(server);
    registerBinanceIsolatedMarginAllOrders(server);
    registerBinanceIsolatedMarginMyTrades(server);
    
    // BNB Burn
    registerBinanceToggleBnbBurn(server);
    registerBinanceGetBnbBurnStatus(server);
}
