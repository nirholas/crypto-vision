import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { registerGasTools } from "./tools.js"
import { registerGasPrompts } from "./prompts.js"

export function registerGas(server: McpServer) {
  registerGasTools(server)
  registerGasPrompts(server)
}
