import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { registerSignaturesTools } from "./tools.js"
import { registerSignaturesPrompts } from "./prompts.js"

export function registerSignatures(server: McpServer) {
  registerSignaturesTools(server)
  registerSignaturesPrompts(server)
}
