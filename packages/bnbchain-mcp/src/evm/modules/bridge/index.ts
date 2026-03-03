import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

import { registerBridgeTools } from "./tools.js"
import { registerBridgePrompts } from "./prompts.js"

export function registerBridge(server: McpServer) {
  registerBridgeTools(server)
  registerBridgePrompts(server)
}
