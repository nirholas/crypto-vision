/**
 * Full-Text Search Engine
 * @description In-memory full-text search with fuzzy matching, stemming, and synonyms
 * @author nirholas
 * @license Apache-2.0
 */

import MiniSearch, { type SearchResult as MiniSearchResult } from "minisearch"
import Logger from "@/utils/logger.js"
import type { RegisteredTool } from "../types.js"
import type {
  SearchResult,
  FullTextSearchOptions,
  SearchConfig,
  SynonymMap,
} from "./types.js"

/**
 * Default search configuration
 */
const DEFAULT_CONFIG: SearchConfig = {
  defaultFuzzy: true,
  defaultFuzzyDistance: 2,
  defaultStemming: true,
  defaultBoosts: {
    name: 5,
    displayName: 4,
    description: 2,
    tags: 3,
  },
  synonyms: [
    { term: "price", synonyms: ["cost", "rate", "fee", "charge", "pricing"] },
    { term: "crypto", synonyms: ["cryptocurrency", "token", "coin", "digital asset"] },
    { term: "swap", synonyms: ["exchange", "trade", "convert"] },
    { term: "wallet", synonyms: ["account", "address"] },
    { term: "defi", synonyms: ["decentralized finance", "yield", "lending", "borrowing"] },
    { term: "nft", synonyms: ["non-fungible token", "collectible", "digital art"] },
    { term: "api", synonyms: ["endpoint", "service", "interface"] },
    { term: "data", synonyms: ["information", "feed", "stream"] },
    { term: "analytics", synonyms: ["metrics", "statistics", "analysis", "insights"] },
    { term: "gas", synonyms: ["transaction fee", "network fee"] },
    { term: "bridge", synonyms: ["cross-chain", "transfer"] },
    { term: "oracle", synonyms: ["price feed", "data feed"] },
    { term: "weather", synonyms: ["climate", "forecast", "temperature"] },
    { term: "market", synonyms: ["trading", "exchange", "marketplace"] },
  ],
  stopWords: [
    "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "as", "is", "was", "are", "were", "been",
    "be", "have", "has", "had", "do", "does", "did", "will", "would",
    "could", "should", "may", "might", "must", "shall", "can", "need",
    "this", "that", "these", "those", "it", "its",
  ],
  minQueryLength: 1,
  maxResults: 100,
  embeddingModel: "text-embedding-3-small",
  minSemanticSimilarity: 0.5,
}

/**
 * Simple stemmer for English words
 */
function simpleStemmer(word: string): string {
  word = word.toLowerCase()

  // Common suffix removals
  const suffixes = [
    { suffix: "ies", replacement: "y" },
    { suffix: "ied", replacement: "y" },
    { suffix: "ing", replacement: "" },
    { suffix: "ed", replacement: "" },
    { suffix: "es", replacement: "" },
    { suffix: "s", replacement: "" },
    { suffix: "ly", replacement: "" },
    { suffix: "ment", replacement: "" },
    { suffix: "ness", replacement: "" },
    { suffix: "tion", replacement: "" },
    { suffix: "sion", replacement: "" },
    { suffix: "able", replacement: "" },
    { suffix: "ible", replacement: "" },
    { suffix: "ful", replacement: "" },
    { suffix: "less", replacement: "" },
  ]

  for (const { suffix, replacement } of suffixes) {
    if (word.endsWith(suffix) && word.length > suffix.length + 2) {
      return word.slice(0, -suffix.length) + replacement
    }
  }

  return word
}

/**
 * Calculate Levenshtein distance for fuzzy matching
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0]![j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i]![j] = matrix[i - 1]![j - 1]!
      } else {
        matrix[i]![j] = Math.min(
          matrix[i - 1]![j - 1]! + 1,
          matrix[i]![j - 1]! + 1,
          matrix[i - 1]![j]! + 1
        )
      }
    }
  }

  return matrix[b.length]![a.length]!
}

/**
 * Full-text search engine using MiniSearch
 */
export class FullTextSearchEngine {
  private miniSearch: MiniSearch<RegisteredTool>
  private config: SearchConfig
  private synonymIndex: Map<string, string[]>
  private tools: Map<string, RegisteredTool>
  private isIndexed: boolean = false

  constructor(config: Partial<SearchConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.tools = new Map()
    this.synonymIndex = new Map()

    // Build synonym index
    this.buildSynonymIndex()

    // Initialize MiniSearch
    this.miniSearch = new MiniSearch<RegisteredTool>({
      fields: ["name", "displayName", "description", "tagsText"],
      storeFields: ["toolId", "name", "displayName", "description", "category", "tags"],
      idField: "toolId",
      tokenize: (text: string) => this.tokenize(text),
      processTerm: (term: string) => this.processTerm(term),
      searchOptions: {
        boost: {
          name: this.config.defaultBoosts.name,
          displayName: this.config.defaultBoosts.displayName,
          description: this.config.defaultBoosts.description,
          tagsText: this.config.defaultBoosts.tags,
        },
        fuzzy: this.config.defaultFuzzy ? this.config.defaultFuzzyDistance / 10 : false,
        prefix: true,
      },
    })
  }

  /**
   * Build synonym index for quick lookup
   */
  private buildSynonymIndex(): void {
    this.synonymIndex.clear()

    for (const { term, synonyms } of this.config.synonyms) {
      // Add term -> synonyms mapping
      this.synonymIndex.set(term.toLowerCase(), synonyms.map(s => s.toLowerCase()))

      // Add reverse mappings (synonym -> term)
      for (const synonym of synonyms) {
        const existing = this.synonymIndex.get(synonym.toLowerCase()) || []
        if (!existing.includes(term.toLowerCase())) {
          existing.push(term.toLowerCase())
        }
        this.synonymIndex.set(synonym.toLowerCase(), existing)
      }
    }
  }

  /**
   * Tokenize text into words
   */
  private tokenize(text: string): string[] {
    if (!text) return []

    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, " ")
      .split(/\s+/)
      .filter(token => token.length > 0)
  }

  /**
   * Process a search term (stemming, lowercase)
   */
  private processTerm(term: string): string | null {
    if (!term) return null

    term = term.toLowerCase()

    // Skip stop words
    if (this.config.stopWords.includes(term)) {
      return null
    }

    // Apply stemming if enabled
    if (this.config.defaultStemming) {
      term = simpleStemmer(term)
    }

    return term.length > 0 ? term : null
  }

  /**
   * Expand query with synonyms
   */
  private expandQueryWithSynonyms(query: string): string {
    const tokens = this.tokenize(query)
    const expandedTokens: string[] = []

    for (const token of tokens) {
      expandedTokens.push(token)

      // Add synonyms
      const synonyms = this.synonymIndex.get(token)
      if (synonyms) {
        expandedTokens.push(...synonyms)
      }
    }

    return expandedTokens.join(" ")
  }

  /**
   * Index a collection of tools
   */
  async indexTools(tools: RegisteredTool[]): Promise<void> {
    // Clear existing index
    this.miniSearch.removeAll()
    this.tools.clear()

    // Prepare documents for indexing
    const documents = tools.map(tool => ({
      ...tool,
      tagsText: tool.tags?.join(" ") || "",
    }))

    // Add documents to index
    this.miniSearch.addAll(documents)

    // Store tools for retrieval
    for (const tool of tools) {
      this.tools.set(tool.toolId, tool)
    }

    this.isIndexed = true
    Logger.info(`Indexed ${tools.length} tools for full-text search`)
  }

  /**
   * Add a single tool to the index
   */
  async addTool(tool: RegisteredTool): Promise<void> {
    const document = {
      ...tool,
      tagsText: tool.tags?.join(" ") || "",
    }

    // Remove if exists
    if (this.tools.has(tool.toolId)) {
      this.miniSearch.discard(tool.toolId)
    }

    this.miniSearch.add(document)
    this.tools.set(tool.toolId, tool)
  }

  /**
   * Remove a tool from the index
   */
  async removeTool(toolId: string): Promise<void> {
    if (this.tools.has(toolId)) {
      this.miniSearch.discard(toolId)
      this.tools.delete(toolId)
    }
  }

  /**
   * Update a tool in the index
   */
  async updateTool(tool: RegisteredTool): Promise<void> {
    await this.removeTool(tool.toolId)
    await this.addTool(tool)
  }

  /**
   * Search tools with full-text search
   */
  async search(options: FullTextSearchOptions): Promise<SearchResult[]> {
    const {
      query,
      fuzzy = this.config.defaultFuzzy,
      fuzzyDistance = this.config.defaultFuzzyDistance,
      fields = ["name", "displayName", "description", "tags"],
      boosts = this.config.defaultBoosts,
      limit = 20,
      offset = 0,
    } = options

    if (!query || query.trim().length < this.config.minQueryLength) {
      return []
    }

    // Expand query with synonyms
    const expandedQuery = this.expandQueryWithSynonyms(query)

    // Configure search options
    const searchOptions = {
      fields: fields.map(f => f === "tags" ? "tagsText" : f),
      boost: {
        name: boosts.name || this.config.defaultBoosts.name,
        displayName: boosts.displayName || this.config.defaultBoosts.displayName,
        description: boosts.description || this.config.defaultBoosts.description,
        tagsText: boosts.tags || this.config.defaultBoosts.tags,
      },
      fuzzy: fuzzy ? fuzzyDistance / 10 : false,
      prefix: true,
      combineWith: "OR" as const,
    }

    // Perform search
    const miniSearchResults = this.miniSearch.search(expandedQuery, searchOptions)

    // Convert to SearchResult format with pagination
    const results: SearchResult[] = []

    for (let i = offset; i < Math.min(miniSearchResults.length, offset + limit); i++) {
      const msResult = miniSearchResults[i]
      if (!msResult) continue
      const tool = this.tools.get(msResult.id as string)

      if (tool) {
        results.push({
          tool,
          score: msResult.score / 100, // Normalize score to 0-1
          matchReasons: this.getMatchReasons(query, tool, msResult),
          highlights: this.getHighlights(query, tool),
        })
      }
    }

    return results
  }

  /**
   * Get match reasons for a result
   */
  private getMatchReasons(
    query: string,
    tool: RegisteredTool,
    msResult: MiniSearchResult
  ): string[] {
    const reasons: string[] = []
    const queryLower = query.toLowerCase()
    const queryTokens = this.tokenize(query)

    // Check name match
    if (tool.name.toLowerCase().includes(queryLower)) {
      reasons.push("name match")
    }

    // Check display name match
    if (tool.displayName.toLowerCase().includes(queryLower)) {
      reasons.push("display name match")
    }

    // Check description match
    if (tool.description.toLowerCase().includes(queryLower)) {
      reasons.push("description match")
    }

    // Check tag matches
    if (tool.tags?.some(tag => 
      queryTokens.some(token => tag.toLowerCase().includes(token))
    )) {
      reasons.push("tag match")
    }

    // Check synonym match
    for (const token of queryTokens) {
      const synonyms = this.synonymIndex.get(token)
      if (synonyms) {
        const toolText = `${tool.name} ${tool.displayName} ${tool.description} ${tool.tags?.join(" ")}`.toLowerCase()
        for (const synonym of synonyms) {
          if (toolText.includes(synonym)) {
            reasons.push(`synonym match: ${token} ≈ ${synonym}`)
            break
          }
        }
      }
    }

    // Add category info
    reasons.push(`category: ${tool.category}`)

    // Add score info if high
    if (msResult.score > 50) {
      reasons.push("high relevance score")
    }

    return [...new Set(reasons)] // Remove duplicates
  }

  /**
   * Get highlighted snippets
   */
  private getHighlights(query: string, tool: RegisteredTool): { field: string; snippet: string }[] {
    const highlights: { field: string; snippet: string }[] = []
    const queryTokens = this.tokenize(query)

    // Check description for highlights
    for (const token of queryTokens) {
      const descLower = tool.description.toLowerCase()
      const index = descLower.indexOf(token)

      if (index !== -1) {
        const start = Math.max(0, index - 30)
        const end = Math.min(tool.description.length, index + token.length + 30)
        let snippet = tool.description.slice(start, end)

        if (start > 0) snippet = "..." + snippet
        if (end < tool.description.length) snippet = snippet + "..."

        highlights.push({ field: "description", snippet })
        break
      }
    }

    return highlights
  }

  /**
   * Get search suggestions based on partial query
   */
  async getSuggestions(partialQuery: string, limit: number = 5): Promise<string[]> {
    if (!partialQuery || partialQuery.length < 2) {
      return []
    }

    // Use MiniSearch's autoSuggest feature
    const suggestions = this.miniSearch.autoSuggest(partialQuery, {
      fuzzy: 0.2,
    })

    return suggestions
      .slice(0, limit)
      .map((s: { suggestion: string }) => s.suggestion)
  }

  /**
   * Find similar queries for "did you mean" functionality
   */
  async findSimilarQueries(query: string): Promise<string[]> {
    const allTerms = new Set<string>()

    // Collect all indexed terms
    for (const tool of this.tools.values()) {
      this.tokenize(tool.name).forEach(t => allTerms.add(t))
      this.tokenize(tool.displayName).forEach(t => allTerms.add(t))
      tool.tags?.forEach(tag => this.tokenize(tag).forEach(t => allTerms.add(t)))
    }

    // Find terms with small edit distance
    const queryTokens = this.tokenize(query)
    const suggestions: string[] = []

    for (const token of queryTokens) {
      for (const term of allTerms) {
        const distance = levenshteinDistance(token, term)
        if (distance > 0 && distance <= 2 && term !== token) {
          suggestions.push(term)
        }
      }
    }

    return [...new Set(suggestions)].slice(0, 5)
  }

  /**
   * Get total indexed count
   */
  get indexedCount(): number {
    return this.tools.size
  }

  /**
   * Check if index is ready
   */
  get ready(): boolean {
    return this.isIndexed
  }

  /**
   * Get search configuration
   */
  getConfig(): SearchConfig {
    return { ...this.config }
  }

  /**
   * Update search configuration
   */
  updateConfig(config: Partial<SearchConfig>): void {
    this.config = { ...this.config, ...config }
    
    if (config.synonyms) {
      this.buildSynonymIndex()
    }
  }

  /**
   * Add custom synonyms
   */
  addSynonyms(synonymMaps: SynonymMap[]): void {
    this.config.synonyms.push(...synonymMaps)
    this.buildSynonymIndex()
  }
}

/**
 * Singleton instance
 */
export const fullTextSearch = new FullTextSearchEngine()
