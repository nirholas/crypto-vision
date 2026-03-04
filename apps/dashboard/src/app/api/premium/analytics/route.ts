/**
 * Payment Analytics Endpoint (Admin)
 *
 * GET /api/premium/analytics
 *
 * Revenue analytics and payment statistics.
 * Requires admin API key.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPaymentStats } from '@/lib/x402/payments';
import { getServerStatus } from '@/lib/x402/server';
import { getSupportedNetworks, PAYMENT_ADDRESS } from '@/lib/x402/config';

export const runtime = 'edge';

// Admin API key check
function isAdmin(request: NextRequest): boolean {
  const apiKey = request.headers.get('X-API-Key');
  const adminKey = process.env.ADMIN_API_KEY;

  if (!adminKey) {
    // In development, allow access
    return process.env.NODE_ENV !== 'production';
  }

  return apiKey === adminKey;
}

export async function GET(request: NextRequest) {
  // Check admin access
  if (!isAdmin(request)) {
    return NextResponse.json(
      { error: 'Forbidden', message: 'Admin access required' },
      { status: 403 }
    );
  }

  const stats = await getPaymentStats();
  const serverStatus = getServerStatus();
  const networks = getSupportedNetworks(true);

  return NextResponse.json({
    revenue: {
      total: {
        amount: stats.totalRevenue,
        formatted: `$${stats.totalRevenue.toFixed(2)}`,
      },
      today: {
        amount: stats.todayRevenue,
        formatted: `$${stats.todayRevenue.toFixed(2)}`,
      },
      week: {
        amount: stats.weekRevenue,
        formatted: `$${stats.weekRevenue.toFixed(2)}`,
      },
      month: {
        amount: stats.monthRevenue,
        formatted: `$${stats.monthRevenue.toFixed(2)}`,
      },
    },
    payments: {
      total: stats.totalPayments,
      uniquePayers: stats.uniquePayers,
      averagePayment: `$${stats.averagePayment.toFixed(4)}`,
    },
    topEndpoints: stats.topEndpoints.map((e) => ({
      endpoint: e.endpoint,
      revenue: `$${e.revenue.toFixed(2)}`,
      requests: e.count,
      averagePerRequest: `$${(e.revenue / e.count).toFixed(4)}`,
    })),
    server: {
      status: serverStatus.status,
      configured: serverStatus.configured,
      facilitator: serverStatus.facilitator,
      primaryNetwork: serverStatus.primaryNetwork,
      paymentAddress: PAYMENT_ADDRESS,
    },
    networks: networks.map((n) => ({
      id: n.id,
      name: n.name,
      testnet: n.testnet,
      recommended: n.recommended,
      gasCost: n.gasCost,
    })),
    generatedAt: new Date().toISOString(),
  });
}
