/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

import { registerBlockPrompts } from "./prompts.js"
import { registerBlockTools } from "./tools.js"

export function registerBlocks(server: McpServer) {
  registerBlockPrompts(server)
  registerBlockTools(server)
}
