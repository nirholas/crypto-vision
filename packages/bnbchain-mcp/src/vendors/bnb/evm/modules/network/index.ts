/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

import { registerNetworkPrompts } from "./prompts.js"
import { registerNetworkTools } from "./tools.js"

export function registerNetwork(server: McpServer) {
  registerNetworkPrompts(server)
  registerNetworkTools(server)
}
