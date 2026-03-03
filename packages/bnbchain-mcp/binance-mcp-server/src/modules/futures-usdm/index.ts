/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/futures-usdm/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceFuturesUSDMTools } from "../../tools/binance-futures-usdm/index.js";

export function registerFuturesUSDM(server: McpServer) {
    registerBinanceFuturesUSDMTools(server);
}
