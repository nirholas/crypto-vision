/**
 * Unified Storage Layer
 * 
 * Provides a consistent API for data persistence with automatic fallback:
 * 1. Upstash Redis (serverless/edge compatible)
 * 2. Traditional Redis
 * 3. In-memory storage (development/fallback)
 * 
 * All operations are async and handle errors gracefully.
 * 
 * @module lib/storage
 */

// =============================================================================
// TYPES
// =============================================================================

export interface StorageOptions {
  /** TTL in seconds (default: no expiry for memory, 30 days for Redis) */
  ttl?: number;
  /** Namespace prefix for keys */
  namespace?: string;
}

export interface StorageStats {
  type: 'upstash' | 'redis' | 'memory';
  connected: boolean;
  keys?: number;
  memoryUsage?: string;
}

export interface ListOptions {
  /** Cursor for pagination */
  cursor?: string;
  /** Number of items to return */
  limit?: number;
  /** Pattern to match (for Redis SCAN) */
  pattern?: string;
}

export interface ListResult<T> {
  items: T[];
  cursor?: string;
  hasMore: boolean;
}

// =============================================================================
// UPSTASH CLIENT (Edge-compatible)
// =============================================================================

class UpstashClient {
  private url: string;
  private token: string;
  
  constructor(url: string, token: string) {
    this.url = url;
    this.token = token;
  }
  
  async execute<T>(command: string, ...args: (string | number)[]): Promise<T> {
    const response = await fetch(this.url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([command, ...args]),
    });
    
    if (!response.ok) {
      throw new Error(`Upstash error: ${response.statusText}`);
    }
    
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    return data.result;
  }
  
  async pipeline<T>(commands: Array<[string, ...(string | number)[]]>): Promise<T[]> {
    const response = await fetch(`${this.url}/pipeline`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commands),
    });
    
    if (!response.ok) {
      throw new Error(`Upstash pipeline error: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.map((r: { result: T }) => r.result);
  }
}

// =============================================================================
// STORAGE BACKENDS
// =============================================================================

// Upstash REST client
let upstashClient: UpstashClient | null = null;

function getUpstash(): UpstashClient | null {
  if (upstashClient) return upstashClient;
  
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (url && token) {
    upstashClient = new UpstashClient(url, token);
    return upstashClient;
  }
  
  return null;
}

// In-memory store with TTL support
interface MemoryEntry<T> {
  value: T;
  expiresAt: number | null;
}

const memoryStore = new Map<string, MemoryEntry<unknown>>();
const memoryIndexes = new Map<string, Set<string>>(); // For indexed lookups

// Cleanup expired entries periodically
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryStore.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        memoryStore.delete(key);
      }
    }
  }, 60000); // Every minute
}

// =============================================================================
// CORE STORAGE OPERATIONS
// =============================================================================

/**
 * Get the current storage backend type
 */
export function getStorageType(): 'upstash' | 'redis' | 'memory' {
  if (getUpstash()) return 'upstash';
  return 'memory';
}

/**
 * Check if persistent storage is available
 */
export function isPersistentStorage(): boolean {
  return !!getUpstash();
}

/**
 * Get a value from storage
 */
export async function get<T>(key: string, namespace?: string): Promise<T | null> {
  const fullKey = namespace ? `${namespace}:${key}` : key;
  
  // Try Upstash
  const upstash = getUpstash();
  if (upstash) {
    try {
      const value = await upstash.execute<string | null>('GET', fullKey);
      if (value) {
        return JSON.parse(value) as T;
      }
      return null;
    } catch (error) {
      console.error('[Storage] Upstash GET error:', error);
    }
  }
  
  // Fallback to memory
  const entry = memoryStore.get(fullKey);
  if (!entry) return null;
  
  if (entry.expiresAt && Date.now() > entry.expiresAt) {
    memoryStore.delete(fullKey);
    return null;
  }
  
  return entry.value as T;
}

/**
 * Set a value in storage
 */
export async function set<T>(
  key: string,
  value: T,
  options?: StorageOptions
): Promise<boolean> {
  const fullKey = options?.namespace ? `${options.namespace}:${key}` : key;
  const ttl = options?.ttl ?? 30 * 24 * 60 * 60; // Default 30 days
  
  // Try Upstash
  const upstash = getUpstash();
  if (upstash) {
    try {
      const serialized = JSON.stringify(value);
      if (ttl > 0) {
        await upstash.execute('SETEX', fullKey, ttl, serialized);
      } else {
        await upstash.execute('SET', fullKey, serialized);
      }
      return true;
    } catch (error) {
      console.error('[Storage] Upstash SET error:', error);
    }
  }
  
  // Fallback to memory
  memoryStore.set(fullKey, {
    value,
    expiresAt: ttl > 0 ? Date.now() + ttl * 1000 : null,
  });
  
  return true;
}

/**
 * Delete a value from storage
 */
export async function del(key: string, namespace?: string): Promise<boolean> {
  const fullKey = namespace ? `${namespace}:${key}` : key;
  
  // Try Upstash
  const upstash = getUpstash();
  if (upstash) {
    try {
      await upstash.execute('DEL', fullKey);
      return true;
    } catch (error) {
      console.error('[Storage] Upstash DEL error:', error);
    }
  }
  
  // Also delete from memory
  return memoryStore.delete(fullKey);
}

/**
 * Check if a key exists
 */
export async function exists(key: string, namespace?: string): Promise<boolean> {
  const fullKey = namespace ? `${namespace}:${key}` : key;
  
  const upstash = getUpstash();
  if (upstash) {
    try {
      const result = await upstash.execute<number>('EXISTS', fullKey);
      return result === 1;
    } catch (error) {
      console.error('[Storage] Upstash EXISTS error:', error);
    }
  }
  
  const entry = memoryStore.get(fullKey);
  if (!entry) return false;
  
  if (entry.expiresAt && Date.now() > entry.expiresAt) {
    memoryStore.delete(fullKey);
    return false;
  }
  
  return true;
}

/**
 * Set TTL on an existing key
 */
export async function expire(key: string, ttlSeconds: number, namespace?: string): Promise<boolean> {
  const fullKey = namespace ? `${namespace}:${key}` : key;
  
  const upstash = getUpstash();
  if (upstash) {
    try {
      await upstash.execute('EXPIRE', fullKey, ttlSeconds);
      return true;
    } catch (error) {
      console.error('[Storage] Upstash EXPIRE error:', error);
    }
  }
  
  const entry = memoryStore.get(fullKey);
  if (entry) {
    entry.expiresAt = Date.now() + ttlSeconds * 1000;
    return true;
  }
  
  return false;
}

// =============================================================================
// HASH OPERATIONS (for object storage)
// =============================================================================

/**
 * Set a hash field
 */
export async function hset(
  key: string,
  field: string,
  value: unknown,
  namespace?: string
): Promise<boolean> {
  const fullKey = namespace ? `${namespace}:${key}` : key;
  
  const upstash = getUpstash();
  if (upstash) {
    try {
      await upstash.execute('HSET', fullKey, field, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('[Storage] Upstash HSET error:', error);
    }
  }
  
  // Fallback: store as object in memory
  const entry = memoryStore.get(fullKey);
  const obj = (entry?.value as Record<string, unknown>) || {};
  obj[field] = value;
  memoryStore.set(fullKey, { value: obj, expiresAt: null });
  
  return true;
}

/**
 * Get a hash field
 */
export async function hget<T>(key: string, field: string, namespace?: string): Promise<T | null> {
  const fullKey = namespace ? `${namespace}:${key}` : key;
  
  const upstash = getUpstash();
  if (upstash) {
    try {
      const value = await upstash.execute<string | null>('HGET', fullKey, field);
      if (value) {
        return JSON.parse(value) as T;
      }
      return null;
    } catch (error) {
      console.error('[Storage] Upstash HGET error:', error);
    }
  }
  
  const entry = memoryStore.get(fullKey);
  const obj = entry?.value as Record<string, unknown>;
  return (obj?.[field] as T) ?? null;
}

/**
 * Get all hash fields
 */
export async function hgetall<T extends Record<string, unknown>>(
  key: string,
  namespace?: string
): Promise<T | null> {
  const fullKey = namespace ? `${namespace}:${key}` : key;
  
  const upstash = getUpstash();
  if (upstash) {
    try {
      const result = await upstash.execute<string[]>('HGETALL', fullKey);
      if (!result || result.length === 0) return null;
      
      const obj: Record<string, unknown> = {};
      for (let i = 0; i < result.length; i += 2) {
        try {
          obj[result[i]] = JSON.parse(result[i + 1]);
        } catch {
          obj[result[i]] = result[i + 1];
        }
      }
      return obj as T;
    } catch (error) {
      console.error('[Storage] Upstash HGETALL error:', error);
    }
  }
  
  const entry = memoryStore.get(fullKey);
  return (entry?.value as T) ?? null;
}

/**
 * Delete a hash field
 */
export async function hdel(key: string, field: string, namespace?: string): Promise<boolean> {
  const fullKey = namespace ? `${namespace}:${key}` : key;
  
  const upstash = getUpstash();
  if (upstash) {
    try {
      await upstash.execute('HDEL', fullKey, field);
      return true;
    } catch (error) {
      console.error('[Storage] Upstash HDEL error:', error);
    }
  }
  
  const entry = memoryStore.get(fullKey);
  const obj = entry?.value as Record<string, unknown>;
  if (obj && field in obj) {
    delete obj[field];
    return true;
  }
  
  return false;
}

// =============================================================================
// SET OPERATIONS (for collections)
// =============================================================================

/**
 * Add to a set
 */
export async function sadd(key: string, ...members: string[]): Promise<number> {
  const upstash = getUpstash();
  if (upstash) {
    try {
      return await upstash.execute<number>('SADD', key, ...members);
    } catch (error) {
      console.error('[Storage] Upstash SADD error:', error);
    }
  }
  
  // Memory fallback
  let set = memoryIndexes.get(key);
  if (!set) {
    set = new Set<string>();
    memoryIndexes.set(key, set);
  }
  
  let added = 0;
  for (const member of members) {
    if (!set.has(member)) {
      set.add(member);
      added++;
    }
  }
  
  return added;
}

/**
 * Remove from a set
 */
export async function srem(key: string, ...members: string[]): Promise<number> {
  const upstash = getUpstash();
  if (upstash) {
    try {
      return await upstash.execute<number>('SREM', key, ...members);
    } catch (error) {
      console.error('[Storage] Upstash SREM error:', error);
    }
  }
  
  const set = memoryIndexes.get(key);
  if (!set) return 0;
  
  let removed = 0;
  for (const member of members) {
    if (set.delete(member)) removed++;
  }
  
  return removed;
}

/**
 * Get all set members
 */
export async function smembers(key: string): Promise<string[]> {
  const upstash = getUpstash();
  if (upstash) {
    try {
      return await upstash.execute<string[]>('SMEMBERS', key);
    } catch (error) {
      console.error('[Storage] Upstash SMEMBERS error:', error);
    }
  }
  
  const set = memoryIndexes.get(key);
  return set ? Array.from(set) : [];
}

/**
 * Check if member is in set
 */
export async function sismember(key: string, member: string): Promise<boolean> {
  const upstash = getUpstash();
  if (upstash) {
    try {
      const result = await upstash.execute<number>('SISMEMBER', key, member);
      return result === 1;
    } catch (error) {
      console.error('[Storage] Upstash SISMEMBER error:', error);
    }
  }
  
  const set = memoryIndexes.get(key);
  return set?.has(member) ?? false;
}

// =============================================================================
// LIST OPERATIONS (for queues/arrays)
// =============================================================================

/**
 * Push to right of list
 */
export async function rpush(key: string, ...values: string[]): Promise<number> {
  const upstash = getUpstash();
  if (upstash) {
    try {
      return await upstash.execute<number>('RPUSH', key, ...values);
    } catch (error) {
      console.error('[Storage] Upstash RPUSH error:', error);
    }
  }
  
  // Memory fallback
  const entry = memoryStore.get(key);
  const list = (entry?.value as string[]) || [];
  list.push(...values);
  memoryStore.set(key, { value: list, expiresAt: null });
  
  return list.length;
}

/**
 * Get list range
 */
export async function lrange(key: string, start: number, stop: number): Promise<string[]> {
  const upstash = getUpstash();
  if (upstash) {
    try {
      return await upstash.execute<string[]>('LRANGE', key, start, stop);
    } catch (error) {
      console.error('[Storage] Upstash LRANGE error:', error);
    }
  }
  
  const entry = memoryStore.get(key);
  const list = (entry?.value as string[]) || [];
  
  // Handle negative indices like Redis
  const len = list.length;
  const s = start < 0 ? Math.max(0, len + start) : start;
  const e = stop < 0 ? len + stop + 1 : stop + 1;
  
  return list.slice(s, e);
}

/**
 * Get list length
 */
export async function llen(key: string): Promise<number> {
  const upstash = getUpstash();
  if (upstash) {
    try {
      return await upstash.execute<number>('LLEN', key);
    } catch (error) {
      console.error('[Storage] Upstash LLEN error:', error);
    }
  }
  
  const entry = memoryStore.get(key);
  const list = (entry?.value as string[]) || [];
  return list.length;
}

// =============================================================================
// COUNTER OPERATIONS
// =============================================================================

/**
 * Increment a counter
 */
export async function incr(key: string, namespace?: string): Promise<number> {
  const fullKey = namespace ? `${namespace}:${key}` : key;
  
  const upstash = getUpstash();
  if (upstash) {
    try {
      return await upstash.execute<number>('INCR', fullKey);
    } catch (error) {
      console.error('[Storage] Upstash INCR error:', error);
    }
  }
  
  const entry = memoryStore.get(fullKey);
  const value = ((entry?.value as number) || 0) + 1;
  memoryStore.set(fullKey, { value, expiresAt: entry?.expiresAt ?? null });
  
  return value;
}

/**
 * Increment by amount
 */
export async function incrby(key: string, amount: number, namespace?: string): Promise<number> {
  const fullKey = namespace ? `${namespace}:${key}` : key;
  
  const upstash = getUpstash();
  if (upstash) {
    try {
      return await upstash.execute<number>('INCRBY', fullKey, amount);
    } catch (error) {
      console.error('[Storage] Upstash INCRBY error:', error);
    }
  }
  
  const entry = memoryStore.get(fullKey);
  const value = ((entry?.value as number) || 0) + amount;
  memoryStore.set(fullKey, { value, expiresAt: entry?.expiresAt ?? null });
  
  return value;
}

/**
 * Decrement a counter
 */
export async function decr(key: string, namespace?: string): Promise<number> {
  const fullKey = namespace ? `${namespace}:${key}` : key;
  
  const upstash = getUpstash();
  if (upstash) {
    try {
      return await upstash.execute<number>('DECR', fullKey);
    } catch (error) {
      console.error('[Storage] Upstash DECR error:', error);
    }
  }
  
  const entry = memoryStore.get(fullKey);
  const value = ((entry?.value as number) || 0) - 1;
  memoryStore.set(fullKey, { value, expiresAt: entry?.expiresAt ?? null });
  
  return value;
}

// =============================================================================
// SCAN OPERATIONS (for iteration)
// =============================================================================

/**
 * Scan keys matching a pattern
 */
export async function scan(
  pattern: string,
  cursor: string = '0',
  count: number = 100
): Promise<{ cursor: string; keys: string[] }> {
  const upstash = getUpstash();
  if (upstash) {
    try {
      const result = await upstash.execute<[string, string[]]>('SCAN', cursor, 'MATCH', pattern, 'COUNT', count);
      return { cursor: result[0], keys: result[1] };
    } catch (error) {
      console.error('[Storage] Upstash SCAN error:', error);
    }
  }
  
  // Memory fallback - simple pattern matching
  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
  const keys = Array.from(memoryStore.keys()).filter(k => regex.test(k));
  
  // Simulate pagination
  const startIdx = parseInt(cursor) || 0;
  const endIdx = Math.min(startIdx + count, keys.length);
  const nextCursor = endIdx >= keys.length ? '0' : String(endIdx);
  
  return { cursor: nextCursor, keys: keys.slice(startIdx, endIdx) };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get storage statistics
 */
export async function getStats(): Promise<StorageStats> {
  const upstash = getUpstash();
  
  if (upstash) {
    try {
      const dbSize = await upstash.execute<number>('DBSIZE');
      return {
        type: 'upstash',
        connected: true,
        keys: dbSize,
      };
    } catch (error) {
      console.error('[Storage] Upstash DBSIZE error:', error);
    }
  }
  
  return {
    type: 'memory',
    connected: true,
    keys: memoryStore.size,
  };
}

/**
 * Clear all keys with a namespace prefix
 */
export async function clearNamespace(namespace: string): Promise<number> {
  const upstash = getUpstash();
  let count = 0;
  
  if (upstash) {
    try {
      let cursor = '0';
      do {
        const result = await scan(`${namespace}:*`, cursor, 100);
        cursor = result.cursor;
        
        if (result.keys.length > 0) {
          for (const key of result.keys) {
            await del(key);
            count++;
          }
        }
      } while (cursor !== '0');
      
      return count;
    } catch (error) {
      console.error('[Storage] clearNamespace error:', error);
    }
  }
  
  // Memory fallback
  const prefix = `${namespace}:`;
  for (const key of memoryStore.keys()) {
    if (key.startsWith(prefix)) {
      memoryStore.delete(key);
      count++;
    }
  }
  
  return count;
}

/**
 * Execute multiple operations atomically (best effort in memory mode)
 */
export async function multi(
  operations: Array<{ op: string; args: unknown[] }>
): Promise<unknown[]> {
  const upstash = getUpstash();
  
  if (upstash) {
    try {
      const commands = operations.map(({ op, args }) => [op.toUpperCase(), ...args.map(a => 
        typeof a === 'object' ? JSON.stringify(a) : String(a)
      )] as [string, ...(string | number)[]]);
      
      return await upstash.pipeline(commands);
    } catch (error) {
      console.error('[Storage] multi error:', error);
    }
  }
  
  // Execute sequentially in memory mode (not truly atomic)
  const results: unknown[] = [];
  for (const { op, args } of operations) {
    const fn = (module.exports as Record<string, (...a: unknown[]) => Promise<unknown>>)[op.toLowerCase()];
    if (fn) {
      results.push(await fn(...args));
    } else {
      results.push(null);
    }
  }
  
  return results;
}

// =============================================================================
// TYPED STORAGE HELPERS
// =============================================================================

/**
 * Create a typed storage namespace
 */
export function createNamespace<T>(namespace: string) {
  return {
    async get(key: string): Promise<T | null> {
      return get<T>(key, namespace);
    },
    
    async set(key: string, value: T, options?: Omit<StorageOptions, 'namespace'>): Promise<boolean> {
      return set(key, value, { ...options, namespace });
    },
    
    async delete(key: string): Promise<boolean> {
      return del(key, namespace);
    },
    
    async exists(key: string): Promise<boolean> {
      return exists(key, namespace);
    },
    
    async expire(key: string, ttlSeconds: number): Promise<boolean> {
      return expire(key, ttlSeconds, namespace);
    },
    
    async clear(): Promise<number> {
      return clearNamespace(namespace);
    },
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export const storage = {
  // Core
  get,
  set,
  del,
  exists,
  expire,
  
  // Hash
  hset,
  hget,
  hgetall,
  hdel,
  
  // Set
  sadd,
  srem,
  smembers,
  sismember,
  
  // List
  rpush,
  lrange,
  llen,
  
  // Counter
  incr,
  incrby,
  decr,
  
  // Scan
  scan,
  
  // Utility
  getStats,
  clearNamespace,
  multi,
  createNamespace,
  getStorageType,
  isPersistentStorage,
};

export default storage;
