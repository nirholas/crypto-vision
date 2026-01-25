# CLI Reference

XTools provides a powerful command-line interface for common operations without writing code.

## Installation

The CLI is included with XTools:

```bash
pip install xtools
```

## Basic Usage

```bash
xtools [COMMAND] [SUBCOMMAND] [OPTIONS]

# Get help
xtools --help
xtools scrape --help
xtools scrape replies --help
```

## Commands Overview

| Command | Description |
|---------|-------------|
| `auth` | Authentication management |
| `scrape` | Scrape data from X/Twitter |
| `follow` | Follow users |
| `unfollow` | Unfollow users |
| `engage` | Like, retweet, reply |
| `monitor` | Monitor account changes |
| `analytics` | View analytics and reports |
| `ai` | AI-powered features |
| `export` | Export data to files |
| `config` | Configuration management |

## Authentication Commands

### Login

```bash
# Interactive login (opens browser)
xtools auth login

# Login with specific profile
xtools auth login --profile business

# Login with browser visible
xtools auth login --headful
```

### Status

```bash
# Check authentication status
xtools auth status

# Output:
# ✓ Authenticated as @username
# Session age: 2 days
```

### Logout

```bash
# Clear session
xtools auth logout

# Clear all sessions
xtools auth logout --all
```

### Import/Export

```bash
# Export session for backup
xtools auth export session_backup.json

# Import session
xtools auth import session_backup.json

# Import from browser cookies
xtools auth import cookies.txt --format netscape
```

## Scrape Commands

### Scrape Replies

```bash
# Basic usage
xtools scrape replies https://x.com/user/status/123456

# With options
xtools scrape replies https://x.com/user/status/123456 \
    --limit 500 \
    --output replies.csv

# Filter options
xtools scrape replies URL \
    --min-likes 10 \
    --verified-only \
    --sort top
```

### Scrape Profile

```bash
# Get profile info
xtools scrape profile elonmusk

# Output as JSON
xtools scrape profile elonmusk --format json

# Multiple profiles
xtools scrape profile user1 user2 user3 -o profiles.csv
```

### Scrape Tweets

```bash
# User's tweets
xtools scrape tweets username --limit 100

# Include retweets and replies
xtools scrape tweets username --include-retweets --include-replies

# Date range
xtools scrape tweets username --since 2024-01-01 --until 2024-02-01
```

### Scrape Followers

```bash
# Basic
xtools scrape followers username --limit 1000

# Output to file
xtools scrape followers username -o followers.csv

# With metadata
xtools scrape followers username --include-bio --include-stats
```

### Scrape Following

```bash
xtools scrape following username --limit 500 -o following.csv
```

### Scrape Search

```bash
# Basic search
xtools scrape search "python programming" --limit 100

# Advanced search
xtools scrape search "python programming" \
    --min-likes 50 \
    --min-retweets 10 \
    --lang en \
    --since 2024-01-01

# Search type
xtools scrape search "keyword" --type latest  # or "top", "people"
```

### Scrape Hashtag

```bash
xtools scrape hashtag "#buildinpublic" --limit 200 -o hashtag.csv
```

### Scrape Thread

```bash
# Unroll a thread
xtools scrape thread https://x.com/user/status/123456 -o thread.json
```

## Follow Commands

### Follow User

```bash
# Follow single user
xtools follow user naval

# Follow multiple
xtools follow user user1 user2 user3
```

### Follow by Hashtag

```bash
xtools follow hashtag "#buildinpublic" \
    --limit 20 \
    --min-followers 100 \
    --max-followers 50000
```

### Follow from Search

```bash
xtools follow search "indie hacker" \
    --limit 15 \
    --min-followers 500
```

### Follow Followers Of

```bash
xtools follow followers-of competitor_account \
    --limit 30 \
    --active-days 30
```

## Unfollow Commands

### Unfollow Non-Followers

```bash
# Dry run (preview)
xtools unfollow non-followers --dry-run

# Execute
xtools unfollow non-followers --max 50

# With whitelist
xtools unfollow non-followers \
    --max 50 \
    --whitelist-file whitelist.txt

# Inline whitelist
xtools unfollow non-followers \
    --max 50 \
    --whitelist user1,user2,user3
```

### Unfollow Inactive

```bash
xtools unfollow inactive --days 180 --max 30
```

### Smart Unfollow

```bash
xtools unfollow smart \
    --criteria inactive,no-bio,not-following \
    --max 25
```

### Unfollow Everyone

```bash
# Requires confirmation
xtools unfollow everyone \
    --whitelist-file whitelist.txt \
    --confirm
```

## Engage Commands

### Like

```bash
# Like a tweet
xtools engage like https://x.com/user/status/123456

# Like multiple
xtools engage like URL1 URL2 URL3
```

### Retweet

```bash
xtools engage retweet https://x.com/user/status/123456
```

### Reply

```bash
xtools engage reply https://x.com/user/status/123456 "Great thread!"
```

### Auto-Like

```bash
xtools engage auto-like \
    --keywords "python,automation" \
    --limit 20 \
    --min-likes 10
```

## Monitor Commands

### Check Unfollowers

```bash
# One-time check
xtools monitor unfollowers

# With notification
xtools monitor unfollowers --notify discord

# Continuous monitoring
xtools monitor unfollowers --watch --interval 3600
```

### Track Growth

```bash
xtools monitor growth --period 7d
```

### Monitor Keywords

```bash
xtools monitor keywords "your_brand,your_product" \
    --notify telegram \
    --interval 300
```

### Start Daemon

```bash
# Start all monitors in background
xtools monitor start --config monitoring.yaml --daemon
```

## Analytics Commands

### Growth Report

```bash
xtools analytics growth --period 30d
```

### Engagement Analysis

```bash
xtools analytics engagement --period 7d
```

### Best Time to Post

```bash
xtools analytics best-time

# Output:
# Best day: Tuesday
# Best hour: 14:00
# Top 5 slots: ...
```

### Audience Insights

```bash
xtools analytics audience --sample 1000
```

### Competitor Analysis

```bash
xtools analytics competitors comp1,comp2,comp3
```

### Generate Report

```bash
# Markdown report
xtools analytics report --period 30d -o report.md

# PDF report
xtools analytics report --period 30d --format pdf -o report.pdf
```

## AI Commands

### Generate Tweet

```bash
xtools ai tweet "Python tips" --style educational
```

### Generate Thread

```bash
xtools ai thread "My startup journey" --length 5
```

### Generate Reply

```bash
xtools ai reply https://x.com/user/status/123456 --style supportive
```

### Analyze Sentiment

```bash
xtools ai sentiment "This is amazing!"

# Analyze from file
xtools ai sentiment --file tweets.txt
```

### Bot Detection

```bash
xtools ai bot-check suspicious_username
```

## Export Commands

### Convert Formats

```bash
# CSV to JSON
xtools export convert data.csv data.json

# JSON to Excel
xtools export convert data.json data.xlsx
```

### Export to Database

```bash
xtools export database data.csv sqlite:///data.db --table tweets
xtools export database data.csv postgresql://user:pass@host/db --table tweets
```

## Configuration Commands

### View Config

```bash
# Show current configuration
xtools config show

# Show specific setting
xtools config get rate_limit.requests_per_minute
```

### Set Config

```bash
xtools config set rate_limit.requests_per_minute 25
xtools config set headless true
```

### Profiles

```bash
# List profiles
xtools config profiles

# Create profile
xtools config create-profile business

# Use profile
xtools --profile business scrape replies URL
```

## Global Options

Available for all commands:

| Option | Description |
|--------|-------------|
| `--profile NAME` | Use named profile |
| `--config FILE` | Use config file |
| `--headless/--no-headless` | Browser visibility |
| `--verbose/-v` | Verbose output |
| `--quiet/-q` | Suppress output |
| `--dry-run` | Preview without executing |
| `--output/-o FILE` | Output file |
| `--format FORMAT` | Output format (csv, json, etc.) |

## Output Formats

```bash
# CSV (default)
xtools scrape tweets user -o tweets.csv

# JSON
xtools scrape tweets user -o tweets.json --format json

# Excel
xtools scrape tweets user -o tweets.xlsx --format excel

# Pretty print to console
xtools scrape profile user --format pretty
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `XTOOLS_SESSION_FILE` | Session file path |
| `XTOOLS_CONFIG_FILE` | Config file path |
| `XTOOLS_PROFILE` | Default profile |
| `XTOOLS_HEADLESS` | Headless mode (true/false) |
| `DISCORD_WEBHOOK` | Discord notification URL |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token |
| `OPENAI_API_KEY` | OpenAI API key |

## Examples

### Daily Routine Script

```bash
#!/bin/bash
# daily_routine.sh

echo "🌅 Starting daily routine..."

# Check unfollowers
xtools monitor unfollowers --notify discord

# Unfollow non-followers
xtools unfollow non-followers --max 25 --whitelist-file whitelist.txt

# Follow from target hashtag
xtools follow hashtag "#buildinpublic" --limit 15 --min-followers 100

# Generate growth report
xtools analytics growth --period 24h --notify discord

echo "✅ Daily routine complete!"
```

### Data Collection Pipeline

```bash
#!/bin/bash
# collect_data.sh

USERNAME=$1
OUTPUT_DIR="data/$USERNAME"
mkdir -p $OUTPUT_DIR

echo "📊 Collecting data for @$USERNAME..."

xtools scrape profile $USERNAME -o "$OUTPUT_DIR/profile.json" --format json
xtools scrape tweets $USERNAME --limit 500 -o "$OUTPUT_DIR/tweets.csv"
xtools scrape followers $USERNAME --limit 1000 -o "$OUTPUT_DIR/followers.csv"

echo "✅ Data saved to $OUTPUT_DIR/"
```

### Competitor Analysis

```bash
#!/bin/bash
# analyze_competitors.sh

COMPETITORS="comp1 comp2 comp3"

for comp in $COMPETITORS; do
    echo "Analyzing @$comp..."
    xtools scrape tweets $comp --limit 100 -o "analysis/$comp_tweets.csv"
done

xtools analytics competitors $COMPETITORS -o "analysis/comparison.md"
```
