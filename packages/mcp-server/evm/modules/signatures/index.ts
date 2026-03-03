/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { registerSignaturesTools } from "./tools.js"
import { registerSignaturesPrompts } from "./prompts.js"

export function registerSignatures(server: McpServer) {
  registerSignaturesTools(server)
  registerSignaturesPrompts(server)
}
