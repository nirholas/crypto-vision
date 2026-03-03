/**
 * Payment Receipts Endpoint
 *
 * GET /api/premium/receipts
 *
 * Get payment history and receipts for a wallet.
 * Supports pagination and CSV export.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getPaymentHistory,
  getReceipt,
  exportReceipts,
  verifyReceipt,
} from '@/lib/x402/payments';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  // Get wallet address
  const walletAddress =
    request.headers.get('X-Wallet-Address') || searchParams.get('wallet');

  // Get single receipt by ID
  const receiptId = searchParams.get('id');
  if (receiptId) {
    const receipt = await getReceipt(receiptId);

    if (!receipt) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Receipt not found' },
        { status: 404 }
      );
    }

    // Verify if requested
    if (searchParams.get('verify') === 'true') {
      const verification = await verifyReceipt(receiptId);
      return NextResponse.json({
        receipt,
        verification,
      });
    }

    return NextResponse.json({ receipt });
  }

  // Require wallet for history
  if (!walletAddress) {
    return NextResponse.json(
      {
        error: 'Wallet Address Required',
        message: 'Provide X-Wallet-Address header, ?wallet= query param, or ?id= for single receipt',
        examples: [
          'GET /api/premium/receipts?wallet=0x...',
          'GET /api/premium/receipts?id=rcpt_xxx',
          'GET /api/premium/receipts?wallet=0x...&format=csv',
        ],
      },
      { status: 400 }
    );
  }

  // Check for export format
  const format = searchParams.get('format');
  if (format === 'csv') {
    const csv = await exportReceipts(walletAddress, 'csv');
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="receipts-${walletAddress.slice(0, 10)}.csv"`,
      },
    });
  }

  // Get pagination params
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  // Get payment history
  const history = await getPaymentHistory(walletAddress, { limit, offset });

  return NextResponse.json({
    wallet: history.walletAddress,
    summary: {
      totalPayments: history.totalPayments,
      totalSpentUsd: `$${history.totalSpentUsd.toFixed(2)}`,
      currentPeriodPayments: history.currentPeriodPayments,
      currentPeriodSpentUsd: `$${history.currentPeriodSpentUsd.toFixed(2)}`,
      firstPaymentAt: history.firstPaymentAt,
      lastPaymentAt: history.lastPaymentAt,
    },
    receipts: history.receipts,
    pagination: {
      limit,
      offset,
      hasMore: offset + limit < history.totalPayments,
      nextOffset: offset + limit < history.totalPayments ? offset + limit : null,
    },
    export: {
      csv: `/api/premium/receipts?wallet=${walletAddress}&format=csv`,
      json: `/api/premium/receipts?wallet=${walletAddress}&format=json`,
    },
  });
}
