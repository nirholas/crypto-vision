/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { registerGovernanceTools } from "./tools.js"
import { registerGovernancePrompts } from "./prompts.js"

export function registerGovernance(server: McpServer) {
  registerGovernanceTools(server)
  registerGovernancePrompts(server)
}
