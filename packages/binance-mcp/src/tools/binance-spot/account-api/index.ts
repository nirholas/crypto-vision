// src/tools/binance-spot/account-api/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceMyPreventedMatches } from "./myPreventedMatches.js";
import { registerBinanceGetAccount } from "./getAccount.js";
import { registerBinanceMyAllocations } from "./myAllocations.js";
import { registerBinanceRateLimitOrder } from "./rateLimitOrder.js";
import { registerBinanceAccountCommission } from "./accountCommission.js";
import { registerBinanceMyTrades } from "./myTrades.js";

export function registerBinanceAccountApiTools(server: McpServer) {
    registerBinanceMyPreventedMatches(server);
    registerBinanceGetAccount(server);
    registerBinanceMyAllocations(server);
    registerBinanceRateLimitOrder(server);
    registerBinanceAccountCommission(server);
    registerBinanceMyTrades(server);
}
