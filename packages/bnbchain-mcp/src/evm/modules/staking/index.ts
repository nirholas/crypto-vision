import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { registerStakingTools } from "./tools.js"
import { registerStakingPrompts } from "./prompts.js"

export function registerStaking(server: McpServer) {
  registerStakingTools(server)
  registerStakingPrompts(server)
}
