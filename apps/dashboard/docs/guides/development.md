# Development Guide

Set up your local development environment and learn the development workflow.

---

## Prerequisites

| Requirement | Version | Purpose |
|-------------|---------|---------|
| Node.js | 18+ | Runtime environment |
| pnpm | 9+ | Package manager |
| Git | 2.30+ | Version control |
| VS Code | Latest | Recommended IDE |

---

## Quick Start

```bash
# Clone the repository
git clone https://github.com/manicinc/crypto-data-aggregator.git
cd crypto-data-aggregator

# Install dependencies
pnpm install

# Set up environment
cp .env.example .env.local

# Start development server
pnpm dev
```

The app will be available at `http://localhost:3000`.

---

## Project Structure

```
crypto-data-aggregator/
├── src/
│   ├── app/              # Next.js App Router pages
│   │   ├── api/          # API routes
│   │   ├── (routes)/     # Page routes
│   │   └── layout.tsx    # Root layout
│   ├── components/       # React components
│   │   ├── ui/           # Base UI components
│   │   └── features/     # Feature components
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utilities and services
│   └── i18n/             # Internationalization
├── public/               # Static assets
├── docs/                 # Documentation
├── e2e/                  # End-to-end tests
├── scripts/              # Utility scripts
└── sdk/                  # Client SDKs
```

---

## Environment Variables

Create `.env.local` with:

```bash
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000
API_SECRET_KEY=your_secret_key

# External APIs (optional for development)
COINGECKO_API_KEY=your_key
ETHERSCAN_API_KEY=your_key

# Analytics (optional)
NEXT_PUBLIC_ANALYTICS_ID=

# x402 Payments (optional)
X402_FACILITATOR_URL=https://x402.org
X402_WALLET_ADDRESS=0x...

# Database (if using persistence)
DATABASE_URL=postgresql://...
REDIS_URL=redis://localhost:6379
```

---

## Development Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server |
| `pnpm build` | Production build |
| `pnpm start` | Start production server |
| `pnpm lint` | Run ESLint |
| `pnpm lint:fix` | Fix lint errors |
| `pnpm test` | Run unit tests |
| `pnpm test:e2e` | Run E2E tests |
| `pnpm type-check` | TypeScript check |

---

## Code Style

### ESLint Configuration

The project uses ESLint with Next.js and TypeScript rules:

```javascript
// eslint.config.mjs
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat();

export default [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
      'prefer-const': 'error',
    },
  },
];
```

### Formatting

!!! tip "Prettier Integration"
    Install the Prettier VS Code extension for auto-formatting on save.

---

## Component Development

### Creating Components

```tsx
// src/components/features/MyComponent.tsx
'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface MyComponentProps {
  title: string;
  className?: string;
  onAction?: () => void;
}

export function MyComponent({ title, className, onAction }: MyComponentProps) {
  const [active, setActive] = useState(false);

  return (
    <div className={cn('rounded-lg p-4', className)}>
      <h2>{title}</h2>
      <button onClick={() => {
        setActive(!active);
        onAction?.();
      }}>
        Toggle
      </button>
    </div>
  );
}
```

### Storybook

Develop components in isolation:

```bash
pnpm storybook
```

Create stories for your components:

```tsx
// stories/MyComponent.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { MyComponent } from '@/components/features/MyComponent';

const meta: Meta<typeof MyComponent> = {
  title: 'Features/MyComponent',
  component: MyComponent,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof MyComponent>;

export const Default: Story = {
  args: {
    title: 'Hello World',
  },
};

export const WithAction: Story = {
  args: {
    title: 'Click Me',
    onAction: () => alert('Clicked!'),
  },
};
```

---

## API Development

### Creating Endpoints

```typescript
// src/app/api/my-endpoint/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withAuth, withRateLimit, withX402 } from '@/lib/middleware';

export async function GET(request: NextRequest) {
  // Parse query params
  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get('limit') || '10');

  try {
    // Fetch data
    const data = await fetchData(limit);

    return NextResponse.json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch data' },
      { status: 500 }
    );
  }
}

// POST with authentication
export const POST = withAuth(async (request: NextRequest) => {
  const body = await request.json();
  
  // Process request
  const result = await processData(body);
  
  return NextResponse.json({ success: true, result });
});
```

### Middleware Composition

```typescript
// Apply multiple middleware
export const GET = withRateLimit(
  withAuth(
    async (request) => {
      // Handler logic
    }
  )
);

// Or use x402 for paid endpoints
export const GET = withX402({
  price: '0.001',
  network: 'base',
})(async (request) => {
  // Premium handler
});
```

---

## Data Fetching

### Server Components

```tsx
// src/app/coins/page.tsx
import { getCoins } from '@/lib/api/coins';

export default async function CoinsPage() {
  const coins = await getCoins();
  
  return (
    <div>
      {coins.map(coin => (
        <CoinCard key={coin.id} coin={coin} />
      ))}
    </div>
  );
}
```

### Client Components with SWR

```tsx
'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';

export function CoinList() {
  const { data, error, isLoading } = useSWR('/api/v1/coins', fetcher, {
    refreshInterval: 60000, // Refresh every minute
  });

  if (isLoading) return <Skeleton />;
  if (error) return <ErrorMessage error={error} />;
  
  return (
    <ul>
      {data.coins.map(coin => (
        <li key={coin.id}>{coin.name}: ${coin.price}</li>
      ))}
    </ul>
  );
}
```

---

## Testing During Development

### Running Tests

```bash
# Run all tests
pnpm test

# Run in watch mode
pnpm test:watch

# Run specific test file
pnpm test src/lib/utils.test.ts

# Run with coverage
pnpm test:coverage
```

### Writing Tests

```typescript
// src/lib/utils.test.ts
import { describe, it, expect } from 'vitest';
import { formatCurrency, formatPercentage } from './format';

describe('formatCurrency', () => {
  it('formats numbers with dollar sign', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56');
  });

  it('handles large numbers', () => {
    expect(formatCurrency(1000000)).toBe('$1,000,000.00');
  });
});
```

---

## Git Workflow

### Branch Naming

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feature/description` | `feature/whale-alerts` |
| Bugfix | `fix/description` | `fix/price-display` |
| Hotfix | `hotfix/description` | `hotfix/api-crash` |
| Docs | `docs/description` | `docs/api-guide` |

### Commit Messages

Follow conventional commits:

```
type(scope): description

[optional body]
[optional footer]
```

Examples:
```
feat(api): add whale tracking endpoint
fix(ui): correct price formatting for small numbers
docs(readme): update installation instructions
chore(deps): upgrade next.js to 15.1
```

### Pull Request Process

1. Create feature branch from `main`
2. Make changes and commit
3. Push and create PR
4. Wait for CI checks
5. Request review
6. Squash and merge

---

## Debugging

### VS Code Launch Configuration

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js: debug server-side",
      "type": "node-terminal",
      "request": "launch",
      "command": "pnpm dev"
    },
    {
      "name": "Next.js: debug client-side",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:3000"
    }
  ]
}
```

### Debug Logging

```typescript
import { logger } from '@/lib/logger';

logger.debug('Processing request', { userId, endpoint });
logger.info('Request completed', { duration: '123ms' });
logger.warn('Rate limit approaching', { remaining: 10 });
logger.error('API call failed', { error, stack: error.stack });
```

---

## Hot Reload

The development server supports Fast Refresh:

- **React Components**: Preserved state on edit
- **CSS/Tailwind**: Instant updates
- **API Routes**: Automatic reload
- **Server Components**: Full page refresh

---

## Next Steps

- [Testing Guide](testing.md) - Write tests for your code
- [Deployment Guide](deployment.md) - Deploy to production
- [Performance Guide](performance.md) - Optimize your code
