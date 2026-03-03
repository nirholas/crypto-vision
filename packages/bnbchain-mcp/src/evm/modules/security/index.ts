import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { registerSecurityTools } from "./tools.js"
import { registerSecurityPrompts } from "./prompts.js"

export function registerSecurity(server: McpServer) {
  registerSecurityTools(server)
  registerSecurityPrompts(server)
}
