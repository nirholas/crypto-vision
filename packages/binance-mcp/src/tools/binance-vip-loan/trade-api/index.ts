// src/tools/binance-vip-loan/trade-api/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceVipLoanRenew } from "./vipLoanRenew.js";
import { registerBinanceVipLoanRepay } from "./vipLoanRepay.js";
import { registerBinanceVipLoanBorrow } from "./vipLoanBorrow.js";

export function registerBinanceVipLoanTradeApiTools(server: McpServer) {
    registerBinanceVipLoanRenew(server);
    registerBinanceVipLoanRepay(server);
    registerBinanceVipLoanBorrow(server);
}
