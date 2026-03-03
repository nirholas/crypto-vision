/**
 * SperaxOS - Sperax Protocol Module
 * 
 * Registers all Sperax DeFi tools, prompts, and resources including:
 * - Protocol tools: USDs, SPA, veSPA, Demeter, Vault operations on Arbitrum One
 * - Ecosystem tools: DeFi Agents, Plugin Marketplace, Crypto News
 *
 * Total: 72 tools across 12 categories
 */

import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

import { allTools, toolCategories } from "./tools/index.js"
import { prompts } from "./prompts.js"
import { 
  PROTOCOL_OVERVIEW,
  USDS_DOCUMENTATION,
  STAKING_DOCUMENTATION,
  DEMETER_DOCUMENTATION,
  AGENTS_DOCUMENTATION,
  PLUGINS_DOCUMENTATION,
  NEWS_DOCUMENTATION,
} from "./resources.js"

/**
 * Register all Sperax protocol tools
 */
function registerSperaxTools(server: McpServer) {
  for (const tool of allTools) {
    server.tool(
      tool.name,
      tool.description,
      tool.inputSchema && tool.inputSchema._def ? tool.inputSchema : {},
      async (params: Record<string, unknown>) => {
        try {
          const result = await tool.handler(params)
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(result, null, 2),
              },
            ],
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error"
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ error: errorMessage }, null, 2),
              },
            ],
            isError: true,
          }
        }
      }
    )
  }
}

/**
 * Register Sperax prompts
 */
function registerSperaxPrompts(server: McpServer) {
  for (const prompt of prompts) {
    const args = prompt.arguments?.map((arg) => ({
      name: arg.name,
      description: arg.description,
      required: arg.required,
    })) || []

    server.prompt(
      prompt.name,
      prompt.description,
      args,
      async (params: Record<string, string>) => {
        const template = typeof prompt.template === "function" 
          ? prompt.template(params) 
          : prompt.template
        
        return {
          messages: [
            {
              role: "user" as const,
              content: {
                type: "text" as const,
                text: template,
              },
            },
          ],
        }
      }
    )
  }
}

/**
 * Register Sperax documentation resources
 */
function registerSperaxResources(server: McpServer) {
  const resources = [
    // Protocol documentation
    { uri: "sperax://docs/overview", name: "Protocol Overview", content: PROTOCOL_OVERVIEW },
    { uri: "sperax://docs/usds", name: "USDs Documentation", content: USDS_DOCUMENTATION },
    { uri: "sperax://docs/staking", name: "Staking Guide", content: STAKING_DOCUMENTATION },
    { uri: "sperax://docs/demeter", name: "Demeter Farms", content: DEMETER_DOCUMENTATION },
    // Ecosystem documentation
    { uri: "sperax://ecosystem/agents", name: "DeFi Agents API", content: AGENTS_DOCUMENTATION },
    { uri: "sperax://ecosystem/plugins", name: "Plugin Marketplace", content: PLUGINS_DOCUMENTATION },
    { uri: "sperax://ecosystem/news", name: "Crypto News API", content: NEWS_DOCUMENTATION },
  ]

  server.resource(
    "sperax-docs",
    "sperax://docs/*",
    async (uri: URL) => {
      const resource = resources.find((r) => r.uri === uri.toString())
      if (!resource) {
        return {
          contents: [
            {
              uri: uri.toString(),
              text: "Resource not found",
              mimeType: "text/plain",
            },
          ],
        }
      }
      return {
        contents: [
          {
            uri: uri.toString(),
            text: resource.content,
            mimeType: "text/markdown",
          },
        ],
      }
    }
  )

  // Register ecosystem resources with separate template
  server.resource(
    "sperax-ecosystem",
    "sperax://ecosystem/*",
    async (uri: URL) => {
      const resource = resources.find((r) => r.uri === uri.toString())
      if (!resource) {
        return {
          contents: [
            {
              uri: uri.toString(),
              text: "Resource not found",
              mimeType: "text/plain",
            },
          ],
        }
      }
      return {
        contents: [
          {
            uri: uri.toString(),
            text: resource.content,
            mimeType: "text/markdown",
          },
        ],
      }
    }
  )
}

/**
 * Register all Sperax protocol features with the MCP server
 */
export function registerSperax(server: McpServer) {
  registerSperaxTools(server)
  registerSperaxPrompts(server)
  registerSperaxResources(server)
}

/**
 * Export tool categories for introspection
 */
export { toolCategories }

