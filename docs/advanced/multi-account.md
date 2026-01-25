# Multi-Account Management

Manage multiple Twitter accounts safely and efficiently with Xeepy' multi-account features.

## Account Organization

### Account Registry

```python
from xeepy import Xeepy
from xeepy.core.accounts import AccountRegistry

# Register accounts
registry = AccountRegistry()
registry.add("main", cookies="cookies/main.json", proxy="http://proxy1:8080")
registry.add("backup", cookies="cookies/backup.json", proxy="http://proxy2:8080")
registry.add("growth", cookies="cookies/growth.json", proxy="http://proxy3:8080")

# Use specific account
async with registry.get("main") as x:
    await x.scrape.profile("username")
```

### Account Configuration File

```yaml
# accounts.yaml
accounts:
  main:
    cookies: cookies/main.json
    proxy: http://proxy1.example.com:8080
    rate_limit_profile: conservative
    tags: [primary, personal]
    
  growth:
    cookies: cookies/growth.json
    proxy: http://proxy2.example.com:8080
    rate_limit_profile: normal
    tags: [growth, engagement]
    
  scraper:
    cookies: cookies/scraper.json
    proxy: http://proxy3.example.com:8080
    rate_limit_profile: aggressive
    tags: [scraping, data]

defaults:
  headless: true
  stealth: true
```

```python
from xeepy.core.accounts import AccountRegistry

registry = AccountRegistry.from_file("accounts.yaml")

async with registry.get("main") as x:
    pass
```

## Parallel Account Operations

### Simultaneous Scraping

```python
import asyncio
from xeepy.core.accounts import AccountRegistry

registry = AccountRegistry.from_file("accounts.yaml")

async def scrape_with_account(account_name: str, usernames: list):
    async with registry.get(account_name) as x:
        results = []
        for username in usernames:
            profile = await x.scrape.profile(username)
            results.append(profile)
        return results

# Distribute work across accounts
all_usernames = ["user1", "user2", ..., "user100"]
chunk_size = len(all_usernames) // 3

results = await asyncio.gather(
    scrape_with_account("main", all_usernames[:chunk_size]),
    scrape_with_account("backup", all_usernames[chunk_size:chunk_size*2]),
    scrape_with_account("scraper", all_usernames[chunk_size*2:]),
)
```

### Account Pool

```python
from xeepy.core.accounts import AccountPool

# Create pool of accounts
pool = AccountPool([
    {"cookies": "account1.json", "proxy": "http://proxy1:8080"},
    {"cookies": "account2.json", "proxy": "http://proxy2:8080"},
    {"cookies": "account3.json", "proxy": "http://proxy3:8080"},
])

async def process_users(users: list):
    tasks = []
    for user in users:
        # Automatically assigns available account
        account = await pool.acquire()
        task = process_user(account, user)
        tasks.append(task)
    
    results = await asyncio.gather(*tasks)
    
    # Release all accounts
    await pool.release_all()
    return results

async def process_user(account, user):
    try:
        async with account as x:
            return await x.scrape.profile(user)
    finally:
        await pool.release(account)
```

## Account Health Monitoring

### Health Checks

```python
from xeepy.core.accounts import AccountRegistry, HealthStatus

registry = AccountRegistry.from_file("accounts.yaml")

# Check all accounts
health_report = await registry.check_health()

for name, status in health_report.items():
    icon = "✅" if status == HealthStatus.HEALTHY else "❌"
    print(f"{icon} {name}: {status.value}")
    
    if status == HealthStatus.RATE_LIMITED:
        print(f"   Rate limited until: {status.reset_time}")
    elif status == HealthStatus.SUSPENDED:
        print(f"   Account suspended!")
    elif status == HealthStatus.NEEDS_VERIFICATION:
        print(f"   Verification required")
```

### Continuous Monitoring

```python
from xeepy.core.accounts import AccountMonitor

monitor = AccountMonitor(registry)

@monitor.on("account_unhealthy")
async def on_unhealthy(account_name: str, status: HealthStatus):
    print(f"⚠️ {account_name} is unhealthy: {status}")
    await send_notification(f"Account {account_name} needs attention!")

@monitor.on("account_recovered")
async def on_recovered(account_name: str):
    print(f"✅ {account_name} recovered!")

# Start monitoring (checks every 15 minutes)
await monitor.start(interval=900)
```

### Account Rotation on Issues

```python
from xeepy.core.accounts import SmartAccountPool

pool = SmartAccountPool(
    accounts=registry.all(),
    rotation_strategy="health_aware",
    auto_remove_unhealthy=True,
    min_healthy_accounts=2,
)

async with pool.get_healthy_account() as x:
    # Automatically uses healthiest available account
    await x.scrape.profile("username")
```

## Account Isolation

### Dedicated Proxies

```python
from xeepy.core.accounts import AccountRegistry

registry = AccountRegistry()

# Each account gets dedicated proxy
registry.add("account1", 
    cookies="account1.json",
    proxy="http://dedicated-proxy1.com:8080",
    sticky_proxy=True  # Never share this proxy
)

registry.add("account2",
    cookies="account2.json", 
    proxy="http://dedicated-proxy2.com:8080",
    sticky_proxy=True
)
```

### Browser Profile Isolation

```python
from xeepy import Xeepy
from xeepy.core.stealth import Fingerprint

# Each account has unique fingerprint
account1_fingerprint = Fingerprint.generate(seed="account1")
account2_fingerprint = Fingerprint.generate(seed="account2")

async with Xeepy(
    cookies="account1.json",
    fingerprint=account1_fingerprint
) as x:
    pass
```

### Data Isolation

```python
from xeepy import Xeepy

# Separate databases per account
async with Xeepy(
    cookies="account1.json",
    database="data/account1.db"
) as x:
    pass
```

## Account Warm-up

### New Account Protocol

```python
from xeepy.core.accounts import AccountWarmup

warmup = AccountWarmup(
    duration_days=14,
    activities=[
        # Week 1: Light activity
        {"day_range": (1, 7), "follows": 10, "likes": 30, "tweets": 1},
        # Week 2: Moderate activity
        {"day_range": (8, 14), "follows": 25, "likes": 75, "tweets": 3},
    ],
    human_behavior=True,
)

async with Xeepy(cookies="new_account.json") as x:
    await warmup.run(x)
```

### Graduated Activity

```python
async def warmup_account(cookies_path: str, day: int):
    """Run daily warmup routine."""
    # Activity increases each day
    multiplier = min(day / 14, 1.0)  # Full activity after 14 days
    
    async with Xeepy(cookies=cookies_path) as x:
        # Scrolling and viewing
        await x.browse.timeline(duration=random.randint(300, 900))
        
        # Likes (5 to 75 based on day)
        like_count = int(5 + 70 * multiplier)
        await x.engage.auto_like(
            keywords=["interesting", "cool"],
            limit=like_count
        )
        
        # Follows (2 to 30 based on day)
        if multiplier > 0.3:  # After day 4
            follow_count = int(2 + 28 * multiplier)
            await x.follow.by_hashtag("#tech", limit=follow_count)
```

## Account Statistics

### Activity Tracking

```python
from xeepy.core.accounts import AccountStats

stats = AccountStats(registry)

# Get stats for all accounts
report = await stats.generate_report()

for name, account_stats in report.items():
    print(f"\n{name}:")
    print(f"  Followers: {account_stats.followers}")
    print(f"  Following: {account_stats.following}")
    print(f"  Today's actions: {account_stats.actions_today}")
    print(f"  Rate limit usage: {account_stats.rate_limit_usage:.1%}")
```

### Export Account Data

```python
# Export all account stats
await stats.export_to_csv("account_stats.csv")

# Export activity history
await stats.export_activity_history("activity_history.csv", days=30)
```

## Account Backup

### Backup Sessions

```python
from xeepy.core.accounts import AccountBackup

backup = AccountBackup(registry)

# Backup all account cookies
await backup.backup_all("backups/")

# Restore from backup
await backup.restore("backups/2024-01-15/")
```

### Session Refresh

```python
from xeepy.core.accounts import SessionManager

manager = SessionManager(registry)

# Refresh sessions that are about to expire
await manager.refresh_expiring(threshold_days=7)

# Validate all sessions
validation = await manager.validate_all()
for name, valid in validation.items():
    print(f"{name}: {'✅' if valid else '❌'}")
```

## Best Practices

### 1. One Proxy Per Account

```python
# ✅ Good - dedicated proxies
registry.add("acc1", cookies="acc1.json", proxy="http://proxy1:8080")
registry.add("acc2", cookies="acc2.json", proxy="http://proxy2:8080")

# ❌ Bad - shared proxy
shared_proxy = "http://proxy1:8080"
registry.add("acc1", cookies="acc1.json", proxy=shared_proxy)
registry.add("acc2", cookies="acc2.json", proxy=shared_proxy)
```

### 2. Stagger Account Activity

```python
import random

async def run_accounts():
    accounts = list(registry.all())
    random.shuffle(accounts)
    
    for account in accounts:
        async with account as x:
            await x.engage.auto_like(keywords=["tech"], limit=50)
        
        # Wait between accounts
        await asyncio.sleep(random.randint(300, 900))
```

### 3. Monitor Account Relationships

```python
# Don't let accounts interact with each other
blacklist = {
    "account1": ["account2", "account3"],  # account1 won't interact with these
    "account2": ["account1", "account3"],
}

async with registry.get("account1", interaction_blacklist=blacklist) as x:
    pass
```

### 4. Diversify Account Activity

```python
# Each account has different focus
account_strategies = {
    "growth": {"focus": "following", "keywords": ["startup", "tech"]},
    "engagement": {"focus": "likes", "keywords": ["python", "coding"]},
    "content": {"focus": "tweets", "schedule": "daily"},
}
```

## Troubleshooting

### Account locked out

1. Stop all automation immediately
2. Check email for Twitter notifications
3. Complete any verification prompts manually
4. Wait 24-48 hours before resuming
5. Use conservative settings when resuming

### Sessions expiring frequently

1. Use `session_refresh` to keep sessions alive
2. Check for suspicious activity warnings
3. Ensure consistent fingerprint/proxy combinations

### Rate limits across accounts

1. Verify each account uses different proxy
2. Check for IP address leaks
3. Reduce parallel operations
4. Use health-aware account selection

## Next Steps

- [Rate Limiting](rate-limiting.md) - Protect accounts from bans
- [Proxies](proxies.md) - IP management
- [Distributed](distributed.md) - Scale across machines
