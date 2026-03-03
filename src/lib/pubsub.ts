/**
 * Crypto Vision — Portable Pub/Sub Publisher
 *
 * Production-grade Google Cloud Pub/Sub client with:
 * - Automatic batching (100 messages / 1s / 1MB flush thresholds)
 * - Topic-level caching to avoid repeated lookups
 * - Graceful degradation: returns silently when GCP_PROJECT_ID is unset
 * - Works with the Pub/Sub emulator for local development
 * - Structured logging for observability
 * - Metrics tracking (published count, errors, latency)
 *
 * Pub/Sub is supplementary — the API works without it.
 * Set GCP_PROJECT_ID or PUBSUB_EMULATOR_HOST to enable.
 */

import { PubSub, type Topic } from "@google-cloud/pubsub";
import { log } from "./logger.js";

// ── Constants ────────────────────────────────────────────

const BATCH_SETTINGS = {
    maxMessages: 100,
    maxMilliseconds: 1_000, // Flush every 1s
    maxBytes: 1_024 * 1_024, // 1MB
};

// ── Metrics ──────────────────────────────────────────────

interface PubSubMetrics {
    totalPublished: number;
    totalErrors: number;
    totalBatches: number;
    lastPublishAt: number;
    latencySum: number;
    latencyCount: number;
}

const metrics: PubSubMetrics = {
    totalPublished: 0,
    totalErrors: 0,
    totalBatches: 0,
    lastPublishAt: 0,
    latencySum: 0,
    latencyCount: 0,
};

// ── Client Singleton ─────────────────────────────────────

let pubsub: PubSub | null = null;
let initAttempted = false;
const topicCache = new Map<string, Topic>();

function getClient(): PubSub | null {
    if (pubsub) return pubsub;
    if (initAttempted) return null;

    initAttempted = true;

    // Support emulator for local dev or real GCP
    const emulatorHost = process.env.PUBSUB_EMULATOR_HOST;
    const projectId = process.env.GCP_PROJECT_ID;

    if (!projectId && !emulatorHost) {
        log.info("[pubsub] GCP_PROJECT_ID and PUBSUB_EMULATOR_HOST not set — Pub/Sub disabled");
        return null;
    }

    try {
        pubsub = new PubSub({
            projectId: projectId || "local-dev",
        });
        log.info(
            { projectId: projectId || "local-dev", emulator: !!emulatorHost },
            "[pubsub] Client initialized",
        );
        return pubsub;
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        log.warn({ err: message }, "[pubsub] Failed to initialize client");
        return null;
    }
}

function getTopic(name: string): Topic | null {
    const client = getClient();
    if (!client) return null;

    const cached = topicCache.get(name);
    if (cached) return cached;

    const topic = client.topic(name, { batching: BATCH_SETTINGS });
    topicCache.set(name, topic);
    return topic;
}

// ── Topic Names ──────────────────────────────────────────

export const Topics = {
    REALTIME: "crypto-vision-realtime",
    FREQUENT: "crypto-vision-frequent",
    STANDARD: "crypto-vision-standard",
    HOURLY: "crypto-vision-hourly",
    DAILY: "crypto-vision-daily",
} as const;

export type TopicName = (typeof Topics)[keyof typeof Topics];

// ── Publish ──────────────────────────────────────────────

/**
 * Publish a single message to a Pub/Sub topic.
 *
 * Returns silently if Pub/Sub is unavailable (no GCP project set).
 * Never throws — failures are logged as warnings.
 */
export async function publish(
    topicName: string,
    data: Record<string, unknown>,
    attributes?: Record<string, string>,
): Promise<void> {
    const topic = getTopic(topicName);
    if (!topic) return;

    const start = Date.now();
    try {
        await topic.publishMessage({
            json: data,
            attributes: {
                source: String(data.source ?? "unknown"),
                timestamp: new Date().toISOString(),
                ...attributes,
            },
        });

        metrics.totalPublished++;
        metrics.lastPublishAt = Date.now();
        metrics.latencySum += Date.now() - start;
        metrics.latencyCount++;
    } catch (err: unknown) {
        metrics.totalErrors++;
        const message = err instanceof Error ? err.message : String(err);
        log.warn({ err: message, topic: topicName }, "[pubsub] Publish failed");
    }
}

/**
 * Publish a batch of messages to a Pub/Sub topic.
 *
 * Uses Promise.allSettled to ensure partial failures don't
 * prevent delivery of other messages. Returns silently if
 * Pub/Sub is unavailable.
 */
export async function publishBatch(
    topicName: string,
    items: Record<string, unknown>[],
    attributes?: Record<string, string>,
): Promise<void> {
    const topic = getTopic(topicName);
    if (!topic || items.length === 0) return;

    const start = Date.now();
    metrics.totalBatches++;

    const results = await Promise.allSettled(
        items.map((data) =>
            topic.publishMessage({
                json: data,
                attributes: {
                    source: String(data.source ?? "unknown"),
                    timestamp: new Date().toISOString(),
                    ...attributes,
                },
            }),
        ),
    );

    let succeeded = 0;
    let failed = 0;
    for (const result of results) {
        if (result.status === "fulfilled") {
            succeeded++;
        } else {
            failed++;
            log.warn({ err: result.reason?.message }, "[pubsub] Batch item failed");
        }
    }

    metrics.totalPublished += succeeded;
    metrics.totalErrors += failed;
    metrics.lastPublishAt = Date.now();
    metrics.latencySum += Date.now() - start;
    metrics.latencyCount++;

    log.debug(
        { topic: topicName, succeeded, failed, durationMs: Date.now() - start },
        "[pubsub] Batch publish complete",
    );
}

// ── Metrics ──────────────────────────────────────────────

/**
 * Return current Pub/Sub publish metrics for observability.
 */
export function getPubSubMetrics(): {
    enabled: boolean;
    totalPublished: number;
    totalErrors: number;
    totalBatches: number;
    avgLatencyMs: number;
    lastPublishAt: string | null;
} {
    return {
        enabled: getClient() !== null,
        totalPublished: metrics.totalPublished,
        totalErrors: metrics.totalErrors,
        totalBatches: metrics.totalBatches,
        avgLatencyMs:
            metrics.latencyCount > 0
                ? Math.round(metrics.latencySum / metrics.latencyCount)
                : 0,
        lastPublishAt:
            metrics.lastPublishAt > 0
                ? new Date(metrics.lastPublishAt).toISOString()
                : null,
    };
}

// ── Cleanup ──────────────────────────────────────────────

/**
 * Flush all pending messages and close the client.
 * Call this during graceful shutdown.
 */
export async function closePubSub(): Promise<void> {
    if (pubsub) {
        // Flush pending batches for all cached topics
        const flushPromises: Promise<void>[] = [];
        for (const [, topic] of topicCache) {
            flushPromises.push(topic.flush().catch(() => { }));
        }
        await Promise.allSettled(flushPromises);

        await pubsub.close().catch(() => { });
        pubsub = null;
        initAttempted = false;
        topicCache.clear();
        log.info("[pubsub] Client closed and flushed");
    }
}
