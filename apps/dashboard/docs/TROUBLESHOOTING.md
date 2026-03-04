# Troubleshooting Guide

Common issues and solutions for Crypto Data Aggregator.

---

## Table of Contents

- [Build Errors](#build-errors)
- [Runtime Errors](#runtime-errors)
- [API Issues](#api-issues)
- [PWA Issues](#pwa-issues)
- [Performance Issues](#performance-issues)
- [Data Issues](#data-issues)
- [Development Issues](#development-issues)

---

## Build Errors

### `Module not found: Can't resolve '@/...'`

**Cause:** Path alias not configured correctly.

**Solution:**

```json
// tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

---

### `Type error: Property 'X' does not exist on type 'Y'`

**Cause:** TypeScript type mismatch.

**Solutions:**

1. Check the API response shape matches your types
2. Add optional chaining: `data?.property`
3. Update type definitions in `src/lib/market-data.ts`

---

### `Build failed: Edge Runtime does not support 'fs'`

**Cause:** Using Node.js APIs in Edge Runtime.

**Solution:** Remove Node.js-only imports from API routes:

```typescript
// ❌ Won't work in Edge Runtime
import fs from 'fs';
import path from 'path';

// ✅ Use Edge-compatible alternatives
// - fetch() for HTTP requests
// - In-memory Map for caching
// - External DB for persistence
```

---

### `ENOMEM: not enough memory`

**Cause:** Build process ran out of memory.

**Solution:**

```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm run build
```

---

## Runtime Errors

### Hydration Mismatch Warning

**Cause:** Server and client render different content.

**Common Triggers:**

- Using `Date.now()` or `Math.random()` during render
- Accessing `localStorage` during SSR
- Browser-only APIs in server components

**Solutions:**

```tsx
// ❌ Causes hydration mismatch
function Component() {
  const time = Date.now(); // Different on server vs client
  return <div>{time}</div>;
}

// ✅ Use useEffect for client-only values
function Component() {
  const [time, setTime] = useState<number | null>(null);

  useEffect(() => {
    setTime(Date.now());
  }, []);

  if (time === null) return <Skeleton />;
  return <div>{time}</div>;
}
```

---

### `localStorage is not defined`

**Cause:** Accessing localStorage during server-side rendering.

**Solution:**

```typescript
// ✅ Safe localStorage access
function getFromStorage(key: string): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return localStorage.getItem(key);
}

// ✅ Or use useEffect
useEffect(() => {
  const data = localStorage.getItem('key');
  setData(data);
}, []);
```

---

### `Cannot read properties of undefined`

**Cause:** Accessing nested properties before data loads.

**Solution:**

```tsx
// ❌ Unsafe
const price = data.market_data.current_price.usd;

// ✅ Safe with optional chaining
const price = data?.market_data?.current_price?.usd ?? 0;

// ✅ Or check before rendering
if (!data?.market_data) {
  return <LoadingSpinner />;
}
```

---

## API Issues

### `429 Too Many Requests`

**Cause:** Hit external API rate limit.

**Solutions:**

1. **Wait and retry** - CoinGecko limits reset per minute
2. **Increase cache TTL** - Reduce API calls
3. **Use API key** - Get higher limits with CoinGecko Pro

```typescript
// Increase cache duration
newsCache.set(key, data, 600); // 10 minutes instead of 5
```

---

### `Failed to fetch` / Network Error

**Cause:** CORS issue or network problem.

**Diagnosis:**

```bash
# Test API directly
curl https://api.coingecko.com/api/v3/ping

# Check from server
curl http://localhost:3000/api/market/coins
```

**Solutions:**

1. Check internet connection
2. Verify API is not down
3. Check CORS configuration
4. Try a different network

---

### API Returns Stale Data

**Cause:** Aggressive caching.

**Solutions:**

```typescript
// Force fresh data with SWR
const { mutate } = useSWR('/api/market/coins');

// Revalidate
mutate();

// Or clear server cache
newsCache.delete('latest');
```

---

### Empty API Response

**Cause:** API returned no data or error was swallowed.

**Debug:**

```typescript
export async function GET(request: Request) {
  try {
    const data = await fetchData();
    console.log('API response:', data); // Add logging
    return jsonResponse(data);
  } catch (error) {
    console.error('API error:', error); // Log full error
    return errorResponse(error.message, 500);
  }
}
```

---

## PWA Issues

### App Not Installing

**Checklist:**

- [ ] HTTPS enabled (required for PWA)
- [ ] Valid `manifest.json` at `/manifest.json`
- [ ] Icons present (192x192 and 512x512)
- [ ] Service worker registered
- [ ] `start_url` accessible

**Debug:**

```javascript
// Check in browser console
navigator.serviceWorker.getRegistrations().then(console.log);
```

---

### Service Worker Not Updating

**Cause:** Browser caching old service worker.

**Solutions:**

1. **Hard refresh:** Cmd+Shift+R (Mac) / Ctrl+Shift+R (Windows)
2. **Unregister SW:**
   - DevTools → Application → Service Workers → Unregister
3. **Clear cache:**
   - DevTools → Application → Storage → Clear site data

---

### Push Notifications Not Working

**Checklist:**

- [ ] User granted permission
- [ ] Service worker active
- [ ] Push subscription created
- [ ] Valid VAPID keys (if using)

**Debug:**

```javascript
// Check permission
console.log(Notification.permission);

// Check service worker
navigator.serviceWorker.ready.then((reg) => {
  console.log('SW ready:', reg);
});
```

---

### Offline Mode Not Working

**Cause:** Pages not cached.

**Solutions:**

1. Visit pages while online first (to cache them)
2. Check cache in DevTools → Application → Cache Storage
3. Verify `sw.js` has correct cache strategies

---

## Performance Issues

### Slow Initial Load

**Diagnosis:**

```bash
# Analyze bundle size
npm run analyze
```

**Solutions:**

1. **Dynamic imports** for heavy components:

   ```tsx
   const HeavyChart = dynamic(() => import('./HeavyChart'), {
     loading: () => <Skeleton />,
   });
   ```

2. **Reduce third-party scripts**

3. **Optimize images:**
   ```tsx
   import Image from 'next/image';
   <Image src={url} width={100} height={100} loading="lazy" />;
   ```

---

### Memory Leak Warnings

**Cause:** State updates after component unmounts.

**Solution:**

```tsx
useEffect(() => {
  let cancelled = false;

  async function fetchData() {
    const data = await getData();
    if (!cancelled) {
      setData(data);
    }
  }

  fetchData();

  return () => {
    cancelled = true;
  };
}, []);
```

---

### Excessive Re-renders

**Diagnosis:**

```tsx
// Add to component
console.log('Render:', componentName);

// Or use React DevTools Profiler
```

**Solutions:**

1. **Memoize components:** `React.memo()`
2. **Memoize values:** `useMemo()`
3. **Memoize callbacks:** `useCallback()`
4. **Split context** to prevent unnecessary updates

---

## Data Issues

### Watchlist/Portfolio Not Saving

**Cause:** localStorage full or blocked.

**Diagnosis:**

```javascript
// Check localStorage usage
let total = 0;
for (let key in localStorage) {
  if (localStorage.hasOwnProperty(key)) {
    total += localStorage[key].length * 2; // UTF-16
  }
}
console.log('localStorage used:', (total / 1024).toFixed(2), 'KB');
```

**Solutions:**

1. Clear unused data: `localStorage.removeItem('old_key')`
2. Check if in private/incognito mode
3. Check if localStorage is disabled

---

### Prices Not Updating

**Cause:** WebSocket disconnected or SWR not revalidating.

**Solutions:**

```tsx
// Force refresh
const { mutate } = useSWR('/api/market/coins');
mutate();

// Check WebSocket status
const { isOnline } = usePWA();
console.log('Online:', isOnline);
```

---

### Missing Coin Data

**Cause:** Coin not in CoinGecko database or ID mismatch.

**Debug:**

```bash
# Search for coin
curl "https://api.coingecko.com/api/v3/search?query=coinname"
```

---

## Development Issues

### Hot Reload Not Working

**Solutions:**

1. Restart dev server: `npm run dev`
2. Clear `.next` folder: `rm -rf .next`
3. Check file is being watched (not in `.gitignore`)

---

### Tests Failing

**Common Fixes:**

```bash
# Clear test cache
npx vitest --clearCache

# Run with verbose output
npx vitest --reporter=verbose

# Run single test
npx vitest -t "test name"
```

---

### ESLint/Prettier Conflicts

**Solution:**

```bash
# Reset and reinstall
rm -rf node_modules package-lock.json
npm install

# Run format
npm run format
npm run lint:fix
```

---

### TypeScript Errors After npm install

**Solution:**

```bash
# Rebuild TypeScript
npm run typecheck

# If tsconfig issues, regenerate
npx tsc --init
# Then restore your settings
```

---

## Getting Help

### Collect Debug Info

Before asking for help, gather:

```bash
# System info
node -v
npm -v
cat package.json | grep "next\|react"

# Error logs
npm run build 2>&1 | tail -50

# Network check
curl -I https://api.coingecko.com/api/v3/ping
```

### Resources

- [GitHub Issues](https://github.com/nirholas/crypto-data-aggregator/issues)
- [Next.js Docs](https://nextjs.org/docs)
- [React Docs](https://react.dev)
- [CoinGecko API Docs](https://docs.coingecko.com)

---

## Related Documentation

- [Development Guide](./DEVELOPMENT.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [Architecture](./ARCHITECTURE.md)
