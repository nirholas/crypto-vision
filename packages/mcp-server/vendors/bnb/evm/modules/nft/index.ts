/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

import { registerNftTools } from "./tools.js"

export function registerNFT(server: McpServer) {
  registerNftTools(server)
}
