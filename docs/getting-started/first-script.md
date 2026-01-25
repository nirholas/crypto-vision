# Your First Complete Script

Let's build a real-world automation script from scratch. By the end, you'll have a working "Account Health Dashboard" that:

- ✅ Tracks follower changes
- ✅ Identifies unfollowers
- ✅ Analyzes engagement
- ✅ Finds optimal posting times
- ✅ Generates a report
- ✅ Sends notifications

## Project Setup

Create a new directory for your project:

```bash
mkdir xtools-dashboard
cd xtools-dashboard

# Create virtual environment
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows

# Install dependencies
pip install "xtools[all]"
playwright install chromium

# Authenticate
xtools auth login
```

Create the project structure:

```
xtools-dashboard/
├── dashboard.py         # Main script
├── config.py           # Configuration
├── xtools.toml         # XTools config
├── whitelist.txt       # Users to never unfollow
└── .env                # Secrets (don't commit!)
```

## Step 1: Configuration

**`.env`** - Store secrets here:
```bash
DISCORD_WEBHOOK=https://discord.com/api/webhooks/your/webhook
OPENAI_API_KEY=sk-your-key-here
```

**`xtools.toml`** - XTools configuration:
```toml
[xtools]
headless = true
timeout = 30000

[xtools.rate_limit]
requests_per_minute = 20
follows_per_hour = 25
unfollows_per_hour = 40

[xtools.storage]
database_url = "sqlite:///dashboard.db"

[xtools.notifications]
enabled = true

[xtools.safety]
dry_run = false
max_unfollows_per_day = 100
whitelist_file = "whitelist.txt"
```

**`whitelist.txt`** - Users to protect:
```
naval
paulg
elonmusk
your_best_friend
important_client
```

**`config.py`** - Python configuration:
```python
"""Dashboard configuration"""
import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()

@dataclass
class DashboardConfig:
    # Your username
    username: str = "your_twitter_handle"
    
    # Analysis settings
    tweet_analysis_count: int = 100
    follower_sample_size: int = 500
    
    # Automation settings
    auto_unfollow_enabled: bool = True
    max_daily_unfollows: int = 50
    auto_engage_enabled: bool = True
    max_daily_likes: int = 100
    
    # Report settings
    report_output: str = "reports/"
    
    # Notifications
    discord_webhook: str = os.getenv("DISCORD_WEBHOOK", "")
    
    # AI features
    ai_enabled: bool = True
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")

config = DashboardConfig()
```

## Step 2: The Dashboard Script

**`dashboard.py`**:

```python
#!/usr/bin/env python3
"""
XTools Account Health Dashboard
Run daily to track, analyze, and optimize your X/Twitter presence.
"""
import asyncio
from datetime import datetime
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional

from xtools import XTools
from xtools.ai import ContentGenerator
from config import config


@dataclass
class DashboardReport:
    """Container for all dashboard metrics"""
    timestamp: datetime = field(default_factory=datetime.now)
    
    # Follower metrics
    followers_count: int = 0
    following_count: int = 0
    new_followers: list = field(default_factory=list)
    unfollowers: list = field(default_factory=list)
    net_change: int = 0
    
    # Engagement metrics
    avg_likes: float = 0
    avg_retweets: float = 0
    avg_replies: float = 0
    engagement_rate: float = 0
    top_tweet: Optional[dict] = None
    
    # Timing insights
    best_day: str = ""
    best_hour: int = 0
    
    # Audience insights
    top_follower_locations: list = field(default_factory=list)
    common_interests: list = field(default_factory=list)
    
    # Actions taken
    unfollowed_count: int = 0
    liked_count: int = 0
    
    # AI insights
    content_suggestions: list = field(default_factory=list)


async def run_dashboard():
    """Main dashboard routine"""
    print("""
    ╔═══════════════════════════════════════════════════════╗
    ║       🐦 XTools Account Health Dashboard 🐦           ║
    ╚═══════════════════════════════════════════════════════╝
    """)
    
    report = DashboardReport()
    
    async with XTools() as x:
        # ═══════════════════════════════════════════════════════
        # SECTION 1: FOLLOWER TRACKING
        # ═══════════════════════════════════════════════════════
        print("\n📊 [1/6] Analyzing follower changes...")
        
        # Get current follower/following counts
        profile = await x.scrape.profile(config.username)
        report.followers_count = profile.followers_count
        report.following_count = profile.following_count
        
        # Detect unfollowers since last check
        unfollower_report = await x.monitor.unfollowers()
        report.unfollowers = unfollower_report.unfollowers
        report.new_followers = unfollower_report.new_followers
        report.net_change = len(report.new_followers) - len(report.unfollowers)
        
        print(f"   ✓ Followers: {report.followers_count:,}")
        print(f"   ✓ Following: {report.following_count:,}")
        print(f"   ✓ New followers: +{len(report.new_followers)}")
        print(f"   ✓ Unfollowers: -{len(report.unfollowers)}")
        print(f"   ✓ Net change: {report.net_change:+d}")
        
        # ═══════════════════════════════════════════════════════
        # SECTION 2: ENGAGEMENT ANALYSIS
        # ═══════════════════════════════════════════════════════
        print("\n💬 [2/6] Analyzing engagement...")
        
        # Get recent tweets for analysis
        my_tweets = await x.scrape.tweets(
            config.username,
            limit=config.tweet_analysis_count
        )
        
        if my_tweets:
            # Calculate averages
            report.avg_likes = sum(t.likes for t in my_tweets) / len(my_tweets)
            report.avg_retweets = sum(t.retweets for t in my_tweets) / len(my_tweets)
            report.avg_replies = sum(t.replies for t in my_tweets) / len(my_tweets)
            
            # Engagement rate = (likes + retweets + replies) / followers * 100
            total_engagement = report.avg_likes + report.avg_retweets + report.avg_replies
            report.engagement_rate = (total_engagement / report.followers_count) * 100
            
            # Find top performing tweet
            top_tweet = max(my_tweets, key=lambda t: t.likes + t.retweets * 2)
            report.top_tweet = {
                "text": top_tweet.text[:100] + "..." if len(top_tweet.text) > 100 else top_tweet.text,
                "likes": top_tweet.likes,
                "retweets": top_tweet.retweets,
                "url": top_tweet.url
            }
        
        print(f"   ✓ Avg likes: {report.avg_likes:.1f}")
        print(f"   ✓ Avg retweets: {report.avg_retweets:.1f}")
        print(f"   ✓ Engagement rate: {report.engagement_rate:.2f}%")
        
        # ═══════════════════════════════════════════════════════
        # SECTION 3: OPTIMAL TIMING
        # ═══════════════════════════════════════════════════════
        print("\n⏰ [3/6] Finding optimal posting times...")
        
        timing_analysis = await x.analytics.best_time_to_post()
        report.best_day = timing_analysis.best_day
        report.best_hour = timing_analysis.best_hour
        
        print(f"   ✓ Best day: {report.best_day}")
        print(f"   ✓ Best hour: {report.best_hour}:00")
        
        # ═══════════════════════════════════════════════════════
        # SECTION 4: AUDIENCE INSIGHTS
        # ═══════════════════════════════════════════════════════
        print("\n👥 [4/6] Analyzing audience...")
        
        audience = await x.analytics.audience_insights(
            sample_size=config.follower_sample_size
        )
        report.top_follower_locations = audience.top_locations[:5]
        report.common_interests = audience.common_interests[:5]
        
        print(f"   ✓ Top locations: {', '.join(report.top_follower_locations)}")
        print(f"   ✓ Common interests: {', '.join(report.common_interests)}")
        
        # ═══════════════════════════════════════════════════════
        # SECTION 5: AUTOMATED ACTIONS
        # ═══════════════════════════════════════════════════════
        print("\n🤖 [5/6] Running automated actions...")
        
        # Unfollow non-followers
        if config.auto_unfollow_enabled:
            unfollow_result = await x.unfollow.non_followers(
                max_unfollows=config.max_daily_unfollows,
                whitelist_file="whitelist.txt"
            )
            report.unfollowed_count = unfollow_result.unfollowed_count
            print(f"   ✓ Unfollowed {report.unfollowed_count} non-followers")
        
        # Auto-engage with niche content
        if config.auto_engage_enabled:
            liked_tweets = await x.engage.auto_like(
                keywords=report.common_interests[:3],  # Use top interests
                limit=min(30, config.max_daily_likes)
            )
            report.liked_count = len(liked_tweets)
            print(f"   ✓ Liked {report.liked_count} tweets in your niche")
        
        # ═══════════════════════════════════════════════════════
        # SECTION 6: AI CONTENT SUGGESTIONS
        # ═══════════════════════════════════════════════════════
        if config.ai_enabled and config.openai_api_key:
            print("\n🧠 [6/6] Generating AI insights...")
            
            ai = ContentGenerator(
                provider="openai",
                api_key=config.openai_api_key
            )
            
            # Analyze top tweet and suggest similar content
            if report.top_tweet:
                suggestions = await ai.suggest_content(
                    based_on=report.top_tweet["text"],
                    audience_interests=report.common_interests,
                    count=3
                )
                report.content_suggestions = suggestions
                print("   ✓ Generated content suggestions")
        else:
            print("\n⏭️  [6/6] Skipping AI insights (not configured)")
    
    # ═══════════════════════════════════════════════════════
    # GENERATE REPORT
    # ═══════════════════════════════════════════════════════
    await generate_report(report)
    
    # ═══════════════════════════════════════════════════════
    # SEND NOTIFICATIONS
    # ═══════════════════════════════════════════════════════
    if config.discord_webhook:
        await send_discord_notification(report)
    
    return report


async def generate_report(report: DashboardReport):
    """Generate and save a markdown report"""
    print("\n📝 Generating report...")
    
    # Create reports directory
    Path(config.report_output).mkdir(exist_ok=True)
    
    # Generate filename with date
    filename = f"report_{report.timestamp.strftime('%Y-%m-%d')}.md"
    filepath = Path(config.report_output) / filename
    
    # Build report content
    content = f"""# 📊 Account Health Report
    
**Date:** {report.timestamp.strftime('%Y-%m-%d %H:%M')}  
**Account:** @{config.username}

---

## 📈 Follower Metrics

| Metric | Value |
|--------|-------|
| Total Followers | {report.followers_count:,} |
| Total Following | {report.following_count:,} |
| Ratio | {report.followers_count / max(report.following_count, 1):.2f} |
| New Followers | +{len(report.new_followers)} |
| Unfollowers | -{len(report.unfollowers)} |
| **Net Change** | **{report.net_change:+d}** |

### New Followers
{chr(10).join(f'- @{u}' for u in report.new_followers[:10]) or '- None'}

### Unfollowers
{chr(10).join(f'- @{u}' for u in report.unfollowers[:10]) or '- None'}

---

## 💬 Engagement Metrics

| Metric | Value |
|--------|-------|
| Avg Likes | {report.avg_likes:.1f} |
| Avg Retweets | {report.avg_retweets:.1f} |
| Avg Replies | {report.avg_replies:.1f} |
| Engagement Rate | {report.engagement_rate:.2f}% |

### Top Performing Tweet
> {report.top_tweet['text'] if report.top_tweet else 'N/A'}

❤️ {report.top_tweet['likes'] if report.top_tweet else 0} likes | 
🔁 {report.top_tweet['retweets'] if report.top_tweet else 0} retweets

---

## ⏰ Optimal Posting Times

| Best Day | Best Hour |
|----------|-----------|
| {report.best_day} | {report.best_hour}:00 |

---

## 👥 Audience Insights

### Top Locations
{chr(10).join(f'{i+1}. {loc}' for i, loc in enumerate(report.top_follower_locations)) or 'N/A'}

### Common Interests
{chr(10).join(f'- {interest}' for interest in report.common_interests) or 'N/A'}

---

## 🤖 Automated Actions

| Action | Count |
|--------|-------|
| Users Unfollowed | {report.unfollowed_count} |
| Tweets Liked | {report.liked_count} |

---

## 💡 AI Content Suggestions

{chr(10).join(f'{i+1}. {s}' for i, s in enumerate(report.content_suggestions)) or 'AI suggestions disabled'}

---

*Generated by XTools Dashboard*
"""
    
    # Save report
    filepath.write_text(content)
    print(f"   ✓ Report saved to {filepath}")
    
    # Also save as latest
    (Path(config.report_output) / "latest.md").write_text(content)


async def send_discord_notification(report: DashboardReport):
    """Send summary to Discord"""
    from xtools.notifications import DiscordNotifier
    
    discord = DiscordNotifier(webhook_url=config.discord_webhook)
    
    # Create embed
    embed = {
        "title": "📊 Daily Account Health Report",
        "color": 0x1DA1F2,  # Twitter blue
        "fields": [
            {
                "name": "📈 Followers",
                "value": f"{report.followers_count:,} ({report.net_change:+d})",
                "inline": True
            },
            {
                "name": "💬 Engagement",
                "value": f"{report.engagement_rate:.2f}%",
                "inline": True
            },
            {
                "name": "⏰ Best Time",
                "value": f"{report.best_day} {report.best_hour}:00",
                "inline": True
            },
            {
                "name": "🤖 Actions",
                "value": f"Unfollowed: {report.unfollowed_count}\nLiked: {report.liked_count}",
                "inline": True
            }
        ],
        "timestamp": report.timestamp.isoformat()
    }
    
    await discord.send_embed(embed)
    print("   ✓ Discord notification sent")


if __name__ == "__main__":
    asyncio.run(run_dashboard())
```

## Step 3: Run Your Dashboard

```bash
# Run the dashboard
python dashboard.py
```

Expected output:

```
╔═══════════════════════════════════════════════════════╗
║       🐦 XTools Account Health Dashboard 🐦           ║
╚═══════════════════════════════════════════════════════╝

📊 [1/6] Analyzing follower changes...
   ✓ Followers: 12,456
   ✓ Following: 1,234
   ✓ New followers: +23
   ✓ Unfollowers: -5
   ✓ Net change: +18

💬 [2/6] Analyzing engagement...
   ✓ Avg likes: 45.2
   ✓ Avg retweets: 8.3
   ✓ Engagement rate: 0.43%

⏰ [3/6] Finding optimal posting times...
   ✓ Best day: Tuesday
   ✓ Best hour: 14:00

👥 [4/6] Analyzing audience...
   ✓ Top locations: USA, UK, India, Germany, Canada
   ✓ Common interests: tech, startups, python, ai

🤖 [5/6] Running automated actions...
   ✓ Unfollowed 25 non-followers
   ✓ Liked 30 tweets in your niche

🧠 [6/6] Generating AI insights...
   ✓ Generated content suggestions

📝 Generating report...
   ✓ Report saved to reports/report_2024-01-15.md
   ✓ Discord notification sent
```

## Step 4: Schedule It

### Using Cron (Linux/macOS)

```bash
# Edit crontab
crontab -e

# Run daily at 9 AM
0 9 * * * cd /path/to/xtools-dashboard && /path/to/venv/bin/python dashboard.py >> logs/dashboard.log 2>&1
```

### Using Task Scheduler (Windows)

Create a batch file `run_dashboard.bat`:
```batch
@echo off
cd C:\path\to\xtools-dashboard
call venv\Scripts\activate
python dashboard.py
```

Then add to Task Scheduler to run daily.

### Using systemd Timer (Linux)

```ini
# /etc/systemd/system/xtools-dashboard.timer
[Unit]
Description=Run XTools Dashboard Daily

[Timer]
OnCalendar=*-*-* 09:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

```ini
# /etc/systemd/system/xtools-dashboard.service
[Unit]
Description=XTools Dashboard

[Service]
Type=oneshot
WorkingDirectory=/path/to/xtools-dashboard
ExecStart=/path/to/venv/bin/python dashboard.py
User=youruser
```

## Step 5: Extend It

Add more features to your dashboard:

### Add Competitor Tracking

```python
async def track_competitors(x: XTools):
    """Track competitor growth and engagement"""
    competitors = ["competitor1", "competitor2"]
    
    for comp in competitors:
        profile = await x.scrape.profile(comp)
        tweets = await x.scrape.tweets(comp, limit=50)
        
        print(f"\n📊 @{comp} Analysis:")
        print(f"   Followers: {profile.followers_count:,}")
        
        avg_engagement = sum(t.likes for t in tweets) / len(tweets)
        print(f"   Avg engagement: {avg_engagement:.0f}")
```

### Add Trending Topics

```python
async def analyze_trends(x: XTools):
    """Find trending topics in your niche"""
    hashtags = ["#buildinpublic", "#indiehackers", "#startup"]
    
    for tag in hashtags:
        tweets = await x.scrape.hashtag(tag, limit=100)
        
        # Extract common themes
        # Identify viral tweets
        # Suggest content angles
```

### Add Sentiment Tracking

```python
async def track_sentiment(x: XTools, ai: ContentGenerator):
    """Track sentiment of mentions and replies"""
    mentions = await x.scrape.mentions(config.username, limit=50)
    
    for mention in mentions:
        sentiment = await ai.analyze_sentiment(mention.text)
        
        if sentiment.score < -0.5:
            print(f"⚠️ Negative mention: {mention.text[:50]}...")
```

## What's Next?

You've built a complete automation dashboard! Next steps:

<div class="grid cards" markdown>

-   **[Growth Strategies](../cookbook/growth/index.md)**
    
    Advanced techniques for follower growth

-   **[AI-Powered Engagement](../guides/ai/index.md)**
    
    Use AI to generate replies and analyze content

-   **[Advanced Monitoring](../guides/monitoring/index.md)**
    
    Real-time alerts and tracking

-   **[Data Science Recipes](../cookbook/data-science/index.md)**
    
    Analyze your data with pandas and visualization

</div>

---

🎉 **Congratulations!** You've completed the Getting Started guide. You're now ready to explore the full power of XTools.
