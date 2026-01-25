# Rate Limiting

Intelligent rate limiting is crucial for account safety. XTools provides sophisticated rate limiting that protects your accounts while maximizing throughput.

## Understanding Twitter Rate Limits

Twitter enforces various rate limits:

| Action Type | Approximate Limit | Reset Window |
|-------------|-------------------|--------------|
| Follow | 400/day | 24 hours |
| Unfollow | 400/day | 24 hours |
| Like | 1000/day | 24 hours |
| Tweet | 2400/day | 24 hours |
| DM | 500/day | 24 hours |
| Profile views | 500/15min | 15 minutes |
| Search | 180/15min | 15 minutes |

!!! warning "Limits Change"
    Twitter frequently updates rate limits without notice. XTools monitors for rate limit responses and adapts accordingly.

## Rate Limit Profiles

### Built-in Profiles

```python
from xtools import XTools

# Conservative - safest, slowest
async with XTools(rate_limit_profile="conservative") as x:
    # 5-10 second delays, 50% of limits
    pass

# Normal - balanced approach (default)
async with XTools(rate_limit_profile="normal") as x:
    # 2-5 second delays, 70% of limits
    pass

# Aggressive - faster, riskier
async with XTools(rate_limit_profile="aggressive") as x:
    # 1-2 second delays, 90% of limits
    pass

# Stealth - human-like patterns
async with XTools(rate_limit_profile="stealth") as x:
    # Variable delays, activity bursts, breaks
    pass
```

### Profile Comparison

```python
PROFILES = {
    "conservative": {
        "follow_delay": (8, 15),      # 8-15 seconds between follows
        "like_delay": (3, 8),         # 3-8 seconds between likes
        "scrape_delay": (2, 5),       # 2-5 seconds between pages
        "daily_follow_limit": 100,    # Max follows per day
        "daily_like_limit": 300,      # Max likes per day
        "burst_limit": 5,             # Actions before mandatory pause
        "burst_pause": (60, 120),     # Pause duration after burst
    },
    "normal": {
        "follow_delay": (4, 8),
        "like_delay": (2, 4),
        "scrape_delay": (1, 3),
        "daily_follow_limit": 200,
        "daily_like_limit": 500,
        "burst_limit": 10,
        "burst_pause": (30, 60),
    },
    "aggressive": {
        "follow_delay": (1, 3),
        "like_delay": (0.5, 2),
        "scrape_delay": (0.5, 1.5),
        "daily_follow_limit": 350,
        "daily_like_limit": 800,
        "burst_limit": 20,
        "burst_pause": (15, 30),
    },
    "stealth": {
        # Dynamic based on time of day and activity patterns
        "adaptive": True,
        "human_patterns": True,
        "random_breaks": True,
    }
}
```

## Custom Rate Limiting

### Creating Custom Profiles

```python
from xtools import XTools
from xtools.core.rate_limiter import RateLimitProfile

# Define custom profile
custom_profile = RateLimitProfile(
    name="my_profile",
    delays={
        "follow": (5, 10),
        "unfollow": (3, 7),
        "like": (2, 5),
        "comment": (10, 20),
        "retweet": (5, 10),
        "scrape": (1, 3),
        "dm": (30, 60),
    },
    daily_limits={
        "follow": 150,
        "unfollow": 200,
        "like": 400,
        "comment": 50,
        "retweet": 100,
        "dm": 100,
    },
    burst_config={
        "limit": 8,
        "pause_range": (45, 90),
    }
)

async with XTools(rate_limit_profile=custom_profile) as x:
    pass
```

### Runtime Configuration

```python
async with XTools() as x:
    # Adjust limits at runtime
    x.rate_limiter.set_delay("follow", (10, 20))
    x.rate_limiter.set_daily_limit("follow", 50)
    
    # Check remaining quota
    remaining = x.rate_limiter.remaining("follow")
    print(f"Can follow {remaining} more users today")
    
    # Reset counters (use carefully!)
    x.rate_limiter.reset_counters()
```

## Stealth Mode

The stealth profile mimics human behavior patterns:

```python
from xtools import XTools
from xtools.core.rate_limiter import StealthConfig

stealth_config = StealthConfig(
    # Activity windows (24-hour format)
    active_hours=(9, 23),  # Active 9 AM to 11 PM
    
    # Random breaks
    break_probability=0.1,  # 10% chance of taking a break
    break_duration=(300, 900),  # 5-15 minute breaks
    
    # Activity patterns
    burst_mode=True,  # Occasional activity bursts
    burst_probability=0.2,
    burst_size=(3, 8),
    
    # Gradual warmup
    warmup_period=3600,  # 1 hour warmup
    warmup_multiplier=0.5,  # 50% speed during warmup
    
    # Timezone simulation
    timezone="America/New_York",
)

async with XTools(stealth_config=stealth_config) as x:
    # Actions follow human-like patterns
    await x.engage.auto_like(keywords=["python"], limit=100)
```

### Human-Like Patterns

```python
import random
from datetime import datetime

class HumanPatterns:
    """Simulate human behavior patterns."""
    
    @staticmethod
    def should_be_active() -> bool:
        """Check if user would typically be active now."""
        hour = datetime.now().hour
        # Less active at night
        if 2 <= hour <= 7:
            return random.random() < 0.1
        # Most active during day
        if 9 <= hour <= 22:
            return random.random() < 0.9
        return random.random() < 0.5
    
    @staticmethod
    def get_delay_multiplier() -> float:
        """Adjust delays based on time of day."""
        hour = datetime.now().hour
        # Slower at night
        if 2 <= hour <= 7:
            return 2.0
        # Normal during day
        return 1.0
    
    @staticmethod
    def should_take_break(actions_count: int) -> bool:
        """Decide if it's time for a break."""
        # More likely after many actions
        probability = min(0.5, actions_count / 100)
        return random.random() < probability
```

## Handling Rate Limit Errors

### Automatic Retry

```python
from xtools import XTools
from xtools.core.rate_limiter import RetryConfig

retry_config = RetryConfig(
    max_retries=3,
    backoff_factor=2,  # Exponential backoff
    initial_delay=60,  # Start with 1 minute
    max_delay=900,     # Max 15 minutes
)

async with XTools(retry_config=retry_config) as x:
    # Automatically retries on rate limit
    await x.follow.user("username")
```

### Manual Handling

```python
from xtools.exceptions import RateLimitError
import asyncio

async with XTools() as x:
    try:
        await x.follow.user("username")
    except RateLimitError as e:
        print(f"Rate limited! Wait {e.retry_after} seconds")
        await asyncio.sleep(e.retry_after)
        # Retry
        await x.follow.user("username")
```

### Callback on Rate Limit

```python
async def on_rate_limit(action: str, retry_after: int):
    """Called when rate limit is hit."""
    print(f"Rate limited on {action}. Waiting {retry_after}s")
    # Could send notification, log to database, etc.
    await send_discord_notification(
        f"⚠️ Rate limited on {action}. Resuming in {retry_after}s"
    )

async with XTools(on_rate_limit=on_rate_limit) as x:
    await x.engage.auto_like(keywords=["crypto"], limit=500)
```

## Multi-Account Rate Limiting

When managing multiple accounts, distribute load:

```python
from xtools import XTools
from xtools.core.rate_limiter import GlobalRateLimiter

# Shared rate limiter across accounts
global_limiter = GlobalRateLimiter(
    total_requests_per_minute=30,  # Total across all accounts
    per_account_limits=True,       # Also enforce per-account
)

accounts = [
    {"cookies": "account1.json"},
    {"cookies": "account2.json"},
    {"cookies": "account3.json"},
]

async def process_account(account_config):
    async with XTools(
        cookies=account_config["cookies"],
        global_rate_limiter=global_limiter
    ) as x:
        await x.engage.auto_like(keywords=["python"], limit=50)

# Process accounts with shared limits
await asyncio.gather(*[process_account(a) for a in accounts])
```

## Monitoring Rate Limits

### Real-time Statistics

```python
async with XTools() as x:
    # Get current stats
    stats = x.rate_limiter.get_stats()
    print(f"Today's follows: {stats['follow']['count']}/{stats['follow']['limit']}")
    print(f"Today's likes: {stats['like']['count']}/{stats['like']['limit']}")
    
    # Listen to rate limit events
    @x.on("rate_limit_warning")
    async def on_warning(action, remaining):
        if remaining < 10:
            print(f"⚠️ Only {remaining} {action}s remaining!")
```

### Export Statistics

```python
# Export rate limit history
history = x.rate_limiter.get_history(days=7)
x.export.to_csv(history, "rate_limit_history.csv")

# Visualize patterns
import matplotlib.pyplot as plt

plt.figure(figsize=(12, 6))
plt.plot(history['timestamp'], history['follow_count'], label='Follows')
plt.plot(history['timestamp'], history['like_count'], label='Likes')
plt.legend()
plt.title("Activity Over Time")
plt.savefig("activity_chart.png")
```

## Best Practices

### 1. Start Conservative

```python
# New accounts should use conservative limits
async with XTools(rate_limit_profile="conservative") as x:
    # Gradually increase over weeks
    pass
```

### 2. Warm Up New Accounts

```python
async def warmup_account(days: int = 7):
    """Gradually increase activity for new accounts."""
    for day in range(days):
        multiplier = (day + 1) / days  # 0.14 to 1.0
        
        async with XTools() as x:
            x.rate_limiter.set_multiplier(multiplier)
            
            # Light activity
            await x.engage.auto_like(
                keywords=["interesting"],
                limit=int(50 * multiplier)
            )
```

### 3. Monitor Account Health

```python
async with XTools() as x:
    # Check for warnings
    health = await x.account.health_check()
    
    if health.has_warning:
        print("⚠️ Account may have restrictions")
        x.rate_limiter.set_profile("conservative")
    
    if health.is_restricted:
        print("🚫 Account is restricted. Stopping all actions.")
        return
```

### 4. Use Jitter

```python
# Add randomness to delays
from xtools.core.rate_limiter import add_jitter

base_delay = 5
actual_delay = add_jitter(base_delay, jitter_percent=30)
# Could be 3.5 to 6.5 seconds
```

## Troubleshooting

### "Rate limit exceeded" errors

1. Switch to conservative profile
2. Wait 15-60 minutes before resuming
3. Check if account has restrictions

### Account temporarily restricted

1. Stop all automation immediately
2. Wait 24-48 hours
3. Resume with conservative settings
4. Consider the account "burned" for aggressive actions

### Inconsistent rate limits

Twitter's limits vary based on:
- Account age
- Account verification status
- Historical behavior
- Current platform load

Adjust your limits based on observed behavior.

## Next Steps

- [Stealth Mode](stealth.md) - Advanced detection avoidance
- [Proxies](proxies.md) - IP rotation and proxy setup
- [Multi-Account](multi-account.md) - Managing multiple accounts
