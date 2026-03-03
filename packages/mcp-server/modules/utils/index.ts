/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

import { registerUtilityPrompts } from "./prompts.js"
import { registerUtilityTools } from "./tools.js"

export function registerUtils(server: McpServer) {
  registerUtilityTools(server)
  registerUtilityPrompts(server)
}
