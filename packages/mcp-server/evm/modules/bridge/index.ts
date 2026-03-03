/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

import { registerBridgeTools } from "./tools.js"
import { registerBridgePrompts } from "./prompts.js"

export function registerBridge(server: McpServer) {
  registerBridgeTools(server)
  registerBridgePrompts(server)
}
