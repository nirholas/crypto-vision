# Troubleshooting

> Common issues, diagnostic procedures, and solutions for the Crypto Vision platform.

---

## Table of Contents

- [Quick Diagnostics](#quick-diagnostics)
- [Startup Issues](#startup-issues)
- [Data Source Issues](#data-source-issues)
- [Redis Issues](#redis-issues)
- [BigQuery Issues](#bigquery-issues)
- [AI Provider Issues](#ai-provider-issues)
- [Worker Issues](#worker-issues)
- [WebSocket Issues](#websocket-issues)
- [Performance Issues](#performance-issues)
- [Docker / Container Issues](#docker--container-issues)

---

## Quick Diagnostics

### Health Check

```bash
curl http://localhost:8080/health | jq .
```

The health endpoint provides a comprehensive system overview including:
- Cache statistics (size, hit rate, evictions)
- Circuit breaker states (CLOSED/HALF-OPEN/OPEN per upstream host)
- Queue status (pending, active, total executed)
- WebSocket connections (per topic)
- Degraded routes (routes using fallback sources)
- Memory usage

### Prometheus Metrics

```bash
curl http://localhost:8080/metrics
```

Look for:
- `http_requests_total{status="500"}` — Internal errors
- `upstream_requests_total{status="429"}` — Rate limit hits
- `circuit_breaker_state` — Open circuit breakers (value = 1)
- `queue_depth` — Queue saturation

### Logs

```bash
# Real-time log following
docker logs -f crypto-vision

# Filter errors only
docker logs crypto-vision 2>&1 | grep '"level":"error"'

# Check for slow requests
docker logs crypto-vision 2>&1 | grep "Slow request"
```

---

## Startup Issues

### Environment Validation Failures

**Symptom:** Process crashes immediately on startup with a Zod validation error.

**Cause:** Missing or invalid environment variables. The `env.ts` module validates all required variables at startup.

**Example error:**
```
ZodError: [
  { "code": "invalid_type", "expected": "string", "path": ["DATABASE_URL"] }
]
```

**Solution:** Set the required environment variable:

```bash
# Check what env vars are expected
grep -r 'z\.' src/lib/env.ts | head -20

# Common required variables:
export PORT=8080
export NODE_ENV=development
export LOG_LEVEL=info
```

**Tip:** Most environment variables have sensible defaults. Only `DATABASE_URL` (for bot features) and provider API keys (for AI features) are conditionally required.

### Port Already in Use

**Symptom:** `EADDRINUSE: address already in use :::8080`

**Solution:**

```bash
# Find what's using the port
lsof -i :8080

# Kill the process
kill -9 <PID>

# Or use a different port
PORT=8081 npm run dev
```

### Module Resolution Errors

**Symptom:** `Cannot find module '@/lib/...'`

**Solution:**

```bash
# Rebuild TypeScript path aliases
npm run build

# Or in development with tsx
npm run dev
```

---

## Data Source Issues

### CoinGecko Rate Limiting (429)

**Symptom:** CoinGecko endpoints return stale data or errors. Circuit breaker shows OPEN for `api.coingecko.com`.

**Explanation:** CoinGecko's free API has strict rate limits (10-30 requests/minute). The platform implements adaptive throttling, but during high traffic or multiple scans, limits can be hit.

**Diagnostics:**

```bash
# Check circuit breaker state
curl http://localhost:8080/health | jq '.circuitBreakers["api.coingecko.com"]'

# Check 429 rate
curl http://localhost:8080/metrics | grep 'upstream_requests_total{source="coingecko",status="429"}'
```

**Solutions:**

1. **Wait for cooldown** — Circuit breaker auto-resets after 30 seconds. CoinGecko typically resets in 60 seconds.
2. **Use a CoinGecko API key** — Set `COINGECKO_API_KEY` for higher limits (500 req/min on demo plan).
3. **Increase cache TTL** — Longer cache times reduce upstream calls:
   ```bash
   CACHE_MAX_ENTRIES=500000
   ```
4. **Fallback sources work automatically** — Market data falls back to CoinCap and CoinLore.

See [CoinGecko Rate Limiting](COINGECKO_RATE_LIMITING.md) for the full guide.

### DeFiLlama Errors

**Symptom:** DeFi protocol data is stale or unavailable.

**Diagnostics:**

```bash
curl http://localhost:8080/health | jq '.circuitBreakers["api.llama.fi"]'
```

**Solutions:**

1. DeFiLlama is free and rarely rate-limited. Usually resolves after circuit breaker reset.
2. Check if DeFiLlama is experiencing downtime: `curl -I https://api.llama.fi/protocols`

### All Upstream Sources Down

**Symptom:** Multiple circuit breakers open. Health endpoint shows "unhealthy".

**Possible causes:**
- Network connectivity issue from the server
- DNS resolution failure
- Corporate proxy blocking outbound requests

**Diagnostics:**

```bash
# Test outbound connectivity
curl -I https://api.coingecko.com/api/v3/ping
curl -I https://api.llama.fi/protocols
curl -I https://api.binance.com/api/v3/ping

# Check DNS
nslookup api.coingecko.com
```

---

## Redis Issues

### Redis Connection Refused

**Symptom:** Log messages like `Redis connection refused` or `Error: connect ECONNREFUSED 127.0.0.1:6379`

**Impact:** The platform runs fine without Redis. The cache falls back to memory-only, rate limiting falls back to in-memory, and key management uses only static keys from environment variables.

**Solutions:**

1. **Check Redis is running:**
   ```bash
   redis-cli ping  # Should return PONG
   docker ps | grep redis  # Check container status
   ```

2. **Check connection string:**
   ```bash
   # Ensure REDIS_URL is set correctly
   echo $REDIS_URL
   # Format: redis://[:password@]host[:port][/db]
   # Example: redis://localhost:6379
   ```

3. **Start Redis via Docker:**
   ```bash
   docker run -d --name redis -p 6379:6379 redis:7-alpine
   ```

### Redis Memory Full

**Symptom:** Redis starts rejecting writes. Cache and rate limiting stop updating.

**Solutions:**

```bash
# Check memory usage
redis-cli info memory

# Flush cache keys (safe — they auto-regenerate)
redis-cli keys "cv:cache:*" | xargs redis-cli del

# Set max memory with LRU eviction
redis-cli config set maxmemory 256mb
redis-cli config set maxmemory-policy allkeys-lru
```

---

## BigQuery Issues

### Authentication Errors

**Symptom:** `Error: Could not load the default credentials` or `Permission denied`

**Solutions:**

1. **Service account key:**
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
   ```

2. **Application Default Credentials:**
   ```bash
   gcloud auth application-default login
   ```

3. **Verify permissions:**
   ```bash
   # Required roles:
   # - BigQuery Data Editor (roles/bigquery.dataEditor)
   # - BigQuery Job User (roles/bigquery.jobUser)
   gcloud projects get-iam-policy YOUR_PROJECT --format=json | jq '.bindings[] | select(.role | contains("bigquery"))'
   ```

### BigQuery Dataset/Table Not Found

**Symptom:** `Not found: Dataset crypto_vision` or `Not found: Table crypto_vision.market_data`

**Solution:**

```bash
# Create the dataset and tables
cd infra/bigquery
bq mk --dataset crypto_vision
bq query --use_legacy_sql=false < tables.sql
bq query --use_legacy_sql=false < views.sql
```

Or run the infrastructure setup:

```bash
cd infra && bash setup.sh
```

---

## AI Provider Issues

### All AI Providers Failing

**Symptom:** AI endpoints return 502 errors. Log shows fallback chain exhausted.

**Diagnostics:**

```bash
# Check which providers are configured
env | grep -E 'GROQ_API_KEY|OPENAI_API_KEY|GEMINI_API_KEY|ANTHROPIC_API_KEY|OPENROUTER_API_KEY' | wc -l

# Check AI queue
curl http://localhost:8080/health | jq '.queue.ai'
```

**Solutions:**

1. **Set at least one API key:**
   ```bash
   export GROQ_API_KEY=gsk_...  # Free tier available at console.groq.com
   ```

2. **Check API key validity:**
   ```bash
   # Test Groq directly
   curl https://api.groq.com/openai/v1/models -H "Authorization: Bearer $GROQ_API_KEY"
   ```

3. **Check queue saturation:**
   - If `queue.ai.pending > 400`, the AI queue may be overloaded
   - Wait for pending tasks to drain, or increase concurrency

### AI Queue Full (503)

**Symptom:** AI requests return 503 with `SERVICE_UNAVAILABLE` error code.

**Cause:** More than 500 AI requests are queued (10 concurrent + 500 waiting).

**Solutions:**

1. **Wait** — Queue drains naturally as requests complete
2. **Reduce AI temperature** — Lower temperature = faster inference
3. **Enable caching** — AI responses are cached; subsequent identical queries avoid the queue
4. **Rate limit AI endpoints** — Set more aggressive rate limits for public tier on AI routes

---

## Worker Issues

### Worker Crashes / Restart Loop

**Symptom:** Worker container keeps restarting. Logs show repeated errors.

**Diagnostics:**

```bash
docker logs crypto-vision-worker 2>&1 | tail -50
```

**Common causes:**

1. **BigQuery auth failure** — Workers need BigQuery write access. See BigQuery section above.
2. **Pub/Sub topic doesn't exist** — Run `infra/setup.sh` to create topics.
3. **Upstream API permanently down** — Workers have exponential backoff (up to 16× interval), but will keep retrying.

**Solutions:**

```bash
# Restart the worker
docker restart crypto-vision-worker

# Check worker health
docker exec crypto-vision-worker curl http://localhost:8081/health
```

### Data Not Ingesting

**Symptom:** BigQuery tables are not receiving new rows. Dashboard shows stale data.

**Diagnostics:**

```bash
# Check if workers are running
docker compose ps | grep worker

# Check worker log for errors
docker logs crypto-vision-worker 2>&1 | grep '"level":"error"'

# Verify BigQuery connectivity
bq query --use_legacy_sql=false "SELECT COUNT(*) FROM crypto_vision.market_data WHERE ingested_at > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR)"
```

---

## WebSocket Issues

### WebSocket Connection Refused

**Symptom:** `WebSocket connection to 'ws://localhost:8080/ws/prices' failed`

**Possible causes:**

1. **Wrong URL** — Ensure using `ws://` (not `http://`) and correct topic path
2. **Proxy not configured for WebSocket** — Nginx/Traefik need explicit WebSocket upgrade config:
   ```nginx
   location /ws/ {
     proxy_pass http://crypto-vision:8080;
     proxy_http_version 1.1;
     proxy_set_header Upgrade $http_upgrade;
     proxy_set_header Connection "upgrade";
   }
   ```

### WebSocket Disconnects Frequently

**Symptom:** Client frequently disconnects and reconnects.

**Possible causes:**

1. **No heartbeat/ping support** — Ensure your client responds to WebSocket ping frames
2. **Load balancer timeout** — Set idle timeout > 60 seconds:
   ```nginx
   proxy_read_timeout 3600;
   proxy_send_timeout 3600;
   ```
3. **Redis not available** — Without Redis, WebSocket messages won't fan out across instances

---

## Performance Issues

### High Memory Usage

**Diagnostics:**

```bash
curl http://localhost:8080/health | jq '.memory'
```

**Solutions:**

1. **Reduce cache size:**
   ```bash
   CACHE_MAX_ENTRIES=100000  # Default is 200000
   ```

2. **Reduce sliding windows:**
   - Anomaly detection maintains 1000-point windows per metric
   - If too many metrics accumulate, windows consume significant memory

3. **Check for memory leaks:**
   ```bash
   # Monitor RSS over time
   while true; do curl -s http://localhost:8080/health | jq '.memory.rss'; sleep 60; done
   ```

### Slow Response Times

**Diagnostics:**

```bash
# Check P99 latency
curl http://localhost:8080/metrics | grep 'http_request_duration_seconds'

# Check cache hit rate
curl http://localhost:8080/health | jq '.cache.hitRate'

# Check for open circuit breakers (fallbacks are slower)
curl http://localhost:8080/health | jq '.circuitBreakers'
```

**Solutions:**

1. **Improve cache hit rate** — If < 70%, increase `CACHE_MAX_ENTRIES`
2. **Fix circuit breakers** — Investigate why upstreams are failing
3. **Reduce concurrent AI requests** — Heavy AI queries block other operations

See [Performance](PERFORMANCE.md) for the complete performance tuning guide.

---

## Docker / Container Issues

### Container Won't Start

```bash
# Check logs
docker logs crypto-vision

# Check if build succeeded
docker build -t crypto-vision .

# Common issue: missing .env file in production
# Solution: Use environment variables directly, not .env files
docker run -e PORT=8080 -e NODE_ENV=production crypto-vision
```

### Docker Compose Services Not Communicating

```bash
# Check network
docker network ls
docker network inspect crypto-vision_default

# Check DNS resolution between services
docker exec crypto-vision ping redis
docker exec crypto-vision ping postgres
```

### Out of Disk Space

```bash
# Clean up Docker resources
docker system prune -a
docker volume prune
```

---

## Getting Help

If you're still stuck:

1. **Search existing issues:** Check the GitHub issues for similar problems
2. **Check logs thoroughly:** Set `LOG_LEVEL=debug` for more verbose output
3. **Reproduce minimally:** Try to isolate the issue to a single component
4. **Include diagnostics:** When reporting issues, include output from `/health`, relevant logs, and your configuration (with secrets redacted)
