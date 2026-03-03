/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-sub-account/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceSubAccountManagementTools } from "./management-api/index.js";
import { registerBinanceSubAccountAssetsTools } from "./assets-api/index.js";
import { registerBinanceSubAccountTransferTools } from "./transfer-api/index.js";
import { registerBinanceSubAccountDepositTools } from "./deposit-api/index.js";

export function registerBinanceSubAccountTools(server: McpServer) {
    // Sub-account management tools (create, list, enable features)
    registerBinanceSubAccountManagementTools(server);
    
    // Sub-account asset tools (get assets, summaries)
    registerBinanceSubAccountAssetsTools(server);
    
    // Sub-account transfer tools (internal transfers)
    registerBinanceSubAccountTransferTools(server);
    
    // Sub-account deposit tools (addresses, history)
    registerBinanceSubAccountDepositTools(server);
}
