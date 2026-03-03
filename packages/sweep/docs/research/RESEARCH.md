# 🧹 Sweep - Research & Planning Document

> **Project Vision**: A multi-chain dust sweeper that allows users to swap small amounts of tokens across EVM chains (Ethereum, BNB Chain, Base, Arbitrum, Polygon, Linea) and Solana, then convert them into DeFi yield positions — all without needing native gas tokens.

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Competitive Landscape](#competitive-landscape)
3. [Product Concept](#product-concept)
4. [Technical Infrastructure](#technical-infrastructure)
5. [Revenue Model](#revenue-model)
6. [Research Gaps](#research-gaps)
7. [Next Steps](#next-steps)

---

## Problem Statement

### The Dust Problem

Crypto users accumulate "dust" — small token balances worth $0.50-$10 that are economically impractical to move or swap because gas fees exceed the token value.

```
Typical User Wallet State:
├── Ethereum:  $3 SHIB, $2 PEPE, $0.50 random ERC20... but $0 ETH for gas ❌
├── Base:      $5 memecoins, $1 USDC... but $0 ETH for gas ❌
├── Arbitrum:  $4 ARB dust, $2 tokens... but $0 ETH for gas ❌
├── BNB:       $6 various tokens... but $0 BNB for gas ❌
└── Solana:    $8 memecoins, vacant accounts... but $0 SOL for gas ❌

Total "trapped" value: ~$30+ that user cannot access
```

### Why This Matters

- Users can't clean up wallets without buying native tokens first
- Dust accumulates across multiple chains, compounding the problem
- No existing solution combines multi-chain sweeping with DeFi yield
- The value just sits there, doing nothing

---

## Competitive Landscape

### Direct Competitors (Solana Only)

| Project | Features | Limitations |
|---------|----------|-------------|
| **Purity Finance** | Dust swap, NFT burn, vacant account cleanup, ~0.002 SOL recovery per account | Solana only, no DeFi routing, requires SOL for gas, "Pure Wallet" requires seed phrase |
| **Sol-Incinerator** | Token/NFT/cNFT burn, LP token burn, domain cleanup, Jupiter DEX integration | Solana only, no DeFi routing, requires SOL for gas |

### Adjacent Infrastructure (Not Dust-Focused)

| Project | What They Do | Could Compete? |
|---------|--------------|----------------|
| **Li.Fi** | Cross-chain bridge + DEX aggregation | Infrastructure we build on |
| **1inch** | EVM DEX aggregation | Infrastructure we build on |
| **Jupiter** | Solana DEX aggregation | Infrastructure we build on |
| **CoW Protocol** | Batch auctions, MEV protection | Could add dust features |
| **Socket/Bungee** | Cross-chain bridging | Infrastructure we build on |

### Potential Threats

| Company | Risk Level | Notes |
|---------|-----------|-------|
| **MetaMask** | 🔴 HIGH | Already has "gas included transactions" - could add dust sweep |
| **Coinbase Wallet** | 🟡 MEDIUM | Large user base, could add wallet cleanup |
| **Phantom** | 🟡 MEDIUM | Popular Solana wallet, proven cleanup demand |
| **Rainbow Wallet** | 🟢 LOW | UX-focused, could add |

### Market Gap Analysis

```
                        MULTI-CHAIN SUPPORT
                    ❌ No              ✅ Yes
                ┌─────────────────┬─────────────────┐
         ❌ No  │ Purity Finance  │    Li.Fi        │
   DEFI        │ Sol-Incinerator │    Socket       │
  ROUTING      │                 │    1inch        │
                ├─────────────────┼─────────────────┤
         ✅ Yes │                 │   🧹 SWEEP      │
               │    (empty)      │     BANK        │
               │                 │   (our gap!)    │
                └─────────────────┴─────────────────┘
```

**Key Insight**: Nobody is doing Multi-chain + Dust Sweep + DeFi Routing + Gas Abstraction together.

---

## Product Concept

### Core Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        🧹 SWEEP FLOW                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [1] SCAN            [2] SELECT GAS TOKEN      [3] BATCH SWEEP              │
│  ─────────           ──────────────────        ────────────                 │
│  Multi-chain         Auto-detect best          Single tx per chain          │
│  wallet scan         token to pay gas          (or cross-chain batch)       │
│       │                     │                         │                     │
│       ▼                     ▼                         ▼                     │
│  ┌─────────┐          ┌──────────┐             ┌──────────┐                 │
│  │ ETH: $5 │          │ Use USDT │             │ Swap all │                 │
│  │ BSC: $6 │    →     │ for gas  │      →      │ dust →   │                 │
│  │ ARB: $4 │          │ on ETH   │             │ target   │                 │
│  │ SOL: $8 │          │          │             │ asset    │                 │
│  └─────────┘          └──────────┘             └──────────┘                 │
│                                                      │                      │
│                                                      ▼                      │
│                              [4] ROUTE TO DEFI POSITION                     │
│                              ──────────────────────────                     │
│                              ┌─────────────────────────┐                    │
│                              │  Choose destination:    │                    │
│                              │  • Stablecoin vault     │                    │
│                              │  • ETH staking (stETH)  │                    │
│                              │  • LP position          │                    │
│                              │  • Hold as token        │                    │
│                              └─────────────────────────┘                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Gas Abstraction (Key Feature)

Inspired by MetaMask's "gas included transactions" feature, users can pay gas fees with tokens they already hold instead of needing native tokens.

**Supported Gas Payment Tokens by Chain:**

| Chain | Supported Tokens |
|-------|-----------------|
| **Ethereum** | USDT, USDC, DAI, wETH, wBTC, wstETH, cbBTC, rETH |
| **BNB Chain** | USDT, USDC, DAI, wBNB, ETH |
| **Arbitrum** | USDT, USDC, ARB, DAI, WETH, USDe, cbBTC |
| **Base** | USDC, USDT, DAI, wstETH, cbBTC, wETH |
| **Polygon** | USDT, USDC, DAI, WETH, wBTC |
| **Linea** | USDT, USDC, DAI, WETH, wBTC, wstETH |
| **Solana** | Use highest-value token to swap for SOL first |

### User Journeys

**Journey 1: "I have dust everywhere but no gas"**
1. Connect wallet
2. Sweep scans all chains → finds $47 total dust
3. Shows: "We'll use $2 of your USDT to cover all gas fees"
4. User selects destination: "Deposit to Aave USDC vault"
5. One signature → execution across chains
6. User receives: ~$42 USDC earning 4.2% APY

**Journey 2: "Sweep to single chain"**
1. Scan → $50 dust found
2. User picks: "Consolidate all to Base as ETH"
3. One click → all dust bridges/swaps to Base
4. User has clean wallet + consolidated funds

**Journey 3: "Auto-sweep mode"**
1. Set rules: "Sweep anything under $5 weekly"
2. Set destination: "Add to my Aave position"
3. Sweep monitors and auto-executes when threshold hit

### Key Differentiators

| Feature | Existing Tools | Sweep |
|---------|----------------|------------|
| Chains | Solana only | EVM (6 chains) + Solana |
| Output | Single token swap | DeFi yield positions |
| Automation | Semi-auto (needs seed phrase) | Smart contract based |
| Gas | Need native token | Pay with ANY token |
| Cross-chain | No | Full consolidation |

---

## Technical Infrastructure

### Coinbase Stack (Primary Infrastructure)

| Component | Repo | Purpose | Priority |
|-----------|------|---------|----------|
| **verifying-paymaster** | `coinbase/verifying-paymaster` | Gas abstraction - users pay in ERC-20 tokens | ⭐⭐⭐⭐⭐ |
| **smart-wallet** | `coinbase/smart-wallet` | ERC-4337 accounts with passkey auth | ⭐⭐⭐⭐⭐ |
| **cdp-sdk** | `coinbase/cdp-sdk` | Unified EVM + Solana SDK | ⭐⭐⭐⭐ |
| **spend-permissions** | `coinbase/spend-permissions` | Recurring allowances for auto-sweep | ⭐⭐⭐⭐ |
| **x402** | `coinbase/x402` | API monetization (HTTP 402 payments) | ⭐⭐⭐⭐ |
| **agentkit** | `coinbase/agentkit` | AI agent integration (Phase 2) | ⭐⭐⭐ |

### verifying-paymaster Deep Dive

This is the **core enabling technology** for gas abstraction:

```solidity
struct PaymasterData {
    uint48 validUntil;
    uint48 validAfter;
    uint128 sponsorUUID;      // Offchain tracking
    bool allowAnyBundler;
    bool precheckBalance;     // Check user has enough tokens
    bool prepaymentRequired;
    address token;            // ERC-20 user pays with
    address receiver;         // Where fees go (us!)
    uint256 exchangeRate;     // Token-to-gas rate (profit margin!)
    uint48 postOpGas;
}
```

**Key Capability**: Accept dust tokens as gas payment, swap internally, take a spread.

### DEX Aggregator Stack

| Aggregator | Chains | Use Case |
|------------|--------|----------|
| **1inch** | All EVM | Primary EVM swaps |
| **Jupiter** | Solana | Solana swaps |
| **Li.Fi** | Cross-chain | Bridge + swap routing |
| **Socket** | Cross-chain | Alternative bridge routing |

### DeFi Target Protocols

| Protocol | Chains | Position Type |
|----------|--------|---------------|
| **Aave v3** | ETH, ARB, Base, Polygon | Lending (stablecoins) |
| **Yearn v3** | ETH, ARB, Base | Auto-compounding vaults |
| **Beefy** | All EVM | Multi-strategy vaults |
| **Lido** | ETH | ETH staking (stETH) |
| **Jito** | Solana | SOL staking |
| **Marinade** | Solana | SOL staking |
| **Pendle** | ETH, ARB | Fixed-yield positions |

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        SWEEP                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────────┐   │
│  │   User UI   │───▶│  Backend API │───▶│  x402 Paywall    │   │
│  │  (React)    │    │  (Node.js)   │    │  (Monetization)  │   │
│  └─────────────┘    └──────────────┘    └──────────────────┘   │
│         │                  │                                    │
│         ▼                  ▼                                    │
│  ┌─────────────┐    ┌──────────────┐                           │
│  │smart-wallet │    │   cdp-sdk    │                           │
│  │(User Accts) │    │(Server Ops)  │                           │
│  └─────────────┘    └──────────────┘                           │
│         │                  │                                    │
│         ▼                  ▼                                    │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │              VERIFYING PAYMASTER                          │ │
│  │         (Gas abstraction - pay with any ERC-20)           │ │
│  └───────────────────────────────────────────────────────────┘ │
│         │                                                       │
│         ▼                                                       │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                 SPEND PERMISSIONS                          │ │
│  │      (Recurring auto-sweep allowances for users)          │ │
│  └───────────────────────────────────────────────────────────┘ │
│         │                                                       │
│         ▼                                                       │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                DEX AGGREGATORS                             │ │
│  │     1inch (EVM) │ Jupiter (Solana) │ Li.Fi (Cross-chain)  │ │
│  └───────────────────────────────────────────────────────────┘ │
│         │                                                       │
│         ▼                                                       │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                    DEFI PROTOCOLS                          │ │
│  │   Aave │ Yearn │ Beefy │ Lido │ Jito │ Marinade │ Pendle  │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Revenue Model

| Revenue Stream | Fee Structure | Notes |
|----------------|---------------|-------|
| **Sweep Fee** | 1-2% of dust value | Per-sweep charge |
| **Gas Spread** | ~5% markup on exchange rate | User pays 1.05 USDC for 1 USDC gas |
| **DeFi Routing** | 0.1-0.5% of deposit | Affiliate/integration fees |
| **Cross-chain Bridge** | Pass-through + 0.5% | Bridge fee markup |
| **API Access (x402)** | $0.10-0.50 per sweep | B2B/agent access |
| **Premium Subscription** | $5-10/month | Auto-sweep, higher limits |

---

## Research Gaps

### Documentation Still Needed

| Category | Specific Docs | Why Needed |
|----------|---------------|------------|
| **DEX Aggregators** | 1inch Fusion API, Jupiter API, Li.Fi SDK docs | Core swap routing implementation |
| **DeFi Protocols** | Aave v3 SDK, Yearn v3 API, Beefy API | Deposit destination integrations |
| **Account Abstraction** | ERC-4337 full spec, Bundler APIs (Pimlico, Alchemy) | UserOp construction, gas estimation |
| **Token Lists** | CoinGecko API, Uniswap token lists, chain registries | Dust detection, pricing |
| **Price Oracles** | Chainlink feeds, Pyth Network | Real-time value calculations |
| **Bridge Protocols** | Across, Stargate, LayerZero docs | Cross-chain mechanics |

### Open Questions

1. **Gas Estimation**: How to accurately estimate gas for batched multi-token swaps?
2. **Slippage**: What's acceptable slippage for dust (low-liquidity) tokens?
3. **Failed Transactions**: How to handle partial failures in batch operations?
4. **MEV Protection**: Do we need private mempools for dust swaps?
5. **Token Valuation**: How to price obscure/illiquid tokens accurately?
6. **Minimum Thresholds**: What's the minimum dust value worth sweeping after gas?

---

## Next Steps

### Phase 1: Documentation & Architecture
- [ ] Gather DEX aggregator API documentation
- [ ] Document DeFi protocol integration requirements
- [ ] Study ERC-4337 and bundler APIs in depth
- [ ] Create detailed system architecture document
- [ ] Define API contracts between components

### Phase 2: Proof of Concept
- [ ] Deploy test paymaster on Base Sepolia
- [ ] Build minimal sweep flow (single chain, single token)
- [ ] Integrate 1inch for swap routing
- [ ] Test gas abstraction with USDC payment

### Phase 3: MVP
- [ ] Multi-token batch sweeping
- [ ] Multi-chain support (Base, Arbitrum, Polygon)
- [ ] Basic DeFi routing (Aave deposit)
- [ ] Frontend dashboard

### Phase 4: Full Product
- [ ] Cross-chain consolidation
- [ ] Full DeFi protocol suite
- [ ] Auto-sweep subscriptions
- [ ] x402 monetization layer
- [ ] Solana support

---

## Appendix: Key Resources

### Coinbase Infrastructure
- smart-wallet: `https://github.com/coinbase/smart-wallet`
- verifying-paymaster: `https://github.com/coinbase/verifying-paymaster`
- spend-permissions: `https://github.com/coinbase/spend-permissions`
- cdp-sdk: `https://github.com/coinbase/cdp-sdk`
- x402: `https://github.com/coinbase/x402`
- agentkit: `https://github.com/coinbase/agentkit`

### Competitor Reference
- Purity Finance: Solana dust cleanup tool
- Sol-Incinerator: Original Solana wallet cleanup (since 2021)

### Standards
- ERC-4337: Account Abstraction
- ERC-7528: Native token address convention
- Permit2: Gasless token approvals

---

*Last Updated: January 2026*
