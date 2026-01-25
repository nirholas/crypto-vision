# Docker Deployment

Deploy Xeepy in containers for consistent, reproducible environments.

## Quick Start

### Dockerfile

```dockerfile
# Dockerfile
FROM mcr.microsoft.com/playwright/python:v1.40.0-jammy

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Xeepy
RUN pip install xeepy

# Copy application
COPY . .

# Run
CMD ["python", "main.py"]
```

### Basic Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  xeepy:
    build: .
    volumes:
      - ./cookies:/app/cookies
      - ./data:/app/data
    environment:
      - XEEPY_HEADLESS=true
      - XEEPY_PROXY=${PROXY_URL}
```

## Production Setup

### Multi-Stage Build

```dockerfile
# Dockerfile.production
# Build stage
FROM python:3.11-slim as builder

WORKDIR /app
COPY requirements.txt .
RUN pip wheel --no-cache-dir --wheel-dir /wheels -r requirements.txt

# Production stage
FROM mcr.microsoft.com/playwright/python:v1.40.0-jammy

WORKDIR /app

# Copy wheels and install
COPY --from=builder /wheels /wheels
RUN pip install --no-cache-dir /wheels/* && rm -rf /wheels

# Install browser
RUN playwright install chromium

# Non-root user for security
RUN useradd -m -u 1000 xeepy
USER xeepy

COPY --chown=xeepy:xeepy . .

CMD ["python", "main.py"]
```

### Production Docker Compose

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  xeepy-scraper:
    image: xeepy:latest
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '1'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 1G
    volumes:
      - cookies:/app/cookies:ro
      - data:/app/data
    environment:
      - XEEPY_HEADLESS=true
      - XEEPY_RATE_LIMIT=conservative
    secrets:
      - proxy_credentials
    networks:
      - xeepy-network
    healthcheck:
      test: ["CMD", "python", "-c", "import xeepy; print('ok')"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    networks:
      - xeepy-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: xeepy
      POSTGRES_USER: xeepy
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    secrets:
      - db_password
    networks:
      - xeepy-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U xeepy"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  cookies:
  data:
  redis_data:
  postgres_data:

networks:
  xeepy-network:
    driver: bridge

secrets:
  proxy_credentials:
    file: ./secrets/proxy.txt
  db_password:
    file: ./secrets/db_password.txt
```

## Specialized Containers

### Scraper Container

```dockerfile
# Dockerfile.scraper
FROM mcr.microsoft.com/playwright/python:v1.40.0-jammy

WORKDIR /app

RUN pip install xeepy[scraping]

COPY scraper/ .

ENTRYPOINT ["python", "scraper.py"]
CMD ["--help"]
```

```python
# scraper.py
import asyncio
import argparse
from xeepy import Xeepy

async def main(args):
    async with Xeepy(
        cookies=args.cookies,
        headless=True,
        proxy=args.proxy
    ) as x:
        if args.action == "followers":
            data = await x.scrape.followers(args.target, limit=args.limit)
        elif args.action == "tweets":
            data = await x.scrape.tweets(args.target, limit=args.limit)
        
        x.export.to_json(data, args.output)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["followers", "tweets"])
    parser.add_argument("target")
    parser.add_argument("--cookies", required=True)
    parser.add_argument("--proxy")
    parser.add_argument("--limit", type=int, default=1000)
    parser.add_argument("--output", default="output.json")
    
    args = parser.parse_args()
    asyncio.run(main(args))
```

### Worker Container

```dockerfile
# Dockerfile.worker
FROM mcr.microsoft.com/playwright/python:v1.40.0-jammy

WORKDIR /app

RUN pip install xeepy[distributed] celery redis

COPY worker/ .

CMD ["celery", "-A", "tasks", "worker", "--loglevel=info"]
```

### API Container

```dockerfile
# Dockerfile.api
FROM mcr.microsoft.com/playwright/python:v1.40.0-jammy

WORKDIR /app

RUN pip install xeepy[api] uvicorn

COPY api/ .

EXPOSE 8000

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
```

## Resource Management

### Memory Optimization

```yaml
# Browser uses significant memory
services:
  xeepy:
    deploy:
      resources:
        limits:
          memory: 2G  # Minimum for browser automation
    environment:
      # Reduce memory usage
      - XEEPY_BROWSER_ARGS=--disable-dev-shm-usage,--disable-gpu
      - PLAYWRIGHT_BROWSERS_PATH=/tmp/browsers
```

### CPU Allocation

```yaml
services:
  xeepy-scraper:
    deploy:
      resources:
        limits:
          cpus: '1'
        reservations:
          cpus: '0.25'
```

### Shared Memory

```yaml
services:
  xeepy:
    shm_size: '2gb'  # Required for Chromium
```

## Networking

### Proxy Configuration

```yaml
services:
  xeepy:
    environment:
      - HTTP_PROXY=http://proxy:8080
      - HTTPS_PROXY=http://proxy:8080
      - XEEPY_PROXY=http://proxy:8080

  proxy:
    image: your-proxy-image
    ports:
      - "8080:8080"
```

### Network Isolation

```yaml
networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
    internal: true  # No external access

services:
  api:
    networks:
      - frontend
      - backend
  
  xeepy:
    networks:
      - backend  # Only internal access
```

## Persistent Storage

### Cookie Storage

```yaml
volumes:
  cookies:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /secure/cookies

services:
  xeepy:
    volumes:
      - cookies:/app/cookies:ro
```

### Data Storage

```yaml
volumes:
  data:
    driver: local

services:
  xeepy:
    volumes:
      - data:/app/data
      - ./exports:/app/exports  # Local bind for exports
```

## Security

### Non-Root User

```dockerfile
RUN useradd -m -u 1000 xeepy
USER xeepy
```

### Read-Only Filesystem

```yaml
services:
  xeepy:
    read_only: true
    tmpfs:
      - /tmp
    volumes:
      - cookies:/app/cookies:ro
      - data:/app/data
```

### Secrets Management

```yaml
secrets:
  twitter_cookies:
    external: true  # From Docker Swarm/K8s
  proxy_auth:
    file: ./secrets/proxy.txt

services:
  xeepy:
    secrets:
      - twitter_cookies
      - proxy_auth
    environment:
      - XEEPY_COOKIES=/run/secrets/twitter_cookies
```

## Health Checks

```yaml
services:
  xeepy:
    healthcheck:
      test: ["CMD", "python", "healthcheck.py"]
      interval: 60s
      timeout: 30s
      retries: 3
      start_period: 30s
```

```python
# healthcheck.py
import asyncio
import sys
from xeepy import Xeepy

async def check():
    try:
        async with Xeepy(headless=True) as x:
            # Simple check - can browser launch?
            return True
    except Exception:
        return False

if asyncio.run(check()):
    sys.exit(0)
else:
    sys.exit(1)
```

## Logging

### Structured Logging

```yaml
services:
  xeepy:
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
        labels: "service,env"
    environment:
      - XEEPY_LOG_FORMAT=json
      - XEEPY_LOG_LEVEL=INFO
```

### Centralized Logging

```yaml
services:
  xeepy:
    logging:
      driver: syslog
      options:
        syslog-address: "tcp://logstash:5000"
        tag: "xeepy-{{.Name}}"
```

## Monitoring

### Prometheus Metrics

```yaml
services:
  xeepy:
    ports:
      - "9090:9090"  # Metrics endpoint
    environment:
      - XEEPY_METRICS_ENABLED=true
      - XEEPY_METRICS_PORT=9090

  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9091:9090"
```

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'xeepy'
    static_configs:
      - targets: ['xeepy:9090']
```

## Scaling

### Horizontal Scaling

```bash
# Scale workers
docker-compose up -d --scale xeepy-worker=5

# Or with Docker Swarm
docker service scale xeepy_worker=10
```

### Auto-Scaling with Kubernetes

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: xeepy-worker
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: xeepy-worker
  minReplicas: 2
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

## Development vs Production

### Development

```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  xeepy:
    build:
      context: .
      dockerfile: Dockerfile.dev
    volumes:
      - .:/app  # Live code reload
      - /app/node_modules
    environment:
      - XEEPY_DEBUG=true
      - XEEPY_HEADLESS=false  # Show browser
    ports:
      - "5900:5900"  # VNC for browser viewing
```

### Running

```bash
# Development
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# Production
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## Troubleshooting

### Browser Issues

```yaml
services:
  xeepy:
    environment:
      # Common fixes
      - DISPLAY=:99
      - XEEPY_BROWSER_ARGS=--no-sandbox,--disable-setuid-sandbox,--disable-dev-shm-usage
    shm_size: '2gb'
```

### Permission Issues

```bash
# Fix volume permissions
docker-compose run --rm xeepy chown -R 1000:1000 /app/data
```

### Debugging

```bash
# Interactive shell
docker-compose exec xeepy bash

# View logs
docker-compose logs -f xeepy

# Resource usage
docker stats
```

## Next Steps

- [Distributed](distributed.md) - Multi-node setups
- [Performance](performance.md) - Optimization
- [Testing](testing.md) - Testing in containers
