/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

import { registerSocialTools } from "./tools.js"
import { registerSocialPrompts } from "./prompts.js"

/**
 * Register social analytics module with the MCP server
 * Provides social sentiment, influencer tracking, and community metrics
 * 
 * Data sources:
 * - LunarCrush API (requires API key)
 * - CryptoCompare Social (free tier)
 */
export function registerSocial(server: McpServer) {
  registerSocialTools(server)
  registerSocialPrompts(server)
}
