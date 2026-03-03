/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-margin/margin-order-api/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceMarginNewOco } from "./marginNewOco.js";
import { registerBinanceMarginCancelOco } from "./marginCancelOco.js";
import { registerBinanceMarginGetOco } from "./marginGetOco.js";
import { registerBinanceMarginGetAllOco } from "./marginGetAllOco.js";
import { registerBinanceMarginGetOpenOco } from "./marginGetOpenOco.js";

export function registerBinanceMarginOrderTools(server: McpServer) {
    // OCO Orders
    registerBinanceMarginNewOco(server);
    registerBinanceMarginCancelOco(server);
    registerBinanceMarginGetOco(server);
    registerBinanceMarginGetAllOco(server);
    registerBinanceMarginGetOpenOco(server);
}
