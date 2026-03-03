/**
 * Crypto Vision — Central Schema Exports
 *
 * Barrel file that re-exports ALL Zod schemas from the project.
 * Used by OpenAPI generators and any code needing the full schema catalog.
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

// ─── Primitive Schemas & Validation Helpers ──────────────────
export {
  // Primitives
  CoinIdSchema,
  HexAddressSchema,
  SearchQuerySchema,
  PositiveIntSchema,
  LimitSchema,
  DaysSchema,
  PageSchema,
  PaginationSchema,
  ChainSlugSchema,
  BitcoinAddressSchema,
  UrlSchema,
  PeriodSchema,
  TimeframeSchema,
  CoinCapIntervalSchema,
  ChartIntervalSchema,
  NumericIdSchema,
  ChainIdSchema,
  CoinIdListSchema,

  // Factory
  limitSchema,

  // POST body schemas
  AskBodySchema,
  AgentRunSchema,
  AgentMultiSchema,
  OrchestrateSchema,
  GenerateKeySchema,
  PortfolioHoldingsSchema,
  AssetIdsSchema,
  RiskAnalysisSchema,
  PythPriceIdsSchema,
  AIChatSchema,
  AIAnalyzeSchema,
  AISummarizeSchema,
  AISentimentSchema,
  AIStrategySchema,
  AIExplainSchema,
  AIEmbedSchema,
  AICompareSchema,
  AIRiskAssessmentSchema,
  AIPortfolioReviewSchema,
  AgentComposeSchema,

  // Validation helpers
  validateBody,
  validateQuery,
  validateParam,
  validateQueries,
} from "./validation.js";

// ─── Route-Level Query & Param Schemas ───────────────────────
export {
  // Market
  MarketCoinsQuerySchema,
  MarketPriceQuerySchema,
  MarketSearchQuerySchema,
  MarketChartParamsSchema,
  MarketChartQuerySchema,
  MarketOhlcQuerySchema,
  MarketFearGreedQuerySchema,
  MarketGainersLosersQuerySchema,
  MarketHighVolumeQuerySchema,
  MarketAthDistanceQuerySchema,
  MarketCompareQuerySchema,
  MarketPaprikaTickersQuerySchema,
  MarketCoincapAssetsQuerySchema,
  MarketCoincapHistoryQuerySchema,
  MarketCoinloreTickersQuerySchema,
  MarketRatesQuerySchema,
  MarketMarketsQuerySchema,

  // Analytics
  AnalyticsCorrelationQuerySchema,
  AnalyticsVolatilityQuerySchema,
  AnalyticsL2QuerySchema,
  AnalyticsRevenueQuerySchema,
  AnalyticsTTFeesQuerySchema,
  AnalyticsTTActiveUsersQuerySchema,
  AnalyticsTTMarketQuerySchema,

  // Aggregate
  AggregateTickersQuerySchema,
  AggregateAssetsQuerySchema,
  AggregateHistoryQuerySchema,
  AggregateTopMoversQuerySchema,

  // News
  NewsListQuerySchema,
  NewsSearchQuerySchema,
  NewsCategoryLimitQuerySchema,
  NewsBreakingQuerySchema,
  NewsTrendingQuerySchema,
  NewsHomepageQuerySchema,

  // News Aggregator
  NewsAggLatestQuerySchema,
  NewsAggSearchQuerySchema,
  NewsAggBreakingQuerySchema,
  NewsAggTrendingQuerySchema,
  NewsAggCategoryQuerySchema,

  // Bitcoin
  BitcoinAddressParamSchema,
  BitcoinTxParamSchema,
  BitcoinBlockParamSchema,

  // DeFi
  DefiProtocolsQuerySchema,
  DefiYieldsQuerySchema,
  DefiRaisesQuerySchema,
  DefiHacksQuerySchema,
  DefiTreasuriesQuerySchema,
  DefiRevenueQuerySchema,

  // CEX
  CexTickersQuerySchema,
  CexPricesQuerySchema,
  CexOrderbookQuerySchema,
  CexTradesQuerySchema,
  CexKlinesQuerySchema,
  CexPairsQuerySchema,
  CexBookTickerQuerySchema,
  CexMiniTickerQuerySchema,

  // Derivatives
  DerivativesOiQuerySchema,
  DerivativesLiquidationsQuerySchema,
  DerivativesLongShortQuerySchema,

  // NFT
  NftTopQuerySchema,
  NftTrendingQuerySchema,
  NftCollectionQuerySchema,
  NftActivityQuerySchema,
  NftBidsQuerySchema,
  NftListingsQuerySchema,
  NftSearchQuerySchema,
  NftUserQuerySchema,
  NftListQuerySchema,
  NftMarketChartQuerySchema,
  NftStatsQuerySchema,

  // Onchain
  OnchainPricesQuerySchema,
  OnchainTvlQuerySchema,
  OnchainBtcBlocksQuerySchema,
  OnchainBtcMinersQuerySchema,
  OnchainBtcHashrateQuerySchema,

  // Perps
  PerpsKlinesQuerySchema,
  PerpsDydxSparklinesQuerySchema,

  // Exchanges
  ExchangesBybitInsuranceQuerySchema,
  ExchangesBybitRiskQuerySchema,
  ExchangesDeribitIndexQuerySchema,
  ExchangesCoincapCandlesQuerySchema,
  ExchangesOkxInstrumentsQuerySchema,
  ExchangesOkxMarkPriceQuerySchema,

  // Social
  SocialProfilesQuerySchema,
  SocialFearGreedQuerySchema,
  SocialFearGreedHistoryQuerySchema,
  SocialLunarTopQuerySchema,
  SocialLunarFeedQuerySchema,
  SocialCCHistoryQuerySchema,

  // Governance
  GovernanceProposalsQuerySchema,
  GovernanceSpacesQuerySchema,
  GovernanceVotesQuerySchema,
  GovernanceTopSpacesQuerySchema,

  // Calendar
  CalendarEventsQuerySchema,
  CalendarCoinQuerySchema,
  CalendarCategoryQuerySchema,
  CalendarAggregateQuerySchema,

  // Anomaly
  AnomalyListQuerySchema,

  // Research
  ResearchAssetsQuerySchema,
  ResearchCompareQuerySchema,
  ResearchTopVolumeQuerySchema,
  ResearchExchangesQuerySchema,
  ResearchPriceQuerySchema,
  ResearchHistodayQuerySchema,
  ResearchHistohourQuerySchema,
  ResearchTopMcapQuerySchema,
  ResearchNewsQuerySchema,

  // Whales
  WhalesBtcLatestQuerySchema,
  WhalesEthHoldersQuerySchema,
  WhalesEthTransfersQuerySchema,
  WhalesChartsQuerySchema,
  WhalesChartNamedQuerySchema,

  // Staking
  StakingRatedQuerySchema,
  StakingOperatorsQuerySchema,

  // L2
  L2TvlQuerySchema,
  L2ActivityQuerySchema,

  // Gas
  GasChainQuerySchema,

  // ETF
  EtfChartQuerySchema,

  // Unlocks
  UnlocksUpcomingQuerySchema,

  // Solana
  SolanaPriceQuerySchema,
  SolanaPricesQuerySchema,
  SolanaQuoteQuerySchema,
  SolanaSearchQuerySchema,
  SolanaPriceVsQuerySchema,

  // AI
  AiCompareQuerySchema,
  AiExplainQuerySchema,
  AiPortfolioReviewQuerySchema,
  AiCorrelationQuerySchema,
  AiChainCompareQuerySchema,

  // Agents
  AgentsSearchQuerySchema,
  AgentsDiscoverQuerySchema,

  // Portfolio
  PortfolioVolatilityQuerySchema,

  // Macro
  MacroQuoteParamSchema,

  // WebSocket
  WsPricesQuerySchema,
} from "./route-schemas.js";
