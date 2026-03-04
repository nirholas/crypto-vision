/**
 * Market Data Skills — Price Feeds, OHLCV, Technical Indicators
 *
 * Real-time and historical market data from CoinGecko,
 * on-chain Chainlink price feeds, and computed indicators.
 */

import type { Skill, SkillHandler } from '../types.js';
import type { DataPart, TaskSendParams } from '../../protocols/a2a/types.js';

function extractParams(params: TaskSendParams): Record<string, unknown> {
  for (const part of params.message?.parts ?? []) {
    if (part.type === 'data') return (part as DataPart).data;
    if (part.type === 'text') {
      try { return JSON.parse(part.text) as Record<string, unknown>; } catch { /* continue */ }
    }
  }
  return {};
}

// ─── Market Overview Skill ─────────────────────────────────────────

const marketOverviewHandler: SkillHandler = async (_params, context) => {
  context.logger.info('Fetching market overview');

  try {
    const response = await fetch('https://api.coingecko.com/api/v3/global');
    if (!response.ok) throw new Error(`CoinGecko API error: ${response.status}`);

    const result = await response.json() as { data: Record<string, unknown> };
    const data = result.data;

    const marketCapChange = data.market_cap_change_percentage_24h_usd;
    const totalMarketCap = (data.total_market_cap as Record<string, number>)?.usd;
    const totalVolume = (data.total_volume as Record<string, number>)?.usd;
    const btcDominance = (data.market_cap_percentage as Record<string, number>)?.btc;
    const ethDominance = (data.market_cap_percentage as Record<string, number>)?.eth;
    const bnbDominance = (data.market_cap_percentage as Record<string, number>)?.bnb;

    return {
      status: 'completed',
      result: {
        totalMarketCap: totalMarketCap,
        totalMarketCapFormatted: totalMarketCap ? `$${(totalMarketCap / 1e12).toFixed(2)}T` : 'N/A',
        totalVolume24h: totalVolume,
        totalVolume24hFormatted: totalVolume ? `$${(totalVolume / 1e9).toFixed(2)}B` : 'N/A',
        marketCapChange24h: Number(marketCapChange).toFixed(2),
        dominance: {
          btc: Number(btcDominance).toFixed(2),
          eth: Number(ethDominance).toFixed(2),
          bnb: Number(bnbDominance).toFixed(2),
        },
        activeCryptos: data.active_cryptocurrencies,
        markets: data.markets,
        timestamp: new Date().toISOString(),
      },
      message: `Market: $${totalMarketCap ? (totalMarketCap / 1e12).toFixed(2) : '?'}T (${Number(marketCapChange).toFixed(2)}% 24h) | BTC ${Number(btcDominance).toFixed(1)}%`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: 'failed', message: `Market overview failed: ${message}` };
  }
};

// ─── OHLCV (Candlestick) Data Skill ────────────────────────────────

const ohlcvHandler: SkillHandler = async (params, context) => {
  const data = extractParams(params);
  const { token, days = 7, quote = 'usd' } = data;

  if (!token) {
    return { status: 'failed', message: 'Missing required parameter: token' };
  }

  context.logger.info('Fetching OHLCV data', { token: String(token), days: Number(days) });

  try {
    const tokenId = resolveCoingeckoId(String(token));
    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/${tokenId}/ohlc?vs_currency=${String(quote)}&days=${Number(days)}`
    );

    if (!response.ok) throw new Error(`CoinGecko API error: ${response.status}`);

    const candles = await response.json() as number[][];

    // Each candle: [timestamp, open, high, low, close]
    const formatted = candles.map((c: number[]) => ({
      timestamp: new Date(c[0]).toISOString(),
      open: c[1],
      high: c[2],
      low: c[3],
      close: c[4],
    }));

    // Compute simple stats
    const closes = formatted.map((c) => c.close);
    const high = Math.max(...formatted.map((c) => c.high));
    const low = Math.min(...formatted.map((c) => c.low));
    const latest = closes[closes.length - 1];
    const first = closes[0];
    const changePercent = ((latest - first) / first) * 100;

    return {
      status: 'completed',
      result: {
        token: String(token),
        tokenId,
        quote: String(quote),
        days: Number(days),
        candles: formatted,
        candleCount: formatted.length,
        stats: {
          periodHigh: high,
          periodLow: low,
          latestClose: latest,
          changePercent: changePercent.toFixed(2),
        },
        timestamp: new Date().toISOString(),
      },
      message: `${token} ${days}d OHLCV: $${latest.toFixed(2)} (${changePercent.toFixed(2)}%), H: $${high.toFixed(2)}, L: $${low.toFixed(2)}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: 'failed', message: `OHLCV fetch failed: ${message}` };
  }
};

// ─── Chainlink Price Feed Skill ────────────────────────────────────

const chainlinkPriceHandler: SkillHandler = async (params, context) => {
  const data = extractParams(params);
  const { pair } = data;

  if (!pair) {
    return { status: 'failed', message: 'Missing required parameter: pair (e.g., BNB/USD)' };
  }

  context.logger.info('Fetching Chainlink price', { pair: String(pair) });

  try {
    const { ethers } = await import('ethers');
    const rpcUrls: Record<string, string> = {
      'bsc': 'https://bsc-dataseed1.binance.org',
      'bsc-testnet': 'https://data-seed-prebsc-1-s1.binance.org:8545',
    };

    const provider = new ethers.JsonRpcProvider(rpcUrls[context.chain] ?? rpcUrls['bsc']);

    const feedAddress = getChainlinkFeed(String(pair), context.chainId);
    if (!feedAddress) {
      return { status: 'failed', message: `No Chainlink feed found for pair: ${pair}` };
    }

    const aggregatorAbi = [
      'function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)',
      'function decimals() view returns (uint8)',
      'function description() view returns (string)',
    ];

    const feed = new ethers.Contract(feedAddress, aggregatorAbi, provider);
    const [, answer, , updatedAt] = await feed.latestRoundData() as [bigint, bigint, bigint, bigint, bigint];
    const feedDecimals = Number(await feed.decimals());
    const description = await feed.description() as string;

    const price = Number(answer) / Math.pow(10, feedDecimals);

    return {
      status: 'completed',
      result: {
        pair: String(pair),
        description,
        price,
        decimals: feedDecimals,
        feedAddress,
        updatedAt: new Date(Number(updatedAt) * 1000).toISOString(),
        source: 'Chainlink',
        chain: context.chain,
        timestamp: new Date().toISOString(),
      },
      message: `${description}: $${price.toFixed(feedDecimals > 4 ? 4 : 2)} (Chainlink on-chain)`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: 'failed', message: `Chainlink price failed: ${message}` };
  }
};

// ─── Fear & Greed Index Skill ──────────────────────────────────────

const fearGreedHandler: SkillHandler = async (_params, context) => {
  context.logger.info('Fetching Fear & Greed Index');

  try {
    const response = await fetch('https://api.alternative.me/fng/?limit=10');
    if (!response.ok) throw new Error(`Fear & Greed API error: ${response.status}`);

    const result = await response.json() as { data: Array<{ value: string; value_classification: string; timestamp: string }> };
    const data = result.data;

    const current = data[0];
    const history = data.map((d) => ({
      value: Number(d.value),
      classification: d.value_classification,
      date: new Date(Number(d.timestamp) * 1000).toISOString(),
    }));

    return {
      status: 'completed',
      result: {
        currentValue: Number(current.value),
        classification: current.value_classification,
        history,
        interpretation: Number(current.value) <= 25 ? 'Extreme Fear — potential buying opportunity'
          : Number(current.value) <= 45 ? 'Fear — market is cautious'
          : Number(current.value) <= 55 ? 'Neutral — market is balanced'
          : Number(current.value) <= 75 ? 'Greed — market is optimistic'
          : 'Extreme Greed — potential selling opportunity',
        timestamp: new Date().toISOString(),
      },
      message: `Fear & Greed Index: ${current.value} (${current.value_classification})`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: 'failed', message: `Fear & Greed fetch failed: ${message}` };
  }
};

// ─── Helpers ───────────────────────────────────────────────────────

function resolveCoingeckoId(token: string): string {
  const map: Record<string, string> = {
    'BNB': 'binancecoin', 'BTC': 'bitcoin', 'ETH': 'ethereum',
    'USDT': 'tether', 'USDC': 'usd-coin', 'CAKE': 'pancakeswap-token',
    'SOL': 'solana', 'ADA': 'cardano', 'DOT': 'polkadot',
    'AVAX': 'avalanche-2', 'LINK': 'chainlink', 'UNI': 'uniswap',
    'XRP': 'ripple', 'DOGE': 'dogecoin', 'SPA': 'sperax',
  };
  return map[token.toUpperCase()] ?? token.toLowerCase();
}

function getChainlinkFeed(pair: string, chainId: number): string | null {
  const feeds: Record<string, Record<number, string>> = {
    'BNB/USD': { 56: '0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE', 97: '0x2514895c72f50D8bd4B4F9b1110F0D6bD2c97526' },
    'BTC/USD': { 56: '0x264990fbd0A4796A3E3d8E37C4d5F87a3aCa5Ebf' },
    'ETH/USD': { 56: '0x9ef1B8c0E4F7dc8bF5719Ea496883DC6401d5b2e' },
    'CAKE/USD': { 56: '0xB6064eD41d4f67e353768aA239cA86f4F73665a1' },
    'USDT/USD': { 56: '0xB97Ad0E74fa7d920791E90258A6E2085088b4320' },
    'LINK/USD': { 56: '0xca236E327F629f9Fc2c30A4E95775EbF0B89fAC8' },
    'DOT/USD': { 56: '0xC333eb0086309a16aa6c18137b0c2153A9C23A3C' },
    'UNI/USD': { 56: '0xb57f259E7C24e56a1dA00F66b55A5640d9f9E7e4' },
  };
  return feeds[pair.toUpperCase()]?.[chainId] ?? null;
}

// ─── Skill Definitions ─────────────────────────────────────────────

export const marketOverviewSkill: Skill = {
  definition: {
    id: 'market-data/overview',
    name: 'Market Overview',
    description: 'Get global crypto market overview: total market cap, 24h volume, BTC/ETH/BNB dominance, and market direction.',
    category: 'market-data',
    version: '1.0.0',
    tags: ['market', 'overview', 'global', 'market-cap', 'dominance'],
    inputModes: ['application/json', 'text/plain'],
    outputModes: ['application/json'],
  },
  handler: marketOverviewHandler,
};

export const ohlcvSkill: Skill = {
  definition: {
    id: 'market-data/ohlcv',
    name: 'OHLCV Candlestick Data',
    description: 'Get historical OHLCV (candlestick) data for a token. Returns open, high, low, close prices over a configurable period.',
    category: 'market-data',
    version: '1.0.0',
    tags: ['ohlcv', 'candlestick', 'chart', 'historical', 'price'],
    inputModes: ['application/json'],
    outputModes: ['application/json'],
    parameters: {
      token: { type: 'string', description: 'Token symbol or CoinGecko ID', required: true },
      days: { type: 'number', description: 'Days of history', default: 7 },
      quote: { type: 'string', description: 'Quote currency', default: 'usd' },
    },
  },
  handler: ohlcvHandler,
};

export const chainlinkPriceSkill: Skill = {
  definition: {
    id: 'market-data/chainlink-price',
    name: 'Chainlink Price Feed',
    description: 'Get on-chain price data from Chainlink oracle feeds on BSC. Tamper-proof, decentralized pricing.',
    category: 'market-data',
    version: '1.0.0',
    tags: ['chainlink', 'oracle', 'price-feed', 'on-chain'],
    inputModes: ['application/json'],
    outputModes: ['application/json'],
    chains: ['bsc', 'bsc-testnet'],
    parameters: {
      pair: { type: 'string', description: 'Price pair (e.g., BNB/USD, BTC/USD)', required: true },
    },
    examples: [
      { name: 'BNB/USD price', input: { pair: 'BNB/USD' } },
      { name: 'BTC/USD price', input: { pair: 'BTC/USD' } },
    ],
  },
  handler: chainlinkPriceHandler,
};

export const fearGreedSkill: Skill = {
  definition: {
    id: 'market-data/fear-greed',
    name: 'Fear & Greed Index',
    description: 'Get the current Crypto Fear & Greed Index with history and sentiment interpretation.',
    category: 'market-data',
    version: '1.0.0',
    tags: ['sentiment', 'fear-greed', 'index', 'mood'],
    inputModes: ['application/json', 'text/plain'],
    outputModes: ['application/json'],
  },
  handler: fearGreedHandler,
};

/** All market data skills */
export const marketDataSkills: Skill[] = [
  marketOverviewSkill,
  ohlcvSkill,
  chainlinkPriceSkill,
  fearGreedSkill,
];
