/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { registerLendingTools } from "./tools.js"
import { registerLendingPrompts } from "./prompts.js"

export function registerLending(server: McpServer) {
  registerLendingTools(server)
  registerLendingPrompts(server)
}
