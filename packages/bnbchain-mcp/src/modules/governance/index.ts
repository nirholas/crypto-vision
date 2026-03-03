/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

import { registerGovernanceTools } from "./tools.js"

export function registerGovernance(server: McpServer) {
  registerGovernanceTools(server)
}
