import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { registerPriceFeedsTools } from "./tools.js"
import { registerPriceFeedsPrompts } from "./prompts.js"

export function registerPriceFeeds(server: McpServer) {
  registerPriceFeedsTools(server)
  registerPriceFeedsPrompts(server)
}
