<p align="center">
  <img src="https://img.shields.io/badge/🐍_Python-3.10+-blue?style=for-the-badge" alt="Python 3.10+"/>
  <img src="https://img.shields.io/badge/⚡_Async-Native-green?style=for-the-badge" alt="Async Native"/>
  <img src="https://img.shields.io/badge/🤖_AI-Powered-purple?style=for-the-badge" alt="AI Powered"/>
  <img src="https://img.shields.io/badge/📦_No_API-Required-orange?style=for-the-badge" alt="No API Required"/>
</p>

<h1 align="center">🐦 XTools - Python X/Twitter Automation Toolkit</h1>

<p align="center">
  <strong>The most comprehensive Python toolkit for X/Twitter automation.</strong><br/>
  Educational resource demonstrating browser automation, AI integration, and growth strategies.
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-features">Features</a> •
  <a href="#-ai-features">AI Features</a> •
  <a href="#-documentation">Docs</a> •
  <a href="#-for-ai-agents">For AI Agents</a>
</p>

---

> ⚠️ **EDUCATIONAL PURPOSES ONLY** - This toolkit demonstrates automation techniques for research and learning. Scripts should not be run against X/Twitter as it may violate their Terms of Service.

---

## 🔥 Why XTools?

| Problem | XTools Solution |
|---------|-----------------|
| Twitter API costs $100-5000/month | **Free** - Uses browser automation |
| Tweepy deprecated search endpoints | **Works** - Direct browser scraping |
| Can't get tweet replies easily | **Solved** - Full reply scraper |
| No AI integration in tools | **Built-in** - GPT, Claude, Ollama support |
| Complex setup requirements | **Simple** - `pip install xtools` |

---

## 🚀 Quick Start

```bash
# Install
pip install xtools

# Or clone for development
git clone https://github.com/nirholas/Get-Tweet-Replies-With-Python-Tweepy.git
cd Get-Tweet-Replies-With-Python-Tweepy
pip install -e .
```

### Get Tweet Replies (Fixes Original Repo!)

```python
from xtools import XTools

async with XTools() as x:
    # This is what the original repo was supposed to do!
    replies = await x.scrape.replies(
        "https://x.com/elonmusk/status/1234567890",
        limit=100
    )
    
    for reply in replies:
        print(f"@{reply.username}: {reply.text}")
    
    # Export to CSV (like the original)
    x.export.to_csv(replies, "replies_clean.csv")
```

### Unfollow Non-Followers (Most Requested Feature)

```python
from xtools import XTools

async with XTools() as x:
    # Preview who would be unfollowed
    result = await x.unfollow.non_followers(
        max_unfollows=100,
        whitelist=["important_account", "friend"],
        dry_run=True  # Preview first!
    )
    
    print(f"Would unfollow: {result.unfollowed_users}")
```

---

## ✨ Features

### 📊 Scraping (12 Scrapers)
| Feature | Description | Status |
|---------|-------------|--------|
| `scrape.replies()` | Get all replies to a tweet | ✅ |
| `scrape.profile()` | User profile data | ✅ |
| `scrape.followers()` | Follower list with details | ✅ |
| `scrape.following()` | Following list | ✅ |
| `scrape.tweets()` | User's tweet history | ✅ |
| `scrape.thread()` | Full thread unroller | ✅ |
| `scrape.hashtag()` | Tweets by hashtag | ✅ |
| `scrape.search()` | Search results | ✅ |
| `scrape.media()` | User's media posts | ✅ |
| `scrape.likes()` | Who liked a tweet | ✅ |
| `scrape.lists()` | List members | ✅ |
| `scrape.mentions()` | Mentions of a user | ✅ |

### 🔄 Follow/Unfollow Operations
| Feature | Description | Status |
|---------|-------------|--------|
| `unfollow.non_followers()` | Unfollow who doesn't follow back | ✅ |
| `unfollow.everyone()` | Nuclear option - unfollow all | ✅ |
| `unfollow.smart()` | Time-based smart unfollow | ✅ |
| `unfollow.by_criteria()` | Filter-based unfollow | ✅ |
| `follow.user()` | Follow a user | ✅ |
| `follow.by_keyword()` | Follow from search results | ✅ |
| `follow.by_hashtag()` | Follow hashtag users | ✅ |
| `follow.followers_of()` | Follow target's followers | ✅ |
| `follow.engagers()` | Follow post likers/commenters | ✅ |

### 💜 Engagement Automation
| Feature | Description | Status |
|---------|-------------|--------|
| `engage.like()` | Like tweets | ✅ |
| `engage.auto_like()` | Auto-like by criteria | ✅ |
| `engage.comment()` | Post comments | ✅ |
| `engage.auto_comment()` | AI-powered auto-comment | ✅ |
| `engage.retweet()` | Retweet posts | ✅ |
| `engage.bookmark()` | Bookmark management | ✅ |

### 📈 Monitoring & Analytics
| Feature | Description | Status |
|---------|-------------|--------|
| `monitor.unfollowers()` | Detect who unfollowed you | ✅ |
| `monitor.account()` | Track any account changes | ✅ |
| `monitor.keywords()` | Real-time keyword monitoring | ✅ |
| `analytics.growth()` | Growth tracking over time | ✅ |
| `analytics.engagement()` | Engagement rate analysis | ✅ |
| `analytics.best_time()` | Optimal posting times | ✅ |

### 🤖 AI-Powered Features
| Feature | Description | Status |
|---------|-------------|--------|
| `ai.generate_reply()` | AI-generated contextual replies | ✅ |
| `ai.sentiment()` | Sentiment analysis | ✅ |
| `ai.detect_bots()` | Bot/spam detection | ✅ |
| `ai.smart_targeting()` | AI targeting recommendations | ✅ |
| `ai.crypto_analysis()` | Crypto Twitter intelligence | ✅ |

---

## 🤖 AI Features

XTools integrates with multiple AI providers for intelligent automation:

### Supported Providers
- **OpenAI** (GPT-4, GPT-3.5)
- **Anthropic** (Claude 3 Opus, Sonnet, Haiku)
- **Local Models** (Ollama - Llama, Mistral, etc.)

### AI-Generated Replies

```python
from xtools import XTools
from xtools.ai import ContentGenerator

async with XTools() as x:
    ai = ContentGenerator(provider="openai", api_key="...")
    
    # Generate contextual reply
    tweet = "Just launched my new startup! 🚀"
    reply = await ai.generate_reply(
        tweet_text=tweet,
        style="supportive",  # supportive, witty, professional, crypto
        max_length=280
    )
    print(reply)
    # Output: "Congrats on the launch! 🎉 What problem are you solving?"
```

---

## 🤖 For AI Agents (LLMs, Copilot, Cursor)

XTools is designed to work seamlessly with AI coding assistants. See [AGENTS.md](AGENTS.md) for detailed integration instructions.

### Quick Reference for AI Assistants

```
User: "How do I get replies to a tweet in Python?"
→ Use xtools.scrape.replies(tweet_url)

User: "Unfollow everyone who doesn't follow me back"  
→ Use xtools.unfollow.non_followers()

User: "Auto-like tweets about Python"
→ Use xtools.engage.auto_like(keywords=["python"])

User: "Who unfollowed me?"
→ Use xtools.monitor.unfollowers()

User: "Generate AI reply to this tweet"
→ Use xtools.ai.generate_reply(tweet_text)
```

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [Quick Start](docs/QUICKSTART.md) | Get started in 5 minutes |
| [CLI Reference](docs/CLI_REFERENCE.md) | Command-line interface |
| [AI Features](docs/AI_FEATURES.md) | AI integration guide |
| [Examples](docs/EXAMPLES.md) | Code examples for every feature |
| [FAQ](docs/FAQ.md) | Common questions answered |

---

## 🖥️ CLI Usage

```bash
# Authentication
xtools auth login                    # Setup session

# Scraping
xtools scrape replies <tweet_url>    # Get tweet replies
xtools scrape followers <username>   # Get followers
xtools scrape tweets <username>      # Get user tweets

# Unfollow
xtools unfollow non-followers        # Unfollow non-followers
xtools unfollow everyone --dry-run   # Preview mass unfollow

# Engagement
xtools engage auto-like "python"     # Auto-like by keyword

# Monitoring  
xtools monitor unfollowers           # Check who unfollowed

# AI
xtools ai reply "Great tweet!"       # Generate AI reply
```

---

## 🔍 Common Questions (SEO)

<details>
<summary><strong>How to get tweet replies with Python?</strong></summary>

```python
from xtools import XTools

async with XTools() as x:
    replies = await x.scrape.replies("https://x.com/user/status/123")
```
</details>

<details>
<summary><strong>Python Twitter API alternative free?</strong></summary>

XTools uses browser automation instead of the expensive Twitter API ($100-5000/month). It's completely free and works without API keys.
</details>

<details>
<summary><strong>How to mass unfollow on Twitter/X with Python?</strong></summary>

```python
from xtools import XTools

async with XTools() as x:
    await x.unfollow.non_followers(max_unfollows=100)
```
</details>

<details>
<summary><strong>Tweepy search not working / deprecated?</strong></summary>

Tweepy's search endpoints require expensive API access. XTools works without the API by using browser automation.
</details>

<details>
<summary><strong>How to detect who unfollowed me on Twitter?</strong></summary>

```python
from xtools import XTools

async with XTools() as x:
    report = await x.monitor.unfollowers()
    print(f"Unfollowers: {report.unfollowers}")
```
</details>

---

## 🛡️ Rate Limiting & Safety

XTools includes intelligent rate limiting to protect your account:

| Action | Default Delay | Per Hour | Per Day |
|--------|---------------|----------|---------|
| Follow | 3-8 sec | 20 | 100 |
| Unfollow | 2-6 sec | 25 | 150 |
| Like | 1-3 sec | 50 | 500 |
| Comment | 30-90 sec | 10 | 50 |

---

## ⚖️ Legal Disclaimer

This software is provided for **educational and research purposes only**. 

- ❌ Do NOT use for spam or harassment
- ❌ Do NOT violate X/Twitter Terms of Service
- ✅ DO use for learning about automation
- ✅ DO use for understanding browser automation

The authors are not responsible for any misuse of this software.

---

## 📜 License

MIT License - see [LICENSE](LICENSE) for details.

---

<p align="center">
  <strong>Built with ❤️ by <a href="https://x.com/nichxbt">@nichxbt</a></strong><br/>
  <sub>Star ⭐ this repo if you find it useful!</sub>
</p>

---

## 🔗 Related Projects

- [XActions](https://github.com/nirholas/xactions) - JavaScript/Node.js version
- [xactions.app](https://xactions.app) - Web dashboard
