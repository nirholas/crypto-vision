/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

import { registerContractPrompts } from "./prompts.js"
import { registerContractTools } from "./tools.js"

export function registerContracts(server: McpServer) {
  registerContractPrompts(server)
  registerContractTools(server)
}
