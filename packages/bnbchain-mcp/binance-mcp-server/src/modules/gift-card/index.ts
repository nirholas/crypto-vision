/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/gift-card/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceGiftCardTools } from "../../tools/binance-gift-card/index.js";

export function registerGiftCard(server: McpServer) {
    registerBinanceGiftCardTools(server);
}
