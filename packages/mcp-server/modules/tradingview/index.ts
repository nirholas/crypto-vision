/**
 * TradingView Screener Module
 * 
 * @author nich
 * @website https://x.com/nichxbt
 * @github https://github.com/nirholas
 * @license Apache-2.0
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerScreenerTools } from "./tools.js";

export function registerTradingView(server: McpServer): void {
  registerScreenerTools(server);
}
