/**
 * Semantic Search Engine
 * @description Vector similarity search using OpenAI embeddings
 * @author nirholas
 * @license Apache-2.0
 */

import OpenAI from "openai"
import Logger from "@/utils/logger.js"
import type { RegisteredTool } from "../types.js"
import type {
  SearchResult,
  SemanticSearchOptions,
  ToolEmbedding,
} from "./types.js"

/**
 * Cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have same length")
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    const aVal = a[i]!
    const bVal = b[i]!
    dotProduct += aVal * bVal
    normA += aVal * aVal
    normB += bVal * bVal
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB)
  return magnitude === 0 ? 0 : dotProduct / magnitude
}

/**
 * Euclidean distance between two vectors
 */
function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have same length")
  }

  let sum = 0
  for (let i = 0; i < a.length; i++) {
    const diff = a[i]! - b[i]!
    sum += diff ** 2
  }

  return Math.sqrt(sum)
}

/**
 * Semantic search engine using OpenAI embeddings
 */
export class SemanticSearchEngine {
  private openai: OpenAI | null = null
  private embeddings: Map<string, ToolEmbedding> = new Map()
  private tools: Map<string, RegisteredTool> = new Map()
  private embeddingModel: string
  private embeddingDimensions: number
  private cacheEnabled: boolean
  private initialized: boolean = false

  constructor(options: {
    apiKey?: string
    model?: string
    dimensions?: number
    cacheEnabled?: boolean
  } = {}) {
    this.embeddingModel = options.model || "text-embedding-3-small"
    this.embeddingDimensions = options.dimensions || 1536
    this.cacheEnabled = options.cacheEnabled ?? true

    // Initialize OpenAI client if API key available
    const apiKey = options.apiKey || process.env.OPENAI_API_KEY
    if (apiKey) {
      this.openai = new OpenAI({ apiKey })
      this.initialized = true
    }
  }

  /**
   * Initialize with API key
   */
  initialize(apiKey: string): void {
    this.openai = new OpenAI({ apiKey })
    this.initialized = true
    Logger.info("Semantic search engine initialized")
  }

  /**
   * Check if engine is ready
   */
  get ready(): boolean {
    return this.initialized && this.openai !== null
  }

  /**
   * Get embedding for text using OpenAI API
   */
  private async getEmbedding(text: string): Promise<number[]> {
    if (!this.openai) {
      throw new Error("OpenAI client not initialized")
    }

    const response = await this.openai.embeddings.create({
      model: this.embeddingModel,
      input: text,
      dimensions: this.embeddingDimensions,
    })

    const embedding = response.data[0]?.embedding
    if (!embedding) {
      throw new Error("Failed to get embedding from OpenAI")
    }
    return embedding
  }

  /**
   * Create searchable text from a tool
   */
  private createSearchableText(tool: RegisteredTool): string {
    const parts = [
      tool.name,
      tool.displayName,
      tool.description,
      tool.category,
      ...(tool.tags || []),
    ]

    return parts.filter(Boolean).join(" ")
  }

  /**
   * Index a collection of tools
   */
  async indexTools(tools: RegisteredTool[]): Promise<void> {
    this.tools.clear()

    for (const tool of tools) {
      this.tools.set(tool.toolId, tool)
    }

    // Generate embeddings in batches
    const batchSize = 20
    const toolsArray = Array.from(tools)

    for (let i = 0; i < toolsArray.length; i += batchSize) {
      const batch = toolsArray.slice(i, i + batchSize)
      await this.indexToolBatch(batch)
    }

    Logger.info(`Indexed ${tools.length} tools for semantic search`)
  }

  /**
   * Index a batch of tools
   */
  private async indexToolBatch(tools: RegisteredTool[]): Promise<void> {
    if (!this.openai) {
      Logger.warn("Semantic search not initialized - skipping indexing")
      return
    }

    const textsToEmbed: { toolId: string; text: string }[] = []

    for (const tool of tools) {
      // Check cache first
      if (this.cacheEnabled && this.embeddings.has(tool.toolId)) {
        const cached = this.embeddings.get(tool.toolId)!
        const currentText = this.createSearchableText(tool)
        
        // Skip if text hasn't changed
        if (cached.embeddedText === currentText) {
          continue
        }
      }

      textsToEmbed.push({
        toolId: tool.toolId,
        text: this.createSearchableText(tool),
      })
    }

    if (textsToEmbed.length === 0) {
      return
    }

    try {
      // Batch embedding request
      const response = await this.openai.embeddings.create({
        model: this.embeddingModel,
        input: textsToEmbed.map(t => t.text),
        dimensions: this.embeddingDimensions,
      })

      // Store embeddings
      for (let i = 0; i < textsToEmbed.length; i++) {
        const item = textsToEmbed[i]!
        const { toolId, text } = item
        const embedding = response.data[i]!.embedding

        this.embeddings.set(toolId, {
          toolId,
          embedding,
          embeddedText: text,
          model: this.embeddingModel,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })
      }
    } catch (error) {
      Logger.error(`Failed to generate embeddings: ${error}`)
      throw error
    }
  }

  /**
   * Add a single tool to the index
   */
  async addTool(tool: RegisteredTool): Promise<void> {
    this.tools.set(tool.toolId, tool)
    await this.indexToolBatch([tool])
  }

  /**
   * Remove a tool from the index
   */
  async removeTool(toolId: string): Promise<void> {
    this.tools.delete(toolId)
    this.embeddings.delete(toolId)
  }

  /**
   * Update a tool in the index
   */
  async updateTool(tool: RegisteredTool): Promise<void> {
    this.tools.set(tool.toolId, tool)
    
    // Force re-embedding by removing cache
    this.embeddings.delete(tool.toolId)
    await this.indexToolBatch([tool])
  }

  /**
   * Search tools using semantic similarity
   */
  async search(options: SemanticSearchOptions): Promise<SearchResult[]> {
    const {
      query,
      similarTo,
      minSimilarity = 0.5,
      limit = 20,
      offset = 0,
    } = options

    if (!this.openai && !similarTo) {
      Logger.warn("Semantic search not initialized")
      return []
    }

    let queryEmbedding: number[]

    if (similarTo) {
      // Find tools similar to a specific tool
      const toolEmbedding = this.embeddings.get(similarTo)
      if (!toolEmbedding) {
        throw new Error(`Tool not found in index: ${similarTo}`)
      }
      queryEmbedding = toolEmbedding.embedding
    } else if (query) {
      // Embed the natural language query
      queryEmbedding = await this.getEmbedding(query)
    } else {
      throw new Error("Either query or similarTo must be provided")
    }

    // Calculate similarities
    const similarities: { toolId: string; similarity: number }[] = []

    for (const [toolId, embedding] of this.embeddings) {
      // Skip the source tool if finding similar
      if (similarTo && toolId === similarTo) {
        continue
      }

      const similarity = cosineSimilarity(queryEmbedding, embedding.embedding)

      if (similarity >= minSimilarity) {
        similarities.push({ toolId, similarity })
      }
    }

    // Sort by similarity descending
    similarities.sort((a, b) => b.similarity - a.similarity)

    // Apply pagination
    const paginatedResults = similarities.slice(offset, offset + limit)

    // Build search results
    const results: SearchResult[] = []

    for (const { toolId, similarity } of paginatedResults) {
      const tool = this.tools.get(toolId)
      if (tool) {
        results.push({
          tool,
          score: similarity,
          matchReasons: this.getMatchReasons(query || "", tool, similarity, !!similarTo),
        })
      }
    }

    return results
  }

  /**
   * Find tools similar to a given tool
   */
  async findSimilar(
    toolId: string,
    options: { limit?: number; minSimilarity?: number } = {}
  ): Promise<SearchResult[]> {
    return this.search({
      query: "",
      similarTo: toolId,
      limit: options.limit || 10,
      minSimilarity: options.minSimilarity || 0.6,
    })
  }

  /**
   * Natural language search
   */
  async naturalLanguageSearch(
    query: string,
    options: { limit?: number; minSimilarity?: number } = {}
  ): Promise<SearchResult[]> {
    return this.search({
      query,
      limit: options.limit || 20,
      minSimilarity: options.minSimilarity || 0.5,
    })
  }

  /**
   * Get match reasons for semantic search result
   */
  private getMatchReasons(
    query: string,
    tool: RegisteredTool,
    similarity: number,
    isSimilarSearch: boolean
  ): string[] {
    const reasons: string[] = []

    if (isSimilarSearch) {
      reasons.push("semantic similarity to reference tool")
    } else {
      reasons.push("semantic match to query")
    }

    // Add similarity level description
    if (similarity >= 0.9) {
      reasons.push("extremely high relevance")
    } else if (similarity >= 0.8) {
      reasons.push("very high relevance")
    } else if (similarity >= 0.7) {
      reasons.push("high relevance")
    } else if (similarity >= 0.6) {
      reasons.push("good relevance")
    } else {
      reasons.push("moderate relevance")
    }

    // Add category info
    reasons.push(`category: ${tool.category}`)

    // Check for keyword overlap if query provided
    if (query) {
      const queryWords = query.toLowerCase().split(/\s+/)
      const toolText = `${tool.name} ${tool.displayName} ${tool.description}`.toLowerCase()

      for (const word of queryWords) {
        if (word.length > 2 && toolText.includes(word)) {
          reasons.push(`contains "${word}"`)
        }
      }
    }

    return [...new Set(reasons)]
  }

  /**
   * Get cached embeddings count
   */
  get embeddingsCount(): number {
    return this.embeddings.size
  }

  /**
   * Get tool count
   */
  get toolCount(): number {
    return this.tools.size
  }

  /**
   * Clear embedding cache
   */
  clearCache(): void {
    this.embeddings.clear()
  }

  /**
   * Export embeddings for persistence
   */
  exportEmbeddings(): ToolEmbedding[] {
    return Array.from(this.embeddings.values())
  }

  /**
   * Import embeddings from persistence
   */
  importEmbeddings(embeddings: ToolEmbedding[]): void {
    for (const embedding of embeddings) {
      this.embeddings.set(embedding.toolId, embedding)
    }
    Logger.info(`Imported ${embeddings.length} embeddings`)
  }

  /**
   * Get embedding for a specific tool
   */
  getToolEmbedding(toolId: string): ToolEmbedding | undefined {
    return this.embeddings.get(toolId)
  }

  /**
   * Calculate similarity between two tools
   */
  async calculateToolSimilarity(toolIdA: string, toolIdB: string): Promise<number> {
    const embeddingA = this.embeddings.get(toolIdA)
    const embeddingB = this.embeddings.get(toolIdB)

    if (!embeddingA || !embeddingB) {
      throw new Error("One or both tools not found in index")
    }

    return cosineSimilarity(embeddingA.embedding, embeddingB.embedding)
  }

  /**
   * Cluster tools by similarity (simple k-means-like approach)
   */
  async clusterTools(numClusters: number = 5): Promise<Map<number, string[]>> {
    const toolIds = Array.from(this.embeddings.keys())
    const embeddings = toolIds.map(id => this.embeddings.get(id)!.embedding)

    // Initialize centroids randomly
    const centroids: number[][] = []
    const usedIndices = new Set<number>()

    while (centroids.length < numClusters && centroids.length < toolIds.length) {
      const idx = Math.floor(Math.random() * toolIds.length)
      if (!usedIndices.has(idx)) {
        usedIndices.add(idx)
        const embedding = embeddings[idx]
        if (embedding) {
          centroids.push([...embedding])
        }
      }
    }

    // Assign tools to clusters
    const clusters = new Map<number, string[]>()

    for (let i = 0; i < toolIds.length; i++) {
      let bestCluster = 0
      let bestSimilarity = -1
      const embedding = embeddings[i]
      if (!embedding) continue

      for (let c = 0; c < centroids.length; c++) {
        const centroid = centroids[c]
        if (!centroid) continue
        const similarity = cosineSimilarity(embedding, centroid)
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity
          bestCluster = c
        }
      }

      if (!clusters.has(bestCluster)) {
        clusters.set(bestCluster, [])
      }
      const toolId = toolIds[i]
      if (toolId) {
        clusters.get(bestCluster)!.push(toolId)
      }
    }

    return clusters
  }
}

/**
 * Singleton instance
 */
export const semanticSearch = new SemanticSearchEngine()
