/**
 * Web Vitals & Client-Side Performance Telemetry
 *
 * Collects Core Web Vitals (LCP, FID, CLS, INP, TTFB) and custom
 * metrics (WebSocket latency, price update throughput) and reports
 * them to the server-side metrics collector.
 *
 * Inspired by Pump.fun's approach: they sample JS thread FPS,
 * thermal state, and route metadata via DataDog. We do the
 * equivalent for our Next.js web dashboard.
 *
 * @module web-vitals
 */

// =============================================================================
// TYPES
// =============================================================================

export interface WebVitalMetric {
    /** Metric identifier: CLS, FID, INP, LCP, TTFB, or custom */
    name: string;
    /** Metric value (milliseconds for timing, unitless for CLS) */
    value: number;
    /** Rating: 'good' | 'needs-improvement' | 'poor' */
    rating: 'good' | 'needs-improvement' | 'poor';
    /** Navigation type */
    navigationType: string;
    /** Unique metric ID */
    id: string;
}

export interface PerformanceReport {
    /** Core Web Vitals */
    vitals: WebVitalMetric[];
    /** Custom application metrics */
    custom: Record<string, number>;
    /** Page URL at time of report */
    url: string;
    /** User agent string */
    userAgent: string;
    /** Effective connection type (4g, 3g, etc.) */
    connectionType: string | null;
    /** Device memory in GB (if available) */
    deviceMemory: number | null;
    /** Hardware concurrency (CPU cores) */
    hardwareConcurrency: number;
    /** Timestamp of the report */
    timestamp: number;
}

// =============================================================================
// THRESHOLDS (from web.dev)
// =============================================================================

const THRESHOLDS: Record<string, [number, number]> = {
    CLS: [0.1, 0.25],
    FID: [100, 300],
    INP: [200, 500],
    LCP: [2500, 4000],
    TTFB: [800, 1800],
};

function rateMetric(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
    const thresholds = THRESHOLDS[name];
    if (!thresholds) return 'good';
    if (value <= thresholds[0]) return 'good';
    if (value <= thresholds[1]) return 'needs-improvement';
    return 'poor';
}

// =============================================================================
// METRIC BUFFER
// =============================================================================

const collectedVitals: WebVitalMetric[] = [];
const customMetrics: Record<string, number[]> = {};
let reportScheduled = false;

/**
 * Record a custom performance metric (e.g., WebSocket connect time).
 * Values are averaged when the report is flushed.
 */
export function recordCustomMetric(name: string, value: number): void {
    if (!customMetrics[name]) {
        customMetrics[name] = [];
    }
    customMetrics[name].push(value);

    // Cap at 100 samples per metric to bound memory
    if (customMetrics[name].length > 100) {
        customMetrics[name] = customMetrics[name].slice(-100);
    }

    scheduleReport();
}

/**
 * Record WebSocket round-trip latency.
 * Call this after each ping/pong cycle.
 */
export function recordWsLatency(latencyMs: number): void {
    recordCustomMetric('ws.latency', latencyMs);
}

/**
 * Record price update throughput (updates per second).
 */
export function recordPriceUpdateRate(updatesPerSecond: number): void {
    recordCustomMetric('price.update_rate', updatesPerSecond);
}

/**
 * Record time from navigation start to first meaningful price render.
 */
export function recordTimeToFirstPrice(ms: number): void {
    recordCustomMetric('price.time_to_first', ms);
}

// =============================================================================
// CORE WEB VITALS COLLECTION
// =============================================================================

/**
 * Initialize Web Vitals collection.
 * Call once from a client component (e.g., in the root layout effect).
 *
 * Uses the native PerformanceObserver API so we don't need the
 * `web-vitals` npm package — zero extra bundle bytes.
 */
export function initWebVitals(): void {
    if (typeof window === 'undefined') return;
    if (typeof PerformanceObserver === 'undefined') return;

    // LCP — Largest Contentful Paint
    observeEntries('largest-contentful-paint', (entries) => {
        const last = entries[entries.length - 1] as PerformanceLargestContentfulPaintEntry;
        if (last) {
            pushVital('LCP', last.startTime);
        }
    });

    // FID — First Input Delay
    observeEntries('first-input', (entries) => {
        const first = entries[0] as PerformanceEventTiming;
        if (first) {
            pushVital('FID', first.processingStart - first.startTime);
        }
    });

    // CLS — Cumulative Layout Shift
    let clsValue = 0;
    observeEntries('layout-shift', (entries) => {
        for (const entry of entries) {
            const lsEntry = entry as PerformanceEntry & { hadRecentInput: boolean; value: number };
            if (!lsEntry.hadRecentInput) {
                clsValue += lsEntry.value;
            }
        }
        pushVital('CLS', clsValue);
    });

    // INP — Interaction to Next Paint
    let inpValue = 0;
    observeEntries('event', (entries) => {
        for (const entry of entries) {
            const eventEntry = entry as PerformanceEventTiming;
            const duration = eventEntry.duration;
            if (duration > inpValue) {
                inpValue = duration;
                pushVital('INP', inpValue);
            }
        }
    }, { durationThreshold: 40 });

    // TTFB — Time to First Byte (from Navigation Timing)
    const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (navEntry) {
        pushVital('TTFB', navEntry.responseStart - navEntry.requestStart);
    }

    // Long Tasks (>50ms) — indicator of JS thread congestion
    observeEntries('longtask', (entries) => {
        for (const entry of entries) {
            recordCustomMetric('longtask.duration', entry.duration);
        }
    });
}

// =============================================================================
// PerformanceObserver TYPE EXTENSIONS
// =============================================================================

interface PerformanceLargestContentfulPaintEntry extends PerformanceEntry {
    renderTime: number;
    loadTime: number;
    size: number;
    id: string;
    url: string;
    element: Element | null;
}

interface PerformanceEventTiming extends PerformanceEntry {
    processingStart: number;
    processingEnd: number;
    cancelable: boolean;
    target: EventTarget | null;
}

// =============================================================================
// INTERNALS
// =============================================================================

let vitalIdCounter = 0;

function pushVital(name: string, value: number): void {
    // Replace existing entry for the same metric (they refine over time)
    const idx = collectedVitals.findIndex((v) => v.name === name);
    const metric: WebVitalMetric = {
        name,
        value: Math.round(value * 100) / 100,
        rating: rateMetric(name, value),
        navigationType: getNavigationType(),
        id: `v${++vitalIdCounter}-${Date.now().toString(36)}`,
    };

    if (idx >= 0) {
        collectedVitals[idx] = metric;
    } else {
        collectedVitals.push(metric);
    }

    scheduleReport();
}

function getNavigationType(): string {
    if (typeof window === 'undefined') return 'unknown';
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    return nav?.type || 'navigate';
}

function observeEntries(
    type: string,
    callback: (entries: PerformanceEntryList) => void,
    options: Record<string, unknown> = {},
): void {
    try {
        const observer = new PerformanceObserver((list) => {
            callback(list.getEntries());
        });
        observer.observe({ type, buffered: true, ...options });
    } catch {
        // Entry type not supported in this browser — silently skip
    }
}

// =============================================================================
// REPORTING
// =============================================================================

const REPORT_DELAY_MS = 10_000; // Buffer for 10s before sending
const REPORT_ENDPOINT = '/api/vitals'; // POST endpoint on our Next.js server

function scheduleReport(): void {
    if (reportScheduled) return;
    reportScheduled = true;

    // Use requestIdleCallback if available for minimal main-thread impact
    const schedule = typeof requestIdleCallback !== 'undefined' ? requestIdleCallback : setTimeout;
    schedule(() => {
        setTimeout(flushReport, REPORT_DELAY_MS);
    });
}

function flushReport(): void {
    reportScheduled = false;

    if (collectedVitals.length === 0 && Object.keys(customMetrics).length === 0) return;

    const aggregatedCustom: Record<string, number> = {};
    for (const [key, values] of Object.entries(customMetrics)) {
        if (values.length === 0) continue;
        aggregatedCustom[key] = Math.round(
            (values.reduce((a, b) => a + b, 0) / values.length) * 100,
        ) / 100;
    }

    const nav = typeof navigator !== 'undefined' ? navigator : null;
    const conn = (nav as Navigator & { connection?: { effectiveType?: string } })?.connection;

    const report: PerformanceReport = {
        vitals: [...collectedVitals],
        custom: aggregatedCustom,
        url: typeof location !== 'undefined' ? location.pathname : '',
        userAgent: nav?.userAgent ?? '',
        connectionType: conn?.effectiveType ?? null,
        deviceMemory: (nav as Navigator & { deviceMemory?: number })?.deviceMemory ?? null,
        hardwareConcurrency: nav?.hardwareConcurrency ?? 0,
        timestamp: Date.now(),
    };

    // Send via sendBeacon (survives page unload) with fetch fallback
    const payload = JSON.stringify(report);

    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        const sent = navigator.sendBeacon(
            REPORT_ENDPOINT,
            new Blob([payload], { type: 'application/json' }),
        );
        if (sent) return;
    }

    // Fallback: fire-and-forget fetch
    fetch(REPORT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
    }).catch(() => {
        // Silently drop — telemetry should never break the app
    });
}

// Flush on page hide (tab switch / close)
if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            flushReport();
        }
    });
}
