# Prompt 08: Testing, Load Testing & Hardening

## Agent Identity & Rules

```
You are hardening Crypto Vision for production-scale traffic.
- Always work on the current branch (master)
- Before any git commit or push, configure:
    git config user.name "nirholas"
    git config user.email "nirholas@users.noreply.github.com"
- Always use background terminals (isBackground: true)
- Always kill terminals after commands complete
- We have unlimited Claude credits — build the best possible version
- Every test must be real — no mocks, no stubs, test actual behavior
- No mocks, no fakes, no stubs — real implementations only
```

## Objective

Build comprehensive test suites (unit, integration, E2E, load, fuzz), harden the API for production traffic, and establish performance benchmarks. Use GCP compute to run load tests at scale that would be impossible locally.

## Budget: $5k

- Cloud Run (staging instances): ~$1k
- GKE for load generation: ~$2k
- Artifact Registry: ~$500
- BigQuery for results storage: ~$500
- Buffer: ~$1k

## Current State

- Tests exist in `tests/` using Vitest
- Existing tests: `cache.test.ts`, `fetcher.test.ts`, `rate-limit.test.ts`
- Route tests in `tests/routes/` and `src/routes/__tests__/`
- E2E tests for dashboard in `apps/dashboard/e2e/`
- 80+ API endpoints across 20+ route files
- Rate limiting at 200 req/min/IP
- Circuit breaker pattern in `src/lib/fetcher.ts`

## Deliverables

### 1. Comprehensive Unit Tests (`tests/`)

Add missing unit tests for every module in `src/lib/`:

```typescript
// tests/lib/ai.test.ts — AI provider cascade tests
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("AI Provider Cascade", () => {
  it("should try Groq first when GROQ_API_KEY is set", async () => {
    // Test real cascade behavior, not mocked internals
    // Set up env vars and verify correct provider is selected
  });

  it("should fall through to Gemini when Groq fails", async () => {
    // Verify cascade: Groq → Gemini
  });

  it("should fall through all providers and throw when all fail", async () => {
    // No keys set → appropriate error
  });

  it("should respect temperature and maxTokens parameters", async () => {
    // Verify params are passed through correctly
  });

  it("should parse JSON responses correctly", async () => {
    // Various JSON formats in AI responses
  });

  it("should handle malformed AI responses gracefully", async () => {
    // Empty responses, partial JSON, etc.
  });
});
```

```typescript
// tests/lib/queue.test.ts — Concurrency queue tests
describe("AI Queue", () => {
  it("should limit concurrent executions to AI_CONCURRENCY", async () => {});
  it("should queue requests when at capacity", async () => {});
  it("should throw QueueFullError when max queue is reached", async () => {});
  it("should process queue in FIFO order", async () => {});
  it("should handle task failures without blocking queue", async () => {});
  it("should report accurate queue depth metrics", async () => {});
});
```

```typescript
// tests/lib/anomaly.test.ts — Anomaly detection tests
describe("Anomaly Engine", () => {
  it("should detect price spikes beyond 3 standard deviations", async () => {
    // Feed stable prices, then a spike
    const engine = new AnomalyEngine();
    for (let i = 0; i < 100; i++) {
      engine.ingest("price_spike", "bitcoin", "price", 50000 + Math.random() * 100);
    }
    // Should NOT trigger for normal variation
    expect(engine.ingest("price_spike", "bitcoin", "price", 50050)).toBeNull();
    
    // SHOULD trigger for massive spike
    const event = engine.ingest("price_spike", "bitcoin", "price", 55000);
    expect(event).not.toBeNull();
    expect(event!.severity).toBe("critical");
  });

  it("should respect cooldown periods", async () => {});
  it("should require minimum data points before alerting", async () => {});
  it("should detect stablecoin depegs at 2σ threshold", async () => {});
  it("should handle multiple assets independently", async () => {});
  it("should use Modified Z-Score (robust to outliers)", async () => {});
});
```

### 2. Integration Tests (`tests/integration/`)

Test full request flows through the API:

```typescript
// tests/integration/api-flows.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";

// Spin up the actual server for integration testing
let server: any;

beforeAll(async () => {
  process.env.PORT = "0"; // Random port
  const mod = await import("../../src/index.js");
  // Wait for server to start
});

afterAll(async () => {
  // Graceful shutdown
});

describe("API Integration Flows", () => {
  // Market data flow
  it("GET /api/coins returns paginated coin data", async () => {
    const res = await fetch(`http://localhost:${port}/api/coins`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toBeInstanceOf(Array);
    expect(json.data.length).toBeGreaterThan(0);
    expect(json.data[0]).toHaveProperty("id");
    expect(json.data[0]).toHaveProperty("current_price");
  });

  it("GET /api/coin/:id returns detailed coin data", async () => {
    const res = await fetch(`http://localhost:${port}/api/coin/bitcoin`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveProperty("market_data");
  });

  it("GET /api/coin/nonexistent returns 404", async () => {
    const res = await fetch(`http://localhost:${port}/api/coin/this-coin-does-not-exist-xyz`);
    expect(res.status).toBe(404);
  });

  // DeFi flow
  it("GET /api/defi/protocols with filters", async () => {
    const res = await fetch(`http://localhost:${port}/api/defi/protocols?limit=10&chain=Ethereum`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.length).toBeLessThanOrEqual(10);
  });

  // News flow
  it("GET /api/news returns recent articles", async () => {
    const res = await fetch(`http://localhost:${port}/api/news`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toBeInstanceOf(Array);
  });

  // AI flow (requires API key)
  it("GET /api/ai/providers returns configured providers", async () => {
    const res = await fetch(`http://localhost:${port}/api/ai/providers`);
    expect(res.status).toBe(200);
  });

  // Rate limiting
  it("enforces rate limits after 200 requests", async () => {
    const promises = Array.from({ length: 210 }, () =>
      fetch(`http://localhost:${port}/api/global`)
    );
    const responses = await Promise.all(promises);
    const statuses = responses.map(r => r.status);
    expect(statuses.filter(s => s === 429).length).toBeGreaterThan(0);
  });

  // Error handling
  it("returns 400 for invalid query parameters", async () => {
    const res = await fetch(`http://localhost:${port}/api/coins?per_page=abc`);
    // Should handle gracefully
    expect([200, 400]).toContain(res.status);
  });

  // Health check
  it("GET /health returns comprehensive status", async () => {
    const res = await fetch(`http://localhost:${port}/health`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("ok");
    expect(json).toHaveProperty("uptime");
    expect(json).toHaveProperty("cache");
  });
});
```

### 3. Load Testing with k6 (`tests/load/`)

```javascript
// tests/load/smoke.js — Quick smoke test (1 min, 10 VUs)
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const latency = new Trend('custom_latency');

export const options = {
  stages: [
    { duration: '15s', target: 10 },   // Ramp up
    { duration: '30s', target: 10 },   // Steady
    { duration: '15s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],  // 95th percentile < 2s
    errors: ['rate<0.05'],               // Error rate < 5%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

const ENDPOINTS = [
  { path: '/health', weight: 5 },
  { path: '/api/coins', weight: 20 },
  { path: '/api/trending', weight: 10 },
  { path: '/api/global', weight: 10 },
  { path: '/api/fear-greed', weight: 5 },
  { path: '/api/defi/protocols', weight: 15 },
  { path: '/api/defi/chains', weight: 10 },
  { path: '/api/news', weight: 15 },
  { path: '/api/onchain/gas', weight: 5 },
  { path: '/api/exchanges', weight: 5 },
];

function weightedRandom(items) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * total;
  for (const item of items) {
    random -= item.weight;
    if (random <= 0) return item;
  }
  return items[items.length - 1];
}

export default function() {
  const endpoint = weightedRandom(ENDPOINTS);
  const url = `${BASE_URL}${endpoint.path}`;
  
  const res = http.get(url, {
    headers: { 'Accept': 'application/json' },
    timeout: '10s',
  });

  const success = check(res, {
    'status is 200': (r) => r.status === 200,
    'response has data': (r) => r.body.length > 0,
    'response time < 2s': (r) => r.timings.duration < 2000,
  });

  errorRate.add(!success);
  latency.add(res.timings.duration);
  
  sleep(Math.random() * 2 + 0.5);
}
```

```javascript
// tests/load/stress.js — Stress test (10 min, 500 VUs peak)
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');
const requestCount = new Counter('requests');

export const options = {
  stages: [
    { duration: '1m', target: 50 },     // Warm up
    { duration: '2m', target: 200 },    // Scale up
    { duration: '3m', target: 500 },    // Peak stress
    { duration: '2m', target: 200 },    // Scale down
    { duration: '1m', target: 50 },     // Cool down
    { duration: '1m', target: 0 },      // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(50)<500', 'p(95)<3000', 'p(99)<5000'],
    errors: ['rate<0.10'],  // Allow 10% errors under stress
    http_req_failed: ['rate<0.10'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'https://cryptocurrency.cv';

// Realistic traffic distribution based on access logs
const TRAFFIC_PATTERN = [
  { path: '/api/coins', weight: 25, method: 'GET' },
  { path: '/api/coin/bitcoin', weight: 15, method: 'GET' },
  { path: '/api/coin/ethereum', weight: 10, method: 'GET' },
  { path: '/api/trending', weight: 8, method: 'GET' },
  { path: '/api/global', weight: 8, method: 'GET' },
  { path: '/api/defi/protocols', weight: 8, method: 'GET' },
  { path: '/api/defi/yields', weight: 5, method: 'GET' },
  { path: '/api/news', weight: 8, method: 'GET' },
  { path: '/api/news/bitcoin', weight: 3, method: 'GET' },
  { path: '/api/fear-greed', weight: 3, method: 'GET' },
  { path: '/api/onchain/gas', weight: 2, method: 'GET' },
  { path: '/api/exchanges', weight: 2, method: 'GET' },
  { path: '/api/search?q=sol', weight: 3, method: 'GET' },
];

function weightedRandom(items) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * total;
  for (const item of items) {
    random -= item.weight;
    if (random <= 0) return item;
  }
  return items[items.length - 1];
}

export default function() {
  const endpoint = weightedRandom(TRAFFIC_PATTERN);
  const url = `${BASE_URL}${endpoint.path}`;
  
  const res = http.get(url, {
    headers: { 
      'Accept': 'application/json',
      'User-Agent': 'k6-load-test',
    },
    timeout: '10s',
  });

  requestCount.add(1);
  responseTime.add(res.timings.duration);

  const success = check(res, {
    'status is 2xx or 429': (r) => r.status >= 200 && r.status < 300 || r.status === 429,
    'response time < 5s': (r) => r.timings.duration < 5000,
    'has valid JSON': (r) => {
      try { JSON.parse(r.body); return true; } catch { return false; }
    },
  });

  errorRate.add(!success);
  sleep(Math.random() * 1 + 0.2);
}
```

```javascript
// tests/load/soak.js — Soak test (2 hrs, steady 100 VUs)
// Detects memory leaks, connection pool exhaustion, cache growth

export const options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '116m', target: 100 },  // 2hrs steady
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    errors: ['rate<0.01'],  // Very low error rate for soak
  },
};
```

### 4. Fuzz Testing (`tests/fuzz/`)

```typescript
// tests/fuzz/api-fuzz.test.ts — Fuzz test all endpoints with random/malicious inputs
import { describe, it, expect } from "vitest";

const BASE = "http://localhost:8080";

// Generate random strings of varying length
function randomString(len: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;':\",./<>?\\`~ \n\t";
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// Known attack patterns
const ATTACK_PAYLOADS = [
  "' OR 1=1 --",
  "<script>alert(1)</script>",
  "{{7*7}}",
  "${7*7}",
  "../../../etc/passwd",
  "%00",
  "\x00\x00\x00",
  "a".repeat(10_000),
  "a".repeat(1_000_000),
  '{"__proto__": {"isAdmin": true}}',
  "AAAA%n%n%n%n",
  "%s%s%s%s%s",
  "NaN", "Infinity", "-Infinity",
  "undefined", "null", "true", "false",
  "0", "-1", "999999999999999999",
  "1e308", "-1e308",
];

describe("API Fuzz Testing", () => {
  // Test all parametric endpoints with malicious inputs
  const PARAMETRIC_ENDPOINTS = [
    "/api/coin/FUZZ",
    "/api/chart/FUZZ",
    "/api/ohlc/FUZZ",
    "/api/ai/sentiment/FUZZ",
    "/api/search?q=FUZZ",
    "/api/news/search?q=FUZZ",
    "/api/coins?per_page=FUZZ",
    "/api/coins?page=FUZZ",
    "/api/defi/protocol/FUZZ",
    "/api/defi/chain/FUZZ",
    "/api/security/token/FUZZ/0x0000",
    "/api/onchain/token/FUZZ",
  ];

  for (const endpoint of PARAMETRIC_ENDPOINTS) {
    for (const payload of ATTACK_PAYLOADS) {
      it(`${endpoint} handles: ${payload.slice(0, 40)}`, async () => {
        const url = `${BASE}${endpoint.replace("FUZZ", encodeURIComponent(payload))}`;
        const res = await fetch(url).catch(() => ({ status: 0 }));
        
        // Server should NEVER crash (500) or leak information
        expect(res.status).not.toBe(500);
        // Should not reflect attack payloads unescaped
        if ("text" in res) {
          const body = await (res as Response).text();
          expect(body).not.toContain("<script>");
        }
      });
    }
  }

  // POST body fuzzing
  it("POST /api/ai/ask handles malicious bodies", async () => {
    for (const payload of ATTACK_PAYLOADS) {
      const res = await fetch(`${BASE}/api/ai/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: payload }),
      }).catch(() => ({ status: 0 }));
      expect(res.status).not.toBe(500);
    }
  });

  it("POST /api/ai/ask handles non-JSON bodies", async () => {
    const bodies = [
      "not json",
      "",
      "null",
      "[]",
      "true",
      "{invalid}",
      '{"question": 12345}',
      '{"question": null}',
      '{"question": []}',
      '{"question": {}}',
    ];

    for (const body of bodies) {
      const res = await fetch(`${BASE}/api/ai/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      }).catch(() => ({ status: 0 }));
      expect(res.status).not.toBe(500);
    }
  });

  // Header fuzzing
  it("handles oversized headers", async () => {
    const res = await fetch(`${BASE}/health`, {
      headers: { "X-Custom": "a".repeat(100_000) },
    }).catch(() => ({ status: 0 }));
    // Should reject, not crash
    expect([200, 400, 413, 431]).toContain(res.status);
  });
});
```

### 5. Performance Benchmarks (`tests/benchmarks/`)

```typescript
// tests/benchmarks/cache-bench.ts — Cache performance benchmarks
import { bench, describe } from "vitest";

describe("Cache Performance", () => {
  bench("cache.get (hit)", async () => {
    await cache.get("test-key");
  });
  
  bench("cache.set", async () => {
    await cache.set(`bench-${Math.random()}`, "value", 60);
  });

  bench("cache.get (miss)", async () => {
    await cache.get(`nonexistent-${Math.random()}`);
  });
});
```

### 6. CI Pipeline Enhancement (`cloudbuild-test.yaml`)

```yaml
# cloudbuild-test.yaml — Full test pipeline
steps:
  - name: node:22
    id: install
    entrypoint: npm
    args: [ci]

  # Parallel quality checks
  - name: node:22
    id: typecheck
    entrypoint: npx
    args: [tsc, --noEmit]
    waitFor: [install]
  
  - name: node:22
    id: lint
    entrypoint: npm
    args: [run, lint]
    waitFor: [install]
  
  - name: node:22
    id: unit-tests
    entrypoint: npx
    args: [vitest, run, --reporter=junit, --outputFile=/workspace/test-results/unit.xml]
    waitFor: [install]

  # Integration tests (need the server running)
  - name: node:22
    id: integration-tests
    entrypoint: bash
    args:
      - -c
      - |
        npm run build
        node dist/src/index.js &
        sleep 5
        npx vitest run tests/integration/ --reporter=junit --outputFile=/workspace/test-results/integration.xml
        kill %1
    waitFor: [install]

  # Upload test results
  - name: gcr.io/cloud-builders/gsutil
    args: [cp, -r, /workspace/test-results/, "gs://${_BUCKET}/test-results/${SHORT_SHA}/"]
    waitFor: [unit-tests, integration-tests]

  # Smoke load test (only on master)
  - name: grafana/k6
    id: load-smoke
    args: [run, --env, "BASE_URL=http://localhost:8080", tests/load/smoke.js]
    waitFor: [integration-tests]
```

### 7. GKE Load Test Runner

```yaml
# infra/k8s/load-test-job.yaml — Run stress tests from GKE
apiVersion: batch/v1
kind: Job
metadata:
  name: load-test-stress
spec:
  parallelism: 10  # 10 k6 pods in parallel
  template:
    spec:
      containers:
        - name: k6
          image: grafana/k6
          args:
            - run
            - --env
            - "BASE_URL=https://cryptocurrency.cv"
            - /scripts/stress.js
          volumeMounts:
            - name: scripts
              mountPath: /scripts
      volumes:
        - name: scripts
          configMap:
            name: k6-scripts
      restartPolicy: Never
```

### 8. Security Hardening Checklist

Implement these hardening measures in the codebase:

```typescript
// src/lib/security.ts — Security hardening utilities

// 1. Input sanitization
export function sanitizeInput(input: string, maxLength = 1000): string {
  return input
    .slice(0, maxLength)
    .replace(/[<>]/g, "")  // Strip HTML tags
    .trim();
}

// 2. Response headers (already have secureHeaders middleware)
// Verify: X-Content-Type-Options, X-Frame-Options, CSP

// 3. Request size limits
// Add to Hono middleware: limit body to 1MB

// 4. Structured error responses (never leak stack traces)
// Already have ApiError class — audit all catch blocks

// 5. API key rotation support
// Add key versioning to /api/keys

// 6. Dependency audit
// npm audit --production in CI
```

## Validation

1. All unit tests pass: `npx vitest run`
2. Integration tests pass against running server
3. Fuzz tests find no 500 errors
4. k6 smoke test passes (P95 < 2s, errors < 5%)
5. k6 stress test sustains 500 VUs without cascading failures
6. k6 soak test runs 2hrs without memory leaks
7. TypeScript compiles: `npx tsc --noEmit`
8. ESLint passes: `npm run lint`
9. No `any` types in new test code
10. Pipeline runs end-to-end in Cloud Build

## npm Dependencies to Add

```bash
# k6 is installed separately (binary, not npm)
# For integration tests:
npm install -D @vitest/coverage-v8
```

## k6 Installation

```bash
# Cloud Build / CI
# Use grafana/k6 Docker image

# Local
brew install k6  # macOS
# or
snap install k6  # Linux
```
