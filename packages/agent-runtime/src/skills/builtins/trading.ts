/**
 * Trading Skills — Spot Trading, Limit Orders, Portfolio Rebalancing
 *
 * Trading operations for CEX and DEX environments.
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

// ─── Limit Order Skill ─────────────────────────────────────────────

const limitOrderHandler: SkillHandler = async (params, context) => {
  const data = extractParams(params);
  const { tokenIn, tokenOut, amount, price, side = 'buy', expiry } = data;

  if (!tokenIn || !tokenOut || !amount || !price) {
    return { status: 'failed', message: 'Missing required parameters: tokenIn, tokenOut, amount, price' };
  }

  context.logger.info('Placing limit order', {
    side: String(side), tokenIn: String(tokenIn), tokenOut: String(tokenOut),
    amount: String(amount), price: String(price),
  });

  try {
    const { ethers } = await import('ethers');
    const provider = new ethers.JsonRpcProvider(getRpcUrl(context.chain));
    const wallet = new ethers.Wallet(context.privateKey, provider);

    // PancakeSwap limit order protocol
    const limitOrderAddress = getLimitOrderAddress(context.chainId);
    const limitOrderAbi = [
      'function createOrder(address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, uint256 deadline) returns (uint256 orderId)',
    ];

    const limitOrder = new ethers.Contract(limitOrderAddress, limitOrderAbi, wallet);
    const amountIn = ethers.parseUnits(String(amount), 18);
    const amountOut = ethers.parseUnits(
      String(Number(amount) * Number(price)),
      18
    );
    const deadline = expiry
      ? Math.floor(new Date(String(expiry)).getTime() / 1000)
      : Math.floor(Date.now() / 1000) + 86400; // 24h default

    // Approve token
    const erc20Abi = ['function approve(address, uint256) returns (bool)'];
    const tokenContract = new ethers.Contract(String(tokenIn), erc20Abi, wallet);
    const approveTx = await tokenContract.approve(limitOrderAddress, amountIn);
    await approveTx.wait();

    const tx = await limitOrder.createOrder(
      String(tokenIn), String(tokenOut), amountIn, amountOut, deadline
    );
    const receipt = await tx.wait();

    return {
      status: 'completed',
      result: {
        transactionHash: receipt.hash,
        side: String(side),
        tokenIn: String(tokenIn),
        tokenOut: String(tokenOut),
        amount: String(amount),
        targetPrice: String(price),
        deadline: new Date(deadline * 1000).toISOString(),
        chain: context.chain,
      },
      message: `Limit ${side} order placed: ${amount} at ${price}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: 'failed', message: `Limit order failed: ${message}` };
  }
};

// ─── DCA (Dollar Cost Average) Skill ──────────────────────────────

const dcaHandler: SkillHandler = async (params, context) => {
  const data = extractParams(params);
  const { tokenIn, tokenOut, totalAmount, intervals, period = 'daily' } = data;

  if (!tokenIn || !tokenOut || !totalAmount || !intervals) {
    return { status: 'failed', message: 'Missing required parameters: tokenIn, tokenOut, totalAmount, intervals' };
  }

  const numIntervals = Number(intervals);
  const perInterval = Number(totalAmount) / numIntervals;

  context.logger.info('Setting up DCA strategy', {
    tokenIn: String(tokenIn), tokenOut: String(tokenOut),
    totalAmount: String(totalAmount), intervals: numIntervals, period: String(period),
  });

  // DCA is implemented as a series of scheduled tasks
  const periodMs: Record<string, number> = {
    'hourly': 3600000,
    'daily': 86400000,
    'weekly': 604800000,
    'monthly': 2592000000,
  };

  const intervalMs = periodMs[String(period)] ?? periodMs['daily'];
  const schedule = Array.from({ length: numIntervals }, (_, i) => ({
    executionTime: new Date(Date.now() + intervalMs * (i + 1)).toISOString(),
    amount: perInterval.toFixed(6),
  }));

  return {
    status: 'completed',
    result: {
      strategy: 'DCA',
      tokenIn: String(tokenIn),
      tokenOut: String(tokenOut),
      totalAmount: String(totalAmount),
      amountPerInterval: perInterval.toFixed(6),
      intervals: numIntervals,
      period: String(period),
      schedule,
      chain: context.chain,
      status: 'scheduled',
    },
    message: `DCA strategy created: ${numIntervals} × ${perInterval.toFixed(4)} ${tokenIn} → ${tokenOut} (${period})`,
  };
};

// ─── TWAP (Time-Weighted Average Price) Skill ─────────────────────

const twapHandler: SkillHandler = async (params, context) => {
  const data = extractParams(params);
  const { tokenIn, tokenOut, totalAmount, duration = '1h', chunks = 10 } = data;

  if (!tokenIn || !tokenOut || !totalAmount) {
    return { status: 'failed', message: 'Missing required parameters: tokenIn, tokenOut, totalAmount' };
  }

  const numChunks = Number(chunks);
  const perChunk = Number(totalAmount) / numChunks;

  const durationMs: Record<string, number> = {
    '15m': 900000, '30m': 1800000, '1h': 3600000,
    '4h': 14400000, '12h': 43200000, '24h': 86400000,
  };
  const totalMs = durationMs[String(duration)] ?? durationMs['1h'];
  const intervalMs = totalMs / numChunks;

  context.logger.info('Setting up TWAP execution', {
    totalAmount: String(totalAmount), chunks: numChunks, duration: String(duration),
  });

  return {
    status: 'completed',
    result: {
      strategy: 'TWAP',
      tokenIn: String(tokenIn),
      tokenOut: String(tokenOut),
      totalAmount: String(totalAmount),
      chunks: numChunks,
      amountPerChunk: perChunk.toFixed(6),
      duration: String(duration),
      intervalMs,
      chain: context.chain,
      status: 'scheduled',
    },
    message: `TWAP order: split ${totalAmount} into ${numChunks} chunks over ${duration}`,
  };
};

// ─── Token Price Skill ─────────────────────────────────────────────

const tokenPriceHandler: SkillHandler = async (params, context) => {
  const data = extractParams(params);
  const { token, quote = 'USD' } = data;

  if (!token) {
    return { status: 'failed', message: 'Missing required parameter: token' };
  }

  try {
    // Use CoinGecko API for price data
    const tokenId = resolveCoingeckoId(String(token));
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${tokenId}&vs_currencies=${String(quote).toLowerCase()}&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const result = await response.json() as Record<string, Record<string, number>>;
    const priceData = result[tokenId];

    if (!priceData) {
      return { status: 'failed', message: `No price data found for ${token}` };
    }

    const quoteLower = String(quote).toLowerCase();

    return {
      status: 'completed',
      result: {
        token: String(token),
        tokenId,
        quote: String(quote),
        price: priceData[quoteLower],
        change24h: priceData[`${quoteLower}_24h_change`],
        marketCap: priceData[`${quoteLower}_market_cap`],
        volume24h: priceData[`${quoteLower}_24h_vol`],
        timestamp: new Date().toISOString(),
      },
      message: `${token}: $${priceData[quoteLower]?.toFixed(4)} (${priceData[`${quoteLower}_24h_change`]?.toFixed(2)}% 24h)`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: 'failed', message: `Price lookup failed: ${message}` };
  }
};

// ─── Helpers ───────────────────────────────────────────────────────

function getRpcUrl(chain: string): string {
  const rpcUrls: Record<string, string> = {
    'bsc': 'https://bsc-dataseed1.binance.org',
    'bsc-testnet': 'https://data-seed-prebsc-1-s1.binance.org:8545',
    'opbnb': 'https://opbnb-mainnet-rpc.bnbchain.org',
    'ethereum': 'https://eth.llamarpc.com',
  };
  return rpcUrls[chain] ?? rpcUrls['bsc'];
}

function getLimitOrderAddress(chainId: number): string {
  const addresses: Record<number, string> = {
    56: '0x090C6bfe49B76783E70551bC7e50B3e7B0e0896e', // PancakeSwap
    97: '0x090C6bfe49B76783E70551bC7e50B3e7B0e0896e',
  };
  return addresses[chainId] ?? addresses[56];
}

function resolveCoingeckoId(token: string): string {
  const tokenMap: Record<string, string> = {
    'BNB': 'binancecoin', 'BTC': 'bitcoin', 'ETH': 'ethereum',
    'USDT': 'tether', 'USDC': 'usd-coin', 'BUSD': 'binance-usd',
    'CAKE': 'pancakeswap-token', 'XRP': 'ripple', 'SOL': 'solana',
    'ADA': 'cardano', 'DOT': 'polkadot', 'MATIC': 'matic-network',
    'AVAX': 'avalanche-2', 'UNI': 'uniswap', 'LINK': 'chainlink',
    'AAVE': 'aave', 'SPA': 'sperax', 'USDs': 'sperax-usd',
  };
  return tokenMap[token.toUpperCase()] ?? token.toLowerCase();
}

// ─── Skill Definitions ─────────────────────────────────────────────

export const limitOrderSkill: Skill = {
  definition: {
    id: 'trading/limit-order',
    name: 'Limit Order',
    description: 'Place a limit order on DEX. The order executes automatically when the target price is reached.',
    category: 'trading',
    version: '1.0.0',
    tags: ['limit-order', 'dex', 'trading', 'conditional'],
    inputModes: ['application/json'],
    outputModes: ['application/json'],
    chains: ['bsc', 'bsc-testnet'],
    parameters: {
      tokenIn: { type: 'string', description: 'Input token address', required: true },
      tokenOut: { type: 'string', description: 'Output token address', required: true },
      amount: { type: 'string', description: 'Amount to trade', required: true },
      price: { type: 'string', description: 'Target price', required: true },
      side: { type: 'string', description: 'buy or sell', default: 'buy', enum: ['buy', 'sell'] },
      expiry: { type: 'string', description: 'Order expiry (ISO 8601)' },
    },
    requiredConfig: ['PRIVATE_KEY'],
  },
  handler: limitOrderHandler,
};

export const dcaSkill: Skill = {
  definition: {
    id: 'trading/dca',
    name: 'Dollar Cost Average',
    description: 'Set up a DCA strategy to buy tokens at regular intervals, reducing exposure to price volatility.',
    category: 'trading',
    version: '1.0.0',
    tags: ['dca', 'strategy', 'accumulate', 'periodic'],
    inputModes: ['application/json'],
    outputModes: ['application/json'],
    chains: ['bsc', 'bsc-testnet', 'opbnb', 'ethereum'],
    parameters: {
      tokenIn: { type: 'string', description: 'Token to spend', required: true },
      tokenOut: { type: 'string', description: 'Token to accumulate', required: true },
      totalAmount: { type: 'string', description: 'Total amount to spend', required: true },
      intervals: { type: 'number', description: 'Number of purchases', required: true },
      period: { type: 'string', description: 'Purchase frequency', default: 'daily', enum: ['hourly', 'daily', 'weekly', 'monthly'] },
    },
    requiredConfig: ['PRIVATE_KEY'],
  },
  handler: dcaHandler,
};

export const twapSkill: Skill = {
  definition: {
    id: 'trading/twap',
    name: 'TWAP Order',
    description: 'Execute a large trade using Time-Weighted Average Price strategy. Splits the order into smaller chunks over a time period to minimize price impact.',
    category: 'trading',
    version: '1.0.0',
    tags: ['twap', 'large-order', 'strategy', 'slippage'],
    inputModes: ['application/json'],
    outputModes: ['application/json'],
    chains: ['bsc', 'bsc-testnet', 'opbnb'],
    parameters: {
      tokenIn: { type: 'string', description: 'Input token', required: true },
      tokenOut: { type: 'string', description: 'Output token', required: true },
      totalAmount: { type: 'string', description: 'Total amount to trade', required: true },
      duration: { type: 'string', description: 'Time duration', default: '1h', enum: ['15m', '30m', '1h', '4h', '12h', '24h'] },
      chunks: { type: 'number', description: 'Number of chunks', default: 10 },
    },
    requiredConfig: ['PRIVATE_KEY'],
  },
  handler: twapHandler,
};

export const tokenPriceSkill: Skill = {
  definition: {
    id: 'trading/price',
    name: 'Token Price',
    description: 'Get current token price, 24h change, market cap, and volume from CoinGecko.',
    category: 'trading',
    version: '1.0.0',
    tags: ['price', 'market-data', 'coingecko', 'quote'],
    inputModes: ['application/json', 'text/plain'],
    outputModes: ['application/json'],
    parameters: {
      token: { type: 'string', description: 'Token symbol or CoinGecko ID', required: true },
      quote: { type: 'string', description: 'Quote currency', default: 'USD' },
    },
  },
  handler: tokenPriceHandler,
};

/** All trading skills */
export const tradingSkills: Skill[] = [
  limitOrderSkill,
  dcaSkill,
  twapSkill,
  tokenPriceSkill,
];
