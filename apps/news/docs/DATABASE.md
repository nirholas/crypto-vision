# 🗄️ Database Layer

Unified database abstraction supporting multiple backends for data persistence.

## Overview

The database layer (`src/lib/database.ts`) provides a consistent API across different storage backends:

- **Vercel KV** - Production Redis-compatible key-value store
- **Upstash Redis** - Serverless Redis alternative
- **Memory** - In-memory storage for development/testing
- **File** - File-based JSON storage for local development

## Quick Start

```typescript
import { 
  db, 
  setItem, 
  getItem, 
  deleteItem, 
  listKeys,
  getDatabaseInfo 
} from '@/lib/database';

// Store data
await setItem('user:123', { name: 'Alice', tier: 'pro' });

// Retrieve data
const user = await getItem<{ name: string; tier: string }>('user:123');

// Delete data
await deleteItem('user:123');

// List keys by pattern
const userKeys = await listKeys('user:*');

// Get database info
const info = await getDatabaseInfo();
// { backend: 'vercel-kv', connected: true, keyCount: 1234 }
```

---

## Configuration

The database backend is automatically selected based on environment variables:

```bash
# Option 1: Vercel KV (recommended for production)
KV_REST_API_URL=https://your-kv.vercel-storage.com
KV_REST_API_TOKEN=your_token

# Option 2: Upstash Redis
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token

# Option 3: File storage (local development)
DATABASE_FILE_PATH=./data/database.json

# Option 4: Memory (default fallback)
# No configuration needed - data persists only for session
```

### Backend Priority

1. **Vercel KV** - If `KV_REST_API_URL` is set
2. **Upstash** - If `UPSTASH_REDIS_REST_URL` is set
3. **File** - If `DATABASE_FILE_PATH` is set
4. **Memory** - Default fallback

---

## API Reference

### Core Functions

#### `setItem<T>(key: string, value: T, options?: SetOptions): Promise<void>`

Store a value with optional expiration.

```typescript
// Simple set
await setItem('config:theme', 'dark');

// With expiration (seconds)
await setItem('session:abc', { userId: '123' }, { ex: 3600 }); // 1 hour

// With expiration (milliseconds)
await setItem('cache:prices', priceData, { px: 60000 }); // 1 minute
```

#### `getItem<T>(key: string): Promise<T | null>`

Retrieve a value by key.

```typescript
const user = await getItem<User>('user:123');
if (user) {
  console.log(user.name);
}
```

#### `deleteItem(key: string): Promise<boolean>`

Delete a key. Returns `true` if deleted.

```typescript
const deleted = await deleteItem('user:123');
```

#### `listKeys(pattern?: string): Promise<string[]>`

List keys matching a pattern (supports `*` wildcard).

```typescript
// All keys
const all = await listKeys();

// Keys matching pattern
const userKeys = await listKeys('user:*');
const alertKeys = await listKeys('alert:*:active');
```

#### `exists(key: string): Promise<boolean>`

Check if a key exists.

```typescript
if (await exists('user:123')) {
  // User exists
}
```

### Batch Operations

#### `setMany(items: Record<string, unknown>): Promise<void>`

Set multiple keys at once.

```typescript
await setMany({
  'user:1': { name: 'Alice' },
  'user:2': { name: 'Bob' },
  'config:version': '2.0',
});
```

#### `getMany<T>(keys: string[]): Promise<(T | null)[]>`

Get multiple values at once.

```typescript
const [user1, user2] = await getMany<User>(['user:1', 'user:2']);
```

#### `deleteMany(keys: string[]): Promise<number>`

Delete multiple keys. Returns count of deleted keys.

```typescript
const deletedCount = await deleteMany(['user:1', 'user:2', 'user:3']);
```

### Hash Operations

#### `hset(key: string, field: string, value: unknown): Promise<void>`

Set a hash field.

```typescript
await hset('user:123', 'email', 'alice@example.com');
await hset('user:123', 'tier', 'pro');
```

#### `hget<T>(key: string, field: string): Promise<T | null>`

Get a hash field.

```typescript
const email = await hget<string>('user:123', 'email');
```

#### `hgetall<T>(key: string): Promise<T | null>`

Get all hash fields.

```typescript
const user = await hgetall<User>('user:123');
// { email: 'alice@example.com', tier: 'pro' }
```

### Utility Functions

#### `getDatabaseInfo(): Promise<DatabaseInfo>`

Get database status and statistics.

```typescript
const info = await getDatabaseInfo();
// {
//   backend: 'vercel-kv',
//   connected: true,
//   keyCount: 1234,
//   memoryUsage: '12.5 MB'
// }
```

#### `clearAll(): Promise<void>`

Clear all data (use with caution!).

```typescript
// Only in development!
if (process.env.NODE_ENV === 'development') {
  await clearAll();
}
```

---

## Key Naming Conventions

Use consistent key prefixes for organization:

| Prefix | Description | Example |
|--------|-------------|---------|
| `user:` | User data | `user:123` |
| `session:` | User sessions | `session:abc123` |
| `alert:` | Price/news alerts | `alert:456` |
| `portfolio:` | User portfolios | `portfolio:user:123` |
| `cache:` | Cached API responses | `cache:prices:btc` |
| `config:` | Application config | `config:features` |
| `rate:` | Rate limiting | `rate:api:123:1706140800` |
| `newsletter:` | Newsletter subscriptions | `newsletter:email@example.com` |
| `apikey:` | API keys | `apikey:sk_live_abc123` |

---

## ID Generation

Use the secure ID utilities for all identifiers:

```typescript
import { 
  generateId, 
  generateShortId, 
  generateVerificationToken,
  isValidId 
} from '@/lib/utils/id';

// Standard UUID (36 chars)
const id = generateId();
// "550e8400-e29b-41d4-a716-446655440000"

// With prefix
const alertId = generateId('alert');
// "alert_550e8400-e29b-41d4-a716-446655440000"

// Short ID (8 chars, for display)
const shortId = generateShortId();
// "a1b2c3d4"

// With prefix
const token = generateShortId('tok');
// "tok_a1b2c3d4"

// Verification token (32 chars hex)
const verifyToken = generateVerificationToken();
// "a1b2c3d4e5f6..."

// Validate ID format
isValidId('alert_550e8400-e29b-41d4-a716-446655440000', 'alert');
// true
```

### Why crypto.randomUUID()?

- **Cryptographically secure** - Uses OS entropy source
- **No collisions** - UUID v4 has 2^122 possible values
- **Standard format** - Compatible with databases and APIs
- **Fast** - Native implementation in Node.js/browsers

---

## Usage Examples

### User Management

```typescript
import { setItem, getItem, deleteItem, listKeys } from '@/lib/database';
import { generateId } from '@/lib/utils/id';

interface User {
  id: string;
  email: string;
  tier: 'free' | 'pro' | 'enterprise';
  createdAt: string;
}

// Create user
async function createUser(email: string, tier: User['tier']): Promise<User> {
  const user: User = {
    id: generateId('user'),
    email,
    tier,
    createdAt: new Date().toISOString(),
  };
  
  await setItem(`user:${user.id}`, user);
  await setItem(`user:email:${email}`, user.id); // Email index
  
  return user;
}

// Get user by ID
async function getUser(id: string): Promise<User | null> {
  return getItem<User>(`user:${id}`);
}

// Get user by email
async function getUserByEmail(email: string): Promise<User | null> {
  const id = await getItem<string>(`user:email:${email}`);
  if (!id) return null;
  return getUser(id);
}

// List all users
async function listUsers(): Promise<User[]> {
  const keys = await listKeys('user:user_*'); // Only user IDs, not indexes
  const users = await Promise.all(
    keys.map(key => getItem<User>(key))
  );
  return users.filter((u): u is User => u !== null);
}
```

### Caching with Expiration

```typescript
import { setItem, getItem } from '@/lib/database';

async function getCachedPrices(symbols: string[]): Promise<Record<string, number>> {
  const cacheKey = `cache:prices:${symbols.sort().join(',')}`;
  
  // Try cache first
  const cached = await getItem<Record<string, number>>(cacheKey);
  if (cached) return cached;
  
  // Fetch fresh data
  const prices = await fetchPricesFromAPI(symbols);
  
  // Cache for 60 seconds
  await setItem(cacheKey, prices, { ex: 60 });
  
  return prices;
}
```

### Rate Limiting

```typescript
import { getItem, setItem } from '@/lib/database';

async function checkRateLimit(
  userId: string, 
  limit: number, 
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number }> {
  const window = Math.floor(Date.now() / 1000 / windowSeconds);
  const key = `rate:${userId}:${window}`;
  
  const current = await getItem<number>(key) || 0;
  
  if (current >= limit) {
    return { allowed: false, remaining: 0 };
  }
  
  await setItem(key, current + 1, { ex: windowSeconds });
  
  return { allowed: true, remaining: limit - current - 1 };
}
```

---

## Backend-Specific Notes

### Vercel KV

- Requires Vercel deployment or local Vercel CLI
- Automatically handles connection pooling
- Supports all Redis commands
- 256 MB storage on Hobby plan

### Upstash Redis

- Serverless, pay-per-request pricing
- REST API (no persistent connections needed)
- Global edge locations
- 10,000 commands/day on free tier

### File Storage

- JSON file persisted to disk
- Good for local development
- No expiration support (keys persist forever)
- Not suitable for production

### Memory Storage

- Data lost on restart
- Useful for testing
- No network overhead
- Unlimited storage (within memory limits)

---

## Migration Guide

### From Direct Redis to Database Layer

**Before:**
```typescript
import { kv } from '@vercel/kv';

await kv.set('user:123', userData);
const user = await kv.get('user:123');
```

**After:**
```typescript
import { setItem, getItem } from '@/lib/database';

await setItem('user:123', userData);
const user = await getItem('user:123');
```

### From In-Memory Maps

**Before:**
```typescript
const users = new Map<string, User>();
users.set('123', userData);
const user = users.get('123');
```

**After:**
```typescript
import { setItem, getItem } from '@/lib/database';

await setItem('user:123', userData);
const user = await getItem<User>('user:123');
```

---

## Testing

Use memory backend for tests:

```typescript
// vitest.setup.ts
process.env.DATABASE_BACKEND = 'memory';

// test file
import { setItem, getItem, clearAll } from '@/lib/database';

beforeEach(async () => {
  await clearAll();
});

test('stores and retrieves data', async () => {
  await setItem('test:key', { value: 42 });
  const data = await getItem<{ value: number }>('test:key');
  expect(data?.value).toBe(42);
});
```
