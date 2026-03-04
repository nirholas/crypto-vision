/**
 * React Hooks for Extended Data Sources
 *
 * Custom hooks for consuming data from CryptoCompare, Messari,
 * Coinglass, Etherscan, and aggregated multi-source data.
 *
 * @module hooks/data-sources
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import useSWR from 'swr';

// ═══════════════════════════════════════════════════════════════
// SWR FETCHER
// ═══════════════════════════════════════════════════════════════

const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    const error = new Error('An error occurred while fetching the data.');
    throw error;
  }
  const json = await response.json();
  return json.data ?? json;
};

// ═══════════════════════════════════════════════════════════════
// CRYPTOCOMPARE HOOKS
// ═══════════════════════════════════════════════════════════════

/**
 * Get CryptoCompare price data
 */
export function useCryptoComparePrice(symbols: string[] = ['BTC', 'ETH']) {
  const symbolStr = symbols.join(',');
  const { data, error, isLoading, mutate } = useSWR(
    `/api/market/cryptocompare?action=pricefull&symbols=${symbolStr}`,
    fetcher,
    { refreshInterval: 30000 }
  );

  return {
    prices: data?.RAW || null,
    display: data?.DISPLAY || null,
    isLoading,
    error,
    refresh: mutate,
  };
}

/**
 * Get CryptoCompare top coins by volume
 */
export function useCryptoCompareTopVolume(limit: number = 50) {
  const { data, error, isLoading, mutate } = useSWR(
    `/api/market/cryptocompare?action=topvolume&limit=${limit}`,
    fetcher,
    { refreshInterval: 60000 }
  );

  return {
    coins: data || [],
    isLoading,
    error,
    refresh: mutate,
  };
}

/**
 * Get CryptoCompare top gainers and losers
 */
export function useCryptoCompareGainers(limit: number = 10) {
  const { data, error, isLoading, mutate } = useSWR(
    `/api/market/cryptocompare?action=gainers&limit=${limit}`,
    fetcher,
    { refreshInterval: 60000 }
  );

  return {
    gainers: data?.gainers || [],
    losers: data?.losers || [],
    isLoading,
    error,
    refresh: mutate,
  };
}

/**
 * Get CryptoCompare historical OHLCV
 */
export function useCryptoCompareHistory(
  symbol: string = 'BTC',
  days: number = 30
) {
  const { data, error, isLoading, mutate } = useSWR(
    `/api/market/cryptocompare?action=history&symbol=${symbol}&days=${days}`,
    fetcher,
    { refreshInterval: 300000 }
  );

  return {
    history: data || [],
    isLoading,
    error,
    refresh: mutate,
  };
}

/**
 * Get CryptoCompare news
 */
export function useCryptoCompareNews() {
  const { data, error, isLoading, mutate } = useSWR(
    '/api/market/cryptocompare?action=news',
    fetcher,
    { refreshInterval: 300000 }
  );

  return {
    news: data || [],
    isLoading,
    error,
    refresh: mutate,
  };
}

/**
 * Get CryptoCompare blockchain data
 */
export function useCryptoCompareBlockchain(symbol: string = 'BTC') {
  const { data, error, isLoading, mutate } = useSWR(
    `/api/market/cryptocompare?action=blockchain&symbol=${symbol}`,
    fetcher,
    { refreshInterval: 60000 }
  );

  return {
    blockchain: data || null,
    isLoading,
    error,
    refresh: mutate,
  };
}

// ═══════════════════════════════════════════════════════════════
// MESSARI HOOKS
// ═══════════════════════════════════════════════════════════════

/**
 * Get Messari global metrics
 */
export function useMessariGlobal() {
  const { data, error, isLoading, mutate } = useSWR(
    '/api/market/messari?action=global',
    fetcher,
    { refreshInterval: 300000 }
  );

  return {
    global: data?.data || null,
    isLoading,
    error,
    refresh: mutate,
  };
}

/**
 * Get Messari asset metrics
 */
export function useMessariAsset(asset: string = 'bitcoin') {
  const { data, error, isLoading, mutate } = useSWR(
    `/api/market/messari?action=metrics&asset=${asset}`,
    fetcher,
    { refreshInterval: 60000 }
  );

  return {
    metrics: data?.data || null,
    isLoading,
    error,
    refresh: mutate,
  };
}

/**
 * Get Messari asset profile (fundamentals)
 */
export function useMessariProfile(asset: string = 'bitcoin') {
  const { data, error, isLoading, mutate } = useSWR(
    `/api/market/messari?action=profile&asset=${asset}`,
    fetcher,
    { refreshInterval: 3600000 } // 1 hour - static data
  );

  return {
    profile: data?.data || null,
    isLoading,
    error,
    refresh: mutate,
  };
}

/**
 * Get Messari comprehensive data (metrics + profile + markets + news)
 */
export function useMessariComprehensive(asset: string = 'bitcoin') {
  const { data, error, isLoading, mutate } = useSWR(
    `/api/market/messari?action=comprehensive&asset=${asset}`,
    fetcher,
    { refreshInterval: 300000 }
  );

  return {
    asset: data?.asset || null,
    metrics: data?.metrics || null,
    profile: data?.profile || null,
    markets: data?.markets || [],
    news: data?.news || [],
    isLoading,
    error,
    refresh: mutate,
  };
}

/**
 * Get Messari news feed
 */
export function useMessariNews(page: number = 1, limit: number = 20) {
  const { data, error, isLoading, mutate } = useSWR(
    `/api/market/messari?action=news&page=${page}&limit=${limit}`,
    fetcher,
    { refreshInterval: 300000 }
  );

  return {
    news: data?.data || [],
    isLoading,
    error,
    refresh: mutate,
  };
}

/**
 * Get Messari sectors
 */
export function useMessariSectors() {
  const { data, error, isLoading, mutate } = useSWR(
    '/api/market/messari?action=sectors',
    fetcher,
    { refreshInterval: 3600000 }
  );

  return {
    sectors: data?.data || [],
    isLoading,
    error,
    refresh: mutate,
  };
}

// ═══════════════════════════════════════════════════════════════
// COINGLASS HOOKS
// ═══════════════════════════════════════════════════════════════

/**
 * Get Coinglass derivatives overview
 */
export function useCoinglassOverview() {
  const { data, error, isLoading, mutate } = useSWR(
    '/api/market/coinglass?action=overview',
    fetcher,
    { refreshInterval: 60000 }
  );

  return {
    overview: data || null,
    isLoading,
    error,
    refresh: mutate,
  };
}

/**
 * Get Coinglass open interest
 */
export function useCoinglassOpenInterest() {
  const { data, error, isLoading, mutate } = useSWR(
    '/api/market/coinglass?action=openinterest-aggregated',
    fetcher,
    { refreshInterval: 60000 }
  );

  return {
    openInterest: data || [],
    isLoading,
    error,
    refresh: mutate,
  };
}

/**
 * Get Coinglass funding rates
 */
export function useCoinglassFunding() {
  const { data, error, isLoading, mutate } = useSWR(
    '/api/market/coinglass?action=funding-average',
    fetcher,
    { refreshInterval: 60000 }
  );

  return {
    fundingRates: data || [],
    isLoading,
    error,
    refresh: mutate,
  };
}

/**
 * Get Coinglass liquidations summary
 */
export function useCoinglassLiquidations() {
  const { data, error, isLoading, mutate } = useSWR(
    '/api/market/coinglass?action=liquidations-summary',
    fetcher,
    { refreshInterval: 30000 }
  );

  return {
    summary: data || null,
    isLoading,
    error,
    refresh: mutate,
  };
}

/**
 * Get Coinglass long/short ratio
 */
export function useCoinglassLongShort() {
  const { data, error, isLoading, mutate } = useSWR(
    '/api/market/coinglass?action=longshort',
    fetcher,
    { refreshInterval: 60000 }
  );

  return {
    longShort: data || [],
    isLoading,
    error,
    refresh: mutate,
  };
}

/**
 * Get Coinglass global long/short
 */
export function useCoinglassGlobalLongShort() {
  const { data, error, isLoading, mutate } = useSWR(
    '/api/market/coinglass?action=longshort-global',
    fetcher,
    { refreshInterval: 60000 }
  );

  return {
    globalLongShort: data?.list || [],
    isLoading,
    error,
    refresh: mutate,
  };
}

/**
 * Get Coinglass symbol derivatives data
 */
export function useCoinglassSymbol(symbol: string = 'BTC') {
  const { data, error, isLoading, mutate } = useSWR(
    `/api/market/coinglass?action=symbol-derivatives&symbol=${symbol}`,
    fetcher,
    { refreshInterval: 60000 }
  );

  return {
    openInterest: data?.openInterest || null,
    funding: data?.funding || null,
    liquidations: data?.liquidations || null,
    longShort: data?.longShort || null,
    options: data?.options || null,
    isLoading,
    error,
    refresh: mutate,
  };
}

/**
 * Get Coinglass exchanges info
 */
export function useCoinglassExchanges() {
  const { data, error, isLoading, mutate } = useSWR(
    '/api/market/coinglass?action=exchanges',
    fetcher,
    { refreshInterval: 300000 }
  );

  return {
    exchanges: data || [],
    isLoading,
    error,
    refresh: mutate,
  };
}

/**
 * Get Coinglass options data
 */
export function useCoinglassOptions() {
  const { data, error, isLoading, mutate } = useSWR(
    '/api/market/coinglass?action=options',
    fetcher,
    { refreshInterval: 60000 }
  );

  return {
    options: data || [],
    isLoading,
    error,
    refresh: mutate,
  };
}

// ═══════════════════════════════════════════════════════════════
// ETHERSCAN HOOKS
// ═══════════════════════════════════════════════════════════════

/**
 * Get Ethereum network stats
 */
export function useEtherscanStats() {
  const { data, error, isLoading, mutate } = useSWR(
    '/api/market/etherscan?action=stats',
    fetcher,
    { refreshInterval: 30000 }
  );

  return {
    price: data?.price || null,
    supply: data?.supply || null,
    gas: data?.gas || null,
    nodes: data?.nodes || null,
    isLoading,
    error,
    refresh: mutate,
  };
}

/**
 * Get gas prices across chains
 */
export function useMultiChainGas() {
  const { data, error, isLoading, mutate } = useSWR(
    '/api/market/etherscan?action=allgas',
    fetcher,
    { refreshInterval: 15000 }
  );

  return {
    gasPrices: data || [],
    isLoading,
    error,
    refresh: mutate,
  };
}

/**
 * Get gas comparison with costs
 */
export function useGasComparison() {
  const { data, error, isLoading, mutate } = useSWR(
    '/api/market/etherscan?action=gascompare',
    fetcher,
    { refreshInterval: 30000 }
  );

  return {
    comparison: data || [],
    isLoading,
    error,
    refresh: mutate,
  };
}

/**
 * Get Ethereum gas oracle
 */
export function useEthereumGas() {
  const { data, error, isLoading, mutate } = useSWR(
    '/api/market/etherscan?action=gas',
    fetcher,
    { refreshInterval: 15000 }
  );

  return {
    gas: data || null,
    isLoading,
    error,
    refresh: mutate,
  };
}

/**
 * Get ETH price
 */
export function useEthPrice() {
  const { data, error, isLoading, mutate } = useSWR(
    '/api/market/etherscan?action=price',
    fetcher,
    { refreshInterval: 30000 }
  );

  const ethUsd = data?.ethusd ? parseFloat(data.ethusd) : null;
  const ethBtc = data?.ethbtc ? parseFloat(data.ethbtc) : null;

  return {
    priceUsd: ethUsd,
    priceBtc: ethBtc,
    raw: data || null,
    isLoading,
    error,
    refresh: mutate,
  };
}

/**
 * Get ETH supply
 */
export function useEthSupply() {
  const { data, error, isLoading, mutate } = useSWR(
    '/api/market/etherscan?action=supply',
    fetcher,
    { refreshInterval: 300000 }
  );

  return {
    supply: data || null,
    isLoading,
    error,
    refresh: mutate,
  };
}

/**
 * Get wallet overview
 */
export function useWalletOverview(
  address: string | null,
  chain: string = 'ethereum'
) {
  const { data, error, isLoading, mutate } = useSWR(
    address
      ? `/api/market/etherscan?action=wallet&address=${address}&chain=${chain}`
      : null,
    fetcher,
    { refreshInterval: 60000 }
  );

  return {
    balance: data?.balance || null,
    balanceEth: data?.balanceEth || null,
    transactions: data?.transactions || [],
    tokenTransfers: data?.tokenTransfers || [],
    isLoading,
    error,
    refresh: mutate,
  };
}

// ═══════════════════════════════════════════════════════════════
// AGGREGATED DATA HOOKS
// ═══════════════════════════════════════════════════════════════

/**
 * Get aggregated market overview from all sources
 */
export function useAggregatedOverview() {
  const { data, error, isLoading, mutate } = useSWR(
    '/api/market/aggregated?type=overview',
    fetcher,
    { refreshInterval: 60000 }
  );

  return {
    global: data?.global || null,
    topAssets: data?.topAssets || [],
    ethereum: data?.ethereum || null,
    derivatives: data?.derivatives || null,
    sources: data?.sources || [],
    timestamp: data?.timestamp || null,
    isLoading,
    error,
    refresh: mutate,
  };
}

/**
 * Get aggregated prices from multiple sources
 */
export function useAggregatedPrices(symbols: string[] = ['BTC', 'ETH', 'SOL']) {
  const symbolStr = symbols.join(',');
  const { data, error, isLoading, mutate } = useSWR(
    `/api/market/aggregated?type=prices&symbols=${symbolStr}`,
    fetcher,
    { refreshInterval: 30000 }
  );

  // Calculate consensus price (average across sources)
  const prices = useMemo(() => {
    if (!data?.prices) return [];
    return data.prices.map(
      (p: { symbol: string; avgPrice: number; avgChange24h: number; prices: unknown[] }) => ({
        symbol: p.symbol,
        price: p.avgPrice,
        change24h: p.avgChange24h,
        sources: p.prices,
        sourceCount: p.prices.length,
      })
    );
  }, [data]);

  return {
    prices,
    sources: data?.sources || [],
    timestamp: data?.timestamp || null,
    isLoading,
    error,
    refresh: mutate,
  };
}

/**
 * Get aggregated derivatives data
 */
export function useAggregatedDerivatives() {
  const { data, error, isLoading, mutate } = useSWR(
    '/api/market/aggregated?type=derivatives',
    fetcher,
    { refreshInterval: 60000 }
  );

  return {
    openInterest: data?.openInterest || [],
    fundingRates: data?.fundingRates || [],
    liquidations: data?.liquidations || null,
    longShort: data?.longShort || null,
    binance: data?.binance || null,
    sources: data?.sources || [],
    timestamp: data?.timestamp || null,
    isLoading,
    error,
    refresh: mutate,
  };
}

/**
 * Get aggregated on-chain data
 */
export function useAggregatedOnchain() {
  const { data, error, isLoading, mutate } = useSWR(
    '/api/market/aggregated?type=onchain',
    fetcher,
    { refreshInterval: 60000 }
  );

  return {
    bitcoin: data?.bitcoin || null,
    ethereum: data?.ethereum || null,
    sources: data?.sources || [],
    timestamp: data?.timestamp || null,
    isLoading,
    error,
    refresh: mutate,
  };
}

/**
 * Get aggregated fundamental data
 */
export function useAggregatedFundamental(symbols: string[] = ['BTC', 'ETH']) {
  const symbolStr = symbols.join(',');
  const { data, error, isLoading, mutate } = useSWR(
    `/api/market/aggregated?type=fundamental&symbols=${symbolStr}`,
    fetcher,
    { refreshInterval: 300000 }
  );

  return {
    fundamentals: data?.fundamentals || [],
    sources: data?.sources || [],
    timestamp: data?.timestamp || null,
    isLoading,
    error,
    refresh: mutate,
  };
}

/**
 * Get full aggregated data (comprehensive)
 */
export function useAggregatedFull(symbols: string[] = ['BTC', 'ETH', 'SOL']) {
  const symbolStr = symbols.join(',');
  const { data, error, isLoading, mutate } = useSWR(
    `/api/market/aggregated?type=full&symbols=${symbolStr}`,
    fetcher,
    { refreshInterval: 120000 }
  );

  return {
    global: data?.global || null,
    prices: data?.prices || null,
    derivatives: data?.derivatives || null,
    onchain: data?.onchain || null,
    fundamental: data?.fundamental || null,
    sources: data?.sources || [],
    timestamp: data?.timestamp || null,
    isLoading,
    error,
    refresh: mutate,
  };
}

// ═══════════════════════════════════════════════════════════════
// UTILITY HOOKS
// ═══════════════════════════════════════════════════════════════

/**
 * Format large numbers with abbreviations
 */
export function useFormattedNumber(value: number | null | undefined) {
  return useMemo(() => {
    if (value == null) return '-';
    if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  }, [value]);
}

/**
 * Format percentage with color indication
 */
export function useFormattedPercentage(value: number | null | undefined) {
  return useMemo(() => {
    if (value == null) return { text: '-', color: 'text-text-muted', isPositive: false };
    const isPositive = value >= 0;
    return {
      text: `${isPositive ? '+' : ''}${value.toFixed(2)}%`,
      color: isPositive ? 'text-green-500' : 'text-red-500',
      isPositive,
    };
  }, [value]);
}

/**
 * Get data source status
 */
export function useDataSourceHealth() {
  const [status, setStatus] = useState<
    Record<string, { available: boolean; latency: number | null }>
  >({});

  useEffect(() => {
    const checkSources = async () => {
      const sources = [
        { name: 'cryptocompare', url: '/api/market/cryptocompare?action=price&symbols=BTC' },
        { name: 'messari', url: '/api/market/messari?action=global' },
        { name: 'coinglass', url: '/api/market/coinglass?action=overview' },
        { name: 'etherscan', url: '/api/market/etherscan?action=gas' },
      ];

      const results: Record<string, { available: boolean; latency: number | null }> = {};

      for (const source of sources) {
        const start = Date.now();
        try {
          const response = await fetch(source.url);
          results[source.name] = {
            available: response.ok,
            latency: Date.now() - start,
          };
        } catch {
          results[source.name] = { available: false, latency: null };
        }
      }

      setStatus(results);
    };

    checkSources();
    const interval = setInterval(checkSources, 60000);

    return () => clearInterval(interval);
  }, []);

  return status;
}
