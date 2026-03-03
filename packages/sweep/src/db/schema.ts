import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  jsonb,
  numeric,
  decimal,
  boolean,
  text,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============================================================
// Users Table
// ============================================================
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    walletAddress: varchar("wallet_address", { length: 66 }).notNull().unique(),
    smartWalletAddress: varchar("smart_wallet_address", { length: 66 }),
    nonce: varchar("nonce", { length: 64 }), // For SIWE auth
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    lastActive: timestamp("last_active", { withTimezone: true }),
    settings: jsonb("settings").default({}),
  },
  (table) => ({
    walletIdx: index("idx_users_wallet").on(table.walletAddress),
    smartWalletIdx: index("idx_users_smart_wallet").on(table.smartWalletAddress),
  })
);

// ============================================================
// Tokens Table (whitelist/blacklist registry)
// ============================================================
export const tokens = pgTable(
  "tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    address: varchar("address", { length: 66 }).notNull(),
    chain: varchar("chain", { length: 20 }).notNull(),
    symbol: varchar("symbol", { length: 30 }),
    tokenName: varchar("token_name", { length: 100 }),
    decimals: numeric("decimals"),
    isWhitelisted: boolean("is_whitelisted").default(false),
    isBlacklisted: boolean("is_blacklisted").default(false),
    listReason: text("list_reason"),
    logoUri: varchar("logo_uri", { length: 500 }),
    coingeckoId: varchar("coingecko_id", { length: 100 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    addressChainIdx: uniqueIndex("idx_tokens_address_chain").on(table.address, table.chain),
    whitelistIdx: index("idx_tokens_whitelist").on(table.isWhitelisted),
    blacklistIdx: index("idx_tokens_blacklist").on(table.isBlacklisted),
  })
);

// ============================================================
// Sweeps Table
// ============================================================
export const sweeps = pgTable(
  "sweeps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id),
    status: varchar("status", { length: 30 })
      .default("pending")
      .notNull()
      .$type<"pending" | "quoting" | "signing" | "submitted" | "confirmed" | "failed" | "cancelled">(),
    chains: jsonb("chains").$type<string[]>().default([]),
    tokens: jsonb("tokens").$type<{
      address: string;
      chain: string;
      symbol: string;
      amount: string;
      usdValue: number;
    }[]>().default([]),
    quote: jsonb("quote").$type<{
      quoteId: string;
      outputToken: string;
      outputAmount: string;
      estimatedGas: string;
      netValueUsd: number;
      aggregator: string;
      expiresAt: number;
    }>(),
    txHashes: jsonb("tx_hashes").$type<Record<string, string>>().default({}),
    userOpHashes: jsonb("user_op_hashes").$type<Record<string, string>>().default({}),
    outputToken: varchar("output_token", { length: 66 }),
    outputAmount: numeric("output_amount", { precision: 78, scale: 0 }),
    outputChain: varchar("output_chain", { length: 20 }),
    gasToken: varchar("gas_token", { length: 66 }),
    gasPaid: numeric("gas_paid", { precision: 78, scale: 0 }),
    totalInputValueUsd: decimal("total_input_value_usd", { precision: 20, scale: 8 }),
    totalOutputValueUsd: decimal("total_output_value_usd", { precision: 20, scale: 8 }),
    feePaid: decimal("fee_paid", { precision: 20, scale: 8 }),
    defiDestination: varchar("defi_destination", { length: 66 }),
    defiProtocol: varchar("defi_protocol", { length: 50 }),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => ({
    userIdx: index("idx_sweeps_user").on(table.userId),
    statusIdx: index("idx_sweeps_status").on(table.status),
    createdIdx: index("idx_sweeps_created").on(table.createdAt),
  })
);

// ============================================================
// Sweep Quotes Table (temporary quote storage)
// ============================================================
export const sweepQuotes = pgTable(
  "sweep_quotes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id),
    walletAddress: varchar("wallet_address", { length: 66 }).notNull(),
    chains: jsonb("chains").$type<string[]>().default([]),
    tokens: jsonb("tokens").$type<{
      address: string;
      chain: string;
      symbol: string;
      amount: string;
      usdValue: number;
    }[]>().default([]),
    destination: jsonb("destination").$type<{
      chain: string;
      token: string;
      protocol?: string;
      vault?: string;
    }>(),
    outputToken: varchar("output_token", { length: 66 }),
    outputAmount: numeric("output_amount", { precision: 78, scale: 0 }),
    estimatedGasUsd: decimal("estimated_gas_usd", { precision: 20, scale: 8 }),
    netValueUsd: decimal("net_value_usd", { precision: 20, scale: 8 }),
    aggregator: varchar("aggregator", { length: 50 }),
    routeData: jsonb("route_data"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    userIdx: index("idx_quotes_user").on(table.userId),
    walletIdx: index("idx_quotes_wallet").on(table.walletAddress),
    expiresIdx: index("idx_quotes_expires").on(table.expiresAt),
  })
);

// ============================================================
// Dust Tokens Table (scanned wallet balances)
// ============================================================
export const dustTokens = pgTable(
  "dust_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id),
    walletAddress: varchar("wallet_address", { length: 66 }).notNull(),
    chain: varchar("chain", { length: 20 }).notNull(),
    tokenAddress: varchar("token_address", { length: 66 }).notNull(),
    symbol: varchar("symbol", { length: 30 }),
    tokenName: varchar("token_name", { length: 100 }),
    decimals: numeric("decimals"),
    balance: numeric("balance", { precision: 78, scale: 0 }).notNull(),
    valueUsd: decimal("value_usd", { precision: 20, scale: 8 }),
    priceUsd: decimal("price_usd", { precision: 30, scale: 18 }),
    scannedAt: timestamp("scanned_at", { withTimezone: true }).defaultNow(),
    swept: boolean("swept").default(false),
    sweepId: uuid("sweep_id").references(() => sweeps.id),
  },
  (table) => ({
    uniqueIdx: uniqueIndex("idx_dust_unique").on(table.userId, table.chain, table.tokenAddress),
    userIdx: index("idx_dust_user").on(table.userId),
    walletIdx: index("idx_dust_wallet").on(table.walletAddress),
  })
);

// ============================================================
// Price Cache Table
// ============================================================
export const priceCache = pgTable(
  "price_cache",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenAddress: varchar("token_address", { length: 66 }).notNull(),
    chain: varchar("chain", { length: 20 }).notNull(),
    priceUsd: decimal("price_usd", { precision: 30, scale: 18 }),
    confidence: varchar("confidence", { length: 20 }).$type<"HIGH" | "MEDIUM" | "LOW" | "UNTRUSTED">(),
    sources: jsonb("sources").$type<{ name: string; price: number; timestamp: number }[]>(),
    liquidityUsd: decimal("liquidity_usd", { precision: 20, scale: 8 }),
    volume24h: decimal("volume_24h", { precision: 20, scale: 8 }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    tokenChainIdx: uniqueIndex("idx_price_token_chain").on(table.tokenAddress, table.chain),
    updatedIdx: index("idx_price_updated").on(table.updatedAt),
  })
);

// ============================================================
// Subscriptions Table (auto-sweep subscriptions)
// ============================================================
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id).notNull(),
    walletAddress: varchar("wallet_address", { length: 66 }).notNull(),
    smartWalletAddress: varchar("smart_wallet_address", { length: 66 }),
    
    // Source configuration
    sourceChains: jsonb("source_chains").$type<number[]>().default([]).notNull(),
    
    // Destination configuration
    destinationChain: numeric("destination_chain").notNull().$type<number>(),
    destinationAsset: varchar("destination_asset", { length: 30 }).notNull(),
    destinationProtocol: varchar("destination_protocol", { length: 50 }),
    destinationVault: varchar("destination_vault", { length: 66 }),
    
    // Trigger configuration
    triggerType: varchar("trigger_type", { length: 20 }).notNull().$type<"threshold" | "schedule">(),
    thresholdUsd: decimal("threshold_usd", { precision: 20, scale: 8 }),
    schedulePattern: varchar("schedule_pattern", { length: 50 }),
    
    // Cost limits
    minSweepValueUsd: decimal("min_sweep_value_usd", { precision: 20, scale: 8 }).default("5"),
    maxSweepCostPercent: decimal("max_sweep_cost_percent", { precision: 5, scale: 2 }).default("10"),
    
    // Spend permission (Coinbase)
    spendPermissionSignature: text("spend_permission_signature").notNull(),
    spendPermissionHash: varchar("spend_permission_hash", { length: 66 }),
    spendPermissionExpiry: timestamp("spend_permission_expiry", { withTimezone: true }).notNull(),
    spendPermissionMaxAmount: numeric("spend_permission_max_amount", { precision: 78, scale: 0 }),
    spendPermissionData: jsonb("spend_permission_data").$type<{
      account: string;
      spender: string;
      token: string;
      allowance: string;
      period: number;
      start: number;
      end: number;
      salt: string;
      extraData: string;
    }>(),
    
    // Status
    status: varchar("status", { length: 20 }).default("active").notNull().$type<"active" | "paused" | "cancelled" | "expired">(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    lastSweepAt: timestamp("last_sweep_at", { withTimezone: true }),
    nextScheduledAt: timestamp("next_scheduled_at", { withTimezone: true }),
    
    // Stats
    totalSweeps: numeric("total_sweeps").default("0").$type<number>(),
    totalValueSwept: decimal("total_value_swept", { precision: 20, scale: 8 }).default("0"),
  },
  (table) => ({
    userIdx: index("idx_subscriptions_user").on(table.userId),
    walletIdx: index("idx_subscriptions_wallet").on(table.walletAddress),
    statusIdx: index("idx_subscriptions_status").on(table.status),
    triggerTypeIdx: index("idx_subscriptions_trigger_type").on(table.triggerType),
    nextScheduledIdx: index("idx_subscriptions_next_scheduled").on(table.nextScheduledAt),
    expiryIdx: index("idx_subscriptions_expiry").on(table.spendPermissionExpiry),
  })
);

// ============================================================
// Subscription Sweeps Table (history of auto-sweeps)
// ============================================================
export const subscriptionSweeps = pgTable(
  "subscription_sweeps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subscriptionId: uuid("subscription_id").references(() => subscriptions.id).notNull(),
    sweepId: uuid("sweep_id").references(() => sweeps.id),
    
    // Trigger info
    triggeredBy: varchar("triggered_by", { length: 20 }).$type<"threshold" | "schedule" | "manual">(),
    
    // Value info
    dustValueUsd: decimal("dust_value_usd", { precision: 20, scale: 8 }),
    sweepCostUsd: decimal("sweep_cost_usd", { precision: 20, scale: 8 }),
    netValueUsd: decimal("net_value_usd", { precision: 20, scale: 8 }),
    tokensSwept: numeric("tokens_swept").$type<number>(),
    chains: jsonb("chains").$type<number[]>().default([]),
    
    // Status
    status: varchar("status", { length: 20 }).default("pending").$type<"pending" | "executing" | "completed" | "failed">(),
    errorMessage: text("error_message"),
    
    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => ({
    subscriptionIdx: index("idx_subscription_sweeps_subscription").on(table.subscriptionId),
    sweepIdx: index("idx_subscription_sweeps_sweep").on(table.sweepId),
    statusIdx: index("idx_subscription_sweeps_status").on(table.status),
    createdIdx: index("idx_subscription_sweeps_created").on(table.createdAt),
  })
);

// ============================================================
// Relations
// ============================================================
export const usersRelations = relations(users, ({ many }) => ({
  sweeps: many(sweeps),
  dustTokens: many(dustTokens),
  quotes: many(sweepQuotes),
  subscriptions: many(subscriptions),
}));

export const sweepsRelations = relations(sweeps, ({ one, many }) => ({
  user: one(users, {
    fields: [sweeps.userId],
    references: [users.id],
  }),
  dustTokens: many(dustTokens),
}));

export const dustTokensRelations = relations(dustTokens, ({ one }) => ({
  user: one(users, {
    fields: [dustTokens.userId],
    references: [users.id],
  }),
  sweep: one(sweeps, {
    fields: [dustTokens.sweepId],
    references: [sweeps.id],
  }),
}));

export const sweepQuotesRelations = relations(sweepQuotes, ({ one }) => ({
  user: one(users, {
    fields: [sweepQuotes.userId],
    references: [users.id],
  }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one, many }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
  sweeps: many(subscriptionSweeps),
}));

export const subscriptionSweepsRelations = relations(subscriptionSweeps, ({ one }) => ({
  subscription: one(subscriptions, {
    fields: [subscriptionSweeps.subscriptionId],
    references: [subscriptions.id],
  }),
  sweep: one(sweeps, {
    fields: [subscriptionSweeps.sweepId],
    references: [sweeps.id],
  }),
}));

// ============================================================
// API Payments Table (x402 payment history)
// ============================================================
export const apiPayments = pgTable(
  "api_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    receiptId: varchar("receipt_id", { length: 100 }).notNull().unique(),
    payerAddress: varchar("payer_address", { length: 66 }).notNull(),
    payeeAddress: varchar("payee_address", { length: 66 }).notNull(),
    amountUsdc: varchar("amount_usdc", { length: 78 }).notNull(),
    network: varchar("network", { length: 50 }).notNull(),
    txHash: varchar("tx_hash", { length: 66 }),
    endpoint: varchar("endpoint", { length: 200 }).notNull(),
    method: varchar("method", { length: 10 }).notNull(),
    paymentType: varchar("payment_type", { length: 20 }).notNull().$type<"x402" | "credits" | "free_tier">(),
    status: varchar("status", { length: 20 }).notNull().$type<"pending" | "completed" | "failed" | "refunded">(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    receiptIdx: uniqueIndex("idx_api_payments_receipt").on(table.receiptId),
    payerIdx: index("idx_api_payments_payer").on(table.payerAddress),
    txHashIdx: index("idx_api_payments_tx").on(table.txHash),
    statusIdx: index("idx_api_payments_status").on(table.status),
    createdIdx: index("idx_api_payments_created").on(table.createdAt),
  })
);

// ============================================================
// API Credits Table (prepaid credit balances)
// ============================================================
export const apiCredits = pgTable(
  "api_credits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    walletAddress: varchar("wallet_address", { length: 66 }).notNull().unique(),
    balanceCents: varchar("balance_cents", { length: 20 }).notNull().default("0"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    walletIdx: uniqueIndex("idx_api_credits_wallet").on(table.walletAddress),
    expiresIdx: index("idx_api_credits_expires").on(table.expiresAt),
  })
);

// ============================================================
// API Credit Transactions Table (credit history)
// ============================================================
export const apiCreditTransactions = pgTable(
  "api_credit_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    walletAddress: varchar("wallet_address", { length: 66 }).notNull(),
    type: varchar("type", { length: 20 }).notNull().$type<"deposit" | "deduction" | "refund" | "expiry" | "adjustment">(),
    amountCents: varchar("amount_cents", { length: 20 }).notNull(),
    balanceAfter: varchar("balance_after", { length: 20 }).notNull(),
    endpoint: varchar("endpoint", { length: 200 }),
    txHash: varchar("tx_hash", { length: 66 }),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    walletIdx: index("idx_api_credit_transactions_wallet").on(table.walletAddress),
    typeIdx: index("idx_api_credit_transactions_type").on(table.type),
    createdIdx: index("idx_api_credit_transactions_created").on(table.createdAt),
  })
);

// ============================================================
// API Usage Table (request logs)
// ============================================================
export const apiUsage = pgTable(
  "api_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userIdentifier: varchar("user_identifier", { length: 100 }).notNull(),
    endpoint: varchar("endpoint", { length: 200 }).notNull(),
    method: varchar("method", { length: 10 }).notNull(),
    priceCents: numeric("price_cents").notNull().default("0"),
    paymentType: varchar("payment_type", { length: 20 }).notNull().$type<"x402" | "credits" | "free_tier">(),
    responseStatus: numeric("response_status"),
    responseTimeMs: numeric("response_time_ms"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    userIdx: index("idx_api_usage_user").on(table.userIdentifier),
    endpointIdx: index("idx_api_usage_endpoint").on(table.endpoint),
    createdIdx: index("idx_api_usage_created").on(table.createdAt),
    paymentTypeIdx: index("idx_api_usage_payment_type").on(table.paymentType),
  })
);

// ============================================================
// Types
// ============================================================
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Token = typeof tokens.$inferSelect;
export type NewToken = typeof tokens.$inferInsert;

export type Sweep = typeof sweeps.$inferSelect;
export type NewSweep = typeof sweeps.$inferInsert;

export type SweepQuote = typeof sweepQuotes.$inferSelect;
export type NewSweepQuote = typeof sweepQuotes.$inferInsert;

export type DustToken = typeof dustTokens.$inferSelect;
export type NewDustToken = typeof dustTokens.$inferInsert;

export type PriceCache = typeof priceCache.$inferSelect;
export type NewPriceCache = typeof priceCache.$inferInsert;

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;

export type SubscriptionSweep = typeof subscriptionSweeps.$inferSelect;
export type NewSubscriptionSweep = typeof subscriptionSweeps.$inferInsert;

export type ApiPayment = typeof apiPayments.$inferSelect;
export type NewApiPayment = typeof apiPayments.$inferInsert;

export type ApiCredit = typeof apiCredits.$inferSelect;
export type NewApiCredit = typeof apiCredits.$inferInsert;

export type ApiCreditTransaction = typeof apiCreditTransactions.$inferSelect;
export type NewApiCreditTransaction = typeof apiCreditTransactions.$inferInsert;

export type ApiUsage = typeof apiUsage.$inferSelect;
export type NewApiUsage = typeof apiUsage.$inferInsert;
