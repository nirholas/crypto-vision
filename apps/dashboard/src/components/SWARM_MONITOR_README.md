# Autonomous AI Agent Swarm Monitor

A real-time dashboard component for monitoring autonomous AI agent swarms that create, trade, and manage tokens on Solana.

## Features

- **🎙️ Live AI Narration** — Real-time OpenRouter-powered commentary explaining what's happening
- **📊 Real-time Metrics** — Budget, trades executed, P&L, ROI, agents status
- **📋 Event Feed** — Complete history of autonomous agent decisions
- **🎨 Presentation-Ready UI** — Beautiful formatting optimized for screen sharing and projectors
- **🔄 Auto-reconnect** — Seamless fallback from WebSockets to polling if needed
- **⚡ Zero Latency** — Server-Sent Events (SSE) for instant updates

## Architecture

### Components

1. **`SwarmMonitor.tsx`** — Main UI component displaying live metrics and narration
2. **`SwarmStarter.tsx`** — Button to launch a new presentation session
3. **`useSwarmMonitor.ts`** — React hook managing real-time event subscriptions

### API Endpoints

- `GET /api/swarm/events` — Server-Sent Events stream for real-time updates
- `GET /api/swarm/status` — Current status snapshot
- `POST /api/swarm/start` — Start a new swarm session
- `PUT /api/swarm/start` — Stop the current session

### Event Manager

The `swarmEventManager` singleton in `/api/swarm/events/route.ts` handles:
- Broadcasting to all connected clients
- Maintaining connection state
- Storing last status for reconnecting clients

## Usage

### 1. Navigate to the Swarm Monitor

```
http://localhost:3000/swarm
```

### 2. Start a Demo

Click the **🤖 Start Demo** button. The dashboard will:

1. Connect to the real-time event stream
2. Display live narration from OpenRouter
3. Show metrics updating in real-time
4. Build an event feed as the swarm executes

### 3. Integrate with Presentation Mode

In your backend code, use the broadcast utilities:

```typescript
import { swarmBroadcast } from '@/lib/dashboard-presentation';

// Narrate an event
swarmBroadcast.narration('The swarm is initializing...', {
  agents: 5,
  budget: 10,
});

// Record a token creation
swarmBroadcast.tokenCreated('ABC123...', 0.5);

// Record a trade
swarmBroadcast.trade('buy', 0.5, 42);

// Broadcast metrics update
swarmBroadcast.metrics({
  budget: 10.0,
  spent: 2.5,
  pnl: 0.3,
  roi: 6.4,
  trades: 47,
  agents: 5,
  phase: 'TRADING',
  elapsed: '5:34',
});
```

## Event Flow

```
PresentationMode
    ↓
swarmBroadcast.narration()
    ↓
swarmEventManager.broadcastNarration()
    ↓
GET /api/swarm/events
    ↓
useSwarmMonitor hook
    ↓
SwarmMonitor component (UI updates)
```

## Configuration

### Environment Variables

```env
# Required for presentation narration
NEXT_PUBLIC_OPENROUTER_API_KEY=your_api_key_here

# Optional: customize default settings
NEXT_PUBLIC_SWARM_DURATION_MINUTES=5
NEXT_PUBLIC_SWARM_BUDGET_SOL=10
```

### Hook Configuration

Customize polling interval in `useSwarmMonitor.ts`:

```typescript
const interval = setInterval(async () => {
  // Polling frequency: default 1000ms
}, 1000);
```

## Metrics Schema

```typescript
interface SwarmMetrics {
  budget: number;      // Total SOL budget
  spent: number;       // SOL spent so far
  pnl: number;         // Profit/Loss in SOL
  roi: number;         // Return on investment %
  trades: number;      // Total trades executed
  agents: number;      // Active agents
  phase: string;       // Current phase (INITIALIZING, MINTING, TRADING, etc.)
  elapsed: string;     // Elapsed time (MM:SS format)
}
```

## Event Types

- `narration` — AI-generated commentary
- `trade` — Trade execution
- `token-created` — Token minting
- `graduated` — Token graduated to AMM
- `wallet` — Wallet generation
- `strategy` — Strategy decision made
- `error` — Error occurred
- `completed` — Session completed

## Real-time Connection

The monitor uses a two-tier approach:

1. **Primary**: Server-Sent Events (SSE) for true real-time updates
2. **Fallback**: Polling every 1 second if SSE unavailable

Auto-reconnection with exponential backoff:
- Initial retry: 3 seconds
- Retries: every 3 seconds until connected

## Performance

- Lightweight event stream (~50 bytes per message)
- Supports 100+ concurrent clients
- Events stored for last 50 entries
- Automatic cleanup of disconnected clients

## Browser Support

- Chrome/Edge 13+
- Firefox 11+
- Safari 5.1+
- Requires JavaScript enabled

## Integration with Pump Agent Swarm

To connect your swarm presentation to the dashboard:

```typescript
import { PresentationMode } from '@/lib/dashboard-presentation';
import { swarmBroadcast } from '@/lib/dashboard-presentation';

const presenter = new PresentationMode({
  openRouterApiKey: process.env.OPENROUTER_API_KEY!,
  audience: 'investor',
  presenterName: 'Alice',
});

// Hook into swarm events
swarm.on('token:created', (result) => {
  swarmBroadcast.tokenCreated(result.mint, 0.5);
});

swarm.on('trade:executed', (result) => {
  swarmBroadcast.trade(result.order.direction, 0.5, this.tradeCount++);
});

// Run and stream to dashboard
const summary = await presenter.runPresentation();
```

## Troubleshooting

### Not receiving events?

1. Check browser DevTools → Network → WebSocket/EventSource
2. Verify OpenRouter API key is set
3. Check `/api/swarm/status` returns data
4. Try hard refresh: Cmd+Shift+R / Ctrl+Shift+F5

### Events arriving slowly?

1. Check network latency (DevTools → Network → Timing)
2. Monitor server CPU usage
3. Check if polling fallback is active
4. Reduce event size or frequency

### Connection keeps dropping?

1. Check browser console for errors
2. Verify CORS headers in API routes
3. Check server logs for exceptions
4. Increase SSE client timeout in hook

## Next Steps

- [ ] Add persistence (save swarm sessions)
- [ ] Export session reports (JSON, PDF)
- [ ] Replay historical sessions
- [ ] Metrics export (CSV, JSON)
- [ ] Webhook integration for external logging
- [ ] Mobile-responsive improvements
- [ ] WebSocket upgrade for even lower latency

## License

Part of the Crypto Vision project. See project LICENSE for details.
