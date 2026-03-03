/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

import { registerSwapTools } from "./tools.js"
import { registerSwapPrompts } from "./prompts.js"

export function registerSwap(server: McpServer) {
  registerSwapTools(server)
  registerSwapPrompts(server)
}
