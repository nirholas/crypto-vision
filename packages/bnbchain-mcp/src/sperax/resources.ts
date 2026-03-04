/**
 * Sperax MCP Server - Resources
 *
 * Protocol documentation and contract references as MCP resources
 */

import { CONTRACTS, COLLATERALS } from './config.js';

// ============================================================================
// Protocol Constants (for documentation)
// ============================================================================

const PROTOCOL_CONSTANTS = {
  MIN_LOCK_DAYS: 7,
  MAX_LOCK_DAYS: 1460,
  MIN_VESTING_DAYS: 15,
  MAX_VESTING_DAYS: 180,
} as const;

// ============================================================================
// Documentation Resources
// ============================================================================

export const PROTOCOL_OVERVIEW = `# Sperax Protocol Overview

## What is Sperax?

Sperax is a DeFi protocol on Arbitrum One featuring **USDs**, an auto-yield stablecoin that generates ~5% APY for holders automatically.

## Core Components

### 1. USDs - Auto-Yield Stablecoin
- Pegged 1:1 to USD
- Backed by USDC, USDC.e, USDT, DAI, FRAX
- **70% of yield** goes to USDs holders via auto-rebase
- No claiming required - balance increases automatically

### 2. SPA - Governance Token
- Used for protocol governance
- **30% of yield** used for SPA buyback & burn
- Deflationary mechanics via constant buying pressure

### 3. veSPA - Vote-Escrowed SPA
- Lock SPA for 7 days to 4 years
- Get voting power proportional to lock time
- Formula: \`veSPA = SPA × (lockDays / 365)\`

### 4. xSPA - Reward Token
- Earned from staking/farming
- Redeem for SPA with 15-180 day vesting
- Longer vest = more SPA (50% to 100%)

### 5. Demeter - Yield Farms
- No-code farm deployment
- Create farms for any LP token
- 100 USDs creation fee

## How USDs Generates Yield

1. Users deposit stablecoins (USDC, USDT, DAI, FRAX)
2. Collateral deployed to yield strategies (Aave, Compound, Stargate)
3. Yield collected daily
4. 70% distributed to USDs holders via rebase
5. 30% used to buy and burn SPA

## Key Addresses

| Contract | Address |
|----------|---------|
| USDs | \`${CONTRACTS.USDS}\` |
| SPA | \`${CONTRACTS.SPA}\` |
| veSPA | \`${CONTRACTS.VESPA}\` |
| Vault | \`${CONTRACTS.VAULT}\` |

## Links

- Website: https://sperax.io
- Docs: https://docs.sperax.io
- Discord: https://discord.gg/sperax
- Twitter: https://twitter.com/SperaxUSD
`;

export const USDS_DOCUMENTATION = `# USDs - Sperax Auto-Yield Stablecoin

## Overview

USDs is a decentralized stablecoin that automatically generates yield for holders. Unlike traditional stablecoins, USDs balance increases daily without any action required.

## Key Features

✅ **Auto-Yield**: ~5% APY distributed via daily rebase
✅ **1:1 Peg**: Backed by USDC, USDT, DAI, FRAX
✅ **No Claiming**: Yield appears in your wallet automatically
✅ **Fully Collateralized**: 100%+ collateral backing

## How It Works

### Minting USDs
1. Deposit supported stablecoin (USDC, USDT, DAI, FRAX)
2. Receive USDs 1:1 (minus small fee)
3. Start earning yield immediately

### Redeeming USDs
1. Burn USDs
2. Receive underlying stablecoin
3. Small redemption fee applies

### Rebase Mechanism

USDs uses a **credit system** for rebasing:

\`\`\`
balance = credits / creditsPerToken
\`\`\`

When yield is distributed:
1. Protocol decreases \`creditsPerToken\`
2. Same credits = higher balance
3. Your USDs balance increases!

### Rebase States

| State | Description |
|-------|-------------|
| **NotSet** | Default - EOAs receive rebases, contracts don't |
| **OptIn** | Explicitly receiving rebases |
| **OptOut** | Not receiving rebases (balance stays constant) |

## Yield Sources

USDs yield comes from deploying collateral to DeFi:

- **Aave** - Lending protocol
- **Compound** - Lending protocol  
- **Stargate** - Cross-chain bridging

## Yield Distribution

| Recipient | Share |
|-----------|-------|
| USDs Holders | 70% |
| SPA Buyback | 30% |

## Supported Collaterals

${Object.entries(COLLATERALS).map(([_, col]) => 
  `- **${col.symbol}** (${col.decimals} decimals): \`${col.address}\``
).join('\n')}

## Smart Contracts

- USDs Token: \`${CONTRACTS.USDS}\`
- Vault: \`${CONTRACTS.VAULT}\`
- RebaseManager: \`${CONTRACTS.REBASE_MANAGER}\`
- Dripper: \`${CONTRACTS.DRIPPER}\`
`;

export const STAKING_DOCUMENTATION = `# Sperax Staking Guide

## veSPA - Vote-Escrowed SPA

### What is veSPA?

veSPA represents locked SPA tokens. Lock your SPA to gain:
- 🗳️ Governance voting power
- 🎁 Protocol fee sharing (future)
- ⚡ Boosted farming rewards (future)

### Lock Parameters

| Parameter | Value |
|-----------|-------|
| Minimum Lock | 7 days |
| Maximum Lock | 4 years (1460 days) |
| Early Unlock | Not possible |

### Voting Power Formula

\`\`\`
veSPA = SPA × (lockDays / 365)
\`\`\`

#### Examples

| Lock Duration | 1000 SPA = |
|---------------|------------|
| 7 days | 19.2 veSPA |
| 1 year | 1000 veSPA |
| 2 years | 2000 veSPA |
| 4 years | 4000 veSPA |

### Power Decay

Your voting power decreases linearly as unlock time approaches:
- Day 1 of 4-year lock: Maximum power
- Day 730 (2 years left): 50% of original power
- Day 1460 (unlock): 0 power

### Actions

- **Create Lock**: Lock SPA for chosen duration
- **Increase Amount**: Add more SPA to existing lock
- **Increase Time**: Extend lock duration
- **Withdraw**: Only after lock expires

---

## xSPA - Reward Token

### What is xSPA?

xSPA is earned from:
- Staking rewards
- Farming incentives
- Protocol distributions

### Redemption Mechanics

Convert xSPA to SPA with a vesting period:

\`\`\`
SPA_out = xSPA × (vestingDays + 150) / 330
\`\`\`

### Redemption Ratios

| Vesting Period | SPA Received |
|----------------|--------------|
| 15 days (min) | 50% |
| 30 days | 54.5% |
| 60 days | 63.6% |
| 90 days | 72.7% |
| 120 days | 81.8% |
| 150 days | 90.9% |
| 180 days (max) | 100% |

### Strategy Tips

- **Impatient**: 15-day vest for quick liquidity (lose 50%)
- **Balanced**: 90-day vest for ~73% return
- **Optimal**: 180-day vest for full value

## Contract Addresses

| Contract | Address |
|----------|---------|
| veSPA | \`${CONTRACTS.VESPA}\` |
| xSPA | \`${CONTRACTS.XSPA}\` |
| SPA | \`${CONTRACTS.SPA}\` |
`;

export const DEMETER_DOCUMENTATION = `# Demeter - No-Code Yield Farms

## Overview

Demeter is Sperax's permissionless yield farming protocol. Anyone can create farms for any token pair.

## Key Features

✅ **No-Code Deployment**: Create farms without coding
✅ **Flexible Rewards**: Any ERC20 as reward token
✅ **Custom Duration**: Set your own reward schedule
✅ **Fair Distribution**: APR-based reward calculation

## Creating a Farm

### Requirements
- 100 USDs creation fee
- LP token to stake
- Reward tokens to distribute
- Duration for reward period

### Process
1. Connect wallet
2. Select LP token
3. Choose reward token
4. Set reward amount & duration
5. Pay creation fee
6. Farm is live!

## Farm Mechanics

### Reward Distribution

Rewards distributed per second based on:

\`\`\`
userRewardPerSecond = (totalRewardRate × userStaked) / totalStaked
\`\`\`

### APR Calculation

\`\`\`
APR = (rewardRate × secondsPerYear × rewardPrice) / (totalStaked × lpPrice) × 100
\`\`\`

## Rewarder System

Each farm has a **Rewarder** contract:
- Holds reward tokens
- Calculates earned amounts
- Handles claims

### Rewarder Types

| Type | Description |
|------|-------------|
| SingleRewarder | One reward token |
| DualRewarder | Two reward tokens |
| CustomRewarder | Advanced logic |

## User Actions

### Staking
1. Approve LP token
2. Call \`stake(amount)\`
3. Start earning rewards

### Claiming
1. Call \`getReward()\`
2. Receive pending rewards
3. Continue earning

### Unstaking
1. Call \`withdraw(amount)\`
2. Receive LP tokens back
3. Any pending rewards also claimed

## Contract Addresses

| Contract | Address |
|----------|---------|
| Farm Registry | \`${CONTRACTS.FARM_REGISTRY}\` |
| Rewarder Factory | \`${CONTRACTS.REWARDER_FACTORY}\` |
| Farm Deployer | \`${CONTRACTS.FARM_DEPLOYER}\` |

## Tips

- 🔍 Check farm end date before staking
- 💰 Consider gas costs vs rewards
- ⚠️ APR can change as TVL changes
- 🔄 Compound regularly for best returns
`;

export const FORMULAS_DOCUMENTATION = `# Sperax Protocol Formulas

## veSPA Voting Power

\`\`\`
veSPA = SPA × (lockDays / 365)
\`\`\`

**Constraints:**
- Minimum: ${PROTOCOL_CONSTANTS.MIN_LOCK_DAYS} days
- Maximum: ${PROTOCOL_CONSTANTS.MAX_LOCK_DAYS} days (4 years)

**Example:**
- 1000 SPA locked for 2 years (730 days)
- veSPA = 1000 × (730 / 365) = 2000 veSPA

---

## xSPA to SPA Redemption

\`\`\`
SPA_out = xSPA × (vestingDays + 150) / 330
\`\`\`

**Constraints:**
- Minimum: ${PROTOCOL_CONSTANTS.MIN_VESTING_DAYS} days → 50% ratio
- Maximum: ${PROTOCOL_CONSTANTS.MAX_VESTING_DAYS} days → 100% ratio

**Example:**
- 1000 xSPA with 90-day vest
- SPA = 1000 × (90 + 150) / 330 = 727.27 SPA

---

## USDs Rebase Balance

\`\`\`
balance = credits / creditsPerToken
\`\`\`

When yield is distributed, \`creditsPerToken\` decreases, making existing credits worth more USDs.

**Example:**
- Start: 1000 credits, creditsPerToken = 1.0 → 1000 USDs
- After rebase: 1000 credits, creditsPerToken = 0.99 → 1010.1 USDs

---

## Daily Yield Calculation

\`\`\`
dailyYield = principal × (APR / 100) / 365
\`\`\`

**Example:**
- $10,000 USDs at 5% APR
- dailyYield = 10000 × 0.05 / 365 = $1.37/day

---

## Farm APR

\`\`\`
APR = (rewardRate × secondsPerYear × rewardPrice) / (totalStaked × lpPrice) × 100
\`\`\`

Where:
- rewardRate = tokens per second
- secondsPerYear = 31,536,000

---

## Collateral Ratio

\`\`\`
ratio = totalCollateralValue / totalUSdsSupply
\`\`\`

Target: ≥ 100% (fully collateralized)
`;

// ============================================================================
// Vault Documentation
// ============================================================================

export const VAULT_DOCUMENTATION = `# Sperax Vault System

## Overview

The Vault is the core contract managing USDs collateral and yield strategies.

## Architecture

\`\`\`
┌─────────────────────────────────────────────┐
│                   VAULT                      │
├─────────────────────────────────────────────┤
│  Collateral Pool                            │
│  ├── USDC (~40%)                            │
│  ├── USDT (~30%)                            │
│  ├── DAI  (~20%)                            │
│  └── FRAX (~10%)                            │
├─────────────────────────────────────────────┤
│  Strategy Allocations                        │
│  ├── Aave V3      → USDC, USDT              │
│  ├── Compound V3  → USDC                    │
│  ├── Stargate     → USDC, USDT              │
│  └── Curve        → 3pool                   │
├─────────────────────────────────────────────┤
│  Yield Distribution                          │
│  ├── 70% → USDs Holders (via Dripper)       │
│  └── 30% → SPA Buyback & Burn               │
└─────────────────────────────────────────────┘
\`\`\`

## Collateral Management

### Supported Collaterals
| Token | Min Allocation | Max Allocation | Oracle |
|-------|---------------|----------------|--------|
| USDC  | 30%           | 50%            | Chainlink |
| USDT  | 20%           | 40%            | Chainlink |
| DAI   | 10%           | 30%            | Chainlink |
| FRAX  | 5%            | 20%            | Chainlink |

### Minting Process
1. User deposits collateral
2. Vault receives collateral
3. Oracle price fetched
4. Mint fee deducted (0.1%)
5. USDs minted to user
6. Collateral deployed to strategies

### Redemption Process
1. User burns USDs
2. Redemption fee deducted (0.2%)
3. Collateral withdrawn from strategies (if needed)
4. User receives collateral

## Strategy Management

Strategies are yield-generating contracts deployed on DeFi protocols.

### Strategy Lifecycle
1. **Proposal**: Governance proposes new strategy
2. **Audit**: Strategy audited for security
3. **Approval**: Governance votes to approve
4. **Deployment**: Strategy deployed with allocation limits
5. **Monitoring**: Continuous performance monitoring
6. **Harvesting**: Yield collected regularly

### Risk Parameters
- Max allocation per strategy: 30%
- Max allocation per protocol: 50%
- Minimum diversity: 3 strategies active

## Rebalancing

Vault automatically rebalances to maintain target allocations:

\`\`\`
if (currentAllocation > targetAllocation + 5%) {
  // Withdraw from over-allocated strategy
  // Deploy to under-allocated strategy
}
\`\`\`

## Security Features

- **Timelock**: All parameter changes delayed 48h
- **Guardian**: Emergency pause capability
- **Oracle redundancy**: Multiple price sources
- **Circuit breakers**: Auto-pause on anomalies
`;

// ============================================================================
// Yield Reserve Documentation
// ============================================================================

export const YIELD_RESERVE_DOCUMENTATION = `# Sperax Yield Reserve

## Overview

The Yield Reserve is the central hub that collects yield from all strategies and distributes it to USDs holders (via Dripper) and SPA Buyback.

## Architecture

\`\`\`
┌─────────────────────────────────────────────────────────────┐
│                     YIELD STRATEGIES                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │  Aave    │ │ Compound │ │ Stargate │ │  Fluid   │       │
│  │  V3      │ │   V3     │ │          │ │          │       │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘       │
│       │            │            │            │               │
│       └────────────┴────────────┴────────────┘               │
│                         │ harvest()                          │
│                         ▼                                    │
│  ┌─────────────────────────────────────────────────┐        │
│  │              YIELD RESERVE                        │        │
│  │  - Receives yield tokens                         │        │
│  │  - Swaps to USDs via oracle prices               │        │
│  │  - Splits yield 70/30                            │        │
│  └───────────────────┬───────────────────────┘        │
│                      │                                │
│         ┌────────────┴────────────┐                   │
│         ▼                         ▼                   │
│  ┌──────────────┐         ┌──────────────┐           │
│  │   DRIPPER    │         │ SPA BUYBACK  │           │
│  │   (70%)      │         │    (30%)     │           │
│  └──────┬───────┘         └──────┬───────┘           │
│         │                        │                    │
│         ▼                        ▼                    │
│  ┌──────────────┐         ┌──────────────┐           │
│  │ USDs Holders │         │  SPA Burn    │           │
│  │ Auto-Rebase  │         │  Deflationary│           │
│  └──────────────┘         └──────────────┘           │
└─────────────────────────────────────────────────────────────┘
\`\`\`

## Yield Flow

1. **Strategy Harvest**: Yield strategies harvest interest + reward tokens
2. **Yield Collection**: Harvested tokens sent to Yield Reserve
3. **Token Conversion**: Reward tokens swapped to USDs at oracle prices
4. **Distribution Split**: USDs split between Dripper (70%) and Buyback (30%)
5. **USDs Auto-Yield**: Dripper gradually releases USDs to increase holder balances
6. **SPA Buyback**: Buyback contract purchases SPA and burns it

## Yield Distribution Split

| Recipient | Percentage | Purpose |
|-----------|------------|---------|
| USDs Holders | 70% | Auto-yield via daily rebase |
| SPA Buyback | 30% | Deflationary pressure on SPA |

## Token Swapping

The Yield Reserve can swap tokens using protocol oracle prices:

\`\`\`solidity
function swap(
    address srcToken,
    address dstToken,
    uint256 amountIn,
    uint256 minAmountOut
) external;
\`\`\`

### Token Permissions

Each token has permission flags:
- **srcAllowed**: Can be swapped FROM
- **dstAllowed**: Can be swapped TO
- **conversionFactor**: Decimal adjustment

## Contract Address

| Contract | Address |
|----------|---------|
| Yield Reserve | \`${CONTRACTS.YIELD_RESERVE}\` |
| Dripper | \`${CONTRACTS.DRIPPER}\` |
| SPA Buyback | \`${CONTRACTS.SPA_BUYBACK}\` |

## Governance

- Buyback percentage adjustable via governance
- Token permissions controlled by governance
- Strategy whitelisting via governance
`;

// ============================================================================
// Strategies Documentation
// ============================================================================

export const STRATEGIES_DOCUMENTATION = `# Sperax Yield Strategies

## Overview

Sperax deploys collateral to battle-tested DeFi protocols to generate yield for USDs holders.

## Active Strategies

### 1. Aave V3 Strategy
- **Protocol**: Aave V3 on Arbitrum
- **Collaterals**: USDC, USDC.e, USDT
- **Max Allocation**: 75%
- **Risk Level**: Low
- **Yield Source**: Variable lending rates

### 2. Compound V3 Strategy
- **Protocol**: Compound V3 on Arbitrum
- **Collaterals**: USDC, USDC.e
- **Max Allocation**: 75%
- **Risk Level**: Low
- **Yield Source**: Variable lending rates + COMP rewards

### 3. Stargate Strategy
- **Protocol**: Stargate Finance
- **Collaterals**: USDC.e, USDT
- **Max Allocation**: 50%
- **Risk Level**: Medium
- **Yield Source**: Cross-chain bridging fees + STG rewards

### 4. Fluid Strategy
- **Protocol**: Fluid (Instadapp)
- **Collaterals**: USDC, USDC.e, USDT
- **Max Allocation**: 75%
- **Risk Level**: Low
- **Yield Source**: Lending rates + protocol incentives

## Strategy Interface

All strategies implement a common interface:

\`\`\`solidity
interface IStrategy {
    function deposit(address token, uint256 amount) external;
    function withdraw(address token, uint256 amount) external;
    function checkBalance() external view returns (uint256);
    function collectInterest() external returns (uint256);
    function collectRewardTokens() external;
}
\`\`\`

## Allocation Management

### Collateral Manager
The Collateral Manager controls how funds are allocated:

- Sets allocation limits per strategy
- Handles rebalancing between strategies
- Enforces diversification requirements

### Allocation Caps

| Strategy | Max Allocation |
|----------|---------------|
| Aave V3 | 75% |
| Compound V3 | 75% |
| Stargate | 50% |
| Fluid | 75% |

## Yield Collection

1. **Interest**: Automatically accrues in strategy
2. **Rewards**: Harvested periodically (ARB, COMP, STG, etc.)
3. **Collection**: Sent to Yield Reserve
4. **Distribution**: Split 70/30 to USDs/Buyback

## Security

- All strategies audited
- Multi-sig controlled deployment
- Allocation limits prevent concentration
- Regular security reviews
`;

// ============================================================================
// Rebase Documentation
// ============================================================================

export const REBASE_DOCUMENTATION = `# USDs Rebase Mechanism

## Overview

USDs uses a rebase mechanism to distribute yield. Instead of claiming rewards, your balance automatically increases.

## How Rebase Works

### Credit System

USDs tracks balances using a credit system:

\`\`\`
balance = credits / creditsPerToken
\`\`\`

When yield is distributed:
1. \`creditsPerToken\` decreases
2. Same credits = higher balance
3. Everyone's balance increases proportionally

### Example

| Time | Credits | CreditsPerToken | Balance |
|------|---------|-----------------|---------|
| Day 1 | 1,000,000 | 1.000 | 1,000 USDs |
| Day 2 | 1,000,000 | 0.999 | 1,001 USDs |
| Day 30 | 1,000,000 | 0.970 | 1,030 USDs |

## Rebase Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| APR Cap | 25% | Maximum annual yield rate |
| APR Bottom | 3% | Minimum annual yield rate |
| Rebase Gap | 24 hours | Minimum time between rebases |

## Rebase States

Users and contracts can control their rebase participation:

| State | Value | Description |
|-------|-------|-------------|
| NotSet | 0 | Default behavior (EOA: in, Contract: out) |
| OptOut | 1 | Never receive rebases |
| OptIn | 2 | Always receive rebases |

### Default Behavior
- **EOAs (wallets)**: Automatically receive rebases
- **Contracts**: Must explicitly opt-in

### Opting In/Out

\`\`\`solidity
// Opt in to receive rebases
USDs.rebaseOptIn();

// Opt out of rebases
USDs.rebaseOptOut();
\`\`\`

## Rebase Timing

- Rebases occur approximately every 24 hours
- Triggered by Dripper releasing yield
- Amount depends on available yield

## Rebase Amount Calculation

\`\`\`solidity
function getAvailableRebaseAmt() external view returns (uint256) {
    // Returns amount that can be rebased
    // Limited by APR cap and available yield
}

function getMinAndMaxRebaseAmt() external view returns (uint256 min, uint256 max) {
    // Returns bounds based on APR limits
}
\`\`\`

## Contracts

| Contract | Address |
|----------|---------|
| USDs | \`${CONTRACTS.USDS}\` |
| RebaseManager | \`${CONTRACTS.REBASE_MANAGER}\` |
| Dripper | \`${CONTRACTS.DRIPPER}\` |
`;

// ============================================================================
// Oracle Documentation
// ============================================================================

export const ORACLE_DOCUMENTATION = `# Sperax Oracle System

## Overview

Sperax uses Chainlink oracles for secure, decentralized price feeds.

## Oracle Architecture

\`\`\`
┌─────────────────────────────────────────────┐
│              CHAINLINK ORACLES               │
├─────────────────────────────────────────────┤
│  USDC/USD → 0x50834F3163758fcC1Df9973b6e91f0F0F0363003 │
│  USDT/USD → 0x3f3f5dF88dC9F13eac63DF89EC16ef6e7E25DdE7 │
│  DAI/USD  → 0xc5C8E77B397E531B8EC06BFb0048328B30E9eCfB │
│  FRAX/USD → 0x0809E3d38d1B4214958faf06D8b1B1a2b73f2ab8 │
└─────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────┐
│              SPERAX VAULT                    │
│  - Reads prices for minting                  │
│  - Reads prices for redemption               │
│  - Calculates collateral ratios              │
└─────────────────────────────────────────────┘
\`\`\`

## Price Feed Specifications

| Feed | Decimals | Heartbeat | Deviation |
|------|----------|-----------|-----------|
| USDC/USD | 8 | 1 hour | 0.1% |
| USDT/USD | 8 | 1 hour | 0.1% |
| DAI/USD | 8 | 1 hour | 0.1% |
| FRAX/USD | 8 | 1 hour | 0.1% |

## Staleness Protection

Oracle prices are checked for freshness:

\`\`\`solidity
function getPrice(address oracle) returns (uint256) {
  (, int256 price, , uint256 updatedAt, ) = oracle.latestRoundData();
  require(block.timestamp - updatedAt < 3600, "Stale price");
  require(price > 0, "Invalid price");
  return uint256(price);
}
\`\`\`

## Deviation Protection

Stablecoins should trade near $1.00:

- **Warning**: > 0.5% deviation
- **Critical**: > 2% deviation
- **Pause**: > 5% deviation (auto-pause minting)

## Fallback Mechanism

If primary oracle fails:
1. Check secondary oracle (if available)
2. Use cached price (max 1 hour old)
3. Pause operations if no valid price

## Monitoring

Oracle health monitored 24/7:
- Price staleness alerts
- Deviation alerts
- Round completion verification
`;

// ============================================================================
// Governance Documentation
// ============================================================================

export const GOVERNANCE_DOCUMENTATION = `# Sperax DAO Governance

## Overview

Sperax is governed by SPA token holders through veSPA voting power.

## Governance Structure

\`\`\`
┌─────────────────────────────────────────────┐
│                 veSPA HOLDERS                │
│         (Vote-Escrowed SPA Tokens)           │
└──────────────────────┬──────────────────────┘
                       │ Vote
                       ▼
┌─────────────────────────────────────────────┐
│              SNAPSHOT VOTING                 │
│         (Off-chain, gas-free voting)         │
└──────────────────────┬──────────────────────┘
                       │ Execute
                       ▼
┌─────────────────────────────────────────────┐
│              TIMELOCK CONTRACT               │
│         (48-hour execution delay)            │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────┐
│           PROTOCOL CONTRACTS                 │
│   Vault, USDs, Strategies, Parameters        │
└─────────────────────────────────────────────┘
\`\`\`

## Voting Power

Voting power is determined by veSPA balance:

\`\`\`
veSPA = SPA × (lockDays / 365)
\`\`\`

Examples:
- Lock 1000 SPA for 1 year → 1000 veSPA
- Lock 1000 SPA for 4 years → 4000 veSPA

## Proposal Types

### 1. Parameter Changes
- Minting/redemption fees
- Collateral allocation limits
- Strategy allocations
- Quorum: 4%

### 2. Strategy Additions
- New yield strategies
- New collateral types
- Quorum: 6%

### 3. Protocol Upgrades
- Contract upgrades
- Major mechanism changes
- Quorum: 10%

## Proposal Lifecycle

1. **Discussion** (Forum) - 3+ days
2. **Temperature Check** (Snapshot) - 3 days
3. **Formal Vote** (Snapshot) - 5 days
4. **Timelock** - 48 hours
5. **Execution** - 14 day window

## Requirements

| Action | Requirement |
|--------|-------------|
| Create proposal | 100,000 veSPA |
| Vote | Any veSPA balance |
| Quorum | 4-10% depending on type |
| Pass | >50% FOR votes |

## Delegation

veSPA holders can delegate voting power:
- Delegation does NOT transfer tokens
- Only voting power is delegated
- Can undelegate at any time
`;

// ============================================================================
// Security Documentation
// ============================================================================

export const SECURITY_DOCUMENTATION = `# Sperax Security

## Audits

Sperax contracts have been audited by:

| Auditor | Date | Scope | Report |
|---------|------|-------|--------|
| OpenZeppelin | 2024-06 | Full Protocol | [Link](https://sperax.io/audits) |
| PeckShield | 2024-03 | USDs v2 | [Link](https://sperax.io/audits) |
| Halborn | 2023-12 | Vault | [Link](https://sperax.io/audits) |

## Security Features

### Smart Contract Security
- ✅ Audited by top firms
- ✅ Bug bounty program (up to $100k)
- ✅ Formal verification (critical functions)
- ✅ Reentrancy guards
- ✅ Integer overflow protection (Solidity 0.8+)

### Oracle Security
- ✅ Chainlink decentralized oracles
- ✅ Staleness checks
- ✅ Deviation thresholds
- ✅ Circuit breakers

### Access Control
- ✅ Multi-sig admin (4/7)
- ✅ 48-hour timelock
- ✅ Role-based permissions
- ✅ Guardian emergency pause

### Economic Security
- ✅ 100%+ collateralization
- ✅ Diversified collateral
- ✅ Strategy risk limits
- ✅ Depeg protection mechanisms

## Risk Factors

### Smart Contract Risk
Bugs in smart contracts could lead to loss of funds.
**Mitigation**: Multiple audits, bug bounty, insurance.

### Oracle Risk
Oracle manipulation could affect pricing.
**Mitigation**: Chainlink oracles, staleness checks, deviation limits.

### Collateral Risk
Collateral tokens could depeg.
**Mitigation**: Diversification, monitoring, circuit breakers.

### Strategy Risk
Yield strategies could be exploited.
**Mitigation**: Allocation limits, audits, monitoring.

## Bug Bounty

Report vulnerabilities responsibly:
- Email: security@sperax.io
- Immunefi: https://immunefi.com/bounty/sperax

Rewards up to $100,000 for critical bugs.

## Emergency Procedures

### Guardian Actions
- Pause minting/redemption
- Pause strategies
- Emergency withdrawal

### Recovery Process
1. Identify issue
2. Pause affected systems
3. Investigate root cause
4. Deploy fix
5. Governance approval
6. Resume operations
`;

// ============================================================================
// API Reference
// ============================================================================

export const API_REFERENCE = `# Sperax MCP API Reference

## Tools

### USDs Tools

| Tool | Description |
|------|-------------|
| \`usds_get_info\` | Get USDs overview (supply, APR) |
| \`usds_get_balance\` | Get balance for address |
| \`usds_get_rebase_state\` | Check rebase opt-in status |
| \`usds_get_mint_params\` | Get minting parameters |
| \`usds_get_yield_info\` | Get yield metrics |
| \`usds_get_collateral_ratio\` | Get collateralization ratio |

### SPA Tools

| Tool | Description |
|------|-------------|
| \`spa_get_info\` | Get SPA token overview |
| \`spa_get_balance\` | Get SPA/veSPA/xSPA balances |
| \`vespa_get_position\` | Get veSPA lock details |
| \`vespa_calculate_power\` | Calculate veSPA for lock |
| \`vespa_get_stats\` | Get global staking stats |
| \`xspa_get_position\` | Get xSPA redemption options |
| \`xspa_calculate_redemption\` | Calculate SPA from xSPA |
| \`buyback_get_stats\` | Get buyback statistics |

### Vault Tools

| Tool | Description |
|------|-------------|
| \`vault_get_status\` | Get Vault health status |
| \`vault_get_collaterals\` | List all collaterals |
| \`vault_get_collateral_details\` | Get specific collateral info |
| \`vault_get_strategies\` | List yield strategies |
| \`vault_get_strategy_details\` | Get strategy details |
| \`vault_get_oracle_prices\` | Get all oracle prices |
| \`vault_get_peg_status\` | Check USDs peg |
| \`vault_simulate_mint\` | Simulate mint operation |
| \`vault_simulate_redeem\` | Simulate redeem operation |
| \`vault_get_allocation_targets\` | Get allocation targets |

### Demeter Tools

| Tool | Description |
|------|-------------|
| \`demeter_list_farms\` | List active farms |
| \`demeter_get_farm_details\` | Get farm details |
| \`demeter_get_user_position\` | Get user's farm positions |
| \`demeter_calculate_rewards\` | Calculate pending rewards |
| \`demeter_estimate_apr\` | Estimate farm APR |
| \`demeter_get_top_farms\` | Get highest APR farms |

### Dripper Tools

| Tool | Description |
|------|-------------|
| \`dripper_get_status\` | Get Dripper status |
| \`dripper_get_balance\` | Get pending yield balance |
| \`dripper_get_config\` | Get Dripper config |
| \`dripper_estimate_next_rebase\` | Estimate next rebase |
| \`dripper_calculate_earnings\` | Calculate earnings projection |

### Oracle Tools

| Tool | Description |
|------|-------------|
| \`oracle_get_all_prices\` | Get all collateral prices |
| \`oracle_get_price\` | Get specific asset price |
| \`oracle_check_staleness\` | Check oracle freshness |
| \`oracle_check_deviation\` | Check price deviation |
| \`oracle_get_sources\` | Get oracle source info |

### Analytics Tools

| Tool | Description |
|------|-------------|
| \`analytics_get_tvl\` | Get Total Value Locked |
| \`analytics_get_revenue\` | Get protocol revenue |
| \`analytics_get_apy_history\` | Get historical APY |
| \`analytics_get_user_stats\` | Get user statistics |
| \`analytics_compare_yields\` | Compare with competitors |
| \`analytics_get_protocol_health\` | Get health metrics |

### Governance Tools

| Tool | Description |
|------|-------------|
| \`governance_get_overview\` | Get governance overview |
| \`governance_get_proposals\` | List proposals |
| \`governance_get_proposal_details\` | Get proposal details |
| \`governance_get_voting_power\` | Get voting power |
| \`governance_get_delegates\` | Get delegation info |

## Resources

| URI | Description |
|-----|-------------|
| \`sperax://docs/overview\` | Protocol overview |
| \`sperax://docs/usds\` | USDs documentation |
| \`sperax://docs/staking\` | Staking guide |
| \`sperax://docs/demeter\` | Farming guide |
| \`sperax://docs/vault\` | Vault documentation |
| \`sperax://docs/oracles\` | Oracle documentation |
| \`sperax://docs/governance\` | Governance guide |
| \`sperax://docs/security\` | Security information |
| \`sperax://docs/formulas\` | Protocol formulas |
| \`sperax://docs/api\` | This API reference |
| \`sperax://contracts/addresses\` | Contract addresses |

## Prompts

| Prompt | Description |
|--------|-------------|
| \`what_is_usds\` | Explain USDs |
| \`how_to_mint\` | Mint tutorial |
| \`how_to_redeem\` | Redeem tutorial |
| \`my_usds_balance\` | Check balance |
| \`my_yield_earnings\` | Earnings report |
| \`stake_spa\` | Staking guide |
| \`my_staking_position\` | Position check |
| \`best_yield_farms\` | Farm discovery |
| \`my_farm_rewards\` | Pending rewards |
| \`protocol_health\` | Health check |
| \`spa_tokenomics\` | Token info |
| \`compare_yields\` | Yield comparison |
| \`rebase_calculator\` | Calculate rebases |
| \`vespa_calculator\` | Calculate veSPA |
| \`portfolio_summary\` | Full portfolio |
| \`optimize_my_yield\` | AI optimization |
| \`risk_assessment\` | Risk analysis |
| \`weekly_report\` | Weekly summary |
`;

// ============================================================================
// Contract Address Resources
// ============================================================================

export const CONTRACT_ADDRESSES = {
  chain: 'Arbitrum One',
  chainId: 42161,
  contracts: CONTRACTS,
  collaterals: Object.fromEntries(
    Object.entries(COLLATERALS).map(([key, val]) => [key, val.address])
  ),
};

// ============================================================================
// Ecosystem Integration Documentation
// ============================================================================

export const AGENTS_DOCUMENTATION = `# SperaxOS DeFi Agents

## Overview

The DeFi Agents API provides access to 78+ production-ready AI agent definitions for DeFi, portfolio management, trading, and Web3 workflows.

**API Base URL:** \`https://sperax.click\`
**Repository:** https://github.com/speraxos/SperaxOS-Defi-Agents

## Features

- ✅ **78+ Production-Ready Agents** - DeFi, portfolio, trading, security, education
- ✅ **30+ Languages** - Full i18n support
- ✅ **RESTful JSON API** - Easy integration
- ✅ **Sperax Ecosystem Agents** - USDs, SPA, veSPA specialists

## Available Tools

| Tool | Description |
|------|-------------|
| \`agents_list\` | List all available DeFi agents with filtering |
| \`agents_get\` | Get complete agent details and system prompt |
| \`agents_search\` | Search agents by keyword |
| \`agents_get_sperax\` | Get Sperax-specific agents |
| \`agents_get_categories\` | List agent categories and counts |

## Sperax Ecosystem Agents

- **USDs Stablecoin Expert** - Auto-yield stablecoin specialist
- **SPA Tokenomics Analyst** - Token economics expert
- **veSPA Lock Optimizer** - Staking strategy advisor
- **Sperax Governance Guide** - DAO participation helper
- **Sperax Yield Aggregator** - Yield optimization specialist
- **Sperax Portfolio Tracker** - Portfolio management

## Usage Example

\`\`\`
Use agents_list with category "sperax" to find ecosystem agents
Use agents_get with identifier "usds-stablecoin-expert" to get full prompt
\`\`\`

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| \`/index.json\` | All agents (English) |
| \`/index.{locale}.json\` | Agents in specific language |
| \`/{identifier}.json\` | Single agent details |
`;

export const SKILLS_DOCUMENTATION = `# Agent Skills Registry

## Overview

The Agent Skills Registry provides a structured mapping of agent capabilities to concrete MCP tools. Each skill represents a composable capability that agents declare and execute, enabling skill-based agent discovery and orchestration.

**Total Skills:** 39 across 12 domains
**MCP Tools:** 5 skill-discovery tools

## Skill Domains

| Domain | Skills | Description |
|--------|--------|-------------|
| 🔒 **security** | 7 | Token scans, honeypot detection, rug pull analysis, approval audits, dApp safety, contract verification |
| 🏦 **defi** | 6 | Yield discovery, protocol analysis, TVL tracking, swap execution, pool analysis, gas estimation |
| 📊 **market-data** | 3 | Price tracking, market sentiment, whale monitoring |
| 💰 **stablecoin** | 3 | USDs operations, vault monitoring, mint simulation |
| 🥩 **staking** | 3 | SPA staking, yield tracking, Demeter farming |
| 🗳️ **governance** | 1 | Governance participation and proposal analysis |
| 📈 **analytics** | 4 | Protocol metrics, oracle price feeds, subgraph queries, supply analytics |
| 💼 **portfolio** | 2 | Portfolio overview, risk assessment |
| 🌉 **bridge** | 1 | Cross-chain bridge operations |
| 🎨 **nft** | 1 | NFT exploration and market analysis |
| 📰 **education** | 3 | News aggregation, agent discovery, plugin marketplace |
| 💱 **trading** | 5 | Full token audit, DeFi risk report, daily briefing, ecosystem overview, swap routing |

## Available MCP Tools

| Tool | Description |
|------|-------------|
| \`skills_list\` | List all skills with optional domain/complexity/risk filters |
| \`skills_get\` | Get complete skill details by ID |
| \`skills_search\` | Full-text search across skill names, descriptions, and tags |
| \`skills_by_agent\` | Discover which skills an agent supports based on its tags |
| \`skills_get_domains\` | List all skill domains with counts and descriptions |

## Skill Structure

Each skill contains:
- **id** — Unique identifier (kebab-case)
- **name** — Human-readable name
- **description** — What this skill does
- **domain** — Category (security, defi, trading, etc.)
- **complexity** — Rating 1-5 (1=simple lookup, 5=multi-step orchestration)
- **tools** — MCP tools required/optional for execution
- **inputSchema** — Parameters the skill accepts
- **outputFields** — Data fields the skill produces
- **relatedSkills** — IDs of chainable/related skills
- **examples** — Natural language prompts with expected tool chains
- **tags** — Filtering keywords
- **riskLevel** — low, medium, or high

## Agent-Skill Mapping

Each agent JSON definition includes a \`skills\` array that maps skill IDs to proficiency levels:

\`\`\`json
{
  "skills": [
    { "id": "usds-operations", "level": "primary" },
    { "id": "vault-monitoring", "level": "secondary" },
    { "id": "sperax-ecosystem-overview", "level": "supplementary" }
  ]
}
\`\`\`

**Levels:**
- **primary** — Core competency, the agent's main focus
- **secondary** — Supporting capability used frequently
- **supplementary** — Available but not the agent's main strength

## Usage Examples

\`\`\`
Use skills_list with domain "security" to find all security skills
Use skills_get with skillId "token-security-scan" for full skill details
Use skills_search with query "yield" to find yield-related skills
Use skills_by_agent with agentId "usds-stablecoin-expert" to see agent capabilities
Use skills_get_domains to see all domains and their skill counts
\`\`\`

## Skill Chaining

Skills reference related skills via \`relatedSkills\`, enabling multi-step workflows:

1. **token-security-scan** → rug-pull-analysis → honeypot-detection
2. **yield-discovery** → protocol-analysis → tvl-tracking
3. **usds-operations** → vault-monitoring → mint-simulation
4. **portfolio-overview** → portfolio-risk-assessment → yield-tracking
`;

export const PLUGINS_DOCUMENTATION = `# SperaxOS Plugin Marketplace

## Overview

Plugin Delivery is the official plugin marketplace for SperaxOS, providing AI function call plugins for crypto and DeFi operations.

**Plugin Index:** \`https://plugin.delivery\`
**Repository:** https://github.com/nirholas/plugin.delivery

## Features

- ✅ **AI Function Calls** - LLM-compatible plugin system
- ✅ **Gateway Service** - Secure request routing
- ✅ **TypeScript SDK** - \`@sperax/plugin-sdk\`
- ✅ **Multiple Plugin Types** - Default, Markdown, Standalone

## Available Tools

| Tool | Description |
|------|-------------|
| \`plugins_list\` | List all available plugins |
| \`plugins_get_manifest\` | Get plugin manifest and functions |
| \`plugins_execute\` | Execute plugin function via gateway |
| \`plugins_coingecko_price\` | Get crypto prices from CoinGecko |
| \`plugins_defillama_tvl\` | Get protocol TVL from DefiLlama |
| \`plugins_search\` | Search plugins by keyword |

## Available Plugins

| Plugin | Description |
|--------|-------------|
| 🪙 **CoinGecko** | Crypto prices, market data |
| 🦙 **DefiLlama** | Protocol TVL, yields |

## Plugin Types

1. **Default** - JSON response rendered as text
2. **Markdown** - Rich markdown formatting
3. **Standalone** - Interactive React UI

## Usage Example

\`\`\`
Use plugins_coingecko_price with coinId "ethereum" to get ETH price
Use plugins_defillama_tvl with protocol "sperax" to get Sperax TVL
\`\`\`
`;

export const NEWS_DOCUMENTATION = `# Free Crypto News API

## Overview

Real-time crypto news aggregation from 7 major sources with no API keys or rate limits required.

**API Base URL:** \`https://free-crypto-news.vercel.app\`
**Repository:** https://github.com/speraxos/crypto-news

## News Sources

| Source | Category | Emoji |
|--------|----------|-------|
| CoinDesk | General | 🟠 |
| The Block | Institutional | 🔵 |
| Decrypt | Web3 & Culture | 🟢 |
| CoinTelegraph | Global | 🟡 |
| Bitcoin Magazine | Bitcoin | 🟤 |
| Blockworks | DeFi & Institutions | 🟣 |
| The Defiant | DeFi Native | 🔴 |

## Available Tools

| Tool | Description |
|------|-------------|
| \`news_get_latest\` | Latest news from all sources |
| \`news_search\` | Search by keywords |
| \`news_get_defi\` | DeFi-specific news |
| \`news_get_bitcoin\` | Bitcoin-specific news |
| \`news_get_breaking\` | Breaking news (last 2 hours) |
| \`news_get_sources\` | List all news sources |
| \`news_get_sperax\` | Sperax-related news |

## Features

- ✅ **100% Free** - No API keys required
- ✅ **No Rate Limits** - Fair use policy
- ✅ **Real-time** - RSS feed aggregation
- ✅ **7 Sources** - Comprehensive coverage

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| \`/api/news\` | Latest from all sources |
| \`/api/search?q=keyword\` | Search by keywords |
| \`/api/defi\` | DeFi-specific news |
| \`/api/bitcoin\` | Bitcoin-specific news |
| \`/api/breaking\` | News from last 2 hours |
| \`/api/sources\` | List all sources |

## Usage Example

\`\`\`
Use news_get_latest with limit 5 to get recent headlines
Use news_search with keywords "ethereum,etf" for topic-specific news
Use news_get_breaking for time-sensitive updates
\`\`\`

## Response Format

\`\`\`json
{
  "articles": [
    {
      "title": "Article Title",
      "link": "https://...",
      "description": "Brief description",
      "source": "CoinDesk",
      "timeAgo": "2h ago"
    }
  ],
  "totalCount": 150,
  "fetchedAt": "2025-01-02T14:30:00Z"
}
\`\`\`
`;

// ============================================================================
// Resource Definitions for MCP
// ============================================================================

export const resources = [
  {
    uri: 'sperax://docs/overview',
    name: 'Protocol Overview',
    description: 'High-level overview of the Sperax DeFi protocol',
    mimeType: 'text/markdown',
    content: PROTOCOL_OVERVIEW,
  },
  {
    uri: 'sperax://docs/usds',
    name: 'USDs Documentation',
    description: 'Complete documentation for USDs auto-yield stablecoin',
    mimeType: 'text/markdown',
    content: USDS_DOCUMENTATION,
  },
  {
    uri: 'sperax://docs/staking',
    name: 'Staking Guide',
    description: 'Guide to veSPA and xSPA staking mechanics',
    mimeType: 'text/markdown',
    content: STAKING_DOCUMENTATION,
  },
  {
    uri: 'sperax://docs/demeter',
    name: 'Demeter Guide',
    description: 'Guide to Demeter no-code yield farms',
    mimeType: 'text/markdown',
    content: DEMETER_DOCUMENTATION,
  },
  {
    uri: 'sperax://docs/vault',
    name: 'Vault Documentation',
    description: 'Documentation for the Sperax Vault and collateral management',
    mimeType: 'text/markdown',
    content: VAULT_DOCUMENTATION,
  },
  {
    uri: 'sperax://docs/yield-reserve',
    name: 'Yield Reserve Documentation',
    description: 'Documentation for the Yield Reserve that manages yield collection and distribution',
    mimeType: 'text/markdown',
    content: YIELD_RESERVE_DOCUMENTATION,
  },
  {
    uri: 'sperax://docs/strategies',
    name: 'Yield Strategies Documentation',
    description: 'Documentation for all yield-generating strategies (Aave, Compound, Stargate, Fluid)',
    mimeType: 'text/markdown',
    content: STRATEGIES_DOCUMENTATION,
  },
  {
    uri: 'sperax://docs/rebase',
    name: 'Rebase Mechanism Documentation',
    description: 'Complete documentation for USDs rebase mechanism and parameters',
    mimeType: 'text/markdown',
    content: REBASE_DOCUMENTATION,
  },
  {
    uri: 'sperax://docs/oracles',
    name: 'Oracle Documentation',
    description: 'Documentation for the Sperax oracle system',
    mimeType: 'text/markdown',
    content: ORACLE_DOCUMENTATION,
  },
  {
    uri: 'sperax://docs/governance',
    name: 'Governance Guide',
    description: 'Guide to Sperax DAO governance and voting',
    mimeType: 'text/markdown',
    content: GOVERNANCE_DOCUMENTATION,
  },
  {
    uri: 'sperax://docs/security',
    name: 'Security Information',
    description: 'Security audits, bug bounty, and risk information',
    mimeType: 'text/markdown',
    content: SECURITY_DOCUMENTATION,
  },
  {
    uri: 'sperax://docs/formulas',
    name: 'Protocol Formulas',
    description: 'Key formulas used in Sperax protocol calculations',
    mimeType: 'text/markdown',
    content: FORMULAS_DOCUMENTATION,
  },
  {
    uri: 'sperax://docs/api',
    name: 'API Reference',
    description: 'Complete API reference for all MCP tools and resources',
    mimeType: 'text/markdown',
    content: API_REFERENCE,
  },
  {
    uri: 'sperax://contracts/addresses',
    name: 'Contract Addresses',
    description: 'All deployed Sperax contract addresses on Arbitrum',
    mimeType: 'application/json',
    content: JSON.stringify(CONTRACT_ADDRESSES, null, 2),
  },
  // Ecosystem Integration Resources
  {
    uri: 'sperax://ecosystem/agents',
    name: 'DeFi Agents API',
    description: 'Documentation for the DeFi Agents API with 78+ AI agent definitions',
    mimeType: 'text/markdown',
    content: AGENTS_DOCUMENTATION,
  },
  {
    uri: 'sperax://ecosystem/skills',
    name: 'Agent Skills Registry',
    description: 'Documentation for the Agent Skills Registry — 39 skills across 12 domains with MCP tool mappings',
    mimeType: 'text/markdown',
    content: SKILLS_DOCUMENTATION,
  },
  {
    uri: 'sperax://ecosystem/plugins',
    name: 'Plugin Marketplace',
    description: 'Documentation for the SperaxOS Plugin Marketplace',
    mimeType: 'text/markdown',
    content: PLUGINS_DOCUMENTATION,
  },
  {
    uri: 'sperax://ecosystem/news',
    name: 'Crypto News API',
    description: 'Documentation for the Free Crypto News API',
    mimeType: 'text/markdown',
    content: NEWS_DOCUMENTATION,
  },
];
