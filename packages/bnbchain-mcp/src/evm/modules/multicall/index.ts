import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { registerMulticallTools } from "./tools.js"
import { registerMulticallPrompts } from "./prompts.js"

export function registerMulticall(server: McpServer) {
  registerMulticallTools(server)
  registerMulticallPrompts(server)
}
