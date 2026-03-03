/**
 * Governance module registration
 * @author nich
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

import { registerGovernanceTools } from "./tools.js"

export function registerGovernance(server: McpServer) {
  registerGovernanceTools(server)
}
