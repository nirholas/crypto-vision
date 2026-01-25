# Distributed Operations

Scale Xeepy across multiple machines for large-scale data collection and automation.

## Architecture Overview

```mermaid
graph TB
    subgraph "Control Plane"
        Coordinator[Coordinator]
        Queue[(Task Queue)]
        Results[(Results Store)]
    end
    
    subgraph "Worker Node 1"
        W1[Xeepy Worker]
        A1[Account Pool]
        P1[Proxy Pool]
    end
    
    subgraph "Worker Node 2"
        W2[Xeepy Worker]
        A2[Account Pool]
        P2[Proxy Pool]
    end
    
    subgraph "Worker Node N"
        WN[Xeepy Worker]
        AN[Account Pool]
        PN[Proxy Pool]
    end
    
    Coordinator --> Queue
    Queue --> W1
    Queue --> W2
    Queue --> WN
    
    W1 --> Results
    W2 --> Results
    WN --> Results
```

## Basic Distributed Setup

### Using Redis Queue

```python
# coordinator.py
from xeepy.distributed import Coordinator
import redis

# Connect to Redis
redis_client = redis.Redis(host='redis-server', port=6379)

coordinator = Coordinator(
    queue=redis_client,
    results_store=redis_client,
)

# Add tasks
usernames = ["user1", "user2", ..., "user10000"]
for username in usernames:
    await coordinator.enqueue("scrape_profile", {"username": username})

# Wait for results
results = await coordinator.collect_results(timeout=3600)
```

```python
# worker.py
from xeepy import Xeepy
from xeepy.distributed import Worker
import redis

redis_client = redis.Redis(host='redis-server', port=6379)

worker = Worker(
    queue=redis_client,
    results_store=redis_client,
    xeepy_config={
        "cookies": "worker_account.json",
        "proxy": "http://worker-proxy:8080",
    }
)

@worker.task("scrape_profile")
async def scrape_profile(x: Xeepy, username: str):
    return await x.scrape.profile(username)

# Start processing
await worker.run()
```

### Running Workers

```bash
# Start multiple workers
python worker.py --id=worker-1 &
python worker.py --id=worker-2 &
python worker.py --id=worker-3 &
```

## Celery Integration

### Setup

```python
# celery_app.py
from celery import Celery
from xeepy import Xeepy

app = Celery('xeepy_tasks', 
    broker='redis://localhost:6379/0',
    backend='redis://localhost:6379/1'
)

@app.task
def scrape_profile(username: str, cookies_path: str):
    import asyncio
    
    async def _scrape():
        async with Xeepy(cookies=cookies_path) as x:
            return await x.scrape.profile(username)
    
    return asyncio.run(_scrape())

@app.task
def scrape_followers(username: str, cookies_path: str, limit: int = 1000):
    import asyncio
    
    async def _scrape():
        async with Xeepy(cookies=cookies_path) as x:
            return await x.scrape.followers(username, limit=limit)
    
    return asyncio.run(_scrape())
```

### Usage

```python
from celery_app import scrape_profile, scrape_followers
from celery import group

# Single task
result = scrape_profile.delay("username", "cookies/account1.json")
profile = result.get(timeout=60)

# Parallel tasks
tasks = group([
    scrape_profile.s(user, "cookies/account1.json")
    for user in usernames
])
results = tasks.apply_async()
all_profiles = results.get()
```

## Custom Task Queue

### Task Queue Implementation

```python
# task_queue.py
import asyncio
import aioredis
import json
from dataclasses import dataclass
from typing import Optional

@dataclass
class Task:
    id: str
    type: str
    payload: dict
    priority: int = 0
    retries: int = 0
    max_retries: int = 3

class TaskQueue:
    def __init__(self, redis_url: str):
        self.redis_url = redis_url
        self.redis: Optional[aioredis.Redis] = None
    
    async def connect(self):
        self.redis = await aioredis.from_url(self.redis_url)
    
    async def enqueue(self, task: Task):
        await self.redis.zadd(
            "tasks:pending",
            {json.dumps(task.__dict__): task.priority}
        )
    
    async def dequeue(self) -> Optional[Task]:
        result = await self.redis.zpopmin("tasks:pending")
        if result:
            task_data = json.loads(result[0][0])
            return Task(**task_data)
        return None
    
    async def complete(self, task: Task, result: dict):
        await self.redis.hset(
            "tasks:results",
            task.id,
            json.dumps(result)
        )
    
    async def fail(self, task: Task, error: str):
        if task.retries < task.max_retries:
            task.retries += 1
            await self.enqueue(task)
        else:
            await self.redis.hset(
                "tasks:failed",
                task.id,
                json.dumps({"error": error, "task": task.__dict__})
            )
```

### Distributed Worker

```python
# distributed_worker.py
import asyncio
from xeepy import Xeepy
from task_queue import TaskQueue, Task

class DistributedWorker:
    def __init__(
        self,
        worker_id: str,
        queue: TaskQueue,
        accounts: list[str],
        proxies: list[str],
    ):
        self.worker_id = worker_id
        self.queue = queue
        self.accounts = accounts
        self.proxies = proxies
        self.current_account_idx = 0
    
    def get_next_account(self) -> tuple[str, str]:
        """Round-robin account/proxy selection."""
        account = self.accounts[self.current_account_idx]
        proxy = self.proxies[self.current_account_idx % len(self.proxies)]
        self.current_account_idx = (self.current_account_idx + 1) % len(self.accounts)
        return account, proxy
    
    async def process_task(self, task: Task) -> dict:
        account, proxy = self.get_next_account()
        
        async with Xeepy(cookies=account, proxy=proxy) as x:
            if task.type == "scrape_profile":
                return await x.scrape.profile(task.payload["username"])
            elif task.type == "scrape_followers":
                return await x.scrape.followers(
                    task.payload["username"],
                    limit=task.payload.get("limit", 1000)
                )
            elif task.type == "follow_user":
                await x.follow.user(task.payload["username"])
                return {"success": True}
            else:
                raise ValueError(f"Unknown task type: {task.type}")
    
    async def run(self):
        await self.queue.connect()
        print(f"Worker {self.worker_id} started")
        
        while True:
            task = await self.queue.dequeue()
            
            if task is None:
                await asyncio.sleep(1)
                continue
            
            try:
                result = await self.process_task(task)
                await self.queue.complete(task, result)
                print(f"Completed task {task.id}")
            except Exception as e:
                await self.queue.fail(task, str(e))
                print(f"Failed task {task.id}: {e}")
```

## Load Balancing

### Smart Task Distribution

```python
from xeepy.distributed import SmartCoordinator

coordinator = SmartCoordinator(
    workers=["worker-1", "worker-2", "worker-3"],
    strategy="least_loaded",  # or "round_robin", "random", "weighted"
)

# Tasks automatically distributed
for username in usernames:
    await coordinator.submit("scrape_profile", {"username": username})
```

### Account-Aware Distribution

```python
from xeepy.distributed import AccountAwareCoordinator

coordinator = AccountAwareCoordinator(
    accounts={
        "worker-1": ["account1", "account2"],
        "worker-2": ["account3", "account4"],
        "worker-3": ["account5", "account6"],
    },
    rate_limits_per_account={
        "scrape": 500,
        "follow": 100,
        "like": 300,
    }
)

# Respects rate limits across distributed workers
for username in usernames:
    await coordinator.submit("scrape_profile", {"username": username})
```

## Fault Tolerance

### Worker Health Monitoring

```python
from xeepy.distributed import WorkerMonitor

monitor = WorkerMonitor(
    workers=["worker-1", "worker-2", "worker-3"],
    heartbeat_interval=30,
    failure_threshold=3,
)

@monitor.on("worker_failed")
async def on_worker_failed(worker_id: str):
    print(f"Worker {worker_id} failed!")
    # Redistribute tasks
    await coordinator.redistribute_tasks(worker_id)
    # Alert
    await send_alert(f"Worker {worker_id} is down")

await monitor.start()
```

### Task Retry with Exponential Backoff

```python
from xeepy.distributed import RetryPolicy

retry_policy = RetryPolicy(
    max_retries=3,
    initial_delay=60,
    exponential_base=2,
    max_delay=900,
    retryable_errors=[
        "RateLimitError",
        "NetworkError",
        "TimeoutError",
    ]
)

worker = Worker(
    queue=queue,
    retry_policy=retry_policy,
)
```

## Results Aggregation

### Streaming Results

```python
# Collect results as they complete
async for result in coordinator.stream_results():
    print(f"Got result: {result}")
    await process_result(result)
```

### Batch Collection

```python
# Collect in batches
async for batch in coordinator.collect_batches(batch_size=100):
    await bulk_insert_to_database(batch)
```

### Result Storage

```python
from xeepy.distributed import ResultStore

store = ResultStore(
    backend="postgresql",
    connection_string="postgresql://user:pass@localhost/xeepy"
)

# Store results
await store.save(task_id, result)

# Query results
profiles = await store.query(
    task_type="scrape_profile",
    created_after="2024-01-01"
)
```

## Docker Deployment

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  redis:
    image: redis:7
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  coordinator:
    build: .
    command: python coordinator.py
    depends_on:
      - redis
    environment:
      - REDIS_URL=redis://redis:6379
    volumes:
      - ./tasks:/app/tasks

  worker:
    build: .
    command: python worker.py
    depends_on:
      - redis
    environment:
      - REDIS_URL=redis://redis:6379
    volumes:
      - ./cookies:/app/cookies
    deploy:
      replicas: 5

volumes:
  redis_data:
```

### Kubernetes Deployment

```yaml
# worker-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: xeepy-worker
spec:
  replicas: 10
  selector:
    matchLabels:
      app: xeepy-worker
  template:
    metadata:
      labels:
        app: xeepy-worker
    spec:
      containers:
      - name: worker
        image: xeepy-worker:latest
        env:
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: xeepy-secrets
              key: redis-url
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        volumeMounts:
        - name: cookies
          mountPath: /app/cookies
      volumes:
      - name: cookies
        secret:
          secretName: xeepy-cookies
```

## Monitoring & Observability

### Prometheus Metrics

```python
from prometheus_client import Counter, Histogram, start_http_server

# Metrics
tasks_processed = Counter('xeepy_tasks_processed_total', 'Tasks processed', ['type', 'status'])
task_duration = Histogram('xeepy_task_duration_seconds', 'Task duration', ['type'])

class MetricsWorker(Worker):
    async def process_task(self, task):
        with task_duration.labels(task.type).time():
            try:
                result = await super().process_task(task)
                tasks_processed.labels(task.type, 'success').inc()
                return result
            except Exception as e:
                tasks_processed.labels(task.type, 'failure').inc()
                raise

# Start metrics server
start_http_server(8000)
```

### Grafana Dashboard

```json
{
  "dashboard": {
    "title": "Xeepy Distributed",
    "panels": [
      {
        "title": "Tasks Processed",
        "type": "graph",
        "targets": [
          {"expr": "rate(xeepy_tasks_processed_total[5m])"}
        ]
      },
      {
        "title": "Task Duration",
        "type": "heatmap",
        "targets": [
          {"expr": "xeepy_task_duration_seconds_bucket"}
        ]
      }
    ]
  }
}
```

## Best Practices

### 1. Isolate Accounts to Workers

```python
# Each worker has dedicated accounts
worker_configs = [
    {"worker_id": "w1", "accounts": ["acc1", "acc2"], "proxies": ["proxy1", "proxy2"]},
    {"worker_id": "w2", "accounts": ["acc3", "acc4"], "proxies": ["proxy3", "proxy4"]},
]
```

### 2. Use Priority Queues

```python
# High-priority tasks processed first
await coordinator.submit("urgent_scrape", payload, priority=10)
await coordinator.submit("normal_scrape", payload, priority=1)
```

### 3. Implement Circuit Breakers

```python
from xeepy.distributed import CircuitBreaker

circuit_breaker = CircuitBreaker(
    failure_threshold=5,
    recovery_timeout=300,
)

async def protected_scrape(username):
    if circuit_breaker.is_open:
        raise CircuitOpenError("Too many failures")
    
    try:
        result = await scrape(username)
        circuit_breaker.record_success()
        return result
    except Exception as e:
        circuit_breaker.record_failure()
        raise
```

### 4. Graceful Shutdown

```python
import signal

async def shutdown(worker):
    print("Shutting down gracefully...")
    await worker.finish_current_task()
    await worker.close()

signal.signal(signal.SIGTERM, lambda s, f: asyncio.create_task(shutdown(worker)))
```

## Next Steps

- [Docker](docker.md) - Container deployment
- [Performance](performance.md) - Optimization tips
- [Multi-Account](multi-account.md) - Account management
