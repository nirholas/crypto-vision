import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { isKvConfigured, ApiKeyData, API_KEY_TIERS } from '@/lib/api-keys';
import { requireAdminAuth } from '@/lib/admin-auth';

export const runtime = 'nodejs';

interface KeyStats {
  total: number;
  byTier: {
    free: number;
    pro: number;
    enterprise: number;
  };
  active24h: number;
  active7d: number;
  active30d: number;
  totalRequestsToday: number;
  totalRequestsMonth: number;
  topKeys: {
    id: string;
    keyPrefix: string;
    email: string;
    tier: string;
    usageToday: number;
    usageMonth: number;
    lastUsedAt?: string;
  }[];
  usageByDay: {
    date: string;
    requests: number;
  }[];
}

async function getAllApiKeys(): Promise<ApiKeyData[]> {
  if (!isKvConfigured()) {
    return [];
  }

  try {
    // Scan for all API keys
    const keys: ApiKeyData[] = [];
    let cursor: string | number = 0;

    do {
      const result = await kv.scan(cursor, { match: 'apikey:*', count: 100 });
      cursor = result[0] as string | number;
      const keyNames = result[1] as string[];

      for (const keyName of keyNames) {
        // Skip reverse lookup keys
        if (keyName.includes(':id:')) continue;

        const keyData = await kv.get<ApiKeyData>(keyName);
        if (keyData && keyData.id) {
          keys.push(keyData);
        }
      }
    } while (cursor !== 0);

    return keys;
  } catch (error) {
    console.error('Failed to fetch API keys:', error);
    return [];
  }
}

async function getUsageHistory(): Promise<{ date: string; requests: number }[]> {
  if (!isKvConfigured()) {
    return [];
  }

  try {
    const history: { date: string; requests: number }[] = [];
    const today = new Date();

    // Get last 30 days of usage
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      // Scan for all usage keys for this date
      let totalRequests = 0;
      let cursor: string | number = 0;

      do {
        const result = await kv.scan(cursor, { match: `usage:*:${dateStr}`, count: 100 });
        cursor = result[0] as string | number;
        const usageKeys = result[1] as string[];

        for (const usageKey of usageKeys) {
          const count = await kv.get<number>(usageKey);
          if (count) {
            totalRequests += count;
          }
        }
      } while (cursor !== 0);

      history.push({ date: dateStr, requests: totalRequests });
    }

    return history.reverse();
  } catch (error) {
    console.error('Failed to fetch usage history:', error);
    return [];
  }
}

export async function GET(request: NextRequest) {
  const authError = requireAdminAuth(request);
  if (authError) return authError;

  try {
    const keys = await getAllApiKeys();
    const usageHistory = await getUsageHistory();

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Calculate statistics
    const stats: KeyStats = {
      total: keys.length,
      byTier: {
        free: keys.filter((k) => k.tier === 'free').length,
        pro: keys.filter((k) => k.tier === 'pro').length,
        enterprise: keys.filter((k) => k.tier === 'enterprise').length,
      },
      active24h: keys.filter((k) => k.lastUsedAt && new Date(k.lastUsedAt) > oneDayAgo).length,
      active7d: keys.filter((k) => k.lastUsedAt && new Date(k.lastUsedAt) > sevenDaysAgo).length,
      active30d: keys.filter((k) => k.lastUsedAt && new Date(k.lastUsedAt) > thirtyDaysAgo).length,
      totalRequestsToday: keys.reduce((sum, k) => sum + (k.usageToday || 0), 0),
      totalRequestsMonth: keys.reduce((sum, k) => sum + (k.usageMonth || 0), 0),
      topKeys: keys
        .filter((k) => k.active)
        .sort((a, b) => (b.usageMonth || 0) - (a.usageMonth || 0))
        .slice(0, 10)
        .map((k) => ({
          id: k.id,
          keyPrefix: k.keyPrefix,
          email: k.email,
          tier: k.tier,
          usageToday: k.usageToday || 0,
          usageMonth: k.usageMonth || 0,
          lastUsedAt: k.lastUsedAt,
        })),
      usageByDay: usageHistory,
    };

    // Calculate tier limits for context
    const tierLimits = {
      free: API_KEY_TIERS.free.requestsPerDay,
      pro: API_KEY_TIERS.pro.requestsPerDay,
      enterprise: API_KEY_TIERS.enterprise.requestsPerDay,
    };

    return NextResponse.json({
      stats,
      tierLimits,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch statistics' }, { status: 500 });
  }
}
