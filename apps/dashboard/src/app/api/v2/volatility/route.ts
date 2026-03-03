/**
 * Secure API v2 - Volatility & Risk Metrics
 * 
 * Returns volatility analysis including Sharpe ratio, 
 * max drawdown, and risk classification
 */

import { NextRequest, NextResponse } from 'next/server';
import { hybridAuthMiddleware } from '@/lib/x402';
import { getVolatilityMetrics, DataSourceError } from '@/lib/data-sources';
import { validateQuery, volatilityQuerySchema, validationErrorResponse } from '@/lib/api-schemas';
import { createRequestContext, completeRequest } from '@/lib/monitoring';
import { checkRateLimit, addRateLimitHeaders, rateLimitResponse } from '@/lib/rate-limit';

const ENDPOINT = '/api/v2/volatility';

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200',
};

// Default coins for volatility analysis
const DEFAULT_COINS = ['bitcoin', 'ethereum', 'solana', 'cardano', 'ripple', 'dogecoin', 'polkadot', 'avalanche-2'];

export async function GET(request: NextRequest) {
  const ctx = createRequestContext(ENDPOINT);
  
  // Check rate limit
  const rateLimitResult = checkRateLimit(request);
  if (!rateLimitResult.allowed) {
    completeRequest(ctx, 429);
    return rateLimitResponse(rateLimitResult);
  }
  
  const authResponse = await hybridAuthMiddleware(request, ENDPOINT);
  if (authResponse) {
    completeRequest(ctx, 401);
    return authResponse;
  }

  const validation = validateQuery(request, volatilityQuerySchema);
  if (!validation.success) {
    completeRequest(ctx, 400, validation.error);
    return validationErrorResponse(validation.error, validation.details);
  }

  const ids = validation.data.ids?.slice(0, 10) || DEFAULT_COINS;

  try {
    const metricsData = await getVolatilityMetrics(ids);

    // Calculate market-wide stats
    const avgVolatility = metricsData.reduce((sum, m) => sum + m.volatility30d, 0) / metricsData.length;
    const highRiskCount = metricsData.filter(m => m.riskLevel === 'high' || m.riskLevel === 'extreme').length;

    completeRequest(ctx, 200);

    const response = NextResponse.json(
      {
        success: true,
        data: {
          metrics: metricsData,
          summary: {
            averageVolatility30d: Math.round(avgVolatility * 10) / 10,
            highRiskAssets: highRiskCount,
            totalAnalyzed: metricsData.length,
            riskDistribution: {
              low: metricsData.filter(m => m.riskLevel === 'low').length,
              medium: metricsData.filter(m => m.riskLevel === 'medium').length,
              high: metricsData.filter(m => m.riskLevel === 'high').length,
              extreme: metricsData.filter(m => m.riskLevel === 'extreme').length,
            },
          },
        },
        meta: {
          endpoint: ENDPOINT,
          requestId: ctx.requestId,
          coins: ids,
          timestamp: new Date().toISOString(),
          methodology: {
            volatility: 'Annualized standard deviation of daily returns',
            sharpeRatio: 'Risk-adjusted return (assuming 5% risk-free rate)',
            maxDrawdown: 'Largest peak-to-trough decline in 30 days',
            beta: 'Volatility relative to Bitcoin',
          },
        },
      },
      { headers: SECURITY_HEADERS }
    );
    
    return addRateLimitHeaders(response, rateLimitResult);
  } catch (error) {
    const message = error instanceof DataSourceError 
      ? error.message 
      : 'Volatility data unavailable';

    completeRequest(ctx, 503, error instanceof Error ? error : message);

    return NextResponse.json(
      {
        success: false,
        error: message,
        code: 'SERVICE_UNAVAILABLE',
        requestId: ctx.requestId,
      },
      { status: 503, headers: SECURITY_HEADERS }
    );
  }
}
