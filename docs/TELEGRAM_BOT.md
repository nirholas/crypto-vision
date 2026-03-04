# Telegram Bot (Crypto Vision)

> Crypto call tracking, leaderboards, PNL cards, and premium subscriptions via Telegram.

## Overview

Crypto Vision is a Telegram bot built with [Grammy](https://grammy.dev/) that enables crypto communities to track calls, maintain leaderboards, generate PNL cards, and manage premium features. It runs as a component of the root API service.

**Location:** `src/bot/`
**Framework:** Grammy (Telegram Bot Framework for TypeScript)
**Database:** PostgreSQL via Drizzle ORM
**Entry Point:** `src/bot/index.ts`

## Features

| Feature | Description |
|---------|-------------|
| **Call Tracking** | Track crypto trade calls with entry/target/stop-loss pricing |
| **Leaderboards** | Per-group leaderboards based on call accuracy and PNL |
| **PNL Cards** | Visual profit/loss cards generated with Sharp/Canvas |
| **Premium Subscriptions** | Paid premium tier with advanced features |
| **Referral System** | Referral tracking with rewards |
| **Hardcore Mode** | Challenge mode with stricter evaluation criteria |
| **Insider Alerts** | Real-time alerts for insider activity |
| **Group Management** | Multi-group support with per-group settings |
| **Channel Integration** | Channel-based call forwarding and broadcasting |

## Architecture

```
Telegram API
    │
    ▼
Grammy Bot (src/bot/telegram/bot.ts)
    │
    ├── Command Handlers
    │   ├── /start, /help
    │   ├── /call <token> <entry> <target> <sl>
    │   ├── /leaderboard
    │   ├── /pnl
    │   ├── /premium
    │   └── /hardcore
    │
    ├── Services
    │   ├── user-service       → User registration, profiles
    │   ├── group-service      → Group settings, permissions
    │   ├── call-service       → Call CRUD, evaluation
    │   ├── channel-service    → Channel management
    │   ├── leaderboard-service → Rankings, scoring
    │   ├── pnl-card           → Visual PNL card generation
    │   ├── premium-service    → Subscription management
    │   ├── referral-service   → Referral tracking
    │   ├── token-data         → Token price lookups
    │   ├── hardcore-service   → Hardcore mode logic
    │   └── insider-alerts     → Insider activity detection
    │
    ├── Background Workers
    │   ├── price-tracker      → Periodic price checks for call evaluation
    │   └── hardcore-worker    → Hardcore mode enforcement
    │
    └── Database (PostgreSQL via Drizzle ORM)
```

## Database Schema

Defined in `src/bot/db/schema.ts` (471 lines). Key tables:

| Table | Purpose |
|-------|---------|
| `users` | Telegram users with premium status, referral codes |
| `groups` | Telegram groups with settings, feature flags |
| `calls` | Trade calls with entry, target, stop-loss, status |
| `leaderboards` | Periodic leaderboard snapshots |
| `pnl_records` | Profit/loss tracking per user |
| `hardcore_entries` | Hardcore mode participation |
| `referrals` | Referral relationships and rewards |
| `premium_subscriptions` | Premium subscription records |
| `insider_alerts` | Insider activity alert logs |

## Services

### Call Service
Manages the full call lifecycle: create → monitor → evaluate → close.

```
User: /call ETH 3800 4200 3650
    │
    ├── Parse: token=ETH, entry=$3,800, target=$4,200, stop_loss=$3,650
    ├── Validate: within allowed ranges, user has remaining call slots
    ├── Record: insert into calls table
    ├── Monitor: price-tracker worker checks periodically
    │
    ├── Target hit? → Mark as WIN, update leaderboard
    └── Stop loss hit? → Mark as LOSS, update leaderboard
```

### PNL Card Service
Generates visual profit/loss cards using Sharp and Canvas, showing user performance, win rate, and recent calls.

### Leaderboard Service
Ranks users within each group by:
- Win rate (calls that hit target)
- Total PNL (cumulative profit/loss)
- Streak (consecutive wins)
- Call accuracy (target proximity)

### Premium Service
Manages paid subscriptions with feature gating:
- Unlimited calls (free tier has daily limits)
- Advanced analytics
- Priority price tracking
- Custom PNL card themes

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Yes | Telegram Bot API token from @BotFather |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `CRYPTO_VISION_ENABLED` | No | Set to `true` to enable the bot (default: `false`) |

## Database Migrations

Migrations are managed with Drizzle Kit:

```bash
# Generate a new migration
npx drizzle-kit generate

# Run pending migrations
npx drizzle-kit migrate

# Open Drizzle Studio (database GUI)
npx drizzle-kit studio
```

Migration files are stored in `src/bot/db/migrations/`.

The `drizzle.config.ts` at the repo root configures:
- Dialect: PostgreSQL
- Schema: `./src/bot/db/schema.ts`
- Migrations: `./src/bot/db/migrations`
- Default DB: `postgres://localhost:5432/cryptovision`

## API Routes

The bot exposes REST endpoints via `src/routes/crypto-vision.ts`:

```
GET  /api/crypto-vision/status     # Bot health and stats
GET  /api/crypto-vision/groups     # List active groups
GET  /api/crypto-vision/leaderboard/:groupId  # Group leaderboard
POST /api/crypto-vision/webhook    # Telegram webhook endpoint
```

## Running

The bot starts automatically when `CRYPTO_VISION_ENABLED=true` and required env vars are set:

```bash
# In .env
TELEGRAM_BOT_TOKEN=your-bot-token
DATABASE_URL=postgres://localhost:5432/cryptovision
CRYPTO_VISION_ENABLED=true

# Start the API server (bot starts with it)
npm run dev
```

The bot lifecycle is managed in `src/bot/index.ts` with auto-restart and exponential backoff on failures.
