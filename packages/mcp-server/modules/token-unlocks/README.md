# Token Unlock & Vesting Schedule Tracker

A comprehensive module for tracking token unlock events, vesting schedules, and analyzing their potential market impact.

## 🎯 Features

- **Track Token Unlock Events** - Monitor upcoming token unlocks across multiple projects
- **Vesting Schedule Management** - Define and manage complex vesting schedules with cliff periods and linear vesting
- **Market Impact Analysis** - Analyze potential price impact of unlock events based on multiple factors
- **Calendar View** - View all unlock events in a calendar format
- **Smart Alerts** - Get notified about significant upcoming unlocks
- **Search & Filter** - Find specific unlock events with powerful filtering
- **Comprehensive Analytics** - Get detailed vesting statistics and analytics for any project

## 📦 Installation

This module is part of the Universal Crypto MCP server. No separate installation required.

## 🚀 Quick Start

### Using MCP Tools

```typescript
// List tracked projects
await client.callTool('unlock_list_projects', {});

// Get upcoming unlocks for a project
await client.callTool('unlock_get_upcoming', {
  projectId: 'arbitrum',
  limit: 10
});

// Analyze market impact
await client.callTool('unlock_market_impact', {
  projectId: 'arbitrum'
});

// Get alerts
await client.callTool('unlock_get_alerts', {
  includeAcknowledged: false
});
```

### Using the Tracker Directly

```typescript
import { createUnlockTracker } from './modules/token-unlocks';

// Create tracker
const tracker = createUnlockTracker({
  alertThresholds: {
    minUnlockPercentage: 5,
    daysBeforeAlert: 7,
    minMarketCapForAlert: 10_000_000,
  },
});

// Add a project
tracker.addProject({
  id: 'my-token',
  name: 'My Token',
  symbol: 'MTK',
  chain: 'ethereum',
  tokenAddress: '0x...',
  totalSupply: '1000000000',
  circulatingSupply: '250000000',
  launchDate: new Date('2024-01-01'),
});

// Add vesting schedule
tracker.addVestingSchedule({
  id: 'mtk-team',
  projectId: 'my-token',
  beneficiaryType: 'team',
  totalTokens: '200000000',
  cliffDuration: 365, // 1 year cliff
  vestingDuration: 1461, // 4 years total
  vestingStart: new Date('2024-01-01'),
  vestingEnd: new Date('2028-01-01'),
  initialUnlock: '0',
  linearVesting: true,
});

// Get upcoming unlocks
const unlocks = tracker.getUpcomingUnlocks('my-token');

// Get market impact analysis
const analysis = tracker.getMarketImpactAnalysis('my-token');

// Get vesting analytics
const analytics = tracker.getVestingAnalytics('my-token');
```

## 🛠️ Available MCP Tools

### `unlock_add_project`
Add a new token project to track for unlock events.

**Parameters:**
- `id` - Unique project identifier
- `name` - Project name
- `symbol` - Token symbol
- `chain` - Blockchain network
- `tokenAddress` - Token contract address
- `totalSupply` - Total token supply
- `circulatingSupply` - Current circulating supply
- `marketCap` (optional) - Market capitalization in USD
- `currentPrice` (optional) - Current token price in USD
- `launchDate` - Token launch date (ISO format)

### `unlock_add_schedule`
Add a vesting schedule for a tracked project.

**Parameters:**
- `projectId` - Project ID this schedule belongs to
- `beneficiaryType` - Type of beneficiary (team, investors, advisors, foundation, ecosystem, community, partners)
- `totalTokens` - Total tokens in this schedule
- `cliffDuration` - Cliff duration in days
- `vestingDuration` - Total vesting duration in days
- `vestingStart` - Vesting start date (ISO format)
- `initialUnlock` - Tokens unlocked at TGE (default: "0")

### `unlock_get_upcoming`
Get upcoming token unlock events for a project.

**Parameters:**
- `projectId` - Project ID to query
- `limit` (optional) - Maximum number of events to return

### `unlock_get_calendar`
Get unlock events calendar for a date range across all projects.

**Parameters:**
- `startDate` - Start date (ISO format)
- `endDate` - End date (ISO format)

### `unlock_market_impact`
Analyze potential market impact of upcoming unlocks for a project.

**Parameters:**
- `projectId` - Project ID to analyze

### `unlock_search`
Search for unlock events with filters.

**Parameters:**
- `startDate` (optional) - Filter by start date
- `endDate` (optional) - Filter by end date
- `beneficiaryTypes` (optional) - Filter by beneficiary types
- `projectIds` (optional) - Filter by project IDs
- `chains` (optional) - Filter by blockchain networks
- `riskLevels` (optional) - Filter by risk levels (low, medium, high, critical)

### `unlock_vesting_analytics`
Get comprehensive vesting analytics for a project.

**Parameters:**
- `projectId` - Project ID to analyze

### `unlock_get_alerts`
Get active vesting unlock alerts.

**Parameters:**
- `includeAcknowledged` - Include acknowledged alerts (default: false)

### `unlock_list_projects`
List all tracked token projects.

**Parameters:** None

### `unlock_tracker_stats`
Get overall tracker statistics and summary.

**Parameters:** None

## 📊 Market Impact Analysis

The tracker analyzes multiple factors to assess the potential market impact of unlock events:

- **Unlock Size** - Percentage of circulating supply being unlocked
- **Liquidity Ratio** - Trading volume vs unlock amount
- **Historical Volatility** - Past price volatility patterns
- **Market Sentiment** - Overall market and project sentiment
- **Hodl Probability** - Likelihood tokens won't be sold immediately (based on beneficiary type)

### Risk Levels

- **Low** (Impact Score < 30) - Minor unlock with minimal expected impact
- **Medium** (30-60) - Moderate unlock, some volatility expected
- **High** (60-80) - Significant unlock, high volatility likely
- **Critical** (> 80) - Major unlock event, extreme caution advised

## 🎨 Use Cases

### For Investors
```typescript
// Monitor your portfolio holdings
const analytics = tracker.getVestingAnalytics('my-token');
console.log(`Next unlock: ${analytics.statistics.nextUnlockDate}`);
console.log(`Amount: ${analytics.statistics.nextUnlockAmount}`);

// Get alerts for significant events
const alerts = tracker.getAlerts();
alerts.forEach(alert => {
  if (alert.severity === 'critical') {
    console.log(`⚠️ ${alert.message}`);
  }
});
```

### For Traders
```typescript
// Find high-risk unlock events
const results = tracker.searchUnlocks({
  riskLevels: ['high', 'critical'],
  startDate: new Date(),
  endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // next 30 days
});

// Analyze market impact
results.forEach(event => {
  const project = tracker.getProject(event.projectId);
  const analysis = analyzeMarketImpact(event, project);
  console.log(`${project.name}: ${analysis.riskLevel} risk`);
  console.log(`Estimated impact: ${analysis.estimatedPriceImpact.neutral}`);
});
```

### For Researchers
```typescript
// Get calendar view
const calendar = tracker.getUnlockCalendar(
  new Date('2025-01-01'),
  new Date('2025-12-31')
);

calendar.forEach(day => {
  console.log(`${day.date}: ${day.eventsCount} events, ${day.projectsAffected} projects`);
});

// Track vesting progress
const stats = calculateVestingStatistics(project, schedules, unlockEvents);
console.log(`Vesting ${stats.percentageVested}% complete`);
console.log(`${stats.unlockFrequency} unlock frequency`);
```

## 🔧 Configuration

```typescript
const tracker = createUnlockTracker({
  alertThresholds: {
    minUnlockPercentage: 5,      // Alert if > 5% of supply
    daysBeforeAlert: 7,            // Alert 7 days before
    minMarketCapForAlert: 10_000_000, // Only for projects > $10M
  },
  priceDataSource: 'coingecko',   // Price data source
  refreshInterval: 60,             // Refresh every 60 minutes
  enableNotifications: true,       // Enable alerts
});
```

## 📝 Types

### TokenProject
```typescript
interface TokenProject {
  id: string;
  name: string;
  symbol: string;
  chain: string;
  tokenAddress: string;
  totalSupply: string;
  circulatingSupply: string;
  marketCap?: string;
  currentPrice?: string;
  launchDate: Date;
  vestingContract?: string;
}
```

### VestingSchedule
```typescript
interface VestingSchedule {
  id: string;
  projectId: string;
  beneficiaryType: 'team' | 'investors' | 'advisors' | 'foundation' | 'ecosystem' | 'community' | 'partners';
  totalTokens: string;
  cliffDuration: number;
  cliffEnd: Date | null;
  vestingDuration: number;
  vestingStart: Date;
  vestingEnd: Date;
  initialUnlock: string;
  linearVesting: boolean;
}
```

### UnlockEvent
```typescript
interface UnlockEvent {
  id: string;
  projectId: string;
  scheduleId: string;
  date: Date;
  tokensUnlocked: string;
  percentageOfTotal: number;
  percentageOfCirculating: number;
  beneficiaryType: string;
  estimatedValue?: string;
  isCliffEvent: boolean;
}
```

## 🎯 Example: Tracking Arbitrum ARB

```typescript
// The tracker comes pre-loaded with Arbitrum ARB as an example

// Get upcoming unlocks
const unlocks = tracker.getUpcomingUnlocks('arbitrum', 5);

// Analyze market impact
const analysis = tracker.getMarketImpactAnalysis('arbitrum');
analysis.forEach(a => {
  console.log(`Date: ${a.unlockEvent.date.toISOString()}`);
  console.log(`Risk: ${a.riskLevel}`);
  console.log(`Impact Score: ${a.impactScore}/100`);
  console.log(`Recommendations:`);
  a.recommendations.forEach(r => console.log(`  - ${r}`));
});

// Get full analytics
const analytics = tracker.getVestingAnalytics('arbitrum');
console.log(`Total vested: ${analytics.statistics.totalVested}`);
console.log(`Total unlocked: ${analytics.statistics.totalUnlocked}`);
console.log(`Team tokens remaining: ${analytics.teamTokensRemaining}`);
console.log(`Investor tokens remaining: ${analytics.investorTokensRemaining}`);
```

## 🚀 Future Enhancements

- Integration with on-chain vesting contracts
- Real-time price data integration
- Social sentiment analysis
- Historical unlock impact analysis
- Automated trading strategies based on unlocks
- Multi-chain support expansion
- Email/Discord/Telegram notifications

## 📄 License

Apache 2.0 - See LICENSE file for details

## 👨‍💻 Credits

Built as part of Universal Crypto MCP by **[nich](https://x.com/nichxbt)** ([github.com/nirholas](https://github.com/nirholas))
