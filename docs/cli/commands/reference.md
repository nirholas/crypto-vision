# CLI Command Reference

Complete reference for all XTools command-line commands.

## Global Options

```bash
# All commands support these options
xtools [OPTIONS] COMMAND [ARGS]

Options:
  --config PATH    Configuration file path
  --profile NAME   Profile to use (for multiple accounts)
  --verbose, -v    Enable verbose output
  --quiet, -q      Suppress non-essential output
  --json           Output in JSON format
  --help           Show help message
```

## Authentication Commands

### `auth login`

Authenticate with X/Twitter.

```bash
# Interactive browser login
xtools auth login

# With specific profile
xtools auth login --profile work

# Headless (cookie import)
xtools auth login --cookies cookies.json
```

### `auth logout`

Clear authentication.

```bash
xtools auth logout
xtools auth logout --profile work
```

### `auth status`

Check authentication status.

```bash
xtools auth status
# Output: ✓ Logged in as @username
```

### `auth export`

Export session cookies.

```bash
xtools auth export session.json
xtools auth export --format netscape cookies.txt
```

---

## Scraping Commands

### `scrape replies`

Get replies to a tweet.

```bash
# Basic usage
xtools scrape replies https://x.com/user/status/123

# With options
xtools scrape replies https://x.com/user/status/123 \
  --limit 500 \
  --output replies.csv \
  --format csv

# Include nested replies
xtools scrape replies https://x.com/user/status/123 --nested
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `--limit, -n` | Maximum replies | 100 |
| `--output, -o` | Output file | stdout |
| `--format, -f` | Output format (csv, json, table) | table |
| `--nested` | Include nested replies | false |
| `--since` | Only replies after date | - |

### `scrape profile`

Get user profile information.

```bash
xtools scrape profile elonmusk
xtools scrape profile elonmusk --json
xtools scrape profile user1 user2 user3 --output profiles.csv
```

### `scrape followers`

Get user's followers.

```bash
# Basic
xtools scrape followers username

# With limit
xtools scrape followers username --limit 1000 --output followers.csv

# Filter by followers count
xtools scrape followers username --min-followers 1000
```

### `scrape following`

Get who a user follows.

```bash
xtools scrape following username --limit 500
xtools scrape following username --output following.json --format json
```

### `scrape tweets`

Get user's tweets.

```bash
# Recent tweets
xtools scrape tweets username --limit 100

# With date range
xtools scrape tweets username \
  --since 2024-01-01 \
  --until 2024-02-01 \
  --output tweets.csv

# Include retweets
xtools scrape tweets username --include-retweets
```

### `scrape search`

Search for tweets.

```bash
# Basic search
xtools scrape search "python programming"

# Advanced search
xtools scrape search "AI tools" \
  --limit 200 \
  --type Latest \
  --min-likes 100 \
  --lang en

# Search with operators
xtools scrape search "from:elonmusk AI" --limit 50
```

### `scrape hashtag`

Get tweets with a hashtag.

```bash
xtools scrape hashtag python --limit 100
xtools scrape hashtag machinelearning --since 2024-01-01
```

### `scrape thread`

Unroll a Twitter thread.

```bash
xtools scrape thread https://x.com/user/status/123
xtools scrape thread https://x.com/user/status/123 --output thread.md --format markdown
```

---

## Follow/Unfollow Commands

### `follow user`

Follow a user.

```bash
xtools follow user username
xtools follow user user1 user2 user3
```

### `follow by-keyword`

Follow users tweeting about keywords.

```bash
xtools follow by-keyword "python" "machine learning" \
  --limit 50 \
  --min-followers 100
```

### `follow by-hashtag`

Follow users using specific hashtags.

```bash
xtools follow by-hashtag python AI \
  --limit 30 \
  --since 24h
```

### `follow target-followers`

Follow followers of a specific account.

```bash
xtools follow target-followers competitor_account \
  --limit 100 \
  --min-followers 500 \
  --skip-verified
```

### `unfollow non-followers`

Unfollow accounts that don't follow you back.

```bash
# Preview mode
xtools unfollow non-followers --dry-run

# Execute
xtools unfollow non-followers --limit 100

# With whitelist
xtools unfollow non-followers \
  --whitelist @friend1 @friend2 \
  --skip-verified \
  --min-following-days 30
```

### `unfollow everyone`

Mass unfollow (use with caution).

```bash
# ALWAYS preview first
xtools unfollow everyone --dry-run

# With safety limits
xtools unfollow everyone \
  --limit 100 \
  --whitelist-file whitelist.txt \
  --delay 5
```

### `unfollow smart`

AI-powered unfollowing based on engagement.

```bash
xtools unfollow smart \
  --criteria "no_interaction_30_days" \
  --limit 50 \
  --dry-run
```

---

## Engagement Commands

### `engage like`

Like tweets.

```bash
# Single tweet
xtools engage like https://x.com/user/status/123

# Multiple tweets
xtools engage like url1 url2 url3

# Auto-like by keyword
xtools engage like --keyword "python tips" --limit 20
```

### `engage retweet`

Retweet tweets.

```bash
xtools engage retweet https://x.com/user/status/123
xtools engage retweet url1 url2 --quote "Great insight!"
```

### `engage comment`

Reply to tweets.

```bash
xtools engage comment https://x.com/user/status/123 "Great post!"

# AI-generated comment
xtools engage comment https://x.com/user/status/123 \
  --ai \
  --style supportive
```

### `engage auto-like`

Automatic liking based on criteria.

```bash
xtools engage auto-like \
  --keywords "python" "ai" "programming" \
  --limit 50 \
  --min-followers 500 \
  --delay 2-5
```

### `engage bookmark`

Bookmark tweets.

```bash
xtools engage bookmark https://x.com/user/status/123
xtools engage bookmark url1 url2 url3
```

---

## Monitoring Commands

### `monitor unfollowers`

Check for unfollowers.

```bash
# Basic check
xtools monitor unfollowers

# With notification
xtools monitor unfollowers --notify discord

# Detailed report
xtools monitor unfollowers --detailed --output report.json
```

### `monitor growth`

Track follower growth.

```bash
xtools monitor growth --days 30
xtools monitor growth --output growth.csv --chart growth.png
```

### `monitor keywords`

Monitor keyword mentions.

```bash
# Start monitoring
xtools monitor keywords "brand" "product" \
  --interval 5m \
  --notify telegram

# One-time check
xtools monitor keywords "brand" --since 1h
```

### `monitor accounts`

Watch specific accounts for changes.

```bash
xtools monitor accounts competitor1 competitor2 \
  --watch bio,followers,tweets \
  --notify discord
```

---

## DM Commands

### `dm send`

Send direct messages.

```bash
xtools dm send username "Hello!"
xtools dm send user1 user2 "Check this out!" --media image.jpg
```

### `dm inbox`

View DM inbox.

```bash
xtools dm inbox
xtools dm inbox --unread-only --limit 20
```

### `dm search`

Search DMs.

```bash
xtools dm search "keyword"
```

---

## Scheduling Commands

### `schedule tweet`

Schedule a tweet.

```bash
xtools schedule tweet "Hello world!" --at "2024-12-25 09:00"
xtools schedule tweet "With media!" --at "2024-12-25 12:00" --media photo.jpg
```

### `schedule list`

List scheduled tweets.

```bash
xtools schedule list
xtools schedule list --json
```

### `schedule delete`

Delete scheduled tweet.

```bash
xtools schedule delete TWEET_ID
xtools schedule delete --all
```

---

## Export Commands

### `export csv`

Export data to CSV.

```bash
xtools export csv followers.json followers.csv
xtools export csv --fields username,followers_count,bio
```

### `export json`

Export to JSON.

```bash
xtools export json followers.csv followers.json
```

### `export excel`

Export to Excel.

```bash
xtools export excel data.json report.xlsx
xtools export excel --sheets followers,following
```

---

## Utility Commands

### `trends`

Get trending topics.

```bash
xtools trends
xtools trends --location "United States"
xtools trends --json
```

### `rate-limits`

Check rate limit status.

```bash
xtools rate-limits
```

### `config`

Manage configuration.

```bash
# Show current config
xtools config show

# Set value
xtools config set default_limit 100

# Edit in editor
xtools config edit
```

### `version`

Show version information.

```bash
xtools version
xtools version --check-update
```

---

## Environment Variables

```bash
# Authentication
export XTOOLS_SESSION_PATH=~/.xtools/session.json

# Defaults
export XTOOLS_DEFAULT_LIMIT=100
export XTOOLS_RATE_LIMIT_DELAY=2

# Notifications
export XTOOLS_DISCORD_WEBHOOK=https://discord.com/api/webhooks/...
export XTOOLS_TELEGRAM_BOT_TOKEN=123456:ABC...
export XTOOLS_TELEGRAM_CHAT_ID=123456789

# AI Providers
export XTOOLS_OPENAI_API_KEY=sk-...
export XTOOLS_ANTHROPIC_API_KEY=sk-ant-...
```

---

## Examples

### Daily Workflow

```bash
# Morning check
xtools monitor unfollowers --notify discord
xtools monitor growth

# Engagement session
xtools engage auto-like --keywords "python" --limit 30
xtools follow by-keyword "developer" --limit 20

# Evening cleanup
xtools unfollow non-followers --limit 50 --skip-verified
```

### Research Session

```bash
# Scrape competitor data
xtools scrape followers competitor --limit 5000 -o comp_followers.csv
xtools scrape tweets competitor --limit 500 -o comp_tweets.csv

# Analyze
xtools scrape profile comp_followers.csv --output comp_profiles.csv
```

### Content Curation

```bash
# Find content to engage with
xtools scrape search "AI tools" --min-likes 1000 -o viral_ai.csv

# Scrape threads for inspiration
xtools scrape thread https://x.com/user/status/123 -o thread.md
```

## Shell Completions

```bash
# Bash
xtools --install-completion bash

# Zsh
xtools --install-completion zsh

# Fish
xtools --install-completion fish
```
