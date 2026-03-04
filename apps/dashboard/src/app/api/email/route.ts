/**
 * Email Notification Routes
 * 
 * Send and manage email notifications
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookie } from '@/lib/auth';
import {
  sendPriceAlert,
  sendNewsAlert,
  sendPortfolioDigest,
  sendWeeklyDigest,
  type PriceAlertData,
  type NewsAlertData,
  type PortfolioSummary,
  type MarketDigest,
} from '@/lib/email';

export const runtime = 'nodejs';

// Rate limiting by IP
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const limit = rateLimits.get(ip);
  
  if (!limit || now > limit.resetAt) {
    rateLimits.set(ip, { count: 1, resetAt: now + 60000 });
    return true;
  }
  
  if (limit.count >= 10) {
    return false;
  }
  
  limit.count++;
  return true;
}

// =============================================================================
// POST - Send notification emails
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    // Check rate limit
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    const session = await getSessionFromCookie();
    const body = await request.json();
    const { type, ...data } = body;

    // Public endpoint for webhook-triggered notifications
    // Validate API key for external calls
    const apiKey = request.headers.get('x-api-key');
    const validApiKey = process.env.INTERNAL_API_KEY;

    // Require either session or valid API key
    if (!session && apiKey !== validApiKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    switch (type) {
      case 'price-alert': {
        const { to, coinName, coinSymbol, currentPrice, targetPrice, condition, changePercent, alertId } = data;
        
        if (!to || !coinSymbol || !currentPrice === undefined || !condition) {
          return NextResponse.json(
            { error: 'Missing required fields for price alert' },
            { status: 400 }
          );
        }

        const alertData: PriceAlertData = {
          coinName: coinName || coinSymbol,
          coinSymbol,
          currentPrice,
          targetPrice: targetPrice || currentPrice,
          condition,
          changePercent,
          alertId: alertId || `alert_${Date.now()}`,
        };

        const result = await sendPriceAlert(to, alertData);

        return NextResponse.json(result);
      }

      case 'news-alert': {
        const { to, articles, keyword, alertId } = data;
        
        if (!to || !articles || !Array.isArray(articles)) {
          return NextResponse.json(
            { error: 'Missing required fields for news alert' },
            { status: 400 }
          );
        }

        const alertData: NewsAlertData = {
          keyword: keyword || 'crypto news',
          articles,
          alertId: alertId || `news_${Date.now()}`,
        };

        const result = await sendNewsAlert(to, alertData);
        return NextResponse.json(result);
      }

      case 'portfolio-digest': {
        const { to, holdings, totalValue, change24h, changePercent } = data;
        
        if (!to || !holdings || totalValue === undefined) {
          return NextResponse.json(
            { error: 'Missing required fields for portfolio digest' },
            { status: 400 }
          );
        }

        const portfolioData: PortfolioSummary = {
          totalValue,
          change24h: change24h || 0,
          changePercent24h: changePercent || 0,
          topGainers: [],
          topLosers: [],
          holdings,
        };

        const result = await sendPortfolioDigest(to, portfolioData);

        return NextResponse.json(result);
      }

      case 'weekly-digest': {
        const { to, marketCap, marketCapChange, btcDominance, fearGreedIndex, topMovers, topNews, weeklyHighlights } = data;
        
        if (!to) {
          return NextResponse.json(
            { error: 'Missing required fields for weekly digest' },
            { status: 400 }
          );
        }

        const digestData: MarketDigest = {
          marketCap: marketCap || 0,
          marketCapChange: marketCapChange || 0,
          btcDominance: btcDominance || 0,
          fearGreedIndex: fearGreedIndex || 50,
          topMovers: topMovers || [],
          topNews: topNews || [],
          weeklyHighlights: weeklyHighlights || [],
        };

        const result = await sendWeeklyDigest(to, digestData);

        return NextResponse.json(result);
      }

      default:
        return NextResponse.json(
          { error: 'Invalid notification type' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Email notification error:', error);
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET - Email API info and status
// =============================================================================

export async function GET() {
  const isConfigured = !!process.env.RESEND_API_KEY;
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  return NextResponse.json({
    message: 'Email notification API',
    status: isConfigured ? 'configured' : (isDevelopment ? 'dev-mode' : 'not-configured'),
    configured: isConfigured,
    fallbackEnabled: isDevelopment && !isConfigured,
    supportedTypes: ['price-alert', 'news-alert', 'portfolio-digest', 'weekly-digest'],
    documentation: '/docs/api#email-notifications',
    note: !isConfigured 
      ? 'Set RESEND_API_KEY environment variable to enable email sending. In development, emails are logged to console.' 
      : undefined,
  });
}
