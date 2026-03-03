/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/margin/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceMarginTools } from "../../tools/binance-margin/index.js";

export function registerMargin(server: McpServer) {
    registerBinanceMarginTools(server);
}
