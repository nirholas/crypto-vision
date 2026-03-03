/**
 * Messari API Integration
 * Fundamental data, metrics, and news
 *
 * Base URL: https://data.messari.io/api
 * Free tier: 20 requests/minute, no key required
 *
 * @module messari
 */

import { CACHE_TTL } from './external-apis';
import { cache } from './cache';

const BASE_URL = 'https://data.messari.io/api';

// =============================================================================
// Types
// =============================================================================

export interface MessariAsset {
  id: string;
  serial_id: number;
  symbol: string;
  name: string;
  slug: string;
  contract_addresses: Array<{
    platform: string;
    contract_address: string;
  }> | null;
  _internal_temp_agora_id: string | null;
}

export interface MessariAssetProfile {
  id: string;
  symbol: string;
  name: string;
  slug: string;
  profile: {
    general: {
      overview: {
        is_verified: boolean;
        tagline: string;
        category: string;
        sector: string;
        tags: string[] | null;
        project_details: string;
        official_links: Array<{
          name: string;
          link: string;
        }>;
      };
      background: {
        background_details: string;
        issuing_organizations: Array<{
          slug: string;
          name: string;
          logo: string;
          description: string;
        }>;
      };
      roadmap: Array<{
        title: string;
        date: string;
        type: string;
        details: string;
      }>;
      regulation: {
        regulatory_details: string;
        sfar_score: number | null;
        sfar_summary: string | null;
      };
    };
    contributors: {
      individuals: Array<{
        slug: string;
        first_name: string;
        last_name: string;
        title: string;
        description: string;
        avatar_url: string;
      }>;
      organizations: Array<{
        slug: string;
        name: string;
        logo: string;
        description: string;
      }>;
    };
    advisors: {
      individuals: Array<{
        slug: string;
        first_name: string;
        last_name: string;
        title: string;
        description: string;
        avatar_url: string;
      }>;
      organizations: Array<{
        slug: string;
        name: string;
        logo: string;
        description: string;
      }>;
    };
    investors: {
      individuals: Array<{
        slug: string;
        first_name: string;
        last_name: string;
        title: string;
        description: string;
        avatar_url: string;
      }>;
      organizations: Array<{
        slug: string;
        name: string;
        logo: string;
        description: string;
      }>;
    };
    ecosystem: {
      assets: Array<{
        id: string;
        name: string;
        symbol: string;
      }>;
      organizations: Array<{
        slug: string;
        name: string;
        logo: string;
        description: string;
      }>;
    };
    economics: {
      token: {
        token_name: string;
        token_type: string;
        token_address: string | null;
        block_explorers: Array<{
          name: string;
          link: string;
        }>;
        multichain: Array<{
          platform: string;
          address: string;
        }>;
        token_usage: string;
        token_usage_details: string;
      };
      launch: {
        initial_distribution: {
          initial_supply: number | null;
          initial_supply_repartition: Record<string, number> | null;
          token_distribution_date: string | null;
          genesis_block_date: string | null;
        };
        fundraising: {
          sales_rounds: Array<{
            title: string;
            start_date: string;
            end_date: string;
            native_tokens_allocated: number | null;
            asset_collected: string | null;
            amount_collected_in_asset: number | null;
            is_kyc_required: boolean | null;
            restricted_jurisdictions: string[] | null;
          }>;
          sales_documents: Array<{
            name: string;
            link: string;
          }>;
        };
      };
      consensus_and_emission: {
        supply: {
          supply_curve_details: string;
          general_emission_type: string;
          precise_emission_type: string;
          is_capped_supply: boolean;
          max_supply: number | null;
        };
        consensus: {
          consensus_details: string;
          general_consensus_mechanism: string;
          precise_consensus_mechanism: string;
          targeted_block_time: number | null;
          block_reward: number | null;
          mining_algorithm: string | null;
          next_halving_date: string | null;
          is_victim_of_51_percent_attack: boolean | null;
        };
      };
      native_treasury: {
        accounts: Array<{
          account_type: string;
          addresses: Array<{
            platform: string;
            address: string;
          }>;
        }>;
        treasury_usage_details: string;
      };
    };
    technology: {
      overview: {
        technology_details: string;
        client_repositories: Array<{
          name: string;
          link: string;
          license_type: string;
        }>;
      };
      security: {
        audits: Array<{
          title: string;
          date: string;
          auditor: string;
          link: string;
        }>;
        known_exploits_and_vulnerabilities: Array<{
          title: string;
          date: string;
          description: string;
          type: string;
        }>;
      };
    };
    governance: {
      governance_details: string;
      onchain_governance: {
        onchain_governance_type: string;
        onchain_governance_details: string;
        is_treasury_decentralized: boolean;
      };
      grants: Array<{
        funding_organizations: string[];
        grant_program_details: string;
      }>;
    };
  };
}

export interface MessariMetrics {
  id: string;
  serial_id: number;
  symbol: string;
  name: string;
  slug: string;
  contract_addresses: Array<{
    platform: string;
    contract_address: string;
  }> | null;
  _internal_temp_agora_id: string | null;
  market_data: {
    price_usd: number;
    price_btc: number;
    price_eth: number;
    volume_last_24_hours: number;
    real_volume_last_24_hours: number;
    volume_last_24_hours_overstatement_multiple: number;
    percent_change_usd_last_1_hour: number;
    percent_change_btc_last_1_hour: number;
    percent_change_eth_last_1_hour: number;
    percent_change_usd_last_24_hours: number;
    percent_change_btc_last_24_hours: number;
    percent_change_eth_last_24_hours: number;
    ohlcv_last_1_hour: {
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    };
    ohlcv_last_24_hour: {
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    };
    last_trade_at: string;
  };
  marketcap: {
    rank: number;
    marketcap_dominance_percent: number;
    current_marketcap_usd: number;
    y_2050_marketcap_usd: number | null;
    y_plus10_marketcap_usd: number | null;
    liquid_marketcap_usd: number;
    volume_turnover_last_24_hours_percent: number;
    realized_marketcap_usd: number | null;
    outstanding_marketcap_usd: number;
  };
  supply: {
    y_2050: number | null;
    y_plus10: number | null;
    liquid: number;
    circulating: number;
    stock_to_flow: number | null;
    y_2050_issued_percent: number | null;
    annual_inflation_percent: number;
    y_plus10_issued_percent: number | null;
  };
  blockchain_stats_24_hours: {
    count_of_active_addresses: number | null;
    transaction_volume: number | null;
    adjusted_transaction_volume: number | null;
    adjusted_nvt: number | null;
    median_tx_value: number | null;
    median_tx_fee: number | null;
    count_of_tx: number | null;
    count_of_payments: number | null;
    new_issuance: number | null;
    average_difficulty: number | null;
    kilobytes_added: number | null;
    count_of_blocks_added: number | null;
  };
  all_time_high: {
    price: number;
    at: string;
    days_since: number;
    percent_down: number;
    breakeven_multiple: number;
  };
  cycle_low: {
    price: number;
    at: string;
    percent_up: number;
    days_since: number;
  };
  token_sale_stats: {
    sale_proceeds_usd: number | null;
    sale_start_date: string | null;
    sale_end_date: string | null;
    roi_since_sale_usd_percent: number | null;
    roi_since_sale_btc_percent: number | null;
    roi_since_sale_eth_percent: number | null;
  };
  staking_stats: {
    staking_yield_percent: number | null;
    staking_type: string | null;
    staking_minimum: number | null;
    tokens_staked: number | null;
    tokens_staked_percent: number | null;
    real_staking_yield_percent: number | null;
  };
  mining_stats: {
    mining_algo: string | null;
    network_hash_rate: string | null;
    available_on_nicehash_percent: number | null;
    '1_hour_attack_cost': number | null;
    '24_hours_attack_cost': number | null;
    attack_appeal: number | null;
    hash_rate: number | null;
    hash_rate_30d_average: number | null;
    mining_revenue_per_hash_usd: number | null;
    mining_revenue_per_hash_native_units: number | null;
    mining_revenue_per_hash_per_second_usd: number | null;
    mining_revenue_per_hash_per_second_native_units: number | null;
    mining_revenue_from_fees_percent_last_24_hours: number | null;
    mining_revenue_native: number | null;
    mining_revenue_usd: number | null;
    average_difficulty: number | null;
  };
  developer_activity: {
    stars: number | null;
    watchers: number | null;
    commits_last_3_months: number | null;
    commits_last_1_year: number | null;
    lines_added_last_3_months: number | null;
    lines_added_last_1_year: number | null;
    lines_deleted_last_3_months: number | null;
    lines_deleted_last_1_year: number | null;
  };
  roi_data: {
    percent_change_last_1_week: number;
    percent_change_last_1_month: number;
    percent_change_last_3_months: number;
    percent_change_last_1_year: number;
    percent_change_btc_last_1_week: number;
    percent_change_btc_last_1_month: number;
    percent_change_btc_last_3_months: number;
    percent_change_btc_last_1_year: number;
    percent_change_eth_last_1_week: number;
    percent_change_eth_last_1_month: number;
    percent_change_eth_last_3_months: number;
    percent_change_eth_last_1_year: number;
    percent_change_month_to_date: number;
    percent_change_quarter_to_date: number;
    percent_change_year_to_date: number;
  };
  roi_by_year: Record<string, number | null>;
  risk_metrics: {
    sharpe_ratios: {
      last_30_days: number | null;
      last_90_days: number | null;
      last_1_year: number | null;
      last_3_years: number | null;
    };
    volatility_stats: {
      volatility_last_30_days: number | null;
      volatility_last_90_days: number | null;
      volatility_last_1_year: number | null;
      volatility_last_3_years: number | null;
    };
  };
  misc_data: {
    private_market_price_usd: number | null;
    vladimir_club_cost: number | null;
    btc_current_normalized_supply_price_usd: number | null;
    btc_y2050_normalized_supply_price_usd: number | null;
    asset_created_at: string | null;
    asset_age_days: number | null;
    categories: string[];
    sectors: string[];
    tags: string[] | null;
  };
  lend_rates: {
    [protocol: string]: {
      supply_rate: number | null;
      borrow_rate: number | null;
    };
  } | null;
  borrow_rates: {
    [protocol: string]: {
      supply_rate: number | null;
      borrow_rate: number | null;
    };
  } | null;
  loan_data: {
    originated_last_24_hours_usd: number | null;
    outstanding_debt_usd: number | null;
    repaid_last_24_hours_usd: number | null;
    collateralized_last_24_hours_usd: number | null;
    collateral_liquidated_last_24_hours_usd: number | null;
  } | null;
  reddit: {
    active_user_count: number | null;
    subscribers: number | null;
  };
  on_chain_data: {
    addresses_count: number | null;
    active_addresses: number | null;
    addresses_balance_greater_0_001_native_units_count: number | null;
    addresses_balance_greater_0_01_native_units_count: number | null;
    addresses_balance_greater_0_1_native_units_count: number | null;
    addresses_balance_greater_1_usd_count: number | null;
    addresses_balance_greater_1_native_units_count: number | null;
    addresses_balance_greater_10_usd_count: number | null;
    addresses_balance_greater_10_native_units_count: number | null;
    addresses_balance_greater_100_usd_count: number | null;
    addresses_balance_greater_100_native_units_count: number | null;
    addresses_balance_greater_1000_usd_count: number | null;
    addresses_balance_greater_1000_native_units_count: number | null;
    addresses_balance_greater_10000_usd_count: number | null;
    addresses_balance_greater_10000_native_units_count: number | null;
    addresses_balance_greater_100000_usd_count: number | null;
    addresses_balance_greater_100000_native_units_count: number | null;
    addresses_balance_greater_1000000_usd_count: number | null;
    addresses_balance_greater_1000000_native_units_count: number | null;
    transaction_volume: number | null;
    adjusted_transaction_volume: number | null;
    txn_count: number | null;
    transfer_count: number | null;
    txn_volume: number | null;
    issuance: number | null;
    total_fees_usd: number | null;
    average_fee_usd: number | null;
    median_fee_usd: number | null;
    hash_rate: number | null;
    average_difficulty: number | null;
    utxo_count: number | null;
    average_utxo_age: number | null;
    block_count: number | null;
    block_size_total: number | null;
    block_size_mean: number | null;
  };
  exchange_flows: {
    flow_in_exchange_native_units: number | null;
    flow_in_exchange_usd: number | null;
    flow_in_exchange_native_units_inclusive: number | null;
    flow_in_exchange_usd_inclusive: number | null;
    flow_out_exchange_native_units: number | null;
    flow_out_exchange_usd: number | null;
    flow_out_exchange_native_units_inclusive: number | null;
    flow_out_exchange_usd_inclusive: number | null;
    supply_exchange_native_units: number | null;
    supply_exchange_usd: number | null;
  } | null;
  miner_flows: {
    supply_miner_1_hop_native_units: number | null;
    supply_miner_1_hop_usd: number | null;
  } | null;
  supply_activity: {
    supply_active_1d: number | null;
    supply_active_1d_usd: number | null;
    supply_active_1m: number | null;
    supply_active_1y: number | null;
    supply_active_ever: number | null;
    outstanding: number | null;
  } | null;
  supply_distribution: {
    supply_in_addresses_balance_greater_0_001_native_units: number | null;
    supply_in_addresses_balance_greater_0_01_native_units: number | null;
    supply_in_addresses_balance_greater_0_1_native_units: number | null;
    supply_in_addresses_balance_greater_1_native_units: number | null;
    supply_in_addresses_balance_greater_10_native_units: number | null;
    supply_in_addresses_balance_greater_100_native_units: number | null;
    supply_in_addresses_balance_greater_1000_native_units: number | null;
    supply_in_addresses_balance_greater_10000_native_units: number | null;
    supply_in_addresses_balance_greater_100000_native_units: number | null;
    supply_in_addresses_balance_greater_1000000_native_units: number | null;
    supply_in_contracts_native_units: number | null;
    supply_in_contracts_usd: number | null;
    supply_in_top_100_addresses: number | null;
    supply_in_top_10_percent_addresses: number | null;
    supply_in_top_1_percent_addresses: number | null;
    supply_shielded: number | null;
  } | null;
  alert_messages: string[] | null;
}

export interface MessariNews {
  id: string;
  title: string;
  content: string;
  references: Array<{
    name: string;
    url: string;
  }>;
  reference_title: string;
  published_at: string;
  author: {
    name: string;
    url: string | null;
  };
  tags: string[];
  url: string;
  previewImage: string | null;
}

export interface MessariTimeseries {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// =============================================================================
// Helper Functions
// =============================================================================

function getApiKey(): string {
  return process.env.MESSARI_API_KEY || '';
}

async function fetchWithAuth<T>(url: string): Promise<T> {
  const apiKey = getApiKey();
  const headers: HeadersInit = {
    Accept: 'application/json',
  };

  if (apiKey) {
    headers['x-messari-api-key'] = apiKey;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`Messari API error: ${response.status}`);
  }

  return response.json();
}

// =============================================================================
// Asset API Functions
// =============================================================================

/**
 * Get list of all assets
 */
export async function getAssets(
  page: number = 1,
  limit: number = 20,
  fields?: string
): Promise<{ data: MessariAsset[] }> {
  const cacheKey = `messari:assets:${page}-${limit}-${fields || 'default'}`;
  const cached = cache.get<{ data: MessariAsset[] }>(cacheKey);
  if (cached) return cached;

  let url = `${BASE_URL}/v2/assets?page=${page}&limit=${limit}`;
  if (fields) {
    url += `&fields=${fields}`;
  }

  const data = await fetchWithAuth<{ data: MessariAsset[] }>(url);
  cache.set(cacheKey, data, CACHE_TTL.static);

  return data;
}

/**
 * Get asset by symbol or slug
 */
export async function getAsset(assetKey: string): Promise<{ data: MessariAsset }> {
  const cacheKey = `messari:asset:${assetKey}`;
  const cached = cache.get<{ data: MessariAsset }>(cacheKey);
  if (cached) return cached;

  const url = `${BASE_URL}/v1/assets/${assetKey}`;
  const data = await fetchWithAuth<{ data: MessariAsset }>(url);

  cache.set(cacheKey, data, CACHE_TTL.static);
  return data;
}

/**
 * Get asset profile (fundamentals)
 */
export async function getAssetProfile(assetKey: string): Promise<{ data: MessariAssetProfile }> {
  const cacheKey = `messari:profile:${assetKey}`;
  const cached = cache.get<{ data: MessariAssetProfile }>(cacheKey);
  if (cached) return cached;

  const url = `${BASE_URL}/v2/assets/${assetKey}/profile`;
  const data = await fetchWithAuth<{ data: MessariAssetProfile }>(url);

  cache.set(cacheKey, data, CACHE_TTL.static);
  return data;
}

/**
 * Get asset metrics
 */
export async function getAssetMetrics(assetKey: string): Promise<{ data: MessariMetrics }> {
  const cacheKey = `messari:metrics:${assetKey}`;
  const cached = cache.get<{ data: MessariMetrics }>(cacheKey);
  if (cached) return cached;

  const url = `${BASE_URL}/v1/assets/${assetKey}/metrics`;
  const data = await fetchWithAuth<{ data: MessariMetrics }>(url);

  cache.set(cacheKey, data, CACHE_TTL.prices);
  return data;
}

/**
 * Get asset market data
 */
export async function getAssetMarketData(
  assetKey: string
): Promise<{ data: { market_data: MessariMetrics['market_data'] } }> {
  const cacheKey = `messari:marketdata:${assetKey}`;
  const cached = cache.get<{ data: { market_data: MessariMetrics['market_data'] } }>(cacheKey);
  if (cached) return cached;

  const url = `${BASE_URL}/v1/assets/${assetKey}/metrics/market-data`;
  const data = await fetchWithAuth<{ data: { market_data: MessariMetrics['market_data'] } }>(url);

  cache.set(cacheKey, data, CACHE_TTL.prices);
  return data;
}

// =============================================================================
// Timeseries API Functions
// =============================================================================

/**
 * Get price timeseries
 */
export async function getPriceTimeseries(
  assetKey: string,
  start?: string,
  end?: string,
  interval: '1d' | '1h' | '1w' = '1d'
): Promise<{ data: { values: Array<[string, number, number, number, number, number]> } }> {
  const cacheKey = `messari:timeseries:${assetKey}-${start}-${end}-${interval}`;
  const cached = cache.get<{
    data: { values: Array<[string, number, number, number, number, number]> };
  }>(cacheKey);
  if (cached) return cached;

  let url = `${BASE_URL}/v1/assets/${assetKey}/metrics/price/time-series?interval=${interval}`;
  if (start) url += `&start=${start}`;
  if (end) url += `&end=${end}`;

  const data = await fetchWithAuth<{
    data: { values: Array<[string, number, number, number, number, number]> };
  }>(url);

  const ttl =
    interval === '1d' ? CACHE_TTL.historical_30d : interval === '1h' ? CACHE_TTL.historical_1d : CACHE_TTL.historical_7d;
  cache.set(cacheKey, data, ttl);

  return data;
}

/**
 * Get normalized timeseries data
 */
export async function getNormalizedTimeseries(
  assetKey: string,
  days: number = 30
): Promise<MessariTimeseries[]> {
  const end = new Date().toISOString().split('T')[0];
  const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const interval = days <= 7 ? '1h' : '1d';

  const response = await getPriceTimeseries(assetKey, start, end, interval);

  return response.data.values.map(([timestamp, open, high, low, close, volume]) => ({
    timestamp,
    open,
    high,
    low,
    close,
    volume,
  }));
}

// =============================================================================
// News API Functions
// =============================================================================

/**
 * Get latest news
 */
export async function getNews(
  page: number = 1,
  limit: number = 20,
  assetKey?: string
): Promise<{ data: MessariNews[] }> {
  const cacheKey = `messari:news:${page}-${limit}-${assetKey || 'all'}`;
  const cached = cache.get<{ data: MessariNews[] }>(cacheKey);
  if (cached) return cached;

  let url = `${BASE_URL}/v1/news?page=${page}&limit=${limit}`;
  if (assetKey) {
    url += `&assetKey=${assetKey}`;
  }

  const data = await fetchWithAuth<{ data: MessariNews[] }>(url);
  cache.set(cacheKey, data, CACHE_TTL.news);

  return data;
}

/**
 * Get news for specific asset
 */
export async function getAssetNews(
  assetKey: string,
  page: number = 1,
  limit: number = 10
): Promise<{ data: MessariNews[] }> {
  return getNews(page, limit, assetKey);
}

// =============================================================================
// Markets API Functions
// =============================================================================

export interface MessariMarket {
  id: string;
  exchange_id: string;
  exchange_name: string;
  exchange_slug: string;
  base_asset_id: string;
  base_asset_symbol: string;
  quote_asset_id: string;
  quote_asset_symbol: string;
  pair: string;
  price_usd: number;
  vwap_weight: number;
  volume_last_24_hours: number;
  has_real_volume: boolean;
  deviation_from_vwap_percent: number;
  last_trade_at: string;
}

/**
 * Get markets for an asset
 */
export async function getAssetMarkets(assetKey: string): Promise<{ data: MessariMarket[] }> {
  const cacheKey = `messari:markets:${assetKey}`;
  const cached = cache.get<{ data: MessariMarket[] }>(cacheKey);
  if (cached) return cached;

  const url = `${BASE_URL}/v1/assets/${assetKey}/markets`;
  const data = await fetchWithAuth<{ data: MessariMarket[] }>(url);

  cache.set(cacheKey, data, CACHE_TTL.markets);
  return data;
}

// =============================================================================
// Global Metrics API Functions
// =============================================================================

export interface MessariGlobalMetrics {
  market_cap: {
    total_market_cap: number;
    total_market_cap_btc: number;
    total_market_cap_eth: number;
    total_volume_24h: number;
    total_volume_24h_btc: number;
    total_volume_24h_eth: number;
    real_volume_24h: number;
    volume_24h_overstatement_multiple: number;
    bitcoin_dominance_percent: number;
    ethereum_dominance_percent: number;
    top_10_dominance_percent: number;
    top_50_dominance_percent: number;
    top_100_dominance_percent: number;
    market_cap_change_percent_24h: number;
    volume_24h_change_percent: number;
  };
  btc_vs_eth: {
    btc_price_usd: number;
    btc_price_eth: number;
    btc_market_cap_usd: number;
    btc_market_cap_eth: number;
    btc_volume_24h_usd: number;
    btc_volume_24h_eth: number;
    eth_price_usd: number;
    eth_price_btc: number;
    eth_market_cap_usd: number;
    eth_market_cap_btc: number;
    eth_volume_24h_usd: number;
    eth_volume_24h_btc: number;
  };
  defi: {
    defi_market_cap_usd: number;
    defi_volume_24h_usd: number;
    defi_dominance_percent: number;
    eth_locked_in_defi_usd: number;
    btc_locked_in_defi_usd: number;
    total_value_locked_usd: number;
  };
  sector_market_caps: Record<string, number>;
}

/**
 * Get global market metrics
 */
export async function getGlobalMetrics(): Promise<{ data: MessariGlobalMetrics }> {
  const cacheKey = 'messari:global';
  const cached = cache.get<{ data: MessariGlobalMetrics }>(cacheKey);
  if (cached) return cached;

  const url = `${BASE_URL}/v1/market/global-metrics`;
  const data = await fetchWithAuth<{ data: MessariGlobalMetrics }>(url);

  cache.set(cacheKey, data, CACHE_TTL.global);
  return data;
}

// =============================================================================
// Sector Metrics API Functions
// =============================================================================

export interface MessariSector {
  name: string;
  slug: string;
  market_cap: number;
  volume_24h: number;
  num_assets: number;
}

/**
 * Get sector metrics
 */
export async function getSectors(): Promise<{ data: MessariSector[] }> {
  const cacheKey = 'messari:sectors';
  const cached = cache.get<{ data: MessariSector[] }>(cacheKey);
  if (cached) return cached;

  // Messari doesn't have a direct sectors endpoint, so we aggregate from global metrics
  const global = await getGlobalMetrics();
  const sectors = Object.entries(global.data.sector_market_caps || {}).map(([name, marketCap]) => ({
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    market_cap: marketCap,
    volume_24h: 0, // Not available from global metrics
    num_assets: 0, // Not available from global metrics
  }));

  const result = { data: sectors };
  cache.set(cacheKey, result, CACHE_TTL.static);

  return result;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Search for assets
 */
export async function searchAssets(
  query: string
): Promise<{
  data: Array<{
    id: string;
    symbol: string;
    name: string;
    slug: string;
  }>;
}> {
  // Messari doesn't have a search endpoint, so we filter from all assets
  const allAssets = await getAssets(1, 500);
  const queryLower = query.toLowerCase();

  const filtered = allAssets.data.filter(
    (asset) =>
      asset.symbol.toLowerCase().includes(queryLower) ||
      asset.name.toLowerCase().includes(queryLower) ||
      asset.slug.toLowerCase().includes(queryLower)
  );

  return { data: filtered.slice(0, 20) };
}

/**
 * Get comprehensive asset data (metrics + profile)
 */
export async function getComprehensiveAssetData(assetKey: string): Promise<{
  asset: MessariAsset;
  metrics: MessariMetrics;
  profile: MessariAssetProfile | null;
  markets: MessariMarket[];
  news: MessariNews[];
}> {
  const [assetRes, metricsRes, profileRes, marketsRes, newsRes] = await Promise.allSettled([
    getAsset(assetKey),
    getAssetMetrics(assetKey),
    getAssetProfile(assetKey),
    getAssetMarkets(assetKey),
    getAssetNews(assetKey),
  ]);

  return {
    asset: assetRes.status === 'fulfilled' ? assetRes.value.data : ({} as MessariAsset),
    metrics: metricsRes.status === 'fulfilled' ? metricsRes.value.data : ({} as MessariMetrics),
    profile: profileRes.status === 'fulfilled' ? profileRes.value.data : null,
    markets: marketsRes.status === 'fulfilled' ? marketsRes.value.data : [],
    news: newsRes.status === 'fulfilled' ? newsRes.value.data : [],
  };
}
