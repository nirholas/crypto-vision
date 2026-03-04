# Prompt 75 — Telegram Control Bot

## Agent Identity & Rules

```
You are the TELEGRAM-BOT builder.

RULES:
- Work on current branch (main), commit as nirholas
- Always use isBackground: true for terminals, always kill_terminal after
- No mocks — real Telegram Bot API via grammy
- TypeScript strict mode, run npx tsc --noEmit after changes
- Commit message: "feat(swarm): add Telegram bot for real-time swarm control, alerts, and P&L notifications"
```

## Objective

Create `packages/pump-agent-swarm/src/telegram/` — a Telegram bot that provides real-time control over the swarm, sends trade alerts, P&L updates, and allows operators to start/stop/configure the swarm directly from Telegram. Uses the `grammy` library (already used by the root project's `src/bot/` — follow same patterns). This is a massive hackathon demo differentiator: judges see live notifications on a phone.

## File Ownership

- **Creates**: `packages/pump-agent-swarm/src/telegram/bot.ts`
- **Creates**: `packages/pump-agent-swarm/src/telegram/commands.ts`
- **Creates**: `packages/pump-agent-swarm/src/telegram/notifications.ts`
- **Creates**: `packages/pump-agent-swarm/src/telegram/formatters.ts`
- **Creates**: `packages/pump-agent-swarm/src/telegram/index.ts`

## Dependencies

- `grammy` (already in monorepo root dependencies)
- EventBus from `../infra/event-bus.ts` (P04)
- Logger from `../infra/logger.ts` (P07)
- SwarmOrchestrator from `../coordination/swarm-orchestrator.ts` (P50)
- PnLTracker from `../trading/pnl-tracker.ts` (P29)
- Types from `../types.ts` (P01)
- Config from `../config/index.ts` (P06)

## Deliverables

### Create `packages/pump-agent-swarm/src/telegram/bot.ts`

1. **`SwarmTelegramBot` class**:
   - `constructor(config: TelegramBotConfig)`:
     ```typescript
     interface TelegramBotConfig {
       token: string;                    // Telegram bot token from @BotFather
       authorizedUsers: number[];        // Telegram user IDs allowed to control bot
       chatId: number;                   // Default chat to send notifications to
       notificationThrottleMs: number;   // Min interval between notifications (default: 5000)
       enableTradeAlerts: boolean;       // Send alert on every trade
       enablePnlUpdates: boolean;       // Periodic P&L summaries
       pnlUpdateIntervalMs: number;     // How often to send P&L (default: 60000)
     }
     ```
   - `start(): Promise<void>` — starts grammy bot with long polling, registers all command handlers
   - `stop(): Promise<void>` — gracefully stops bot
   - `connectSwarm(orchestrator: SwarmOrchestrator): void` — wires event listeners for notifications
   - `sendMessage(chatId: number, text: string, options?: SendMessageOptions): Promise<void>` — send with Markdown parse mode
   - `sendAlert(alert: SwarmAlert): Promise<void>` — formatted alert with emoji indicators

   **Auth middleware**: Every command handler first checks `ctx.from?.id` against `authorizedUsers`. Unauthorized users get a polite rejection message.

   **Error handling**: Wrap all handlers in try/catch, log errors, send user-facing error message, never crash the bot.

### Create `packages/pump-agent-swarm/src/telegram/commands.ts`

Register these command handlers:

1. **`/start`** — Welcome message with available commands list
2. **`/status`** — Current swarm status:
   ```
   🤖 Swarm Status
   ━━━━━━━━━━━━━━━━━━━━
   Phase: TRADING
   Token: $MEMECOIN (DYn4...k2Qp)
   Uptime: 2h 34m
   Active Agents: 8/10
   Wallets: 12 active
   ━━━━━━━━━━━━━━━━━━━━
   ```
3. **`/pnl`** — Current P&L summary:
   ```
   💰 P&L Report
   ━━━━━━━━━━━━━━━━━━━━
   Invested: 5.000 SOL
   Current Value: 7.250 SOL
   Realized P&L: +1.200 SOL (+24.0%)
   Unrealized P&L: +1.050 SOL (+21.0%)
   Total P&L: +2.250 SOL (+45.0%)
   Token Price: 0.000042 SOL
   ━━━━━━━━━━━━━━━━━━━━
   ```
4. **`/agents`** — List all agents with their status:
   ```
   🤖 Agent Status
   ━━━━━━━━━━━━━━━━━━━━
   ✅ Creator     IDLE      0 trades
   ✅ Trader-1    TRADING   45 trades  +0.3 SOL
   ✅ Trader-2    TRADING   38 trades  +0.1 SOL
   ⚠️ Sniper      COOLDOWN  12 trades  +0.5 SOL
   ✅ MarketMaker ACTIVE    120 trades -0.02 SOL
   ❌ Scanner     ERROR     last: 5m ago
   ━━━━━━━━━━━━━━━━━━━━
   ```
5. **`/trades [n]`** — Last N trades (default 10):
   ```
   📊 Recent Trades
   ━━━━━━━━━━━━━━━━━━━━
   🟢 BUY  0.050 SOL → 1,200 tokens (Trader-1) 2m ago
   🔴 SELL 800 tokens → 0.038 SOL (Trader-2) 3m ago
   🟢 BUY  0.100 SOL → 2,380 tokens (Sniper) 5m ago
   ━━━━━━━━━━━━━━━━━━━━
   ```
6. **`/launch [strategy]`** — Start a new swarm session with optional strategy name
7. **`/stop [reason]`** — Gracefully stop the swarm, trigger exit phase
8. **`/exit`** — Emergency exit: sell all positions, reclaim all wallets
9. **`/wallets`** — Show wallet balances:
   ```
   👛 Wallet Balances
   ━━━━━━━━━━━━━━━━━━━━
   Master:  10.500 SOL (DYn4...k2Qp)
   Wallet 1: 0.450 SOL (3Kf7...m8Np) [trader]
   Wallet 2: 0.380 SOL (9Xb2...j4Rq) [trader]
   Wallet 3: 0.120 SOL (7Wm5...d6Ys) [bundler]
   ━━━━━━━━━━━━━━━━━━━━
   Total: 11.450 SOL across 4 wallets
   ```
10. **`/config [key] [value]`** — View or update runtime config (e.g., `/config maxTradeSize 0.1`)
11. **`/kill`** — Force-kill all agents and shutdown immediately (requires confirmation: "Reply YES to confirm force kill")
12. **`/help`** — List all commands with descriptions

Each command handler:
- Validates arguments
- Checks authorization
- Calls SwarmOrchestrator methods
- Sends formatted Telegram response
- Catches errors and sends error message to user

### Create `packages/pump-agent-swarm/src/telegram/notifications.ts`

1. **`SwarmNotifier` class**:
   - Subscribes to EventBus events and sends Telegram messages
   - `constructor(bot: SwarmTelegramBot, eventBus: EventBus, config: NotificationConfig)`
   - `start(): void` — subscribes to all events
   - `stop(): void` — unsubscribes from all events

   Events to notify on:
   - `trade:executed` → 🟢/🔴 trade alert with amount, price, agent
   - `session:started` → 🚀 "Swarm launched with strategy X"
   - `session:completed` → 🏁 "Session complete. Total P&L: +X SOL"
   - `bundle:executed` → 📦 "Bundle landed: X wallets, Y total SOL"
   - `token:created` → 🪙 "Token created: $SYMBOL (mint address)"
   - `agent:error` → ❌ "Agent X error: message"
   - `risk:alert` → ⚠️ "Risk alert: description"
   - `exit:triggered` → 🚪 "Exit triggered: reason"
   - `pnl:milestone` → 💰 "P&L milestone: +X% total return"

   **Throttling**: Track last notification timestamp per event type. Skip if within `notificationThrottleMs`.

   **Batching**: For `trade:executed` events, batch up to 5 trades into a single message if they arrive within 2 seconds of each other.

2. **`PnLScheduler` class**:
   - Sends periodic P&L summaries at configured interval
   - Includes mini chart using Unicode block characters (▁▂▃▄▅▆▇█)
   - `start(): void` — starts interval timer
   - `stop(): void` — clears interval

### Create `packages/pump-agent-swarm/src/telegram/formatters.ts`

1. **`formatTrade(trade: Trade): string`** — Markdown-formatted trade line
2. **`formatPnL(pnl: PnLSnapshot): string`** — Full P&L report block
3. **`formatAgentStatus(agents: AgentSnapshot[]): string`** — Agent grid with status emojis
4. **`formatWalletBalances(wallets: WalletInfo[]): string`** — Wallet list with balances
5. **`formatSwarmStatus(status: SwarmStatus): string`** — Full status block
6. **`formatAlert(alert: SwarmAlert): string`** — Alert with severity emoji
7. **`formatMiniChart(values: number[], width?: number): string`** — Unicode spark line chart
8. **`formatSolAmount(lamports: number): string`** — "1.234 SOL" with proper decimal places
9. **`formatTokenAmount(amount: number, decimals: number): string`** — "1,234,567 tokens"
10. **`formatTimestamp(date: Date): string`** — "2m ago", "1h ago", etc.
11. **`formatPercentChange(pct: number): string`** — "+45.0%" in green or "-12.3%" in red (no color in Telegram but +/- prefix)
12. **`escapeMarkdown(text: string): string`** — Escape Telegram MarkdownV2 special characters

All formatters use Telegram MarkdownV2 parse mode. Escape characters: `_`, `*`, `[`, `]`, `(`, `)`, `~`, `` ` ``, `>`, `#`, `+`, `-`, `=`, `|`, `{`, `}`, `.`, `!`.

### Create `packages/pump-agent-swarm/src/telegram/index.ts`

```typescript
export { SwarmTelegramBot, type TelegramBotConfig } from './bot.js';
export { registerCommands } from './commands.js';
export { SwarmNotifier, PnLScheduler } from './notifications.js';
export * from './formatters.js';
```

### Integration Example

```typescript
// In swarm-orchestrator.ts or cli-runner.ts:
const bot = new SwarmTelegramBot({
  token: config.telegram.botToken,
  authorizedUsers: config.telegram.authorizedUsers,
  chatId: config.telegram.chatId,
  notificationThrottleMs: 5000,
  enableTradeAlerts: true,
  enablePnlUpdates: true,
  pnlUpdateIntervalMs: 60_000,
});

bot.connectSwarm(orchestrator);
await bot.start();

// On shutdown:
await bot.stop();
```

### Success Criteria

- Bot starts with `grammy` long polling and responds to commands
- Authorization middleware blocks unauthorized users
- All 12 commands return properly formatted Telegram messages
- Trade alerts fire in real-time via EventBus subscription
- P&L updates sent at configured interval with mini spark charts
- Notification throttling prevents message spam
- Trade batching groups rapid trades into single messages
- Graceful shutdown stops bot and unsubscribes from events
- Compiles with `npx tsc --noEmit`
