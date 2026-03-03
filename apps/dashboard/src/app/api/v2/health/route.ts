/**
 * Secure API v2 - Health Check
 * 
 * Public endpoint for monitoring API health
 * No authentication required, no source details exposed
 */

import { NextResponse } from 'next/server';
import { checkSourceHealth } from '@/lib/data-sources';
import { getHealthMetrics, logger } from '@/lib/monitoring';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startTime = Date.now();
  
  try {
    const [health, healthMetrics] = await Promise.all([
      checkSourceHealth(),
      Promise.resolve(getHealthMetrics()),
    ]);
    const latency = Date.now() - startTime;
    
    const status = health.healthy ? 'healthy' : 'degraded';
    const httpStatus = health.healthy ? 200 : 503;

    logger.info('Health check completed', { status, latency });
    
    return NextResponse.json(
      {
        status,
        version: '2.0.0',
        uptime: healthMetrics.uptime,
        latency: `${latency}ms`,
        // Intentionally vague about data sources
        dataAvailability: {
          status: health.healthy ? 'operational' : 'partial',
          coverage: `${Math.round((health.availableSources / health.totalSources) * 100)}%`,
        },
        cache: {
          status: 'operational',
        },
        memory: healthMetrics.memory,
        metrics: healthMetrics.requests,
        timestamp: new Date().toISOString(),
      },
      {
        status: httpStatus,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'X-Content-Type-Options': 'nosniff',
        },
      }
    );
  } catch (error) {
    logger.error('Health check failed', error instanceof Error ? error : String(error));
    
    return NextResponse.json(
      {
        status: 'error',
        version: '2.0.0',
        message: 'Health check failed',
        timestamp: new Date().toISOString(),
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-cache',
        },
      }
    );
  }
}
