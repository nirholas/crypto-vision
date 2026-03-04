/**
 * Swarm Event Bus — High-performance, decoupled event communication
 *
 * Features:
 * - Wildcard pattern matching (prefix, suffix, category, exact, all)
 * - Circular buffer replay (last 10,000 events)
 * - Async handler support with error isolation
 * - Correlation tracking for tracing related events
 * - waitFor promise-based one-shot subscriptions
 * - Pipe forwarding to other bus instances
 * - Debounced subscriptions for noisy events
 */

import { v4 as uuidv4 } from 'uuid';

import type {
  EventSubscription,
  SwarmEvent,
  SwarmEventCategory,
} from '../types.js';

// ─── Constants ────────────────────────────────────────────────

const DEFAULT_HISTORY_SIZE = 10_000;
const DEFAULT_WAIT_TIMEOUT_MS = 30_000;

// ─── Circular Buffer ──────────────────────────────────────────

/**
 * Fixed-capacity ring buffer backed by a pre-allocated array.
 * O(1) push, O(n) iteration — no array shifts or GC pressure.
 */
class CircularBuffer<T> {
  private readonly buffer: Array<T | undefined>;
  private head = 0;
  private _size = 0;

  constructor(private readonly capacity: number) {
    this.buffer = new Array<T | undefined>(capacity);
  }

  get size(): number {
    return this._size;
  }

  push(item: T): void {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this._size < this.capacity) {
      this._size++;
    }
  }

  /** Iterate oldest → newest */
  *[Symbol.iterator](): IterableIterator<T> {
    if (this._size === 0) return;
    const start =
      this._size < this.capacity ? 0 : this.head;
    for (let i = 0; i < this._size; i++) {
      const idx = (start + i) % this.capacity;
      yield this.buffer[idx] as T;
    }
  }

  /** Return all items oldest → newest */
  toArray(): T[] {
    return [...this];
  }

  clear(): void {
    this.buffer.fill(undefined);
    this.head = 0;
    this._size = 0;
  }
}

// ─── Pattern Matching Helpers ─────────────────────────────────

/**
 * Match an event against a subscription pattern.
 *
 * Patterns:
 *   `'*'`           — match everything
 *   `'@trading'`    — match by category
 *   `'trade:*'`     — wildcard suffix (startsWith)
 *   `'*:failed'`    — wildcard prefix (endsWith)
 *   `'trade:executed'` — exact match
 */
function matchPattern(
  pattern: string,
  event: SwarmEvent,
): boolean {
  if (pattern === '*') return true;

  if (pattern.startsWith('@')) {
    return event.category === pattern.slice(1);
  }

  if (pattern.endsWith('*') && !pattern.startsWith('*')) {
    return event.type.startsWith(pattern.slice(0, -1));
  }

  if (pattern.startsWith('*') && !pattern.endsWith('*')) {
    return event.type.endsWith(pattern.slice(1));
  }

  return event.type === pattern;
}

// ─── SwarmEventBus ────────────────────────────────────────────

export interface SubscribeOptions {
  /** Replay historical events that match the pattern on subscribe */
  replay?: boolean;
  /** Additional predicate applied after pattern matching */
  filter?: (event: SwarmEvent) => boolean;
  /** Source identifier (for bulk unsubscribe via unsubscribeAll) */
  source?: string;
  /** Debounce interval in ms — only the latest event within the window is delivered */
  debounceMs?: number;
}

export class SwarmEventBus {
  // ── Singleton ───────────────────────────────────────────────
  private static instance: SwarmEventBus | undefined;

  static getInstance(): SwarmEventBus {
    if (!SwarmEventBus.instance) {
      SwarmEventBus.instance = new SwarmEventBus();
    }
    return SwarmEventBus.instance;
  }

  /** Reset singleton (useful in tests) */
  static resetInstance(): void {
    SwarmEventBus.instance?.clear();
    SwarmEventBus.instance = undefined;
  }

  // ── Internal State ──────────────────────────────────────────
  private readonly history: CircularBuffer<SwarmEvent>;
  private readonly subscriptions = new Map<string, EventSubscription>();
  private readonly categoryCounters = new Map<SwarmEventCategory, number>();
  private readonly correlationIndex = new Map<string, SwarmEvent[]>();
  private readonly debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private totalEventsEmitted = 0;

  constructor(historySize: number = DEFAULT_HISTORY_SIZE) {
    this.history = new CircularBuffer<SwarmEvent>(historySize);
  }

  // ── Emit ────────────────────────────────────────────────────

  /**
   * Publish an event to all matching subscribers.
   * Returns the created event for chaining / inspection.
   */
  emit(
    type: string,
    category: SwarmEventCategory,
    source: string,
    payload: Record<string, unknown>,
    correlationId?: string,
  ): SwarmEvent {
    const event: SwarmEvent = {
      id: uuidv4(),
      type,
      category,
      source,
      payload,
      correlationId,
      timestamp: Date.now(),
    };

    // Store in history buffer
    this.history.push(event);
    this.totalEventsEmitted++;

    // Update category counter
    this.categoryCounters.set(
      category,
      (this.categoryCounters.get(category) ?? 0) + 1,
    );

    // Index by correlationId
    if (correlationId) {
      const list = this.correlationIndex.get(correlationId);
      if (list) {
        list.push(event);
      } else {
        this.correlationIndex.set(correlationId, [event]);
      }
    }

    // Deliver to subscribers
    this.deliver(event);

    return event;
  }

  // ── Subscribe ───────────────────────────────────────────────

  /**
   * Subscribe to events matching `pattern`.
   * Returns a subscription ID for later removal.
   */
  subscribe(
    pattern: string,
    handler: (event: SwarmEvent) => void | Promise<void>,
    options?: SubscribeOptions,
  ): string {
    const id = uuidv4();

    // Wrap handler with debounce if requested
    const effectiveHandler =
      options?.debounceMs != null && options.debounceMs > 0
        ? this.createDebouncedHandler(id, handler, options.debounceMs)
        : handler;

    const sub: EventSubscription = {
      id,
      pattern,
      handler: effectiveHandler,
      filter: options?.filter,
      source: options?.source,
    };

    this.subscriptions.set(id, sub);

    // Replay historical events if requested
    if (options?.replay) {
      for (const event of this.history) {
        if (matchPattern(pattern, event)) {
          if (sub.filter && !sub.filter(event)) continue;
          this.invokeHandler(sub, event);
        }
      }
    }

    return id;
  }

  // ── Unsubscribe ─────────────────────────────────────────────

  /** Remove a single subscription by ID */
  unsubscribe(subscriptionId: string): void {
    this.subscriptions.delete(subscriptionId);
    this.clearDebounceTimer(subscriptionId);
  }

  /** Remove all subscriptions, optionally filtered by source */
  unsubscribeAll(source?: string): void {
    if (source === undefined) {
      for (const id of this.subscriptions.keys()) {
        this.clearDebounceTimer(id);
      }
      this.subscriptions.clear();
      return;
    }

    for (const [id, sub] of this.subscriptions) {
      if (sub.source === source) {
        this.subscriptions.delete(id);
        this.clearDebounceTimer(id);
      }
    }
  }

  // ── History / Query ─────────────────────────────────────────

  /** Query the event history with optional filters */
  getHistory(options?: {
    type?: string;
    category?: SwarmEventCategory;
    source?: string;
    since?: number;
    limit?: number;
  }): SwarmEvent[] {
    let results: SwarmEvent[] = [];

    for (const event of this.history) {
      if (options?.type !== undefined && event.type !== options.type) continue;
      if (options?.category !== undefined && event.category !== options.category) continue;
      if (options?.source !== undefined && event.source !== options.source) continue;
      if (options?.since !== undefined && event.timestamp < options.since) continue;
      results.push(event);
    }

    if (options?.limit !== undefined && results.length > options.limit) {
      results = results.slice(results.length - options.limit);
    }

    return results;
  }

  /** Get all events sharing a correlation ID */
  getCorrelation(correlationId: string): SwarmEvent[] {
    return this.correlationIndex.get(correlationId) ?? [];
  }

  // ── Stats ───────────────────────────────────────────────────

  getStats(): {
    totalEvents: number;
    totalSubscriptions: number;
    eventsByCategory: Record<SwarmEventCategory, number>;
  } {
    const categories: SwarmEventCategory[] = [
      'trading',
      'analytics',
      'lifecycle',
      'system',
      'wallet',
      'error',
    ];

    const eventsByCategory = {} as Record<SwarmEventCategory, number>;
    for (const cat of categories) {
      eventsByCategory[cat] = this.categoryCounters.get(cat) ?? 0;
    }

    return {
      totalEvents: this.totalEventsEmitted,
      totalSubscriptions: this.subscriptions.size,
      eventsByCategory,
    };
  }

  // ── waitFor ─────────────────────────────────────────────────

  /**
   * Returns a promise that resolves with the next event matching `pattern`,
   * or rejects if `timeoutMs` elapses first.
   */
  waitFor(
    pattern: string,
    timeoutMs: number = DEFAULT_WAIT_TIMEOUT_MS,
  ): Promise<SwarmEvent> {
    return new Promise<SwarmEvent>((resolve, reject) => {
      let subId: string | undefined;
      let timer: ReturnType<typeof setTimeout> | undefined;

      const cleanup = (): void => {
        if (subId !== undefined) this.unsubscribe(subId);
        if (timer !== undefined) clearTimeout(timer);
      };

      subId = this.subscribe(pattern, (event: SwarmEvent) => {
        cleanup();
        resolve(event);
      });

      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          cleanup();
          reject(
            new Error(
              `waitFor('${pattern}') timed out after ${timeoutMs}ms`,
            ),
          );
        }, timeoutMs);
      }
    });
  }

  // ── Pipe ────────────────────────────────────────────────────

  /**
   * Forward all events (optionally filtered) to another bus instance.
   * Returns an unsubscribe function.
   */
  pipe(
    targetBus: SwarmEventBus,
    filter?: (event: SwarmEvent) => boolean,
  ): () => void {
    const subId = this.subscribe(
      '*',
      (event: SwarmEvent) => {
        targetBus.emit(
          event.type,
          event.category,
          event.source,
          event.payload,
          event.correlationId,
        );
      },
      { filter },
    );
    return () => this.unsubscribe(subId);
  }

  // ── Clear ───────────────────────────────────────────────────

  /** Clear all history, subscriptions, correlation indexes, and counters */
  clear(): void {
    this.history.clear();
    for (const id of this.subscriptions.keys()) {
      this.clearDebounceTimer(id);
    }
    this.subscriptions.clear();
    this.categoryCounters.clear();
    this.correlationIndex.clear();
    this.totalEventsEmitted = 0;
  }

  // ── Internal: Delivery ──────────────────────────────────────

  /** Deliver an event to all matching subscribers */
  private deliver(event: SwarmEvent): void {
    for (const sub of this.subscriptions.values()) {
      if (!matchPattern(sub.pattern, event)) continue;
      if (sub.filter && !sub.filter(event)) continue;
      this.invokeHandler(sub, event);
    }
  }

  /** Invoke a handler, catching and surfacing errors safely */
  private invokeHandler(sub: EventSubscription, event: SwarmEvent): void {
    try {
      const result = sub.handler(event);
      // If the handler returns a promise, attach an error handler
      if (result instanceof Promise) {
        result.catch((err: unknown) => {
          this.emitHandlerError(sub, event, err);
        });
      }
    } catch (err: unknown) {
      this.emitHandlerError(sub, event, err);
    }
  }

  /** Emit a bus:handler-error event without re-entering errored handlers */
  private emitHandlerError(
    sub: EventSubscription,
    originalEvent: SwarmEvent,
    err: unknown,
  ): void {
    const errorMessage =
      err instanceof Error ? err.message : String(err);
    const errorStack =
      err instanceof Error ? err.stack : undefined;

    // Avoid infinite recursion: never emit handler-error for handler-error events
    if (originalEvent.type === 'bus:handler-error') return;

    this.emit('bus:handler-error', 'error', 'event-bus', {
      subscriptionId: sub.id,
      pattern: sub.pattern,
      originalEventId: originalEvent.id,
      originalEventType: originalEvent.type,
      error: errorMessage,
      stack: errorStack,
    });
  }

  // ── Internal: Debounce ──────────────────────────────────────

  /**
   * Wrap a handler so only the latest event within `intervalMs` is delivered.
   */
  private createDebouncedHandler(
    subscriptionId: string,
    handler: (event: SwarmEvent) => void | Promise<void>,
    intervalMs: number,
  ): (event: SwarmEvent) => void {
    return (event: SwarmEvent): void => {
      this.clearDebounceTimer(subscriptionId);

      const timer = setTimeout(() => {
        this.debounceTimers.delete(subscriptionId);
        try {
          const result = handler(event);
          if (result instanceof Promise) {
            result.catch((err: unknown) => {
              const sub = this.subscriptions.get(subscriptionId);
              if (sub) this.emitHandlerError(sub, event, err);
            });
          }
        } catch (err: unknown) {
          const sub = this.subscriptions.get(subscriptionId);
          if (sub) this.emitHandlerError(sub, event, err);
        }
      }, intervalMs);

      this.debounceTimers.set(subscriptionId, timer);
    };
  }

  private clearDebounceTimer(subscriptionId: string): void {
    const existing = this.debounceTimers.get(subscriptionId);
    if (existing !== undefined) {
      clearTimeout(existing);
      this.debounceTimers.delete(subscriptionId);
    }
  }
}
