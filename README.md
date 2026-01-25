<p align="center">
  <img src="https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python 3.10+"/>
  <img src="https://img.shields.io/badge/Async-Native-00ADD8?style=for-the-badge&logo=go&logoColor=white" alt="Async Native"/>
  <img src="https://img.shields.io/badge/AI-Powered-FF6F00?style=for-the-badge&logo=tensorflow&logoColor=white" alt="AI Powered"/>
  <img src="https://img.shields.io/badge/No_API-Required-success?style=for-the-badge" alt="No API Required"/>
  <img src="https://img.shields.io/badge/154-Python_Files-blue?style=for-the-badge" alt="154 Python Files"/>
  <img src="https://img.shields.io/badge/44K+-Lines_of_Code-purple?style=for-the-badge" alt="44K+ Lines"/>
</p>

<h1 align="center">🐦 Xeepy</h1>
<h3 align="center">The Most Comprehensive Python Toolkit for X/Twitter Automation</h3>

<p align="center">
  <strong>154 Python files • 44,000+ lines of code • 100+ classes • 500+ methods</strong>
</p>

<p align="center">
  <a href="#-installation">Installation</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-scrapers">Scrapers</a> •
  <a href="#-follow--unfollow">Follow/Unfollow</a> •
  <a href="#-engagement">Engagement</a> •
  <a href="#-ai-features">AI Features</a> •
  <a href="#-monitoring">Monitoring</a> •
  <a href="#-analytics">Analytics</a> •
  <a href="#-cli">CLI</a> •
  <a href="#-api-server">API</a>
</p>

---

> ⚠️ **EDUCATIONAL PURPOSES ONLY** - This toolkit is designed for learning about automation, browser automation, and AI integration. It should not be used to violate X/Twitter's Terms of Service.

---

## 📋 Table of Contents

<details>
<summary>Click to expand full table of contents</summary>

- [Why Xeepy?](#-why-xeepy)
- [Installation](#-installation)
  - [Quick Install](#quick-install)
  - [Development Install](#development-install)
  - [Platform-Specific](#platform-specific-instructions)
- [Quick Start](#-quick-start)
- [Core Features](#-core-features)
  - [Browser Manager](#browser-manager)
  - [Authentication](#authentication)
  - [Rate Limiting](#rate-limiting)
  - [Configuration](#configuration)
- [Scrapers (16 Types)](#-scrapers)
  - [Replies Scraper](#1-replies-scraper)
  - [Profile Scraper](#2-profile-scraper)
  - [Followers Scraper](#3-followers-scraper)
  - [Following Scraper](#4-following-scraper)
  - [Tweets Scraper](#5-tweets-scraper)
  - [Hashtag Scraper](#6-hashtag-scraper)
  - [Search Scraper](#7-search-scraper)
  - [Likes Scraper](#8-likes-scraper)
  - [Lists Scraper](#9-lists-scraper)
  - [Thread Scraper](#10-thread-scraper)
  - [Media Scraper](#11-media-scraper)
  - [Media Downloader](#12-media-downloader)
  - [Recommendations Scraper](#13-recommendations-scraper)
  - [Spaces Scraper](#14-spaces-scraper)
  - [Mentions Scraper](#15-mentions-scraper)
  - [Bookmarks Scraper](#16-bookmarks-scraper)
- [Follow Operations](#-follow-operations)
  - [Follow User](#follow-user)
  - [Auto Follow](#auto-follow)
  - [Follow by Hashtag](#follow-by-hashtag)
  - [Follow by Keyword](#follow-by-keyword)
  - [Follow Engagers](#follow-engagers)
  - [Follow Target's Followers](#follow-targets-followers)
- [Unfollow Operations](#-unfollow-operations)
  - [Unfollow Non-Followers](#unfollow-non-followers)
  - [Unfollow All](#unfollow-all-mass-unfollow)
  - [Smart Unfollow](#smart-unfollow)
  - [Unfollow by Criteria](#unfollow-by-criteria)
- [Engagement Automation](#-engagement-automation)
  - [Like Operations](#like-operations)
  - [Comment Operations](#comment-operations)
  - [Retweet Operations](#retweet-operations)
  - [Bookmark Operations](#bookmark-operations)
  - [Quote Tweet](#quote-tweet)
- [Direct Messages](#-direct-messages)
- [Scheduling](#-scheduling)
- [Polls](#-polls)
- [AI Features](#-ai-features)
  - [Content Generator](#content-generator)
  - [Sentiment Analyzer](#sentiment-analyzer)
  - [Spam/Bot Detector](#spambot-detector)
  - [Smart Targeting](#smart-targeting)
  - [Crypto Analyzer](#crypto-analyzer)
  - [Influencer Finder](#influencer-finder)
  - [AI Providers](#ai-providers)
- [Monitoring](#-monitoring)
  - [Unfollower Detector](#unfollower-detector)
  - [Keyword Monitor](#keyword-monitor)
  - [Account Monitor](#account-monitor)
  - [Follower Alerts](#follower-alerts)
  - [Engagement Tracker](#engagement-tracker)
- [Analytics](#-analytics)
  - [Engagement Analytics](#engagement-analytics)
  - [Growth Tracker](#growth-tracker)
  - [Best Time Analyzer](#best-time-analyzer)
  - [Audience Insights](#audience-insights)
  - [Competitor Analyzer](#competitor-analyzer)
- [Notifications](#-notifications)
  - [Discord Webhook](#discord-webhook)
  - [Telegram Bot](#telegram-bot)
  - [Email Notifications](#email-notifications)
  - [Slack Webhook](#slack-webhook)
- [Data Export](#-data-export)
  - [CSV Export](#csv-export)
  - [JSON Export](#json-export)
  - [SQLite Export](#sqlite-export)
- [Storage](#-storage)
  - [Database](#database)
  - [Follow Tracker](#follow-tracker)
  - [Snapshots](#snapshots)
- [CLI Reference](#-cli-reference)
- [REST API Server](#-rest-api-server)
- [GraphQL API](#-graphql-api)
- [Data Models](#-data-models)
- [Configuration](#-configuration-reference)
- [Rate Limits](#-rate-limits)
- [Error Handling](#-error-handling)
- [Cookbook](#-cookbook)
  - [Growth Hacking](#-growth-hacking)
    - [Viral Content Detection](#viral-content-detection)
    - [Engagement Pod Automation](#engagement-pod-automation)
    - [Follower Surge Strategy](#follower-surge-strategy)
  - [Automation Workflows](#-automation-workflows)
    - [Content Calendar Automation](#content-calendar-automation)
    - [Smart Auto-Engagement Pipeline](#smart-auto-engagement-pipeline)
    - [Notification-Driven Workflow](#notification-driven-workflow)
    - [Account Cleanup Workflow](#account-cleanup-workflow)
  - [Data Science](#-data-science)
    - [Sentiment Analysis Dashboard](#sentiment-analysis-dashboard)
    - [Network Analysis](#network-analysis)
    - [Engagement Prediction Model](#engagement-prediction-model)
  - [Business Intelligence](#-business-intelligence)
    - [Competitor Intelligence Dashboard](#competitor-intelligence-dashboard)
    - [Lead Generation Pipeline](#lead-generation-pipeline)
  - [Research](#-research)
    - [Trend Analysis](#trend-analysis)
    - [Academic Research Data Collection](#academic-research-data-collection)
- [FAQ](#-faq)
- [Comparison](#-comparison-with-alternatives)
- [Contributing](#-contributing)
- [License](#-license)

</details>

---

## 🔥 Why Xeepy?

### The Problem

| Issue | Impact |
|-------|--------|
| Twitter API costs **$100-5000/month** | Most developers can't afford it |
| Tweepy `api.search()` is **deprecated** | Old code no longer works |
| Can't get tweet replies via API | Major limitation |
| No AI integration in existing tools | Missing modern features |
| Complex setup and authentication | Frustrating developer experience |

### The Solution: Xeepy

| Feature | Xeepy | Tweepy | Snscrape | Twint |
|---------|--------|--------|----------|-------|
| **No API Required** | ✅ | ❌ | ✅ | ✅ |
| **Currently Working (2024+)** | ✅ | ⚠️ | ❌ | ❌ |
| **Get Tweet Replies** | ✅ | ❌ | ❌ | ❌ |
| **Async Support** | ✅ | ✅ | ❌ | ❌ |
| **Mass Unfollow** | ✅ | ❌ | ❌ | ❌ |
| **AI Integration** | ✅ | ❌ | ❌ | ❌ |
| **16 Scrapers** | ✅ | ⚠️ | ⚠️ | ⚠️ |
| **Active Development** | ✅ | ⚠️ | ❌ | ❌ |
| **CLI Tool** | ✅ | ❌ | ⚠️ | ✅ |
| **REST API** | ✅ | ❌ | ❌ | ❌ |
| **GraphQL Support** | ✅ | ❌ | ❌ | ❌ |

---

## 📦 Installation

### Quick Install

```bash
# Install Xeepy
pip install xeepy

# Install browser (required)
playwright install chromium
```

### Development Install

```bash
# Clone repository
git clone https://github.com/nirholas/Get-Tweet-Replies-With-Python-Tweepy.git
cd Get-Tweet-Replies-With-Python-Tweepy

# Install in development mode
pip install -e ".[dev,ai]"

# Install browser
playwright install chromium
```

### Using Makefile

```bash
make dev        # Install with dev dependencies
make browser    # Install Playwright browser
make test       # Run tests
make lint       # Run linter
make build      # Build package
```

### Platform-Specific Instructions

<details>
<summary><strong>macOS</strong></summary>

```bash
# Install Python 3.10+ if needed
brew install python@3.11

# Install Xeepy
pip3 install xeepy
playwright install chromium
```
</details>

<details>
<summary><strong>Windows</strong></summary>

```powershell
# Install Python from python.org or:
winget install Python.Python.3.11

# Install Xeepy
pip install xeepy
playwright install chromium
```
</details>

<details>
<summary><strong>Linux (Ubuntu/Debian)</strong></summary>

```bash
sudo apt update
sudo apt install python3.11 python3-pip

pip3 install xeepy
playwright install chromium
playwright install-deps chromium
```
</details>

<details>
<summary><strong>Docker</strong></summary>

```dockerfile
FROM mcr.microsoft.com/playwright/python:v1.40.0-jammy
WORKDIR /app
COPY . .
RUN pip install .
RUN playwright install chromium
ENTRYPOINT ["xeepy"]
```
</details>

---

## 🚀 Quick Start

### Basic Usage Pattern

```python
from xeepy import Xeepy

async def main():
    async with Xeepy() as x:
        # All operations go here
        pass

# Run with asyncio
import asyncio
asyncio.run(main())
```

### Get Tweet Replies (Fixes Original Repo!)

```python
from xeepy import Xeepy

async with Xeepy() as x:
    # This is what the original repo was supposed to do!
    replies = await x.scrape.replies(
        "https://x.com/elonmusk/status/1234567890",
        limit=100
    )
    
    for reply in replies:
        print(f"@{reply.username}: {reply.text}")
        print(f"  ❤️ {reply.likes} | 🔁 {reply.retweets} | 💬 {reply.replies}")
    
    # Export to CSV
    x.export.to_csv(replies, "replies.csv")
```

### Unfollow Non-Followers

```python
from xeepy import Xeepy

async with Xeepy() as x:
    # Preview first (dry run)
    result = await x.unfollow.non_followers(
        max_unfollows=100,
        whitelist=["friend1", "friend2"],
        dry_run=True
    )
    print(f"Would unfollow: {len(result.would_unfollow)} users")
    
    # Execute for real
    result = await x.unfollow.non_followers(
        max_unfollows=100,
        whitelist=["friend1", "friend2"],
        dry_run=False
    )
    print(f"Unfollowed: {result.unfollowed_count} users")
```

### Auto-Like by Keywords

```python
from xeepy import Xeepy

async with Xeepy() as x:
    result = await x.engage.auto_like(
        keywords=["python", "javascript", "typescript"],
        limit=50,
        delay_range=(2, 5)
    )
    print(f"Liked {result.liked_count} tweets")
```

### Generate AI Reply

```python
from xeepy import Xeepy
from xeepy.ai import ContentGenerator

async with Xeepy() as x:
    ai = ContentGenerator(provider="openai", api_key="sk-...")
    
    reply = await ai.generate_reply(
        tweet_text="Just launched my startup! 🚀",
        style="supportive",
        max_length=280
    )
    print(reply)
    # Output: "Congrats on the launch! 🎉 What problem are you solving?"
```

---

## ⚙️ Core Features

### Browser Manager

The `BrowserManager` handles all Playwright browser operations.

```python
from xeepy.core import BrowserManager

async with BrowserManager(headless=True) as browser:
    # Get a new page
    page = await browser.new_page()
    
    # Navigate
    await page.goto("https://x.com")
    
    # Take screenshot
    await browser.screenshot(page, "screenshot.png")
    
    # Get multiple pages for parallel operations
    pages = await browser.get_pages(count=3)
```

**Features:**
- Headless and headed modes
- Page pool for parallel operations
- Session persistence
- Screenshot capture
- Cookie management
- Proxy support

### Authentication

```python
from xeepy import Xeepy

async with Xeepy() as x:
    # Method 1: Interactive login (opens browser)
    await x.auth.login()
    
    # Method 2: Login with credentials
    await x.auth.login(username="user", password="pass")
    
    # Method 3: Load saved session
    await x.auth.load_session("session.json")
    
    # Method 4: Import cookies
    await x.auth.import_cookies("cookies.json")
    
    # Save session for later
    await x.auth.save_session("session.json")
    
    # Export cookies
    await x.auth.export_cookies("cookies.json")
    
    # Check if logged in
    is_logged_in = await x.auth.is_authenticated()
    
    # Get current user info
    user = await x.auth.get_current_user()
```

### Rate Limiting

Xeepy includes intelligent rate limiting to protect your account.

```python
from xeepy.core import RateLimiter, ActionRateLimiter

# Generic rate limiter
limiter = RateLimiter(
    max_requests=100,
    window_seconds=3600  # 100 requests per hour
)

# Action-specific rate limiter
action_limiter = ActionRateLimiter()

# Check if action is allowed
if await action_limiter.can_perform("follow"):
    await x.follow.user("username")
    await action_limiter.record("follow")
```

**Default Rate Limits:**

| Action | Delay | Per Hour | Per Day |
|--------|-------|----------|---------|
| Follow | 3-8 sec | 20 | 100 |
| Unfollow | 2-6 sec | 25 | 150 |
| Like | 1-3 sec | 50 | 500 |
| Comment | 30-90 sec | 10 | 50 |
| Retweet | 2-5 sec | 30 | 300 |
| DM | 60-120 sec | 5 | 50 |

### Configuration

```python
from xeepy import Xeepy
from xeepy.config import XeepyConfig

config = XeepyConfig(
    # Browser settings
    headless=True,
    slow_mo=0,
    timeout=30000,
    
    # Rate limiting
    follow_delay=(3, 8),
    unfollow_delay=(2, 6),
    like_delay=(1, 3),
    
    # Daily limits
    max_follows_per_day=100,
    max_unfollows_per_day=150,
    max_likes_per_day=500,
    
    # Storage
    database_path="~/.xeepy/data.db",
    session_path="~/.xeepy/session.json",
    
    # AI
    openai_api_key="sk-...",
    anthropic_api_key="sk-ant-...",
    
    # Notifications
    discord_webhook="https://discord.com/api/webhooks/...",
    telegram_bot_token="...",
    telegram_chat_id="..."
)

async with Xeepy(config=config) as x:
    # Use configured Xeepy
    pass
```

**Environment Variables:**

```bash
# .env file
XEEPY_HEADLESS=true
XEEPY_DATABASE_PATH=~/.xeepy/data.db
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
DISCORD_WEBHOOK=https://...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
```

---

## 🔍 Scrapers

Xeepy includes **16 specialized scrapers** for extracting data from X/Twitter.

### 1. Replies Scraper

Scrape all replies to a tweet.

```python
from xeepy import Xeepy

async with Xeepy() as x:
    replies = await x.scrape.replies(
        url="https://x.com/elonmusk/status/1234567890",
        limit=500,
        include_author=False  # Exclude OP's own replies
    )
    
    for reply in replies:
        print(f"@{reply.username}: {reply.text}")
        print(f"  Posted: {reply.created_at}")
        print(f"  Likes: {reply.likes}")
        print(f"  Retweets: {reply.retweets}")
        print(f"  Reply count: {reply.replies}")
        print(f"  URL: {reply.url}")
        print()
```

**Response Model:**

```python
@dataclass
class Tweet:
    id: str
    text: str
    username: str
    user_id: str
    created_at: datetime
    likes: int
    retweets: int
    replies: int
    url: str
    media: list[Media] | None
    is_reply: bool
    is_retweet: bool
    quoted_tweet: Tweet | None
    conversation_id: str | None
```

### 2. Profile Scraper

Get detailed user profile information.

```python
async with Xeepy() as x:
    user = await x.scrape.profile("elonmusk")
    
    print(f"Name: {user.name}")
    print(f"Username: @{user.username}")
    print(f"Bio: {user.bio}")
    print(f"Location: {user.location}")
    print(f"Website: {user.website}")
    print(f"Joined: {user.created_at}")
    print(f"Followers: {user.followers_count:,}")
    print(f"Following: {user.following_count:,}")
    print(f"Tweets: {user.tweet_count:,}")
    print(f"Verified: {user.verified}")
    print(f"Blue verified: {user.blue_verified}")
    print(f"Profile image: {user.profile_image_url}")
    print(f"Banner: {user.banner_url}")
```

**Response Model:**

```python
@dataclass
class User:
    id: str
    username: str
    name: str
    bio: str | None
    location: str | None
    website: str | None
    created_at: datetime
    followers_count: int
    following_count: int
    tweet_count: int
    likes_count: int
    media_count: int
    verified: bool
    blue_verified: bool
    protected: bool
    profile_image_url: str | None
    banner_url: str | None
    pinned_tweet_id: str | None
```

### 3. Followers Scraper

Scrape a user's followers with full details.

```python
async with Xeepy() as x:
    followers = await x.scrape.followers(
        username="elonmusk",
        limit=1000
    )
    
    print(f"Scraped {len(followers)} followers")
    
    # Analyze followers
    verified_count = sum(1 for f in followers if f.verified)
    avg_followers = sum(f.followers_count for f in followers) / len(followers)
    
    print(f"Verified: {verified_count}")
    print(f"Average follower count: {avg_followers:,.0f}")
    
    # Export
    x.export.to_csv(followers, "followers.csv")
```

### 4. Following Scraper

Scrape who a user is following.

```python
async with Xeepy() as x:
    following = await x.scrape.following(
        username="elonmusk",
        limit=500
    )
    
    for user in following:
        print(f"@{user.username} - {user.followers_count:,} followers")
```

### 5. Tweets Scraper

Scrape a user's tweet history.

```python
async with Xeepy() as x:
    tweets = await x.scrape.tweets(
        username="elonmusk",
        limit=200,
        include_replies=False,
        include_retweets=True
    )
    
    # Find most liked tweet
    most_liked = max(tweets, key=lambda t: t.likes)
    print(f"Most liked: {most_liked.text[:100]}...")
    print(f"Likes: {most_liked.likes:,}")
    
    # Calculate engagement rate
    total_engagement = sum(t.likes + t.retweets + t.replies for t in tweets)
    print(f"Total engagement: {total_engagement:,}")
```

### 6. Hashtag Scraper

Scrape tweets containing a hashtag.

```python
async with Xeepy() as x:
    # Top tweets
    top_tweets = await x.scrape.hashtag(
        tag="#Python",
        limit=100,
        mode="top"
    )
    
    # Latest tweets
    latest_tweets = await x.scrape.hashtag(
        tag="#Python",
        limit=100,
        mode="latest"
    )
    
    print(f"Top tweets: {len(top_tweets)}")
    print(f"Latest tweets: {len(latest_tweets)}")
```

### 7. Search Scraper

Multi-type search supporting tweets, people, and media.

```python
async with Xeepy() as x:
    # Search tweets
    tweets = await x.scrape.search(
        query="python programming",
        limit=100,
        mode="latest",  # or "top"
        search_type="tweets"
    )
    
    # Search people
    users = await x.scrape.search(
        query="python developer",
        limit=50,
        search_type="people"
    )
    
    # Search with filters
    filtered = await x.scrape.search(
        query="python -filter:retweets min_faves:100",
        limit=100
    )
    
    # Advanced search
    advanced = await x.scrape.search(
        query="from:elonmusk since:2024-01-01 until:2024-06-01",
        limit=200
    )
```

**Search Operators:**

| Operator | Description | Example |
|----------|-------------|---------|
| `from:` | Tweets from user | `from:elonmusk` |
| `to:` | Replies to user | `to:elonmusk` |
| `@` | Mentions user | `@elonmusk` |
| `since:` | After date | `since:2024-01-01` |
| `until:` | Before date | `until:2024-06-01` |
| `min_faves:` | Minimum likes | `min_faves:100` |
| `min_retweets:` | Minimum retweets | `min_retweets:50` |
| `-filter:retweets` | Exclude retweets | `-filter:retweets` |
| `filter:media` | Only media | `filter:media` |
| `filter:links` | Only links | `filter:links` |
| `lang:` | Language | `lang:en` |

### 8. Likes Scraper

Scrape a user's liked tweets.

```python
async with Xeepy() as x:
    likes = await x.scrape.likes(
        username="elonmusk",
        limit=100
    )
    
    print(f"Scraped {len(likes)} liked tweets")
    
    for tweet in likes:
        print(f"Liked: {tweet.text[:50]}... by @{tweet.username}")
```

### 9. Lists Scraper

Scrape members of a Twitter list.

```python
async with Xeepy() as x:
    members = await x.scrape.list_members(
        list_id="1234567890",
        limit=500
    )
    
    # Or by URL
    members = await x.scrape.list_members(
        url="https://x.com/i/lists/1234567890",
        limit=500
    )
    
    print(f"List has {len(members)} members")
```

### 10. Thread Scraper

Scrape complete tweet threads.

```python
async with Xeepy() as x:
    thread = await x.scrape.thread(
        url="https://x.com/user/status/1234567890"
    )
    
    print(f"Thread has {len(thread)} tweets")
    
    for i, tweet in enumerate(thread, 1):
        print(f"{i}. {tweet.text[:100]}...")
```

### 11. Media Scraper

Scrape a user's media posts (images and videos).

```python
async with Xeepy() as x:
    media_tweets = await x.scrape.media(
        username="elonmusk",
        limit=50
    )
    
    for tweet in media_tweets:
        if tweet.media:
            for m in tweet.media:
                print(f"Type: {m.type}")
                print(f"URL: {m.url}")
                if m.type == "video":
                    print(f"Duration: {m.duration_ms}ms")
```

### 12. Media Downloader

Download media (images/videos) from tweets.

```python
async with Xeepy() as x:
    # Download single tweet media
    files = await x.scrape.download_media(
        url="https://x.com/user/status/1234567890",
        output_dir="./downloads",
        quality="high"  # high, medium, low
    )
    
    print(f"Downloaded {len(files)} files")
    
    # Batch download from user
    files = await x.scrape.download_user_media(
        username="elonmusk",
        limit=50,
        output_dir="./elonmusk_media",
        media_types=["image", "video"]  # or just ["image"]
    )
```

### 13. Recommendations Scraper

Scrape trending topics and recommended users.

```python
async with Xeepy() as x:
    # Get trending topics
    trends = await x.scrape.trends()
    
    for trend in trends:
        print(f"{trend.name}: {trend.tweet_count:,} tweets")
    
    # Get recommended users ("Who to follow")
    recommended = await x.scrape.recommended_users(limit=20)
    
    for user in recommended:
        print(f"@{user.username} - {user.bio[:50]}...")
    
    # Get users similar to a specific user
    similar = await x.scrape.similar_users("elonmusk", limit=10)
```

### 14. Spaces Scraper

Scrape Twitter Spaces (audio rooms).

```python
async with Xeepy() as x:
    # Get live spaces
    live_spaces = await x.scrape.spaces(
        query="tech",
        state="live"  # live, scheduled, ended
    )
    
    for space in live_spaces:
        print(f"Title: {space.title}")
        print(f"Host: @{space.host_username}")
        print(f"Listeners: {space.participant_count}")
        print(f"Speakers: {len(space.speakers)}")
    
    # Get space details
    space = await x.scrape.space_details(
        space_id="1234567890"
    )
    
    # Get chat messages (if available)
    chat = await x.scrape.space_chat(space_id="1234567890")
```

### 15. Mentions Scraper

Scrape mentions of a user.

```python
async with Xeepy() as x:
    mentions = await x.scrape.mentions(
        username="elonmusk",
        limit=100
    )
    
    for tweet in mentions:
        print(f"@{tweet.username} mentioned @elonmusk:")
        print(f"  {tweet.text[:100]}...")
```

### 16. Bookmarks Scraper

Scrape your bookmarked tweets.

```python
async with Xeepy() as x:
    bookmarks = await x.scrape.bookmarks(limit=200)
    
    print(f"You have {len(bookmarks)} bookmarks")
    
    # Export bookmarks
    x.export.to_json(bookmarks, "my_bookmarks.json")
```

---

## ➕ Follow Operations

### Follow User

Follow a single user.

```python
async with Xeepy() as x:
    # Simple follow
    success = await x.follow.user("username")
    
    # Follow with filters
    success = await x.follow.user(
        "username",
        skip_if_private=True,
        skip_if_no_bio=True,
        min_followers=100
    )
```

### Auto Follow

Automated following with rules and scheduling.

```python
async with Xeepy() as x:
    result = await x.follow.auto(
        # Source strategies
        strategies=[
            {"type": "hashtag", "value": "#Python", "limit": 20},
            {"type": "keyword", "value": "machine learning", "limit": 20},
            {"type": "followers_of", "value": "elonmusk", "limit": 30},
        ],
        
        # Filters
        min_followers=100,
        max_followers=100000,
        min_tweets=10,
        min_account_age_days=30,
        must_have_bio=True,
        must_have_profile_image=True,
        skip_private=True,
        skip_verified=False,
        
        # Blacklist
        blacklist=["spam_account", "bot_account"],
        
        # Limits
        max_follows=50,
        delay_range=(3, 8),
        
        # Schedule
        schedule="09:00-17:00",  # Only during these hours
        timezone="America/New_York"
    )
    
    print(f"Followed: {result.followed_count}")
    print(f"Skipped: {result.skipped_count}")
    print(f"Errors: {result.error_count}")
```

### Follow by Hashtag

Follow users who tweet with specific hashtags.

```python
async with Xeepy() as x:
    result = await x.follow.by_hashtag(
        hashtag="#Python",
        limit=50,
        min_followers=100,
        max_followers=50000,
        must_have_bio=True
    )
    
    print(f"Followed {result.followed_count} #Python users")
```

### Follow by Keyword

Follow users from search results.

```python
async with Xeepy() as x:
    result = await x.follow.by_keyword(
        keyword="data scientist",
        limit=30,
        search_type="people",  # or "tweets" to get users from tweet results
        min_followers=500
    )
```

### Follow Engagers

Follow users who engaged with a specific tweet.

```python
async with Xeepy() as x:
    result = await x.follow.engagers(
        tweet_url="https://x.com/user/status/1234567890",
        engagement_types=["like", "retweet", "reply"],
        limit=50
    )
    
    print(f"Followed {result.followed_count} engagers")
```

### Follow Target's Followers

Follow the followers or following of a target account.

```python
async with Xeepy() as x:
    # Follow a competitor's followers
    result = await x.follow.followers_of(
        username="competitor_account",
        limit=100,
        min_followers=500,
        mutual_only=False  # Set True to only follow if they follow target
    )
    
    # Follow who target is following
    result = await x.follow.following_of(
        username="influencer_account",
        limit=50
    )
```

---

## ➖ Unfollow Operations

### Unfollow Non-Followers

Unfollow users who don't follow you back.

```python
async with Xeepy() as x:
    # Preview first (ALWAYS do this!)
    result = await x.unfollow.non_followers(
        dry_run=True
    )
    
    print(f"Would unfollow: {len(result.would_unfollow)} users")
    for user in result.would_unfollow[:10]:
        print(f"  - @{user}")
    
    # Execute with whitelist
    result = await x.unfollow.non_followers(
        max_unfollows=100,
        whitelist=[
            "friend1",
            "friend2", 
            "important_brand",
        ],
        min_following_days=7,  # Don't unfollow if followed < 7 days
        dry_run=False
    )
    
    print(f"Unfollowed: {result.unfollowed_count}")
    print(f"Skipped (whitelist): {len(result.skipped_whitelist)}")
```

### Unfollow All (Mass Unfollow)

⚠️ **Nuclear option** - unfollows everyone.

```python
async with Xeepy() as x:
    # ALWAYS preview first!
    result = await x.unfollow.everyone(
        dry_run=True
    )
    
    print(f"Would unfollow: {len(result.would_unfollow)} users")
    print("Are you SURE? This is irreversible!")
    
    # Execute (requires explicit confirmation)
    result = await x.unfollow.everyone(
        whitelist=["keep_this_one", "and_this_one"],
        batch_size=50,
        delay_between_batches=300,  # 5 min between batches
        dry_run=False,
        confirm=True  # Must be True to execute
    )
```

### Smart Unfollow

Intelligent unfollow based on tracking data and engagement.

```python
async with Xeepy() as x:
    result = await x.unfollow.smart(
        # Time-based criteria
        no_followback_days=14,  # Didn't follow back in 14 days
        
        # Engagement criteria
        min_engagement_rate=0.01,  # Less than 1% engagement
        inactive_days=90,  # Haven't tweeted in 90 days
        
        # Limits
        max_unfollows=50,
        
        # Whitelist
        whitelist=["friend1", "brand1"],
        
        dry_run=True
    )
```

### Unfollow by Criteria

Custom criteria-based unfollowing.

```python
async with Xeepy() as x:
    result = await x.unfollow.by_criteria(
        # Follower count criteria
        min_followers=None,
        max_followers=10,  # Unfollow if they have < 10 followers
        
        # Account criteria
        no_bio=True,  # Unfollow if no bio
        no_profile_image=True,  # Unfollow if default avatar
        
        # Activity criteria
        no_tweets=True,  # Unfollow if 0 tweets
        inactive_days=180,  # Unfollow if no activity in 6 months
        
        # Keywords
        bio_contains=["spam", "follow4follow", "f4f"],
        
        max_unfollows=30,
        dry_run=True
    )
```

---

## 💬 Engagement Automation

### Like Operations

```python
async with Xeepy() as x:
    # Like single tweet
    await x.engage.like("https://x.com/user/status/1234567890")
    
    # Unlike
    await x.engage.unlike("https://x.com/user/status/1234567890")
    
    # Auto-like by keywords
    result = await x.engage.auto_like(
        keywords=["python", "programming"],
        limit=50,
        delay_range=(2, 5),
        skip_retweets=True,
        min_likes=10,  # Only like tweets with 10+ likes
        max_likes=10000  # Skip viral tweets
    )
    
    # Like by hashtag
    result = await x.engage.like_by_hashtag(
        hashtag="#Python",
        limit=30,
        mode="latest"
    )
    
    # Like user's tweets
    result = await x.engage.like_user_tweets(
        username="friend",
        limit=10,
        skip_replies=True
    )
```

### Comment Operations

```python
async with Xeepy() as x:
    # Simple comment
    await x.engage.comment(
        url="https://x.com/user/status/1234567890",
        text="Great post! 🔥"
    )
    
    # Comment with media
    await x.engage.comment(
        url="https://x.com/user/status/1234567890",
        text="Check this out!",
        media_path="./image.png"
    )
    
    # Auto-comment with templates
    result = await x.engage.auto_comment(
        keywords=["python tutorial"],
        templates=[
            "Great tutorial! Thanks for sharing 🙏",
            "This is really helpful! {emoji}",
            "Bookmarking this for later 📚"
        ],
        limit=10,
        delay_range=(30, 90)
    )
    
    # AI-powered auto-comment
    result = await x.engage.auto_comment_ai(
        keywords=["startup launch"],
        style="supportive",
        limit=10,
        ai_provider="openai"
    )
```

### Retweet Operations

```python
async with Xeepy() as x:
    # Simple retweet
    await x.engage.retweet("https://x.com/user/status/1234567890")
    
    # Undo retweet
    await x.engage.unretweet("https://x.com/user/status/1234567890")
    
    # Auto-retweet
    result = await x.engage.auto_retweet(
        keywords=["breaking news"],
        limit=10,
        min_likes=100,
        delay_range=(5, 15)
    )
```

### Quote Tweet

```python
async with Xeepy() as x:
    # Quote tweet
    await x.engage.quote(
        url="https://x.com/user/status/1234567890",
        text="This is so true! My thoughts: ..."
    )
    
    # Quote with AI-generated commentary
    await x.engage.quote_ai(
        url="https://x.com/user/status/1234567890",
        style="insightful",
        ai_provider="openai"
    )
```

### Bookmark Operations

```python
async with Xeepy() as x:
    # Add bookmark
    await x.engage.bookmark("https://x.com/user/status/1234567890")
    
    # Remove bookmark
    await x.engage.unbookmark("https://x.com/user/status/1234567890")
    
    # Get all bookmarks
    bookmarks = await x.engage.get_bookmarks(limit=500)
    
    # Export bookmarks
    await x.engage.export_bookmarks(
        output="bookmarks.json",
        format="json"  # or "csv"
    )
    
    # Bulk bookmark from search
    result = await x.engage.bulk_bookmark(
        keywords=["python tips"],
        limit=50
    )
```

---

## 📩 Direct Messages

Full DM operations support.

```python
async with Xeepy() as x:
    # Send DM
    await x.dm.send(
        username="friend",
        text="Hey! How are you?"
    )
    
    # Send DM with media
    await x.dm.send(
        username="friend",
        text="Check out this meme!",
        media_path="./meme.jpg"
    )
    
    # Get inbox
    inbox = await x.dm.get_inbox(limit=50)
    
    for convo in inbox.conversations:
        print(f"Chat with @{convo.participants[0].username}")
        print(f"  Last message: {convo.messages[-1].text}")
        print(f"  Unread: {convo.unread_count}")
    
    # Get conversation
    messages = await x.dm.get_conversation(
        username="friend",
        limit=100
    )
    
    for msg in messages:
        print(f"[{msg.timestamp}] @{msg.sender}: {msg.text}")
    
    # Delete conversation
    await x.dm.delete_conversation(username="spam_account")
    
    # Bulk DM (use carefully!)
    result = await x.dm.bulk_send(
        usernames=["user1", "user2", "user3"],
        text="Hey! Check out my new project...",
        delay_range=(60, 120)  # 1-2 min between DMs
    )
```

---

## 📅 Scheduling

Schedule tweets and manage drafts.

```python
async with Xeepy() as x:
    # Schedule a tweet
    scheduled = await x.schedule.tweet(
        text="Good morning everyone! ☀️",
        scheduled_time=datetime(2024, 12, 25, 9, 0),
        timezone="America/New_York"
    )
    
    print(f"Scheduled tweet ID: {scheduled.id}")
    
    # Schedule with media
    scheduled = await x.schedule.tweet(
        text="Check out this image!",
        media_paths=["./image1.jpg", "./image2.jpg"],
        scheduled_time=datetime(2024, 12, 25, 12, 0)
    )
    
    # Schedule a thread
    scheduled = await x.schedule.thread(
        tweets=[
            "1/ Here's an important thread about...",
            "2/ First point: ...",
            "3/ Second point: ...",
            "4/ In conclusion..."
        ],
        scheduled_time=datetime(2024, 12, 25, 15, 0)
    )
    
    # Get scheduled tweets
    scheduled_tweets = await x.schedule.get_scheduled()
    
    for tweet in scheduled_tweets:
        print(f"Scheduled for: {tweet.scheduled_time}")
        print(f"Text: {tweet.text[:50]}...")
    
    # Cancel scheduled tweet
    await x.schedule.cancel(tweet_id="1234567890")
    
    # Create draft
    draft = await x.schedule.create_draft(
        text="Draft tweet for later..."
    )
    
    # Get drafts
    drafts = await x.schedule.get_drafts()
    
    # Delete draft
    await x.schedule.delete_draft(draft_id="1234567890")
```

---

## 🗳️ Polls

Create and interact with polls.

```python
async with Xeepy() as x:
    # Create poll
    poll = await x.poll.create(
        question="What's your favorite programming language?",
        options=["Python", "JavaScript", "Rust", "Go"],
        duration_hours=24
    )
    
    print(f"Poll created: {poll.url}")
    
    # Vote on poll
    await x.poll.vote(
        tweet_url="https://x.com/user/status/1234567890",
        option_index=0  # Vote for first option
    )
    
    # Get poll results
    results = await x.poll.get_results(
        tweet_url="https://x.com/user/status/1234567890"
    )
    
    for option in results.options:
        print(f"{option.text}: {option.votes} votes ({option.percentage}%)")
    
    print(f"Total votes: {results.total_votes}")
```

---

## 🤖 AI Features

Xeepy includes comprehensive AI integration for intelligent automation.

### Content Generator

Generate tweets, replies, and threads with AI.

```python
from xeepy.ai import ContentGenerator

# Initialize with OpenAI
ai = ContentGenerator(
    provider="openai",
    api_key="sk-...",
    model="gpt-4"
)

# Or Anthropic
ai = ContentGenerator(
    provider="anthropic",
    api_key="sk-ant-...",
    model="claude-3-opus-20240229"
)

# Or local Ollama
ai = ContentGenerator(
    provider="ollama",
    model="llama2",
    base_url="http://localhost:11434"
)
```

#### Generate Reply

```python
reply = await ai.generate_reply(
    tweet_text="Just launched my startup after 2 years of work!",
    style="supportive",  # supportive, witty, professional, crypto, sarcastic
    context="I'm a fellow entrepreneur",
    max_length=280,
    include_emoji=True
)

print(reply)
# "Huge congrats on the launch! 🚀 2 years of grinding finally paying off. What problem are you solving?"
```

#### Generate Tweet

```python
tweet = await ai.generate_tweet(
    topic="Python tips for beginners",
    style="educational",
    hashtags=["#Python", "#CodingTips"],
    max_length=280
)

print(tweet)
# "🐍 Python tip: Use list comprehensions instead of loops for cleaner code!
# 
# ❌ result = []
# for x in items:
#     result.append(x*2)
#
# ✅ result = [x*2 for x in items]
#
# #Python #CodingTips"
```

#### Generate Thread

```python
thread = await ai.generate_thread(
    topic="Why Python is great for beginners",
    num_tweets=5,
    style="educational",
    include_hook=True,  # Engaging first tweet
    include_cta=True    # Call to action at end
)

for i, tweet in enumerate(thread, 1):
    print(f"{i}/ {tweet}\n")
```

#### Improve Draft

```python
improved = await ai.improve_draft(
    draft="python is good because its easy to learn and has many libraries",
    style="professional",
    fix_grammar=True,
    enhance=True
)

print(improved)
# "Python stands out for its beginner-friendly syntax and extensive library ecosystem. 
# Whether you're building web apps, analyzing data, or automating tasks, 
# Python's versatility makes it an excellent first language. 🐍"
```

#### Generate Hashtags

```python
hashtags = await ai.generate_hashtags(
    text="Just published my article about machine learning in Python",
    count=5,
    include_trending=True
)

print(hashtags)
# ["#MachineLearning", "#Python", "#AI", "#DataScience", "#MLEngineering"]
```

### Sentiment Analyzer

Analyze sentiment and detect toxicity.

```python
from xeepy.ai import SentimentAnalyzer

analyzer = SentimentAnalyzer(provider="openai", api_key="sk-...")

# Analyze single tweet
result = await analyzer.analyze(
    "This product is absolutely amazing! Best purchase ever!"
)

print(f"Sentiment: {result.sentiment}")  # positive, negative, neutral
print(f"Score: {result.score}")          # -1.0 to 1.0
print(f"Confidence: {result.confidence}")
print(f"Emotions: {result.emotions}")    # {"joy": 0.8, "anger": 0.0, ...}

# Batch analysis
tweets = ["Great product!", "Worst experience ever", "It's okay I guess"]
results = await analyzer.analyze_batch(tweets)

for tweet, result in zip(tweets, results):
    print(f"{tweet}: {result.sentiment} ({result.score:.2f})")

# Toxicity detection
toxicity = await analyzer.get_toxicity(
    "Some potentially offensive text"
)

print(f"Toxic: {toxicity.is_toxic}")
print(f"Categories: {toxicity.categories}")  # hate, threat, insult, etc.
print(f"Scores: {toxicity.scores}")
```

### Spam/Bot Detector

Detect bots, spam, and fake accounts.

```python
from xeepy.ai import SpamDetector

detector = SpamDetector(provider="openai", api_key="sk-...")

# Check if tweet is spam
is_spam = await detector.is_spam(tweet)
print(f"Is spam: {is_spam.result}")
print(f"Confidence: {is_spam.confidence}")
print(f"Reasons: {is_spam.reasons}")

# Check if account is bot
is_bot = await detector.is_bot(user)
print(f"Is bot: {is_bot.result}")
print(f"Probability: {is_bot.probability}")
print(f"Indicators: {is_bot.indicators}")
# Indicators: ["posting_frequency", "content_similarity", "account_age"]

# Check for fake account
is_fake = await detector.is_fake_account(user)
print(f"Is fake: {is_fake.result}")
print(f"Red flags: {is_fake.red_flags}")

# Behavioral analysis
behavior = await detector.analyze_behavior(
    username="suspicious_account",
    tweet_count=100
)

print(f"Automation score: {behavior.automation_score}")
print(f"Patterns detected: {behavior.patterns}")
```

### Smart Targeting

AI-powered targeting recommendations.

```python
from xeepy.ai import SmartTargeting

targeting = SmartTargeting(provider="openai", api_key="sk-...")

# Find ideal targets to follow
targets = await targeting.find_targets(
    niche="Python programming",
    criteria={
        "min_followers": 1000,
        "max_followers": 100000,
        "min_engagement_rate": 0.02,
        "active_days": 7
    },
    limit=50
)

for target in targets:
    print(f"@{target.username}")
    print(f"  Relevance: {target.relevance_score}")
    print(f"  Engagement rate: {target.engagement_rate}")
    print(f"  Recommendation: {target.recommendation}")

# Analyze niche
analysis = await targeting.analyze_niche("AI/ML")

print(f"Top hashtags: {analysis.top_hashtags}")
print(f"Key influencers: {analysis.influencers}")
print(f"Best posting times: {analysis.best_times}")
print(f"Content trends: {analysis.trends}")

# Get personalized recommendations
recs = await targeting.get_recommendations(
    username="your_username",
    goal="increase_engagement"  # or "grow_followers", "build_authority"
)

for rec in recs:
    print(f"Action: {rec.action}")
    print(f"Reason: {rec.reason}")
    print(f"Expected impact: {rec.expected_impact}")
```

### Crypto Analyzer

Specialized AI for crypto Twitter analysis.

```python
from xeepy.ai import CryptoAnalyzer

crypto = CryptoAnalyzer(provider="openai", api_key="sk-...")

# Analyze crypto sentiment
sentiment = await crypto.analyze_sentiment(
    token="$BTC",
    timeframe="24h"
)

print(f"Overall sentiment: {sentiment.overall}")
print(f"Bullish tweets: {sentiment.bullish_count}")
print(f"Bearish tweets: {sentiment.bearish_count}")
print(f"Key narratives: {sentiment.narratives}")

# Detect alpha (early opportunities)
alpha = await crypto.detect_alpha(
    keywords=["new token", "launching", "airdrop"],
    min_engagement=50
)

for opportunity in alpha:
    print(f"Token: {opportunity.token}")
    print(f"Mentions: {opportunity.mention_count}")
    print(f"Sentiment: {opportunity.sentiment}")
    print(f"Early: {opportunity.is_early}")

# Analyze token mentions
mentions = await crypto.analyze_token("$SOL", limit=500)

print(f"Mention velocity: {mentions.velocity}")
print(f"Influencer mentions: {mentions.influencer_count}")
print(f"Sentiment trend: {mentions.sentiment_trend}")

# Track crypto influencers
influencers = await crypto.track_influencers(
    tokens=["$BTC", "$ETH", "$SOL"],
    min_followers=10000
)

for inf in influencers:
    print(f"@{inf.username}: {inf.accuracy_score}% accuracy")
```

### Influencer Finder

Find and analyze influencers by niche.

```python
from xeepy.ai import InfluencerFinder

finder = InfluencerFinder(provider="openai", api_key="sk-...")

# Find influencers
influencers = await finder.find(
    niche="Python programming",
    min_followers=5000,
    max_followers=500000,
    limit=50
)

for inf in influencers:
    print(f"@{inf.username}")
    print(f"  Followers: {inf.followers_count:,}")
    print(f"  Engagement: {inf.engagement_rate:.2%}")
    print(f"  Niche relevance: {inf.relevance_score:.2f}")
    print(f"  Tier: {inf.tier}")  # nano, micro, mid, macro, mega

# Rank influencers
ranked = await finder.rank(
    influencers,
    criteria=["engagement_rate", "relevance", "growth_rate"]
)

# Analyze influence
analysis = await finder.analyze_influence("username")

print(f"Influence score: {analysis.score}")
print(f"Reach: {analysis.estimated_reach:,}")
print(f"Categories: {analysis.categories}")
print(f"Audience quality: {analysis.audience_quality}")
```

### AI Providers

Xeepy supports multiple AI providers with a unified interface.

```python
from xeepy.ai.providers import OpenAIProvider, AnthropicProvider, OllamaProvider

# OpenAI
openai = OpenAIProvider(
    api_key="sk-...",
    model="gpt-4",
    temperature=0.7,
    max_tokens=500
)

# Anthropic (Claude)
anthropic = AnthropicProvider(
    api_key="sk-ant-...",
    model="claude-3-opus-20240229",
    max_tokens=1000
)

# Ollama (local)
ollama = OllamaProvider(
    model="llama2",
    base_url="http://localhost:11434"
)

# Use any provider
response = await openai.generate("Write a tweet about Python")
response = await anthropic.generate("Write a tweet about Python")
response = await ollama.generate("Write a tweet about Python")

# Structured output
schema = {
    "type": "object",
    "properties": {
        "tweet": {"type": "string"},
        "hashtags": {"type": "array", "items": {"type": "string"}}
    }
}

result = await openai.generate_structured(
    "Generate a Python programming tweet with hashtags",
    schema=schema
)

print(result["tweet"])
print(result["hashtags"])
```

---

## 📊 Monitoring

### Unfollower Detector

Track who unfollows you.

```python
async with Xeepy() as x:
    # Take initial snapshot
    await x.monitor.snapshot_followers()
    
    # Later, check for changes
    report = await x.monitor.unfollowers()
    
    print(f"New followers: {len(report.new_followers)}")
    for user in report.new_followers:
        print(f"  + @{user.username}")
    
    print(f"Unfollowers: {len(report.unfollowers)}")
    for user in report.unfollowers:
        print(f"  - @{user.username}")
    
    print(f"Current count: {report.current_count:,}")
    print(f"Previous count: {report.previous_count:,}")
    print(f"Net change: {report.net_change:+,}")
```

### Keyword Monitor

Real-time keyword and hashtag monitoring.

```python
async with Xeepy() as x:
    # Start monitoring
    monitor = await x.monitor.keywords(
        keywords=["python", "javascript"],
        hashtags=["#coding", "#programming"],
        callback=on_new_tweet  # Called for each matching tweet
    )
    
    async def on_new_tweet(tweet):
        print(f"New match: @{tweet.username}: {tweet.text[:50]}...")
    
    # Or poll manually
    while True:
        matches = await x.monitor.check_keywords(
            keywords=["python"],
            since_id=last_id
        )
        
        for tweet in matches:
            print(f"Match: {tweet.text}")
            last_id = tweet.id
        
        await asyncio.sleep(60)
```

### Account Monitor

Track changes to any account.

```python
async with Xeepy() as x:
    # Start monitoring
    changes = await x.monitor.account(
        username="competitor",
        watch=["bio", "followers", "following", "tweets", "name", "profile_image"]
    )
    
    # Check for changes
    report = await x.monitor.check_account_changes("competitor")
    
    if report.bio_changed:
        print(f"Bio changed!")
        print(f"  Old: {report.old_bio}")
        print(f"  New: {report.new_bio}")
    
    if report.followers_changed:
        print(f"Followers: {report.old_followers:,} → {report.new_followers:,}")
    
    if report.new_tweets:
        print(f"New tweets: {len(report.new_tweets)}")
```

### Follower Alerts

Get notified of new followers and milestones.

```python
async with Xeepy() as x:
    # Set up alerts
    await x.monitor.follower_alerts(
        on_new_follower=handle_new_follower,
        on_milestone=handle_milestone,
        milestones=[100, 500, 1000, 5000, 10000]
    )
    
    async def handle_new_follower(user):
        print(f"New follower: @{user.username}")
        # Auto-send welcome DM
        await x.dm.send(user.username, "Thanks for following! 🙏")
    
    async def handle_milestone(count):
        print(f"🎉 Reached {count:,} followers!")
```

### Engagement Tracker

Track engagement metrics over time.

```python
async with Xeepy() as x:
    # Track engagement on a tweet
    tracker = await x.monitor.track_engagement(
        tweet_url="https://x.com/user/status/1234567890",
        interval_minutes=30,
        duration_hours=24
    )
    
    # Get engagement report
    report = await x.monitor.engagement_report(
        tweet_url="https://x.com/user/status/1234567890"
    )
    
    print(f"Likes over time: {report.likes_timeline}")
    print(f"Retweets over time: {report.retweets_timeline}")
    print(f"Peak engagement: {report.peak_time}")
    print(f"Engagement velocity: {report.velocity}")
    
    # Compare tweets
    comparison = await x.monitor.compare_engagement([
        "https://x.com/user/status/111",
        "https://x.com/user/status/222",
        "https://x.com/user/status/333"
    ])
    
    for tweet in comparison:
        print(f"Tweet: {tweet.url}")
        print(f"  Engagement rate: {tweet.engagement_rate:.2%}")
        print(f"  Performance: {tweet.performance_rating}")
```

---

## 📈 Analytics

### Engagement Analytics

Analyze your engagement patterns.

```python
async with Xeepy() as x:
    analytics = await x.analytics.engagement(
        username="your_username",
        days=30
    )
    
    print(f"Average likes: {analytics.avg_likes:.1f}")
    print(f"Average retweets: {analytics.avg_retweets:.1f}")
    print(f"Average replies: {analytics.avg_replies:.1f}")
    print(f"Engagement rate: {analytics.engagement_rate:.2%}")
    
    print(f"\nBest performing content:")
    for tweet in analytics.top_tweets[:5]:
        print(f"  {tweet.text[:50]}... ({tweet.likes} likes)")
    
    print(f"\nContent type breakdown:")
    for content_type, stats in analytics.by_content_type.items():
        print(f"  {content_type}: {stats.engagement_rate:.2%}")
```

### Growth Tracker

Track follower growth over time.

```python
async with Xeepy() as x:
    growth = await x.analytics.growth(
        days=90
    )
    
    print(f"Starting followers: {growth.start_count:,}")
    print(f"Current followers: {growth.end_count:,}")
    print(f"Net growth: {growth.net_growth:+,}")
    print(f"Growth rate: {growth.growth_rate:.2%}")
    
    print(f"\nDaily breakdown:")
    for day in growth.daily_stats[-7:]:  # Last 7 days
        print(f"  {day.date}: {day.followers:,} ({day.change:+,})")
    
    print(f"\nProjected followers in 30 days: {growth.projection_30d:,}")
```

### Best Time Analyzer

Find optimal posting times.

```python
async with Xeepy() as x:
    best_times = await x.analytics.best_times(
        days=60
    )
    
    print("Best times to post:")
    for slot in best_times.top_slots[:5]:
        print(f"  {slot.day} {slot.hour}:00 - Avg engagement: {slot.avg_engagement:.1f}")
    
    print(f"\nBest day: {best_times.best_day}")
    print(f"Best hour: {best_times.best_hour}:00")
    
    # Heatmap data
    print("\nEngagement heatmap:")
    for day, hours in best_times.heatmap.items():
        print(f"  {day}: {hours}")
```

### Audience Insights

Analyze your audience demographics and interests.

```python
async with Xeepy() as x:
    insights = await x.analytics.audience(
        sample_size=1000
    )
    
    print("Audience demographics:")
    print(f"  Average followers: {insights.avg_followers:,.0f}")
    print(f"  Verified: {insights.verified_percentage:.1%}")
    print(f"  Active (7 days): {insights.active_percentage:.1%}")
    
    print("\nTop interests:")
    for interest, percentage in insights.interests[:10]:
        print(f"  {interest}: {percentage:.1%}")
    
    print("\nTop locations:")
    for location, count in insights.locations[:5]:
        print(f"  {location}: {count}")
    
    print(f"\nAudience quality score: {insights.quality_score:.1f}/100")
```

### Competitor Analyzer

Compare your metrics against competitors.

```python
async with Xeepy() as x:
    comparison = await x.analytics.compare_competitors(
        competitors=["competitor1", "competitor2", "competitor3"]
    )
    
    print("Competitor comparison:")
    print(f"{'Username':<20} {'Followers':<12} {'Engagement':<12} {'Growth':<10}")
    print("-" * 54)
    
    for account in comparison.accounts:
        print(f"{account.username:<20} {account.followers:>10,} {account.engagement_rate:>10.2%} {account.growth_rate:>8.1%}")
    
    print(f"\nYour ranking: #{comparison.your_rank} of {len(comparison.accounts)}")
    
    print("\nBenchmarks:")
    print(f"  Avg engagement in niche: {comparison.niche_avg_engagement:.2%}")
    print(f"  Your engagement: {comparison.your_engagement:.2%}")
    print(f"  Performance: {comparison.performance_rating}")
```

---

## 🔔 Notifications

### Discord Webhook

```python
from xeepy.notifications import DiscordNotifier

discord = DiscordNotifier(
    webhook_url="https://discord.com/api/webhooks/..."
)

# Simple message
await discord.send("New follower: @username")

# Rich embed
await discord.send_embed(
    title="🎉 Milestone Reached!",
    description="You've reached 10,000 followers!",
    color=0x00ff00,  # Green
    fields=[
        {"name": "Current", "value": "10,000", "inline": True},
        {"name": "Goal", "value": "25,000", "inline": True}
    ],
    thumbnail_url="https://..."
)
```

### Telegram Bot

```python
from xeepy.notifications import TelegramNotifier

telegram = TelegramNotifier(
    bot_token="...",
    chat_id="..."
)

# Simple message
await telegram.send("New follower: @username")

# Formatted message
await telegram.send_formatted(
    "🎉 *Milestone Reached!*\n\n"
    "You've reached *10,000* followers!\n"
    "Keep up the great work! 🚀",
    parse_mode="Markdown"
)
```

### Email Notifications

```python
from xeepy.notifications import EmailNotifier

email = EmailNotifier(
    smtp_host="smtp.gmail.com",
    smtp_port=587,
    username="your@email.com",
    password="app_password",
    from_email="your@email.com",
    to_email="alerts@email.com"
)

# Simple email
await email.send(
    subject="New Follower Alert",
    body="You have a new follower: @username"
)

# HTML email
await email.send_html(
    subject="Weekly Analytics Report",
    html="<h1>Your Weekly Report</h1>..."
)
```

### Unified Notification Manager

```python
from xeepy.notifications import NotificationManager

manager = NotificationManager()

# Add channels
manager.add_channel("discord", DiscordNotifier(...))
manager.add_channel("telegram", TelegramNotifier(...))
manager.add_channel("email", EmailNotifier(...))

# Send to all channels
await manager.broadcast("Important update!")

# Send to specific channel
await manager.send("discord", "Discord-only message")

# Configure event routing
manager.route("new_follower", ["discord", "telegram"])
manager.route("milestone", ["discord", "telegram", "email"])
manager.route("unfollower", ["discord"])

# Trigger routed notification
await manager.notify("milestone", "Reached 10K followers! 🎉")
```

---

## 📤 Data Export

### CSV Export

```python
async with Xeepy() as x:
    followers = await x.scrape.followers("username", limit=1000)
    
    # Basic export
    x.export.to_csv(followers, "followers.csv")
    
    # With specific columns
    x.export.to_csv(
        followers,
        "followers.csv",
        columns=["username", "name", "followers_count", "bio"]
    )
    
    # Append to existing file
    x.export.to_csv(followers, "followers.csv", append=True)
    
    # Import from CSV
    data = x.export.from_csv("followers.csv")
```

### JSON Export

```python
async with Xeepy() as x:
    tweets = await x.scrape.tweets("username", limit=100)
    
    # Pretty JSON
    x.export.to_json(tweets, "tweets.json", indent=2)
    
    # Minified
    x.export.to_json(tweets, "tweets.min.json", indent=None)
    
    # NDJSON (newline-delimited)
    x.export.to_ndjson(tweets, "tweets.ndjson")
    
    # Import
    data = x.export.from_json("tweets.json")
```

### SQLite Export

```python
async with Xeepy() as x:
    followers = await x.scrape.followers("username", limit=1000)
    
    # Export to SQLite
    x.export.to_sqlite(
        followers,
        "data.db",
        table="followers"
    )
    
    # Upsert (update or insert)
    x.export.to_sqlite(
        followers,
        "data.db",
        table="followers",
        upsert=True,
        key="id"
    )
    
    # Query
    results = x.export.query_sqlite(
        "data.db",
        "SELECT * FROM followers WHERE followers_count > 1000"
    )
```

---

## 💾 Storage

### Database

Xeepy uses SQLite for local data storage.

```python
from xeepy.storage import Database

db = Database("~/.xeepy/data.db")

# Create tables
await db.create_table("followers", {
    "id": "TEXT PRIMARY KEY",
    "username": "TEXT",
    "followers_count": "INTEGER",
    "scraped_at": "TIMESTAMP"
})

# Insert
await db.insert("followers", {
    "id": "123",
    "username": "user",
    "followers_count": 1000,
    "scraped_at": datetime.now()
})

# Query
results = await db.fetch(
    "SELECT * FROM followers WHERE followers_count > ?",
    [500]
)

# Migration support
await db.migrate("v1_to_v2", migration_sql)
```

### Follow Tracker

Track follow/unfollow history.

```python
from xeepy.storage import FollowTracker

tracker = FollowTracker("~/.xeepy/follows.db")

# Track follow
await tracker.track_follow("username")

# Track unfollow
await tracker.track_unfollow("username")

# Get history
follows = await tracker.get_follows(days=30)
unfollows = await tracker.get_unfollows(days=30)

# Analytics
stats = await tracker.analytics(days=30)
print(f"Total follows: {stats.total_follows}")
print(f"Total unfollows: {stats.total_unfollows}")
print(f"Follow back rate: {stats.followback_rate:.1%}")

# Export history
await tracker.export("follow_history.csv")
```

### Snapshots

Take and compare follower snapshots.

```python
from xeepy.storage import SnapshotManager

snapshots = SnapshotManager("~/.xeepy/snapshots/")

# Take snapshot
await snapshots.take("followers", followers_list)

# Compare snapshots
diff = await snapshots.compare(
    "followers",
    date1=datetime(2024, 1, 1),
    date2=datetime(2024, 1, 15)
)

print(f"Added: {diff.added}")
print(f"Removed: {diff.removed}")
print(f"Changed: {diff.changed}")
```

---

## 🖥️ CLI Reference

Xeepy includes a comprehensive CLI.

### Installation

```bash
pip install xeepy
```

### Authentication

```bash
# Interactive login
xeepy auth login

# Check status
xeepy auth status

# Logout
xeepy auth logout
```

### Scraping Commands

```bash
# Scrape replies
xeepy scrape replies https://x.com/user/status/123 --limit 100 --output replies.csv

# Scrape followers
xeepy scrape followers username --limit 1000 --output followers.json

# Scrape following
xeepy scrape following username --limit 500

# Scrape tweets
xeepy scrape tweets username --limit 200 --include-replies

# Scrape hashtag
xeepy scrape hashtag "#Python" --limit 100 --mode latest

# Search
xeepy scrape search "python programming" --limit 50 --type tweets
```

### Follow Commands

```bash
# Follow user
xeepy follow user username

# Follow by hashtag
xeepy follow hashtag "#Python" --limit 30 --min-followers 100

# Follow by keyword
xeepy follow keyword "data scientist" --limit 20

# Auto-follow
xeepy follow auto --config auto_follow.yaml
```

### Unfollow Commands

```bash
# Unfollow non-followers (preview)
xeepy unfollow non-followers --dry-run

# Unfollow non-followers (execute)
xeepy unfollow non-followers --max 100 --whitelist friends.txt

# Smart unfollow
xeepy unfollow smart --days 14 --dry-run

# Unfollow by criteria
xeepy unfollow criteria --no-bio --no-tweets --dry-run
```

### Engagement Commands

```bash
# Like tweet
xeepy engage like https://x.com/user/status/123

# Auto-like
xeepy engage auto-like "python" --limit 50

# Comment
xeepy engage comment https://x.com/user/status/123 "Great post!"

# Retweet
xeepy engage retweet https://x.com/user/status/123

# Bookmark
xeepy engage bookmark https://x.com/user/status/123
```

### Monitoring Commands

```bash
# Check unfollowers
xeepy monitor unfollowers

# Monitor keywords
xeepy monitor keywords "python,javascript" --interval 60

# Monitor account
xeepy monitor account competitor --watch bio,followers
```

### AI Commands

```bash
# Generate reply
xeepy ai reply "Just launched my startup!" --style supportive

# Generate tweet
xeepy ai tweet "Python tips" --hashtags

# Analyze sentiment
xeepy ai sentiment "I love this product!"

# Check for bots
xeepy ai detect-bot username
```

### Analytics Commands

```bash
# Engagement report
xeepy analytics engagement --days 30

# Growth report
xeepy analytics growth --days 90

# Best times
xeepy analytics best-times

# Audience insights
xeepy analytics audience --sample 1000
```

### Configuration

```bash
# Show config
xeepy config show

# Set value
xeepy config set headless true

# Reset
xeepy config reset
```

---

## 🌐 REST API Server

Xeepy can run as a REST API server.

### Start Server

```bash
xeepy api serve --port 8000
```

Or programmatically:

```python
from xeepy.api import create_app
import uvicorn

app = create_app()
uvicorn.run(app, host="0.0.0.0", port=8000)
```

### Endpoints

#### Scraping

```
GET /api/v1/scrape/replies?url={url}&limit={limit}
GET /api/v1/scrape/profile/{username}
GET /api/v1/scrape/followers/{username}?limit={limit}
GET /api/v1/scrape/following/{username}?limit={limit}
GET /api/v1/scrape/tweets/{username}?limit={limit}
GET /api/v1/scrape/hashtag/{tag}?limit={limit}&mode={mode}
GET /api/v1/scrape/search?q={query}&limit={limit}
```

#### Follow/Unfollow

```
POST /api/v1/follow/user
POST /api/v1/follow/hashtag
POST /api/v1/follow/keyword
POST /api/v1/unfollow/user
POST /api/v1/unfollow/non-followers
GET  /api/v1/unfollow/non-followers/preview
```

#### Engagement

```
POST /api/v1/engage/like
POST /api/v1/engage/unlike
POST /api/v1/engage/comment
POST /api/v1/engage/retweet
POST /api/v1/engage/bookmark
```

#### Monitoring

```
GET /api/v1/monitor/unfollowers
GET /api/v1/monitor/keywords?keywords={keywords}
GET /api/v1/monitor/account/{username}
```

#### AI

```
POST /api/v1/ai/generate-reply
POST /api/v1/ai/generate-tweet
POST /api/v1/ai/analyze-sentiment
POST /api/v1/ai/detect-bot
```

### Example Request

```bash
curl -X GET "http://localhost:8000/api/v1/scrape/profile/elonmusk" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### OpenAPI Docs

Visit `http://localhost:8000/docs` for interactive API documentation.

---

## 🔷 GraphQL API

Xeepy also supports GraphQL for flexible querying.

```python
from xeepy.api import GraphQLClient

client = GraphQLClient()

# Get user profile
result = await client.get_user_by_screen_name("elonmusk")

# Get tweet by ID
tweet = await client.get_tweet_detail("1234567890")

# Search tweets
tweets = await client.search_timeline("python programming", limit=100)

# Get followers
followers = await client.get_followers("elonmusk", limit=500)

# Get following
following = await client.get_following("elonmusk", limit=500)

# Like tweet
await client.favorite_tweet("1234567890")

# Unlike tweet
await client.unfavorite_tweet("1234567890")

# Follow user
await client.follow("user_id")

# Unfollow user
await client.unfollow("user_id")

# Create tweet
await client.create_tweet("Hello, world!")

# Delete tweet
await client.delete_tweet("1234567890")

# Retweet
await client.create_retweet("1234567890")

# Undo retweet
await client.delete_retweet("1234567890")

# Bookmark
await client.create_bookmark("1234567890")

# Remove bookmark
await client.delete_bookmark("1234567890")
```

---

## 📦 Data Models

### Tweet Model

```python
@dataclass
class Tweet:
    id: str
    text: str
    username: str
    user_id: str
    name: str
    created_at: datetime
    likes: int
    retweets: int
    replies: int
    quotes: int
    views: int | None
    url: str
    language: str | None
    source: str | None
    is_reply: bool
    is_retweet: bool
    is_quote: bool
    is_pinned: bool
    conversation_id: str | None
    in_reply_to_user_id: str | None
    in_reply_to_username: str | None
    quoted_tweet: Tweet | None
    retweeted_tweet: Tweet | None
    media: list[Media] | None
    urls: list[URL] | None
    hashtags: list[str] | None
    mentions: list[str] | None
    poll: Poll | None
```

### User Model

```python
@dataclass
class User:
    id: str
    username: str
    name: str
    bio: str | None
    location: str | None
    website: str | None
    created_at: datetime
    followers_count: int
    following_count: int
    tweet_count: int
    likes_count: int
    media_count: int
    listed_count: int
    verified: bool
    blue_verified: bool
    protected: bool
    default_profile: bool
    default_profile_image: bool
    profile_image_url: str | None
    profile_banner_url: str | None
    pinned_tweet_id: str | None
    professional: Professional | None
```

### Media Model

```python
@dataclass
class Media:
    type: str  # "image", "video", "gif"
    url: str
    preview_url: str | None
    width: int | None
    height: int | None
    duration_ms: int | None  # For videos
    views: int | None  # For videos
    alt_text: str | None
```

### Engagement Models

```python
@dataclass
class FollowResult:
    followed_count: int
    followed_users: list[str]
    skipped_count: int
    skipped_users: list[str]
    error_count: int
    errors: list[str]

@dataclass
class UnfollowResult:
    unfollowed_count: int
    unfollowed_users: list[str]
    would_unfollow: list[str]  # For dry_run
    skipped_whitelist: list[str]
    errors: list[str]

@dataclass
class EngagementResult:
    liked_count: int
    liked_tweets: list[str]
    commented_count: int
    retweeted_count: int
    errors: list[str]
```

---

## ⚙️ Configuration Reference

### Full Configuration Options

```python
from xeepy.config import XeepyConfig

config = XeepyConfig(
    # === Browser Settings ===
    headless=True,              # Run browser in headless mode
    slow_mo=0,                  # Slow down operations (ms)
    timeout=30000,              # Page timeout (ms)
    proxy=None,                 # Proxy URL (http://...)
    user_agent=None,            # Custom user agent
    
    # === Rate Limiting ===
    follow_delay=(3, 8),        # Random delay range (seconds)
    unfollow_delay=(2, 6),
    like_delay=(1, 3),
    comment_delay=(30, 90),
    retweet_delay=(2, 5),
    dm_delay=(60, 120),
    
    # === Daily Limits ===
    max_follows_per_day=100,
    max_unfollows_per_day=150,
    max_likes_per_day=500,
    max_comments_per_day=50,
    max_retweets_per_day=300,
    max_dms_per_day=50,
    
    # === Hourly Limits ===
    max_follows_per_hour=20,
    max_unfollows_per_hour=25,
    max_likes_per_hour=50,
    max_comments_per_hour=10,
    
    # === Storage ===
    data_dir="~/.xeepy",
    database_path="~/.xeepy/data.db",
    session_path="~/.xeepy/session.json",
    
    # === AI ===
    openai_api_key=None,
    openai_model="gpt-4",
    anthropic_api_key=None,
    anthropic_model="claude-3-opus-20240229",
    ollama_base_url="http://localhost:11434",
    ollama_model="llama2",
    default_ai_provider="openai",
    
    # === Notifications ===
    discord_webhook=None,
    telegram_bot_token=None,
    telegram_chat_id=None,
    slack_webhook=None,
    email_smtp_host=None,
    email_smtp_port=587,
    email_username=None,
    email_password=None,
    email_from=None,
    email_to=None,
    
    # === Logging ===
    log_level="INFO",
    log_file="~/.xeepy/xeepy.log",
    log_format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    
    # === Advanced ===
    retry_attempts=3,
    retry_delay=5,
    concurrent_pages=3,
    save_screenshots_on_error=True,
    debug_mode=False,
)
```

### Environment Variables

All configuration options can be set via environment variables:

```bash
# Browser
XEEPY_HEADLESS=true
XEEPY_TIMEOUT=30000
XEEPY_PROXY=http://proxy:8080

# Rate limits
XEEPY_MAX_FOLLOWS_PER_DAY=100
XEEPY_MAX_LIKES_PER_DAY=500

# Storage
XEEPY_DATA_DIR=~/.xeepy
XEEPY_DATABASE_PATH=~/.xeepy/data.db

# AI
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
XEEPY_DEFAULT_AI_PROVIDER=openai

# Notifications
DISCORD_WEBHOOK=https://...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...

# Logging
XEEPY_LOG_LEVEL=INFO
XEEPY_DEBUG_MODE=false
```

### Configuration File

Create `~/.xeepy/config.yaml`:

```yaml
browser:
  headless: true
  timeout: 30000

rate_limits:
  follow_delay: [3, 8]
  unfollow_delay: [2, 6]
  like_delay: [1, 3]

daily_limits:
  max_follows: 100
  max_unfollows: 150
  max_likes: 500

ai:
  provider: openai
  model: gpt-4

notifications:
  discord:
    webhook: https://discord.com/api/webhooks/...
  telegram:
    bot_token: ...
    chat_id: ...
```

---

## 🛡️ Rate Limits

Xeepy enforces rate limits to protect your account.

### Default Limits

| Action | Per Hour | Per Day | Delay (sec) |
|--------|----------|---------|-------------|
| Follow | 20 | 100 | 3-8 |
| Unfollow | 25 | 150 | 2-6 |
| Like | 50 | 500 | 1-3 |
| Unlike | 50 | 500 | 1-3 |
| Comment | 10 | 50 | 30-90 |
| Retweet | 30 | 300 | 2-5 |
| DM | 5 | 50 | 60-120 |
| Bookmark | 100 | 1000 | 1-2 |

### Customizing Limits

```python
from xeepy import Xeepy
from xeepy.config import XeepyConfig

config = XeepyConfig(
    max_follows_per_day=50,  # More conservative
    max_likes_per_day=200,
    follow_delay=(5, 12),    # Slower
)

async with Xeepy(config=config) as x:
    # Uses custom limits
    pass
```

### Disabling Rate Limits

⚠️ **Not recommended** - may result in account suspension.

```python
async with Xeepy(rate_limit=False) as x:
    # No rate limiting (dangerous!)
    pass
```

---

## ❌ Error Handling

Xeepy provides comprehensive error handling.

### Exception Types

```python
from xeepy.exceptions import (
    XeepyError,           # Base exception
    AuthenticationError,   # Login/session issues
    RateLimitError,        # Rate limit exceeded
    ScraperError,          # Scraping failed
    ActionError,           # Action failed (follow, like, etc.)
    NetworkError,          # Network issues
    BrowserError,          # Browser/Playwright issues
    ConfigError,           # Configuration issues
    ValidationError,       # Invalid input
)
```

### Handling Errors

```python
from xeepy import Xeepy
from xeepy.exceptions import (
    AuthenticationError,
    RateLimitError,
    ScraperError,
    ActionError
)

async with Xeepy() as x:
    try:
        await x.follow.user("username")
    
    except AuthenticationError as e:
        print(f"Login required: {e}")
        await x.auth.login()
    
    except RateLimitError as e:
        print(f"Rate limited! Wait {e.retry_after} seconds")
        await asyncio.sleep(e.retry_after)
    
    except ActionError as e:
        print(f"Action failed: {e}")
        print(f"  Reason: {e.reason}")
        print(f"  Suggestion: {e.suggestion}")
    
    except ScraperError as e:
        print(f"Scraping failed: {e}")
    
    except XeepyError as e:
        print(f"General error: {e}")
```

### Retry Logic

```python
from xeepy.utils import retry

@retry(attempts=3, delay=5)
async def follow_with_retry(x, username):
    return await x.follow.user(username)

# Or inline
result = await retry(
    x.follow.user,
    args=["username"],
    attempts=3,
    delay=5
)
```

---

## ❓ FAQ

<details>
<summary><strong>Does Xeepy require Twitter API keys?</strong></summary>

No! Xeepy uses browser automation (Playwright) instead of the Twitter API. This means:
- No API keys required
- No monthly fees ($100-5000)
- Access to data not available via API (like tweet replies)
</details>

<details>
<summary><strong>Is Xeepy safe to use?</strong></summary>

Xeepy includes built-in rate limiting to protect your account. However:
- This is for educational purposes only
- Using automation may violate X/Twitter ToS
- Use at your own risk
- We recommend using test accounts
</details>

<details>
<summary><strong>Why is Xeepy better than Tweepy?</strong></summary>

| Feature | Xeepy | Tweepy |
|---------|--------|--------|
| API Cost | $0 | $100-5000/month |
| Get Replies | ✅ | ❌ |
| Mass Unfollow | ✅ | ❌ |
| AI Integration | ✅ | ❌ |
| Working in 2024 | ✅ | ⚠️ Limited |
</details>

<details>
<summary><strong>Can I run Xeepy on a server?</strong></summary>

Yes! Use headless mode:
```python
async with Xeepy(headless=True) as x:
    pass
```
For Docker, use the official Playwright image.
</details>

<details>
<summary><strong>How do I save my login session?</strong></summary>

```python
async with Xeepy() as x:
    # Login
    await x.auth.login()
    
    # Save session
    await x.auth.save_session("session.json")

# Later, load session
async with Xeepy() as x:
    await x.auth.load_session("session.json")
```
</details>

<details>
<summary><strong>Can I use proxies?</strong></summary>

Yes:
```python
config = XeepyConfig(proxy="http://proxy:8080")
async with Xeepy(config=config) as x:
    pass
```
</details>

<details>
<summary><strong>How do I handle 2FA?</strong></summary>

Use interactive login mode which opens a visible browser:
```python
async with Xeepy(headless=False) as x:
    await x.auth.login()  # Complete 2FA manually
    await x.auth.save_session("session.json")  # Save for later
```
</details>

<details>
<summary><strong>What AI providers are supported?</strong></summary>

- OpenAI (GPT-4, GPT-3.5)
- Anthropic (Claude 3 Opus, Sonnet, Haiku)
- Ollama (local models: Llama, Mistral, etc.)
</details>

<details>
<summary><strong>Can I contribute?</strong></summary>

Yes! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.
</details>

---

## 🔄 Comparison with Alternatives

| Feature | Xeepy | Tweepy | Snscrape | Twint | Nitter |
|---------|--------|--------|----------|-------|--------|
| No API Required | ✅ | ❌ | ✅ | ✅ | ✅ |
| Currently Working | ✅ | ⚠️ | ❌ | ❌ | ⚠️ |
| Get Tweet Replies | ✅ | ❌ | ❌ | ❌ | ❌ |
| Async Support | ✅ | ✅ | ❌ | ❌ | ❌ |
| Follow/Unfollow | ✅ | ✅* | ❌ | ❌ | ❌ |
| Mass Unfollow | ✅ | ❌ | ❌ | ❌ | ❌ |
| Auto-Like | ✅ | ⚠️ | ❌ | ❌ | ❌ |
| AI Integration | ✅ | ❌ | ❌ | ❌ | ❌ |
| CLI Tool | ✅ | ❌ | ⚠️ | ✅ | ❌ |
| REST API | ✅ | ❌ | ❌ | ❌ | ❌ |
| GraphQL Support | ✅ | ❌ | ❌ | ❌ | ❌ |
| 16 Scrapers | ✅ | ⚠️ | ⚠️ | ⚠️ | ⚠️ |
| Active Development | ✅ | ⚠️ | ❌ | ❌ | ⚠️ |
| Python 3.10+ | ✅ | ✅ | ✅ | ❌ | N/A |

*Tweepy requires expensive API access ($100-5000/month)

---

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for:

- Code of Conduct
- Development setup
- Pull request process
- Style guidelines
- Testing requirements

### Quick Start for Contributors

```bash
# Clone
git clone https://github.com/nirholas/Get-Tweet-Replies-With-Python-Tweepy.git
cd Get-Tweet-Replies-With-Python-Tweepy

# Setup
make dev

# Test
make test

# Lint
make lint
```

---

## 📜 License

MIT License - see [LICENSE](LICENSE) for details.

---

## � Cookbook

Real-world recipes and complete workflows for common use cases.

### 🚀 Growth Hacking

#### Viral Content Detection

Find and engage with viral content in your niche before it peaks.

```python
from xeepy import Xeepy
from xeepy.ai import ContentGenerator

async def detect_viral_content(niche_keywords: list[str], min_velocity: float = 2.0):
    """
    Detect tweets gaining traction faster than normal.
    Velocity = engagement gained per hour since posting.
    """
    async with Xeepy() as x:
        viral_tweets = []
        
        for keyword in niche_keywords:
            # Search recent tweets
            tweets = await x.scrape.search(
                query=f"{keyword} -filter:retweets",
                limit=100,
                mode="latest"
            )
            
            for tweet in tweets:
                # Calculate hours since posted
                hours_old = (datetime.now() - tweet.created_at).total_seconds() / 3600
                
                if hours_old < 1:
                    hours_old = 1  # Avoid division issues
                
                # Calculate engagement velocity
                engagement = tweet.likes + (tweet.retweets * 2) + (tweet.replies * 3)
                velocity = engagement / hours_old
                
                if velocity >= min_velocity:
                    viral_tweets.append({
                        "tweet": tweet,
                        "velocity": velocity,
                        "potential": "high" if velocity > 10 else "medium"
                    })
        
        # Sort by velocity
        viral_tweets.sort(key=lambda x: x["velocity"], reverse=True)
        
        return viral_tweets[:20]  # Top 20 viral candidates

# Usage
viral = await detect_viral_content(["AI", "startup", "python"], min_velocity=3.0)
for item in viral:
    print(f"🔥 Velocity: {item['velocity']:.1f}/hr - {item['tweet'].text[:50]}...")
```

#### Engagement Pod Automation

Coordinate engagement with your network for maximum reach.

```python
async def engagement_pod_workflow(
    pod_members: list[str],
    target_tweet_url: str,
    actions: list[str] = ["like", "retweet", "comment"]
):
    """
    Coordinate engagement from pod members on a target tweet.
    Staggers actions to appear natural.
    """
    async with Xeepy() as x:
        ai = ContentGenerator(provider="openai", api_key="sk-...")
        
        # Get tweet details for context
        tweet = await x.scrape.tweet(target_tweet_url)
        
        results = {"likes": 0, "retweets": 0, "comments": 0}
        
        for i, member in enumerate(pod_members):
            # Stagger timing (appears more natural)
            delay = random.randint(30, 180) * (i + 1)
            await asyncio.sleep(delay)
            
            if "like" in actions:
                await x.engage.like(target_tweet_url)
                results["likes"] += 1
            
            if "retweet" in actions and random.random() > 0.3:
                await x.engage.retweet(target_tweet_url)
                results["retweets"] += 1
            
            if "comment" in actions and random.random() > 0.5:
                # Generate unique comment
                comment = await ai.generate_reply(
                    tweet.text,
                    style="supportive",
                    context=f"Member {member} engaging"
                )
                await x.engage.comment(target_tweet_url, comment)
                results["comments"] += 1
        
        return results
```

#### Follower Surge Strategy

Implement a targeted follower growth campaign.

```python
async def follower_surge_campaign(
    target_niche: str,
    daily_target: int = 50,
    duration_days: int = 7
):
    """
    Execute a multi-day follower growth campaign.
    Combines multiple strategies for maximum growth.
    """
    async with Xeepy() as x:
        campaign_results = {
            "total_followed": 0,
            "total_followbacks": 0,
            "daily_stats": []
        }
        
        for day in range(duration_days):
            daily_followed = 0
            
            # Strategy 1: Follow from hashtags (40%)
            hashtag_target = int(daily_target * 0.4)
            result = await x.follow.by_hashtag(
                hashtag=f"#{target_niche}",
                limit=hashtag_target,
                min_followers=100,
                max_followers=50000,
                must_have_bio=True
            )
            daily_followed += result.followed_count
            
            # Strategy 2: Follow engagers of top accounts (30%)
            influencer_target = int(daily_target * 0.3)
            top_accounts = await x.scrape.search(
                query=f"{target_niche}",
                search_type="people",
                limit=5
            )
            
            for account in top_accounts[:2]:
                tweets = await x.scrape.tweets(account.username, limit=5)
                if tweets:
                    result = await x.follow.engagers(
                        tweet_url=tweets[0].url,
                        limit=influencer_target // 2
                    )
                    daily_followed += result.followed_count
            
            # Strategy 3: Follow from search (30%)
            search_target = int(daily_target * 0.3)
            result = await x.follow.by_keyword(
                keyword=target_niche,
                limit=search_target,
                min_followers=500
            )
            daily_followed += result.followed_count
            
            campaign_results["total_followed"] += daily_followed
            campaign_results["daily_stats"].append({
                "day": day + 1,
                "followed": daily_followed
            })
            
            # Wait for next day
            if day < duration_days - 1:
                await asyncio.sleep(86400)  # 24 hours
        
        return campaign_results
```

### 🤖 Automation Workflows

#### Content Calendar Automation

Automatically schedule content based on best posting times.

```python
async def content_calendar_automation(
    content_queue: list[dict],
    days_ahead: int = 7
):
    """
    Automatically schedule content at optimal times.
    
    content_queue format:
    [{"text": "...", "media": [...], "type": "tweet|thread"}]
    """
    async with Xeepy() as x:
        # Get best posting times
        best_times = await x.analytics.best_times(days=60)
        optimal_slots = best_times.top_slots[:3]  # Top 3 time slots
        
        scheduled = []
        content_index = 0
        
        for day in range(days_ahead):
            target_date = datetime.now() + timedelta(days=day)
            
            for slot in optimal_slots:
                if content_index >= len(content_queue):
                    break
                
                content = content_queue[content_index]
                
                # Calculate exact schedule time
                schedule_time = target_date.replace(
                    hour=slot.hour,
                    minute=random.randint(0, 15)  # Slight variation
                )
                
                if content["type"] == "thread":
                    result = await x.schedule.thread(
                        tweets=content["text"],
                        scheduled_time=schedule_time
                    )
                else:
                    result = await x.schedule.tweet(
                        text=content["text"],
                        media_paths=content.get("media"),
                        scheduled_time=schedule_time
                    )
                
                scheduled.append({
                    "content": content,
                    "scheduled_for": schedule_time,
                    "id": result.id
                })
                
                content_index += 1
        
        return scheduled
```

#### Smart Auto-Engagement Pipeline

Intelligent engagement that learns and adapts.

```python
async def smart_engagement_pipeline(
    keywords: list[str],
    daily_budget: dict = {"likes": 100, "comments": 20, "follows": 30}
):
    """
    Smart engagement that tracks performance and optimizes.
    """
    async with Xeepy() as x:
        ai = ContentGenerator(provider="openai", api_key="sk-...")
        
        # Track engagement performance
        performance_log = []
        
        # Search for relevant content
        for keyword in keywords:
            tweets = await x.scrape.search(
                query=keyword,
                limit=50,
                mode="latest"
            )
            
            for tweet in tweets:
                # Score tweet for engagement potential
                score = calculate_engagement_potential(tweet)
                
                if score > 0.7 and daily_budget["likes"] > 0:
                    await x.engage.like(tweet.url)
                    daily_budget["likes"] -= 1
                    
                    # High potential tweets get comments
                    if score > 0.85 and daily_budget["comments"] > 0:
                        comment = await ai.generate_reply(
                            tweet.text,
                            style="witty",
                            max_length=200
                        )
                        await x.engage.comment(tweet.url, comment)
                        daily_budget["comments"] -= 1
                    
                    # Follow high-value users
                    if tweet.user.followers_count > 1000 and daily_budget["follows"] > 0:
                        await x.follow.user(tweet.username)
                        daily_budget["follows"] -= 1
                    
                    performance_log.append({
                        "tweet_id": tweet.id,
                        "score": score,
                        "actions": ["like"] + (["comment"] if score > 0.85 else [])
                    })
                
                # Respect rate limits
                await asyncio.sleep(random.uniform(2, 5))
        
        return performance_log

def calculate_engagement_potential(tweet) -> float:
    """Score a tweet's engagement potential (0-1)."""
    score = 0.0
    
    # Recent tweets are better
    hours_old = (datetime.now() - tweet.created_at).total_seconds() / 3600
    if hours_old < 1:
        score += 0.3
    elif hours_old < 6:
        score += 0.2
    elif hours_old < 24:
        score += 0.1
    
    # Engagement signals
    if 10 < tweet.likes < 1000:  # Sweet spot
        score += 0.2
    if tweet.replies > 5:
        score += 0.1
    
    # User quality
    if tweet.user.verified:
        score += 0.1
    if 1000 < tweet.user.followers_count < 100000:
        score += 0.15
    if tweet.user.bio:
        score += 0.05
    
    # Content quality
    if len(tweet.text) > 100:
        score += 0.1
    
    return min(score, 1.0)
```

#### Notification-Driven Workflow

React to events in real-time with automated workflows.

```python
async def notification_driven_workflow():
    """
    React to Twitter events with automated workflows.
    """
    async with Xeepy() as x:
        from xeepy.notifications import NotificationManager
        
        notifier = NotificationManager()
        notifier.add_channel("discord", DiscordNotifier(webhook_url="..."))
        
        # Monitor for new followers
        async def on_new_follower(user):
            # Send welcome DM
            await x.dm.send(
                username=user.username,
                text=f"Thanks for following, @{user.username}! 🙏"
            )
            
            # Follow back if quality account
            if user.followers_count > 100 and user.bio:
                await x.follow.user(user.username)
            
            # Notify
            await notifier.send("discord", f"New follower: @{user.username}")
        
        # Monitor for mentions
        async def on_mention(tweet):
            ai = ContentGenerator(provider="openai", api_key="sk-...")
            
            # Generate contextual reply
            reply = await ai.generate_reply(
                tweet.text,
                style="helpful",
                context="Someone mentioned me"
            )
            
            # Like and reply
            await x.engage.like(tweet.url)
            await x.engage.comment(tweet.url, reply)
            
            await notifier.send("discord", f"Replied to mention from @{tweet.username}")
        
        # Start monitoring
        await x.monitor.follower_alerts(on_new_follower=on_new_follower)
        await x.monitor.mentions(callback=on_mention)
```

#### Account Cleanup Workflow

Comprehensive account maintenance automation.

```python
async def account_cleanup_workflow(
    unfollow_inactive_days: int = 90,
    unfollow_no_followback_days: int = 14
):
    """
    Complete account cleanup: unfollow inactive, non-followers, and spam.
    """
    async with Xeepy() as x:
        cleanup_report = {
            "unfollowed_inactive": 0,
            "unfollowed_non_followers": 0,
            "unfollowed_spam": 0,
            "total": 0
        }
        
        # Step 1: Unfollow non-followers (oldest first)
        result = await x.unfollow.non_followers(
            max_unfollows=50,
            min_following_days=unfollow_no_followback_days,
            whitelist=["important_friend", "brand_partner"],
            dry_run=False
        )
        cleanup_report["unfollowed_non_followers"] = result.unfollowed_count
        
        # Step 2: Unfollow inactive accounts
        result = await x.unfollow.by_criteria(
            inactive_days=unfollow_inactive_days,
            max_unfollows=30,
            dry_run=False
        )
        cleanup_report["unfollowed_inactive"] = result.unfollowed_count
        
        # Step 3: Unfollow likely spam/bot accounts
        result = await x.unfollow.by_criteria(
            no_bio=True,
            no_profile_image=True,
            max_followers=5,
            max_unfollows=20,
            dry_run=False
        )
        cleanup_report["unfollowed_spam"] = result.unfollowed_count
        
        cleanup_report["total"] = sum([
            cleanup_report["unfollowed_inactive"],
            cleanup_report["unfollowed_non_followers"],
            cleanup_report["unfollowed_spam"]
        ])
        
        return cleanup_report
```

### 📊 Data Science

#### Sentiment Analysis Dashboard

Build a real-time sentiment tracking dashboard.

```python
async def sentiment_dashboard(
    keywords: list[str],
    interval_minutes: int = 30,
    duration_hours: int = 24
):
    """
    Track sentiment for keywords over time.
    Returns data suitable for visualization.
    """
    async with Xeepy() as x:
        from xeepy.ai import SentimentAnalyzer
        
        analyzer = SentimentAnalyzer(provider="openai", api_key="sk-...")
        
        dashboard_data = {
            "keywords": keywords,
            "timeline": [],
            "summary": {}
        }
        
        iterations = (duration_hours * 60) // interval_minutes
        
        for i in range(iterations):
            timestamp = datetime.now()
            snapshot = {"timestamp": timestamp.isoformat(), "keywords": {}}
            
            for keyword in keywords:
                # Fetch recent tweets
                tweets = await x.scrape.search(
                    query=keyword,
                    limit=50,
                    mode="latest"
                )
                
                # Analyze sentiment
                sentiments = await analyzer.analyze_batch([t.text for t in tweets])
                
                # Calculate metrics
                positive = sum(1 for s in sentiments if s.sentiment == "positive")
                negative = sum(1 for s in sentiments if s.sentiment == "negative")
                neutral = sum(1 for s in sentiments if s.sentiment == "neutral")
                avg_score = sum(s.score for s in sentiments) / len(sentiments)
                
                snapshot["keywords"][keyword] = {
                    "positive": positive,
                    "negative": negative,
                    "neutral": neutral,
                    "avg_score": avg_score,
                    "total": len(tweets),
                    "sample_tweets": [t.text[:100] for t in tweets[:3]]
                }
            
            dashboard_data["timeline"].append(snapshot)
            
            # Wait for next interval
            if i < iterations - 1:
                await asyncio.sleep(interval_minutes * 60)
        
        # Calculate summary statistics
        for keyword in keywords:
            all_scores = [
                snap["keywords"][keyword]["avg_score"] 
                for snap in dashboard_data["timeline"]
            ]
            dashboard_data["summary"][keyword] = {
                "avg_sentiment": sum(all_scores) / len(all_scores),
                "trend": "improving" if all_scores[-1] > all_scores[0] else "declining",
                "volatility": max(all_scores) - min(all_scores)
            }
        
        return dashboard_data
```

#### Network Analysis

Analyze follower networks and identify communities.

```python
async def network_analysis(
    seed_users: list[str],
    depth: int = 2,
    sample_size: int = 100
):
    """
    Build and analyze a follower network graph.
    Identifies communities, influencers, and connection patterns.
    """
    async with Xeepy() as x:
        import networkx as nx  # Requires: pip install networkx
        
        G = nx.DiGraph()
        analyzed_users = set()
        
        async def analyze_user(username: str, current_depth: int):
            if username in analyzed_users or current_depth > depth:
                return
            
            analyzed_users.add(username)
            
            # Get user profile
            try:
                profile = await x.scrape.profile(username)
                G.add_node(username, **{
                    "followers": profile.followers_count,
                    "following": profile.following_count,
                    "verified": profile.verified
                })
            except:
                return
            
            # Get followers (sampled)
            followers = await x.scrape.followers(username, limit=sample_size)
            
            for follower in followers:
                G.add_edge(follower.username, username)  # follower -> user
                
                # Recursive analysis
                if current_depth < depth:
                    await analyze_user(follower.username, current_depth + 1)
        
        # Analyze seed users
        for user in seed_users:
            await analyze_user(user, 0)
        
        # Calculate network metrics
        analysis = {
            "total_nodes": G.number_of_nodes(),
            "total_edges": G.number_of_edges(),
            "density": nx.density(G),
            
            # Top influencers by PageRank
            "influencers": sorted(
                nx.pagerank(G).items(),
                key=lambda x: x[1],
                reverse=True
            )[:10],
            
            # Hub accounts (follow many)
            "hubs": sorted(
                G.out_degree(),
                key=lambda x: x[1],
                reverse=True
            )[:10],
            
            # Authorities (followed by many)
            "authorities": sorted(
                G.in_degree(),
                key=lambda x: x[1],
                reverse=True
            )[:10],
        }
        
        # Detect communities
        if G.number_of_nodes() > 10:
            undirected = G.to_undirected()
            communities = list(nx.community.greedy_modularity_communities(undirected))
            analysis["communities"] = [
                {"size": len(c), "members": list(c)[:5]} 
                for c in sorted(communities, key=len, reverse=True)[:5]
            ]
        
        return analysis, G
```

#### Engagement Prediction Model

Build a model to predict tweet engagement.

```python
async def build_engagement_predictor(
    username: str,
    training_tweets: int = 500
):
    """
    Analyze historical tweets to predict future engagement.
    Returns insights and a simple prediction function.
    """
    async with Xeepy() as x:
        # Fetch historical tweets
        tweets = await x.scrape.tweets(username, limit=training_tweets)
        
        # Extract features
        features = []
        for tweet in tweets:
            features.append({
                "text_length": len(tweet.text),
                "has_media": bool(tweet.media),
                "has_hashtags": bool(tweet.hashtags),
                "hashtag_count": len(tweet.hashtags) if tweet.hashtags else 0,
                "has_mentions": bool(tweet.mentions),
                "mention_count": len(tweet.mentions) if tweet.mentions else 0,
                "has_links": "http" in tweet.text,
                "is_reply": tweet.is_reply,
                "is_retweet": tweet.is_retweet,
                "hour_posted": tweet.created_at.hour,
                "day_of_week": tweet.created_at.weekday(),
                "engagement": tweet.likes + tweet.retweets + tweet.replies
            })
        
        import pandas as pd
        df = pd.DataFrame(features)
        
        # Calculate correlations
        correlations = df.corr()["engagement"].sort_values(ascending=False)
        
        # Find optimal posting patterns
        by_hour = df.groupby("hour_posted")["engagement"].mean()
        by_day = df.groupby("day_of_week")["engagement"].mean()
        
        insights = {
            "avg_engagement": df["engagement"].mean(),
            "top_engagement": df["engagement"].max(),
            "feature_importance": correlations.to_dict(),
            "best_hours": by_hour.nlargest(3).to_dict(),
            "best_days": by_day.nlargest(3).to_dict(),
            "optimal_text_length": df.loc[df["engagement"].idxmax(), "text_length"],
            "media_boost": (
                df[df["has_media"]]["engagement"].mean() / 
                df[~df["has_media"]]["engagement"].mean()
            )
        }
        
        # Simple prediction function
        def predict_engagement(
            text_length: int,
            has_media: bool,
            hour: int,
            day: int
        ) -> float:
            base = insights["avg_engagement"]
            
            # Adjust for factors
            if has_media:
                base *= insights["media_boost"]
            if hour in insights["best_hours"]:
                base *= 1.3
            if day in insights["best_days"]:
                base *= 1.2
            
            return base
        
        return insights, predict_engagement
```

### 💼 Business Intelligence

#### Competitor Intelligence Dashboard

Monitor and analyze competitor activity.

```python
async def competitor_intelligence(
    competitors: list[str],
    tracking_days: int = 30
):
    """
    Comprehensive competitor monitoring and analysis.
    """
    async with Xeepy() as x:
        ai = ContentGenerator(provider="openai", api_key="sk-...")
        
        intelligence = {}
        
        for competitor in competitors:
            # Profile data
            profile = await x.scrape.profile(competitor)
            
            # Recent tweets
            tweets = await x.scrape.tweets(competitor, limit=100)
            
            # Calculate metrics
            total_engagement = sum(t.likes + t.retweets + t.replies for t in tweets)
            avg_engagement = total_engagement / len(tweets) if tweets else 0
            
            # Content analysis
            content_types = {
                "text_only": len([t for t in tweets if not t.media]),
                "with_media": len([t for t in tweets if t.media]),
                "threads": len([t for t in tweets if t.is_reply and t.in_reply_to_username == competitor]),
                "replies": len([t for t in tweets if t.is_reply and t.in_reply_to_username != competitor])
            }
            
            # Extract top performing content
            top_tweets = sorted(tweets, key=lambda t: t.likes + t.retweets, reverse=True)[:5]
            
            # AI analysis of strategy
            strategy_analysis = await ai.analyze_content_strategy(
                tweets=[t.text for t in tweets[:20]]
            )
            
            intelligence[competitor] = {
                "profile": {
                    "followers": profile.followers_count,
                    "following": profile.following_count,
                    "tweets": profile.tweet_count,
                    "bio": profile.bio
                },
                "engagement": {
                    "total": total_engagement,
                    "average": avg_engagement,
                    "rate": avg_engagement / profile.followers_count if profile.followers_count else 0
                },
                "content_mix": content_types,
                "posting_frequency": len(tweets) / tracking_days,
                "top_content": [
                    {"text": t.text[:100], "likes": t.likes, "retweets": t.retweets}
                    for t in top_tweets
                ],
                "strategy_insights": strategy_analysis,
                "hashtags_used": extract_common_hashtags(tweets),
                "posting_times": analyze_posting_times(tweets)
            }
        
        # Comparative analysis
        intelligence["comparison"] = {
            "follower_ranking": sorted(
                [(c, intelligence[c]["profile"]["followers"]) for c in competitors],
                key=lambda x: x[1],
                reverse=True
            ),
            "engagement_ranking": sorted(
                [(c, intelligence[c]["engagement"]["rate"]) for c in competitors],
                key=lambda x: x[1],
                reverse=True
            )
        }
        
        return intelligence

def extract_common_hashtags(tweets) -> list[tuple]:
    from collections import Counter
    all_hashtags = []
    for tweet in tweets:
        if tweet.hashtags:
            all_hashtags.extend(tweet.hashtags)
    return Counter(all_hashtags).most_common(10)

def analyze_posting_times(tweets) -> dict:
    from collections import Counter
    hours = Counter(t.created_at.hour for t in tweets)
    days = Counter(t.created_at.strftime("%A") for t in tweets)
    return {"hours": hours.most_common(5), "days": days.most_common(5)}
```

#### Lead Generation Pipeline

Automated lead discovery and qualification.

```python
async def lead_generation_pipeline(
    target_keywords: list[str],
    qualification_criteria: dict,
    daily_limit: int = 50
):
    """
    Find and qualify leads from Twitter activity.
    
    qualification_criteria example:
    {
        "min_followers": 1000,
        "max_followers": 100000,
        "must_have_bio": True,
        "bio_keywords": ["founder", "CEO", "startup"],
        "min_engagement_rate": 0.02
    }
    """
    async with Xeepy() as x:
        leads = []
        processed = set()
        
        for keyword in target_keywords:
            # Search for relevant tweets
            tweets = await x.scrape.search(
                query=keyword,
                limit=100,
                mode="latest"
            )
            
            for tweet in tweets:
                if tweet.user.username in processed:
                    continue
                
                processed.add(tweet.user.username)
                
                # Get full profile
                try:
                    profile = await x.scrape.profile(tweet.user.username)
                except:
                    continue
                
                # Qualify the lead
                qualification_score = qualify_lead(profile, qualification_criteria)
                
                if qualification_score > 0.6:  # 60% match threshold
                    leads.append({
                        "username": profile.username,
                        "name": profile.name,
                        "bio": profile.bio,
                        "followers": profile.followers_count,
                        "website": profile.website,
                        "qualification_score": qualification_score,
                        "source_keyword": keyword,
                        "source_tweet": tweet.text[:100]
                    })
                    
                    if len(leads) >= daily_limit:
                        break
            
            if len(leads) >= daily_limit:
                break
        
        # Sort by qualification score
        leads.sort(key=lambda x: x["qualification_score"], reverse=True)
        
        # Export to CRM format
        export_leads_to_csv(leads, f"leads_{datetime.now().strftime('%Y%m%d')}.csv")
        
        return leads

def qualify_lead(profile, criteria: dict) -> float:
    score = 0.0
    checks = 0
    
    # Follower check
    if criteria.get("min_followers"):
        checks += 1
        if profile.followers_count >= criteria["min_followers"]:
            score += 1
    
    if criteria.get("max_followers"):
        checks += 1
        if profile.followers_count <= criteria["max_followers"]:
            score += 1
    
    # Bio check
    if criteria.get("must_have_bio"):
        checks += 1
        if profile.bio:
            score += 1
    
    # Bio keywords
    if criteria.get("bio_keywords") and profile.bio:
        checks += 1
        bio_lower = profile.bio.lower()
        if any(kw.lower() in bio_lower for kw in criteria["bio_keywords"]):
            score += 1
    
    # Website check
    if criteria.get("must_have_website"):
        checks += 1
        if profile.website:
            score += 1
    
    return score / checks if checks > 0 else 0

def export_leads_to_csv(leads: list, filename: str):
    import csv
    with open(filename, 'w', newline='') as f:
        if leads:
            writer = csv.DictWriter(f, fieldnames=leads[0].keys())
            writer.writeheader()
            writer.writerows(leads)
```

### 🔬 Research

#### Trend Analysis

Analyze emerging trends and topics.

```python
async def trend_analysis(
    seed_topics: list[str],
    analysis_depth: int = 3
):
    """
    Deep analysis of trending topics and their evolution.
    """
    async with Xeepy() as x:
        ai = ContentGenerator(provider="openai", api_key="sk-...")
        
        # Get current trends
        trends = await x.scrape.trends()
        
        analysis = {
            "global_trends": [],
            "topic_analysis": {},
            "emerging_topics": [],
            "cross_topic_connections": []
        }
        
        # Analyze global trends
        for trend in trends[:10]:
            tweets = await x.scrape.search(
                query=trend.name,
                limit=50,
                mode="top"
            )
            
            # Sentiment distribution
            sentiments = await SentimentAnalyzer(provider="openai", api_key="sk-...").analyze_batch(
                [t.text for t in tweets]
            )
            
            analysis["global_trends"].append({
                "name": trend.name,
                "tweet_count": trend.tweet_count,
                "sentiment": {
                    "positive": len([s for s in sentiments if s.sentiment == "positive"]),
                    "negative": len([s for s in sentiments if s.sentiment == "negative"]),
                    "neutral": len([s for s in sentiments if s.sentiment == "neutral"])
                },
                "sample_tweets": [t.text[:100] for t in tweets[:3]]
            })
        
        # Deep dive into seed topics
        for topic in seed_topics:
            tweets = await x.scrape.search(
                query=topic,
                limit=200,
                mode="latest"
            )
            
            # Extract related hashtags and topics
            related_hashtags = extract_common_hashtags(tweets)
            
            # Identify key voices
            top_authors = identify_top_authors(tweets)
            
            # Content themes analysis
            themes = await ai.extract_themes([t.text for t in tweets[:50]])
            
            analysis["topic_analysis"][topic] = {
                "volume": len(tweets),
                "related_hashtags": related_hashtags,
                "key_voices": top_authors,
                "themes": themes,
                "velocity": calculate_velocity(tweets)
            }
        
        # Identify emerging topics (mentioned but not yet trending)
        all_hashtags = []
        for topic_data in analysis["topic_analysis"].values():
            all_hashtags.extend([h[0] for h in topic_data["related_hashtags"]])
        
        trending_names = [t.name.lower() for t in trends]
        emerging = [h for h in set(all_hashtags) if h.lower() not in trending_names]
        analysis["emerging_topics"] = emerging[:10]
        
        return analysis

def identify_top_authors(tweets) -> list[dict]:
    from collections import Counter
    authors = Counter(t.username for t in tweets)
    return [
        {"username": username, "tweet_count": count}
        for username, count in authors.most_common(10)
    ]

def calculate_velocity(tweets) -> float:
    if len(tweets) < 2:
        return 0
    time_range = (tweets[0].created_at - tweets[-1].created_at).total_seconds() / 3600
    return len(tweets) / max(time_range, 1)  # tweets per hour
```

#### Academic Research Data Collection

Collect data for research studies.

```python
async def research_data_collection(
    research_query: str,
    sample_size: int = 1000,
    include_user_data: bool = True,
    anonymize: bool = True
):
    """
    Collect and prepare data for academic research.
    Includes anonymization and ethical considerations.
    """
    async with Xeepy() as x:
        dataset = {
            "metadata": {
                "query": research_query,
                "collection_date": datetime.now().isoformat(),
                "sample_size": sample_size,
                "anonymized": anonymize
            },
            "tweets": [],
            "users": [] if include_user_data else None
        }
        
        # Collect tweets
        tweets = await x.scrape.search(
            query=research_query,
            limit=sample_size,
            mode="latest"
        )
        
        user_ids_collected = set()
        
        for tweet in tweets:
            tweet_data = {
                "id": hash(tweet.id) if anonymize else tweet.id,
                "text": tweet.text,
                "created_at": tweet.created_at.isoformat(),
                "likes": tweet.likes,
                "retweets": tweet.retweets,
                "replies": tweet.replies,
                "language": tweet.language,
                "has_media": bool(tweet.media),
                "is_reply": tweet.is_reply,
                "is_retweet": tweet.is_retweet
            }
            
            if anonymize:
                # Remove potential PII
                tweet_data["user_id"] = hash(tweet.user_id)
                tweet_data["text"] = anonymize_text(tweet.text)
            else:
                tweet_data["user_id"] = tweet.user_id
                tweet_data["username"] = tweet.username
            
            dataset["tweets"].append(tweet_data)
            
            # Collect user data
            if include_user_data and tweet.user_id not in user_ids_collected:
                user_ids_collected.add(tweet.user_id)
                
                user_data = {
                    "id": hash(tweet.user_id) if anonymize else tweet.user_id,
                    "followers_count": tweet.user.followers_count,
                    "following_count": tweet.user.following_count,
                    "tweet_count": tweet.user.tweet_count,
                    "account_age_days": (datetime.now() - tweet.user.created_at).days,
                    "verified": tweet.user.verified,
                    "has_bio": bool(tweet.user.bio),
                    "has_profile_image": not tweet.user.default_profile_image
                }
                
                dataset["users"].append(user_data)
        
        # Export in research-friendly formats
        export_research_data(dataset, f"research_{datetime.now().strftime('%Y%m%d')}")
        
        return dataset

def anonymize_text(text: str) -> str:
    """Remove @mentions and URLs for anonymization."""
    import re
    text = re.sub(r'@\w+', '@USER', text)
    text = re.sub(r'http\S+', 'URL', text)
    return text

def export_research_data(dataset: dict, base_filename: str):
    import json
    import csv
    
    # JSON export (full data)
    with open(f"{base_filename}.json", 'w') as f:
        json.dump(dataset, f, indent=2)
    
    # CSV export (tweets only)
    with open(f"{base_filename}_tweets.csv", 'w', newline='') as f:
        if dataset["tweets"]:
            writer = csv.DictWriter(f, fieldnames=dataset["tweets"][0].keys())
            writer.writeheader()
            writer.writerows(dataset["tweets"])
```

---

## �🙏 Acknowledgements

- Built with [Playwright](https://playwright.dev/)
- AI powered by [OpenAI](https://openai.com/), [Anthropic](https://anthropic.com/), [Ollama](https://ollama.ai/)
- CLI built with [Typer](https://typer.tiangolo.com/) and [Rich](https://rich.readthedocs.io/)

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/nirholas/Get-Tweet-Replies-With-Python-Tweepy/issues)
- **Discussions**: [GitHub Discussions](https://github.com/nirholas/Get-Tweet-Replies-With-Python-Tweepy/discussions)
- **Twitter**: [@nichxbt](https://x.com/nichxbt)

---

<p align="center">
  <strong>Built with ❤️ by <a href="https://x.com/nichxbt">@nichxbt</a></strong>
</p>

<p align="center">
  <sub>If Xeepy helped you, consider giving it a ⭐!</sub>
</p>

---

## 🔗 Related Projects

- [XActions](https://github.com/nirholas/xactions) - JavaScript/Node.js version
- [xactions.app](https://xactions.app) - Web dashboard

---

## 🏷️ Keywords

Twitter automation Python, X automation, Tweepy alternative, Twitter scraper Python, mass unfollow Twitter Python, Twitter bot Python, get tweet replies Python, Twitter API alternative free, Playwright Twitter, browser automation X, AI Twitter replies, GPT Twitter bot, Claude Twitter, unfollower tracker Python, Twitter analytics Python, crypto Twitter bot, Twitter followers scraper, Twitter following scraper, auto like Twitter, auto comment Twitter, Twitter monitoring Python
