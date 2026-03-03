/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

import { registerNftTools } from "./tools.js"

export function registerNFT(server: McpServer) {
  registerNftTools(server)
}
