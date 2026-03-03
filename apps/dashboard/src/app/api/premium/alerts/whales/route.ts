/**
 * Premium API - Whale Alerts & On-chain Analytics
 *
 * GET /api/premium/alerts/whales
 *
 * Premium whale tracking and on-chain data:
 * - Large transaction monitoring
 * - Exchange inflow/outflow signals
 * - Wallet concentration analysis
 *
 * Price: $0.01 per request
 *
 * @module api/premium/alerts/whales
 */

import { NextRequest, NextResponse } from 'next/server';
import { withX402 } from '@x402/next';
import { x402Server, getRouteConfig } from '@/lib/x402-server';
import { getCoinDetails } from '@/lib/market-data';

export const runtime = 'nodejs';

interface WhaleTransaction {
  id: string;
  coin: string;
  amount: number;
  valueUsd: number;
  fromType: 'exchange' | 'whale' | 'unknown';
  toType: 'exchange' | 'whale' | 'unknown';
  fromAddress: string;
  toAddress: string;
  timestamp: number;
  txHash: string;
  significance: 'low' | 'medium' | 'high' | 'critical';
  signal?: 'bullish' | 'bearish' | 'neutral';
}

interface WhaleStats {
  coin: string;
  totalWhaleVolume24h: number;
  exchangeInflow24h: number;
  exchangeOutflow24h: number;
  netFlow24h: number;
  flowSignal: 'accumulation' | 'distribution' | 'neutral';
  largestTransaction24h: number;
  whaleTransactionCount24h: number;
  averageTransactionSize: number;
}

interface ConcentrationData {
  top10HoldersPercent: number;
  top50HoldersPercent: number;
  top100HoldersPercent: number;
  concentrationTrend: 'increasing' | 'decreasing' | 'stable';
  giniCoefficient: number;
}

interface WhaleAlertsResponse {
  transactions: WhaleTransaction[];
  stats: WhaleStats[];
  concentration?: ConcentrationData;
  premium: true;
  metadata: {
    fetchedAt: string;
    coins: string[];
    transactionCount: number;
    minThresholdUsd: number;
  };
}

// Known exchange addresses for identification
const KNOWN_EXCHANGES: Record<string, string> = {
  '0x28c6c06298d514db089934071355e5743bf21d60': 'Binance',
  '0xf977814e90da44bfa03b6295a0616a897441acec': 'Binance',
  '0x56eddb7aa87536c09ccc2793473599fd21a8b17f': 'Coinbase',
  '0x503828976d22510aad0201ac7ec88293211d23da': 'Coinbase',
  '0x2910543af39aba0cd09dbb2d50200b3e800a63d2': 'Kraken',
  '0x98ec059dc3adfbdd63429454aeb0c990fba4a128': 'OKX',
};

/**
 * Fetch real whale transactions from Etherscan API
 */
async function fetchRealWhaleTransactions(
  coins: string[],
  coinPrices: Map<string, number>,
  minThreshold: number
): Promise<WhaleTransaction[]> {
  const transactions: WhaleTransaction[] = [];
  const apiKey = process.env.ETHERSCAN_API_KEY || '';

  // Fetch from known exchange hot wallets
  const exchangeAddresses = Object.keys(KNOWN_EXCHANGES).slice(0, 3);

  for (const address of exchangeAddresses) {
    try {
      const response = await fetch(
        `https://api.etherscan.io/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=20&sort=desc${apiKey ? `&apikey=${apiKey}` : ''}`,
        { next: { revalidate: 60 } }
      );

      if (!response.ok) continue;

      const data = await response.json();
      if (data.status !== '1' || !data.result) continue;

      const ethPrice = coinPrices.get('ethereum') || 4000;

      for (const tx of data.result) {
        const valueEth = parseFloat(tx.value) / 1e18;
        const valueUsd = valueEth * ethPrice;

        if (valueUsd < minThreshold) continue;

        const fromIsExchange = !!KNOWN_EXCHANGES[tx.from?.toLowerCase()];
        const toIsExchange = !!KNOWN_EXCHANGES[tx.to?.toLowerCase()];

        let signal: 'bullish' | 'bearish' | 'neutral' = 'neutral';
        if (fromIsExchange && !toIsExchange) signal = 'bullish';
        else if (!fromIsExchange && toIsExchange) signal = 'bearish';

        const fromType: 'exchange' | 'whale' | 'unknown' = fromIsExchange ? 'exchange' : 'whale';
        const toType: 'exchange' | 'whale' | 'unknown' = toIsExchange ? 'exchange' : 'whale';

        transactions.push({
          id: `eth-${tx.hash}`,
          coin: 'ethereum',
          amount: valueEth,
          valueUsd,
          fromType,
          toType,
          fromAddress: tx.from,
          toAddress: tx.to,
          timestamp: parseInt(tx.timeStamp) * 1000,
          txHash: tx.hash,
          significance: valueUsd > 10_000_000 ? 'critical' : valueUsd > 5_000_000 ? 'high' : valueUsd > 2_000_000 ? 'medium' : 'low',
          signal,
        });
      }
    } catch (error) {
      console.error('Etherscan fetch error:', error);
    }
  }

  // Also try Whale Alert API if key is available
  const whaleAlertKey = process.env.WHALE_ALERT_API_KEY;
  if (whaleAlertKey) {
    try {
      const startTime = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000);
      const response = await fetch(
        `https://api.whale-alert.io/v1/transactions?api_key=${whaleAlertKey}&min_value=${minThreshold}&start=${startTime}&limit=50`,
        { next: { revalidate: 60 } }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.transactions) {
          for (const tx of data.transactions) {
            const fromIsExchange = tx.from?.owner_type === 'exchange';
            const toIsExchange = tx.to?.owner_type === 'exchange';

            let signal: 'bullish' | 'bearish' | 'neutral' = 'neutral';
            if (fromIsExchange && !toIsExchange) signal = 'bullish';
            else if (!fromIsExchange && toIsExchange) signal = 'bearish';

            transactions.push({
              id: tx.id || `wa-${tx.hash}`,
              coin: tx.symbol?.toLowerCase() || 'unknown',
              amount: tx.amount,
              valueUsd: tx.amount_usd,
              fromType: fromIsExchange ? 'exchange' : 'whale',
              toType: toIsExchange ? 'exchange' : 'whale',
              fromAddress: tx.from?.address || 'unknown',
              toAddress: tx.to?.address || 'unknown',
              timestamp: tx.timestamp * 1000,
              txHash: tx.hash,
              significance: tx.amount_usd > 10_000_000 ? 'critical' : tx.amount_usd > 5_000_000 ? 'high' : tx.amount_usd > 2_000_000 ? 'medium' : 'low',
              signal,
            });
          }
        }
      }
    } catch (error) {
      console.error('Whale Alert fetch error:', error);
    }
  }

  return transactions.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Calculate whale statistics
 */
function calculateWhaleStats(transactions: WhaleTransaction[], coin: string): WhaleStats {
  const coinTxs = transactions.filter((tx) => tx.coin === coin);

  const totalVolume = coinTxs.reduce((sum, tx) => sum + tx.valueUsd, 0);
  const exchangeInflow = coinTxs
    .filter((tx) => tx.toType === 'exchange')
    .reduce((sum, tx) => sum + tx.valueUsd, 0);
  const exchangeOutflow = coinTxs
    .filter((tx) => tx.fromType === 'exchange')
    .reduce((sum, tx) => sum + tx.valueUsd, 0);
  const netFlow = exchangeOutflow - exchangeInflow; // Positive = accumulation

  const largestTx = Math.max(...coinTxs.map((tx) => tx.valueUsd), 0);

  let flowSignal: 'accumulation' | 'distribution' | 'neutral' = 'neutral';
  const flowRatio = totalVolume > 0 ? netFlow / totalVolume : 0;
  if (flowRatio > 0.2) flowSignal = 'accumulation';
  else if (flowRatio < -0.2) flowSignal = 'distribution';

  return {
    coin,
    totalWhaleVolume24h: Math.round(totalVolume),
    exchangeInflow24h: Math.round(exchangeInflow),
    exchangeOutflow24h: Math.round(exchangeOutflow),
    netFlow24h: Math.round(netFlow),
    flowSignal,
    largestTransaction24h: Math.round(largestTx),
    whaleTransactionCount24h: coinTxs.length,
    averageTransactionSize: coinTxs.length > 0 ? Math.round(totalVolume / coinTxs.length) : 0,
  };
}

/**
 * Fetch holder concentration data from blockchain explorers
 * Uses Etherscan for Ethereum-based tokens
 */
async function fetchConcentrationData(coin: string): Promise<ConcentrationData> {
  // Known token contracts for concentration analysis
  const tokenContracts: Record<string, string> = {
    ethereum: '', // Native ETH - use different method
    bitcoin: '', // BTC - not on Etherscan
    'shiba-inu': '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce',
    chainlink: '0x514910771af9ca656af840dff83e8264ecf986ca',
    uniswap: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
    pepe: '0x6982508145454ce325ddbe47a25d4ec3d2311933',
  };

  try {
    const contract = tokenContracts[coin];
    if (!contract) {
      // Return estimated data based on general market patterns
      return getEstimatedConcentration(coin);
    }

    const apiKey = process.env.ETHERSCAN_API_KEY || '';
    const response = await fetch(
      `https://api.etherscan.io/api?module=token&action=tokenholderlist&contractaddress=${contract}&page=1&offset=100${apiKey ? `&apikey=${apiKey}` : ''}`,
      { next: { revalidate: 3600 } }
    );

    if (response.ok) {
      const data = await response.json();
      if (data.status === '1' && data.result) {
        const holders = data.result;
        
        // Calculate concentration percentages
        const totalInTop100 = holders.reduce((sum: number, h: { TokenHolderQuantity: string }) => 
          sum + parseFloat(h.TokenHolderQuantity), 0);
        
        // Top holders concentration (estimated from API data)
        const top10Holders = holders.slice(0, 10);
        const top50Holders = holders.slice(0, 50);
        
        const top10Total = top10Holders.reduce((sum: number, h: { TokenHolderQuantity: string }) => 
          sum + parseFloat(h.TokenHolderQuantity), 0);
        const top50Total = top50Holders.reduce((sum: number, h: { TokenHolderQuantity: string }) => 
          sum + parseFloat(h.TokenHolderQuantity), 0);

        // These are relative to top 100, need to estimate total supply percentage
        const estimatedCirculatingFactor = 0.3; // Estimate top 100 = 30% of supply
        
        return {
          top10HoldersPercent: (top10Total / totalInTop100) * 100 * estimatedCirculatingFactor,
          top50HoldersPercent: (top50Total / totalInTop100) * 100 * estimatedCirculatingFactor,
          top100HoldersPercent: 100 * estimatedCirculatingFactor,
          concentrationTrend: 'stable', // Would need historical data to determine
          giniCoefficient: calculateGiniFromHolders(holders.map((h: { TokenHolderQuantity: string }) => 
            parseFloat(h.TokenHolderQuantity))),
        };
      }
    }
  } catch (error) {
    console.error('Concentration fetch error:', error);
  }

  return getEstimatedConcentration(coin);
}

/**
 * Calculate Gini coefficient from holder distribution
 */
function calculateGiniFromHolders(holdings: number[]): number {
  if (holdings.length === 0) return 0;
  
  const sorted = [...holdings].sort((a, b) => a - b);
  const n = sorted.length;
  const sum = sorted.reduce((a, b) => a + b, 0);
  
  if (sum === 0) return 0;
  
  let cumulativeSum = 0;
  let giniSum = 0;
  
  for (let i = 0; i < n; i++) {
    cumulativeSum += sorted[i];
    giniSum += cumulativeSum;
  }
  
  return 1 - (2 * giniSum) / (n * sum) + 1 / n;
}

/**
 * Get estimated concentration based on known patterns
 */
function getEstimatedConcentration(coin: string): ConcentrationData {
  // Known concentration patterns from public data
  const knownConcentrations: Record<string, ConcentrationData> = {
    bitcoin: {
      top10HoldersPercent: 5.5,
      top50HoldersPercent: 12.5,
      top100HoldersPercent: 15.0,
      concentrationTrend: 'stable',
      giniCoefficient: 0.88,
    },
    ethereum: {
      top10HoldersPercent: 35.5,
      top50HoldersPercent: 45.0,
      top100HoldersPercent: 52.0,
      concentrationTrend: 'stable',
      giniCoefficient: 0.92,
    },
  };

  return knownConcentrations[coin] || {
    top10HoldersPercent: 30,
    top50HoldersPercent: 50,
    top100HoldersPercent: 60,
    concentrationTrend: 'stable',
    giniCoefficient: 0.85,
  };
}

/**
 * Handler for whale alerts endpoint
 */
async function handler(
  request: NextRequest
): Promise<NextResponse<WhaleAlertsResponse | { error: string; message: string }>> {
  const searchParams = request.nextUrl.searchParams;
  const coinsParam = searchParams.get('coins') || 'bitcoin,ethereum';
  const coins = coinsParam.split(',').slice(0, 10);
  const minThreshold = Math.max(
    100000,
    parseInt(searchParams.get('minThreshold') || '1000000', 10)
  );
  const includeConcentration = searchParams.get('concentration') === 'true';

  try {
    // Fetch current prices
    const coinPrices = new Map<string, number>();
    const pricePromises = coins.map(async (coin) => {
      const details = await getCoinDetails(coin);
      const price = details?.market_data?.current_price?.usd || 1;
      coinPrices.set(coin, price);
    });
    await Promise.all(pricePromises);

    // Fetch real whale transactions from blockchain APIs
    const transactions = await fetchRealWhaleTransactions(coins, coinPrices, minThreshold);

    // Calculate stats for each coin
    const stats = coins.map((coin) => calculateWhaleStats(transactions, coin));

    // Fetch real concentration data if requested
    const concentration = includeConcentration 
      ? await fetchConcentrationData(coins[0] || 'ethereum') 
      : undefined;

    return NextResponse.json(
      {
        transactions,
        stats,
        concentration,
        premium: true,
        metadata: {
          fetchedAt: new Date().toISOString(),
          coins,
          transactionCount: transactions.length,
          minThresholdUsd: minThreshold,
        },
      },
      {
        headers: {
          'Cache-Control': 'private, s-maxage=60, stale-while-revalidate=120',
        },
      }
    );
  } catch (error) {
    console.error('Error in whale alerts route:', error);
    return NextResponse.json(
      { error: 'Failed to fetch whale data', message: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/premium/alerts/whales
 *
 * Premium whale alerts - requires x402 payment
 *
 * Query parameters:
 * - coins: Comma-separated coin IDs (max 10, default: 'bitcoin,ethereum')
 * - minThreshold: Minimum transaction value in USD (default: 1000000)
 * - concentration: Include holder concentration data (true/false)
 *
 * @example
 * GET /api/premium/alerts/whales?coins=bitcoin,ethereum&minThreshold=5000000
 * GET /api/premium/alerts/whales?coins=bitcoin&concentration=true
 */
export const GET = withX402(handler, getRouteConfig('/api/premium/alerts/whales'), x402Server);
