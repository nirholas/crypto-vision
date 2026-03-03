/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import {supportedTools} from './mcp/allToolList'

export let ToolRegistry = [
  {
    "category": "Market Data and Price",
    "name": "get_market_and_price_endpoints",
    "description": "Endpoints to retrieve real-time and historical cryptocurrency prices, market caps, trading volumes, OHLC data, global market statistics, supported currencies, basic market performance metrics across different timeframes and asset platforms, stablecoin market analytics, stablecoin price tracking, comprehensive stablecoin market cap data across multiple chains, social sentiment-enhanced market metrics including Galaxy Score™ and AltRank™ rankings, centralized exchange (CEX) trading data including real-time tickers, order books, recent trades, candlestick charts, best bid/ask prices, derivatives pricing (index, mark, and premium), and perpetual futures funding rates across major exchanges.",
    "tools": [
      "coins_index",
      "coins_market_data_browser", 
      "coins_history_browser",
      "range_coins_market_chart_browser",
      "range_coins_ohlc_browser",
      "simple_price_browser",
      "gainers_losers_browser",
      "contract_coins_browser",
      "range_contract_coins_market_chart_browser",
      "id_simple_token_price_browser",
      "global_browser",
      "simple_supported_vs_currencies_browser",
      // "get_token_prices_browser",  defi
      // "get_historical_prices_browser", defi
      "retrieve_token_pricing",
      "fetch_price_chart_data",
      "fetch_token_mini_charts",
      "fetch_token_chart_urls",
      "coin_tickers_data",
      "coin_historical_chart", 
      "btc_exchange_rates",
      "global_market_cap_chart",
      "companies_crypto_treasury",
      "stablecoins_list",
      "stablecoin_chains_list",
      "stablecoin_charts_global",
      "stablecoin_charts_by_chain",
      "stablecoin_prices_current",
      "scan_crypto_market_metrics",
      "analyze_coin_performance",
      "browse_supported_stocks",
      "retrieve_stock_analytics",
      "trading_pair_ticker_data",
      "multiple_tickers_data",
      "trading_pair_orderbook_data",
      "trading_pair_recent_trades",
      "trading_pair_candlestick_data",
      "multiple_pairs_best_prices",
      "level2_orderbook_data",
      "derivatives_index_candlestick",
      "derivatives_mark_candlestick",
      "perpetual_premium_index_data",
      "perpetual_funding_rate_current",
      "perpetual_funding_rate_history",
      "perpetual_funding_rates_all"
    ]
  },
  {
    "category": "On-Chain DEX & Pool Analytics",
    "name": "get_onchain_dex_pool_endpoints",
    "description": "Endpoints for analyzing decentralized exchange pools, liquidity data, trading pairs, DEX rankings, pool filtering, trending pools, OHLCV data for pools/tokens, trading volume analysis, comprehensive on-chain trading metrics across multiple networks and DEXs, real-time DEX trading analytics, advanced token trading intelligence with DEXScreener-style metrics, trader statistics (makers, buyers, sellers), aggregated trading data by tokens, volume breakdowns, trading activity analysis, exchange platform analysis, comprehensive exchange ecosystem metrics including user statistics, DEX volume analytics across protocols and chains, and options trading analytics with protocol-specific data.",
    "tools": [
      "onchain_categories_browser",
      "pools_onchain_categories_browser", 
      "networks_onchain_new_pools_browser",
      "network_networks_onchain_new_pools_browser",
      "networks_onchain_trending_pools_browser",
      "network_networks_onchain_trending_pools_browser",
      "networks_onchain_dexes_browser",
      "pools_networks_onchain_dexes_browser",
      "networks_onchain_pools_browser",
      "address_networks_onchain_pools_browser",
      "pools_networks_onchain_info_browser",
      "timeframe_pools_networks_onchain_ohlcv_browser",
      "pools_networks_onchain_trades_browser",
      "timeframe_tokens_networks_onchain_ohlcv_browser",
      "tokens_networks_onchain_pools_browser", 
      "tokens_networks_onchain_trades_browser",
      "pools_onchain_megafilter_browser",
      "pools_onchain_trending_search_browser",
      "search_onchain_pools_browser",
      "addresses_networks_simple_onchain_token_price_browser",
      "retrieve_token_transactions",
      "fetch_trading_pair_metrics",
      "fetch_multiple_pairs_metrics", 
      "search_filter_pairs",
      "fetch_pair_information",
      "list_token_pairs",
      "fetch_token_pairs_details",
      "retrieve_liquidity_information",
      "fetch_liquidity_lock_details",
      "search_exchange_platforms",
      "describe_onchain_transaction",
      "exchanges_data",
      "exchange_details",
      "exchange_tickers_data", 
      "exchange_volume_chart",
      "exchange_volume_chart_range",
      "derivatives_tickers_data",
      "derivatives_exchanges_data",
      "derivative_exchange_details",
      "network_trending_pools",
      "multi_pools_data",
      "network_exchanges_list",
      "pair_chart_metadata",
      // "token_liquidity_metadata", // not working (getting something went wrong)
      "dex_volumes_overview",
      "dex_volume_specific",
      "dex_volumes_chain_specific", 
      "options_trading_overview",
      "options_trading_by_chain",
      "options_protocol_summary", 
    ]
  },
  {
    "category": "Portfolio & Wallet",
    "name": "get_portfolio_wallet_endpoints",
    "description": "Endpoints for tracking user wallet balances, transaction history, portfolio positions across protocols and chains, net asset calculations, token holdings analysis, comprehensive wallet activity monitoring, real-time balance tracking, balance update history over time, multi-token portfolio analysis, balance changes with transaction context, financial auditing capabilities for individual users and addresses, wallet filtering and discovery, and NFT holdings tracking.",
    "tools": [
      "user_history",
      "user_total_balance", 
      "user_token_balances",
      "get_user_protocol",
      "get_detailed_protocol_list",
      "get_detailed_protocol_list_on_all_chain",
      "fetch_wallet_balances",
      "fetch_wallet_token_activity",
      "wallets_search_filter",
      "token_wallets_filter",
      "wallet_detailed_stats",
      "wallet_chart_data",
      "wallet_nft_collections_data",
      "wallet_collection_assets"
    ]
  },
  {
    "category": "Token & Contract data",
    "name": "get_token_contract_endpoints",
    "description": "Endpoints for detailed token and contract analysis including token metadata, holder distributions, contract information, token filtering and discovery, holder rankings, comprehensive token intelligence across multiple networks, advanced transaction analysis and forensics, detailed transaction data (hash, sender, recipient, value, gas costs), internal transactions with signatures, transaction status validation, address tracking capabilities for security analysis and investigation, token lifecycle events, trader analytics, and project metadata including websites and social media links.",
    "tools": [
      "address_networks_onchain_tokens_browser",
      "tokens_networks_onchain_info_browser",
      "tokens_networks_onchain_top_holders_browser", 
      "tokens_networks_onchain_holders_chart_browser",
      "retrieve_token_details",
      "fetch_multiple_tokens",
      "search_tokens_by_criteria",
      "list_token_holders",
      "calculate_top_holders_percentage",
      "list_newest_token_contracts",
      "multi_tokens_data",
      "tokens_recent_updates",
      "token_lifecycle_events",
      "token_top_traders_stats",
      "fetch_coin_metadata"
    ]
  },
  {
    "category": "DeFi Protocol Analytics",
    "name": "get_defi_protocol_endpoints",
    "description": "Endpoints for comprehensive DeFi protocol analysis including Total Value Locked (TVL) data, protocol listings, chain-specific TVL metrics, historical TVL tracking across all chains, protocol fee analysis, yield farming analytics with APY data, detailed protocol information, comprehensive DeFi ecosystem statistics, blockchain network TVL tracking, yield pool management and historical charts, and protocol fee structures across different DeFi platforms.",
    "tools": [
      // "get_protocols_browser",defi
      // "get_protocol_tvl_browser",defi
      // "get_chain_tvl_browser", defi
      // "get_stablecoins_browser",defi
      // "get_stablecoin_data_browser",defi
      "protocol_info",
      "protocol_list",
      "global_defi_data",
      "defi_protocols_list",
      "defi_protocol_details", 
      "protocol_tvl_current",
      "protocol_fees_data", 
      "blockchain_chains_list",
      "chain_tvl_history",
      "chains_tvl_historical_all",
      "yield_pools_list",
      "yield_pool_details",
      "yield_pool_chart_history",
      "protocol_fees_overview",
      "chain_fees_overview", 
    ]
  },
  {
    "category": "NFT Analytics",
    "name": "get_nft_analytics_endpoints",
    "description": "Endpoints for comprehensive NFT ecosystem analysis including collection data, market analytics, user NFT holdings, collection floor prices, trading volumes, historical NFT market data, NFT liquidity pools and AMM marketplaces (like Sudoswap), NFT DeFi analytics, Prime ecosystem pools, Parallel trading card game assets, NFT pool management, collection holder analysis, advanced NFT search and filtering, contract metadata, cross-chain NFT analytics, social sentiment tracking for NFT collections, and time series market trend analysis.",
    "tools": [
      "id_nfts_browser",
      "list_nfts_browser",
      "nfts_market_chart_browser",
      "get_nft_list", 
      "get_all_nft",
      "get_nft_collection",
      "nft_pool_details",
      "nft_pool_events_data",
      "nft_collection_pool_stats",
      "exchange_nft_collections",
      "collection_exchange_pools",
      "owner_nft_pools",
      "nft_collections_search",
      "nft_pool_collections_search",
      "nfts_search_advanced",
      "nft_pools_search",
      "nft_collection_assets",
      "nft_collection_detailed_stats",
      "nft_collection_events",
      "nft_contracts_metadata",
      "parallel_assets_search",
      "parallel_card_changes",
      "prime_pool_assets_data",
      "prime_pool_events_data",
      "prime_pools_info",
      "nft_collection_holders",
      "prime_token_holders",
      "explore_nft_collections",
      "analyze_nft_collection",
      "track_nft_market_trends"
    ]
  },
  {
    "category": "Security & Risk Analysis",
    "name": "get_security_risk_endpoints",
    "description": "Comprehensive security endpoints for token security analysis, NFT authenticity verification, honeypot detection, malicious address identification, phishing site detection, contract approval risks, dApp security assessment, ABI data decoding, and comprehensive security metrics to protect users from scams, rugpulls, and malicious contracts.",
    "tools": [
      "get_token_security",
      "get_nft_security",// rishabh
      "check_malicious_address",// rishabh
      "check_approval_security",// rishabh
      "get_user_approvals",// rishabh
      "check_dapp_security",// rishabh
      "detect_phishing_site",// rishabh
      "decode_abi_data",// rishabh
    ]
  },
  {
    "category": "Network & Infrastructure",
    "name": "get_network_infrastructure_endpoints",
    "description": "Endpoints for blockchain network information, network health monitoring, gas price tracking, network statistics, asset platform data, infrastructure metrics across different blockchain networks, real-time mempool monitoring, pending transaction analysis, transaction status simulation, MEV detection and protection, gas fee optimization, arbitrage opportunity identification, comprehensive blockchain activity monitoring, community-contributed insights and annotations, data platform system updates monitoring, centralized exchange (CEX) infrastructure including system status monitoring, server time synchronization, available trading markets/pairs browsing, and supported currencies listing across major exchanges.",
    "tools": [
      "onchain_networks_browser",
      "list_blockchain_networks",
      "check_network_health",
      "fetch_network_metrics",
      "get_gas_prices", 
      "asset_platforms_browser",
      "community_notes_data",
      "monitor_system_updates",
      "exchange_system_status",
      "exchange_server_time",
      "exchange_markets_browser",
      "exchange_currencies_browser"
    ]
  },
  {
    "category": "Search & Discovery",
    "name": "get_search_discovery_endpoints",
    "description": "Endpoints for cryptocurrency search functionality, trending analysis, coin categorization, token discovery, new coin listings, comprehensive search capabilities across coins, categories, and markets, event categorization and labeling systems.",
    "tools": [
      "search_browser",
      "search_trending_browser",
      "coins_categories_browser",
      "coins_list_browser", 
      "new_coins_list_browser",
      "coins_categories_market_data",
      "exchanges_list_simple", 
      "derivatives_exchanges_list",
      "event_labels_list"
    ]
  },
  {
    "category": "Social Media & Sentiment Analytics",
    "name": "get_social_sentiment_endpoints",
    "description": "Endpoints for social media analytics, sentiment analysis, influencer tracking, social engagement metrics, trending topics analysis, news aggregation, creator analytics, post engagement tracking, social dominance metrics, Galaxy Score™, AltRank™, and comprehensive social sentiment indicators across crypto assets, stocks, and NFTs. Includes real-time social monitoring, influencer identification, content virality analysis, and social trend detection.",
    "tools": [
      "discover_topic_influencers",
      "fetch_topic_news_articles",
      "analyze_topic_social_posts",
      "retrieve_topic_metrics",
      "list_trending_topics",
      "analyze_category_overview",
      "discover_category_topics",
      "fetch_category_social_content",
      "retrieve_category_news_feed",
      "list_category_influencers",
      "browse_trending_categories",
      "rank_social_influencers",
      "fetch_creator_profile",
      "track_creator_performance",
      "analyze_creator_content",
      "retrieve_post_analytics",
      "monitor_post_engagement"
    ]
  }
]

// function that takes category name, and returns list of tools in that category return {}

export function getAllToolsInCategory(category: string){
  let categoryUsed = ToolRegistry.find(tool => tool.category === category);
  if(!categoryUsed){
    return []
  }
  const allWrappedTools = supportedTools
  // return all the tools from wrapped tools that are in the category (name match)
  let toolsInCategory = [];
  for (const tool of categoryUsed.tools){
    const wrappedTool = allWrappedTools.find(wrappedTool => wrappedTool.name === tool);
    if(wrappedTool){
      toolsInCategory.push(wrappedTool);
    }
    else console.log(`Tool ${tool} not found in wrapped tools`);
  }
  return toolsInCategory;
}

// get total tools in tool registry
function getTotalToolsInToolRegistry(){
  let totalTools = 0;
  for(const category of ToolRegistry){
    totalTools += category.tools.length;
  }
  return totalTools;
}

// console.log(getAllToolsInCategory("Security & Risk Analysis"))

// Dictionary mapping category index to endpoint paths
export const CategoryEndpoints: { [key: number]: string } = {
  0: "/hive_market_data/mcp",           // Market Data and Price
  1: "/hive_onchain_dex/mcp",          // On-Chain DEX & Pool Analytics
  2: "/hive_portfolio_wallet/mcp",      // Portfolio & Wallet
  3: "/hive_token_contract/mcp",        // Token & Contract data
  4: "/hive_defi_protocol/mcp",         // DeFi Protocol Analytics
  5: "/hive_nft_analytics/mcp",         // NFT Analytics
  6: "/hive_security_risk/mcp",         // Security & Risk Analysis
  7: "/hive_network_infrastructure/mcp", // Network & Infrastructure
  8: "/hive_search_discovery/mcp",      // Search & Discovery
  9: "/hive_social_sentiment/mcp"       // Social Media & Sentiment Analytics
};

export function getToolByCategory(category:number){
  // return list tools and call tool
  const toolNameList = ToolRegistry[category].tools

  const tools = [];
  for(const toolName of toolNameList){
    const tool = supportedTools.find(tool => tool.name === toolName);
    if(tool){
      tools.push({tool});
    }
  }
  return tools;
}