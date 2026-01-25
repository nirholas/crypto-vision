# Performance Optimization

Maximize Xeepy throughput while maintaining account safety.

## Profiling

### Identify Bottlenecks

```python
from xeepy import Xeepy
from xeepy.utils import profile_async

@profile_async
async def scrape_many_users(users: list):
    async with Xeepy() as x:
        results = []
        for user in users:
            profile = await x.scrape.profile(user)
            results.append(profile)
        return results

# Run with profiling
results = await scrape_many_users(users)
# Outputs timing for each operation
```

### Performance Metrics

```python
async with Xeepy(metrics=True) as x:
    await x.scrape.followers("username", limit=1000)
    
    # Get metrics
    metrics = x.get_metrics()
    print(f"Total requests: {metrics.total_requests}")
    print(f"Avg request time: {metrics.avg_request_time:.2f}s")
    print(f"Cache hit rate: {metrics.cache_hit_rate:.1%}")
    print(f"Rate limit waits: {metrics.rate_limit_waits}")
```

## Caching

### Enable Response Caching

```python
from xeepy import Xeepy
from xeepy.storage import Cache

# In-memory cache
cache = Cache(backend="memory", max_size=10000)

# Or Redis cache
cache = Cache(
    backend="redis",
    url="redis://localhost:6379",
    ttl=3600  # 1 hour
)

async with Xeepy(cache=cache) as x:
    # First call hits Twitter
    profile1 = await x.scrape.profile("username")
    
    # Second call uses cache
    profile2 = await x.scrape.profile("username")  # Instant!
```

### Smart Caching Strategies

```python
from xeepy.storage import CacheStrategy

# Cache profiles longer, tweets shorter
strategy = CacheStrategy({
    "profile": 86400,      # 24 hours
    "followers": 3600,     # 1 hour
    "tweets": 300,         # 5 minutes
    "trends": 60,          # 1 minute
})

async with Xeepy(cache_strategy=strategy) as x:
    pass
```

### Cache Invalidation

```python
async with Xeepy(cache=cache) as x:
    # Force refresh
    profile = await x.scrape.profile("username", force_refresh=True)
    
    # Clear specific cache
    await x.cache.invalidate("profile:username")
    
    # Clear all caches
    await x.cache.clear()
```

## Concurrent Operations

### Parallel Scraping (Different Resources)

```python
import asyncio

async with Xeepy() as x:
    # These can run in parallel (different users)
    tasks = [
        x.scrape.profile("user1"),
        x.scrape.profile("user2"),
        x.scrape.profile("user3"),
    ]
    profiles = await asyncio.gather(*tasks)
```

### Controlled Concurrency

```python
import asyncio
from asyncio import Semaphore

async def scrape_with_limit(x, users: list, max_concurrent: int = 5):
    semaphore = Semaphore(max_concurrent)
    
    async def scrape_one(user):
        async with semaphore:
            return await x.scrape.profile(user)
    
    tasks = [scrape_one(user) for user in users]
    return await asyncio.gather(*tasks)

async with Xeepy() as x:
    profiles = await scrape_with_limit(x, users, max_concurrent=3)
```

### Batch Operations

```python
async with Xeepy() as x:
    # Use GraphQL batch endpoint
    from xeepy.api.graphql import GraphQLClient
    
    gql = GraphQLClient(cookies=x.cookies)
    
    # Fetch 100 users in one request (vs 100 requests)
    users = await gql.users_by_ids(user_ids[:100])
```

## Browser Optimization

### Headless Mode

```python
# Always use headless in production
async with Xeepy(headless=True) as x:
    pass
```

### Resource Blocking

```python
from xeepy import Xeepy

# Block unnecessary resources
async with Xeepy(
    block_resources=["image", "media", "font", "stylesheet"]
) as x:
    # Faster page loads
    await x.scrape.profile("username")
```

### Browser Arguments

```python
browser_args = [
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--disable-extensions",
    "--no-first-run",
    "--disable-background-networking",
    "--disable-sync",
]

async with Xeepy(browser_args=browser_args) as x:
    pass
```

### Page Reuse

```python
from xeepy import Xeepy

# Reuse pages instead of creating new ones
async with Xeepy(page_pool_size=3) as x:
    for user in users:
        # Pages are recycled from pool
        await x.scrape.profile(user)
```

## Database Optimization

### Connection Pooling

```python
from xeepy import Xeepy

# Use connection pool for database
async with Xeepy(
    database="postgresql://localhost/xeepy",
    db_pool_size=10,
    db_pool_overflow=5,
) as x:
    pass
```

### Batch Inserts

```python
async with Xeepy() as x:
    # Scrape first, then batch insert
    profiles = []
    for user in users:
        profile = await x.scrape.profile(user)
        profiles.append(profile)
    
    # Single batch insert
    await x.storage.bulk_insert(profiles)
```

### Async Database Operations

```python
import asyncpg

async def save_profiles_fast(profiles: list):
    conn = await asyncpg.connect('postgresql://localhost/xeepy')
    
    # Use COPY for fastest inserts
    await conn.copy_records_to_table(
        'profiles',
        records=[(p.username, p.followers, p.bio) for p in profiles]
    )
    
    await conn.close()
```

## Memory Management

### Streaming Large Datasets

```python
async with Xeepy() as x:
    # Stream instead of loading all into memory
    async for batch in x.scrape.followers("big_account", batch_size=100):
        await process_batch(batch)
        # Batch is garbage collected after processing
```

### Generator Pattern

```python
async def scrape_users_generator(usernames: list):
    """Yield results one at a time to save memory."""
    async with Xeepy() as x:
        for username in usernames:
            yield await x.scrape.profile(username)

# Process without loading all into memory
async for profile in scrape_users_generator(million_users):
    await save_to_database(profile)
```

### Explicit Cleanup

```python
async with Xeepy() as x:
    for i, user in enumerate(users):
        profile = await x.scrape.profile(user)
        await save(profile)
        
        # Periodic cleanup
        if i % 100 == 0:
            await x.browser.cleanup_pages()
            import gc
            gc.collect()
```

## Network Optimization

### Connection Reuse

```python
async with Xeepy(
    keep_alive=True,
    connection_pool_size=10,
) as x:
    # Connections are reused
    for user in users:
        await x.scrape.profile(user)
```

### Request Pipelining

```python
from xeepy.api.graphql import GraphQLClient

gql = GraphQLClient(cookies=cookies)

# Pipeline multiple requests
async with gql.pipeline() as pipe:
    pipe.get_user("user1")
    pipe.get_user("user2")
    pipe.get_user("user3")
    results = await pipe.execute()  # Single round trip
```

### Compression

```python
async with Xeepy(
    accept_encoding="gzip, deflate, br"
) as x:
    # Responses are compressed
    pass
```

## Rate Limit Optimization

### Maximize Within Limits

```python
from xeepy import Xeepy
from xeepy.core.rate_limiter import OptimizedLimiter

# Use all available rate limit capacity
limiter = OptimizedLimiter(
    target_utilization=0.95,  # Use 95% of limits
    buffer_for_manual=0.05,   # Reserve 5% for manual use
)

async with Xeepy(rate_limiter=limiter) as x:
    pass
```

### Adaptive Delays

```python
from xeepy.core.rate_limiter import AdaptiveLimiter

# Automatically adjusts based on responses
limiter = AdaptiveLimiter(
    initial_delay=2.0,
    min_delay=0.5,
    max_delay=30.0,
    increase_on_429=True,     # Slow down on rate limit
    decrease_on_success=True,  # Speed up on success
)
```

## Benchmarks

### Measure Performance

```python
import time
from xeepy import Xeepy

async def benchmark_scraping():
    async with Xeepy() as x:
        start = time.time()
        
        for i in range(100):
            await x.scrape.profile(f"user{i}")
        
        elapsed = time.time() - start
        print(f"Scraped 100 profiles in {elapsed:.2f}s")
        print(f"Average: {elapsed/100:.2f}s per profile")

await benchmark_scraping()
```

### Compare Configurations

```python
configs = [
    {"name": "baseline", "config": {}},
    {"name": "with_cache", "config": {"cache": True}},
    {"name": "blocked_images", "config": {"block_resources": ["image"]}},
    {"name": "optimized", "config": {"cache": True, "block_resources": ["image", "font"]}},
]

for cfg in configs:
    async with Xeepy(**cfg["config"]) as x:
        start = time.time()
        for user in test_users:
            await x.scrape.profile(user)
        elapsed = time.time() - start
        print(f"{cfg['name']}: {elapsed:.2f}s")
```

## Performance Checklist

### Quick Wins

- [ ] Enable headless mode
- [ ] Block images and fonts
- [ ] Enable caching
- [ ] Use batch operations where possible
- [ ] Reuse browser pages

### Medium Effort

- [ ] Implement connection pooling
- [ ] Use streaming for large datasets
- [ ] Add request pipelining
- [ ] Optimize database queries

### Advanced

- [ ] Deploy across multiple machines
- [ ] Implement custom rate limiter
- [ ] Use GraphQL batch endpoints
- [ ] Profile and optimize hot paths

## Typical Performance

| Operation | Without Optimization | Optimized |
|-----------|---------------------|-----------|
| Profile scrape | 2-3s | 0.5-1s |
| Followers (1000) | 60-90s | 20-30s |
| Tweets (100) | 30-45s | 10-15s |
| Batch profiles (100) | 5-8 min | 1-2 min |

## Next Steps

- [Distributed](distributed.md) - Scale horizontally
- [Docker](docker.md) - Container optimization
- [Architecture](architecture.md) - Understanding internals
