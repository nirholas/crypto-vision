/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { registerMEVTools } from "./tools.js"
import { registerMEVPrompts } from "./prompts.js"

export function registerMEV(server: McpServer) {
  registerMEVTools(server)
  registerMEVPrompts(server)
}
