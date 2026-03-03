/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { registerSecurityTools } from "./tools.js"
import { registerSecurityPrompts } from "./prompts.js"

export function registerSecurity(server: McpServer) {
  registerSecurityTools(server)
  registerSecurityPrompts(server)
}
