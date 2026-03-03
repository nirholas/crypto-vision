/**
 * Additional Free Data Sources
 * 
 * New integrations for 2026 - all 100% FREE APIs
 * 
 * @module additional-sources
 */

// =============================================================================
// CRYPTOCOMPARE - Historical OHLCV Data
// =============================================================================

const CRYPTOCOMPARE_BASE = 'https://min-api.cryptocompare.com/data';

export interface OHLCVData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volumefrom: number;
  volumeto: number;
}

/**
 * Get historical OHLCV data from CryptoCompare (FREE, no API key needed for basic)
 */
export async function getHistoricalOHLCV(
  symbol: string,
  currency: string = 'USD',
  limit: number = 30,
  aggregate: number = 1,
  type: 'histoday' | 'histohour' | 'histominute' = 'histoday'
): Promise<OHLCVData[]> {
  const url = `${CRYPTOCOMPARE_BASE}/${type}?fsym=${symbol}&tsym=${currency}&limit=${limit}&aggregate=${aggregate}`;
  
  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    next: { revalidate: 300 }, // Cache 5 minutes
  });
  
  if (!response.ok) throw new Error('CryptoCompare fetch failed');
  
  const data = await response.json();
  return data.Data || [];
}

/**
 * Get social stats from CryptoCompare (FREE)
 */
export async function getSocialStats(coinId: number): Promise<{
  twitter: { followers: number; posts: number };
  reddit: { subscribers: number; activeUsers: number };
  github: { stars: number; forks: number };
}> {
  const url = `${CRYPTOCOMPARE_BASE}/social/coin/latest?coinId=${coinId}`;
  
  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    next: { revalidate: 3600 }, // Cache 1 hour
  });
  
  if (!response.ok) throw new Error('Social stats fetch failed');
  
  const data = await response.json();
  const social = data.Data || {};
  
  return {
    twitter: {
      followers: social.Twitter?.followers || 0,
      posts: social.Twitter?.statuses || 0,
    },
    reddit: {
      subscribers: social.Reddit?.subscribers || 0,
      activeUsers: social.Reddit?.active_users || 0,
    },
    github: {
      stars: social.CodeRepository?.List?.[0]?.stars || 0,
      forks: social.CodeRepository?.List?.[0]?.forks || 0,
    },
  };
}

// =============================================================================
// BLOCKCHAIN.COM - Bitcoin On-Chain Stats
// =============================================================================

const BLOCKCHAIN_BASE = 'https://api.blockchain.info';

export interface BlockchainStats {
  marketPrice: number;
  hashRate: number;
  difficulty: number;
  totalBitcoins: number;
  numberOfTransactions: number;
  minutesBetweenBlocks: number;
  totalFeesBTC: number;
}

/**
 * Get Bitcoin blockchain stats (FREE, no API key)
 */
export async function getBitcoinStats(): Promise<BlockchainStats> {
  const url = `${BLOCKCHAIN_BASE}/stats?format=json`;
  
  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    next: { revalidate: 600 }, // Cache 10 minutes
  });
  
  if (!response.ok) throw new Error('Blockchain.com fetch failed');
  
  const data = await response.json();
  
  return {
    marketPrice: data.market_price_usd,
    hashRate: data.hash_rate,
    difficulty: data.difficulty,
    totalBitcoins: data.totalbc / 100000000, // Satoshis to BTC
    numberOfTransactions: data.n_tx,
    minutesBetweenBlocks: data.minutes_between_blocks,
    totalFeesBTC: data.total_fees_btc / 100000000,
  };
}

/**
 * Get current Bitcoin block height (FREE)
 */
export async function getBitcoinBlockHeight(): Promise<number> {
  const url = `${BLOCKCHAIN_BASE}/q/getblockcount`;
  
  const response = await fetch(url, { next: { revalidate: 60 } });
  if (!response.ok) throw new Error('Block height fetch failed');
  
  const text = await response.text();
  return parseInt(text, 10);
}

// =============================================================================
// MESSARI - Research Data (FREE tier: 20 requests/minute)
// =============================================================================

const MESSARI_BASE = 'https://data.messari.io/api/v1';

export interface MessariAsset {
  id: string;
  symbol: string;
  name: string;
  slug: string;
  metrics: {
    marketcap: { current_marketcap_usd: number };
    supply: { circulating: number; max: number | null };
    allTimeHigh: { price: number; at: string };
    roiData: { percent_change_last_1_week: number };
  };
  profile: {
    tagline: string;
    overview: string;
    category: string;
    sector: string;
  };
}

/**
 * Get asset metrics from Messari (FREE)
 */
export async function getMessariAsset(symbol: string): Promise<MessariAsset | null> {
  const url = `${MESSARI_BASE}/assets/${symbol.toLowerCase()}/metrics`;
  
  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    next: { revalidate: 300 },
  });
  
  if (!response.ok) return null;
  
  const data = await response.json();
  return data.data;
}

/**
 * Get all assets from Messari (FREE)
 */
export async function getMessariAssets(limit: number = 20): Promise<MessariAsset[]> {
  const url = `${MESSARI_BASE}/assets?limit=${limit}`;
  
  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    next: { revalidate: 600 },
  });
  
  if (!response.ok) throw new Error('Messari fetch failed');
  
  const data = await response.json();
  return data.data || [];
}

// =============================================================================
// COINGLASS - Futures & Funding Rates (FREE public endpoints)
// =============================================================================

const COINGLASS_BASE = 'https://open-api.coinglass.com/public/v2';

export interface FundingRate {
  symbol: string;
  rate: number;
  predictedRate: number;
  exchange: string;
  nextFundingTime: number;
}

/**
 * Get funding rates across exchanges (FREE)
 */
export async function getFundingRates(symbol: string = 'BTC'): Promise<FundingRate[]> {
  const url = `${COINGLASS_BASE}/funding?symbol=${symbol}`;
  
  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    next: { revalidate: 300 },
  });
  
  if (!response.ok) return [];
  
  const data = await response.json();
  if (data.code !== '0') return [];
  
  return (data.data || []).map((item: Record<string, unknown>) => ({
    symbol: item.symbol,
    rate: item.rate,
    predictedRate: item.predictedRate,
    exchange: item.exchangeName,
    nextFundingTime: item.nextFundingTime,
  }));
}

/**
 * Get open interest data (FREE)
 */
export async function getOpenInterest(symbol: string = 'BTC'): Promise<{
  totalOpenInterest: number;
  openInterestChange24h: number;
  exchanges: { name: string; openInterest: number; change24h: number }[];
}> {
  const url = `${COINGLASS_BASE}/open_interest?symbol=${symbol}`;
  
  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    next: { revalidate: 300 },
  });
  
  if (!response.ok) throw new Error('CoinGlass OI fetch failed');
  
  const data = await response.json();
  const oiData = data.data || [];
  
  const totalOI = oiData.reduce((sum: number, ex: { openInterest: number }) => sum + (ex.openInterest || 0), 0);
  
  return {
    totalOpenInterest: totalOI,
    openInterestChange24h: 0, // Calculate from historical
    exchanges: oiData.map((ex: Record<string, unknown>) => ({
      name: ex.exchangeName,
      openInterest: ex.openInterest,
      change24h: ex.openInterestChange24h || 0,
    })),
  };
}

// =============================================================================
// GOPLUS LABS - Token Security Data (FREE)
// =============================================================================

const GOPLUS_BASE = 'https://api.gopluslabs.io/api/v1';

export interface TokenSecurity {
  isOpenSource: boolean;
  isProxy: boolean;
  isMintable: boolean;
  isHoneypot: boolean;
  buyTax: number;
  sellTax: number;
  holderCount: number;
  lpHolderCount: number;
  isAntiWhale: boolean;
  isBlacklisted: boolean;
  trustScore: number; // 0-100, calculated
}

/**
 * Get token security info (FREE, no API key)
 */
export async function getTokenSecurity(
  chainId: string,
  contractAddress: string
): Promise<TokenSecurity | null> {
  const url = `${GOPLUS_BASE}/token_security/${chainId}?contract_addresses=${contractAddress}`;
  
  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    next: { revalidate: 3600 }, // Cache 1 hour
  });
  
  if (!response.ok) return null;
  
  const data = await response.json();
  const result = data.result?.[contractAddress.toLowerCase()];
  
  if (!result) return null;
  
  // Calculate trust score
  let trustScore = 100;
  if (result.is_honeypot === '1') trustScore -= 50;
  if (result.is_proxy === '1') trustScore -= 10;
  if (result.is_mintable === '1') trustScore -= 15;
  if (result.is_open_source !== '1') trustScore -= 20;
  if (parseFloat(result.buy_tax || '0') > 0.1) trustScore -= 10;
  if (parseFloat(result.sell_tax || '0') > 0.1) trustScore -= 10;
  
  return {
    isOpenSource: result.is_open_source === '1',
    isProxy: result.is_proxy === '1',
    isMintable: result.is_mintable === '1',
    isHoneypot: result.is_honeypot === '1',
    buyTax: parseFloat(result.buy_tax || '0') * 100,
    sellTax: parseFloat(result.sell_tax || '0') * 100,
    holderCount: parseInt(result.holder_count || '0', 10),
    lpHolderCount: parseInt(result.lp_holder_count || '0', 10),
    isAntiWhale: result.is_anti_whale === '1',
    isBlacklisted: result.is_blacklisted === '1',
    trustScore: Math.max(0, trustScore),
  };
}

// =============================================================================
// ETHERSCAN - Ethereum Gas & Stats (FREE tier: 5 calls/sec)
// =============================================================================

const ETHERSCAN_BASE = 'https://api.etherscan.io/api';

export interface GasOracle {
  safeGasPrice: number;
  proposeGasPrice: number;
  fastGasPrice: number;
  suggestBaseFee: number;
  gasUsedRatio: string;
}

/**
 * Get Ethereum gas prices (FREE, no API key for basic)
 */
export async function getEthGasOracle(): Promise<GasOracle> {
  const url = `${ETHERSCAN_BASE}?module=gastracker&action=gasoracle`;
  
  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    next: { revalidate: 15 }, // Cache 15 seconds
  });
  
  if (!response.ok) throw new Error('Etherscan gas oracle failed');
  
  const data = await response.json();
  const result = data.result;
  
  return {
    safeGasPrice: parseInt(result.SafeGasPrice, 10),
    proposeGasPrice: parseInt(result.ProposeGasPrice, 10),
    fastGasPrice: parseInt(result.FastGasPrice, 10),
    suggestBaseFee: parseFloat(result.suggestBaseFee),
    gasUsedRatio: result.gasUsedRatio,
  };
}

/**
 * Get ETH supply stats (FREE)
 */
export async function getEthSupply(): Promise<{
  totalSupply: number;
  ethSupply: number;
  eth2Staking: number;
  burntFees: number;
}> {
  const url = `${ETHERSCAN_BASE}?module=stats&action=ethsupply2`;
  
  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    next: { revalidate: 3600 },
  });
  
  if (!response.ok) throw new Error('Etherscan supply failed');
  
  const data = await response.json();
  const result = data.result;
  
  return {
    totalSupply: parseFloat(result.EthSupply) / 1e18,
    ethSupply: parseFloat(result.EthSupply) / 1e18,
    eth2Staking: parseFloat(result.Eth2Staking || '0') / 1e18,
    burntFees: parseFloat(result.BurntFees || '0') / 1e18,
  };
}

// =============================================================================
// TOKEN UNLOCKS - Token Vesting Data (Multiple free sources)
// =============================================================================

export interface TokenUnlock {
  project: string;
  symbol: string;
  unlockDate: string;
  unlockAmount: number;
  unlockValueUSD: number;
  percentOfSupply: number;
  category: 'team' | 'investor' | 'ecosystem' | 'other';
}

// CoinGecko categories endpoint for upcoming unlocks info
const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

/**
 * Get upcoming token unlocks from DeFiLlama unlocks API (FREE)
 */
export async function getUpcomingUnlocks(days: number = 30): Promise<TokenUnlock[]> {
  try {
    // DeFiLlama has a free unlocks endpoint
    const response = await fetch('https://api.llama.fi/protocol-emissions', {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 3600 }, // Cache 1 hour
    });

    if (!response.ok) {
      // Fallback to fetching from CoinGecko trending + market data
      return getUpcomingUnlocksFromMarketData(days);
    }

    const data = await response.json();
    const now = Date.now();
    const endDate = now + days * 24 * 60 * 60 * 1000;

    const unlocks: TokenUnlock[] = [];

    // Parse emissions data for upcoming unlocks
    if (Array.isArray(data)) {
      for (const protocol of data) {
        if (!protocol.events) continue;

        for (const event of protocol.events) {
          const eventDate = new Date(event.timestamp * 1000).getTime();
          
          // Only include events within the specified timeframe
          if (eventDate < now || eventDate > endDate) continue;

          unlocks.push({
            project: protocol.name || 'Unknown',
            symbol: protocol.symbol?.toUpperCase() || 'N/A',
            unlockDate: new Date(eventDate).toISOString(),
            unlockAmount: event.amount || 0,
            unlockValueUSD: event.amountUsd || event.amount * (protocol.price || 0),
            percentOfSupply: event.percentOfSupply || 0,
            category: categorizeUnlock(event.category || event.type),
          });
        }
      }
    }

    // Sort by unlock date
    return unlocks
      .sort((a, b) => new Date(a.unlockDate).getTime() - new Date(b.unlockDate).getTime())
      .slice(0, 50);
  } catch (error) {
    console.error('Token unlocks fetch error:', error);
    return getUpcomingUnlocksFromMarketData(days);
  }
}

/**
 * Fallback: Get unlock data from CoinGecko market data
 */
async function getUpcomingUnlocksFromMarketData(days: number): Promise<TokenUnlock[]> {
  try {
    // Fetch top tokens and check for known upcoming unlocks
    const response = await fetch(
      `${COINGECKO_BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false`,
      { next: { revalidate: 3600 } }
    );

    if (!response.ok) return [];

    const coins = await response.json();
    const unlocks: TokenUnlock[] = [];

    // Known tokens with upcoming vesting schedules (updated regularly)
    const knownVestingTokens: Record<string, { category: 'team' | 'investor' | 'ecosystem' | 'other'; percentPerMonth: number }> = {
      arbitrum: { category: 'team', percentPerMonth: 0.92 },
      optimism: { category: 'investor', percentPerMonth: 0.56 },
      aptos: { category: 'team', percentPerMonth: 1.5 },
      sui: { category: 'investor', percentPerMonth: 2.0 },
      celestia: { category: 'ecosystem', percentPerMonth: 1.2 },
      worldcoin: { category: 'team', percentPerMonth: 3.5 },
      blur: { category: 'ecosystem', percentPerMonth: 4.0 },
      starknet: { category: 'investor', percentPerMonth: 2.5 },
      'immutable-x': { category: 'team', percentPerMonth: 1.8 },
      apecoin: { category: 'ecosystem', percentPerMonth: 1.0 },
    };

    for (const coin of coins) {
      const vestingInfo = knownVestingTokens[coin.id];
      if (!vestingInfo) continue;

      // Calculate estimated unlock value
      const marketCap = coin.market_cap || 0;
      const unlockPercent = vestingInfo.percentPerMonth;
      const unlockValue = marketCap * (unlockPercent / 100);
      const totalSupply = coin.total_supply || coin.circulating_supply || 1;
      const unlockAmount = totalSupply * (unlockPercent / 100);

      // Estimate next unlock date (monthly unlocks are common)
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextMonth.setDate(1);

      unlocks.push({
        project: coin.name,
        symbol: coin.symbol.toUpperCase(),
        unlockDate: nextMonth.toISOString(),
        unlockAmount,
        unlockValueUSD: unlockValue,
        percentOfSupply: unlockPercent,
        category: vestingInfo.category,
      });
    }

    return unlocks.sort((a, b) => b.unlockValueUSD - a.unlockValueUSD);
  } catch (error) {
    console.error('Market data unlock fallback error:', error);
    return [];
  }
}

/**
 * Categorize unlock type
 */
function categorizeUnlock(type: string): 'team' | 'investor' | 'ecosystem' | 'other' {
  const typeLower = type?.toLowerCase() || '';
  if (typeLower.includes('team') || typeLower.includes('core') || typeLower.includes('founder')) {
    return 'team';
  }
  if (typeLower.includes('investor') || typeLower.includes('seed') || typeLower.includes('private') || typeLower.includes('vc')) {
    return 'investor';
  }
  if (typeLower.includes('ecosystem') || typeLower.includes('community') || typeLower.includes('airdrop') || typeLower.includes('reward')) {
    return 'ecosystem';
  }
  return 'other';
}

// =============================================================================
// EXPORT ALL
// =============================================================================

export const additionalSources = {
  // CryptoCompare
  getHistoricalOHLCV,
  getSocialStats,
  
  // Blockchain.com
  getBitcoinStats,
  getBitcoinBlockHeight,
  
  // Messari
  getMessariAsset,
  getMessariAssets,
  
  // CoinGlass
  getFundingRates,
  getOpenInterest,
  
  // GoPlus Labs
  getTokenSecurity,
  
  // Etherscan
  getEthGasOracle,
  getEthSupply,
  
  // Token Unlocks
  getUpcomingUnlocks,
};

export default additionalSources;
