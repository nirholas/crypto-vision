/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { registerDeploymentTools } from "./tools.js"
import { registerDeploymentPrompts } from "./prompts.js"

export function registerDeployment(server: McpServer) {
  registerDeploymentTools(server)
  registerDeploymentPrompts(server)
}
