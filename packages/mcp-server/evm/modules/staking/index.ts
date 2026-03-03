/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { registerStakingTools } from "./tools.js"
import { registerStakingPrompts } from "./prompts.js"

export function registerStaking(server: McpServer) {
  registerStakingTools(server)
  registerStakingPrompts(server)
}
