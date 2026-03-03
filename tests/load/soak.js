/**
 * k6 Soak Test — Extended duration test to detect memory leaks and resource exhaustion.
 *
 * Runs at a steady 100 VUs for 2 hours. Monitors for:
 * - Memory leaks (increasing response times over duration)
 * - Connection pool exhaustion
 * - Cache growth without bounds
 * - File descriptor leaks
 *
 * Pass criteria: P95 < 2s throughout, error rate < 1%.
 *
 * Usage:
 *   k6 run tests/load/soak.js
 *   k6 run --env BASE_URL=https://cryptocurrency.cv tests/load/soak.js
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend, Counter, Gauge } from "k6/metrics";

const errorRate = new Rate("errors");
const customLatency = new Trend("custom_latency");
const requestCount = new Counter("requests");
const healthCheckLatency = new Trend("health_check_latency");

export const options = {
  stages: [
    { duration: "2m", target: 100 },    // Ramp up
    { duration: "116m", target: 100 },   // 2hrs steady state
    { duration: "2m", target: 0 },       // Ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<2000"],  // P95 must stay below 2s
    errors: ["rate<0.01"],               // Very low error rate for soak
    http_req_failed: ["rate<0.01"],
  },
};

const BASE_URL = __ENV.BASE_URL || "https://cryptocurrency.cv";

const ENDPOINTS = [
  { path: "/health", weight: 5 },
  { path: "/api/coins", weight: 25 },
  { path: "/api/coin/bitcoin", weight: 10 },
  { path: "/api/coin/ethereum", weight: 8 },
  { path: "/api/trending", weight: 8 },
  { path: "/api/global", weight: 8 },
  { path: "/api/defi/protocols", weight: 10 },
  { path: "/api/defi/chains", weight: 5 },
  { path: "/api/news", weight: 10 },
  { path: "/api/fear-greed", weight: 3 },
  { path: "/api/onchain/gas", weight: 3 },
  { path: "/api/exchanges", weight: 3 },
  { path: "/api/anomalies", weight: 2 },
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

export default function () {
  const endpoint = weightedRandom(ENDPOINTS);
  const url = `${BASE_URL}${endpoint.path}`;

  const params = {
    headers: {
      Accept: "application/json",
      "User-Agent": "k6-soak-test",
    },
    timeout: "10s",
  };

  if (__ENV.API_KEY) {
    params.headers["X-API-Key"] = __ENV.API_KEY;
  }

  const res = http.get(url, params);

  requestCount.add(1);
  customLatency.add(res.timings.duration);

  // Track health check latency separately to detect degradation
  if (endpoint.path === "/health") {
    healthCheckLatency.add(res.timings.duration);
  }

  const success = check(res, {
    "status is 2xx or 429": (r) =>
      (r.status >= 200 && r.status < 300) || r.status === 429,
    "response has body": (r) => r.body && r.body.length > 0,
    "response time < 2s": (r) => r.timings.duration < 2000,
  });

  errorRate.add(!success);

  // Periodically check memory via /health endpoint
  if (Math.random() < 0.01) {
    // 1% chance per iteration
    const healthRes = http.get(`${BASE_URL}/health`, {
      headers: { Accept: "application/json" },
      timeout: "5s",
    });
    if (healthRes.status === 200) {
      try {
        const body = JSON.parse(healthRes.body);
        if (body.memory) {
          console.log(
            `[soak] Memory: rss=${body.memory.rss}MB heap=${body.memory.heapUsed}MB cache=${body.cache?.size || "N/A"}`,
          );
        }
      } catch {
        // Ignore parse errors
      }
    }
  }

  sleep(Math.random() * 1.5 + 0.3);
}

export function handleSummary(data) {
  return {
    stdout: JSON.stringify(
      {
        test: "soak",
        timestamp: new Date().toISOString(),
        baseUrl: BASE_URL,
        duration: "2h",
        metrics: {
          httpReqDuration: {
            avg: data.metrics.http_req_duration.values.avg,
            p50: data.metrics.http_req_duration.values["p(50)"],
            p95: data.metrics.http_req_duration.values["p(95)"],
            p99: data.metrics.http_req_duration.values["p(99)"],
            max: data.metrics.http_req_duration.values.max,
          },
          errorRate: data.metrics.errors ? data.metrics.errors.values.rate : 0,
          totalRequests: data.metrics.http_reqs.values.count,
          requestsPerSecond: data.metrics.http_reqs.values.rate,
          healthCheckP95: data.metrics.health_check_latency
            ? data.metrics.health_check_latency.values["p(95)"]
            : null,
        },
      },
      null,
      2,
    ),
  };
}
