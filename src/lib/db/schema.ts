/**
 * Crypto Vision — Core API Database Schema (Drizzle ORM + PostgreSQL)
 *
 * Relational schema for the API server:
 * - API key management
 * - Market data snapshots (cached from workers)
 * - DeFi snapshots (TVL / yield)
 * - News articles
 * - Anomaly detection events
 * - Search analytics
 * - Agent execution logs
 * - Portfolios, holdings, transactions
 * - Watchlists
 * - Price alerts
 * - Export jobs
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// ─── Enums ───────────────────────────────────────────────────

export const apiKeyTierEnum = pgEnum("api_key_tier", [
  "free",
  "pro",
  "enterprise",
]);

export const anomalySeverityEnum = pgEnum("anomaly_severity", [
  "low",
  "medium",
  "high",
  "critical",
]);

export const anomalyTypeEnum = pgEnum("anomaly_type", [
  "price_spike",
  "volume_surge",
  "whale_movement",
  "exchange_flow",
  "social_spike",
  "correlation_break",
  "flash_crash",
  "pump_and_dump",
]);

export const alertStatusEnum = pgEnum("alert_status", [
  "active",
  "triggered",
  "expired",
  "cancelled",
]);

export const alertConditionEnum = pgEnum("alert_condition", [
  "above",
  "below",
  "percent_change_up",
  "percent_change_down",
]);

export const exportStatusEnum = pgEnum("export_status", [
  "pending",
  "processing",
  "completed",
  "failed",
]);

export const exportFormatEnum = pgEnum("export_format", [
  "csv",
  "json",
  "parquet",
]);

export const agentExecutionStatusEnum = pgEnum("agent_execution_status", [
  "running",
  "completed",
  "failed",
  "timeout",
]);

export const transactionTypeEnum = pgEnum("transaction_type", [
  "buy",
  "sell",
  "transfer_in",
  "transfer_out",
]);

// ─── API Keys ───────────────────────────────────────────────

export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    keyHash: text("key_hash").notNull().unique(),
    keyPrefix: text("key_prefix").notNull(),
    tier: apiKeyTierEnum("tier").default("free").notNull(),
    rateLimit: integer("rate_limit").default(100).notNull(),
    requestCount: integer("request_count").default(0).notNull(),
    lastUsedAt: timestamp("last_used_at"),
    expiresAt: timestamp("expires_at"),
    isActive: boolean("is_active").default(true).notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("api_keys_key_hash_idx").on(t.keyHash),
    index("api_keys_prefix_idx").on(t.keyPrefix),
    index("api_keys_tier_idx").on(t.tier),
    index("api_keys_is_active_idx").on(t.isActive),
  ],
);

// ─── Market Snapshots ───────────────────────────────────────

export const marketSnapshots = pgTable(
  "market_snapshots",
  {
    id: serial("id").primaryKey(),
    coinId: text("coin_id").notNull(),
    symbol: text("symbol").notNull(),
    price: real("price").notNull(),
    marketCap: real("market_cap"),
    volume24h: real("volume_24h"),
    priceChange24h: real("price_change_24h"),
    priceChange7d: real("price_change_7d"),
    rank: integer("rank"),
    snapshotAt: timestamp("snapshot_at").defaultNow().notNull(),
  },
  (t) => [
    index("market_snapshots_coin_id_idx").on(t.coinId),
    index("market_snapshots_symbol_idx").on(t.symbol),
    index("market_snapshots_snapshot_at_idx").on(t.snapshotAt),
    index("market_snapshots_coin_ts_idx").on(t.coinId, t.snapshotAt),
  ],
);

// ─── DeFi Snapshots ─────────────────────────────────────────

export const defiSnapshots = pgTable(
  "defi_snapshots",
  {
    id: serial("id").primaryKey(),
    protocolId: text("protocol_id").notNull(),
    protocolName: text("protocol_name").notNull(),
    chain: text("chain").notNull(),
    tvl: real("tvl"),
    volume24h: real("volume_24h"),
    fees24h: real("fees_24h"),
    revenue24h: real("revenue_24h"),
    topPoolApy: real("top_pool_apy"),
    numPools: integer("num_pools"),
    metadata: jsonb("metadata"),
    snapshotAt: timestamp("snapshot_at").defaultNow().notNull(),
  },
  (t) => [
    index("defi_snapshots_protocol_id_idx").on(t.protocolId),
    index("defi_snapshots_chain_idx").on(t.chain),
    index("defi_snapshots_snapshot_at_idx").on(t.snapshotAt),
    index("defi_snapshots_protocol_ts_idx").on(t.protocolId, t.snapshotAt),
  ],
);

// ─── News Articles ──────────────────────────────────────────

export const newsArticles = pgTable(
  "news_articles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    summary: text("summary"),
    content: text("content"),
    url: text("url").notNull(),
    source: text("source").notNull(),
    author: text("author"),
    imageUrl: text("image_url"),
    /** Coins mentioned / related */
    relatedCoins: jsonb("related_coins").$type<string[]>().default([]),
    /** Sentiment score from NLP (-1.0 to 1.0) */
    sentimentScore: real("sentiment_score"),
    /** Categories / tags */
    categories: jsonb("categories").$type<string[]>().default([]),
    publishedAt: timestamp("published_at").notNull(),
    indexedAt: timestamp("indexed_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("news_articles_url_idx").on(t.url),
    index("news_articles_source_idx").on(t.source),
    index("news_articles_published_at_idx").on(t.publishedAt),
    index("news_articles_sentiment_idx").on(t.sentimentScore),
  ],
);

// ─── Anomaly Events ─────────────────────────────────────────

export const anomalyEvents = pgTable(
  "anomaly_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    coinId: text("coin_id").notNull(),
    symbol: text("symbol").notNull(),
    type: anomalyTypeEnum("type").notNull(),
    severity: anomalySeverityEnum("severity").notNull(),
    /** Human-readable description */
    description: text("description").notNull(),
    /** Z-score or magnitude of the anomaly */
    magnitude: real("magnitude").notNull(),
    /** Snapshot of relevant data at detection time */
    contextData: jsonb("context_data"),
    /** Whether this was surfaced to users */
    isNotified: boolean("is_notified").default(false).notNull(),
    detectedAt: timestamp("detected_at").defaultNow().notNull(),
    resolvedAt: timestamp("resolved_at"),
  },
  (t) => [
    index("anomaly_events_coin_id_idx").on(t.coinId),
    index("anomaly_events_type_idx").on(t.type),
    index("anomaly_events_severity_idx").on(t.severity),
    index("anomaly_events_detected_at_idx").on(t.detectedAt),
    index("anomaly_events_coin_ts_idx").on(t.coinId, t.detectedAt),
  ],
);

// ─── Search Queries ─────────────────────────────────────────

export const searchQueries = pgTable(
  "search_queries",
  {
    id: serial("id").primaryKey(),
    query: text("query").notNull(),
    normalizedQuery: text("normalized_query").notNull(),
    resultCount: integer("result_count").default(0).notNull(),
    /** Top result coin IDs */
    topResults: jsonb("top_results").$type<string[]>().default([]),
    /** How long the search took (ms) */
    latencyMs: integer("latency_ms"),
    /** Source: api, dashboard, bot */
    source: text("source").default("api").notNull(),
    /** API key ID if authenticated */
    apiKeyId: uuid("api_key_id"),
    searchedAt: timestamp("searched_at").defaultNow().notNull(),
  },
  (t) => [
    index("search_queries_normalized_idx").on(t.normalizedQuery),
    index("search_queries_searched_at_idx").on(t.searchedAt),
    index("search_queries_source_idx").on(t.source),
  ],
);

// ─── Agent Executions ───────────────────────────────────────

export const agentExecutions = pgTable(
  "agent_executions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agentId: text("agent_id").notNull(),
    agentName: text("agent_name").notNull(),
    /** The task or prompt given to the agent */
    task: text("task").notNull(),
    /** Status of the execution */
    status: agentExecutionStatusEnum("status").default("running").notNull(),
    /** Structured result output */
    result: jsonb("result"),
    /** Error message if failed */
    error: text("error"),
    /** Total LLM tokens consumed */
    tokensUsed: integer("tokens_used"),
    /** Total tool calls made */
    toolCalls: integer("tool_calls"),
    /** Execution duration in ms */
    durationMs: integer("duration_ms"),
    /** Model used (e.g. gemini-2.0-flash) */
    model: text("model"),
    /** Parent execution ID for chained agents */
    parentExecutionId: uuid("parent_execution_id"),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (t) => [
    index("agent_executions_agent_id_idx").on(t.agentId),
    index("agent_executions_status_idx").on(t.status),
    index("agent_executions_started_at_idx").on(t.startedAt),
    index("agent_executions_parent_idx").on(t.parentExecutionId),
  ],
);

// ─── Portfolios ─────────────────────────────────────────────

export const portfolios = pgTable(
  "portfolios",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    name: varchar("name", { length: 256 }).notNull(),
    description: text("description"),
    isPublic: boolean("is_public").default(false).notNull(),
    /** Cached total value in USD */
    totalValueUsd: real("total_value_usd").default(0),
    /** Cached 24h change % */
    change24hPercent: real("change_24h_percent"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("portfolios_user_id_idx").on(t.userId),
    index("portfolios_is_public_idx").on(t.isPublic),
  ],
);

// ─── Portfolio Holdings ─────────────────────────────────────

export const portfolioHoldings = pgTable(
  "portfolio_holdings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    portfolioId: uuid("portfolio_id")
      .references(() => portfolios.id, { onDelete: "cascade" })
      .notNull(),
    coinId: text("coin_id").notNull(),
    symbol: text("symbol").notNull(),
    amount: real("amount").notNull(),
    /** Average cost basis in USD */
    avgCostUsd: real("avg_cost_usd"),
    /** Current value in USD (cached) */
    currentValueUsd: real("current_value_usd"),
    /** Unrealized P&L in USD (cached) */
    unrealizedPnlUsd: real("unrealized_pnl_usd"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("portfolio_holdings_portfolio_id_idx").on(t.portfolioId),
    uniqueIndex("portfolio_holdings_portfolio_coin_idx").on(
      t.portfolioId,
      t.coinId,
    ),
  ],
);

// ─── Portfolio Transactions ─────────────────────────────────

export const portfolioTransactions = pgTable(
  "portfolio_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    portfolioId: uuid("portfolio_id")
      .references(() => portfolios.id, { onDelete: "cascade" })
      .notNull(),
    holdingId: uuid("holding_id")
      .references(() => portfolioHoldings.id, { onDelete: "set null" }),
    coinId: text("coin_id").notNull(),
    symbol: text("symbol").notNull(),
    type: transactionTypeEnum("type").notNull(),
    amount: real("amount").notNull(),
    priceUsd: real("price_usd").notNull(),
    totalUsd: real("total_usd").notNull(),
    fee: real("fee"),
    notes: text("notes"),
    executedAt: timestamp("executed_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("portfolio_txns_portfolio_id_idx").on(t.portfolioId),
    index("portfolio_txns_holding_id_idx").on(t.holdingId),
    index("portfolio_txns_coin_id_idx").on(t.coinId),
    index("portfolio_txns_executed_at_idx").on(t.executedAt),
  ],
);

// ─── Watchlists ─────────────────────────────────────────────

export const watchlists = pgTable(
  "watchlists",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    name: varchar("name", { length: 256 }).notNull(),
    /** Ordered list of coin IDs */
    coinIds: jsonb("coin_ids").$type<string[]>().default([]),
    isDefault: boolean("is_default").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("watchlists_user_id_idx").on(t.userId),
  ],
);

// ─── Price Alerts ───────────────────────────────────────────

export const priceAlerts = pgTable(
  "price_alerts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    coinId: text("coin_id").notNull(),
    symbol: text("symbol").notNull(),
    condition: alertConditionEnum("condition").notNull(),
    /** Target price or percentage */
    targetValue: real("target_value").notNull(),
    /** Price when alert was created */
    priceAtCreation: real("price_at_creation").notNull(),
    status: alertStatusEnum("alert_status").default("active").notNull(),
    triggeredAt: timestamp("triggered_at"),
    /** Price when alert triggered */
    triggeredPrice: real("triggered_price"),
    /** Notification channel: email, webhook, telegram */
    notifyChannel: text("notify_channel").default("webhook").notNull(),
    /** Webhook or contact info */
    notifyTarget: text("notify_target"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at"),
  },
  (t) => [
    index("price_alerts_user_id_idx").on(t.userId),
    index("price_alerts_coin_id_idx").on(t.coinId),
    index("price_alerts_status_idx").on(t.status),
    index("price_alerts_coin_status_idx").on(t.coinId, t.status),
  ],
);

// ─── Export Jobs ────────────────────────────────────────────

export const exportJobs = pgTable(
  "export_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    /** What is being exported (e.g. "market_snapshots", "portfolio") */
    dataType: text("data_type").notNull(),
    format: exportFormatEnum("format").default("csv").notNull(),
    status: exportStatusEnum("status").default("pending").notNull(),
    /** Filter parameters for the export */
    filters: jsonb("filters"),
    /** Total rows exported */
    rowCount: integer("row_count"),
    /** File size in bytes */
    fileSizeBytes: integer("file_size_bytes"),
    /** Download URL (GCS signed URL or local path) */
    downloadUrl: text("download_url"),
    error: text("error"),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    /** Auto-expire download link */
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("export_jobs_user_id_idx").on(t.userId),
    index("export_jobs_status_idx").on(t.status),
    index("export_jobs_created_at_idx").on(t.createdAt),
  ],
);

// ─── Type Exports ───────────────────────────────────────────

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
export type MarketSnapshot = typeof marketSnapshots.$inferSelect;
export type NewMarketSnapshot = typeof marketSnapshots.$inferInsert;
export type DefiSnapshot = typeof defiSnapshots.$inferSelect;
export type NewDefiSnapshot = typeof defiSnapshots.$inferInsert;
export type NewsArticle = typeof newsArticles.$inferSelect;
export type NewNewsArticle = typeof newsArticles.$inferInsert;
export type AnomalyEvent = typeof anomalyEvents.$inferSelect;
export type NewAnomalyEvent = typeof anomalyEvents.$inferInsert;
export type SearchQuery = typeof searchQueries.$inferSelect;
export type NewSearchQuery = typeof searchQueries.$inferInsert;
export type AgentExecution = typeof agentExecutions.$inferSelect;
export type NewAgentExecution = typeof agentExecutions.$inferInsert;
export type Portfolio = typeof portfolios.$inferSelect;
export type NewPortfolio = typeof portfolios.$inferInsert;
export type PortfolioHolding = typeof portfolioHoldings.$inferSelect;
export type NewPortfolioHolding = typeof portfolioHoldings.$inferInsert;
export type PortfolioTransaction = typeof portfolioTransactions.$inferSelect;
export type NewPortfolioTransaction = typeof portfolioTransactions.$inferInsert;
export type Watchlist = typeof watchlists.$inferSelect;
export type NewWatchlist = typeof watchlists.$inferInsert;
export type PriceAlert = typeof priceAlerts.$inferSelect;
export type NewPriceAlert = typeof priceAlerts.$inferInsert;
export type ExportJob = typeof exportJobs.$inferSelect;
export type NewExportJob = typeof exportJobs.$inferInsert;
