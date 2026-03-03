/**
 * Web3 Research Module
 * 
 * @author nich
 * @website https://x.com/nichxbt
 * @github https://github.com/nirholas
 * @license Apache-2.0
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerResearchTools } from "./tools.js";

export function registerResearch(server: McpServer): void {
  registerResearchTools(server);
}
