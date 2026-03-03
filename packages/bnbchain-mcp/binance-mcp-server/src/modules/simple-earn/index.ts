/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/modules/simple-earn/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceSimpleEarnApiTools } from "./earn-api/index.js";
import { registerBinanceSimpleEarnAccountApiTools } from "./account-api/index.js";
import { registerSimpleEarnFlexibleTools } from "./flexible/index.js";
import { registerSimpleEarnLockedTools } from "./locked/index.js";
import { registerSimpleEarnAccountTools } from "./account/index.js";

export function registerSimpleEarn(server: McpServer) {
    // Legacy API tools (for backwards compatibility)
    registerBinanceSimpleEarnApiTools(server);
    registerBinanceSimpleEarnAccountApiTools(server);
    
    // New comprehensive flexible product tools
    registerSimpleEarnFlexibleTools(server);
    
    // New comprehensive locked product tools
    registerSimpleEarnLockedTools(server);
    
    // Account-level tools
    registerSimpleEarnAccountTools(server);
}

// Export alias for backwards compatibility
export { registerSimpleEarn as registerBinanceSimpleEarnTools };
