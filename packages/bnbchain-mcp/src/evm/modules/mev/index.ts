/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { registerMEVTools } from "./tools.js"
import { registerMEVPrompts } from "./prompts.js"

export function registerMEV(server: McpServer) {
  registerMEVTools(server)
  registerMEVPrompts(server)
}
