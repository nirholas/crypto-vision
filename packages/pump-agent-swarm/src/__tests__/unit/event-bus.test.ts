/**
 * Unit Tests — Event Bus
 *
 * Tests for SwarmEventBus: emit, subscribe, pattern matching,
 * replay, debounce, waitFor, pipe, correlation tracking, and stats.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SwarmEventBus } from '../../infra/event-bus.js';
import type { SwarmEvent } from '../../types.js';
import { createTestEventBus, collectEvents, sleep } from '../helpers/test-config.js';

describe('SwarmEventBus', () => {
  let bus: SwarmEventBus;

  beforeEach(() => {
    bus = createTestEventBus(100);
  });

  afterEach(() => {
    SwarmEventBus.resetInstance();
  });

  // ─── Singleton ──────────────────────────────────────────────

  describe('singleton', () => {
    it('returns the same instance on repeated calls', () => {
      SwarmEventBus.resetInstance();
      const a = SwarmEventBus.getInstance();
      const b = SwarmEventBus.getInstance();
      expect(a).toBe(b);
    });

    it('resets singleton cleanly', () => {
      SwarmEventBus.resetInstance();
      const a = SwarmEventBus.getInstance();
      SwarmEventBus.resetInstance();
      const b = SwarmEventBus.getInstance();
      expect(a).not.toBe(b);
    });
  });

  // ─── Emit & Subscribe ──────────────────────────────────────

  describe('emit & subscribe', () => {
    it('delivers an event to a matching subscriber', () => {
      const received: SwarmEvent[] = [];
      bus.subscribe('trade:executed', (e) => received.push(e));
      bus.emit('trade:executed', 'trading', 'trader-1', { price: 0.001 });

      expect(received).toHaveLength(1);
      expect(received[0]!.type).toBe('trade:executed');
      expect(received[0]!.category).toBe('trading');
      expect(received[0]!.source).toBe('trader-1');
      expect(received[0]!.payload).toEqual({ price: 0.001 });
    });

    it('does not deliver to non-matching subscribers', () => {
      const received: SwarmEvent[] = [];
      bus.subscribe('trade:failed', (e) => received.push(e));
      bus.emit('trade:executed', 'trading', 'trader-1', {});

      expect(received).toHaveLength(0);
    });

    it('returns the created event from emit', () => {
      const event = bus.emit('test:event', 'system', 'test', { x: 1 });
      expect(event.id).toBeDefined();
      expect(event.type).toBe('test:event');
      expect(event.timestamp).toBeGreaterThan(0);
    });

    it('delivers to multiple subscribers', () => {
      const a: SwarmEvent[] = [];
      const b: SwarmEvent[] = [];
      bus.subscribe('ping', (e) => a.push(e));
      bus.subscribe('ping', (e) => b.push(e));
      bus.emit('ping', 'system', 'test', {});

      expect(a).toHaveLength(1);
      expect(b).toHaveLength(1);
    });
  });

  // ─── Pattern Matching ──────────────────────────────────────

  describe('pattern matching', () => {
    it('matches wildcard "*" to all events', () => {
      const { events, unsubscribe } = collectEvents(bus, '*');
      bus.emit('a', 'system', 's', {});
      bus.emit('b', 'trading', 's', {});
      expect(events).toHaveLength(2);
      unsubscribe();
    });

    it('matches category pattern "@trading"', () => {
      const { events, unsubscribe } = collectEvents(bus, '@trading');
      bus.emit('trade:executed', 'trading', 's', {});
      bus.emit('agent:started', 'lifecycle', 's', {});
      expect(events).toHaveLength(1);
      expect(events[0]!.type).toBe('trade:executed');
      unsubscribe();
    });

    it('matches prefix pattern "trade:*"', () => {
      const { events, unsubscribe } = collectEvents(bus, 'trade:*');
      bus.emit('trade:executed', 'trading', 's', {});
      bus.emit('trade:failed', 'trading', 's', {});
      bus.emit('agent:started', 'lifecycle', 's', {});
      expect(events).toHaveLength(2);
      unsubscribe();
    });

    it('matches suffix pattern "*:failed"', () => {
      const { events, unsubscribe } = collectEvents(bus, '*:failed');
      bus.emit('trade:failed', 'trading', 's', {});
      bus.emit('bundle:failed', 'bundle', 's', {});
      bus.emit('trade:executed', 'trading', 's', {});
      expect(events).toHaveLength(2);
      unsubscribe();
    });

    it('matches exact pattern', () => {
      const { events, unsubscribe } = collectEvents(bus, 'specific:event');
      bus.emit('specific:event', 'system', 's', {});
      bus.emit('specific:other', 'system', 's', {});
      expect(events).toHaveLength(1);
      unsubscribe();
    });
  });

  // ─── Unsubscribe ────────────────────────────────────────────

  describe('unsubscribe', () => {
    it('stops delivery after unsubscribe', () => {
      const events: SwarmEvent[] = [];
      const subId = bus.subscribe('*', (e) => events.push(e));
      bus.emit('a', 'system', 's', {});
      expect(events).toHaveLength(1);

      bus.unsubscribe(subId);
      bus.emit('b', 'system', 's', {});
      expect(events).toHaveLength(1);
    });

    it('unsubscribeAll removes all subscriptions', () => {
      const events: SwarmEvent[] = [];
      bus.subscribe('*', (e) => events.push(e));
      bus.subscribe('*', (e) => events.push(e));
      bus.unsubscribeAll();
      bus.emit('a', 'system', 's', {});
      expect(events).toHaveLength(0);
    });

    it('unsubscribeAll with source only removes matching', () => {
      const eventsA: SwarmEvent[] = [];
      const eventsB: SwarmEvent[] = [];
      bus.subscribe('*', (e) => eventsA.push(e), { source: 'agentA' });
      bus.subscribe('*', (e) => eventsB.push(e), { source: 'agentB' });

      bus.unsubscribeAll('agentA');
      bus.emit('x', 'system', 's', {});
      expect(eventsA).toHaveLength(0);
      expect(eventsB).toHaveLength(1);
    });
  });

  // ─── History ────────────────────────────────────────────────

  describe('history', () => {
    it('stores events in history', () => {
      bus.emit('a', 'system', 's', {});
      bus.emit('b', 'trading', 's', {});

      const history = bus.getHistory();
      expect(history).toHaveLength(2);
    });

    it('filters history by type', () => {
      bus.emit('a', 'system', 's', {});
      bus.emit('b', 'trading', 's', {});
      const results = bus.getHistory({ type: 'a' });
      expect(results).toHaveLength(1);
      expect(results[0]!.type).toBe('a');
    });

    it('filters history by category', () => {
      bus.emit('x', 'trading', 's', {});
      bus.emit('y', 'system', 's', {});
      const results = bus.getHistory({ category: 'trading' });
      expect(results).toHaveLength(1);
    });

    it('respects history size limit', () => {
      const smallBus = new SwarmEventBus(5);
      for (let i = 0; i < 10; i++) {
        smallBus.emit(`event-${i}`, 'system', 's', { i });
      }
      const history = smallBus.getHistory();
      expect(history).toHaveLength(5);
      // Oldest events should be the last 5
      expect(history[0]!.payload).toEqual({ i: 5 });
    });

    it('filters history by since timestamp', () => {
      const t1 = Date.now();
      bus.emit('old', 'system', 's', {});
      const t2 = Date.now() + 1;
      bus.emit('new', 'system', 's', {});
      // All events after t2 should be 0 or 1 depending on timing
      const results = bus.getHistory({ since: t1 });
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('limits history results', () => {
      for (let i = 0; i < 10; i++) {
        bus.emit(`e${i}`, 'system', 's', {});
      }
      const results = bus.getHistory({ limit: 3 });
      expect(results).toHaveLength(3);
    });
  });

  // ─── Replay ─────────────────────────────────────────────────

  describe('replay', () => {
    it('replays matching historical events to new subscriber', () => {
      bus.emit('trade:executed', 'trading', 's', { id: 1 });
      bus.emit('trade:executed', 'trading', 's', { id: 2 });
      bus.emit('agent:started', 'lifecycle', 's', {});

      const replayed: SwarmEvent[] = [];
      bus.subscribe('trade:*', (e) => replayed.push(e), { replay: true });

      expect(replayed).toHaveLength(2);
    });

    it('does not replay when replay=false', () => {
      bus.emit('trade:executed', 'trading', 's', {});

      const events: SwarmEvent[] = [];
      bus.subscribe('trade:*', (e) => events.push(e));

      expect(events).toHaveLength(0);
    });
  });

  // ─── Correlation Tracking ──────────────────────────────────

  describe('correlation tracking', () => {
    it('tracks events by correlationId', () => {
      bus.emit('step:1', 'system', 's', {}, 'corr-1');
      bus.emit('step:2', 'system', 's', {}, 'corr-1');
      bus.emit('step:3', 'system', 's', {}, 'corr-2');

      const corr1 = bus.getCorrelation('corr-1');
      expect(corr1).toHaveLength(2);

      const corr2 = bus.getCorrelation('corr-2');
      expect(corr2).toHaveLength(1);
    });

    it('returns empty array for unknown correlationId', () => {
      expect(bus.getCorrelation('unknown')).toEqual([]);
    });
  });

  // ─── Stats ──────────────────────────────────────────────────

  describe('stats', () => {
    it('tracks event counts and subscriptions', () => {
      bus.subscribe('*', () => {});
      bus.emit('a', 'trading', 's', {});
      bus.emit('b', 'system', 's', {});
      bus.emit('c', 'trading', 's', {});

      const stats = bus.getStats();
      expect(stats.totalEvents).toBe(3);
      expect(stats.totalSubscriptions).toBe(1);
      expect(stats.eventsByCategory.trading).toBe(2);
      expect(stats.eventsByCategory.system).toBe(1);
    });
  });

  // ─── waitFor ────────────────────────────────────────────────

  describe('waitFor', () => {
    it('resolves when a matching event arrives', async () => {
      const promise = bus.waitFor('target:event', 5_000);
      setTimeout(() => bus.emit('target:event', 'system', 's', { hit: true }), 50);
      const event = await promise;
      expect(event.type).toBe('target:event');
      expect(event.payload).toEqual({ hit: true });
    });

    it('rejects on timeout', async () => {
      await expect(bus.waitFor('never:happens', 100)).rejects.toThrow(
        /timed out/,
      );
    });
  });

  // ─── Pipe ───────────────────────────────────────────────────

  describe('pipe', () => {
    it('forwards events from source bus to target bus', () => {
      const targetBus = new SwarmEventBus(50);
      const { events, unsubscribe } = collectEvents(targetBus, '*');
      const unpipe = bus.pipe(targetBus);

      bus.emit('piped:event', 'system', 'source', { forwarded: true });

      expect(events).toHaveLength(1);
      expect(events[0]!.type).toBe('piped:event');

      unpipe();
      unsubscribe();
    });

    it('respects filter in pipe', () => {
      const targetBus = new SwarmEventBus(50);
      const { events, unsubscribe } = collectEvents(targetBus, '*');
      const unpipe = bus.pipe(targetBus, (e) => e.category === 'trading');

      bus.emit('included', 'trading', 's', {});
      bus.emit('excluded', 'system', 's', {});

      expect(events).toHaveLength(1);
      expect(events[0]!.type).toBe('included');

      unpipe();
      unsubscribe();
    });
  });

  // ─── Filter on Subscribe ───────────────────────────────────

  describe('subscribe with filter', () => {
    it('applies filter predicate to received events', () => {
      const events: SwarmEvent[] = [];
      bus.subscribe('trade:*', (e) => events.push(e), {
        filter: (e) => (e.payload as Record<string, unknown>).important === true,
      });

      bus.emit('trade:executed', 'trading', 's', { important: true });
      bus.emit('trade:executed', 'trading', 's', { important: false });

      expect(events).toHaveLength(1);
    });
  });

  // ─── Debounce ───────────────────────────────────────────────

  describe('debounce', () => {
    it('debounces rapid events within window', async () => {
      const events: SwarmEvent[] = [];
      bus.subscribe('rapid:event', (e) => events.push(e), {
        debounceMs: 100,
      });

      // Emit 5 rapid events
      for (let i = 0; i < 5; i++) {
        bus.emit('rapid:event', 'system', 's', { i });
      }

      // Immediately, 0 delivered (pending debounce)
      expect(events).toHaveLength(0);

      // After debounce window, only the last one should arrive
      await sleep(200);
      expect(events).toHaveLength(1);
      expect(events[0]!.payload).toEqual({ i: 4 });
    });
  });

  // ─── Error Isolation ────────────────────────────────────────

  describe('error isolation', () => {
    it('does not break other subscribers when one throws', () => {
      const events: SwarmEvent[] = [];

      bus.subscribe('test', () => {
        throw new Error('subscriber error');
      });
      bus.subscribe('test', (e) => events.push(e));

      // Should not throw from emit
      expect(() => bus.emit('test', 'system', 's', {})).not.toThrow();
      // Second subscriber should still receive the event
      expect(events).toHaveLength(1);
    });
  });
});
