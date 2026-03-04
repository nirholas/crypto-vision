# Testing Guide

Comprehensive testing strategy with unit, integration, and end-to-end tests.

---

## Testing Stack

| Tool | Purpose |
|------|---------|
| **Vitest** | Unit and integration testing |
| **React Testing Library** | Component testing |
| **Playwright** | End-to-end testing |
| **MSW** | API mocking |

---

## Running Tests

```bash
# Unit tests
pnpm test              # Run once
pnpm test:watch        # Watch mode
pnpm test:coverage     # With coverage

# E2E tests
pnpm test:e2e          # Run Playwright tests
pnpm test:e2e:ui       # Interactive UI mode
pnpm test:e2e:headed   # See browser

# All tests
pnpm test:all          # Unit + E2E
```

---

## Unit Testing

### Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: ['node_modules/', '**/*.d.ts', 'e2e/'],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
```

### Setup File

```typescript
// vitest.setup.ts
import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));
```

---

## Testing Utilities

### Testing Library

```typescript
// src/lib/test-utils.tsx
import { render, RenderOptions } from '@testing-library/react';
import { ReactElement } from 'react';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { IntlProvider } from 'next-intl';

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  locale?: string;
  theme?: 'light' | 'dark';
}

function AllProviders({ children, locale = 'en' }) {
  const messages = require(`@/messages/${locale}.json`);
  
  return (
    <IntlProvider messages={messages} locale={locale}>
      <ThemeProvider>
        {children}
      </ThemeProvider>
    </IntlProvider>
  );
}

export function customRender(
  ui: ReactElement,
  options?: CustomRenderOptions
) {
  const { locale, ...renderOptions } = options || {};
  
  return render(ui, {
    wrapper: ({ children }) => (
      <AllProviders locale={locale}>{children}</AllProviders>
    ),
    ...renderOptions,
  });
}

export * from '@testing-library/react';
export { customRender as render };
```

---

## Component Testing

### Basic Component Test

```typescript
// src/components/ui/Button.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@/lib/test-utils';
import { Button } from './Button';

describe('Button', () => {
  it('renders with correct text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button')).toHaveTextContent('Click me');
  });

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it('is disabled when loading', () => {
    render(<Button loading>Submit</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('shows loading spinner when loading', () => {
    render(<Button loading>Submit</Button>);
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });
});
```

### Testing User Interactions

```typescript
// src/components/features/CoinSearch.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/lib/test-utils';
import userEvent from '@testing-library/user-event';
import { CoinSearch } from './CoinSearch';

describe('CoinSearch', () => {
  it('filters coins as user types', async () => {
    const user = userEvent.setup();
    render(<CoinSearch />);

    const input = screen.getByPlaceholderText('Search coins...');
    await user.type(input, 'bitcoin');

    await waitFor(() => {
      expect(screen.getByText('Bitcoin')).toBeInTheDocument();
      expect(screen.queryByText('Ethereum')).not.toBeInTheDocument();
    });
  });

  it('shows no results message for invalid search', async () => {
    const user = userEvent.setup();
    render(<CoinSearch />);

    await user.type(screen.getByPlaceholderText('Search coins...'), 'xyz123');

    await waitFor(() => {
      expect(screen.getByText('No coins found')).toBeInTheDocument();
    });
  });
});
```

---

## Hook Testing

```typescript
// src/hooks/useCoins.test.tsx
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { useCoins } from './useCoins';
import { SWRConfig } from 'swr';

const mockCoins = [
  { id: 'bitcoin', name: 'Bitcoin', price: 45000 },
  { id: 'ethereum', name: 'Ethereum', price: 2500 },
];

const server = setupServer(
  http.get('/api/v1/coins', () => {
    return HttpResponse.json({ coins: mockCoins });
  })
);

beforeEach(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function wrapper({ children }) {
  return (
    <SWRConfig value={{ dedupingInterval: 0 }}>
      {children}
    </SWRConfig>
  );
}

describe('useCoins', () => {
  it('fetches coins successfully', async () => {
    const { result } = renderHook(() => useCoins(), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toEqual(mockCoins);
    });
  });

  it('handles loading state', () => {
    const { result } = renderHook(() => useCoins(), { wrapper });
    expect(result.current.isLoading).toBe(true);
  });

  it('handles error state', async () => {
    server.use(
      http.get('/api/v1/coins', () => {
        return new HttpResponse(null, { status: 500 });
      })
    );

    const { result } = renderHook(() => useCoins(), { wrapper });

    await waitFor(() => {
      expect(result.current.error).toBeDefined();
    });
  });
});
```

---

## API Route Testing

```typescript
// src/app/api/coins/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';
import { NextRequest } from 'next/server';

// Mock external API
vi.mock('@/lib/api/coingecko', () => ({
  fetchCoins: vi.fn().mockResolvedValue([
    { id: 'bitcoin', name: 'Bitcoin', price: 45000 },
  ]),
}));

describe('GET /api/coins', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns coins list', async () => {
    const request = new NextRequest('http://localhost:3000/api/coins');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.coins).toHaveLength(1);
    expect(data.coins[0].name).toBe('Bitcoin');
  });

  it('supports limit parameter', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/coins?limit=5'
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
  });

  it('returns 400 for invalid limit', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/coins?limit=invalid'
    );
    const response = await GET(request);

    expect(response.status).toBe(400);
  });
});
```

---

## End-to-End Testing

### Playwright Configuration

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['json', { outputFile: 'playwright-report/results.json' }],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile',
      use: { ...devices['iPhone 14'] },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
});
```

### Page Object Model

```typescript
// e2e/pages/home.page.ts
import { Page, Locator } from '@playwright/test';

export class HomePage {
  readonly page: Page;
  readonly coinTable: Locator;
  readonly searchInput: Locator;
  readonly filterButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.coinTable = page.getByTestId('coin-table');
    this.searchInput = page.getByPlaceholder('Search coins...');
    this.filterButton = page.getByRole('button', { name: 'Filters' });
  }

  async goto() {
    await this.page.goto('/');
  }

  async searchCoin(query: string) {
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(500); // Debounce
  }

  async getCoinRows() {
    return this.coinTable.getByRole('row').all();
  }
}
```

### E2E Test Examples

```typescript
// e2e/home.spec.ts
import { test, expect } from '@playwright/test';
import { HomePage } from './pages/home.page';

test.describe('Home Page', () => {
  test('displays coin list', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.goto();

    await expect(homePage.coinTable).toBeVisible();
    const rows = await homePage.getCoinRows();
    expect(rows.length).toBeGreaterThan(0);
  });

  test('filters coins by search', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.goto();

    await homePage.searchCoin('Bitcoin');
    
    await expect(page.getByText('Bitcoin')).toBeVisible();
    await expect(page.getByText('Ethereum')).not.toBeVisible();
  });

  test('navigates to coin detail', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Bitcoin');
    
    await expect(page).toHaveURL(/\/coins\/bitcoin/);
    await expect(page.getByRole('heading', { name: 'Bitcoin' })).toBeVisible();
  });
});
```

### API E2E Tests

```typescript
// e2e/api.spec.ts
import { test, expect } from '@playwright/test';

test.describe('API Endpoints', () => {
  test('GET /api/v1/coins returns valid response', async ({ request }) => {
    const response = await request.get('/api/v1/coins');
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.coins).toBeDefined();
    expect(Array.isArray(data.coins)).toBe(true);
  });

  test('GET /api/v1/coins supports pagination', async ({ request }) => {
    const response = await request.get('/api/v1/coins?limit=5&offset=0');
    const data = await response.json();
    
    expect(data.coins.length).toBeLessThanOrEqual(5);
  });

  test('GET /api/v1/coins/:id returns coin details', async ({ request }) => {
    const response = await request.get('/api/v1/coins/bitcoin');
    const data = await response.json();
    
    expect(data.id).toBe('bitcoin');
    expect(data.name).toBe('Bitcoin');
    expect(data.price).toBeDefined();
  });
});
```

---

## Mocking with MSW

### Mock Handlers

```typescript
// src/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/v1/coins', () => {
    return HttpResponse.json({
      coins: [
        { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC', price: 45000 },
        { id: 'ethereum', name: 'Ethereum', symbol: 'ETH', price: 2500 },
      ],
    });
  }),

  http.get('/api/v1/coins/:id', ({ params }) => {
    const { id } = params;
    
    if (id === 'bitcoin') {
      return HttpResponse.json({
        id: 'bitcoin',
        name: 'Bitcoin',
        price: 45000,
        marketCap: 850000000000,
      });
    }
    
    return new HttpResponse(null, { status: 404 });
  }),

  http.post('/api/v1/alerts', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: 'alert-123', ...body }, { status: 201 });
  }),
];
```

### MSW Setup

```typescript
// src/mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);

// vitest.setup.ts
import { server } from './src/mocks/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

---

## Accessibility Testing

```typescript
// e2e/a11y.spec.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility', () => {
  test('home page has no violations', async ({ page }) => {
    await page.goto('/');
    
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    
    expect(results.violations).toEqual([]);
  });

  test('coin detail page is accessible', async ({ page }) => {
    await page.goto('/coins/bitcoin');
    
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
```

---

## Coverage Reports

```bash
# Generate coverage report
pnpm test:coverage

# View HTML report
open coverage/index.html
```

### Coverage Configuration

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
      exclude: [
        'node_modules/',
        'e2e/',
        '**/*.d.ts',
        '**/*.stories.tsx',
        '**/mocks/**',
      ],
    },
  },
});
```

---

## CI/CD Integration

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm test:coverage
      - uses: codecov/codecov-action@v3

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm exec playwright install --with-deps
      - run: pnpm test:e2e
      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

---

## Next Steps

- [Development Guide](development.md) - Set up your dev environment
- [Deployment Guide](deployment.md) - Deploy your app
- [Performance Guide](performance.md) - Optimize test performance
