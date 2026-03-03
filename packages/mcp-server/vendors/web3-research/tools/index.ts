/**
 * Web3 Research Tools Index
 * 
 * @author nich
 * @website https://x.com/nichxbt
 * @github https://github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import ResearchStorage from "../storage/researchStorage.js";
import { registerResearchTools } from "./researchTools.js";

export function registerAllTools(
  server: McpServer,
  storage: ResearchStorage
): void {
  registerResearchTools(server, storage);
}
