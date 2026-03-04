# Development Guide

Local setup, debugging, and development workflow.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Debugging](#debugging)
- [Code Style](#code-style)
- [Common Issues](#common-issues)
- [Contributing](#contributing)

---

## Prerequisites

### Required

- **Node.js** 18.0.0 or higher
- **npm** 9+ (or yarn/pnpm)
- **Git**

### Recommended

- **VS Code** with extensions:
  - ESLint
  - Tailwind CSS IntelliSense
  - TypeScript Vue Plugin (Volar)
  - Prettier

### Verify Installation

```bash
node --version   # v18.0.0+
npm --version    # 9+
git --version    # 2.0+
```

---

## Quick Start

```bash
# Clone repository
git clone https://github.com/nirholas/crypto-data-aggregator.git
cd crypto-data-aggregator

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Project Structure

```
crypto-data-aggregator/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/                # API routes
│   │   │   ├── market/         # Market data endpoints
│   │   │   ├── defi/           # DeFi endpoints
│   │   │   └── ...
│   │   ├── coin/[coinId]/      # Dynamic routes
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Home page
│   │   └── globals.css         # Global styles
│   │
│   ├── components/             # React components
│   │   ├── alerts/             # Alert system
│   │   ├── cards/              # Card components
│   │   ├── charts/             # Chart components
│   │   └── ...
│   │
│   └── lib/                    # Core utilities
│       ├── market-data.ts      # API client
│       ├── cache.ts            # Caching
│       ├── portfolio.ts        # Portfolio logic
│       └── ...
│
├── public/                     # Static assets
├── docs/                       # Documentation
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── vitest.config.ts
```

### Key Files

| File                                       | Purpose                           |
| ------------------------------------------ | --------------------------------- |
| `src/lib/market-data.ts`                   | CoinGecko/DeFiLlama API client    |
| `src/lib/cache.ts`                         | In-memory cache with TTL          |
| `src/lib/api-utils.ts`                     | Response helpers, ETag generation |
| `src/app/api/*/route.ts`                   | API route handlers                |
| `src/components/ThemeProvider.tsx`         | Dark/light mode context           |
| `src/components/alerts/AlertsProvider.tsx` | Price alerts context              |

---

## Development Workflow

### Available Scripts

```bash
# Development
npm run dev          # Start dev server with hot reload

# Building
npm run build        # Production build
npm start            # Start production server

# Testing
npm test             # Run tests in watch mode
npm run test:run     # Run tests once
npm run test:ui      # Open Vitest UI
npm run test:coverage # Generate coverage report

# Code Quality
npm run lint         # ESLint check
npm run lint -- --fix # Auto-fix lint issues

# Analysis
npm run analyze      # Bundle analysis (ANALYZE=true)
```

### Hot Reload

The dev server supports Fast Refresh:

- **Components**: Instant updates, state preserved
- **API Routes**: Automatic reload on save
- **CSS**: Instant style updates

### Environment Variables

Create `.env.local` for local overrides:

```env
# Optional: Higher rate limits
COINGECKO_API_KEY=your_key

# Optional: Use Pro API
COINGECKO_BASE_URL=https://pro-api.coingecko.com/api/v3
```

---

## Testing

### Test Stack

- **Vitest** - Test runner
- **Testing Library** - React component testing
- **jsdom** - DOM simulation

### Running Tests

```bash
# Watch mode (default)
npm test

# Single run
npm run test:run

# With coverage
npm run test:coverage

# Interactive UI
npm run test:ui
```

### Writing Tests

```typescript
// src/lib/market-data.test.ts
import { describe, it, expect, vi } from 'vitest';
import { getTopCoins, formatPrice } from './market-data';

describe('formatPrice', () => {
  it('formats large prices correctly', () => {
    expect(formatPrice(45000)).toBe('$45,000');
  });

  it('formats small prices with decimals', () => {
    expect(formatPrice(0.00005)).toBe('$0.00005');
  });

  it('handles null values', () => {
    expect(formatPrice(null)).toBe('$0.00');
  });
});

describe('getTopCoins', () => {
  it('returns array of coins', async () => {
    const coins = await getTopCoins(10);
    expect(Array.isArray(coins)).toBe(true);
  });
});
```

### Mocking API Calls

```typescript
import { vi } from 'vitest';

// Mock fetch
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve([{ id: 'bitcoin', name: 'Bitcoin' }]),
  })
) as any;
```

### Test Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './vitest.setup.ts',
    include: ['**/*.test.{ts,tsx}'],
  },
});
```

---

## Debugging

### VS Code Launch Configuration

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js: debug server-side",
      "type": "node-terminal",
      "request": "launch",
      "command": "npm run dev"
    },
    {
      "name": "Next.js: debug client-side",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:3000"
    },
    {
      "name": "Next.js: debug full stack",
      "type": "node-terminal",
      "request": "launch",
      "command": "npm run dev",
      "serverReadyAction": {
        "pattern": "started server on .+, url: (https?://.+)",
        "uriFormat": "%s",
        "action": "debugWithChrome"
      }
    }
  ]
}
```

### API Route Debugging

Add debug logging:

```typescript
// src/app/api/market/coins/route.ts
export async function GET(request: NextRequest) {
  console.log('[API] /market/coins', {
    params: Object.fromEntries(request.nextUrl.searchParams),
    timestamp: new Date().toISOString(),
  });

  // ... handler code
}
```

### Cache Debugging

```typescript
import { newsCache } from '@/lib/cache';

// Check cache stats
console.log('Cache stats:', newsCache.stats());

// Clear cache for testing
newsCache.clear();
```

### Network Debugging

Use browser DevTools:

1. Open Network tab
2. Filter by `Fetch/XHR`
3. Inspect request/response

For server-side:

```typescript
// Add timing to API responses
import { withTiming } from '@/lib/api-utils';

const startTime = Date.now();
const data = await fetchData();
return Response.json(withTiming(data, startTime));
// Response includes { _meta: { responseTimeMs: 45 } }
```

---

## Code Style

### TypeScript

- Strict mode enabled
- No `any` types (use `unknown` or proper types)
- Explicit return types for exported functions

```typescript
// Good
export function formatPrice(price: number | null): string {
  // ...
}

// Avoid
export function formatPrice(price) {
  // ...
}
```

### React Components

- Functional components only
- Use TypeScript interfaces for props
- Prefer named exports

```typescript
// Good
interface CoinCardProps {
  coin: TokenPrice;
  onClick?: () => void;
}

export function CoinCard({ coin, onClick }: CoinCardProps) {
  return <div onClick={onClick}>{coin.name}</div>;
}
```

### File Naming

- Components: `PascalCase.tsx`
- Utilities: `kebab-case.ts`
- Tests: `*.test.ts` or `*.test.tsx`

### Imports

Order imports:

1. React/Next.js
2. External packages
3. Internal components (`@/components/`)
4. Internal utilities (`@/lib/`)
5. Types
6. Styles

```typescript
import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Loader } from 'lucide-react';

import { CoinCard } from '@/components/cards/CoinCard';
import { getTopCoins } from '@/lib/market-data';
import type { TokenPrice } from '@/lib/market-data';
```

### ESLint

Run lint check:

```bash
npm run lint
```

Fix auto-fixable issues:

```bash
npm run lint -- --fix
```

---

## Common Issues

### Rate Limiting

**Symptom**: API returns 429 errors

**Solution**:

1. Wait for rate limit window (60s)
2. Add `COINGECKO_API_KEY` for higher limits
3. Increase cache TTLs

```typescript
// Check rate limit status
import { rateLimitState } from '@/lib/market-data';
console.log('Requests this window:', rateLimitState.requestCount);
```

### Hydration Errors

**Symptom**: "Text content does not match server-rendered HTML"

**Cause**: Client/server render mismatch

**Solution**: Use `useEffect` for client-only data

```typescript
// Wrong
function Component() {
  return <div>{Date.now()}</div>; // Different on client/server
}

// Correct
function Component() {
  const [time, setTime] = useState<number | null>(null);

  useEffect(() => {
    setTime(Date.now());
  }, []);

  return <div>{time ?? 'Loading...'}</div>;
}
```

### localStorage SSR Errors

**Symptom**: "localStorage is not defined"

**Solution**: Check for browser environment

```typescript
// In hooks or utilities
if (typeof window === 'undefined') return [];

// Or use useEffect
useEffect(() => {
  const stored = localStorage.getItem('key');
  // ...
}, []);
```

### Build Failures

**Symptom**: `npm run build` fails

**Solutions**:

1. Check TypeScript errors:

   ```bash
   npx tsc --noEmit
   ```

2. Clear cache:

   ```bash
   rm -rf .next node_modules/.cache
   npm run build
   ```

3. Check for missing dependencies:
   ```bash
   npm ci
   ```

### Module Not Found

**Symptom**: "Cannot find module '@/lib/...'"

**Solution**: Check `tsconfig.json` paths:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### API Route Errors

**Symptom**: 500 error on API routes

**Debug**:

```bash
# Check server logs
npm run dev

# Look for errors in terminal output
```

**Common fixes**:

1. Ensure Edge Runtime compatibility (no Node.js APIs)
2. Check async/await handling
3. Verify external API responses

---

## Contributing

### Branch Strategy

- `main` - Production branch
- `feature/*` - New features
- `fix/*` - Bug fixes
- `docs/*` - Documentation

### Pull Request Process

1. Fork and clone
2. Create feature branch
3. Make changes
4. Run tests: `npm run test:run`
5. Run lint: `npm run lint`
6. Build: `npm run build`
7. Commit with descriptive message
8. Open PR against `main`

### Commit Messages

Follow conventional commits:

```
feat: add portfolio export feature
fix: resolve hydration error in CoinCard
docs: update API documentation
refactor: simplify cache logic
test: add market-data unit tests
```

### Code Review Checklist

- [ ] TypeScript types are correct
- [ ] Tests pass
- [ ] No ESLint errors
- [ ] Build succeeds
- [ ] Documentation updated (if needed)
- [ ] No console.log statements

---

## Tips

### Performance Profiling

```bash
# Analyze bundle size
ANALYZE=true npm run build
```

### Useful Extensions

VS Code extensions for this project:

```json
// .vscode/extensions.json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "vitest.explorer"
  ]
}
```

### Quick Commands

```bash
# Reinstall dependencies
rm -rf node_modules && npm install

# Reset Next.js cache
rm -rf .next

# Full clean rebuild
rm -rf .next node_modules && npm install && npm run build

# Check for outdated packages
npm outdated

# Update packages
npm update
```
