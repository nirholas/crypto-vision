# Proxy Configuration

Proxies help distribute requests across multiple IPs, avoiding rate limits and detection. XTools provides comprehensive proxy support.

## Why Use Proxies?

- **IP Rotation**: Distribute requests across multiple IPs
- **Geographic Targeting**: Access region-specific content
- **Account Safety**: Isolate accounts to dedicated IPs
- **Avoid Blocks**: Bypass IP-based restrictions

## Basic Proxy Setup

### Single Proxy

```python
from xtools import XTools

# HTTP proxy
async with XTools(proxy="http://user:pass@proxy.example.com:8080") as x:
    await x.scrape.profile("username")

# SOCKS5 proxy
async with XTools(proxy="socks5://user:pass@proxy.example.com:1080") as x:
    await x.scrape.profile("username")
```

### Proxy from Environment

```bash
# Set environment variable
export XTOOLS_PROXY="http://user:pass@proxy.example.com:8080"
```

```python
# Automatically uses XTOOLS_PROXY
async with XTools() as x:
    pass
```

## Proxy Rotation

### Round Robin

```python
from xtools import XTools
from xtools.core.proxy import ProxyRotator, RotationStrategy

proxies = [
    "http://proxy1.example.com:8080",
    "http://proxy2.example.com:8080",
    "http://proxy3.example.com:8080",
]

rotator = ProxyRotator(
    proxies=proxies,
    strategy=RotationStrategy.ROUND_ROBIN
)

async with XTools(proxy_rotator=rotator) as x:
    # Each request uses next proxy in list
    for user in users:
        await x.scrape.profile(user)
```

### Random Selection

```python
rotator = ProxyRotator(
    proxies=proxies,
    strategy=RotationStrategy.RANDOM
)
```

### Weighted Selection

```python
# Prefer faster/more reliable proxies
proxies_with_weights = [
    ("http://fast-proxy.com:8080", 0.5),    # 50% of requests
    ("http://medium-proxy.com:8080", 0.3),  # 30% of requests
    ("http://slow-proxy.com:8080", 0.2),    # 20% of requests
]

rotator = ProxyRotator(
    proxies=proxies_with_weights,
    strategy=RotationStrategy.WEIGHTED
)
```

### Per-Request Rotation

```python
rotator = ProxyRotator(
    proxies=proxies,
    strategy=RotationStrategy.ROUND_ROBIN,
    rotate_on="request"  # New proxy for each request
)
```

### Per-Account Rotation

```python
rotator = ProxyRotator(
    proxies=proxies,
    strategy=RotationStrategy.STICKY,
    rotate_on="session"  # Same proxy for entire session
)
```

## Residential Proxies

Residential proxies are highly recommended for Twitter automation:

### BrightData Integration

```python
from xtools import XTools
from xtools.core.proxy import BrightDataProxy

proxy = BrightDataProxy(
    username="your_username",
    password="your_password",
    country="US",  # Target country
    session_type="rotating"  # or "sticky"
)

async with XTools(proxy=proxy) as x:
    pass
```

### SmartProxy Integration

```python
from xtools.core.proxy import SmartProxy

proxy = SmartProxy(
    username="your_username",
    password="your_password",
    endpoint="gate.smartproxy.com:7000"
)
```

### Generic Residential Provider

```python
from xtools.core.proxy import ResidentialProxy

proxy = ResidentialProxy(
    endpoint="http://proxy.provider.com:8080",
    username="user",
    password="pass",
    rotation_url="http://api.provider.com/rotate",  # Optional
    country="US",
    city="New York"
)
```

## Proxy Health Monitoring

### Automatic Health Checks

```python
rotator = ProxyRotator(
    proxies=proxies,
    health_check=True,
    health_check_interval=300,  # Check every 5 minutes
    health_check_url="https://api.ipify.org",  # Test endpoint
    remove_dead_proxies=True,
    min_healthy_proxies=2,  # Fail if fewer than 2 healthy
)
```

### Manual Health Check

```python
async with XTools(proxy_rotator=rotator) as x:
    # Check all proxies
    health = await rotator.check_health()
    
    for proxy, status in health.items():
        print(f"{proxy}: {'✅' if status.healthy else '❌'}")
        print(f"  Latency: {status.latency_ms}ms")
        print(f"  Last error: {status.last_error}")
```

### Proxy Statistics

```python
stats = rotator.get_stats()
print(f"Total requests: {stats.total_requests}")
print(f"Failed requests: {stats.failed_requests}")
print(f"Average latency: {stats.avg_latency_ms}ms")

# Per-proxy stats
for proxy, proxy_stats in stats.by_proxy.items():
    print(f"{proxy}:")
    print(f"  Success rate: {proxy_stats.success_rate:.1%}")
    print(f"  Avg latency: {proxy_stats.avg_latency_ms}ms")
```

## Proxy Configuration File

### YAML Configuration

```yaml
# proxies.yaml
proxies:
  - url: http://proxy1.example.com:8080
    weight: 1.0
    tags: [fast, us]
    
  - url: http://proxy2.example.com:8080
    username: user
    password: pass
    weight: 0.8
    tags: [medium, eu]
    
  - url: socks5://proxy3.example.com:1080
    weight: 0.5
    tags: [slow, asia]

rotation:
  strategy: weighted
  rotate_on: request
  
health_check:
  enabled: true
  interval: 300
  timeout: 10
  
failover:
  max_retries: 3
  remove_after_failures: 5
```

```python
from xtools.core.proxy import ProxyRotator

rotator = ProxyRotator.from_file("proxies.yaml")

async with XTools(proxy_rotator=rotator) as x:
    pass
```

## Account-Proxy Assignment

### Dedicated Proxies per Account

```python
from xtools import XTools
from xtools.core.proxy import AccountProxyManager

# Assign dedicated proxies to accounts
manager = AccountProxyManager({
    "account1": "http://proxy1.example.com:8080",
    "account2": "http://proxy2.example.com:8080",
    "account3": "http://proxy3.example.com:8080",
})

# Each account always uses its assigned proxy
async with XTools(cookies="account1.json", proxy_manager=manager) as x:
    # Uses proxy1 automatically
    pass
```

### Sticky Sessions

```python
from xtools.core.proxy import StickySessionManager

# Maintain same IP for session duration
manager = StickySessionManager(
    proxies=proxies,
    session_duration=3600,  # 1 hour per IP
)

async with XTools(proxy_manager=manager) as x:
    # Same proxy for 1 hour
    pass
```

## Geographic Targeting

### Country-Specific Proxies

```python
from xtools.core.proxy import GeoProxyRouter

router = GeoProxyRouter({
    "US": ["http://us-proxy1.com:8080", "http://us-proxy2.com:8080"],
    "UK": ["http://uk-proxy1.com:8080"],
    "DE": ["http://de-proxy1.com:8080"],
})

async with XTools(proxy_router=router, target_country="US") as x:
    # Uses US proxy
    pass
```

### Dynamic Geo Selection

```python
async with XTools(proxy_router=router) as x:
    # Get content as seen from UK
    x.set_geo("UK")
    uk_trends = await x.trends()
    
    # Get content as seen from US
    x.set_geo("US")
    us_trends = await x.trends()
```

## Proxy Error Handling

### Automatic Failover

```python
from xtools.core.proxy import FailoverConfig

failover = FailoverConfig(
    max_retries=3,
    retry_delay=5,
    fallback_to_direct=False,  # Don't use direct connection
    on_all_failed="raise",  # or "wait" or "direct"
)

rotator = ProxyRotator(
    proxies=proxies,
    failover=failover
)
```

### Custom Error Handling

```python
async def on_proxy_error(proxy: str, error: Exception):
    """Called when a proxy fails."""
    print(f"Proxy {proxy} failed: {error}")
    # Could alert, log, or dynamically add new proxies

rotator = ProxyRotator(
    proxies=proxies,
    on_error=on_proxy_error
)
```

## Testing Proxies

### Verify Proxy Works

```python
from xtools.core.proxy import test_proxy

result = await test_proxy(
    "http://proxy.example.com:8080",
    test_url="https://twitter.com",
    timeout=10
)

if result.success:
    print(f"✅ Proxy works! IP: {result.ip}, Latency: {result.latency_ms}ms")
else:
    print(f"❌ Proxy failed: {result.error}")
```

### Bulk Testing

```python
from xtools.core.proxy import test_proxies

results = await test_proxies(
    proxies,
    concurrent=10,  # Test 10 at a time
    test_url="https://twitter.com"
)

working = [p for p, r in results.items() if r.success]
print(f"{len(working)}/{len(proxies)} proxies working")
```

## Best Practices

### 1. Use Residential Proxies for Actions

```python
# Datacenter proxies for scraping (cheaper)
scrape_proxies = ["http://dc-proxy1.com:8080", ...]

# Residential proxies for actions (safer)
action_proxies = ["http://res-proxy1.com:8080", ...]

async with XTools(
    scrape_proxy_rotator=ProxyRotator(scrape_proxies),
    action_proxy_rotator=ProxyRotator(action_proxies)
) as x:
    pass
```

### 2. Match Proxy Location to Account

```python
# US account should use US proxy
us_account = {"cookies": "us_account.json", "proxy": "http://us-proxy.com:8080"}
uk_account = {"cookies": "uk_account.json", "proxy": "http://uk-proxy.com:8080"}
```

### 3. Monitor Proxy Quality

```python
# Log proxy performance
async with XTools(proxy_rotator=rotator) as x:
    x.on("request_complete", lambda r: log_proxy_stats(r.proxy, r.latency))
```

### 4. Rotate IPs Periodically

```python
# Force rotation every N requests
rotator = ProxyRotator(
    proxies=proxies,
    max_requests_per_proxy=50,  # Rotate after 50 requests
)
```

## Troubleshooting

### Proxy not connecting

1. Verify proxy URL format
2. Check authentication credentials
3. Test proxy independently
4. Check firewall/network restrictions

### Slow performance

1. Use geographically closer proxies
2. Test proxy latency
3. Use fewer concurrent requests
4. Consider faster proxy provider

### Getting blocked

1. Switch to residential proxies
2. Reduce request rate
3. Rotate IPs more frequently
4. Check if proxy is blacklisted

## Next Steps

- [Stealth Mode](stealth.md) - Browser fingerprint protection
- [Distributed](distributed.md) - Multi-machine setups
- [Multi-Account](multi-account.md) - Account management
