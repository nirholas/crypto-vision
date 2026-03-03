/**
 * Web3 Research Tools
 * 
 * @author nich
 * @website https://x.com/nichxbt
 * @github https://github.com/nirholas
 * @license Apache-2.0
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Simple in-memory storage for research sessions
const researchStorage = new Map<string, ResearchSession>();

interface ResearchSection {
  description: string;
  sources: string[];
  status: "planned" | "in_progress" | "completed";
  data?: Record<string, unknown>;
}

interface ResearchSession {
  id: string;
  tokenName: string;
  tokenTicker: string;
  createdAt: Date;
  sections: Record<string, ResearchSection>;
  searchResults: Record<string, unknown>;
  notes: string[];
}

// Web search utility using DuckDuckGo (no API key required)
async function performSearch(query: string, type: "web" | "news" = "web"): Promise<{ results: SearchResult[] }> {
  const encodedQuery = encodeURIComponent(query);
  const url = `https://api.duckduckgo.com/?q=${encodedQuery}&format=json&no_html=1&skip_disambig=1`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    const results: SearchResult[] = [];
    
    // Abstract text (main result)
    if (data.Abstract) {
      results.push({
        title: data.Heading || query,
        url: data.AbstractURL || "",
        snippet: data.Abstract,
        source: data.AbstractSource || "DuckDuckGo",
      });
    }
    
    // Related topics
    if (data.RelatedTopics) {
      for (const topic of data.RelatedTopics.slice(0, 5)) {
        if (topic.Text && topic.FirstURL) {
          results.push({
            title: topic.Text.split(" - ")[0] || topic.Text.slice(0, 50),
            url: topic.FirstURL,
            snippet: topic.Text,
            source: "DuckDuckGo",
          });
        }
      }
    }
    
    return { results };
  } catch (error) {
    console.error("Search error:", error);
    return { results: [] };
  }
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

// Fetch content from URL
async function fetchContent(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ResearchBot/1.0)",
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const html = await response.text();
    
    // Basic HTML to text conversion (strip tags)
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 10000); // Limit content size
    
    return text;
  } catch (error) {
    return `Failed to fetch content: ${(error as Error).message}`;
  }
}

function getOrCreateSession(sessionId: string, tokenName?: string, tokenTicker?: string): ResearchSession {
  if (!researchStorage.has(sessionId)) {
    researchStorage.set(sessionId, {
      id: sessionId,
      tokenName: tokenName || "Unknown",
      tokenTicker: tokenTicker || "???",
      createdAt: new Date(),
      sections: {},
      searchResults: {},
      notes: [],
    });
  }
  return researchStorage.get(sessionId)!;
}

export function registerResearchTools(server: McpServer): void {
  server.tool(
    "research_create_plan",
    "Create a structured research plan for investigating a cryptocurrency token",
    {
      tokenName: z.string().describe("Name of the token (e.g., Ethereum)"),
      tokenTicker: z.string().describe("Ticker symbol (e.g., ETH)"),
      sessionId: z.string().optional().describe("Session ID to continue existing research"),
    },
    async ({ tokenName, tokenTicker, sessionId }) => {
      const id = sessionId || `research_${tokenTicker.toLowerCase()}_${Date.now()}`;
      const session = getOrCreateSession(id, tokenName, tokenTicker);
      
      // Create comprehensive research plan
      session.sections = {
        projectInfo: {
          description: "Gather basic information about the project",
          sources: ["Project website", "Documentation", "CoinMarketCap", "CoinGecko"],
          status: "planned",
        },
        technicalFundamentals: {
          description: "Analyze the token's technical aspects and blockchain",
          sources: ["Documentation", "GitHub", "Token contract", "Block explorer"],
          status: "planned",
        },
        marketStatus: {
          description: "Evaluate current market performance and metrics",
          sources: ["CoinMarketCap", "CoinGecko", "TradingView", "DEX aggregators"],
          status: "planned",
        },
        tokenomics: {
          description: "Analyze token distribution, supply, and economic model",
          sources: ["Whitepaper", "Token contract", "Analytics platforms"],
          status: "planned",
        },
        listings: {
          description: "Find where the token is traded",
          sources: ["CoinGecko", "CoinMarketCap", "DEX aggregators"],
          status: "planned",
        },
        news: {
          description: "Gather recent news and updates about the token",
          sources: ["Crypto news sites", "Twitter/X", "Medium", "Official blog"],
          status: "planned",
        },
        community: {
          description: "Analyze the project's community engagement",
          sources: ["Twitter/X", "Discord", "Telegram", "Reddit"],
          status: "planned",
        },
        competitors: {
          description: "Identify and compare with competing projects",
          sources: ["Industry analysis", "Comparison sites"],
          status: "planned",
        },
        risks: {
          description: "Assess potential risks and concerns",
          sources: ["Security audits", "Smart contract analysis", "News"],
          status: "planned",
        },
        teamInfo: {
          description: "Research the team behind the project",
          sources: ["Project website", "LinkedIn", "Twitter/X", "Previous projects"],
          status: "planned",
        },
      };
      
      session.tokenName = tokenName;
      session.tokenTicker = tokenTicker;
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            message: `Created research plan for ${tokenName} (${tokenTicker})`,
            sessionId: id,
            sections: Object.entries(session.sections).map(([key, section]) => ({
              name: key,
              description: section.description,
              status: section.status,
              sources: section.sources,
            })),
          }, null, 2),
        }],
      };
    }
  );

  server.tool(
    "research_search",
    "Perform a web search for cryptocurrency research",
    {
      query: z.string().describe("Search query"),
      sessionId: z.string().optional().describe("Session ID to store results"),
      section: z.string().optional().describe("Research section this search relates to"),
    },
    async ({ query, sessionId, section }) => {
      const results = await performSearch(query);
      
      if (sessionId) {
        const session = getOrCreateSession(sessionId);
        const key = `search_${Date.now()}`;
        session.searchResults[key] = {
          query,
          section,
          results: results.results,
          timestamp: new Date().toISOString(),
        };
        
        if (section && session.sections[section]) {
          session.sections[section].status = "in_progress";
        }
      }
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            query,
            resultCount: results.results.length,
            results: results.results.map(r => ({
              title: r.title,
              url: r.url,
              snippet: r.snippet.slice(0, 200),
            })),
          }, null, 2),
        }],
      };
    }
  );

  server.tool(
    "research_fetch_url",
    "Fetch and extract text content from a URL",
    {
      url: z.string().url().describe("URL to fetch content from"),
      sessionId: z.string().optional().describe("Session ID to store content"),
    },
    async ({ url, sessionId }) => {
      const content = await fetchContent(url);
      
      if (sessionId) {
        const session = getOrCreateSession(sessionId);
        session.searchResults[`fetch_${Date.now()}`] = {
          url,
          content: content.slice(0, 5000),
          timestamp: new Date().toISOString(),
        };
      }
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            url,
            contentLength: content.length,
            content: content.slice(0, 5000),
          }, null, 2),
        }],
      };
    }
  );

  server.tool(
    "research_update_section",
    "Update the status of a research section",
    {
      sessionId: z.string().describe("Session ID"),
      section: z.string().describe("Section name to update"),
      status: z.enum(["planned", "in_progress", "completed"]).describe("New status"),
      notes: z.string().optional().describe("Notes or findings to add"),
    },
    async ({ sessionId, section, status, notes }) => {
      const session = getOrCreateSession(sessionId);
      
      if (!session.sections[section]) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ error: `Section '${section}' not found` }),
          }],
        };
      }
      
      session.sections[section].status = status;
      
      if (notes) {
        session.notes.push(`[${section}] ${notes}`);
        if (!session.sections[section].data) {
          session.sections[section].data = {};
        }
        session.sections[section].data!.notes = notes;
      }
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            message: `Updated ${section} to ${status}`,
            section: session.sections[section],
          }, null, 2),
        }],
      };
    }
  );

  server.tool(
    "research_get_status",
    "Get the current status of a research session",
    {
      sessionId: z.string().describe("Session ID"),
    },
    async ({ sessionId }) => {
      if (!researchStorage.has(sessionId)) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ error: "Session not found" }),
          }],
        };
      }
      
      const session = researchStorage.get(sessionId)!;
      
      const progress = {
        total: Object.keys(session.sections).length,
        completed: Object.values(session.sections).filter(s => s.status === "completed").length,
        inProgress: Object.values(session.sections).filter(s => s.status === "in_progress").length,
        planned: Object.values(session.sections).filter(s => s.status === "planned").length,
      };
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            sessionId,
            token: `${session.tokenName} (${session.tokenTicker})`,
            createdAt: session.createdAt.toISOString(),
            progress,
            sections: Object.entries(session.sections).map(([key, section]) => ({
              name: key,
              status: section.status,
              hasData: !!section.data,
            })),
            searchCount: Object.keys(session.searchResults).length,
            notesCount: session.notes.length,
          }, null, 2),
        }],
      };
    }
  );

  server.tool(
    "research_add_note",
    "Add a note or finding to the research session",
    {
      sessionId: z.string().describe("Session ID"),
      note: z.string().describe("Note or finding to add"),
      section: z.string().optional().describe("Related section"),
    },
    async ({ sessionId, note, section }) => {
      const session = getOrCreateSession(sessionId);
      
      const formattedNote = section ? `[${section}] ${note}` : note;
      session.notes.push(formattedNote);
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            message: "Note added",
            totalNotes: session.notes.length,
          }),
        }],
      };
    }
  );

  server.tool(
    "research_export",
    "Export the complete research session data",
    {
      sessionId: z.string().describe("Session ID"),
    },
    async ({ sessionId }) => {
      if (!researchStorage.has(sessionId)) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ error: "Session not found" }),
          }],
        };
      }
      
      const session = researchStorage.get(sessionId)!;
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            sessionId: session.id,
            token: {
              name: session.tokenName,
              ticker: session.tokenTicker,
            },
            createdAt: session.createdAt.toISOString(),
            sections: session.sections,
            searchResults: Object.keys(session.searchResults).length > 10 
              ? `${Object.keys(session.searchResults).length} search results (truncated)`
              : session.searchResults,
            notes: session.notes,
          }, null, 2),
        }],
      };
    }
  );

  server.tool(
    "research_quick_lookup",
    "Quick lookup of basic token information from multiple sources",
    {
      tokenName: z.string().describe("Token name or ticker"),
    },
    async ({ tokenName }) => {
      const queries = [
        `${tokenName} cryptocurrency`,
        `${tokenName} token price`,
        `${tokenName} crypto market cap`,
      ];
      
      const allResults: SearchResult[] = [];
      
      for (const query of queries) {
        const results = await performSearch(query);
        allResults.push(...results.results);
        await new Promise(resolve => setTimeout(resolve, 500)); // Rate limiting
      }
      
      // Dedupe by URL
      const uniqueResults = allResults.filter((result, index, self) =>
        index === self.findIndex(r => r.url === result.url)
      );
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            token: tokenName,
            resultCount: uniqueResults.length,
            results: uniqueResults.slice(0, 10).map(r => ({
              title: r.title,
              url: r.url,
              snippet: r.snippet.slice(0, 150),
            })),
          }, null, 2),
        }],
      };
    }
  );
}
