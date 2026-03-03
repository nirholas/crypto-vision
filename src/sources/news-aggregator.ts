/**
 * Crypto Vision — News Aggregator Engine
 *
 * Ported from free-crypto-news (src/lib/crypto-news.ts).
 * Aggregates news from 130+ RSS sources and multiple JSON API sources.
 *
 * Features:
 *  - 130+ RSS feed sources across 21 categories
 *  - 10+ free JSON API sources (CryptoCompare, CoinGecko, Fear & Greed, etc.)
 *  - Source reputation scoring and trending algorithm
 *  - Worker-pool parallel fetching (25 concurrent, no batch-waiting)
 *  - Per-source circuit breaker (auto-disable after 3 failures, 10m cooldown)
 *  - Title-based deduplication
 *  - Category-based keyword filtering
 *  - Stale-while-revalidate caching via lib/cache.ts (5m per-feed, 5m aggregate)
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 * @see https://github.com/nirholas/free-crypto-news
 */

import { cache } from "../lib/cache.js";
import { log } from "../lib/logger.js";

// ═══════════════════════════════════════════════════════════════
// Per-source circuit breaker — auto-disable feeds after repeated failures
// ═══════════════════════════════════════════════════════════════

interface CircuitState {
  failures: number;
  lastFailure: number;
  open: boolean;
}

/** In-memory circuit breaker map: sourceKey → state */
const circuits = new Map<string, CircuitState>();

/** Number of consecutive failures before a source is circuit-broken */
const CB_FAILURE_THRESHOLD = 3;

/** How long a circuit stays open before allowing a retry (ms) */
const CB_RESET_MS = 10 * 60_000; // 10 minutes

function isCircuitOpen(sourceKey: string): boolean {
  const state = circuits.get(sourceKey);
  if (!state?.open) return false;
  // Allow retry after reset window
  if (Date.now() - state.lastFailure > CB_RESET_MS) {
    state.open = false;
    state.failures = 0;
    return false;
  }
  return true;
}

function recordFailure(sourceKey: string): void {
  const state = circuits.get(sourceKey) ?? { failures: 0, lastFailure: 0, open: false };
  state.failures++;
  state.lastFailure = Date.now();
  if (state.failures >= CB_FAILURE_THRESHOLD) {
    state.open = true;
    log.warn({ source: sourceKey, failures: state.failures }, "circuit breaker opened — source disabled temporarily");
  }
  circuits.set(sourceKey, state);
}

function recordSuccess(sourceKey: string): void {
  const state = circuits.get(sourceKey);
  if (state) {
    state.failures = 0;
    state.open = false;
  }
}

// ═══════════════════════════════════════════════════════════════
// RSS SOURCES — 130+ feeds across 21 categories
// Ported from upstream free-crypto-news
// ═══════════════════════════════════════════════════════════════

interface RSSSourceEntry {
  name: string;
  url: string;
  category: string;
  disabled?: boolean;
}

const RSS_SOURCES: Record<string, RSSSourceEntry> = {
  // ── TIER 1: Major News Outlets ─────────────────────────────
  coindesk:        { name: "CoinDesk",        url: "https://www.coindesk.com/arc/outboundfeeds/rss/",  category: "general" },
  theblock:        { name: "The Block",       url: "https://www.theblock.co/rss.xml",                  category: "general" },
  decrypt:         { name: "Decrypt",         url: "https://decrypt.co/feed",                          category: "general" },
  cointelegraph:   { name: "CoinTelegraph",   url: "https://cointelegraph.com/rss",                    category: "general" },
  bitcoinmagazine: { name: "Bitcoin Magazine", url: "https://bitcoinmagazine.com/.rss/full/",          category: "bitcoin" },
  blockworks:      { name: "Blockworks",      url: "https://blockworks.co/feed",                       category: "general" },
  defiant:         { name: "The Defiant",     url: "https://thedefiant.io/feed",                       category: "defi" },

  // ── TIER 2: Established News Sources ───────────────────────
  bitcoinist:   { name: "Bitcoinist",   url: "https://bitcoinist.com/feed/",   category: "bitcoin" },
  cryptoslate:  { name: "CryptoSlate",  url: "https://cryptoslate.com/feed/",  category: "general" },
  newsbtc:      { name: "NewsBTC",      url: "https://www.newsbtc.com/feed/",  category: "general" },
  cryptonews:   { name: "Crypto.news",  url: "https://crypto.news/feed/",      category: "general" },
  cryptopotato: { name: "CryptoPotato", url: "https://cryptopotato.com/feed/", category: "general" },

  // ── DeFi & Web3 ───────────────────────────────────────────
  defirate:      { name: "DeFi Rate",     url: "https://defirate.com/feed/",       category: "defi" },
  dailydefi:     { name: "Daily DeFi",    url: "https://dailydefi.org/feed/",      category: "defi" },
  rekt:          { name: "Rekt News",     url: "https://rekt.news/rss.xml",        category: "defi" },
  defipulse:     { name: "DeFi Pulse Blog", url: "https://defipulse.com/blog/feed/", category: "defi" },
  bankless:      { name: "Bankless",      url: "https://newsletter.banklesshq.com/feed", category: "defi" },
  defillama_news:{ name: "DefiLlama News", url: "https://defillama.com/feed",      category: "defi" },
  yearn_blog:    { name: "Yearn Finance Blog", url: "https://blog.yearn.finance/feed", category: "defi" },
  uniswap_blog:  { name: "Uniswap Blog",  url: "https://uniswap.org/blog/feed.xml", category: "defi" },
  aave_blog:     { name: "Aave Blog",     url: "https://aave.mirror.xyz/feed/atom", category: "defi" },
  compound_blog: { name: "Compound Blog",  url: "https://medium.com/feed/compound-finance", category: "defi" },
  makerdao_blog: { name: "MakerDAO Blog",  url: "https://blog.makerdao.com/feed/", category: "defi" },

  // ── NFT & Metaverse ───────────────────────────────────────
  nftnow:        { name: "NFT Now",       url: "https://nftnow.com/feed/",         category: "nft" },
  nftevening:    { name: "NFT Evening",   url: "https://nftevening.com/feed/",     category: "nft", disabled: true },
  nftplazas:     { name: "NFT Plazas",    url: "https://nftplazas.com/feed/",      category: "nft" },
  dappradar_blog:{ name: "DappRadar Blog", url: "https://dappradar.com/blog/feed", category: "nft" },

  // ── Research & Analysis ───────────────────────────────────
  messari_rss:       { name: "Messari",          url: "https://messari.io/rss",                    category: "research" },
  thedefireport:     { name: "The DeFi Report",  url: "https://thedefireport.substack.com/feed",   category: "research" },
  cryptobriefing:    { name: "Crypto Briefing",  url: "https://cryptobriefing.com/feed/",          category: "research" },
  glassnode:         { name: "Glassnode Insights", url: "https://insights.glassnode.com/rss/",     category: "research" },
  delphi_digital:    { name: "Delphi Digital",   url: "https://members.delphidigital.io/feed",     category: "research" },
  paradigm_research: { name: "Paradigm Research", url: "https://www.paradigm.xyz/feed.xml",        category: "research" },
  a16z_crypto:       { name: "a16z Crypto",      url: "https://a16zcrypto.com/feed/",              category: "research" },
  theblockresearch:  { name: "The Block Research", url: "https://www.theblock.co/research/feed",   category: "research" },

  // ── Trading & Market Analysis ─────────────────────────────
  ambcrypto:         { name: "AMBCrypto",      url: "https://ambcrypto.com/feed/",       category: "trading" },
  beincrypto:        { name: "BeInCrypto",     url: "https://beincrypto.com/feed/",      category: "trading" },
  u_today:           { name: "U.Today",        url: "https://u.today/rss",               category: "trading" },
  fxstreet_crypto:   { name: "FXStreet Crypto", url: "https://www.fxstreet.com/cryptocurrencies/news/feed", category: "trading" },
  tradingview_crypto:{ name: "TradingView Crypto Ideas", url: "https://www.tradingview.com/feed/?sort=recent&stream=crypto", category: "trading" },
  cryptoquant_blog:  { name: "CryptoQuant Blog", url: "https://cryptoquant.com/blog/feed", category: "trading" },

  // ── Mining & Energy ───────────────────────────────────────
  bitcoinmining:      { name: "Bitcoin Mining News", url: "https://bitcoinmagazine.com/tags/mining/.rss/full/", category: "mining" },
  hashrateindex:      { name: "Hashrate Index",      url: "https://hashrateindex.com/blog/feed/",              category: "mining" },
  compassmining_blog: { name: "Compass Mining Blog", url: "https://compassmining.io/education/feed/",         category: "mining" },

  // ── Ethereum ──────────────────────────────────────────────
  weekinethereumnews: { name: "Week in Ethereum", url: "https://weekinethereumnews.com/feed/", category: "ethereum", disabled: true },
  etherscan:          { name: "Etherscan Blog",   url: "https://etherscan.io/blog?rss",        category: "ethereum" },
  daily_gwei:         { name: "The Daily Gwei",   url: "https://thedailygwei.substack.com/feed", category: "ethereum" },
  week_in_ethereum:   { name: "Week in Ethereum", url: "https://weekinethereumnews.com/feed/", category: "ethereum", disabled: true },

  // ── Layer 2 & Scaling ─────────────────────────────────────
  l2beat:          { name: "L2BEAT Blog",   url: "https://l2beat.com/blog/rss.xml",          category: "layer2" },
  optimism_blog:   { name: "Optimism Blog", url: "https://optimism.mirror.xyz/feed/atom",    category: "layer2" },
  arbitrum_blog:   { name: "Arbitrum Blog", url: "https://arbitrum.io/blog/rss.xml",         category: "layer2" },
  polygon_blog:    { name: "Polygon Blog",  url: "https://polygon.technology/blog/feed",     category: "layer2" },
  starknet_blog:   { name: "StarkNet Blog", url: "https://starkware.medium.com/feed",        category: "layer2" },
  zksync_blog:     { name: "zkSync Blog",   url: "https://zksync.mirror.xyz/feed/atom",      category: "layer2" },
  base_blog:       { name: "Base Blog",     url: "https://base.mirror.xyz/feed/atom",        category: "layer2" },

  // ── Mainstream Finance Crypto Coverage ─────────────────────
  bloomberg_crypto: { name: "Bloomberg Crypto",  url: "https://www.bloomberg.com/crypto/feed",             category: "mainstream", disabled: true },
  reuters_crypto:   { name: "Reuters Crypto",    url: "https://www.reuters.com/technology/cryptocurrency/rss", category: "mainstream", disabled: true },
  forbes_crypto:    { name: "Forbes Crypto",     url: "https://www.forbes.com/crypto-blockchain/feed/",    category: "mainstream" },
  cnbc_crypto:      { name: "CNBC Crypto",       url: "https://www.cnbc.com/id/100727362/device/rss/rss.html", category: "mainstream", disabled: true },
  yahoo_crypto:     { name: "Yahoo Finance Crypto", url: "https://finance.yahoo.com/rss/cryptocurrency",  category: "mainstream", disabled: true },
  wsj_crypto:       { name: "WSJ Crypto",        url: "https://feeds.a.dj.com/rss/RSSWSJD.xml",           category: "mainstream", disabled: true },
  ft_crypto:        { name: "FT Crypto",          url: "https://www.ft.com/cryptocurrencies?format=rss",   category: "mainstream", disabled: true },

  // ── Institutional Research & VC ────────────────────────────
  coinbase_blog:      { name: "Coinbase Blog",      url: "https://www.coinbase.com/blog/rss.xml",       category: "institutional" },
  binance_blog:       { name: "Binance Blog",       url: "https://www.binance.com/en/blog/rss.xml",     category: "institutional" },
  galaxy_research:    { name: "Galaxy Digital Research", url: "https://www.galaxy.com/insights/feed/",   category: "institutional" },
  pantera_capital:    { name: "Pantera Capital",     url: "https://panteracapital.com/feed/",            category: "institutional" },
  multicoin_capital:  { name: "Multicoin Capital",   url: "https://multicoin.capital/feed/",             category: "institutional" },
  placeholder_vc:     { name: "Placeholder VC",      url: "https://www.placeholder.vc/blog?format=rss", category: "institutional" },
  variant_fund:       { name: "Variant Fund",        url: "https://variant.fund/writing/rss",            category: "institutional" },
  dragonfly_research: { name: "Dragonfly Research",  url: "https://medium.com/feed/dragonfly-research",  category: "institutional" },

  // ── ETF & Asset Managers ──────────────────────────────────
  grayscale_insights:  { name: "Grayscale Insights",  url: "https://grayscale.com/insights/feed/",        category: "etf" },
  bitwise_research:    { name: "Bitwise Research",    url: "https://bitwiseinvestments.com/feed/",        category: "etf" },
  vaneck_blog:         { name: "VanEck Blog",         url: "https://www.vaneck.com/us/en/blogs/rss/",    category: "etf" },
  coinshares_research: { name: "CoinShares Research", url: "https://blog.coinshares.com/feed",           category: "etf" },
  ark_invest:          { name: "ARK Invest",          url: "https://ark-invest.com/articles/feed/",      category: "etf" },
  twentyone_shares:    { name: "21Shares Research",   url: "https://21shares.com/research/feed/",        category: "etf" },
  wisdomtree_blog:     { name: "WisdomTree Blog",     url: "https://www.wisdomtree.com/blog/feed",       category: "etf" },

  // ── Developer & Tech ──────────────────────────────────────
  alchemy_blog:   { name: "Alchemy Blog",   url: "https://www.alchemy.com/blog/rss",      category: "developer" },
  chainlink_blog: { name: "Chainlink Blog", url: "https://blog.chain.link/feed/",         category: "developer" },
  infura_blog:    { name: "Infura Blog",    url: "https://blog.infura.io/feed/",          category: "developer" },
  thegraph_blog:  { name: "The Graph Blog", url: "https://thegraph.com/blog/feed",        category: "developer" },
  hardhat_blog:   { name: "Hardhat Blog",   url: "https://hardhat.org/blog/rss.xml",      category: "developer" },
  foundry_blog:   { name: "Foundry Blog",   url: "https://book.getfoundry.sh/feed.xml",   category: "developer" },

  // ── Security & Auditing ───────────────────────────────────
  slowmist:           { name: "SlowMist Blog",     url: "https://slowmist.medium.com/feed",              category: "security" },
  certik_blog:        { name: "CertiK Blog",       url: "https://www.certik.com/resources/blog/rss.xml", category: "security" },
  openzeppelin_blog:  { name: "OpenZeppelin Blog",  url: "https://blog.openzeppelin.com/feed/",          category: "security" },
  trailofbits:        { name: "Trail of Bits Blog", url: "https://blog.trailofbits.com/feed/",           category: "security" },
  samczsun:           { name: "samczsun Blog",      url: "https://samczsun.com/rss/",                    category: "security" },
  immunefi_blog:      { name: "Immunefi Blog",     url: "https://immunefi.medium.com/feed",              category: "security" },

  // ── Bitcoin Ecosystem Extended ────────────────────────────
  btctimes:          { name: "BTC Times",        url: "https://www.btctimes.com/feed/",    category: "bitcoin" },
  lightninglabs_blog:{ name: "Lightning Labs Blog", url: "https://lightning.engineering/feed", category: "bitcoin" },
  stackernews:       { name: "Stacker News",     url: "https://stacker.news/rss",           category: "bitcoin" },

  // ── Solana Ecosystem ──────────────────────────────────────
  solana_news: { name: "Solana News", url: "https://solana.com/news/rss.xml", category: "solana" },

  // ── Alternative L1s ───────────────────────────────────────
  near_blog:      { name: "NEAR Protocol Blog", url: "https://near.org/blog/feed/",             category: "altl1" },
  cosmos_blog:    { name: "Cosmos Blog",         url: "https://blog.cosmos.network/feed",        category: "altl1" },
  avalanche_blog: { name: "Avalanche Blog",      url: "https://medium.com/feed/avalancheavax",   category: "altl1" },
  sui_blog:       { name: "Sui Blog",            url: "https://blog.sui.io/feed/",               category: "altl1" },
  aptos_blog:     { name: "Aptos Blog",          url: "https://medium.com/feed/aptoslabs",       category: "altl1" },
  cardano_blog:   { name: "Cardano Blog",        url: "https://iohk.io/en/blog/posts/feed.rss", category: "altl1" },
  polkadot_blog:  { name: "Polkadot Blog",       url: "https://polkadot.network/blog/feed/",    category: "altl1" },

  // ── Stablecoin & CBDC ────────────────────────────────────
  circle_blog: { name: "Circle Blog",  url: "https://www.circle.com/blog/feed",  category: "stablecoin" },
  tether_news: { name: "Tether News",  url: "https://tether.to/en/news/feed/",   category: "stablecoin" },

  // ── On-Chain Analytics ────────────────────────────────────
  kaiko_research: { name: "Kaiko Research",  url: "https://blog.kaiko.com/rss/",             category: "onchain" },
  intotheblock:   { name: "IntoTheBlock",    url: "https://medium.com/feed/intotheblock",    category: "onchain" },
  coin_metrics:   { name: "Coin Metrics",    url: "https://coinmetrics.substack.com/feed",   category: "onchain" },
  thetie_research:{ name: "The Tie Research", url: "https://blog.thetie.io/feed/",           category: "onchain" },
  woobull:        { name: "Willy Woo",       url: "https://woobull.com/feed/",               category: "onchain" },

  // ── Derivatives ───────────────────────────────────────────
  deribit_insights: { name: "Deribit Insights", url: "https://insights.deribit.com/feed/", category: "derivatives" },

  // ── Fintech & Payments ────────────────────────────────────
  finextra:       { name: "Finextra",        url: "https://www.finextra.com/rss/headlines.aspx",  category: "fintech" },
  pymnts_crypto:  { name: "PYMNTS Crypto",   url: "https://www.pymnts.com/cryptocurrency/feed/",  category: "fintech" },
  fintech_futures:{ name: "Fintech Futures",  url: "https://www.fintechfutures.com/feed/",         category: "fintech" },

  // ── Macro Analysis ────────────────────────────────────────
  lyn_alden:          { name: "Lyn Alden",          url: "https://www.lynalden.com/feed/",          category: "macro" },
  alhambra_partners:  { name: "Alhambra Partners",  url: "https://www.alhambrapartners.com/feed/",  category: "macro" },
  macro_voices:       { name: "Macro Voices",       url: "https://www.macrovoices.com/feed",        category: "macro" },

  // ── Quant & Systematic Trading ────────────────────────────
  aqr_insights:        { name: "AQR Insights",     url: "https://www.aqr.com/Insights/feed",       category: "quant" },
  two_sigma_insights:  { name: "Two Sigma Insights", url: "https://www.twosigma.com/insights/rss/", category: "quant" },
  man_institute:       { name: "Man Institute",     url: "https://www.man.com/maninstitute/feed",   category: "quant" },
  alpha_architect:     { name: "Alpha Architect",   url: "https://alphaarchitect.com/feed/",        category: "quant" },
  quantstart:          { name: "QuantStart",        url: "https://www.quantstart.com/articles/rss/", category: "quant" },

  // ── Journalism ────────────────────────────────────────────
  unchained_crypto: { name: "Unchained Crypto", url: "https://unchainedcrypto.com/feed/", category: "journalism" },
  dl_news:          { name: "DL News",          url: "https://www.dlnews.com/feed/",      category: "journalism" },
  protos:           { name: "Protos",           url: "https://protos.com/feed/",           category: "journalism" },

  // ── Asia-Pacific ──────────────────────────────────────────
  forkast:        { name: "Forkast News",    url: "https://forkast.news/feed/",  category: "asia" },
  wu_blockchain:  { name: "Wu Blockchain",   url: "https://wublock.substack.com/feed", category: "asia" },
  coingape:       { name: "CoinGape",        url: "https://coingape.com/feed/",  category: "general" },

  // ── Gaming ────────────────────────────────────────────────
  playtoearn: { name: "PlayToEarn", url: "https://playtoearn.net/feed/", category: "gaming" },

  // ── Traditional Finance ───────────────────────────────────
  goldman_insights: { name: "Goldman Sachs Insights", url: "https://www.goldmansachs.com/insights/feed.rss", category: "tradfi", disabled: true },
  bny_mellon:       { name: "BNY Mellon Aerial View",  url: "https://www.bnymellon.com/us/en/insights/aerial-view-magazine.rss", category: "tradfi", disabled: true },

  // ── Additional General Sources ────────────────────────────
  dailyhodl:     { name: "The Daily Hodl", url: "https://dailyhodl.com/feed/",                 category: "general" },
  coinjournal:   { name: "CoinJournal",    url: "https://coinjournal.net/feed/",                category: "general" },
  cryptoglobe:   { name: "CryptoGlobe",   url: "https://www.cryptoglobe.com/latest/feed/",     category: "general" },
  zycrypto:      { name: "ZyCrypto",       url: "https://zycrypto.com/feed/",                   category: "general" },
  cryptodaily:   { name: "Crypto Daily",   url: "https://cryptodaily.co.uk/feed",               category: "general" },
  blockonomi:    { name: "Blockonomi",     url: "https://blockonomi.com/feed/",                 category: "general" },
  usethebitcoin: { name: "UseTheBitcoin",  url: "https://usethebitcoin.com/feed/",              category: "general" },
  nulltx:        { name: "NullTX",         url: "https://nulltx.com/feed/",                     category: "general" },
  coinspeaker:   { name: "Coinspeaker",    url: "https://www.coinspeaker.com/feed/",            category: "general" },
  cryptoninjas:  { name: "CryptoNinjas",   url: "https://www.cryptoninjas.net/feed/",           category: "general" },
};

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface NewsArticle {
  id: string;
  title: string;
  description: string;
  url: string;
  source: string;
  sourceKey: string;
  sourceName: string;
  publishedAt: string;
  categories: string[];
  category: string;
  imageUrl?: string;
  timeAgo: string;
}

export interface NewsResponse {
  articles: NewsArticle[];
  totalCount: number;
  sources: string[];
  timestamp: string;
  pagination?: {
    page: number;
    perPage: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface SourceInfo {
  id: string;
  name: string;
  url: string;
  category: string;
  icon?: string;
}

// ═══════════════════════════════════════════════════════════════
// Source Reputation Scores (0–100)
// Ported from upstream source-tiers.ts / crypto-news.ts
// ═══════════════════════════════════════════════════════════════

const SOURCE_REPUTATION_SCORES: Record<string, number> = {
  // Tier 1: Mainstream (95–100)
  "Bloomberg Crypto": 100, "Reuters Crypto": 100, "WSJ Crypto": 100,
  "CNBC Crypto": 95, "Forbes Crypto": 95, "Yahoo Finance Crypto": 90,
  "FT Crypto": 98,
  // Tier 2: Major crypto-native (85–90)
  "CoinDesk": 90, "The Block": 88, "Blockworks": 85, "Decrypt": 85,
  // Tier 3: Established crypto (75–80)
  "CoinTelegraph": 80, "Bitcoin Magazine": 78, "CryptoSlate": 75,
  "The Defiant": 75,
  // Tier 4: Specialized (60–70)
  "Messari": 70, "Bankless": 68, "Unchained Crypto": 65, "DL News": 65,
  "Glassnode Insights": 72, "Paradigm Research": 72, "a16z Crypto": 72,
  "Delphi Digital": 70, "The Block Research": 70,
  // Fintech (deprioritized)
  "Finextra": 35, "PYMNTS Crypto": 35, "Fintech Futures": 30,
  // Default
  default: 50,
};

const CRYPTO_KEYWORDS = [
  "bitcoin", "btc", "ethereum", "eth", "crypto", "blockchain", "defi", "nft",
  "altcoin", "token", "mining", "wallet", "exchange", "trading", "stablecoin",
  "satoshi", "web3", "dao", "dapp", "smart contract", "layer 2", "rollup",
  "price", "bull", "bear", "halving", "node", "validator", "staking",
];

// ═══════════════════════════════════════════════════════════════
// Category Metadata
// ═══════════════════════════════════════════════════════════════

const CATEGORY_META: Record<string, { name: string; description: string }> = {
  general:      { name: "General",      description: "Broad crypto industry news" },
  bitcoin:      { name: "Bitcoin",      description: "Bitcoin-specific news and analysis" },
  defi:         { name: "DeFi",         description: "Decentralized finance protocols and yields" },
  nft:          { name: "NFTs",         description: "Non-fungible tokens and digital collectibles" },
  research:     { name: "Research",     description: "Deep-dive analysis and reports" },
  institutional:{ name: "Institutional", description: "VC and institutional investor insights" },
  etf:          { name: "ETFs",         description: "Crypto ETF and asset manager news" },
  derivatives:  { name: "Derivatives",  description: "Options, futures, and structured products" },
  onchain:      { name: "On-Chain",     description: "Blockchain data and analytics" },
  fintech:      { name: "Fintech",      description: "Financial technology and payments" },
  macro:        { name: "Macro",        description: "Macroeconomic analysis and commentary" },
  quant:        { name: "Quant",        description: "Quantitative and systematic trading research" },
  journalism:   { name: "Investigative", description: "In-depth journalism and exposés" },
  ethereum:     { name: "Ethereum",     description: "Ethereum ecosystem news" },
  asia:         { name: "Asia",         description: "Asian market coverage" },
  tradfi:       { name: "TradFi",       description: "Traditional finance institutions" },
  mainstream:   { name: "Mainstream",   description: "Major media crypto coverage" },
  mining:       { name: "Mining",       description: "Bitcoin mining and hashrate" },
  gaming:       { name: "Gaming",       description: "Blockchain gaming and metaverse" },
  altl1:        { name: "Alt L1s",      description: "Alternative layer-1 blockchains" },
  stablecoin:   { name: "Stablecoins",  description: "Stablecoin and CBDC news" },
  layer2:       { name: "Layer 2",      description: "L2 scaling solutions" },
  trading:      { name: "Trading",      description: "Trading and market analysis" },
  developer:    { name: "Developer",    description: "Developer tooling and infrastructure" },
  security:     { name: "Security",     description: "Security audits and research" },
  solana:       { name: "Solana",       description: "Solana ecosystem news" },
};

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  bitcoin:    ["bitcoin", "btc", "satoshi", "lightning", "halving", "miner", "ordinals", "inscription", "sats"],
  ethereum:   ["ethereum", "eth", "vitalik", "erc-20", "erc-721", "layer 2", "l2", "rollup", "arbitrum", "optimism", "base"],
  defi:       ["defi", "yield", "lending", "liquidity", "amm", "dex", "aave", "uniswap", "compound", "curve", "maker", "lido", "staking", "vault", "protocol", "tvl"],
  nft:        ["nft", "non-fungible", "opensea", "blur", "ordinals", "inscription", "collection", "pfp", "digital art"],
  regulation: ["regulation", "sec", "cftc", "lawsuit", "legal", "compliance", "tax", "government", "congress", "senate", "bill", "law", "policy", "ban", "restrict"],
  markets:    ["market", "price", "trading", "bull", "bear", "rally", "crash", "etf", "futures", "options", "liquidation", "volume", "chart", "analysis"],
  mining:     ["mining", "miner", "hashrate", "difficulty", "pow", "proof of work", "asic", "pool"],
  stablecoin: ["stablecoin", "usdt", "usdc", "dai", "tether", "circle", "peg", "depeg"],
  exchange:   ["exchange", "binance", "coinbase", "kraken", "okx", "bybit", "trading", "listing", "delist"],
  layer2:     ["layer 2", "l2", "rollup", "arbitrum", "optimism", "base", "zksync", "polygon", "scaling"],
};

// ═══════════════════════════════════════════════════════════════
// Helpers (ported from upstream)
// ═══════════════════════════════════════════════════════════════

function hashId(source: string, title: string): string {
  let hash = 0;
  const str = `${source}:${title}`;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&"); // must be last
}

function stripHTML(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .trim()
    .slice(0, 300);
}

function extractImageUrl(xml: string): string | undefined {
  const m = xml.match(/<media:content[^>]*url="([^"]+)"/i)
    || xml.match(/<enclosure[^>]*url="([^"]+)"/i)
    || xml.match(/<media:thumbnail[^>]*url="([^"]+)"/i)
    || xml.match(/<image>[\s\S]*?<url>([^<]+)<\/url>/i)
    || xml.match(/<img[^>]+src="([^"]+)"/i);
  return m ? m[1] : undefined;
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// ═══════════════════════════════════════════════════════════════
// RSS Parser (regex-based, no xml2js dependency)
// ═══════════════════════════════════════════════════════════════

function parseRSSFeed(
  xml: string,
  sourceKey: string,
  sourceName: string,
  category: string,
): NewsArticle[] {
  const articles: NewsArticle[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  const titleRegex = /<title><!\[CDATA\[(.*?)\]\]>|<title>(.*?)<\/title>/i;
  const linkRegex = /<link>(.*?)<\/link>|<link><!\[CDATA\[(.*?)\]\]>/i;
  const descRegex = /<description><!\[CDATA\[([\s\S]*?)\]\]>|<description>([\s\S]*?)<\/description>/i;
  const pubDateRegex = /<pubDate>(.*?)<\/pubDate>/i;

  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    try {
      const titleMatch = itemXml.match(titleRegex);
      const linkMatch = itemXml.match(linkRegex);
      const descMatch = itemXml.match(descRegex);
      const pubDateMatch = itemXml.match(pubDateRegex);

      const title = decodeHTMLEntities((titleMatch?.[1] || titleMatch?.[2] || "").trim());
      const rawLink = (linkMatch?.[1] || linkMatch?.[2] || "").trim();
      // Strip CDATA wrappers that some feeds leave inside <link> tags
      const link = rawLink.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim();
      const rawDesc = descMatch?.[1] || descMatch?.[2] || "";
      const description = stripHTML(rawDesc);
      const pubDateStr = pubDateMatch?.[1] || "";

      if (!title || !link) continue;

      const pubDate = pubDateStr ? new Date(pubDateStr) : new Date();

      // Extract categories from <category> tags
      const categories: string[] = [];
      const catMatches = itemXml.matchAll(/<category[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/category>/gi);
      for (const cm of catMatches) {
        categories.push(cm[1].trim());
      }

      articles.push({
        id: hashId(sourceKey, title),
        title,
        description,
        url: link,
        source: sourceKey,
        sourceKey,
        sourceName,
        publishedAt: pubDate.toISOString(),
        categories: categories.slice(0, 5),
        category,
        imageUrl: extractImageUrl(itemXml),
        timeAgo: getTimeAgo(pubDate),
      });
    } catch {
      // Skip malformed items
    }
  }

  return articles;
}

// ═══════════════════════════════════════════════════════════════
// API Sources (JSON endpoints — free, no key required)
// ═══════════════════════════════════════════════════════════════

interface ApiSourceDef {
  name: string;
  url: string;
  category: string;
  parser: (data: unknown) => NewsArticle[];
}

const API_SOURCES: Record<string, ApiSourceDef> = {
  cryptocompare: {
    name: "CryptoCompare",
    url: "https://min-api.cryptocompare.com/data/v2/news/?lang=EN&sortOrder=latest",
    category: "general",
    parser: (data: unknown) => {
      const res = data as { Data?: Array<{ title: string; url: string; body: string; published_on: number; source: string; categories: string }> };
      if (!res.Data) return [];
      return res.Data.slice(0, 20).map(item => {
        const pubDate = new Date(item.published_on * 1000);
        return {
          id: hashId("cryptocompare", item.title),
          title: decodeHTMLEntities(item.title),
          description: item.body?.slice(0, 300) || "",
          url: item.url,
          source: "cryptocompare",
          sourceKey: "cryptocompare",
          sourceName: item.source || "CryptoCompare",
          publishedAt: pubDate.toISOString(),
          categories: (item.categories || "").split("|").slice(0, 3),
          category: "general",
          timeAgo: getTimeAgo(pubDate),
        };
      });
    },
  },
  fear_greed: {
    name: "Fear & Greed",
    url: "https://api.alternative.me/fng/?limit=1",
    category: "sentiment",
    parser: (data: unknown) => {
      const res = data as { data?: Array<{ value: string; value_classification: string; timestamp: string }> };
      if (!res.data?.[0]) return [];
      const item = res.data[0];
      const v = parseInt(item.value);
      const emoji = v < 25 ? "😨" : v < 50 ? "😟" : v < 75 ? "😊" : "🤑";
      const pubDate = new Date(parseInt(item.timestamp) * 1000);
      return [{
        id: hashId("fear_greed", item.value + item.timestamp),
        title: `${emoji} Crypto Fear & Greed Index: ${item.value} (${item.value_classification})`,
        description: `The market sentiment is "${item.value_classification}" with a score of ${item.value}/100`,
        url: "https://alternative.me/crypto/fear-and-greed-index/",
        source: "fear_greed",
        sourceKey: "fear_greed",
        sourceName: "Alternative.me",
        publishedAt: pubDate.toISOString(),
        categories: ["sentiment"],
        category: "sentiment",
        timeAgo: getTimeAgo(pubDate),
      }];
    },
  },
  mempool_fees: {
    name: "Mempool Fees",
    url: "https://mempool.space/api/v1/fees/recommended",
    category: "bitcoin",
    parser: (data: unknown) => {
      const fees = data as { fastestFee: number; halfHourFee: number; hourFee: number; economyFee: number };
      if (!fees.fastestFee) return [];
      return [{
        id: hashId("mempool", `${fees.fastestFee}-${Date.now()}`),
        title: `₿ BTC Fees: ⚡ ${fees.fastestFee} | ⏱️ ${fees.halfHourFee} | 🕐 ${fees.hourFee} sat/vB`,
        description: `Fastest: ${fees.fastestFee} sat/vB, 30min: ${fees.halfHourFee}, 1hr: ${fees.hourFee}, Economy: ${fees.economyFee}`,
        url: "https://mempool.space",
        source: "mempool_fees",
        sourceKey: "mempool_fees",
        sourceName: "Mempool.space",
        publishedAt: new Date().toISOString(),
        categories: ["bitcoin", "fees"],
        category: "bitcoin",
        timeAgo: "just now",
      }];
    },
  },
  etherscan_gas: {
    name: "Etherscan Gas",
    url: "https://api.etherscan.io/api?module=gastracker&action=gasoracle",
    category: "ethereum",
    parser: (data: unknown) => {
      const res = data as { result?: { SafeGasPrice: string; ProposeGasPrice: string; FastGasPrice: string } };
      if (!res.result?.SafeGasPrice) return [];
      const { SafeGasPrice, ProposeGasPrice, FastGasPrice } = res.result;
      return [{
        id: hashId("etherscan_gas", `${FastGasPrice}-${Date.now()}`),
        title: `⛽ ETH Gas: 🐢 ${SafeGasPrice} | 🚶 ${ProposeGasPrice} | 🚀 ${FastGasPrice} Gwei`,
        description: `Fast: ${FastGasPrice} Gwei, Standard: ${ProposeGasPrice} Gwei, Safe: ${SafeGasPrice} Gwei`,
        url: "https://etherscan.io/gastracker",
        source: "etherscan_gas",
        sourceKey: "etherscan_gas",
        sourceName: "Etherscan",
        publishedAt: new Date().toISOString(),
        categories: ["ethereum", "gas"],
        category: "ethereum",
        timeAgo: "just now",
      }];
    },
  },
};

// ═══════════════════════════════════════════════════════════════
// Fetch Functions (with caching and concurrency control)
// ═══════════════════════════════════════════════════════════════

async function fetchRSSFeed(sourceKey: string): Promise<NewsArticle[]> {
  const source = RSS_SOURCES[sourceKey];
  if (!source || source.disabled) return [];
  if (isCircuitOpen(sourceKey)) return [];

  return cache.wrap(`news:rss:${sourceKey}`, 300, async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5_000);

      const res = await fetch(source.url, {
        signal: controller.signal,
        headers: {
          Accept: "application/rss+xml, application/xml, text/xml",
          "User-Agent": "CryptoVision/1.0 (+https://cryptocurrency.cv)",
        },
      });
      clearTimeout(timeout);

      if (!res.ok) {
        log.warn({ source: sourceKey, status: res.status }, "RSS fetch failed");
        recordFailure(sourceKey);
        return [];
      }

      const xml = await res.text();
      const articles = parseRSSFeed(xml, sourceKey, source.name, source.category);
      recordSuccess(sourceKey);
      return articles;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("abort")) {
        log.warn({ source: sourceKey, err: msg }, "RSS fetch error");
      }
      recordFailure(sourceKey);
      return [];
    }
  });
}

async function fetchApiSource(sourceKey: string): Promise<NewsArticle[]> {
  const source = API_SOURCES[sourceKey];
  if (!source) return [];
  if (isCircuitOpen(`api:${sourceKey}`)) return [];

  return cache.wrap(`news:api:${sourceKey}`, 300, async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8_000);

      const res = await fetch(source.url, {
        signal: controller.signal,
        headers: { Accept: "application/json", "User-Agent": "CryptoVision/1.0" },
      });
      clearTimeout(timeout);
      if (!res.ok) {
        recordFailure(`api:${sourceKey}`);
        return [];
      }

      const data: unknown = await res.json();
      const articles = source.parser(data);
      recordSuccess(`api:${sourceKey}`);
      return articles;
    } catch {
      recordFailure(`api:${sourceKey}`);
      return [];
    }
  });
}

async function fetchAllApiSources(): Promise<NewsArticle[]> {
  const results = await Promise.allSettled(
    Object.keys(API_SOURCES).map(fetchApiSource),
  );
  const articles: NewsArticle[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") articles.push(...r.value);
  }
  return articles;
}

/**
 * Run async tasks with a concurrency limit.
 * Unlike serial batching, this keeps a pool of N concurrent tasks
 * and starts a new task as soon as one finishes. Much faster when
 * individual tasks have variable latency.
 */
async function pLimit<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let idx = 0;

  async function worker(): Promise<void> {
    while (idx < tasks.length) {
      const i = idx++;
      try {
        results[i] = { status: "fulfilled", value: await tasks[i]() };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()));
  return results;
}

/**
 * Fetch RSS feeds with true parallel pool (25 concurrent).
 * Uses a worker-pool pattern so a new fetch starts immediately
 * whenever a slot frees up — no waiting for batches to complete.
 */
async function fetchWithConcurrency(
  sourceKeys: string[],
  concurrency = 25,
): Promise<NewsArticle[]> {
  const tasks = sourceKeys.map((key) => () => fetchRSSFeed(key));
  const results = await pLimit(tasks, concurrency);
  const articles: NewsArticle[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") articles.push(...r.value);
  }
  return articles;
}

/**
 * Fetch from all RSS + API sources, deduplicate, sort by date.
 * This is the core aggregation function — cached for 90s at the aggregate level.
 */
async function fetchAllSources(
  sourceKeys?: string[],
  includeApi = true,
): Promise<NewsArticle[]> {
  const keys = sourceKeys || Object.keys(RSS_SOURCES);
  const cacheKey = `news:all:${keys.length}:${includeApi}`;

  return cache.wrap(cacheKey, 300, async () => {
    const [rss, api] = await Promise.all([
      fetchWithConcurrency(keys),
      includeApi ? fetchAllApiSources() : Promise.resolve([]),
    ]);

    const all = [...rss, ...api];

    // Deduplicate by normalized title (first 50 chars)
    const seen = new Set<string>();
    const deduped = all.filter((a) => {
      const norm = a.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 50);
      if (seen.has(norm)) return false;
      seen.add(norm);
      return true;
    });

    // Exclude future-dated articles
    const now = Date.now();
    return deduped
      .filter((a) => new Date(a.publishedAt).getTime() <= now + 60_000)
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  });
}

// ═══════════════════════════════════════════════════════════════
// Trending Score Algorithm (upstream port)
// ═══════════════════════════════════════════════════════════════

function calculateTrendingScore(article: NewsArticle): number {
  const ageInHours = (Date.now() - new Date(article.publishedAt).getTime()) / 3_600_000;

  // Recency: exponential decay, capped at 80
  const recency = Math.min(80, Math.max(0, 100 * Math.exp(-ageInHours / 3)));

  // Reputation from source name
  const reputation =
    SOURCE_REPUTATION_SCORES[article.sourceName] ??
    SOURCE_REPUTATION_SCORES.default;

  // Keyword relevance
  const text = `${article.title} ${article.description}`.toLowerCase();
  const matches = CRYPTO_KEYWORDS.filter((kw) => text.includes(kw)).length;
  const relevance = Math.min(100, matches * 15);

  // Fintech penalty
  const isFintech = ["finextra", "pymnts", "fintech"].some((t) =>
    article.sourceName.toLowerCase().includes(t),
  );
  const hasCrypto = matches >= 2;
  const penalty = isFintech ? (hasCrypto ? 0.6 : 0.25) : 1.0;

  // 55% reputation + 25% recency + 20% relevance
  return (reputation * 0.55 + recency * 0.25 + relevance * 0.2) * penalty;
}

// ═══════════════════════════════════════════════════════════════
// PUBLIC API — drop-in replacements for sources/crypto-news.ts
// ═══════════════════════════════════════════════════════════════

/**
 * Fetch latest news (paginated).
 */
export async function getNews(options: {
  limit?: number;
  source?: string;
  category?: string;
  page?: number;
} = {}): Promise<NewsResponse> {
  const { limit = 50, source, category, page = 1 } = options;
  const perPage = Math.min(Math.max(1, limit), 100);

  let sourceKeys: string[] | undefined;
  let includeApi = true;

  if (source && source in RSS_SOURCES) {
    sourceKeys = [source];
    includeApi = false;
  } else if (category) {
    sourceKeys = Object.keys(RSS_SOURCES).filter(
      (k) => RSS_SOURCES[k].category === category,
    );
    if (sourceKeys.length === 0) {
      // Also try keyword-based category matching across all sources
      sourceKeys = undefined; // fetch all, then filter
    }
  }

  let articles = await fetchAllSources(sourceKeys, includeApi);

  // Apply keyword-based category filter if category specified
  if (category) {
    const keywords = CATEGORY_KEYWORDS[category.toLowerCase()] || [category.toLowerCase()];
    articles = articles.filter((a) => {
      if (a.category === category.toLowerCase()) return true;
      const text = `${a.title} ${a.description}`.toLowerCase();
      return keywords.some((kw) => text.includes(kw));
    });
  }

  const offset = (page - 1) * perPage;
  const paginated = articles.slice(offset, offset + perPage);

  return {
    articles: paginated,
    totalCount: articles.length,
    sources: [...new Set(paginated.map((a) => a.sourceName))],
    timestamp: new Date().toISOString(),
    ...(page > 1 && {
      pagination: {
        page,
        perPage,
        totalPages: Math.ceil(articles.length / perPage),
        hasMore: offset + perPage < articles.length,
      },
    }),
  };
}

/**
 * Search articles by keyword(s).
 */
export async function searchNews(
  query: string,
  limit = 20,
): Promise<NewsResponse> {
  const terms = query.toLowerCase().split(",").map((t) => t.trim()).filter(Boolean);
  if (terms.length === 0) {
    return { articles: [], totalCount: 0, sources: [], timestamp: new Date().toISOString() };
  }

  const all = await fetchAllSources();
  const matched = all.filter((a) => {
    const text = `${a.title} ${a.description}`.toLowerCase();
    return terms.some((t) => text.includes(t));
  });

  const limited = matched.slice(0, Math.min(limit, 100));
  return {
    articles: limited,
    totalCount: matched.length,
    sources: [...new Set(limited.map((a) => a.sourceName))],
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get breaking news (last 2 hours).
 */
export async function getBreakingNews(limit = 10): Promise<NewsResponse> {
  const all = await fetchAllSources();
  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;

  const breaking = all.filter(
    (a) => new Date(a.publishedAt).getTime() > twoHoursAgo,
  );
  const limited = breaking.slice(0, Math.min(limit, 50));

  return {
    articles: limited,
    totalCount: breaking.length,
    sources: [...new Set(limited.map((a) => a.sourceName))],
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get trending news (last 24h, scored by reputation + recency + relevance).
 */
export async function getTrending(limit = 10) {
  const all = await fetchAllSources();
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

  const recent = all.filter(
    (a) => new Date(a.publishedAt).getTime() > oneDayAgo,
  );

  const scored = recent
    .map((a) => ({ article: a, score: calculateTrendingScore(a) }))
    .sort((a, b) => b.score - a.score);

  // Source diversity: max 2 per source, max 1 fintech total
  const fintechSources = ["finextra", "pymnts", "fintech futures"];
  const trending: NewsArticle[] = [];
  const counts = new Map<string, number>();
  let fintechCount = 0;

  for (const item of scored) {
    if (trending.length >= limit) break;
    const count = counts.get(item.article.sourceName) || 0;
    const isFintech = fintechSources.some((s) =>
      item.article.sourceName.toLowerCase().includes(s),
    );
    const max = isFintech ? 1 : 2;
    if (count < max && !(isFintech && fintechCount >= 1)) {
      trending.push(item.article);
      counts.set(item.article.sourceName, count + 1);
      if (isFintech) fintechCount++;
    }
  }

  return {
    topics: trending.map((a) => ({
      topic: a.title,
      source: a.sourceName,
      score: calculateTrendingScore(a),
      article: a,
    })),
    articles: trending,
    totalCount: scored.length,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get news by category with keyword fallback.
 */
export async function getNewsByCategory(
  category: string,
  limit = 30,
): Promise<NewsResponse> {
  return getNews({ limit, category });
}

/**
 * Optimized homepage loader — fetches all sources once, derives
 * latest, breaking, and trending from the same dataset.
 */
export async function getHomepageNews(options?: {
  latestLimit?: number;
  breakingLimit?: number;
  trendingLimit?: number;
}) {
  const latestLimit = Math.min(options?.latestLimit ?? 50, 50);
  const breakingLimit = Math.min(options?.breakingLimit ?? 5, 20);
  const trendingLimit = Math.min(options?.trendingLimit ?? 10, 50);

  const all = await fetchAllSources();

  // Latest
  const latest = all.slice(0, latestLimit);

  // Breaking (last 2h)
  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
  const breaking = all
    .filter((a) => new Date(a.publishedAt).getTime() > twoHoursAgo)
    .slice(0, breakingLimit);

  // Trending (last 24h, scored)
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const recent = all.filter((a) => new Date(a.publishedAt).getTime() > oneDayAgo);
  const scored = recent
    .map((a) => ({ article: a, score: calculateTrendingScore(a) }))
    .sort((a, b) => b.score - a.score);

  const fintechSources = ["finextra", "pymnts", "fintech futures"];
  const trendingArticles: NewsArticle[] = [];
  const counts = new Map<string, number>();
  let fintechCount = 0;

  for (const item of scored) {
    if (trendingArticles.length >= trendingLimit) break;
    const count = counts.get(item.article.sourceName) || 0;
    const isFintech = fintechSources.some((s) => item.article.sourceName.toLowerCase().includes(s));
    if (count < (isFintech ? 1 : 2) && !(isFintech && fintechCount >= 1)) {
      trendingArticles.push(item.article);
      counts.set(item.article.sourceName, count + 1);
      if (isFintech) fintechCount++;
    }
  }

  const now = new Date().toISOString();
  return {
    latest:   { articles: latest,           totalCount: all.length,              sources: [...new Set(latest.map((a) => a.sourceName))],           timestamp: now },
    breaking: { articles: breaking,         totalCount: breaking.length,         sources: [...new Set(breaking.map((a) => a.sourceName))],         timestamp: now },
    trending: { articles: trendingArticles, totalCount: trendingArticles.length, sources: [...new Set(trendingArticles.map((a) => a.sourceName))], timestamp: now },
  };
}

/**
 * List available sources.
 */
export function getSources() {
  const sources: SourceInfo[] = Object.entries(RSS_SOURCES)
    .filter(([, s]) => !s.disabled)
    .map(([id, s]) => ({
      id,
      name: s.name,
      url: s.url,
      category: s.category,
    }));

  return {
    sources,
    count: sources.length,
  };
}

/**
 * Get all available categories with source counts.
 */
export function getCategories() {
  const sourceCounts: Record<string, number> = {};
  for (const s of Object.values(RSS_SOURCES)) {
    if (!s.disabled) {
      sourceCounts[s.category] = (sourceCounts[s.category] || 0) + 1;
    }
  }

  const categories = Object.entries(CATEGORY_META)
    .map(([id, meta]) => ({
      id,
      name: meta.name,
      description: meta.description,
      sourceCount: sourceCounts[id] || 0,
    }))
    .filter((c) => c.sourceCount > 0)
    .sort((a, b) => b.sourceCount - a.sourceCount);

  return { categories };
}
