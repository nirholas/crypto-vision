/**
 * Pass Status Endpoint
 *
 * GET /api/premium/pass/status
 *
 * Check the status of your active access pass.
 * Returns pass details, remaining time, and usage stats.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePass, getWalletPasses, getPassStatus, getPassOptions } from '@/lib/x402/passes';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  // Get wallet address from header or query
  const walletAddress =
    request.headers.get('X-Wallet-Address') ||
    request.nextUrl.searchParams.get('wallet');

  if (!walletAddress) {
    // Return available pass options
    return NextResponse.json({
      error: 'Wallet Address Required',
      message: 'Provide X-Wallet-Address header or ?wallet= query param',
      availablePasses: getPassOptions().map((p) => ({
        duration: p.duration,
        name: p.name,
        price: `$${p.priceUsd.toFixed(2)}`,
        description: p.description,
        features: p.features,
        savings: p.savings,
        purchaseUrl: `/api/premium/pass/${p.duration}`,
      })),
    });
  }

  // Get active pass
  const activePass = await getActivePass(walletAddress);

  if (!activePass) {
    // Get past passes
    const pastPasses = await getWalletPasses(walletAddress);

    return NextResponse.json({
      hasActivePass: false,
      message: 'No active pass found',
      wallet: walletAddress,
      pastPasses: pastPasses.slice(0, 5).map((p) => ({
        id: p.id,
        duration: p.duration,
        status: p.status,
        startsAt: p.startsAt,
        expiresAt: p.expiresAt,
        requestCount: p.requestCount,
      })),
      availablePasses: getPassOptions().map((p) => ({
        duration: p.duration,
        name: p.name,
        price: `$${p.priceUsd.toFixed(2)}`,
        purchaseUrl: `/api/premium/pass/${p.duration}`,
      })),
    });
  }

  const status = getPassStatus(activePass);

  return NextResponse.json({
    hasActivePass: true,
    pass: {
      id: activePass.id,
      duration: activePass.duration,
      name: status.config.name,
      startsAt: activePass.startsAt,
      expiresAt: activePass.expiresAt,
      status: activePass.status,
      transactionHash: activePass.transactionHash,
      network: activePass.network,
    },
    time: {
      remainingSeconds: status.remainingSeconds,
      remainingFormatted: status.remainingFormatted,
      progressPercent: Math.round(status.progress),
      isActive: status.isActive,
    },
    usage: {
      requestCount: activePass.requestCount,
      lastRequestAt: activePass.lastRequestAt,
      rateLimit: `${status.config.rateLimit}/min`,
    },
    features: status.config.features,
  });
}
