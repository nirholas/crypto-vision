/**
 * Sperax MCP Server - DeFi Agents Tools
 *
 * Integration with SperaxOS DeFi Agents API
 * Provides access to 78+ production-ready AI agent definitions
 * for DeFi, portfolio management, trading, and Web3 workflows.
 *
 * API: https://sperax.click
 * Repository: https://github.com/speraxos/SperaxOS-Defi-Agents
 */

import { z } from 'zod';

// ============================================================================
// Constants
// ============================================================================

const AGENTS_API_BASE = 'https://sperax.click';

const SUPPORTED_LOCALES = [
  'en-US', 'zh-CN', 'zh-TW', 'ja-JP', 'ko-KR', 'de-DE', 'fr-FR', 'es-ES',
  'ru-RU', 'ar-SA', 'pt-BR', 'it-IT', 'nl-NL', 'pl-PL', 'vi-VN', 'tr-TR',
  'sv-SE', 'id-ID'
] as const;

const AGENT_CATEGORIES = [
  'sperax', 'defi', 'trading', 'portfolio', 'security', 'analytics',
  'education', 'research', 'governance', 'yield', 'nft'
] as const;

// ============================================================================
// Types
// ============================================================================

interface AgentMeta {
  title: string;
  description: string;
  avatar: string;
  tags: string[];
  category?: string;
}

interface AgentConfig {
  systemRole: string;
  openingMessage?: string;
  openingQuestions?: string[];
}

interface Agent {
  author: string;
  identifier: string;
  meta: AgentMeta;
  config: AgentConfig;
  schemaVersion: number;
  createAt: string;
  homepage?: string;
}

interface AgentsIndex {
  agents: Agent[];
}

// ============================================================================
// Helper Functions
// ============================================================================

async function fetchAgentsIndex(locale: string = 'en-US'): Promise<AgentsIndex> {
  const url = locale === 'en-US' 
    ? `${AGENTS_API_BASE}/index.json`
    : `${AGENTS_API_BASE}/index.${locale}.json`;
  
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'SperaxOS-MCP/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch agents index: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function fetchAgent(identifier: string, locale: string = 'en-US'): Promise<Agent> {
  const filename = locale === 'en-US' 
    ? `${identifier}.json`
    : `${identifier}.${locale}.json`;
  
  const response = await fetch(`${AGENTS_API_BASE}/${filename}`, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'SperaxOS-MCP/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch agent '${identifier}': ${response.status} ${response.statusText}`);
  }

  return response.json();
}

function filterAgentsByTags(agents: Agent[], tags: string[]): Agent[] {
  const normalizedTags = tags.map(t => t.toLowerCase());
  return agents.filter(agent => 
    agent.meta.tags.some(tag => normalizedTags.includes(tag.toLowerCase()))
  );
}

function filterAgentsByCategory(agents: Agent[], category: string): Agent[] {
  const normalizedCategory = category.toLowerCase();
  return agents.filter(agent => {
    // Check explicit category
    if (agent.meta.category?.toLowerCase() === normalizedCategory) return true;
    // Check tags for category-like matches
    return agent.meta.tags.some(tag => tag.toLowerCase() === normalizedCategory);
  });
}

// ============================================================================
// Input Schemas
// ============================================================================

const ListAgentsInput = z.object({
  category: z
    .enum(AGENT_CATEGORIES)
    .optional()
    .describe('Filter agents by category'),
  tags: z
    .array(z.string())
    .optional()
    .describe('Filter agents by tags (e.g., ["yield", "farming"])'),
  locale: z
    .enum(SUPPORTED_LOCALES)
    .optional()
    .default('en-US')
    .describe('Language/locale for agent content'),
  limit: z
    .number()
    .min(1)
    .max(50)
    .optional()
    .default(20)
    .describe('Maximum number of agents to return'),
});

const GetAgentInput = z.object({
  identifier: z
    .string()
    .min(1)
    .describe('Unique agent identifier (e.g., "defi-yield-optimizer")'),
  locale: z
    .enum(SUPPORTED_LOCALES)
    .optional()
    .default('en-US')
    .describe('Language/locale for agent content'),
});

const SearchAgentsInput = z.object({
  query: z
    .string()
    .min(1)
    .describe('Search query to find agents by title, description, or tags'),
  locale: z
    .enum(SUPPORTED_LOCALES)
    .optional()
    .default('en-US')
    .describe('Language/locale for agent content'),
  limit: z
    .number()
    .min(1)
    .max(30)
    .optional()
    .default(10)
    .describe('Maximum number of results'),
});

const GetSperaxAgentsInput = z.object({
  locale: z
    .enum(SUPPORTED_LOCALES)
    .optional()
    .default('en-US')
    .describe('Language/locale for agent content'),
});

// ============================================================================
// Tool Definitions
// ============================================================================

export const agentsTools = [
  {
    name: 'agents_list',
    description:
      'List available DeFi AI agents from the Sperax ecosystem. Returns agent definitions with system prompts, capabilities, and metadata. Agents cover DeFi, trading, portfolio management, security, and education.',
    inputSchema: ListAgentsInput,
    handler: async (params: z.infer<typeof ListAgentsInput>) => {
      try {
        const { category, tags, locale, limit } = params;
        const data = await fetchAgentsIndex(locale);
        
        let agents = data.agents || [];

        // Apply category filter
        if (category) {
          agents = filterAgentsByCategory(agents, category);
        }

        // Apply tags filter
        if (tags && tags.length > 0) {
          agents = filterAgentsByTags(agents, tags);
        }

        // Limit results
        agents = agents.slice(0, limit);

        return {
          agents: agents.map(agent => ({
            identifier: agent.identifier,
            title: agent.meta.title,
            description: agent.meta.description,
            avatar: agent.meta.avatar,
            tags: agent.meta.tags,
            author: agent.author,
            createdAt: agent.createAt,
          })),
          totalCount: agents.length,
          locale,
          filters: { category, tags },
        };
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : 'Failed to fetch agents',
          agents: [],
          totalCount: 0,
        };
      }
    },
  },

  {
    name: 'agents_get',
    description:
      'Get complete details for a specific DeFi AI agent including its full system prompt, opening message, and suggested questions. Use this to understand an agent\'s capabilities or to use its prompt in your own application.',
    inputSchema: GetAgentInput,
    handler: async (params: z.infer<typeof GetAgentInput>) => {
      try {
        const { identifier, locale } = params;
        const agent = await fetchAgent(identifier, locale);

        return {
          identifier: agent.identifier,
          title: agent.meta.title,
          description: agent.meta.description,
          avatar: agent.meta.avatar,
          tags: agent.meta.tags,
          author: agent.author,
          homepage: agent.homepage,
          createdAt: agent.createAt,
          systemRole: agent.config.systemRole,
          openingMessage: agent.config.openingMessage,
          openingQuestions: agent.config.openingQuestions,
          locale,
        };
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : 'Failed to fetch agent',
          identifier: params.identifier,
        };
      }
    },
  },

  {
    name: 'agents_search',
    description:
      'Search for DeFi AI agents by keyword. Searches agent titles, descriptions, and tags to find relevant agents for specific use cases.',
    inputSchema: SearchAgentsInput,
    handler: async (params: z.infer<typeof SearchAgentsInput>) => {
      try {
        const { query, locale, limit } = params;
        const data = await fetchAgentsIndex(locale);
        
        const normalizedQuery = query.toLowerCase();
        const agents = (data.agents || []).filter(agent => {
          const searchText = [
            agent.meta.title,
            agent.meta.description,
            ...agent.meta.tags,
            agent.identifier,
          ].join(' ').toLowerCase();
          
          return searchText.includes(normalizedQuery);
        }).slice(0, limit);

        return {
          query,
          results: agents.map(agent => ({
            identifier: agent.identifier,
            title: agent.meta.title,
            description: agent.meta.description,
            avatar: agent.meta.avatar,
            tags: agent.meta.tags,
            relevance: agent.meta.title.toLowerCase().includes(normalizedQuery) ? 'high' : 'medium',
          })),
          totalCount: agents.length,
          locale,
        };
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : 'Failed to search agents',
          query: params.query,
          results: [],
        };
      }
    },
  },

  {
    name: 'agents_get_sperax',
    description:
      'Get all Sperax ecosystem-specific AI agents. Returns agents specialized for USDs, SPA, veSPA, governance, yield optimization, and other Sperax protocol features.',
    inputSchema: GetSperaxAgentsInput,
    handler: async (params: z.infer<typeof GetSperaxAgentsInput>) => {
      try {
        const { locale } = params;
        const data = await fetchAgentsIndex(locale);
        
        // Filter for Sperax-related agents
        const speraxAgents = (data.agents || []).filter(agent => {
          const searchText = [
            agent.identifier,
            agent.meta.title,
            ...agent.meta.tags,
          ].join(' ').toLowerCase();
          
          return searchText.includes('sperax') || 
                 searchText.includes('usds') || 
                 searchText.includes('spa') ||
                 searchText.includes('vespa');
        });

        return {
          agents: speraxAgents.map(agent => ({
            identifier: agent.identifier,
            title: agent.meta.title,
            description: agent.meta.description,
            avatar: agent.meta.avatar,
            tags: agent.meta.tags,
            systemRole: agent.config.systemRole.substring(0, 500) + '...',
          })),
          totalCount: speraxAgents.length,
          locale,
          categories: [
            'USDs Stablecoin',
            'SPA Token',
            'veSPA Staking',
            'Governance',
            'Yield Optimization',
            'Portfolio Management',
          ],
        };
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : 'Failed to fetch Sperax agents',
          agents: [],
        };
      }
    },
  },

  {
    name: 'agents_get_categories',
    description:
      'Get available agent categories and their counts. Useful for discovering what types of AI agents are available in the ecosystem.',
    inputSchema: z.object({
      locale: z
        .enum(SUPPORTED_LOCALES)
        .optional()
        .default('en-US')
        .describe('Language/locale'),
    }),
    handler: async (params: { locale?: string }) => {
      try {
        const data = await fetchAgentsIndex(params.locale || 'en-US');
        
        // Count agents by tag
        const tagCounts: Record<string, number> = {};
        for (const agent of data.agents || []) {
          for (const tag of agent.meta.tags) {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
          }
        }

        // Sort by count
        const sortedTags = Object.entries(tagCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 30);

        return {
          categories: sortedTags.map(([tag, count]) => ({
            name: tag,
            count,
          })),
          totalAgents: (data.agents || []).length,
          supportedLocales: SUPPORTED_LOCALES,
        };
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : 'Failed to fetch categories',
          categories: [],
        };
      }
    },
  },
];
