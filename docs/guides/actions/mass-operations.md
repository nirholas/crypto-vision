# Mass Operations

Execute large-scale operations safely and efficiently.

## Overview

Mass operations require careful planning to avoid account restrictions:

| Operation | Safe Daily Limit | Aggressive Limit | Recovery Time |
|-----------|------------------|------------------|---------------|
| Follows | 100-200 | 400 | 24-48 hours |
| Unfollows | 100-200 | 400 | 24-48 hours |
| Likes | 200-500 | 1000 | 12-24 hours |
| DMs | 50-100 | 200 | 48-72 hours |

## Safe Mass Following

Follow thousands over multiple days:

```python
from xtools import XTools
from xtools.actions.base import MassOperationConfig
import asyncio

config = MassOperationConfig(
    total_target=1000,
    daily_limit=150,
    hourly_limit=25,
    batch_size=25,
    batch_delay=300,  # 5 min between batches
    session_duration_hours=8,
    active_hours=(9, 22),
)

async def mass_follow_campaign():
    """Execute a large-scale follow campaign over multiple days"""
    
    async with XTools() as x:
        keywords = ["python developer", "tech founder", "startup"]
        completed = 0
        
        while completed < config.total_target:
            # Daily session
            daily_count = 0
            
            while daily_count < config.daily_limit:
                result = await x.follow.by_keyword(
                    keywords=keywords,
                    max_follows=config.batch_size,
                    filters=x.config.default_follow_filters,
                )
                
                completed += result.success_count
                daily_count += result.success_count
                
                print(f"Batch complete: +{result.success_count}")
                print(f"Daily: {daily_count}/{config.daily_limit}")
                print(f"Total: {completed}/{config.total_target}")
                
                if daily_count >= config.daily_limit:
                    break
                
                # Batch delay
                print(f"Waiting {config.batch_delay}s...")
                await asyncio.sleep(config.batch_delay)
            
            # Wait until tomorrow
            if completed < config.total_target:
                print("\n📅 Daily limit reached. Resuming tomorrow...")
                await asyncio.sleep(24 * 60 * 60)

asyncio.run(mass_follow_campaign())
```

## Safe Mass Unfollowing

Clean up thousands of non-followers:

```python
from xtools import XTools

async def mass_unfollow_cleanup():
    """Unfollow non-followers over multiple days"""
    
    async with XTools() as x:
        # First, get total count
        preview = await x.unfollow.non_followers(
            max_unfollows=10000,
            dry_run=True
        )
        
        total = preview.success_count
        daily_limit = 150
        days = (total // daily_limit) + 1
        
        print(f"📊 Found {total} non-followers")
        print(f"📅 Will take ~{days} days at {daily_limit}/day")
        
        if input("\nStart campaign? (y/n): ").lower() != 'y':
            return
        
        completed = 0
        day = 0
        
        while completed < total:
            day += 1
            print(f"\n🗓️  Day {day}")
            
            result = await x.unfollow.non_followers(
                max_unfollows=daily_limit,
                whitelist=["important1", "important2"],
                min_following_days=7,
                exclude_verified=True,
                on_progress=lambda c, t, m: print(f"  [{c}/{t}] {m}")
            )
            
            completed += result.success_count
            print(f"  ✅ Unfollowed: {result.success_count}")
            print(f"  📈 Total progress: {completed}/{total}")
            
            if completed < total:
                print("  ⏳ Waiting until tomorrow...")
                await asyncio.sleep(24 * 60 * 60)
        
        print(f"\n🎉 Campaign complete! Unfollowed {completed} users")

asyncio.run(mass_unfollow_cleanup())
```

## Resumable Operations

Handle interruptions gracefully:

```python
from xtools import XTools
from xtools.storage import FollowTracker

async def resumable_follow_campaign(campaign_name: str):
    """Campaign that can be resumed after interruption"""
    
    tracker = FollowTracker("xtools.db")
    
    # Check for existing session
    session = tracker.get_pending_session(campaign_name)
    
    if session:
        print(f"📂 Found existing session: {session['id']}")
        pending = tracker.get_pending_session_items(session['id'])
        print(f"   {len(pending)} items remaining")
        
        if input("Resume? (y/n): ").lower() != 'y':
            tracker.complete_session(session['id'])
            session = None
    
    async with XTools() as x:
        if not session:
            # Create new campaign
            print("🆕 Creating new campaign...")
            
            # Get target users
            targets = await x.scrape.search_users(
                "python developer",
                limit=500
            )
            
            usernames = [t.username for t in targets]
            
            # Create session
            session_id = tracker.create_session(
                campaign_name,
                usernames
            )
            pending = usernames
            print(f"   Created session with {len(pending)} targets")
        else:
            session_id = session['id']
        
        # Process pending items
        for username in pending:
            try:
                result = await x.follow.user(username)
                status = "success" if result.success else "failed"
            except Exception as e:
                status = f"error: {str(e)}"
            
            tracker.update_session_item(
                session_id, 
                username, 
                status
            )
            
            # Rate limiting
            await asyncio.sleep(random.uniform(3, 8))
        
        # Complete session
        tracker.complete_session(session_id)
        print("🎉 Campaign complete!")
```

## Parallel Processing

Speed up read-only operations:

```python
from xtools import XTools
import asyncio

async def parallel_scrape(usernames: list, max_concurrent: int = 5):
    """Scrape multiple profiles in parallel"""
    
    semaphore = asyncio.Semaphore(max_concurrent)
    results = []
    
    async def scrape_one(x, username):
        async with semaphore:
            try:
                profile = await x.scrape.profile(username)
                return {"username": username, "profile": profile}
            except Exception as e:
                return {"username": username, "error": str(e)}
    
    async with XTools() as x:
        tasks = [scrape_one(x, u) for u in usernames]
        results = await asyncio.gather(*tasks)
    
    return results

# Scrape 100 profiles with 5 concurrent requests
usernames = [f"user{i}" for i in range(100)]
results = asyncio.run(parallel_scrape(usernames, max_concurrent=5))
```

!!! warning "Parallel Limits"
    Only use parallel processing for **read operations** (scraping).
    
    **Never** parallelize:
    - Follow/unfollow
    - Like/retweet
    - Comments/DMs

## Batch Processing

Process in controlled batches:

```python
from xtools import XTools

async def batch_operation(items: list, batch_size: int = 25):
    """Process items in batches with delays"""
    
    async with XTools() as x:
        total = len(items)
        
        for i in range(0, total, batch_size):
            batch = items[i:i + batch_size]
            batch_num = (i // batch_size) + 1
            total_batches = (total // batch_size) + 1
            
            print(f"\n📦 Batch {batch_num}/{total_batches}")
            
            for item in batch:
                # Process item
                await x.follow.user(item)
                await asyncio.sleep(random.uniform(2, 5))
            
            # Longer pause between batches
            if i + batch_size < total:
                pause = 60 * 5  # 5 minutes
                print(f"⏸️  Pausing {pause}s before next batch...")
                await asyncio.sleep(pause)
```

## Progress Tracking

Track and display progress:

```python
from xtools import XTools
from tqdm import tqdm
import time

async def tracked_mass_operation():
    """Mass operation with progress bar"""
    
    async with XTools() as x:
        # Get targets
        targets = await x.scrape.followers("competitor", limit=500)
        
        with tqdm(total=len(targets), desc="Following") as pbar:
            success = 0
            failed = 0
            
            for user in targets:
                result = await x.follow.user(user.username)
                
                if result.success:
                    success += 1
                    pbar.set_postfix({"✓": success, "✗": failed})
                else:
                    failed += 1
                
                pbar.update(1)
                await asyncio.sleep(random.uniform(3, 8))
            
            print(f"\n✅ Complete: {success} followed, {failed} failed")
```

## Error Recovery

Handle errors without losing progress:

```python
from xtools import XTools
import json

async def resilient_mass_operation():
    """Mass operation with error recovery"""
    
    progress_file = "mass_op_progress.json"
    
    # Load progress
    try:
        with open(progress_file) as f:
            progress = json.load(f)
    except FileNotFoundError:
        progress = {"completed": [], "failed": [], "pending": []}
    
    async with XTools() as x:
        # Get targets (or use pending from progress)
        if not progress["pending"]:
            targets = await x.scrape.followers("competitor", limit=500)
            progress["pending"] = [t.username for t in targets]
        
        while progress["pending"]:
            username = progress["pending"][0]
            
            try:
                result = await x.follow.user(username)
                
                if result.success:
                    progress["completed"].append(username)
                else:
                    progress["failed"].append(username)
                
            except Exception as e:
                print(f"Error: {e}")
                progress["failed"].append(username)
            
            finally:
                # Remove from pending regardless of result
                progress["pending"].pop(0)
                
                # Save progress
                with open(progress_file, "w") as f:
                    json.dump(progress, f)
            
            await asyncio.sleep(random.uniform(3, 8))
        
        print(f"✅ Complete!")
        print(f"   Succeeded: {len(progress['completed'])}")
        print(f"   Failed: {len(progress['failed'])}")
```

## Rate Limit Handling

Automatically handle rate limits:

```python
from xtools import XTools
from xtools.actions.base import RateLimitHandler

handler = RateLimitHandler(
    initial_delay=3,
    max_delay=300,
    backoff_multiplier=2,
    max_retries=3,
)

async def rate_limited_operation():
    async with XTools() as x:
        for username in usernames:
            success = False
            retries = 0
            
            while not success and retries < handler.max_retries:
                try:
                    result = await x.follow.user(username)
                    success = result.success
                    handler.reset()
                    
                except RateLimitError:
                    delay = handler.get_backoff_delay()
                    print(f"⏳ Rate limited. Waiting {delay}s...")
                    await asyncio.sleep(delay)
                    retries += 1
            
            await asyncio.sleep(handler.get_delay())
```

## Multi-Account Operations

Distribute load across accounts:

```python
from xtools import XTools, AccountRotator

async def multi_account_mass_follow():
    """Distribute follows across multiple accounts"""
    
    accounts = ["account1", "account2", "account3"]
    targets_per_account = 50
    
    rotator = AccountRotator(
        profiles=accounts,
        strategy="round-robin",
        cooldown_minutes=60
    )
    
    targets = ["target1", "target2", ...]  # 150 targets
    
    for i, target in enumerate(targets):
        # Get next available account
        profile = rotator.get_next()
        
        async with XTools(profile=profile) as x:
            await x.follow.user(target)
            print(f"[{profile}] Followed @{target}")
        
        await asyncio.sleep(random.uniform(3, 8))
```

## Campaign Templates

### Follower Growth Campaign

```python
async def growth_campaign(days: int = 7):
    """7-day follower growth campaign"""
    
    daily_follows = 100
    daily_unfollows = 50
    
    async with XTools() as x:
        for day in range(days):
            print(f"\n📅 Day {day + 1}/{days}")
            
            # Morning: Follow new users
            print("🌅 Morning session: Following...")
            await x.follow.by_keyword(
                keywords=["your niche"],
                max_follows=daily_follows // 2
            )
            
            # Afternoon: Engage with existing
            print("☀️ Afternoon session: Engaging...")
            await x.engage.auto_like(
                keywords=["your niche"],
                max_likes=50
            )
            
            # Evening: Unfollow non-followers
            print("🌙 Evening session: Cleanup...")
            await x.unfollow.non_followers(
                max_unfollows=daily_unfollows,
                min_following_days=7
            )
            
            # Report
            me = await x.scrape.profile("me")
            print(f"📊 Stats: {me.followers_count} followers, {me.following_count} following")
            
            if day < days - 1:
                await asyncio.sleep(24 * 60 * 60)
```

### Cleanup Campaign

```python
async def cleanup_campaign():
    """Aggressive cleanup of low-quality follows"""
    
    async with XTools() as x:
        # Phase 1: Non-followers
        print("Phase 1: Non-followers")
        await x.unfollow.non_followers(max_unfollows=200)
        
        # Phase 2: Inactive accounts
        print("Phase 2: Inactive accounts")
        await x.unfollow.by_criteria(
            criteria=UnfollowCriteria(inactive_days=180),
            max_unfollows=100
        )
        
        # Phase 3: Spam accounts
        print("Phase 3: Spam accounts")
        await x.unfollow.by_criteria(
            criteria=UnfollowCriteria(
                bio_contains=["follow back", "f4f"],
                max_followers=50
            ),
            max_unfollows=100
        )
        
        print("✅ Cleanup complete!")
```

## Best Practices

!!! success "Safety Checklist"
    - ✅ Always test with small batches first
    - ✅ Use session tracking for resumability
    - ✅ Implement exponential backoff
    - ✅ Spread operations over multiple days
    - ✅ Monitor account for warnings
    - ✅ Keep detailed logs

!!! danger "Avoid"
    - ❌ Running multiple mass operations simultaneously
    - ❌ Exceeding daily limits
    - ❌ Ignoring rate limit warnings
    - ❌ Operations without progress tracking
    - ❌ Running during account cooldowns

## Monitoring

Watch for account restrictions:

```python
async def check_account_health():
    """Monitor account for restriction signs"""
    
    async with XTools() as x:
        health = await x.account.health_check()
        
        if health.warnings:
            print("⚠️ Warnings detected:")
            for warning in health.warnings:
                print(f"  - {warning}")
            return False
        
        if health.rate_limited:
            print(f"⏳ Rate limited until {health.reset_time}")
            return False
        
        print("✅ Account healthy")
        return True
```

## Next Steps

[:octicons-arrow-right-24: Rate Limiting](../../advanced/rate-limiting.md) - Configure safety limits

[:octicons-arrow-right-24: Scheduling](../../advanced/scheduling.md) - Automate campaigns

[:octicons-arrow-right-24: Multi-Account](../../advanced/multi-account.md) - Scale with multiple accounts
