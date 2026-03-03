/**
 * k6 Stress Test — Push the API to its limits.
 *
 * Ramps from 50 to 500 VUs over 10 minutes with realistic traffic patterns.
 * Pass criteria: P95 < 3s, error rate < 10%.
 *
 * Usage:
 *   k6 run tests/load/stress.js
 *   k6 run --env BASE_URL=https://cryptocurrency.cv tests/load/stress.js
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";

const errorRate = new Rate("errors");
const responseTime = new Trend("response_time");
const requestCount = new Counter("requests");

export const options = {
  stages: [
    { duration: "1m", target: 50 },    // Warm up
    { duration: "2m", target: 200 },   // Scale up
    { duration: "3m", target: 500 },   // Peak stress
    { duration: "2m", target: 200 },   // Scale down
    { duration: "1m", target: 50 },    // Cool down
    { duration: "1m", target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ["p(50)<500", "p(95)<3000", "p(99)<5000"],
    errors: ["rate<0.10"],             // Allow 10% errors under stress
    http_req_failed: ["rate<0.10"],
  },
};

const BASE_URL = __ENV.BASE_URL || "https://cryptocurrency.cv";

// Realistic traffic distribution based on expected access patterns
const TRAFFIC_PATTERN = [
  { path: "/api/coins", weight: 25, method: "GET" },
  { path: "/api/coin/bitcoin", weight: 15, method: "GET" },
  { path: "/api/coin/ethereum", weight: 10, method: "GET" },
  { path: "/api/trending", weight: 8, method: "GET" },
  { path: "/api/global", weight: 8, method: "GET" },
  { path: "/api/defi/protocols", weight: 8, method: "GET" },
  { path: "/api/defi/yields", weight: 5, method: "GET" },
  { path: "/api/news", weight: 8, method: "GET" },
  { path: "/api/news/bitcoin", weight: 3, method: "GET" },
  { path: "/api/fear-greed", weight: 3, method: "GET" },
  { path: "/api/onchain/gas", weight: 2, method: "GET" },
  { path: "/api/exchanges", weight: 2, method: "GET" },
  { path: "/api/search?q=sol", weight: 3, method: "GET" },
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
  const endpoint = weightedRandom(TRAFFIC_PATTERN);
  const url = `${BASE_URL}${endpoint.path}`;

  const params = {
    headers: {
      Accept: "application/json",
      "User-Agent": "k6-stress-test",
    },
    timeout: "10s",
  };

  if (__ENV.API_KEY) {
    params.headers["X-API-Key"] = __ENV.API_KEY;
  }

  const res = http.get(url, params);

  requestCount.add(1);
  responseTime.add(res.timings.duration);

  const success = check(res, {
    "status is 2xx or 429": (r) =>
      (r.status >= 200 && r.status < 300) || r.status === 429,
    "response time < 5s": (r) => r.timings.duration < 5000,
    "has valid JSON": (r) => {
      try {
        JSON.parse(r.body);
        return true;
      } catch {
        return false;
      }
    },
  });

  errorRate.add(!success);
  sleep(Math.random() * 1 + 0.2);
}

export function handleSummary(data) {
  return {
    stdout: JSON.stringify(
      {
        test: "stress",
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
          customResponseTimeP50: data.metrics.response_time
            ? data.metrics.response_time.values["p(50)"]
            : null,
          customResponseTimeP95: data.metrics.response_time
            ? data.metrics.response_time.values["p(95)"]
            : null,
        },
      },
      null,
      2,
    ),
  };
}
