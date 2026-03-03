/**
 * Crypto Vision — Route-Level Query & Param Schemas
 *
 * Zod object schemas for all route endpoint query parameters and path parameters.
 * These schemas drive both runtime validation AND OpenAPI spec generation.
 *
 * Convention: schemas are named  {Route}{Endpoint}QuerySchema / {Route}{Endpoint}ParamsSchema
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { z } from "zod";
import {
  CoinIdSchema,
  PageSchema,
  DaysSchema,
  LimitSchema,
  limitSchema,
  HexAddressSchema,
  ChainSlugSchema,
  SearchQuerySchema,
  CoinIdListSchema,
  CoinCapIntervalSchema,
  ChartIntervalSchema,
  PeriodSchema,
  NumericIdSchema,
} from "./validation.js";

// ═══════════════════════════════════════════════════════════════
// MARKET ROUTES
// ═══════════════════════════════════════════════════════════════

export const MarketCoinsQuerySchema = z.object({
  page: PageSchema,
  per_page: limitSchema(100, 250),
  order: z.string().default("market_cap_desc"),
  sparkline: z.string().optional(),
  ids: z.string().optional(),
  category: z.string().optional(),
});

export const MarketPriceQuerySchema = z.object({
  ids: z.string().min(1, "ids parameter is required"),
  vs_currencies: z.string().default("usd"),
});

export const MarketSearchQuerySchema = z.object({
  q: z.string().min(1, "Search query is required"),
});

export const MarketChartParamsSchema = z.object({
  id: CoinIdSchema,
});

export const MarketChartQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(7),
  interval: ChartIntervalSchema,
});

export const MarketOhlcQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(7),
});

export const MarketFearGreedQuerySchema = z.object({
  limit: limitSchema(1, 30),
});

export const MarketGainersLosersQuerySchema = z.object({
  limit: limitSchema(20, 100),
});

export const MarketHighVolumeQuerySchema = z.object({
  limit: limitSchema(20, 100),
});

export const MarketAthDistanceQuerySchema = z.object({
  limit: limitSchema(50, 250),
});

export const MarketCompareQuerySchema = z.object({
  ids: z.string().min(1, "ids parameter is required"),
});

export const MarketPaprikaTickersQuerySchema = z.object({
  limit: limitSchema(100, 250),
});

export const MarketCoincapAssetsQuerySchema = z.object({
  limit: limitSchema(100, 250),
});

export const MarketCoincapHistoryQuerySchema = z.object({
  interval: CoinCapIntervalSchema.default("h1"),
  start: z.coerce.number().optional(),
  end: z.coerce.number().optional(),
});

export const MarketCoinloreTickersQuerySchema = z.object({
  start: z.coerce.number().int().min(0).default(0),
  limit: limitSchema(100, 100),
});

export const MarketRatesQuerySchema = z.object({
  type: z.string().optional(),
});

export const MarketMarketsQuerySchema = z.object({
  limit: limitSchema(50, 200),
});

// ═══════════════════════════════════════════════════════════════
// ANALYTICS ROUTES
// ═══════════════════════════════════════════════════════════════

export const AnalyticsCorrelationQuerySchema = z.object({
  ids: z.string().default("bitcoin,ethereum,solana,cardano,avalanche-2"),
  days: z.coerce.number().int().min(1).max(365).default(90),
});

export const AnalyticsVolatilityQuerySchema = z.object({
  limit: limitSchema(50, 100),
  days: z.coerce.number().int().min(1).max(365).default(30),
});

export const AnalyticsL2QuerySchema = z.object({
  sort: z.string().default("tvl"),
  limit: limitSchema(50, 200),
});

export const AnalyticsRevenueQuerySchema = z.object({
  limit: limitSchema(50, 200),
  period: z.string().default("24h"),
});

export const AnalyticsTTFeesQuerySchema = z.object({
  limit: limitSchema(50, 200),
});

export const AnalyticsTTActiveUsersQuerySchema = z.object({
  limit: limitSchema(50, 200),
});

export const AnalyticsTTMarketQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

// ═══════════════════════════════════════════════════════════════
// AGGREGATE ROUTES
// ═══════════════════════════════════════════════════════════════

export const AggregateTickersQuerySchema = z.object({
  limit: limitSchema(100, 250),
});

export const AggregateAssetsQuerySchema = z.object({
  limit: limitSchema(100, 250),
});

export const AggregateHistoryQuerySchema = z.object({
  interval: CoinCapIntervalSchema.default("h1"),
});

export const AggregateTopMoversQuerySchema = z.object({
  limit: limitSchema(10, 25),
});

// ═══════════════════════════════════════════════════════════════
// NEWS ROUTES
// ═══════════════════════════════════════════════════════════════

export const NewsListQuerySchema = z.object({
  limit: limitSchema(20, 100),
  source: z.string().optional(),
  category: z.string().optional(),
  page: PageSchema,
});

export const NewsSearchQuerySchema = z.object({
  q: z.string().min(1, "Search query is required"),
  limit: limitSchema(20, 100),
});

export const NewsCategoryLimitQuerySchema = z.object({
  limit: limitSchema(20, 50),
});

export const NewsBreakingQuerySchema = z.object({
  limit: limitSchema(10, 50),
});

export const NewsTrendingQuerySchema = z.object({
  limit: limitSchema(10, 30),
});

export const NewsHomepageQuerySchema = z.object({
  latest: limitSchema(50, 50),
  breaking: limitSchema(5, 20),
  trending: limitSchema(10, 50),
});

// ═══════════════════════════════════════════════════════════════
// NEWS AGGREGATOR ROUTES
// ═══════════════════════════════════════════════════════════════

export const NewsAggLatestQuerySchema = z.object({
  limit: limitSchema(50, 200),
  source: z.string().optional(),
  category: z.string().optional(),
  page: PageSchema,
});

export const NewsAggSearchQuerySchema = z.object({
  q: z.string().min(1, "Search query is required"),
  limit: limitSchema(20, 100),
});

export const NewsAggBreakingQuerySchema = z.object({
  limit: limitSchema(10, 50),
});

export const NewsAggTrendingQuerySchema = z.object({
  limit: limitSchema(10, 50),
});

export const NewsAggCategoryQuerySchema = z.object({
  limit: limitSchema(30, 100),
});

// ═══════════════════════════════════════════════════════════════
// BITCOIN ROUTES
// ═══════════════════════════════════════════════════════════════

export const BitcoinAddressParamSchema = z.object({
  address: z.string().min(1, "Address is required"),
});

export const BitcoinTxParamSchema = z.object({
  txid: z.string().regex(/^[a-fA-F0-9]{64}$/, "Invalid transaction hash"),
});

export const BitcoinBlockParamSchema = z.object({
  hash: z.string().regex(/^[a-fA-F0-9]{64}$/, "Invalid block hash"),
});

// ═══════════════════════════════════════════════════════════════
// DEFI ROUTES
// ═══════════════════════════════════════════════════════════════

export const DefiProtocolsQuerySchema = z.object({
  limit: limitSchema(100, 500),
  chain: z.string().optional(),
  category: z.string().optional(),
});

export const DefiYieldsQuerySchema = z.object({
  limit: limitSchema(100, 500),
  chain: z.string().optional(),
  project: z.string().optional(),
  stablecoin: z.string().optional(),
  min_tvl: z.coerce.number().min(0).default(0),
  min_apy: z.coerce.number().min(0).default(0),
});

export const DefiRaisesQuerySchema = z.object({
  limit: limitSchema(50, 200),
});

export const DefiHacksQuerySchema = z.object({
  limit: limitSchema(50, 200),
});

export const DefiTreasuriesQuerySchema = z.object({
  limit: limitSchema(50, 200),
});

export const DefiRevenueQuerySchema = z.object({
  limit: limitSchema(50, 200),
});

// ═══════════════════════════════════════════════════════════════
// CEX ROUTES
// ═══════════════════════════════════════════════════════════════

export const CexTickersQuerySchema = z.object({
  quote: z.string().optional(),
  limit: limitSchema(100, 500),
});

export const CexPricesQuerySchema = z.object({
  quote: z.string().optional(),
  limit: limitSchema(200, 2000),
});

export const CexOrderbookQuerySchema = z.object({
  limit: limitSchema(20, 1000),
});

export const CexTradesQuerySchema = z.object({
  limit: limitSchema(50, 1000),
});

export const CexKlinesQuerySchema = z.object({
  interval: z.string().default("1h"),
  limit: limitSchema(100, 1000),
});

export const CexPairsQuerySchema = z.object({
  quote: z.string().optional(),
  status: z.string().default("TRADING"),
});

export const CexBookTickerQuerySchema = z.object({
  symbol: z.string().optional(),
  quote: z.string().optional(),
});

export const CexMiniTickerQuerySchema = z.object({
  quote: z.string().optional(),
});

// ═══════════════════════════════════════════════════════════════
// DERIVATIVES ROUTES
// ═══════════════════════════════════════════════════════════════

export const DerivativesOiQuerySchema = z.object({
  limit: limitSchema(50, 200),
});

export const DerivativesLiquidationsQuerySchema = z.object({
  limit: limitSchema(50, 200),
});

export const DerivativesLongShortQuerySchema = z.object({
  interval: z.string().default("h1"),
});

// ═══════════════════════════════════════════════════════════════
// NFT ROUTES
// ═══════════════════════════════════════════════════════════════

export const NftTopQuerySchema = z.object({
  chain: z.string().default("ethereum"),
  sortBy: z.string().default("1DayVolume"),
  limit: limitSchema(50, 100),
});

export const NftTrendingQuerySchema = z.object({
  chain: z.string().default("ethereum"),
  period: z.string().default("1d"),
  limit: limitSchema(50, 100),
});

export const NftCollectionQuerySchema = z.object({
  chain: z.string().default("ethereum"),
});

export const NftActivityQuerySchema = z.object({
  chain: z.string().default("ethereum"),
  limit: limitSchema(50, 100),
  types: z.string().default("sale,transfer,mint"),
});

export const NftBidsQuerySchema = z.object({
  chain: z.string().default("ethereum"),
  limit: limitSchema(20, 50),
});

export const NftListingsQuerySchema = z.object({
  chain: z.string().default("ethereum"),
  limit: limitSchema(20, 50),
});

export const NftSearchQuerySchema = z.object({
  q: z.string().min(1, "Search query is required"),
  chain: z.string().default("ethereum"),
  limit: limitSchema(20, 50),
});

export const NftUserQuerySchema = z.object({
  chain: z.string().default("ethereum"),
  limit: limitSchema(50, 100),
});

export const NftListQuerySchema = z.object({
  per_page: limitSchema(100, 250),
  page: PageSchema,
});

export const NftMarketChartQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

export const NftStatsQuerySchema = z.object({
  chain: z.string().default("ethereum"),
});

// ═══════════════════════════════════════════════════════════════
// ONCHAIN ROUTES
// ═══════════════════════════════════════════════════════════════

export const OnchainPricesQuerySchema = z.object({
  coins: z.string().min(1, "coins parameter is required"),
});

export const OnchainTvlQuerySchema = z.object({
  limit: limitSchema(50, 200),
});

export const OnchainBtcBlocksQuerySchema = z.object({
  limit: limitSchema(10, 15),
});

export const OnchainBtcMinersQuerySchema = z.object({
  period: PeriodSchema.default("1w"),
});

export const OnchainBtcHashrateQuerySchema = z.object({
  period: z.string().default("1m"),
});

// ═══════════════════════════════════════════════════════════════
// PERPS ROUTES
// ═══════════════════════════════════════════════════════════════

export const PerpsKlinesQuerySchema = z.object({
  interval: z.string().default("60"),
  limit: limitSchema(100, 1000),
});

export const PerpsDydxSparklinesQuerySchema = z.object({
  period: z.string().default("ONE_DAY"),
});

// ═══════════════════════════════════════════════════════════════
// EXCHANGES ROUTES
// ═══════════════════════════════════════════════════════════════

export const ExchangesBybitInsuranceQuerySchema = z.object({
  coin: z.string().default("BTC"),
});

export const ExchangesBybitRiskQuerySchema = z.object({
  symbol: z.string().default("BTCUSDT"),
  category: z.string().default("linear"),
});

export const ExchangesDeribitIndexQuerySchema = z.object({
  currency: z.string().default("BTC"),
});

export const ExchangesCoincapCandlesQuerySchema = z.object({
  exchange: z.string().default("binance"),
  base: z.string().default("bitcoin"),
  quote: z.string().default("tether"),
  interval: CoinCapIntervalSchema.default("h1"),
});

export const ExchangesOkxInstrumentsQuerySchema = z.object({
  type: z.string().default("SPOT"),
});

export const ExchangesOkxMarkPriceQuerySchema = z.object({
  type: z.string().default("SWAP"),
  instId: z.string().optional(),
});

// ═══════════════════════════════════════════════════════════════
// SOCIAL ROUTES
// ═══════════════════════════════════════════════════════════════

export const SocialProfilesQuerySchema = z.object({
  ids: z.string().min(1, "ids parameter is required"),
});

export const SocialFearGreedQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(1),
});

export const SocialFearGreedHistoryQuerySchema = z.object({
  limit: limitSchema(30, 365),
});

export const SocialLunarTopQuerySchema = z.object({
  sort: z.string().default("galaxy_score"),
  limit: limitSchema(50, 100),
});

export const SocialLunarFeedQuerySchema = z.object({
  limit: limitSchema(20, 50),
});

export const SocialCCHistoryQuerySchema = z.object({
  limit: limitSchema(30, 365),
});

// ═══════════════════════════════════════════════════════════════
// GOVERNANCE ROUTES
// ═══════════════════════════════════════════════════════════════

export const GovernanceProposalsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  state: z.string().optional(),
});

export const GovernanceSpacesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const GovernanceVotesQuerySchema = z.object({
  limit: limitSchema(100, 1000),
});

export const GovernanceTopSpacesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ═══════════════════════════════════════════════════════════════
// CALENDAR ROUTES
// ═══════════════════════════════════════════════════════════════

export const CalendarEventsQuerySchema = z.object({
  page: PageSchema,
  max: limitSchema(50, 100),
  sortBy: z.string().default("hot_events"),
});

export const CalendarCoinQuerySchema = z.object({
  page: PageSchema,
  max: limitSchema(25, 100),
});

export const CalendarCategoryQuerySchema = z.object({
  page: PageSchema,
  max: limitSchema(25, 100),
});

export const CalendarAggregateQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

// ═══════════════════════════════════════════════════════════════
// ANOMALY ROUTES
// ═══════════════════════════════════════════════════════════════

export const AnomalyListQuerySchema = z.object({
  severity: z.string().optional(),
  type: z.string().optional(),
  asset: z.string().optional(),
  limit: limitSchema(50, 200),
});

// ═══════════════════════════════════════════════════════════════
// RESEARCH ROUTES
// ═══════════════════════════════════════════════════════════════

export const ResearchAssetsQuerySchema = z.object({
  limit: limitSchema(50, 200),
  page: PageSchema,
});

export const ResearchCompareQuerySchema = z.object({
  slugs: z.string().min(1, "slugs parameter is required"),
});

export const ResearchTopVolumeQuerySchema = z.object({
  limit: limitSchema(50, 100),
});

export const ResearchExchangesQuerySchema = z.object({
  limit: limitSchema(20, 50),
});

export const ResearchPriceQuerySchema = z.object({
  fsyms: z.string().default("BTC,ETH"),
  tsyms: z.string().default("USD"),
});

export const ResearchHistodayQuerySchema = z.object({
  vs: z.string().default("USD"),
  limit: limitSchema(30, 365),
});

export const ResearchHistohourQuerySchema = z.object({
  vs: z.string().default("USD"),
  limit: limitSchema(24, 168),
});

export const ResearchTopMcapQuerySchema = z.object({
  vs: z.string().default("USD"),
  limit: limitSchema(50, 100),
});

export const ResearchNewsQuerySchema = z.object({
  categories: z.string().optional(),
});

// ═══════════════════════════════════════════════════════════════
// WHALES ROUTES
// ═══════════════════════════════════════════════════════════════

export const WhalesBtcLatestQuerySchema = z.object({
  limit: limitSchema(25, 100),
});

export const WhalesEthHoldersQuerySchema = z.object({
  page: PageSchema,
  offset: limitSchema(25, 100),
});

export const WhalesEthTransfersQuerySchema = z.object({
  startblock: z.coerce.number().int().min(0).default(0),
});

export const WhalesChartsQuerySchema = z.object({
  timespan: z.string().default("1year"),
});

export const WhalesChartNamedQuerySchema = z.object({
  timespan: z.string().default("1year"),
  rollingAverage: z.string().optional(),
});

// ═══════════════════════════════════════════════════════════════
// STAKING ROUTES
// ═══════════════════════════════════════════════════════════════

export const StakingRatedQuerySchema = z.object({
  window: z.string().default("30d"),
});

export const StakingOperatorsQuerySchema = z.object({
  window: z.string().default("30d"),
  size: limitSchema(50, 100),
});

// ═══════════════════════════════════════════════════════════════
// L2 ROUTES
// ═══════════════════════════════════════════════════════════════

export const L2TvlQuerySchema = z.object({
  limit: limitSchema(20, 100),
});

export const L2ActivityQuerySchema = z.object({
  limit: limitSchema(20, 100),
});

// ═══════════════════════════════════════════════════════════════
// GAS ROUTES
// ═══════════════════════════════════════════════════════════════

export const GasChainQuerySchema = z.object({
  source: z.string().optional(),
});

// ═══════════════════════════════════════════════════════════════
// ETF ROUTES
// ═══════════════════════════════════════════════════════════════

export const EtfChartQuerySchema = z.object({
  range: z.string().default("1mo"),
  interval: z.string().default("1d"),
});

// ═══════════════════════════════════════════════════════════════
// UNLOCKS ROUTES
// ═══════════════════════════════════════════════════════════════

export const UnlocksUpcomingQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

// ═══════════════════════════════════════════════════════════════
// SOLANA ROUTES
// ═══════════════════════════════════════════════════════════════

export const SolanaPriceQuerySchema = z.object({
  vs: z.string().optional(),
});

export const SolanaPricesQuerySchema = z.object({
  ids: z.string().min(1, "ids parameter is required"),
  vs: z.string().optional(),
});

export const SolanaQuoteQuerySchema = z.object({
  inputMint: z.string().min(1, "inputMint is required"),
  outputMint: z.string().min(1, "outputMint is required"),
  amount: z.string().min(1, "amount is required"),
  slippageBps: z.coerce.number().int().min(0).max(10000).optional(),
});

export const SolanaSearchQuerySchema = z.object({
  q: z.string().min(1, "Search query is required"),
});

export const SolanaPriceVsQuerySchema = z.object({
  vs: z.string().optional(),
});

// ═══════════════════════════════════════════════════════════════
// AI ROUTES (query-only schemas — POST body schemas live in validation.ts)
// ═══════════════════════════════════════════════════════════════

export const AiCompareQuerySchema = z.object({
  ids: z.string().min(1, "ids parameter is required"),
});

export const AiExplainQuerySchema = z.object({
  level: z.enum(["beginner", "intermediate", "advanced"]).default("beginner"),
});

export const AiPortfolioReviewQuerySchema = z.object({
  holdings: z.string().min(1, "holdings parameter is required"),
});

export const AiCorrelationQuerySchema = z.object({
  ids: z.string().default("bitcoin,ethereum,solana"),
});

export const AiChainCompareQuerySchema = z.object({
  chains: z.string().min(1, "chains parameter is required"),
});

// ═══════════════════════════════════════════════════════════════
// AGENTS ROUTES (query-only, POST body schemas in validation.ts)
// ═══════════════════════════════════════════════════════════════

export const AgentsSearchQuerySchema = z.object({
  q: z.string().default(""),
});

export const AgentsDiscoverQuerySchema = z.object({
  q: z.string().optional(),
  limit: limitSchema(5, 10),
});

// ═══════════════════════════════════════════════════════════════
// PORTFOLIO ROUTES
// ═══════════════════════════════════════════════════════════════

export const PortfolioVolatilityQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(90),
  vs: z.string().default("usd"),
});

// ═══════════════════════════════════════════════════════════════
// MACRO ROUTES
// ═══════════════════════════════════════════════════════════════

export const MacroQuoteParamSchema = z.object({
  symbol: z.string().min(1, "Symbol is required").max(20),
});

// ═══════════════════════════════════════════════════════════════
// WS ROUTES
// ═══════════════════════════════════════════════════════════════

export const WsPricesQuerySchema = z.object({
  coins: z.string().default("bitcoin,ethereum"),
});
