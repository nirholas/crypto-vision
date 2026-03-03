<!-- universal-crypto-mcp | nicholas | 0.14.9.3 -->

# 🏪 Tool Marketplace - Decentralized AI Tool Store

<!-- Maintained by nich.xbt | ID: 1489314938 -->

> The "App Store" for AI agents where tools cost crypto

Build and monetize AI tools that can be discovered and paid for automatically using x402 payments.

## Quick Start

### Register a Tool

```typescript
import { toolRegistry } from "@/modules/tool-marketplace"

// Register your tool in the marketplace
const tool = await toolRegistry.registerTool({
  name: "weather-premium",
  displayName: "Premium Weather API",
  description: "Real-time weather with 1-hour forecasts",
  endpoint: "https://weather.example.com/api",
  category: "data",
  pricing: {
    model: "per-call",
    basePrice: "0.001", // $0.001 per call
    acceptedTokens: ["USDs"],
    supportedChains: ["arbitrum"],
  },
  owner: "0xYourAddress...",
  revenueSplit: [
    { address: "0xYourAddress...", percent: 80, label: "creator" },
    { address: "0xPlatform...", percent: 20, label: "platform" },
  ],
  tags: ["weather", "forecast", "real-time"],
})

console.log(`Tool registered: ${tool.toolId}`)
```

### Discover Tools

```typescript
// Find affordable AI tools
const tools = await toolRegistry.discoverTools({
  maxPrice: "0.01",        // Max $0.01 per call
  category: "data",        // Data tools only
  minRating: 4,            // 4+ stars
  sortBy: "popularity",
  limit: 10,
})

tools.forEach(tool => {
  console.log(`${tool.name}: $${tool.pricing.basePrice}/call`)
})
```

### Use a Paid Tool

```typescript
import { createMarketplaceClient } from "@/modules/tool-marketplace"
import { X402Client } from "@/x402/sdk/client"

// Create x402 payment client
const x402 = new X402Client({
  chain: "arbitrum",
  privateKey: process.env.PRIVATE_KEY as `0x${string}`,
})

// Create marketplace client
const marketplace = createMarketplaceClient({
  userAddress: await x402.getAddress(),
  defaultMaxPayment: "0.10",
  x402Client: x402,
})

// Call a paid tool
const result = await marketplace.callTool({
  tool: "weather-premium",
  path: "/forecast?city=NYC",
  maxPayment: "0.01",
})

if (result.success) {
  console.log(`Data: ${JSON.stringify(result.data)}`)
  console.log(`Paid: $${result.amountPaid}`)
  console.log(`Tx: ${result.txHash}`)
}
```

## MCP Tools Reference

| Tool | Description |
|------|-------------|
| `marketplace_register_tool` | Register a new tool |
| `marketplace_update_tool` | Update tool settings |
| `marketplace_pause_tool` | Pause a tool |
| `marketplace_activate_tool` | Reactivate a tool |
| `marketplace_discover_tools` | Search for tools |
| `marketplace_get_tool` | Get tool details |
| `marketplace_tool_revenue` | Check revenue |
| `marketplace_creator_analytics` | Creator dashboard |
| `marketplace_stats` | Marketplace overview |
| `marketplace_usage_history` | Usage records |
| `marketplace_recent_events` | Recent activity |

## Pricing Models

### Per-Call (Default)
Pay for each API call:
```typescript
pricing: {
  model: "per-call",
  basePrice: "0.001",
  acceptedTokens: ["USDs"],
  supportedChains: ["arbitrum"],
}
```

### Subscription
Monthly subscription with included calls:
```typescript
pricing: {
  model: "subscription",
  subscriptionTiers: [
    {
      name: "basic",
      monthlyPrice: "0.99",
      callsIncluded: 1000,
      features: ["Basic access"],
    },
    {
      name: "pro",
      monthlyPrice: "9.99",
      callsIncluded: 10000,
      overagePrice: "0.0005",
      features: ["Priority support", "Advanced features"],
    },
  ],
  acceptedTokens: ["USDs"],
  supportedChains: ["arbitrum"],
}
```

### Freemium
Free tier with paid premium:
```typescript
pricing: {
  model: "freemium",
  basePrice: "0.001",
  freeCallsPerDay: 100,
  acceptedTokens: ["USDs"],
  supportedChains: ["arbitrum"],
}
```

### Tiered
Volume discounts:
```typescript
pricing: {
  model: "tiered",
  tieredPricing: {
    tiers: [
      { minCalls: 0, maxCalls: 100, pricePerCall: "0.01" },
      { minCalls: 101, maxCalls: 1000, pricePerCall: "0.005" },
      { minCalls: 1001, maxCalls: Infinity, pricePerCall: "0.001" },
    ],
  },
  acceptedTokens: ["USDs"],
  supportedChains: ["arbitrum"],
}
```

## Revenue Splits

Define how revenue is distributed:

```typescript
revenueSplit: [
  { address: "0xCreator...", percent: 70, label: "creator" },
  { address: "0xReferrer...", percent: 10, label: "referrer" },
  { address: "0xPlatform...", percent: 20, label: "platform" },
]
// Must total 100%
```

## Creator Analytics

Track your earnings:

```typescript
import { toolRegistry, revenueSplitter } from "@/modules/tool-marketplace"

// Get comprehensive analytics
const analytics = await toolRegistry.getCreatorAnalytics("0xYourAddress...")

console.log(`Total Revenue: $${analytics.totalRevenue}`)
console.log(`Total Calls: ${analytics.totalCalls}`)
console.log(`Tools Owned: ${analytics.toolsOwned}`)

// Check pending payouts
const payouts = await revenueSplitter.calculateCreatorPayouts("0xYourAddress...")
console.log(`Pending: $${payouts.totalPending}`)
```

## Integration Examples

### Lyra Registry Integration
Enhance existing tool catalogs with pricing:

```typescript
// Import tools from lyra-registry
const lyraTools = await fetchLyraRegistry()

// Add pricing to each tool
for (const tool of lyraTools) {
  await toolRegistry.registerTool({
    name: tool.name,
    displayName: tool.displayName,
    description: tool.description,
    endpoint: tool.endpoint,
    category: mapLyraCategory(tool.category),
    pricing: {
      model: "per-call",
      basePrice: suggestPrice(tool),
      acceptedTokens: ["USDs"],
      supportedChains: ["arbitrum"],
    },
    owner: tool.author,
    revenueSplit: [
      { address: tool.author, percent: 80 },
      { address: PLATFORM_ADDRESS, percent: 20 },
    ],
  })
}
```

### Notification Service (mcp-notify)
Premium notification tiers:

```typescript
await toolRegistry.registerTool({
  name: "mcp-notify-premium",
  displayName: "Premium Notifications",
  description: "Real-time alerts for crypto events",
  endpoint: "https://notify.example.com/api",
  category: "notifications",
  pricing: {
    model: "subscription",
    subscriptionTiers: [
      {
        name: "basic",
        monthlyPrice: "0.01",
        callsIncluded: 100,
        features: ["Email alerts"],
      },
      {
        name: "pro",
        monthlyPrice: "0.05",
        callsIncluded: 1000,
        features: ["Email + Push", "Custom webhooks"],
      },
    ],
    acceptedTokens: ["USDs"],
    supportedChains: ["arbitrum"],
  },
  owner: "0x...",
  revenueSplit: [
    { address: "0x...", percent: 80 },
    { address: "0x...", percent: 20 },
  ],
})
```

## Categories

| Category | Description |
|----------|-------------|
| `data` | APIs providing data (weather, prices, etc.) |
| `ai` | AI/ML services (text generation, vision, etc.) |
| `defi` | DeFi tools (swap quotes, yield, etc.) |
| `analytics` | Analytics and insights |
| `social` | Social media tools |
| `utilities` | General utilities |
| `notifications` | Alert and notification services |
| `storage` | Storage and file services |
| `compute` | Compute and processing |
| `other` | Other tools |

## Best Practices

1. **Price competitively** - Check similar tools with `marketplace_discover_tools`
2. **Start with freemium** - Offer free tier to build user base
3. **Document your API** - Include `docsUrl` for better adoption
4. **Use descriptive tags** - Help users find your tool
5. **Monitor analytics** - Track revenue and optimize pricing
6. **Maintain uptime** - Users trust reliable tools with high uptime
7. **Respond to feedback** - Improve based on user ratings

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   AI Agent (Claude)                      │
├─────────────────────────────────────────────────────────┤
│  marketplace_discover_tools → Find tools                 │
│  marketplace_get_tool → Get details + price              │
│  x402_pay_request → Pay + call endpoint                  │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│               Tool Marketplace Registry                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   Tools     │  │   Usage     │  │  Revenue    │     │
│  │  Database   │  │  Tracking   │  │  Splitting  │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                 x402 Payment Layer                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   USDs      │  │  Payment    │  │   Revenue   │     │
│  │  Payments   │  │   Proofs    │  │   Payouts   │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                  Tool Creator APIs                       │
│  Weather API │ AI Service │ Analytics │ Notifications   │
└─────────────────────────────────────────────────────────┘
```

## Future Roadmap

- [ ] On-chain tool registry (ToolRegistry.sol)
- [ ] Automated weekly payouts
- [ ] Tool verification/audit badges
- [ ] Dispute resolution system
- [ ] API key management
- [ ] Rate limiting per user
- [ ] Multi-chain support (Base, Optimism)
- [ ] NFT-gated tool access

## License

Apache-2.0


<!-- EOF: nicholas | ucm:0.14.9.3 -->
<!-- https://github.com/nirholas/universal-crypto-mcp -->