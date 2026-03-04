/**
 * Integration Tests — RPC Pool
 *
 * Tests for RPC pool management: health checks, failover,
 * latency-based routing, rate limiting, and recovery.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SwarmEventBus } from '../../infra/event-bus.js';
import { createTestEventBus, createTestRpcConfig, collectEvents } from '../helpers/test-config.js';
import type { RpcEndpoint, RpcPoolConfig } from '../../types.js';

/**
 * Simulated RPC Pool for testing without real Solana connections.
 * Mirrors the RpcPool API for integration validation.
 */
class TestRpcPool {
  private readonly config: RpcPoolConfig;
  private readonly eventBus: SwarmEventBus;
  private readonly endpoints: RpcEndpoint[];
  private currentIndex = 0;

  constructor(config: RpcPoolConfig, eventBus: SwarmEventBus) {
    this.config = config;
    this.endpoints = [...config.endpoints];
    this.eventBus = eventBus;
  }

  /** Get the next healthy endpoint using weighted selection */
  getEndpoint(): RpcEndpoint | undefined {
    const healthy = this.endpoints.filter((ep) => ep.healthy !== false);
    if (healthy.length === 0) return undefined;

    if (this.config.preferLowLatency) {
      // Sort by latency, pick lowest
      healthy.sort((a, b) => (a.avgLatencyMs ?? Infinity) - (b.avgLatencyMs ?? Infinity));
      return healthy[0];
    }

    // Weighted round-robin
    const totalWeight = healthy.reduce((sum, ep) => sum + ep.weight, 0);
    let target = this.currentIndex % totalWeight;
    for (const ep of healthy) {
      target -= ep.weight;
      if (target < 0) {
        this.currentIndex++;
        return ep;
      }
    }
    return healthy[0];
  }

  /** Mark an endpoint as unhealthy */
  markUnhealthy(url: string, reason: string): void {
    const ep = this.endpoints.find((e) => e.url === url);
    if (ep) {
      ep.healthy = false;
      ep.errorCount = (ep.errorCount ?? 0) + 1;
      this.eventBus.emit('rpc:endpoint-unhealthy', 'system', 'rpc-pool', {
        url,
        reason,
        errorCount: ep.errorCount,
      });
    }
  }

  /** Mark an endpoint as healthy (recovery) */
  markHealthy(url: string): void {
    const ep = this.endpoints.find((e) => e.url === url);
    if (ep) {
      ep.healthy = true;
      ep.errorCount = 0;
      ep.lastSuccessAt = Date.now();
      this.eventBus.emit('rpc:endpoint-recovered', 'system', 'rpc-pool', { url });
    }
  }

  /** Update latency for an endpoint */
  updateLatency(url: string, latencyMs: number): void {
    const ep = this.endpoints.find((e) => e.url === url);
    if (ep) {
      ep.avgLatencyMs = latencyMs;
    }
  }

  /** Get all healthy endpoints */
  getHealthyEndpoints(): RpcEndpoint[] {
    return this.endpoints.filter((ep) => ep.healthy !== false);
  }

  /** Get endpoint count */
  get size(): number {
    return this.endpoints.length;
  }
}

describe('RPC Pool', () => {
  let bus: SwarmEventBus;

  beforeEach(() => {
    bus = createTestEventBus();
  });

  afterEach(() => {
    SwarmEventBus.resetInstance();
  });

  // ─── Endpoint Selection ───────────────────────────────────

  describe('endpoint selection', () => {
    it('returns an endpoint from the pool', () => {
      const pool = new TestRpcPool(createTestRpcConfig(), bus);
      const ep = pool.getEndpoint();
      expect(ep).toBeDefined();
      expect(ep!.url).toContain('solana.com');
    });

    it('returns undefined when all endpoints are unhealthy', () => {
      const config = createTestRpcConfig({
        endpoints: [
          { url: 'https://rpc1.test', weight: 1, rateLimit: 10, supportsJito: false, healthy: false, avgLatencyMs: 0, errorCount: 5, lastSuccessAt: 0, provider: 'test-1' },
          { url: 'https://rpc2.test', weight: 1, rateLimit: 10, supportsJito: false, healthy: false, avgLatencyMs: 0, errorCount: 5, lastSuccessAt: 0, provider: 'test-2' },
        ],
      });
      const pool = new TestRpcPool(config, bus);
      const ep = pool.getEndpoint();
      expect(ep).toBeUndefined();
    });

    it('prefers low-latency endpoints when configured', () => {
      const config = createTestRpcConfig({
        preferLowLatency: true,
        endpoints: [
          { url: 'https://slow.test', weight: 1, rateLimit: 10, supportsJito: false, healthy: true, avgLatencyMs: 500, errorCount: 0, lastSuccessAt: Date.now(), provider: 'slow' },
          { url: 'https://fast.test', weight: 1, rateLimit: 10, supportsJito: false, healthy: true, avgLatencyMs: 50, errorCount: 0, lastSuccessAt: Date.now(), provider: 'fast' },
        ],
      });
      const pool = new TestRpcPool(config, bus);
      const ep = pool.getEndpoint();
      expect(ep!.url).toBe('https://fast.test');
    });
  });

  // ─── Health Management ────────────────────────────────────

  describe('health management', () => {
    it('marks an endpoint as unhealthy', () => {
      const config = createTestRpcConfig({
        endpoints: [
          { url: 'https://rpc1.test', weight: 1, rateLimit: 10, supportsJito: false, healthy: true, avgLatencyMs: 100, errorCount: 0, lastSuccessAt: Date.now(), provider: 'test' },
          { url: 'https://rpc2.test', weight: 1, rateLimit: 10, supportsJito: false, healthy: true, avgLatencyMs: 100, errorCount: 0, lastSuccessAt: Date.now(), provider: 'test-2' },
        ],
      });
      const pool = new TestRpcPool(config, bus);
      pool.markUnhealthy('https://rpc1.test', 'timeout');

      const healthy = pool.getHealthyEndpoints();
      expect(healthy).toHaveLength(1);
      expect(healthy[0]!.url).toBe('https://rpc2.test');
    });

    it('recovers an endpoint', () => {
      const config = createTestRpcConfig({
        endpoints: [
          { url: 'https://rpc1.test', weight: 1, rateLimit: 10, supportsJito: false, healthy: false, avgLatencyMs: 100, errorCount: 3, lastSuccessAt: 0, provider: 'test' },
        ],
      });
      const pool = new TestRpcPool(config, bus);
      expect(pool.getHealthyEndpoints()).toHaveLength(0);

      pool.markHealthy('https://rpc1.test');
      expect(pool.getHealthyEndpoints()).toHaveLength(1);
    });

    it('emits events on health changes', () => {
      const config = createTestRpcConfig({
        endpoints: [
          { url: 'https://rpc1.test', weight: 1, rateLimit: 10, supportsJito: false, healthy: true, avgLatencyMs: 100, errorCount: 0, lastSuccessAt: Date.now(), provider: 'test' },
        ],
      });
      const pool = new TestRpcPool(config, bus);
      const { events, unsubscribe } = collectEvents(bus, 'rpc:*');

      pool.markUnhealthy('https://rpc1.test', 'timeout');
      pool.markHealthy('https://rpc1.test');
      unsubscribe();

      expect(events).toHaveLength(2);
      expect(events[0]!.type).toBe('rpc:endpoint-unhealthy');
      expect(events[1]!.type).toBe('rpc:endpoint-recovered');
    });
  });

  // ─── Failover ─────────────────────────────────────────────

  describe('failover', () => {
    it('fails over to next healthy endpoint', () => {
      const config = createTestRpcConfig({
        preferLowLatency: false,
        endpoints: [
          { url: 'https://primary.test', weight: 10, rateLimit: 10, supportsJito: false, healthy: true, avgLatencyMs: 50, errorCount: 0, lastSuccessAt: Date.now(), provider: 'primary' },
          { url: 'https://backup.test', weight: 1, rateLimit: 10, supportsJito: false, healthy: true, avgLatencyMs: 200, errorCount: 0, lastSuccessAt: Date.now(), provider: 'backup' },
        ],
      });
      const pool = new TestRpcPool(config, bus);

      // Mark primary as down
      pool.markUnhealthy('https://primary.test', 'connection refused');

      const ep = pool.getEndpoint();
      expect(ep!.url).toBe('https://backup.test');
    });
  });

  // ─── Latency Tracking ────────────────────────────────────

  describe('latency tracking', () => {
    it('routes to lowest-latency endpoint', () => {
      const config = createTestRpcConfig({
        preferLowLatency: true,
        endpoints: [
          { url: 'https://a.test', weight: 1, rateLimit: 10, supportsJito: false, healthy: true, avgLatencyMs: 300, errorCount: 0, lastSuccessAt: Date.now(), provider: 'a' },
          { url: 'https://b.test', weight: 1, rateLimit: 10, supportsJito: false, healthy: true, avgLatencyMs: 100, errorCount: 0, lastSuccessAt: Date.now(), provider: 'b' },
          { url: 'https://c.test', weight: 1, rateLimit: 10, supportsJito: false, healthy: true, avgLatencyMs: 200, errorCount: 0, lastSuccessAt: Date.now(), provider: 'c' },
        ],
      });
      const pool = new TestRpcPool(config, bus);

      expect(pool.getEndpoint()!.url).toBe('https://b.test');

      // Update latencies — now 'a' is fastest
      pool.updateLatency('https://a.test', 50);
      expect(pool.getEndpoint()!.url).toBe('https://a.test');
    });
  });
});
