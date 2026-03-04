import { NextRequest, NextResponse } from 'next/server';
import * as coinglass from '@/lib/coinglass';

export const runtime = 'edge';
export const revalidate = 60;

/**
 * GET /api/market/coinglass
 *
 * Get Coinglass derivatives data (open interest, funding, liquidations, long/short)
 *
 * Query params:
 * - action: 'openinterest' | 'funding' | 'liquidations' | 'longshort' | 'overview' | 'exchanges' | 'options'
 * - symbol: symbol for specific data (default: BTC)
 * - exchange: exchange name (default: Binance)
 * - interval: '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '12h' | '1d' (for history)
 * - limit: number of results (default: 100)
 *
 * @example
 * GET /api/market/coinglass?action=openinterest
 * GET /api/market/coinglass?action=liquidations&symbol=ETH
 * GET /api/market/coinglass?action=overview
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'overview';
    const symbol = searchParams.get('symbol') || 'BTC';
    const exchange = searchParams.get('exchange') || 'Binance';
    const interval = (searchParams.get('interval') || '1h') as
      | '1m'
      | '5m'
      | '15m'
      | '30m'
      | '1h'
      | '4h'
      | '12h'
      | '1d';
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    let data: unknown;

    switch (action) {
      // Open Interest
      case 'openinterest':
        data = await coinglass.getOpenInterest();
        break;

      case 'openinterest-symbol':
        data = await coinglass.getOpenInterestBySymbol(symbol);
        break;

      case 'openinterest-history':
        data = await coinglass.getOpenInterestHistory(symbol, interval, limit);
        break;

      case 'openinterest-aggregated':
        data = await coinglass.getAggregatedOpenInterest();
        break;

      case 'openinterest-weights':
        data = await coinglass.getOIWeights();
        break;

      // Funding Rates
      case 'funding':
        data = await coinglass.getFundingRates();
        break;

      case 'funding-symbol':
        data = await coinglass.getFundingRateBySymbol(symbol);
        break;

      case 'funding-history':
        data = await coinglass.getFundingRateHistory(symbol, exchange, limit);
        break;

      case 'funding-average':
        data = await coinglass.getAverageFundingRates();
        break;

      // Liquidations
      case 'liquidations':
        data = await coinglass.getLiquidations();
        break;

      case 'liquidations-symbol':
        data = await coinglass.getLiquidationBySymbol(symbol);
        break;

      case 'liquidations-history':
        data = await coinglass.getLiquidationHistory(symbol, interval, limit);
        break;

      case 'liquidations-summary':
        data = await coinglass.getLiquidationSummary();
        break;

      // Long/Short Ratio
      case 'longshort':
        data = await coinglass.getLongShortRatio();
        break;

      case 'longshort-symbol':
        data = await coinglass.getLongShortRatioBySymbol(symbol);
        break;

      case 'longshort-history':
        data = await coinglass.getLongShortHistory(
          symbol,
          exchange,
          interval as '5m' | '15m' | '30m' | '1h' | '4h' | '12h' | '1d',
          limit
        );
        break;

      case 'longshort-top':
        data = await coinglass.getTopLongShort();
        break;

      case 'longshort-global':
        data = await coinglass.getGlobalLongShort();
        break;

      // Options
      case 'options':
        data = await coinglass.getOptions();
        break;

      case 'options-symbol':
        data = await coinglass.getOptionsBySymbol(symbol);
        break;

      // Exchanges
      case 'exchanges':
        data = await coinglass.getExchangeInfo();
        break;

      // Composite
      case 'symbol-derivatives':
        data = await coinglass.getSymbolDerivatives(symbol);
        break;

      case 'overview':
        data = await coinglass.getDerivativesOverview();
        break;

      case 'heatmap':
        data = await coinglass.getLiquidationHeatmap(
          symbol,
          interval as '1h' | '4h' | '12h' | '24h'
        );
        break;

      default:
        data = await coinglass.getDerivativesOverview();
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
    console.error('Coinglass API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch Coinglass data', message: String(error) },
      { status: 500 }
    );
  }
}
