/**
 * @fileoverview Analytics Tracking (Privacy-Focused)
 * 
 * Anonymous analytics for understanding usage patterns.
 * No personal data is collected. No cookies used.
 * 
 * @module lib/analytics
 */

interface AnalyticsEvent {
  event: string;
  properties?: Record<string, string | number | boolean>;
}

// Queue for events when offline
const eventQueue: AnalyticsEvent[] = [];

// Whether to send analytics (respects Do Not Track)
let analyticsEnabled = true;

/**
 * Initialize analytics
 */
export function initAnalytics(): void {
  if (typeof window === 'undefined') return;
  
  // Respect Do Not Track
  if (navigator.doNotTrack === '1' || (navigator as unknown as { globalPrivacyControl: boolean }).globalPrivacyControl) {
    analyticsEnabled = false;
    return;
  }
  
  // Check user preference
  try {
    const pref = localStorage.getItem('analytics-enabled');
    if (pref === 'false') {
      analyticsEnabled = false;
    }
  } catch {
    // Ignore
  }
  
  // Track page view
  trackPageView();
}

/**
 * Track a page view
 */
export function trackPageView(): void {
  if (!analyticsEnabled) return;
  
  track('page_view', {
    path: window.location.pathname,
    referrer: document.referrer || 'direct',
  });
}

/**
 * Track an event
 */
export function track(event: string, properties?: Record<string, string | number | boolean>): void {
  if (!analyticsEnabled) return;
  
  const payload: AnalyticsEvent = {
    event,
    properties: {
      ...properties,
      timestamp: Date.now(),
      // Anonymous session ID (changes on each visit)
      session: getSessionId(),
    },
  };
  
  // If offline, queue the event
  if (!navigator.onLine) {
    eventQueue.push(payload);
    return;
  }
  
  // Send to analytics endpoint (would need backend implementation)
  // For now, just log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[Analytics]', event, properties);
  }
}

/**
 * Get or create a session ID (anonymous, changes each visit)
 */
function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  
  let sessionId = sessionStorage.getItem('analytics-session');
  if (!sessionId) {
    sessionId = Math.random().toString(36).substring(2, 15);
    sessionStorage.setItem('analytics-session', sessionId);
  }
  return sessionId;
}

/**
 * Track article view
 */
export function trackArticleView(articleId: string, source: string): void {
  track('article_view', { articleId, source });
}

/**
 * Track search
 */
export function trackSearch(query: string, resultCount: number): void {
  track('search', { query: query.substring(0, 50), resultCount });
}

/**
 * Track category view
 */
export function trackCategoryView(category: string): void {
  track('category_view', { category });
}

/**
 * Track bookmark action
 */
export function trackBookmark(articleId: string, action: 'add' | 'remove'): void {
  track('bookmark', { articleId, action });
}

/**
 * Track share action
 */
export function trackShare(articleId: string, method: string): void {
  track('share', { articleId, method });
}

/**
 * Track theme change
 */
export function trackThemeChange(theme: string): void {
  track('theme_change', { theme });
}

/**
 * Track feature usage
 */
export function trackFeature(feature: string): void {
  track('feature_use', { feature });
}

/**
 * Opt out of analytics
 */
export function optOutAnalytics(): void {
  analyticsEnabled = false;
  try {
    localStorage.setItem('analytics-enabled', 'false');
  } catch {
    // Ignore
  }
}

/**
 * Opt in to analytics
 */
export function optInAnalytics(): void {
  analyticsEnabled = true;
  try {
    localStorage.setItem('analytics-enabled', 'true');
  } catch {
    // Ignore
  }
}

/**
 * Check if analytics is enabled
 */
export function isAnalyticsEnabled(): boolean {
  return analyticsEnabled;
}

// In-memory API metrics (reset on server restart)
const apiMetrics = {
  totalRequests: 0,
  totalErrors: 0,
  totalResponseTime: 0,
  requestsPerEndpoint: new Map<string, number>(),
  startTime: Date.now(),
};

/**
 * Track API call (server-side)
 */
export function trackAPICall(data: {
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  userAgent?: string;
  ip?: string;
  timestamp?: Date;
}): void {
  // Update in-memory metrics
  apiMetrics.totalRequests++;
  apiMetrics.totalResponseTime += data.responseTime;
  
  if (data.statusCode >= 400) {
    apiMetrics.totalErrors++;
  }
  
  const key = `${data.method}:${data.endpoint}`;
  apiMetrics.requestsPerEndpoint.set(
    key, 
    (apiMetrics.requestsPerEndpoint.get(key) || 0) + 1
  );
  
  // Server-side logging in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[API]', data.method, data.endpoint, `${data.responseTime}ms`, data.statusCode);
  }
}

/**
 * Get dashboard stats (server-side)
 * Uses real in-memory metrics from API calls
 */
export function getDashboardStats(): Record<string, number | string> {
  const uptimeMs = Date.now() - apiMetrics.startTime;
  const uptimeHours = Math.floor(uptimeMs / (1000 * 60 * 60));
  const uptimeDays = Math.floor(uptimeHours / 24);
  
  return {
    totalRequests: apiMetrics.totalRequests,
    totalErrors: apiMetrics.totalErrors,
    avgResponseTime: apiMetrics.totalRequests > 0 
      ? Math.round(apiMetrics.totalResponseTime / apiMetrics.totalRequests) 
      : 0,
    errorRate: apiMetrics.totalRequests > 0 
      ? Math.round((apiMetrics.totalErrors / apiMetrics.totalRequests) * 100 * 100) / 100 
      : 0,
    uptime: uptimeDays > 0 ? `${uptimeDays}d ${uptimeHours % 24}h` : `${uptimeHours}h`,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Get system health (server-side)
 * Provides real system metrics
 */
export async function getSystemHealth(): Promise<Record<string, unknown>> {
  const memoryUsage = process.memoryUsage?.() || { heapUsed: 0, heapTotal: 0, rss: 0 };
  const cpuUsage = process.cpuUsage?.() || { user: 0, system: 0 };
  
  // Check service health
  const services: Record<string, string> = {
    api: 'up',
  };
  
  // Check storage
  try {
    const { isPersistentStorage, getStats } = await import('@/lib/storage');
    if (isPersistentStorage()) {
      const stats = await getStats();
      services.cache = stats.connected ? 'up' : 'down';
    } else {
      services.cache = 'memory-only';
    }
  } catch {
    services.cache = 'unknown';
  }
  
  // Calculate health status
  const healthyServices = Object.values(services).filter(s => s === 'up' || s === 'memory-only').length;
  const totalServices = Object.keys(services).length;
  const status = healthyServices === totalServices ? 'healthy' 
    : healthyServices > totalServices / 2 ? 'degraded' 
    : 'unhealthy';
  
  return {
    status,
    services,
    memory: {
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      rss: memoryUsage.rss,
      heapUsedMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(memoryUsage.heapTotal / 1024 / 1024),
    },
    cpu: cpuUsage,
    uptime: process.uptime?.() || 0,
    nodeVersion: process.version,
    timestamp: new Date().toISOString(),
  };
}

// Flush queue when back online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    while (eventQueue.length > 0) {
      const event = eventQueue.shift();
      if (event) {
        track(event.event, event.properties);
      }
    }
  });
}
