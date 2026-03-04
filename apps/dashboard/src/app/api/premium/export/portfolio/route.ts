/**
 * Premium API - Export Portfolio
 *
 * GET /api/premium/export/portfolio
 *
 * Export portfolio data as JSON or CSV with full transaction history.
 *
 * Price: $0.10 per export
 *
 * @module api/premium/export/portfolio
 */

import { NextRequest, NextResponse } from 'next/server';
import { withX402 } from '@x402/next';
import { x402Server, getRouteConfig } from '@/lib/x402-server';

export const runtime = 'nodejs';

interface PortfolioExport {
  format: 'json' | 'csv';
  exportedAt: string;
  portfolio: {
    totalValue: number;
    totalCost: number;
    totalPnL: number;
    totalPnLPercent: number;
    holdings: Array<{
      coinId: string;
      symbol: string;
      name: string;
      quantity: number;
      avgBuyPrice: number;
      currentPrice: number;
      value: number;
      pnl: number;
      pnlPercent: number;
      allocation: number;
    }>;
    transactions: Array<{
      id: string;
      coinId: string;
      type: 'buy' | 'sell';
      quantity: number;
      price: number;
      total: number;
      date: string;
    }>;
  };
  meta: {
    premium: true;
    generatedBy: string;
    version: string;
  };
}

/**
 * Handler for portfolio export
 * Accepts portfolio data from client and enriches with current prices
 */
async function handler(
  request: NextRequest
): Promise<NextResponse<PortfolioExport | string | { error: string }>> {
  const searchParams = request.nextUrl.searchParams;
  const format = (searchParams.get('format') || 'json') as 'json' | 'csv';

  try {
    // Get portfolio data from request body (client sends their localStorage data)
    let clientPortfolio: {
      holdings?: Array<{ coinId: string; symbol: string; name: string; quantity: number; avgBuyPrice: number }>;
      transactions?: Array<{ id: string; coinId: string; type: 'buy' | 'sell'; quantity: number; price: number; total: number; date: string }>;
    } = {};
    
    try {
      const body = await request.json();
      clientPortfolio = body || {};
    } catch {
      // No body provided - return error
      return NextResponse.json(
        { error: 'Portfolio data required in request body' },
        { status: 400 }
      );
    }
    
    if (!clientPortfolio.holdings || clientPortfolio.holdings.length === 0) {
      return NextResponse.json(
        { error: 'No holdings found in portfolio' },
        { status: 400 }
      );
    }
    
    // Fetch current prices from CoinGecko
    const coinIds = clientPortfolio.holdings.map(h => h.coinId).join(',');
    const pricesRes = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds}&vs_currencies=usd`,
      { next: { revalidate: 60 } }
    );
    
    const prices: Record<string, { usd: number }> = pricesRes.ok 
      ? await pricesRes.json() 
      : {};
    
    // Calculate enriched holdings with current prices
    let totalValue = 0;
    let totalCost = 0;
    
    const enrichedHoldings = clientPortfolio.holdings.map(h => {
      const currentPrice = prices[h.coinId]?.usd || h.avgBuyPrice;
      const value = h.quantity * currentPrice;
      const cost = h.quantity * h.avgBuyPrice;
      const pnl = value - cost;
      const pnlPercent = cost > 0 ? (pnl / cost) * 100 : 0;
      
      totalValue += value;
      totalCost += cost;
      
      return {
        coinId: h.coinId,
        symbol: h.symbol,
        name: h.name,
        quantity: h.quantity,
        avgBuyPrice: h.avgBuyPrice,
        currentPrice,
        value,
        pnl,
        pnlPercent,
        allocation: 0, // Will calculate after totals
      };
    });
    
    // Calculate allocations
    enrichedHoldings.forEach(h => {
      h.allocation = totalValue > 0 ? (h.value / totalValue) * 100 : 0;
    });
    
    const totalPnL = totalValue - totalCost;
    const totalPnLPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

    const exportData: PortfolioExport = {
      format,
      exportedAt: new Date().toISOString(),
      portfolio: {
        totalValue,
        totalCost,
        totalPnL,
        totalPnLPercent,
        holdings: enrichedHoldings,
        transactions: clientPortfolio.transactions || [],
      },
      meta: {
        premium: true,
        generatedBy: 'Crypto Data Aggregator',
        version: '1.0.0',
      },
    };

    if (format === 'csv') {
      // Convert to CSV format
      const headers = [
        'coinId',
        'symbol',
        'name',
        'quantity',
        'avgBuyPrice',
        'currentPrice',
        'value',
        'pnl',
        'pnlPercent',
        'allocation',
      ];
      const rows = exportData.portfolio.holdings.map((h) =>
        [
          h.coinId,
          h.symbol,
          h.name,
          h.quantity,
          h.avgBuyPrice,
          h.currentPrice,
          h.value,
          h.pnl,
          h.pnlPercent,
          h.allocation,
        ].join(',')
      );
      const csv = [headers.join(','), ...rows].join('\n');

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="portfolio-${Date.now()}.csv"`,
        },
      });
    }

    return NextResponse.json(exportData, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="portfolio-${Date.now()}.json"`,
      },
    });
  } catch (error) {
    console.error('Error exporting portfolio:', error);
    return NextResponse.json({ error: 'Failed to export portfolio' }, { status: 500 });
  }
}

/**
 * POST /api/premium/export/portfolio
 *
 * Premium endpoint - requires x402 payment ($0.10)
 * Send portfolio data in request body to export with current prices
 *
 * Query parameters:
 * - format: 'json' | 'csv' (default: 'json')
 * 
 * Body:
 * - holdings: Array of { coinId, symbol, name, quantity, avgBuyPrice }
 * - transactions: Array of transaction history (optional)
 */
export const POST = withX402(handler, getRouteConfig('/api/premium/export/portfolio'), x402Server);

// GET is deprecated - use POST with body data
export const GET = withX402(handler, getRouteConfig('/api/premium/export/portfolio'), x402Server);
