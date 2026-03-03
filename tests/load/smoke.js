/**
 * k6 Smoke Test — Quick validation of API health under light load.
 *
 * 10 VUs for 1 minute, weighted random endpoint selection.
 * Pass criteria: P95 < 2s, error rate < 5%.
 *
 * Usage:
 *   k6 run tests/load/smoke.js
 *   k6 run --env BASE_URL=https://cryptocurrency.cv tests/load/smoke.js
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const errorRate = new Rate("errors");
const customLatency = new Trend("custom_latency");

export const options = {
  stages: [
    { duration: "15s", target: 10 },  // Ramp up
    { duration: "30s", target: 10 },  // Steady state
    { duration: "15s", target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<2000"],  // 95th percentile < 2s
    errors: ["rate<0.05"],               // Error rate < 5%
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:8080";

const ENDPOINTS = [
  { path: "/health", weight: 5 },
  { path: "/api/coins", weight: 20 },
  { path: "/api/trending", weight: 10 },
  { path: "/api/global", weight: 10 },
  { path: "/api/fear-greed", weight: 5 },
  { path: "/api/defi/protocols", weight: 15 },
  { path: "/api/defi/chains", weight: 10 },
  { path: "/api/news", weight: 15 },
  { path: "/api/onchain/gas", weight: 5 },
  { path: "/api/exchanges", weight: 5 },
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
      "User-Agent": "k6-smoke-test",
    },
    timeout: "10s",
  };

  // Add API key if provided
  if (__ENV.API_KEY) {
    params.headers["X-API-Key"] = __ENV.API_KEY;
  }

  const res = http.get(url, params);

  const success = check(res, {
    "status is 200 or rate-limited": (r) =>
      r.status === 200 || r.status === 429,
    "response has body": (r) => r.body && r.body.length > 0,
    "response time < 2s": (r) => r.timings.duration < 2000,
    "valid JSON response": (r) => {
      try {
        JSON.parse(r.body);
        return true;
      } catch {
        return false;
      }
    },
  });

  errorRate.add(!success);
  customLatency.add(res.timings.duration);

  sleep(Math.random() * 2 + 0.5);
}

export function handleSummary(data) {
  return {
    stdout: JSON.stringify(
      {
        test: "smoke",
        timestamp: new Date().toISOString(),
        baseUrl: BASE_URL,
        metrics: {
          httpReqDuration: {
            avg: data.metrics.http_req_duration.values.avg,
            p50: data.metrics.http_req_duration.values["p(50)"],
            p95: data.metrics.http_req_duration.values["p(95)"],
            p99: data.metrics.http_req_duration.values["p(99)"],
          },
          errorRate: data.metrics.errors ? data.metrics.errors.values.rate : 0,
          totalRequests: data.metrics.http_reqs.values.count,
          requestsPerSecond: data.metrics.http_reqs.values.rate,
        },
      },
      null,
      2,
    ),
  };
}
