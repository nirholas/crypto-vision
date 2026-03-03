/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-margin/isolated-margin-api/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceIsolatedMarginAccount } from "./isolatedMarginAccount.js";
import { registerBinanceIsolatedMarginAccountLimit } from "./isolatedMarginAccountLimit.js";
import { registerBinanceIsolatedMarginSymbol } from "./isolatedMarginSymbol.js";
import { registerBinanceIsolatedMarginAllSymbols } from "./isolatedMarginAllSymbols.js";
import { registerBinanceIsolatedMarginTransfer } from "./isolatedMarginTransfer.js";
import { registerBinanceIsolatedMarginTransferHistory } from "./isolatedMarginTransferHistory.js";
import { registerBinanceIsolatedMarginBorrow } from "./isolatedMarginBorrow.js";
import { registerBinanceIsolatedMarginRepay } from "./isolatedMarginRepay.js";
import { registerBinanceIsolatedMarginNewOrder } from "./isolatedMarginNewOrder.js";
import { registerBinanceIsolatedMarginCancelOrder } from "./isolatedMarginCancelOrder.js";
import { registerBinanceIsolatedMarginOpenOrders } from "./isolatedMarginOpenOrders.js";
import { registerBinanceIsolatedMarginAllOrders } from "./isolatedMarginAllOrders.js";
import { registerBinanceIsolatedMarginMyTrades } from "./isolatedMarginMyTrades.js";
import { registerBinanceIsolatedMarginFee } from "./isolatedMarginFee.js";
import { registerBinanceIsolatedMarginTierData } from "./isolatedMarginTierData.js";
import { registerBinanceEnableIsolatedMarginAccount } from "./enableIsolatedMarginAccount.js";
import { registerBinanceDisableIsolatedMarginAccount } from "./disableIsolatedMarginAccount.js";

export function registerBinanceIsolatedMarginTools(server: McpServer) {
    // Account Management
    registerBinanceIsolatedMarginAccount(server);
    registerBinanceIsolatedMarginAccountLimit(server);
    registerBinanceEnableIsolatedMarginAccount(server);
    registerBinanceDisableIsolatedMarginAccount(server);
    
    // Symbol Info
    registerBinanceIsolatedMarginSymbol(server);
    registerBinanceIsolatedMarginAllSymbols(server);
    
    // Transfer
    registerBinanceIsolatedMarginTransfer(server);
    registerBinanceIsolatedMarginTransferHistory(server);
    
    // Borrow & Repay
    registerBinanceIsolatedMarginBorrow(server);
    registerBinanceIsolatedMarginRepay(server);
    
    // Trading
    registerBinanceIsolatedMarginNewOrder(server);
    registerBinanceIsolatedMarginCancelOrder(server);
    registerBinanceIsolatedMarginOpenOrders(server);
    registerBinanceIsolatedMarginAllOrders(server);
    registerBinanceIsolatedMarginMyTrades(server);
    
    // Fee & Tier Info
    registerBinanceIsolatedMarginFee(server);
    registerBinanceIsolatedMarginTierData(server);
}
