/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// In-memory event store for webhook notifications
// Stores webhook events temporarily with automatic cleanup

import { getLogger } from '../utils/logger.js';

const logger = getLogger();

export interface WebhookEvent {
  /** Unique payment identifier */
  identifier: string;
  /** Payment status from webhook */
  status: string;
  /** Timestamp when webhook was received */
  receivedAt: Date;
  /** Full webhook payload */
  payload: Record<string, unknown>;
  /** HMAC signature from X-SIGNATURE header */
  signature: string;
  /** Nonce from X-NONCE header */
  nonce: string;
  /** Whether signature validation passed */
  validated: boolean;
  /** Event ID for deduplication */
  eventId: string;
}

export interface EventStoreConfig {
  /** Maximum number of events to store */
  maxEntries: number;
  /** Time-to-live for events in milliseconds */
  ttlMs: number;
}

/**
 * In-memory event store for webhook notifications
 * Features:
 * - Automatic cleanup of expired events
 * - Event deduplication by eventId
 * - Fast lookup by payment identifier
 * - Memory-bounded with configurable limits
 */
export class WebhookEventStore {
  private events: Map<string, WebhookEvent> = new Map();
  private eventsByIdentifier: Map<string, Set<string>> = new Map();
  private config: EventStoreConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: EventStoreConfig) {
    this.config = config;
    this.startCleanupTask();

    logger.info('Webhook event store initialized', {
      maxEntries: config.maxEntries,
      ttlMs: config.ttlMs,
      operation: 'event_store_init',
    });
  }

  /**
   * Store a webhook event
   * @param event - The webhook event to store
   * @returns true if stored successfully, false if duplicate or storage full
   */
  store(event: WebhookEvent): boolean {
    // Check for duplicate event
    if (this.events.has(event.eventId)) {
      logger.debug('Duplicate webhook event ignored', {
        eventId: event.eventId,
        identifier: event.identifier,
        operation: 'event_store_duplicate',
      });
      return false;
    }

    // Check storage capacity
    if (this.events.size >= this.config.maxEntries) {
      logger.warn('Event store full, removing oldest events', {
        currentSize: this.events.size,
        maxEntries: this.config.maxEntries,
        operation: 'event_store_full',
      });
      this.removeOldestEvents(Math.floor(this.config.maxEntries * 0.1)); // Remove 10%
    }

    // Store event
    this.events.set(event.eventId, event);

    // Index by payment identifier for fast lookup
    if (!this.eventsByIdentifier.has(event.identifier)) {
      this.eventsByIdentifier.set(event.identifier, new Set());
    }
    this.eventsByIdentifier.get(event.identifier)!.add(event.eventId);

    logger.info('Webhook event stored', {
      eventId: event.eventId,
      identifier: event.identifier,
      status: event.status,
      validated: event.validated,
      operation: 'event_store_add',
    });

    return true;
  }

  /**
   * Get all events for a specific payment identifier
   * @param identifier - The payment identifier
   * @returns Array of webhook events, sorted by receivedAt (newest first)
   */
  getByIdentifier(identifier: string): WebhookEvent[] {
    const eventIds = this.eventsByIdentifier.get(identifier);
    if (!eventIds || eventIds.size === 0) {
      return [];
    }

    const events: WebhookEvent[] = [];
    for (const eventId of eventIds) {
      const event = this.events.get(eventId);
      if (event) {
        events.push(event);
      }
    }

    // Sort by receivedAt, newest first
    events.sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());

    logger.debug('Retrieved events by identifier', {
      identifier,
      count: events.length,
      operation: 'event_store_get_by_id',
    });

    return events;
  }

  /**
   * Get most recent webhook events
   * @param limit - Maximum number of events to return
   * @returns Array of webhook events, sorted by receivedAt (newest first)
   */
  getRecent(limit = 50): WebhookEvent[] {
    const allEvents = Array.from(this.events.values());

    // Sort by receivedAt, newest first
    allEvents.sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());

    const events = allEvents.slice(0, limit);

    logger.debug('Retrieved recent events', {
      totalEvents: this.events.size,
      returned: events.length,
      limit,
      operation: 'event_store_get_recent',
    });

    return events;
  }

  /**
   * Get a specific event by eventId
   * @param eventId - The event ID
   * @returns The webhook event or undefined if not found
   */
  getByEventId(eventId: string): WebhookEvent | undefined {
    return this.events.get(eventId);
  }

  /**
   * Get all validated events (signature verification passed)
   * @param limit - Maximum number of events to return
   * @returns Array of validated webhook events
   */
  getValidated(limit = 50): WebhookEvent[] {
    const validatedEvents = Array.from(this.events.values()).filter(
      e => e.validated
    );

    validatedEvents.sort(
      (a, b) => b.receivedAt.getTime() - a.receivedAt.getTime()
    );

    return validatedEvents.slice(0, limit);
  }

  /**
   * Remove expired events based on TTL
   * @returns Number of events removed
   */
  cleanup(): number {
    const now = Date.now();
    const expirationTime = now - this.config.ttlMs;
    let removedCount = 0;

    for (const [eventId, event] of this.events.entries()) {
      if (event.receivedAt.getTime() < expirationTime) {
        this.removeEvent(eventId);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      logger.info('Event store cleanup completed', {
        removedCount,
        remainingEvents: this.events.size,
        operation: 'event_store_cleanup',
      });
    }

    return removedCount;
  }

  /**
   * Remove oldest events to free up space
   * @param count - Number of events to remove
   */
  private removeOldestEvents(count: number): void {
    const allEvents = Array.from(this.events.values());
    allEvents.sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime());

    const toRemove = allEvents.slice(0, count);
    for (const event of toRemove) {
      this.removeEvent(event.eventId);
    }

    logger.debug('Removed oldest events', {
      count: toRemove.length,
      operation: 'event_store_remove_oldest',
    });
  }

  /**
   * Remove a single event from the store
   * @param eventId - The event ID to remove
   */
  private removeEvent(eventId: string): void {
    const event = this.events.get(eventId);
    if (!event) return;

    // Remove from main storage
    this.events.delete(eventId);

    // Remove from identifier index
    const identifierEvents = this.eventsByIdentifier.get(event.identifier);
    if (identifierEvents) {
      identifierEvents.delete(eventId);
      if (identifierEvents.size === 0) {
        this.eventsByIdentifier.delete(event.identifier);
      }
    }
  }

  /**
   * Start automatic cleanup task
   */
  private startCleanupTask(): void {
    // Run cleanup every 5 minutes
    const cleanupIntervalMs = 5 * 60 * 1000;

    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, cleanupIntervalMs);

    logger.debug('Event store cleanup task started', {
      intervalMs: cleanupIntervalMs,
      operation: 'event_store_cleanup_start',
    });
  }

  /**
   * Stop automatic cleanup task
   */
  stopCleanupTask(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;

      logger.debug('Event store cleanup task stopped', {
        operation: 'event_store_cleanup_stop',
      });
    }
  }

  /**
   * Clear all events from the store
   */
  clear(): void {
    const count = this.events.size;
    this.events.clear();
    this.eventsByIdentifier.clear();

    logger.info('Event store cleared', {
      clearedCount: count,
      operation: 'event_store_clear',
    });
  }

  /**
   * Get store statistics
   */
  getStats(): {
    totalEvents: number;
    uniqueIdentifiers: number;
    oldestEventAge: number | null;
    newestEventAge: number | null;
    validatedCount: number;
    invalidatedCount: number;
  } {
    const now = Date.now();
    const allEvents = Array.from(this.events.values());

    let oldestAge: number | null = null;
    let newestAge: number | null = null;
    let validatedCount = 0;
    let invalidatedCount = 0;

    if (allEvents.length > 0) {
      const ages = allEvents.map(e => now - e.receivedAt.getTime());
      oldestAge = Math.max(...ages);
      newestAge = Math.min(...ages);

      validatedCount = allEvents.filter(e => e.validated).length;
      invalidatedCount = allEvents.length - validatedCount;
    }

    return {
      totalEvents: this.events.size,
      uniqueIdentifiers: this.eventsByIdentifier.size,
      oldestEventAge: oldestAge,
      newestEventAge: newestAge,
      validatedCount,
      invalidatedCount,
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): EventStoreConfig {
    return { ...this.config };
  }

  /**
   * Update configuration (requires restart of cleanup task)
   */
  updateConfig(config: Partial<EventStoreConfig>): void {
    this.config = { ...this.config, ...config };

    logger.info('Event store config updated', {
      newConfig: this.config,
      operation: 'event_store_config_update',
    });
  }
}

// Global singleton instance
let globalEventStore: WebhookEventStore | null = null;

/**
 * Initialize the global event store
 * @param config - Event store configuration
 */
export function initializeEventStore(config: EventStoreConfig): void {
  if (globalEventStore) {
    logger.warn('Event store already initialized, reinitializing', {
      operation: 'event_store_reinit',
    });
    globalEventStore.stopCleanupTask();
  }

  globalEventStore = new WebhookEventStore(config);
}

/**
 * Get the global event store instance
 * @throws Error if not initialized
 */
export function getEventStore(): WebhookEventStore {
  if (!globalEventStore) {
    throw new Error('Event store not initialized. Call initializeEventStore() first.');
  }
  return globalEventStore;
}

/**
 * Shutdown the event store (stop cleanup tasks)
 */
export function shutdownEventStore(): void {
  if (globalEventStore) {
    globalEventStore.stopCleanupTask();
    globalEventStore.clear();
    globalEventStore = null;

    logger.info('Event store shutdown complete', {
      operation: 'event_store_shutdown',
    });
  }
}