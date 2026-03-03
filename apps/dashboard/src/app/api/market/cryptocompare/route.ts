import { NextRequest, NextResponse } from 'next/server';
import * as cryptocompare from '@/lib/cryptocompare';

export const runtime = 'edge';
export const revalidate = 300;

/**
 * GET /api/market/cryptocompare
 *
 * Get CryptoCompare market data
 *
 * Query params:
 * - action: 'price' | 'pricefull' | 'topvolume' | 'topmcap' | 'gainers' | 'history' | 'news' | 'blockchain'
 * - symbols: comma-separated list of symbols (for price/pricefull)
 * - symbol: single symbol (for history/blockchain)
 * - days: number of days for history (default: 30)
 * - limit: number of results (default: 50)
 *
 * @example
 * GET /api/market/cryptocompare?action=price&symbols=BTC,ETH
 * GET /api/market/cryptocompare?action=topvolume&limit=20
 * GET /api/market/cryptocompare?action=history&symbol=BTC&days=30
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'topvolume';
    const symbols = searchParams.get('symbols')?.split(',') || ['BTC', 'ETH'];
    const symbol = searchParams.get('symbol') || 'BTC';
    const days = parseInt(searchParams.get('days') || '30', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    let data: unknown;

    switch (action) {
      case 'price':
        data = await cryptocompare.getPrice(symbols);
        break;

      case 'pricefull':
        data = await cryptocompare.getPriceFull(symbols);
        break;

      case 'topvolume':
        data = await cryptocompare.getTopByVolume('USD', limit);
        break;

      case 'topmcap':
        data = await cryptocompare.getTopByMarketCap('USD', limit);
        break;

      case 'gainers':
        data = await cryptocompare.getTopGainersLosers('USD', limit);
        break;

      case 'history':
        data = await cryptocompare.getNormalizedHistory(symbol, days);
        break;

      case 'histodaily':
        data = await cryptocompare.getHistoricalDaily(symbol, 'USD', days);
        break;

      case 'histohourly':
        data = await cryptocompare.getHistoricalHourly(symbol, 'USD', Math.min(days * 24, 2000));
        break;

      case 'news':
        data = await cryptocompare.getNews();
        break;

      case 'blockchain':
        data = await cryptocompare.getBlockchainLatest(symbol);
        break;

      case 'blockchainhistory':
        data = await cryptocompare.getBlockchainHistorical(symbol, days);
        break;

      case 'exchanges':
        data = await cryptocompare.getExchanges();
        break;

      default:
        data = await cryptocompare.getTopByVolume('USD', 50);
    }

    return NextResponse.json(
      { success: true, data },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    console.error('CryptoCompare API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch CryptoCompare data', message: String(error) },
      { status: 500 }
    );
  }
}
