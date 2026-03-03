/**
 * Lyra Ecosystem MCP Tools
 * @description MCP tool definitions for Lyra services
 * @author nirholas
 * @license Apache-2.0
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { LyraClient, getLyraClient } from "./client.js";
import { LYRA_PRICES, TOOL_CATEGORIES, DISCOVERABLE_PROTOCOLS } from "./constants.js";
import Logger from "@/utils/logger.js";

/**
 * Register all Lyra ecosystem tools with an MCP server
 */
export function registerLyraTools(server: McpServer): void {
  Logger.info("[Lyra] Registering MCP tools for Lyra ecosystem");

  // ==========================================================================
  // Lyra Intel Tools
  // ==========================================================================

  server.tool(
    "lyra_intel_analyze_file",
    "Analyze a code file for complexity, structure, and suggestions (FREE)",
    {
      content: z.string().describe("The file content to analyze"),
      filename: z.string().describe("The filename (for language detection)"),
      language: z.string().optional().describe("Override language detection"),
    },
    async ({ content, filename, language }) => {
      const client = getLyraClient();
      const result = await client.intel.analyzeFile({ content, filename, language });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  server.tool(
    "lyra_intel_security_scan",
    `Perform a security vulnerability scan on a repository ($${LYRA_PRICES.intel.securityScan})`,
    {
      repoUrl: z.string().url().describe("GitHub repository URL to scan"),
    },
    async ({ repoUrl }) => {
      const client = getLyraClient();
      const result = await client.intel.securityScan(repoUrl);
      return {
        content: [{
          type: "text",
          text: `Security Score: ${result.score}/100\n\nVulnerabilities: ${result.vulnerabilities.length}\n\n${JSON.stringify(result, null, 2)}`,
        }],
      };
    }
  );

  server.tool(
    "lyra_intel_repo_audit",
    `Perform a full repository code audit ($${LYRA_PRICES.intel.repoAudit})`,
    {
      repoUrl: z.string().url().describe("GitHub repository URL to audit"),
      branch: z.string().optional().default("main").describe("Branch to audit"),
      focus: z.array(z.enum(["security", "quality", "performance"])).optional()
        .describe("Focus areas for the audit"),
    },
    async ({ repoUrl, branch, focus }) => {
      const client = getLyraClient();
      const result = await client.intel.repoAudit(repoUrl, { branch, focus });
      return {
        content: [{
          type: "text",
          text: `Overall Score: ${result.overallScore}/100\n\nFiles Analyzed: ${result.analyzedFiles}\nIssues Found: ${result.issues.length}\n\n${JSON.stringify(result, null, 2)}`,
        }],
      };
    }
  );

  server.tool(
    "lyra_intel_enterprise_analysis",
    `Enterprise monorepo analysis for large codebases ($${LYRA_PRICES.intel.enterpriseAnalysis})`,
    {
      repoUrl: z.string().url().describe("GitHub repository URL"),
      branch: z.string().optional().default("main"),
      packageManager: z.enum(["npm", "yarn", "pnpm", "bun"]).optional(),
    },
    async ({ repoUrl, branch, packageManager }) => {
      const client = getLyraClient();
      const result = await client.intel.enterpriseAnalysis(repoUrl, { branch, packageManager });
      return {
        content: [{
          type: "text",
          text: `Enterprise Analysis\n\nPackages: ${result.monorepoInfo.packages}\nOverall Score: ${result.overallScore}/100\n\n${JSON.stringify(result, null, 2)}`,
        }],
      };
    }
  );

  // ==========================================================================
  // Lyra Registry Tools
  // ==========================================================================

  server.tool(
    "lyra_registry_browse",
    "Browse the MCP tool catalog (FREE)",
    {
      query: z.string().optional().describe("Search query"),
      category: z.enum(TOOL_CATEGORIES as unknown as [string, ...string[]]).optional()
        .describe("Filter by category"),
      sortBy: z.enum(["stars", "downloads", "updated", "name"]).optional().default("stars"),
      limit: z.number().optional().default(20).describe("Number of results"),
    },
    async ({ query, category, sortBy, limit }) => {
      const client = getLyraClient();
      const result = await client.registry.browse({ query, category, sortBy, limit });
      
      const toolList = result.tools
        .map(t => `- ${t.name} (${t.stars}⭐): ${t.description}`)
        .join("\n");
      
      return {
        content: [{
          type: "text",
          text: `Found ${result.total} tools:\n\n${toolList}`,
        }],
      };
    }
  );

  server.tool(
    "lyra_registry_tool_details",
    `Get detailed tool information with examples ($${LYRA_PRICES.registry.toolDetails})`,
    {
      toolId: z.string().describe("Tool ID or name"),
    },
    async ({ toolId }) => {
      const client = getLyraClient();
      const result = await client.registry.getToolDetails(toolId);
      return {
        content: [{
          type: "text",
          text: `# ${result.name} v${result.version}\n\n${result.description}\n\n## Examples\n\n${result.examples.map(e => `### ${e.title}\n\`\`\`${e.language}\n${e.code}\n\`\`\``).join("\n\n")}\n\n## Configuration\n\n${JSON.stringify(result.configuration, null, 2)}`,
        }],
      };
    }
  );

  server.tool(
    "lyra_registry_register",
    `Register a private MCP tool ($${LYRA_PRICES.registry.privateRegistration})`,
    {
      name: z.string().describe("Tool name"),
      description: z.string().describe("Tool description"),
      version: z.string().describe("Semantic version"),
      endpoint: z.string().url().describe("MCP server endpoint"),
      category: z.enum(TOOL_CATEGORIES as unknown as [string, ...string[]]),
      visibility: z.enum(["private", "organization", "public"]).default("private"),
    },
    async (params) => {
      const client = getLyraClient();
      const result = await client.registry.registerTool(params);
      return {
        content: [{
          type: "text",
          text: `✅ Tool Registered\n\nTool ID: ${result.toolId}\nAPI Key: ${result.apiKey}\n\n${result.message}`,
        }],
      };
    }
  );

  server.tool(
    "lyra_registry_trending",
    "Get trending MCP tools (FREE)",
    {
      limit: z.number().optional().default(10),
    },
    async ({ limit }) => {
      const client = getLyraClient();
      const tools = await client.registry.getTrending(limit);
      
      const toolList = tools
        .map((t, i) => `${i + 1}. ${t.name} (${t.stars}⭐, ${t.downloads} downloads)`)
        .join("\n");
      
      return {
        content: [{
          type: "text",
          text: `🔥 Trending MCP Tools\n\n${toolList}`,
        }],
      };
    }
  );

  // ==========================================================================
  // Lyra Discovery Tools
  // ==========================================================================

  server.tool(
    "lyra_discovery_discover",
    "Discover API endpoints and tools (FREE)",
    {
      apiUrl: z.string().url().describe("API URL to discover"),
    },
    async ({ apiUrl }) => {
      const client = getLyraClient();
      const result = await client.discovery.discover(apiUrl);
      
      const toolList = result.tools
        .map(t => `- ${t.method} ${t.endpoint}: ${t.description ?? "No description"}`)
        .join("\n");
      
      return {
        content: [{
          type: "text",
          text: `Protocol: ${result.protocol}\nTools Found: ${result.tools.length}\n\n${toolList}`,
        }],
      };
    }
  );

  server.tool(
    "lyra_discovery_analyze",
    `AI-analyzed MCP compatibility ($${LYRA_PRICES.discovery.compatibility})`,
    {
      apiUrl: z.string().url().describe("API URL to analyze"),
    },
    async ({ apiUrl }) => {
      const client = getLyraClient();
      const result = await client.discovery.analyze(apiUrl);
      return {
        content: [{
          type: "text",
          text: `MCP Compatible: ${result.mcpCompatible ? "✅ Yes" : "❌ No"}\nScore: ${result.compatibilityScore}/100\nEffort: ${result.estimatedEffort}\n\nIssues:\n${result.issues.map(i => `- [${i.type}] ${i.message}`).join("\n")}\n\nSuggestions:\n${result.suggestions.map(s => `- [${s.priority}] ${s.description}`).join("\n")}`,
        }],
      };
    }
  );

  server.tool(
    "lyra_discovery_generate_config",
    `Auto-generate MCP server configuration ($${LYRA_PRICES.discovery.generateConfig})`,
    {
      apiUrl: z.string().url().describe("API URL"),
      serverName: z.string().optional().describe("Name for the MCP server"),
      version: z.string().optional().default("1.0.0"),
    },
    async ({ apiUrl, serverName, version }) => {
      const client = getLyraClient();
      const result = await client.discovery.generateMcpConfig(apiUrl, { serverName, version });
      return {
        content: [{
          type: "text",
          text: `✅ MCP Config Generated\n\n\`\`\`json\n${JSON.stringify(result.config, null, 2)}\n\`\`\`\n\nSetup Instructions:\n${result.setupInstructions.map((s, i) => `${i + 1}. ${s}`).join("\n")}`,
        }],
      };
    }
  );

  server.tool(
    "lyra_discovery_full_assist",
    `Full integration assistance with code and tests ($${LYRA_PRICES.discovery.fullAssistance})`,
    {
      apiUrl: z.string().url().describe("API URL"),
      language: z.enum(["typescript", "python", "javascript"]).optional().default("typescript"),
    },
    async ({ apiUrl, language }) => {
      const client = getLyraClient();
      const result = await client.discovery.getFullAssistance(apiUrl, { targetLanguage: language });
      
      const snippets = result.codeSnippets
        .map(s => `### ${s.title}\n\n${s.description}\n\n\`\`\`${s.language}\n${s.code}\n\`\`\``)
        .join("\n\n");
      
      return {
        content: [{
          type: "text",
          text: `# Full Integration Assistance\n\n## Compatibility\n\nScore: ${result.fullAnalysis.compatibilityScore}/100\nMCP Compatible: ${result.fullAnalysis.mcpCompatible}\n\n## Code Snippets\n\n${snippets}\n\n## Documentation\n\n${result.documentation}`,
        }],
      };
    }
  );

  // ==========================================================================
  // Usage & Pricing Tools
  // ==========================================================================

  server.tool(
    "lyra_get_usage",
    "Get Lyra ecosystem usage statistics",
    {
      period: z.enum(["day", "week", "month", "all"]).optional().default("day"),
    },
    async ({ period }) => {
      const client = getLyraClient();
      const stats = client.getUsageStats(period);
      return {
        content: [{
          type: "text",
          text: `📊 Lyra Usage (${period})\n\nTotal Spent: $${stats.totalSpent}\nRequests: ${stats.requestCount}\n\nBy Service:\n- Intel: $${stats.byService.intel.spent} (${stats.byService.intel.requests} requests)\n- Registry: $${stats.byService.registry.spent} (${stats.byService.registry.requests} requests)\n- Discovery: $${stats.byService.discovery.spent} (${stats.byService.discovery.requests} requests)`,
        }],
      };
    }
  );

  server.tool(
    "lyra_get_pricing",
    "Get Lyra ecosystem pricing information",
    {},
    async () => {
      const pricing = LYRA_PRICES;
      
      const formatPricing = (service: string, prices: Record<string, string>) => {
        return Object.entries(prices)
          .map(([op, price]) => `  - ${op}: $${price}`)
          .join("\n");
      };
      
      return {
        content: [{
          type: "text",
          text: `💰 Lyra Ecosystem Pricing\n\n**Lyra Intel** (Code Analysis)\n${formatPricing("intel", pricing.intel)}\n\n**Lyra Registry** (Tool Catalog)\n${formatPricing("registry", pricing.registry)}\n\n**Lyra Discovery** (Auto-Discovery)\n${formatPricing("discovery", pricing.discovery)}`,
        }],
      };
    }
  );

  Logger.info("[Lyra] Registered 14 MCP tools for Lyra ecosystem");
}
