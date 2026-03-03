import { NextRequest, NextResponse } from 'next/server';
import * as cryptocompare from '@/lib/cryptocompare';
import * as messari from '@/lib/messari';
import * as coinglass from '@/lib/coinglass';
import * as etherscan from '@/lib/etherscan';
import * as binance from '@/lib/binance';
import * as coinpaprika from '@/lib/coinpaprika';
import { getAggregatedAssets, getAggregatedGlobalData, getBitcoinNetworkData } from '@/lib/external-apis';

export const runtime = 'edge';
export const revalidate = 60;

/**
 * GET /api/market/aggregated
 *
 * Get aggregated market data from multiple sources
 * Provides a unified view combining data from:
 * - CoinGecko, CoinCap, CoinPaprika, CoinLore (prices/market data)
 * - Binance (real-time prices, derivatives)
 * - CryptoCompare (historical, social)
 * - Messari (fundamentals)
 * - Coinglass (derivatives)
 * - Etherscan (gas, network stats)
 * - Mempool/Blockchain.info (Bitcoin on-chain)
 *
 * Query params:
 * - type: 'overview' | 'prices' | 'derivatives' | 'onchain' | 'fundamental' | 'full'
 * - symbols: comma-separated symbols (default: BTC,ETH,SOL)
 * - limit: number of results (default: 20)
 *
 * @example
 * GET /api/market/aggregated?type=overview
 * GET /api/market/aggregated?type=prices&symbols=BTC,ETH,SOL&limit=10
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'overview';
    const symbols = searchParams.get('symbols')?.split(',') || ['BTC', 'ETH', 'SOL'];
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    let data: unknown;

    switch (type) {
      case 'overview': {
        // Market overview from multiple sources
        const [globalData, topAssets, ethStats, derivativesOverview] = await Promise.allSettled([
          getAggregatedGlobalData(),
          getAggregatedAssets(limit),
          etherscan.getNetworkStats(),
          coinglass.getDerivativesOverview(),
        ]);

        data = {
          global: globalData.status === 'fulfilled' ? globalData.value : null,
          topAssets: topAssets.status === 'fulfilled' ? topAssets.value : [],
          ethereum: ethStats.status === 'fulfilled' ? ethStats.value : null,
          derivatives: derivativesOverview.status === 'fulfilled' ? derivativesOverview.value : null,
          sources: ['coinpaprika', 'coincap', 'coinlore', 'etherscan', 'coinglass'],
          timestamp: new Date().toISOString(),
        };
        break;
      }

      case 'prices': {
        // Multi-source price data
        const [ccPrices, binancePrices, paprikaTickers] = await Promise.allSettled([
          cryptocompare.getPriceFull(symbols),
          binance.get24hrTickers(),
          coinpaprika.getTickers(),
        ]);

        // Normalize and merge prices
        const mergedPrices: Record<
          string,
          {
            symbol: string;
            prices: { source: string; price: number; change24h: number }[];
            avgPrice: number;
            avgChange24h: number;
          }
        > = {};

        // Add CryptoCompare prices
        if (ccPrices.status === 'fulfilled' && ccPrices.value.RAW) {
          for (const symbol of symbols) {
            const rawData = ccPrices.value.RAW[symbol]?.USD;
            if (rawData) {
              if (!mergedPrices[symbol]) {
                mergedPrices[symbol] = { symbol, prices: [], avgPrice: 0, avgChange24h: 0 };
              }
              mergedPrices[symbol].prices.push({
                source: 'cryptocompare',
                price: rawData.PRICE,
                change24h: rawData.CHANGEPCT24HOUR,
              });
            }
          }
        }

        // Add Binance prices (match by symbol + USDT)
        if (binancePrices.status === 'fulfilled') {
          for (const symbol of symbols) {
            const ticker = binancePrices.value.find((t) => t.symbol === `${symbol}USDT`);
            if (ticker) {
              if (!mergedPrices[symbol]) {
                mergedPrices[symbol] = { symbol, prices: [], avgPrice: 0, avgChange24h: 0 };
              }
              mergedPrices[symbol].prices.push({
                source: 'binance',
                price: parseFloat(ticker.lastPrice),
                change24h: parseFloat(ticker.priceChangePercent),
              });
            }
          }
        }

        // Add CoinPaprika prices
        if (paprikaTickers.status === 'fulfilled') {
          for (const symbol of symbols) {
            const ticker = paprikaTickers.value.find(
              (t) => t.symbol.toUpperCase() === symbol.toUpperCase()
            );
            if (ticker) {
              if (!mergedPrices[symbol]) {
                mergedPrices[symbol] = { symbol, prices: [], avgPrice: 0, avgChange24h: 0 };
              }
              mergedPrices[symbol].prices.push({
                source: 'coinpaprika',
                price: ticker.quotes.USD.price,
                change24h: ticker.quotes.USD.percent_change_24h,
              });
            }
          }
        }

        // Calculate averages
        for (const symbol of Object.keys(mergedPrices)) {
          const entry = mergedPrices[symbol];
          if (entry.prices.length > 0) {
            entry.avgPrice =
              entry.prices.reduce((sum, p) => sum + p.price, 0) / entry.prices.length;
            entry.avgChange24h =
              entry.prices.reduce((sum, p) => sum + p.change24h, 0) / entry.prices.length;
          }
        }

        data = {
          prices: Object.values(mergedPrices),
          sources: ['cryptocompare', 'binance', 'coinpaprika'],
          timestamp: new Date().toISOString(),
        };
        break;
      }

      case 'derivatives': {
        // Comprehensive derivatives data
        const [oiData, fundingData, liqData, lsData, binanceOI] = await Promise.allSettled([
          coinglass.getAggregatedOpenInterest(),
          coinglass.getAverageFundingRates(),
          coinglass.getLiquidationSummary(),
          coinglass.getGlobalLongShort(),
          binance.getOpenInterest('BTCUSDT'),
        ]);

        data = {
          openInterest: oiData.status === 'fulfilled' ? oiData.value : [],
          fundingRates: fundingData.status === 'fulfilled' ? fundingData.value : [],
          liquidations: liqData.status === 'fulfilled' ? liqData.value : null,
          longShort: lsData.status === 'fulfilled' ? lsData.value : null,
          binance: {
            btcOpenInterest: binanceOI.status === 'fulfilled' ? binanceOI.value : null,
          },
          sources: ['coinglass', 'binance'],
          timestamp: new Date().toISOString(),
        };
        break;
      }

      case 'onchain': {
        // On-chain data for Bitcoin and Ethereum
        const [btcData, ethGas, ethSupply, ccBlockchain] = await Promise.allSettled([
          getBitcoinNetworkData(),
          etherscan.getGasOracle(),
          etherscan.getEthSupply(),
          cryptocompare.getBlockchainLatest('BTC'),
        ]);

        data = {
          bitcoin: {
            network: btcData.status === 'fulfilled' ? btcData.value : null,
            onchain: ccBlockchain.status === 'fulfilled' ? ccBlockchain.value : null,
          },
          ethereum: {
            gas: ethGas.status === 'fulfilled' ? ethGas.value : null,
            supply: ethSupply.status === 'fulfilled' ? ethSupply.value : null,
          },
          sources: ['mempool', 'blockchain.info', 'etherscan', 'cryptocompare'],
          timestamp: new Date().toISOString(),
        };
        break;
      }

      case 'fundamental': {
        // Fundamental data from Messari
        const assetData = await Promise.allSettled(
          symbols.slice(0, 5).map((s) => messari.getAssetMetrics(s.toLowerCase()))
        );

        const fundamentals = symbols.slice(0, 5).map((symbol, index) => ({
          symbol,
          metrics:
            assetData[index].status === 'fulfilled' ? assetData[index].value.data : null,
        }));

        data = {
          fundamentals,
          sources: ['messari'],
          timestamp: new Date().toISOString(),
        };
        break;
      }

      case 'full': {
        // Full aggregated data (expensive operation)
        const [overview, prices, derivatives, onchain, fundamental] = await Promise.allSettled([
          // Overview
          Promise.all([getAggregatedGlobalData(), getAggregatedAssets(limit)]),
          // Prices
          cryptocompare.getPriceFull(symbols),
          // Derivatives
          coinglass.getDerivativesOverview(),
          // On-chain
          Promise.all([getBitcoinNetworkData(), etherscan.getNetworkStats()]),
          // Fundamental
          messari.getGlobalMetrics(),
        ]);

        data = {
          global:
            overview.status === 'fulfilled'
              ? { global: overview.value[0], topAssets: overview.value[1] }
              : null,
          prices:
            prices.status === 'fulfilled'
              ? { raw: prices.value.RAW, display: prices.value.DISPLAY }
              : null,
          derivatives: derivatives.status === 'fulfilled' ? derivatives.value : null,
          onchain:
            onchain.status === 'fulfilled'
              ? { bitcoin: onchain.value[0], ethereum: onchain.value[1] }
              : null,
          fundamental: fundamental.status === 'fulfilled' ? fundamental.value.data : null,
          sources: [
            'coingecko',
            'coinpaprika',
            'coincap',
            'cryptocompare',
            'coinglass',
            'etherscan',
            'mempool',
            'messari',
          ],
          timestamp: new Date().toISOString(),
        };
        break;
      }

      default:
        data = { error: 'Invalid type parameter' };
    }

    return NextResponse.json(
      { success: true, data },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    console.error('Aggregated API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch aggregated data', message: String(error) },
      { status: 500 }
    );
  }
}
