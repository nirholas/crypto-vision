import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { registerPortfolioTools } from "./tools.js"
import { registerPortfolioPrompts } from "./prompts.js"

export function registerPortfolio(server: McpServer) {
  registerPortfolioTools(server)
  registerPortfolioPrompts(server)
}
