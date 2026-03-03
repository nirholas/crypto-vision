/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

import { registerTokenPrompts } from "./prompts"
import { registerTokenTools } from "./tools"

export function registerTokens(server: McpServer) {
  registerTokenTools(server)
  registerTokenPrompts(server)
}
