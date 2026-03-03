import { NextRequest, NextResponse } from 'next/server';
import * as messari from '@/lib/messari';

export const runtime = 'edge';
export const revalidate = 300;

/**
 * GET /api/market/messari
 *
 * Get Messari fundamental and market data
 *
 * Query params:
 * - action: 'assets' | 'asset' | 'metrics' | 'profile' | 'markets' | 'news' | 'global' | 'timeseries'
 * - asset: asset symbol or slug (for asset/metrics/profile/markets/timeseries)
 * - page: page number (default: 1)
 * - limit: number of results (default: 20)
 * - days: number of days for timeseries (default: 30)
 *
 * @example
 * GET /api/market/messari?action=metrics&asset=bitcoin
 * GET /api/market/messari?action=global
 * GET /api/market/messari?action=news&limit=10
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'global';
    const asset = searchParams.get('asset') || 'bitcoin';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const days = parseInt(searchParams.get('days') || '30', 10);

    let data: unknown;

    switch (action) {
      case 'assets':
        data = await messari.getAssets(page, limit);
        break;

      case 'asset':
        data = await messari.getAsset(asset);
        break;

      case 'metrics':
        data = await messari.getAssetMetrics(asset);
        break;

      case 'profile':
        data = await messari.getAssetProfile(asset);
        break;

      case 'markets':
        data = await messari.getAssetMarkets(asset);
        break;

      case 'marketdata':
        data = await messari.getAssetMarketData(asset);
        break;

      case 'news':
        data = await messari.getNews(page, limit);
        break;

      case 'assetnews':
        data = await messari.getAssetNews(asset, page, limit);
        break;

      case 'global':
        data = await messari.getGlobalMetrics();
        break;

      case 'sectors':
        data = await messari.getSectors();
        break;

      case 'timeseries':
        data = await messari.getNormalizedTimeseries(asset, days);
        break;

      case 'comprehensive':
        data = await messari.getComprehensiveAssetData(asset);
        break;

      case 'search':
        const query = searchParams.get('q') || '';
        data = await messari.searchAssets(query);
        break;

      default:
        data = await messari.getGlobalMetrics();
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
    console.error('Messari API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch Messari data', message: String(error) },
      { status: 500 }
    );
  }
}
