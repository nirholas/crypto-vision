/**
 * Crypto Vision — Unified Semantic Search Engine
 *
 * Combines multiple data sources (coins, protocols, news, yields, semantic embeddings)
 * into a single intelligent search interface. Supports natural language queries with
 * automatic intent detection and strategy routing.
 *
 * Search Pipeline:
 *  1. Detect user intent from query (price lookup, yield search, comparison, etc.)
 *  2. Route to appropriate search strategies in parallel
 *  3. Merge, deduplicate, and rank results by relevance
 *  4. Generate related search suggestions
 *  5. Cache results for fast repeated queries
 *
 * Integrations:
 *  - CoinGecko: coin name/symbol search
 *  - DeFiLlama: protocol TVL search, yield pool search
 *  - Crypto News: article keyword search
 *  - Vector Store: semantic similarity search via embeddings
 *
 * Performance targets:
 *  - Cache hit: <5ms
 *  - Simple intent (price_lookup): <500ms
 *  - Multi-source (general): <2s
 */

import { searchCoins } from "../sources/coingecko.js";
import { searchNews } from "../sources/crypto-news.js";
import { getProtocols, getYieldPools } from "../sources/defillama.js";
import { cache } from "./cache.js";
import { generateEmbedding } from "./embeddings.js";
import { log } from "./logger.js";
import { vectorStore } from "./vector-store.js";

// ─── Types ───────────────────────────────────────────────────

export interface SearchResult {
    /** Unique result ID in format `type:identifier` */
    id: string;
    /** Category of the result */
    type: "coin" | "protocol" | "news" | "agent" | "pool" | "chain" | "concept";
    /** Human-readable title */
    title: string;
    /** Short description or summary */
    description: string;
    /** Relevance score (0–1, higher = more relevant) */
    relevanceScore: number;
    /** Type-specific structured data */
    data: Record<string, unknown>;
    /** Optional external URL */
    url?: string;
}

export interface SearchOptions {
    /** Filter results by type */
    types?: SearchResult["type"][];
    /** Maximum results (default: 20, max: 100) */
    limit?: number;
    /** Time range filter for news-type results */
    timeRange?: "1h" | "24h" | "7d" | "30d" | "all";
    /** Chain filter (e.g. "Ethereum", "Arbitrum") */
    chain?: string;
    /** Minimum cosine similarity score (0–1, default: 0.1) */
    minRelevance?: number;
}

export interface SmartSearchResult {
    /** Original query */
    query: string;
    /** Detected intent */
    intent: SearchIntent;
    /** Ranked, deduplicated results */
    results: SearchResult[];
    /** AI-generated summary (when NLQ is used) */
    aiSummary?: string;
    /** Related search suggestions */
    suggestions: string[];
    /** Total result count */
    totalResults: number;
    /** Search execution time in milliseconds */
    searchTimeMs: number;
}

export type SearchIntent =
    | "price_lookup"       // "bitcoin price"
    | "comparison"         // "ETH vs SOL"
    | "event_query"        // "what happened to Luna"
    | "yield_search"       // "best stablecoin yields"
    | "protocol_search"    // "Aave TVL"
    | "news_search"        // "latest defi news"
    | "concept_explain"    // "what is impermanent loss"
    | "risk_assessment"    // "is USDT safe"
    | "chain_comparison"   // "cheapest L2"
    | "general";           // Catch-all

// ─── Intent Detection ────────────────────────────────────────

/**
 * Ordered pattern list for intent classification.
 * First match wins — order from most specific to least specific.
 */
const INTENT_PATTERNS: ReadonlyArray<{ pattern: RegExp; intent: SearchIntent }> = [
    // Comparison must come first — "ETH vs SOL" should be comparison, not price_lookup
    { pattern: /\b(vs|versus|compared?\s*to)\b/i, intent: "comparison" },
    // Event queries
    { pattern: /\b(what happened|crash|dump|incident|exploit|hack|depeg|collapse|rug\s*pull)\b/i, intent: "event_query" },
    // Concept explanations — must precede risk (overlap on "what is")
    { pattern: /\b(what is|explain|how does|define|meaning|eli5)\b/i, intent: "concept_explain" },
    // Risk assessment
    { pattern: /\b(risk|safe|secure|audit|rug|scam|honeypot|vulnerability)\b/i, intent: "risk_assessment" },
    // Yield/farming
    { pattern: /\b(yield|apy|apr|earn|farm|stake|reward|staking)\b/i, intent: "yield_search" },
    // Protocol-focused
    { pattern: /\b(tvl|protocol|dapp|defi|lend|borrow|liquidity)\b/i, intent: "protocol_search" },
    // News
    { pattern: /\b(news|latest|breaking|announcement|update|headline)\b/i, intent: "news_search" },
    // Chain comparison
    { pattern: /\b(chain|l2|layer.?2|rollup|bridge|network|cheapest|fastest)\b/i, intent: "chain_comparison" },
    // Price lookup — broad match, keep last
    { pattern: /\b(price|cost|worth|value|market\s*cap)\b/i, intent: "price_lookup" },
];

/**
 * Classify user intent from a natural language query.
 * Returns the first matching intent, or "general" as fallback.
 */
export function detectIntent(query: string): SearchIntent {
    for (const { pattern, intent } of INTENT_PATTERNS) {
        if (pattern.test(query)) return intent;
    }
    return "general";
}

// ─── Individual Search Strategies ────────────────────────────

/**
 * Search coins via CoinGecko name/symbol lookup.
 */
async function searchCoinStrategy(query: string, limit: number): Promise<SearchResult[]> {
    try {
        const results = await searchCoins(query);
        return (results.coins || []).slice(0, limit).map(
            (coin: { id: string; name: string; symbol: string; market_cap_rank: number; thumb?: string }) => ({
                id: `coin:${coin.id}`,
                type: "coin" as const,
                title: `${coin.name} (${coin.symbol?.toUpperCase()})`,
                description: `Market cap rank: #${coin.market_cap_rank || "N/A"}`,
                relevanceScore: coin.market_cap_rank
                    ? Math.max(0.01, 1 - coin.market_cap_rank / 1000)
                    : 0.01,
                data: {
                    coinId: coin.id,
                    symbol: coin.symbol,
                    marketCapRank: coin.market_cap_rank,
                    thumb: coin.thumb,
                },
            }),
        );
    } catch (err) {
        log.warn({ err, query }, "[search] Coin search failed");
        return [];
    }
}

/**
 * Search DeFi protocols by name, category, or chain.
 */
async function searchProtocolStrategy(query: string, limit: number): Promise<SearchResult[]> {
    try {
        const protocols = await getProtocols();
        const q = query.toLowerCase();
        const terms = q.split(/\s+/).filter(Boolean);

        return protocols
            .filter((p) => {
                const haystack = `${p.name} ${p.category} ${p.chains?.join(" ")}`.toLowerCase();
                return terms.some((term) => haystack.includes(term));
            })
            .sort((a, b) => (b.tvl || 0) - (a.tvl || 0)) // Sort by TVL descending
            .slice(0, limit)
            .map((p) => ({
                id: `protocol:${p.slug}`,
                type: "protocol" as const,
                title: p.name,
                description: `${p.category} on ${p.chains?.[0] || "Multi-chain"} — TVL: $${formatNumber(p.tvl || 0)}`,
                relevanceScore: Math.min(1, (p.tvl || 0) / 10_000_000_000), // Normalize to $10B
                data: {
                    slug: p.slug,
                    tvl: p.tvl,
                    chains: p.chains,
                    category: p.category,
                    symbol: p.symbol,
                    logo: p.logo,
                    url: p.url,
                },
                url: p.url,
            }));
    } catch (err) {
        log.warn({ err, query }, "[search] Protocol search failed");
        return [];
    }
}

/**
 * Search crypto news articles by keyword.
 */
async function searchNewsStrategy(query: string, limit: number): Promise<SearchResult[]> {
    try {
        const response = await searchNews(query, limit);
        return response.articles.map((a, i) => ({
            id: `news:${a.id}`,
            type: "news" as const,
            title: a.title,
            description: a.description?.slice(0, 200) || "",
            relevanceScore: Math.max(0.01, 1 - i / Math.max(response.articles.length, 1)),
            data: {
                source: a.source,
                sourceName: a.sourceName,
                publishedAt: a.publishedAt,
                categories: a.categories,
                imageUrl: a.imageUrl,
            },
            url: a.url,
        }));
    } catch (err) {
        log.warn({ err, query }, "[search] News search failed");
        return [];
    }
}

/**
 * Search for vectors semantically similar to the query via the embedding pipeline.
 */
async function searchSemanticStrategy(query: string, limit: number): Promise<SearchResult[]> {
    try {
        const storeCount = await vectorStore.count();
        if (storeCount === 0) return [];

        const embedding = await generateEmbedding(query);
        const results = await vectorStore.search(embedding, limit);

        return results.map((r) => ({
            id: r.id,
            type: (resolveSemanticType(r.metadata?.category) || "concept") as SearchResult["type"],
            title: extractTitle(r.content),
            description: r.content.slice(0, 300),
            relevanceScore: r.score,
            data: r.metadata,
        }));
    } catch (err) {
        log.warn({ err, query }, "[search] Semantic search failed");
        return [];
    }
}

/**
 * Search yield pools from DeFiLlama, optionally filtering for stablecoins.
 */
async function searchYieldStrategy(query: string, limit: number): Promise<SearchResult[]> {
    try {
        const { data: pools } = await getYieldPools();
        const q = query.toLowerCase();
        const isStablecoin = /stablecoin|usdc|usdt|dai|stable/i.test(q);

        let filtered = pools.filter((p) => p.tvlUsd >= 100_000); // Min $100K TVL
        if (isStablecoin) filtered = filtered.filter((p) => p.stablecoin);

        // Check for chain-specific search
        const chainMatch = q.match(/\b(ethereum|arbitrum|optimism|polygon|bsc|avalanche|solana|base)\b/i);
        if (chainMatch) {
            const chain = chainMatch[1].toLowerCase();
            filtered = filtered.filter((p) => p.chain.toLowerCase().includes(chain));
        }

        return filtered
            .sort((a, b) => (b.apy || 0) - (a.apy || 0))
            .slice(0, limit)
            .map((p) => ({
                id: `pool:${p.pool}`,
                type: "pool" as const,
                title: `${p.symbol} on ${p.project}`,
                description: `${(p.apy || 0).toFixed(2)}% APY | TVL: $${formatNumber(p.tvlUsd || 0)} | Chain: ${p.chain}`,
                relevanceScore: Math.min(1, (p.apy || 0) / 100),
                data: {
                    pool: p.pool,
                    apy: p.apy,
                    apyBase: p.apyBase,
                    apyReward: p.apyReward,
                    tvl: p.tvlUsd,
                    chain: p.chain,
                    project: p.project,
                    symbol: p.symbol,
                    stablecoin: p.stablecoin,
                    ilRisk: p.ilRisk,
                },
            }));
    } catch (err) {
        log.warn({ err, query }, "[search] Yield search failed");
        return [];
    }
}

// ─── Main Search Function ────────────────────────────────────

/**
 * Execute a unified semantic search across all data sources.
 *
 * Pipeline:
 *  1. Detect intent from the query
 *  2. Check cache for identical recent query
 *  3. Launch relevant search strategies in parallel
 *  4. Merge, deduplicate, sort by relevance, apply limits
 *  5. Generate related search suggestions
 *  6. Cache and return
 */
export async function smartSearch(
    query: string,
    options: SearchOptions = {},
): Promise<SmartSearchResult> {
    const startTime = Date.now();
    const intent = detectIntent(query);
    const { types, limit = 20, minRelevance = 0.1 } = options;

    // Check cache — 2-minute TTL for search results
    const cacheKey = `search:${query.toLowerCase().trim()}:${JSON.stringify(options)}`;
    const cached = await cache.get<string>(cacheKey);
    if (cached) {
        try {
            const parsed = JSON.parse(cached) as SmartSearchResult;
            return {
                ...parsed,
                searchTimeMs: Date.now() - startTime,
            };
        } catch {
            // Invalid cache entry — regenerate
        }
    }

    // Determine which types to include
    const shouldSearch = (type: SearchResult["type"]): boolean =>
        !types || types.includes(type);

    // Build search strategy list based on intent
    const strategies: Array<Promise<SearchResult[]>> = [];

    switch (intent) {
        case "price_lookup":
            if (shouldSearch("coin")) strategies.push(searchCoinStrategy(query, limit));
            if (shouldSearch("protocol")) strategies.push(searchProtocolStrategy(query, 3));
            break;

        case "yield_search":
            if (shouldSearch("pool")) strategies.push(searchYieldStrategy(query, limit));
            if (shouldSearch("protocol")) strategies.push(searchProtocolStrategy(query, 5));
            break;

        case "news_search":
        case "event_query":
            if (shouldSearch("news")) strategies.push(searchNewsStrategy(query, limit));
            if (shouldSearch("coin")) strategies.push(searchCoinStrategy(query, 3));
            strategies.push(searchSemanticStrategy(query, 5));
            break;

        case "protocol_search":
            if (shouldSearch("protocol")) strategies.push(searchProtocolStrategy(query, limit));
            if (shouldSearch("coin")) strategies.push(searchCoinStrategy(query, 5));
            break;

        case "comparison":
        case "chain_comparison":
            if (shouldSearch("coin")) strategies.push(searchCoinStrategy(query, 5));
            if (shouldSearch("protocol")) strategies.push(searchProtocolStrategy(query, 5));
            strategies.push(searchSemanticStrategy(query, 5));
            break;

        case "concept_explain":
        case "risk_assessment":
            strategies.push(searchSemanticStrategy(query, 10));
            if (shouldSearch("news")) strategies.push(searchNewsStrategy(query, 5));
            if (shouldSearch("coin")) strategies.push(searchCoinStrategy(query, 3));
            break;

        default:
            // General: search everything
            if (shouldSearch("coin")) strategies.push(searchCoinStrategy(query, 5));
            if (shouldSearch("protocol")) strategies.push(searchProtocolStrategy(query, 5));
            if (shouldSearch("news")) strategies.push(searchNewsStrategy(query, 5));
            strategies.push(searchSemanticStrategy(query, 5));
            break;
    }

    // Execute all strategies in parallel — gracefully handle individual failures
    const resultArrays = await Promise.allSettled(strategies);
    const allResults: SearchResult[] = [];

    for (const result of resultArrays) {
        if (result.status === "fulfilled") {
            allResults.push(...result.value);
        } else {
            log.warn({ reason: result.reason }, "[search] Strategy failed");
        }
    }

    // Deduplicate by ID and filter by minimum relevance
    const seen = new Set<string>();
    const deduped = allResults.filter((r) => {
        if (seen.has(r.id) || r.relevanceScore < minRelevance) return false;
        seen.add(r.id);
        return true;
    });

    // Sort by relevance descending, apply limit
    const results = deduped
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, limit);

    // Generate related search suggestions
    const suggestions = generateSuggestions(query, intent, results);

    const response: SmartSearchResult = {
        query,
        intent,
        results,
        suggestions,
        totalResults: results.length,
        searchTimeMs: Date.now() - startTime,
    };

    // Cache for 2 minutes
    await cache.set(cacheKey, JSON.stringify(response), 120).catch(() => { });

    log.info(
        {
            query,
            intent,
            resultCount: results.length,
            searchTimeMs: response.searchTimeMs,
        },
        "[search] Smart search completed",
    );

    return response;
}

// ─── Suggestion Generator ────────────────────────────────────

/**
 * Generate related search suggestions based on intent and top results.
 * Returns up to 5 suggestions that guide users to deeper exploration.
 */
function generateSuggestions(
    query: string,
    intent: SearchIntent,
    results: SearchResult[],
): string[] {
    const suggestions: string[] = [];

    // Intent-based suggestions
    switch (intent) {
        case "price_lookup":
            suggestions.push(`${query} price chart`, `${query} 7d performance`, `${query} market cap`);
            break;
        case "yield_search":
            suggestions.push("stablecoin yields", "highest APY DeFi", "lowest risk yields");
            break;
        case "protocol_search":
            suggestions.push("top TVL protocols", "DeFi protocol comparison", "protocol fees revenue");
            break;
        case "news_search":
            suggestions.push("trending crypto news", "DeFi news", "Bitcoin analysis");
            break;
        case "event_query":
            suggestions.push("crypto hacks timeline", "protocol exploits", "market crash history");
            break;
        case "comparison":
        case "chain_comparison":
            suggestions.push("chain comparison", "L2 fees comparison", "DEX comparison");
            break;
        case "concept_explain":
            suggestions.push("impermanent loss explained", "DeFi glossary", "yield farming guide");
            break;
        case "risk_assessment":
            suggestions.push("protocol audit scores", "smart contract risks", "DeFi safety checklist");
            break;
        case "general":
            suggestions.push("trending coins", "top DeFi protocols", "breaking crypto news");
            break;
    }

    // Add result-type-specific suggestions from top results
    if (results.length > 0) {
        const topResult = results[0];
        if (topResult.type === "coin" && topResult.data.symbol) {
            const symbol = String(topResult.data.symbol).toUpperCase();
            suggestions.push(`${symbol} technical analysis`, `${symbol} on-chain metrics`);
        } else if (topResult.type === "protocol" && topResult.data.slug) {
            suggestions.push(`${topResult.title} TVL history`, `${topResult.title} competitors`);
        }
    }

    // Deduplicate and limit to 5
    return [...new Set(suggestions)].slice(0, 5);
}

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Format a number for display (e.g., 1234567890 → "1.23B").
 */
function formatNumber(n: number): string {
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
    return n.toFixed(2);
}

/**
 * Extract a clean title from content (first line, up to 100 chars).
 */
function extractTitle(content: string): string {
    const firstLine = content.split("\n")[0]?.trim() || "Untitled";
    return firstLine.length > 100 ? firstLine.slice(0, 97) + "..." : firstLine;
}

/**
 * Map metadata category to SearchResult type.
 */
function resolveSemanticType(category: unknown): SearchResult["type"] | undefined {
    if (typeof category !== "string") return undefined;
    const map: Record<string, SearchResult["type"]> = {
        coin: "coin",
        protocol: "protocol",
        news: "news",
        agent: "agent",
        pool: "pool",
        chain: "chain",
        concept: "concept",
    };
    return map[category.toLowerCase()];
}
