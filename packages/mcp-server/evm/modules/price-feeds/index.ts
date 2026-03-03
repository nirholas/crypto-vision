/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { registerPriceFeedsTools } from "./tools.js"
import { registerPriceFeedsPrompts } from "./prompts.js"

export function registerPriceFeeds(server: McpServer) {
  registerPriceFeedsTools(server)
  registerPriceFeedsPrompts(server)
}
