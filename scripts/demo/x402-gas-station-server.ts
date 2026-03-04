#!/usr/bin/env tsx
/**
 * x402 Gas Station Demo Server
 *
 * A lightweight HTTP server that simulates x402-gated premium API endpoints.
 * Each endpoint acts as a "pump" at the agent gas station — the agent pays
 * USDC via x402 to fuel up with data before completing its mission.
 *
 * This server returns real-shaped data (not mocked) — it generates realistic
 * market data, DeFi analytics, whale alerts, and AI sentiment analysis
 * so the demo looks authentic on camera.
 *
 * Usage:
 *   npx tsx scripts/demo/x402-gas-station-server.ts
 *
 * Then run the agent:
 *   npx tsx scripts/demo/x402-gas-station-agent.ts
 */

import * as http from 'node:http';
import * as crypto from 'node:crypto';

// ─── Configuration ────────────────────────────────────────────

const PORT = parseInt(process.env.DEMO_PORT ?? '4020', 10);
const PAYMENT_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD68';
const USDC_ASSET = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'; // Base Sepolia USDC
const NETWORK = 'eip155:84532'; // Base Sepolia

// ─── Endpoint Definitions (Gas Station Pumps) ─────────────────

interface GasStationPump {
  path: string;
  name: string;
  description: string;
  priceUsd: number;
  handler: () => unknown;
}

const PUMPS: GasStationPump[] = [
  {
    path: '/api/premium/market/coins',
    name: '⛽ Market Data Pump',
    description: 'Top cryptocurrency prices and market caps',
    priceUsd: 0.001,
    handler: () => generateMarketData(),
  },
  {
    path: '/api/premium/ai/analyze',
    name: '🧠 AI Analysis Pump',
    description: 'AI-powered market analysis and opportunity detection',
    priceUsd: 0.005,
    handler: () => generateAIAnalysis(),
  },
  {
    path: '/api/premium/defi/protocols',
    name: '🌾 DeFi Intelligence Pump',
    description: 'DeFi protocol TVL, yields, and risk scores',
    priceUsd: 0.003,
    handler: () => generateDeFiData(),
  },
  {
    path: '/api/premium/whales/transactions',
    name: '🐋 Whale Tracker Pump',
    description: 'Large wallet movements and whale alerts',
    priceUsd: 0.005,
    handler: () => generateWhaleAlerts(),
  },
  {
    path: '/api/premium/ai/sentiment',
    name: '📊 Sentiment Scanner Pump',
    description: 'Social media sentiment analysis across crypto',
    priceUsd: 0.002,
    handler: () => generateSentimentData(),
  },
];

// ─── Data Generators ──────────────────────────────────────────

function generateMarketData() {
  return {
    success: true,
    data: [
      {
        id: 'bitcoin',
        symbol: 'BTC',
        name: 'Bitcoin',
        current_price: 97842.31,
        market_cap: 1_932_451_000_000,
        market_cap_rank: 1,
        total_volume: 42_891_000_000,
        price_change_percentage_24h: 2.34,
        price_change_percentage_7d: 5.12,
        sparkline_7d: Array.from({ length: 168 }, (_, i) => 94000 + Math.sin(i / 10) * 2000 + i * 20),
      },
      {
        id: 'ethereum',
        symbol: 'ETH',
        name: 'Ethereum',
        current_price: 3891.47,
        market_cap: 468_291_000_000,
        market_cap_rank: 2,
        total_volume: 18_432_000_000,
        price_change_percentage_24h: 3.87,
        price_change_percentage_7d: 8.45,
        sparkline_7d: Array.from({ length: 168 }, (_, i) => 3600 + Math.sin(i / 8) * 150 + i * 1.5),
      },
      {
        id: 'solana',
        symbol: 'SOL',
        name: 'Solana',
        current_price: 187.92,
        market_cap: 89_421_000_000,
        market_cap_rank: 5,
        total_volume: 4_891_000_000,
        price_change_percentage_24h: 5.61,
        price_change_percentage_7d: 12.34,
        sparkline_7d: Array.from({ length: 168 }, (_, i) => 165 + Math.sin(i / 6) * 12 + i * 0.12),
      },
      {
        id: 'base',
        symbol: 'BASE',
        name: 'Base',
        current_price: 12.47,
        market_cap: 5_892_000_000,
        market_cap_rank: 28,
        total_volume: 892_000_000,
        price_change_percentage_24h: 8.92,
        price_change_percentage_7d: 18.45,
        sparkline_7d: Array.from({ length: 168 }, (_, i) => 10.5 + Math.sin(i / 5) * 1 + i * 0.01),
      },
      {
        id: 'sperax',
        symbol: 'SPA',
        name: 'Sperax',
        current_price: 0.0342,
        market_cap: 142_000_000,
        market_cap_rank: 312,
        total_volume: 12_400_000,
        price_change_percentage_24h: 4.21,
        price_change_percentage_7d: 9.87,
        sparkline_7d: Array.from({ length: 168 }, (_, i) => 0.031 + Math.sin(i / 7) * 0.002 + i * 0.00001),
      },
    ],
    meta: { page: 1, perPage: 5, total: 5, timestamp: new Date().toISOString() },
  };
}

function generateAIAnalysis() {
  return {
    success: true,
    data: {
      analysis: {
        summary: 'Bullish momentum detected across L2 ecosystem. Base chain showing strongest relative performance with 18.45% weekly gains. Whale accumulation patterns suggest continued upside in the next 48-72 hours.',
        opportunities: [
          {
            asset: 'ETH',
            action: 'ACCUMULATE',
            confidence: 0.87,
            reasoning: 'Strong DEX volume increase (+34% 24h), whale wallets accumulating, positive funding rates on perpetuals.',
            target_price: 4200,
            stop_loss: 3650,
            timeframe: '7-14 days',
          },
          {
            asset: 'SOL',
            action: 'HOLD',
            confidence: 0.78,
            reasoning: 'Ecosystem TVL growing rapidly, NFT market recovery, but RSI approaching overbought territory.',
            target_price: 210,
            stop_loss: 170,
            timeframe: '14-30 days',
          },
        ],
        risk_assessment: {
          market_risk: 'MODERATE',
          volatility_index: 42.3,
          fear_greed_index: 71,
          fear_greed_label: 'Greed',
          macro_outlook: 'Favorable — ETF inflows continue, rate cuts priced in.',
        },
      },
      model: 'gpt-4o-2025-03',
      tokens_used: 2847,
      timestamp: new Date().toISOString(),
    },
  };
}

function generateDeFiData() {
  return {
    success: true,
    data: {
      protocols: [
        {
          name: 'Aave V3',
          chain: 'Multi-chain',
          tvl: 28_940_000_000,
          tvl_change_24h: 2.1,
          apy_range: '2.1% - 8.7%',
          risk_score: 9.2,
          category: 'Lending',
          top_pools: [
            { asset: 'USDC', apy: 5.2, tvl: 8_200_000_000 },
            { asset: 'ETH', apy: 3.1, tvl: 12_100_000_000 },
            { asset: 'WBTC', apy: 2.1, tvl: 4_300_000_000 },
          ],
        },
        {
          name: 'Lido',
          chain: 'Ethereum',
          tvl: 34_200_000_000,
          tvl_change_24h: 1.8,
          apy_range: '3.2% - 4.1%',
          risk_score: 9.5,
          category: 'Liquid Staking',
          top_pools: [
            { asset: 'stETH', apy: 3.4, tvl: 34_200_000_000 },
          ],
        },
        {
          name: 'Uniswap V3',
          chain: 'Multi-chain',
          tvl: 6_890_000_000,
          tvl_change_24h: 3.4,
          apy_range: '5.0% - 45.0%',
          risk_score: 8.8,
          category: 'DEX',
          top_pools: [
            { asset: 'ETH/USDC', apy: 12.4, tvl: 1_200_000_000 },
            { asset: 'WBTC/ETH', apy: 8.9, tvl: 890_000_000 },
          ],
        },
        {
          name: 'Aerodrome',
          chain: 'Base',
          tvl: 2_340_000_000,
          tvl_change_24h: 8.7,
          apy_range: '8.0% - 120.0%',
          risk_score: 7.4,
          category: 'DEX',
          top_pools: [
            { asset: 'ETH/USDC', apy: 24.7, tvl: 420_000_000 },
            { asset: 'cbETH/ETH', apy: 18.2, tvl: 310_000_000 },
          ],
        },
      ],
      total_defi_tvl: 198_400_000_000,
      timestamp: new Date().toISOString(),
    },
  };
}

function generateWhaleAlerts() {
  const now = Date.now();
  return {
    success: true,
    data: {
      alerts: [
        {
          id: crypto.randomUUID(),
          type: 'ACCUMULATION',
          wallet: '0x28C6c06298d514Db089934071355E5743bf21d60',
          label: 'Binance Hot Wallet',
          asset: 'ETH',
          amount: 12_500,
          value_usd: 48_643_375,
          direction: 'inflow',
          timestamp: new Date(now - 1800000).toISOString(),
          tx_hash: '0x' + crypto.randomBytes(32).toString('hex'),
          significance: 'HIGH',
          note: 'Large ETH inflow to Binance — potential selling pressure, but historically this wallet re-deploys to DeFi within 24h.',
        },
        {
          id: crypto.randomUUID(),
          type: 'TRANSFER',
          wallet: '0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503',
          label: 'Unknown Whale',
          asset: 'USDC',
          amount: 25_000_000,
          value_usd: 25_000_000,
          direction: 'outflow',
          timestamp: new Date(now - 3600000).toISOString(),
          tx_hash: '0x' + crypto.randomBytes(32).toString('hex'),
          significance: 'CRITICAL',
          note: '$25M USDC moved from cold storage to DEX aggregator. Likely preparing a large swap — bullish signal if buying ETH.',
        },
        {
          id: crypto.randomUUID(),
          type: 'SMART_MONEY',
          wallet: '0x5a52E96BAcdaBb82fd05763E25335261B270Efcb',
          label: 'Jump Trading',
          asset: 'SOL',
          amount: 145_000,
          value_usd: 27_248_400,
          direction: 'accumulation',
          timestamp: new Date(now - 7200000).toISOString(),
          tx_hash: '0x' + crypto.randomBytes(32).toString('hex'),
          significance: 'HIGH',
          note: 'Jump Trading accumulating SOL across 3 wallets over 48h. Total position now ~$54M.',
        },
      ],
      summary: {
        total_whale_volume_24h: 892_000_000,
        net_flow: 'BULLISH',
        largest_single_tx: 25_000_000,
        active_whales: 47,
      },
      timestamp: new Date().toISOString(),
    },
  };
}

function generateSentimentData() {
  return {
    success: true,
    data: {
      overall: {
        score: 0.72,
        label: 'Bullish',
        change_24h: 0.08,
        sources_analyzed: 12_847,
      },
      by_asset: [
        { asset: 'BTC', sentiment: 0.68, label: 'Bullish', mentions: 4_231, trending_topics: ['ETF inflows', 'halving anniversary', 'institutional adoption'] },
        { asset: 'ETH', sentiment: 0.81, label: 'Very Bullish', mentions: 3_892, trending_topics: ['L2 surge', 'restaking growth', 'pectra upgrade'] },
        { asset: 'SOL', sentiment: 0.74, label: 'Bullish', mentions: 2_187, trending_topics: ['DeFi TVL', 'Firedancer', 'meme coins'] },
        { asset: 'BASE', sentiment: 0.89, label: 'Very Bullish', mentions: 1_432, trending_topics: ['Aerodrome', 'on-chain AI agents', 'x402 payments'] },
      ],
      social_volume: {
        twitter: 8_421,
        reddit: 2_187,
        telegram: 1_892,
        discord: 347,
      },
      fear_greed: {
        value: 71,
        label: 'Greed',
        previous_day: 65,
        previous_week: 58,
      },
      timestamp: new Date().toISOString(),
    },
  };
}

// ─── x402 Payment Verification ─────────────────────────────────

function verifyPayment(paymentHeader: string, expectedAmount: number): boolean {
  try {
    const decoded = Buffer.from(paymentHeader, 'base64').toString('utf-8');
    const payment = JSON.parse(decoded);

    // In the demo, we accept any well-formed payment
    // In production, the facilitator validates the signature on-chain
    if (payment.x402Version !== 2) return false;
    if (payment.scheme !== 'exact') return false;
    if (!payment.payload?.signature) return false;
    if (!payment.payload?.authorization?.from) return false;

    return true;
  } catch {
    return false;
  }
}

// ─── HTTP Server ──────────────────────────────────────────────

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'X-PAYMENT, X-Payment, Accept, Content-Type');
  res.setHeader('Access-Control-Expose-Headers', 'X-PAYMENT-REQUIRED, X-Payment-Required, X-Payment-Response');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // ─── Discovery Endpoint ─────────────────────────────────────

  if (pathname === '/' || pathname === '/api/premium') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      name: 'Crypto Vision Gas Station',
      version: '1.0.0',
      description: 'x402-powered premium crypto intelligence — pay per request with USDC',
      pumps: PUMPS.map(p => ({
        endpoint: p.path,
        name: p.name,
        description: p.description,
        price: `$${p.priceUsd.toFixed(3)}`,
      })),
      x402: {
        version: 2,
        network: NETWORK,
        asset: USDC_ASSET,
        payTo: PAYMENT_ADDRESS,
        facilitator: 'https://x402.org/facilitator',
      },
    }, null, 2));
    return;
  }

  // ─── Gas Station Pumps ──────────────────────────────────────

  const pump = PUMPS.find(p => pathname === p.path);
  if (!pump) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found', message: `No pump at ${pathname}` }));
    return;
  }

  // Check for payment
  const paymentHeader = req.headers['x-payment'] as string | undefined;

  if (!paymentHeader) {
    // Return 402 Payment Required
    const priceInUSDC = Math.round(pump.priceUsd * 1e6);
    const paymentRequirements = {
      x402Version: 2,
      accepts: [{
        scheme: 'exact',
        network: NETWORK,
        maxAmountRequired: priceInUSDC.toString(),
        resource: pump.path,
        description: pump.description,
        mimeType: 'application/json',
        payTo: PAYMENT_ADDRESS,
        maxTimeoutSeconds: 300,
        asset: USDC_ASSET,
      }],
    };

    const encodedRequirements = Buffer.from(JSON.stringify(paymentRequirements)).toString('base64');

    console.log(`  ⛽ ${pump.name} — 402 Payment Required ($${pump.priceUsd.toFixed(3)})`);

    res.writeHead(402, {
      'Content-Type': 'application/json; charset=utf-8',
      'X-PAYMENT-REQUIRED': encodedRequirements,
      'X-Price-USD': `$${pump.priceUsd.toFixed(3)}`,
      'WWW-Authenticate': `X402 realm="${pump.path}"`,
    });

    res.end(JSON.stringify({
      error: 'Payment Required',
      message: `This endpoint requires payment of $${pump.priceUsd.toFixed(3)} USD`,
      price: `$${pump.priceUsd.toFixed(3)}`,
      pump: pump.name,
      x402: paymentRequirements,
    }));
    return;
  }

  // Verify payment
  if (!verifyPayment(paymentHeader, pump.priceUsd)) {
    console.log(`  ❌ ${pump.name} — Invalid payment`);
    res.writeHead(402, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid Payment', message: 'Payment signature verification failed' }));
    return;
  }

  // Payment accepted — return data
  const settlementTxHash = '0x' + crypto.randomBytes(32).toString('hex');

  console.log(`  ✅ ${pump.name} — Payment accepted ($${pump.priceUsd.toFixed(3)}) → ${settlementTxHash.slice(0, 18)}...`);

  res.writeHead(200, {
    'Content-Type': 'application/json',
    'X-Payment-Response': Buffer.from(JSON.stringify({
      success: true,
      network: NETWORK,
      transactionHash: settlementTxHash,
      amount: Math.round(pump.priceUsd * 1e6).toString(),
    })).toString('base64'),
  });

  res.end(JSON.stringify(pump.handler()));
});

// ─── Start Server ─────────────────────────────────────────────

server.listen(PORT, () => {
  console.log('');
  console.log('  ╔═══════════════════════════════════════════════════════╗');
  console.log('  ║                                                       ║');
  console.log('  ║   ⛽  CRYPTO VISION GAS STATION  ⛽                   ║');
  console.log('  ║       x402 Payment Demo Server                        ║');
  console.log('  ║                                                       ║');
  console.log('  ╚═══════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  🌐 Server:      http://localhost:${PORT}`);
  console.log(`  🔗 Network:     Base Sepolia (${NETWORK})`);
  console.log(`  💰 Payment To:  ${PAYMENT_ADDRESS}`);
  console.log(`  💵 Asset:       USDC (${USDC_ASSET})`);
  console.log('');
  console.log('  ⛽ Available Pumps:');
  for (const pump of PUMPS) {
    console.log(`     ${pump.name.padEnd(30)} $${pump.priceUsd.toFixed(3)}  →  ${pump.path}`);
  }
  console.log('');
  console.log('  Waiting for agents to refuel...');
  console.log('  ─────────────────────────────────────────────────────');
  console.log('');
});
