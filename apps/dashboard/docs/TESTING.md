# Testing Guide

Comprehensive testing documentation for Crypto Data Aggregator.

---

## Table of Contents

- [Overview](#overview)
- [Test Stack](#test-stack)
- [Running Tests](#running-tests)
- [API Testing](#api-testing)
- [Writing Tests](#writing-tests)
- [Mocking](#mocking)
- [Coverage](#coverage)
- [CI Integration](#ci-integration)

---

## Overview

The project uses **Vitest** as the test runner with **React Testing Library** for component testing.

```
Test Files:  src/**/*.test.ts, src/**/*.spec.ts
Environment: jsdom
Coverage:    V8 provider
```

---

## Test Stack

| Tool                                                        | Purpose                        |
| ----------------------------------------------------------- | ------------------------------ |
| [Vitest](https://vitest.dev/)                               | Test runner, assertions        |
| [Testing Library](https://testing-library.com/)             | Component testing              |
| [jsdom](https://github.com/jsdom/jsdom)                     | Browser environment simulation |
| [V8 Coverage](https://v8.dev/blog/javascript-code-coverage) | Code coverage                  |
| [Playwright](https://playwright.dev/)                       | E2E testing                    |

---

## Running Tests

### Basic Commands

```bash
# Run all tests once
npm run test:run

# Run tests in watch mode (development)
npm run test:watch

# Run with interactive UI
npm run test:ui

# Run with coverage report
npm run test:coverage

# Run specific test file
npx vitest src/lib/portfolio.test.ts

# Run tests matching pattern
npx vitest --grep "portfolio"
```

### Watch Mode Shortcuts

When running `npm run test:watch`:

| Key | Action                |
| --- | --------------------- |
| `a` | Run all tests         |
| `f` | Run only failed tests |
| `p` | Filter by filename    |
| `t` | Filter by test name   |
| `q` | Quit                  |

---

## API Testing

### Swagger UI

Test API endpoints interactively using the built-in Swagger UI:

```
Development: http://localhost:3000/docs/swagger
Production:  https://cryptonews.direct/docs/swagger
```

Features:
- **Try It Out** - Execute requests directly
- **Response examples** - See expected response formats
- **Authentication** - Test with API keys
- **Rate limit headers** - View remaining quota

### OpenAPI Specification

Import the OpenAPI 3.1 spec into your API testing tool:

```bash
# Download OpenAPI spec
curl https://cryptonews.direct/api/v2/openapi.json > openapi.json

# Test with curl
curl -X GET "https://cryptonews.direct/api/v2/news?limit=5"
```

### E2E API Tests

```bash
# Run Playwright E2E tests
npm run test:e2e

# Run specific API tests
npx playwright test e2e/api.spec.ts
```

---

## Writing Tests

### File Naming Convention

```
src/lib/portfolio.ts       # Source file
src/lib/portfolio.test.ts  # Test file
```

### Basic Test Structure

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { calculatePortfolioValue, addHolding } from './portfolio';

describe('Portfolio', () => {
  beforeEach(() => {
    // Setup before each test
    localStorage.clear();
  });

  afterEach(() => {
    // Cleanup after each test
    vi.restoreAllMocks();
  });

  describe('calculatePortfolioValue', () => {
    it('should calculate total value correctly', () => {
      const holdings = [
        { coinId: 'bitcoin', amount: 1, currentPrice: 50000 },
        { coinId: 'ethereum', amount: 10, currentPrice: 3000 },
      ];

      const result = calculatePortfolioValue(holdings);

      expect(result.totalValue).toBe(80000);
    });

    it('should handle empty portfolio', () => {
      const result = calculatePortfolioValue([]);

      expect(result.totalValue).toBe(0);
    });
  });
});
```

### Testing React Components

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PriceAlertButton } from '@/components/alerts/PriceAlertButton';

describe('PriceAlertButton', () => {
  it('should render alert button', () => {
    render(<PriceAlertButton coinId="bitcoin" coinName="Bitcoin" />);

    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should open modal on click', async () => {
    render(<PriceAlertButton coinId="bitcoin" coinName="Bitcoin" />);

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByText(/create alert/i)).toBeInTheDocument();
    });
  });
});
```

### Testing Async Code

```typescript
import { describe, it, expect, vi } from 'vitest';
import { getTopCoins } from './market-data';

describe('Market Data', () => {
  it('should fetch top coins', async () => {
    const coins = await getTopCoins({ limit: 10 });

    expect(coins).toHaveLength(10);
    expect(coins[0]).toHaveProperty('id');
    expect(coins[0]).toHaveProperty('current_price');
  });

  it('should handle API errors gracefully', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    await expect(getTopCoins()).rejects.toThrow('Network error');
  });
});
```

---

## Mocking

### Mocking Modules

```typescript
import { vi } from 'vitest';

// Mock entire module
vi.mock('@/lib/market-data', () => ({
  getTopCoins: vi
    .fn()
    .mockResolvedValue([{ id: 'bitcoin', name: 'Bitcoin', current_price: 50000 }]),
  getCoinDetails: vi.fn(),
}));

// Mock with implementation
vi.mock('@/lib/cache', () => ({
  newsCache: {
    get: vi.fn(),
    set: vi.fn(),
    has: vi.fn().mockReturnValue(false),
  },
}));
```

### Mocking Fetch

```typescript
import { vi, beforeEach, afterEach } from 'vitest';

beforeEach(() => {
  global.fetch = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

it('should fetch data', async () => {
  vi.mocked(fetch).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ data: 'test' }),
  } as Response);

  const result = await fetchData();

  expect(fetch).toHaveBeenCalledWith('/api/data');
  expect(result).toEqual({ data: 'test' });
});
```

### Mocking localStorage

```typescript
import { vi } from 'vitest';

const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

it('should save to localStorage', () => {
  saveData('key', { value: 1 });

  expect(localStorageMock.setItem).toHaveBeenCalledWith('key', JSON.stringify({ value: 1 }));
});
```

### Mocking Timers

```typescript
import { vi, beforeEach, afterEach } from 'vitest';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

it('should debounce calls', async () => {
  const callback = vi.fn();
  const debounced = debounce(callback, 1000);

  debounced();
  debounced();
  debounced();

  expect(callback).not.toHaveBeenCalled();

  vi.advanceTimersByTime(1000);

  expect(callback).toHaveBeenCalledTimes(1);
});
```

---

## Coverage

### Generate Coverage Report

```bash
npm run test:coverage
```

### Coverage Output

```
 % Coverage report from v8
-----------------------|---------|----------|---------|---------|
File                   | % Stmts | % Branch | % Funcs | % Lines |
-----------------------|---------|----------|---------|---------|
All files              |   85.23 |    78.45 |   82.10 |   85.23 |
 src/lib/              |   92.15 |    88.30 |   90.00 |   92.15 |
  alerts.ts            |   88.50 |    82.00 |   85.00 |   88.50 |
  cache.ts             |   95.00 |    90.00 |   95.00 |   95.00 |
  market-data.ts       |   90.00 |    85.00 |   88.00 |   90.00 |
  portfolio.ts         |   98.00 |    95.00 |   100.0 |   98.00 |
-----------------------|---------|----------|---------|---------|
```

### Coverage Thresholds

Add to `vitest.config.ts`:

```typescript
coverage: {
  provider: 'v8',
  thresholds: {
    lines: 80,
    functions: 80,
    branches: 70,
    statements: 80,
  },
},
```

### View HTML Report

```bash
npm run test:coverage
open coverage/index.html
```

---

## CI Integration

### GitHub Actions

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm run test:run

      - name: Run coverage
        run: npm run test:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: ./coverage/lcov.info
```

### Pre-commit Hook

The project uses Husky for pre-commit hooks:

```bash
# Runs automatically before each commit
npm run test:run
npm run lint
npm run typecheck
```

---

## Best Practices

### 1. Test Behavior, Not Implementation

```typescript
// ❌ Bad: Testing implementation details
expect(component.state.isOpen).toBe(true);

// ✅ Good: Testing user-visible behavior
expect(screen.getByRole('dialog')).toBeVisible();
```

### 2. Use Descriptive Test Names

```typescript
// ❌ Bad
it('works', () => { ... });

// ✅ Good
it('should display error message when API call fails', () => { ... });
```

### 3. Arrange-Act-Assert Pattern

```typescript
it('should add holding to portfolio', () => {
  // Arrange
  const portfolio = createPortfolio('user_1', 'My Portfolio');
  const holding = { coinId: 'bitcoin', amount: 1 };

  // Act
  addHolding(portfolio.id, holding);

  // Assert
  const updated = getPortfolio(portfolio.id);
  expect(updated.holdings).toContainEqual(expect.objectContaining(holding));
});
```

### 4. One Assertion Per Test (When Possible)

```typescript
// ❌ Bad: Multiple unrelated assertions
it('should work', () => {
  expect(result.value).toBe(100);
  expect(result.status).toBe('success');
  expect(result.timestamp).toBeDefined();
});

// ✅ Good: Focused tests
it('should calculate correct value', () => {
  expect(result.value).toBe(100);
});

it('should return success status', () => {
  expect(result.status).toBe('success');
});
```

### 5. Clean Up Side Effects

```typescript
afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  cleanup(); // React Testing Library
});
```

---

## Debugging Tests

### Run Single Test

```bash
npx vitest src/lib/portfolio.test.ts -t "should add holding"
```

### Debug Mode

```bash
npx vitest --inspect-brk --single-thread
```

Then attach VS Code debugger.

### VS Code Launch Config

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Vitest",
  "program": "${workspaceFolder}/node_modules/vitest/vitest.mjs",
  "args": ["run", "--single-thread", "--no-file-parallelism"],
  "cwd": "${workspaceFolder}",
  "console": "integratedTerminal"
}
```

---

## Related Documentation

- [Development Guide](./DEVELOPMENT.md)
- [API Reference](./API.md)
- [Vitest Documentation](https://vitest.dev/)
