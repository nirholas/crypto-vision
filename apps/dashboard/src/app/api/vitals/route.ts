/**
 * POST /api/vitals — Web Vitals Ingestion Endpoint
 *
 * Receives client-side Core Web Vitals (LCP, FID, CLS, INP, TTFB)
 * and custom metrics (WS latency, price throughput, long tasks)
 * from the web-vitals.ts client module.
 *
 * Reports are aggregated into the server-side MetricsCollector
 * and surfaced via /api/admin/stats and health checks.
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger, metrics } from '@/lib/monitoring';

// =============================================================================
// TYPES (mirrors web-vitals.ts — kept inline to avoid import issues with
// client-only modules in a server route)
// =============================================================================

interface WebVitalMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  navigationType: string;
  id: string;
}

interface PerformanceReport {
  vitals: WebVitalMetric[];
  custom: Record<string, number>;
  url: string;
  userAgent: string;
  connectionType: string | null;
  deviceMemory: number | null;
  hardwareConcurrency: number;
  timestamp: number;
}

// =============================================================================
// VALIDATION
// =============================================================================

const ALLOWED_VITALS = new Set(['CLS', 'FID', 'INP', 'LCP', 'TTFB']);
const MAX_CUSTOM_METRICS = 50;
const MAX_PAYLOAD_SIZE = 10_000; // 10 KB

function validateReport(data: unknown): data is PerformanceReport {
  if (!data || typeof data !== 'object') return false;
  const report = data as Record<string, unknown>;

  if (!Array.isArray(report.vitals)) return false;
  if (typeof report.custom !== 'object' || report.custom === null) return false;
  if (typeof report.timestamp !== 'number') return false;

  // Validate each vital
  for (const vital of report.vitals as WebVitalMetric[]) {
    if (!ALLOWED_VITALS.has(vital.name)) return false;
    if (typeof vital.value !== 'number' || !isFinite(vital.value)) return false;
    if (!['good', 'needs-improvement', 'poor'].includes(vital.rating)) return false;
  }

  // Validate custom metrics count
  if (Object.keys(report.custom as object).length > MAX_CUSTOM_METRICS) return false;

  return true;
}

// =============================================================================
// HANDLER
// =============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Guard payload size
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_PAYLOAD_SIZE) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }

    const body = await request.json();

    if (!validateReport(body)) {
      return NextResponse.json({ error: 'Invalid report format' }, { status: 400 });
    }

    const report = body as PerformanceReport;

    // Record Core Web Vitals into server metrics
    for (const vital of report.vitals) {
      metrics.histogram(`webvital.${vital.name.toLowerCase()}`, vital.value, {
        rating: vital.rating,
        navType: vital.navigationType,
        url: report.url || '/',
      });

      // Count by rating for quick alerting
      metrics.increment(`webvital.${vital.name.toLowerCase()}.${vital.rating}`, 1, {
        url: report.url || '/',
      });
    }

    // Record custom client metrics
    for (const [name, value] of Object.entries(report.custom)) {
      if (typeof value === 'number' && isFinite(value)) {
        metrics.histogram(`client.${name}`, value, {
          url: report.url || '/',
        });
      }
    }

    // Record device/connection metadata for segmentation
    if (report.connectionType) {
      metrics.increment('client.connection_type', 1, {
        type: report.connectionType,
      });
    }

    logger.debug('Web vitals received', {
      url: report.url,
      vitals: report.vitals.map((v) => `${v.name}=${v.value}(${v.rating})`).join(', '),
      customCount: Object.keys(report.custom).length,
    });

    return NextResponse.json({ ok: true }, { status: 202 });
  } catch (error) {
    logger.error('Failed to process web vitals', error instanceof Error ? error : String(error));
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
