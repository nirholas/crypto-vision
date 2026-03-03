# Coinbase Infrastructure Stack for Sweep

## Overview

After exploring Coinbase's GitHub repositories, here are the most relevant tools for building Sweep - a multi-chain dust sweeper with gas abstraction and DeFi routing.

---

## 🔑 Core Infrastructure Components

### 1. **x402** - API Monetization ⭐⭐⭐⭐⭐
**Repo:** `coinbase/x402`
**Stars:** 5,281

**What it does:**
- HTTP 402-based payment protocol for API monetization
- Supports USDC payments on Base and Solana
- Zero facilitator fees
- Native machine-to-machine payment rails

**Use Case for Sweep:**
- Charge per-sweep API calls
- Monetize the backend service
- Enable AI agents to pay for sweep services
- B2B API access model

```
User → Sweep API → x402 Payment → Execute Sweep
```

---

### 2. **smart-wallet** - ERC-4337 Smart Accounts ⭐⭐⭐⭐⭐
**Repo:** `coinbase/smart-wallet`

**What it does:**
- ERC-4337 compliant smart contract wallets
- Passkey/WebAuthn support for authentication
- Multiple owners per wallet
- Cross-chain replayability
- Deployed on Base at `0xBA5ED110eFDBa3D005bfC882d75358ACBbB85842`

**Use Case for Sweep:**
- Create smart accounts for users who want automated sweeping
- Enable passkey authentication (no seed phrase needed!)
- Foundation for gas abstraction via paymasters
- Batch multiple sweep operations in single user op

---

### 3. **verifying-paymaster** - Gas Sponsorship ⭐⭐⭐⭐⭐
**Repo:** `coinbase/verifying-paymaster`

**What it does:**
- ERC-4337 paymaster for gas sponsorship
- **Supports ERC-20 token payments for gas** (USDC, USDT, etc.)
- Off-chain signature verification
- Bundler allowlisting
- Exchange rate support for token→gas conversion

**Key Features:**
```solidity
struct PaymasterData {
    uint48 validUntil;
    uint48 validAfter;
    uint128 sponsorUUID;      // Offchain tracking
    bool allowAnyBundler;
    bool precheckBalance;     // Check token balance first
    bool prepaymentRequired;
    address token;            // ERC-20 for payment
    address receiver;         // Fee recipient
    uint256 exchangeRate;     // Token to gas rate
    uint48 postOpGas;
}
```

**Use Case for Sweep:**
- **THIS IS THE CORE GAS ABSTRACTION** - Users pay gas in USDT/USDC
- Take dust tokens as gas payment
- Set custom exchange rates for profit margin
- Track sponsorship per user

---

### 4. **spend-permissions** - Recurring Token Allowances ⭐⭐⭐⭐
**Repo:** `coinbase/spend-permissions`

**What it does:**
- Onchain allowance accounting for smart wallets
- Recurring spend limits (e.g., 10 USDC/month)
- Time-bounded permissions
- ERC-20 and native token support
- Integrates with MagicSpend

**Key Features:**
```solidity
struct SpendPermission {
    address account;     // User's smart wallet
    address spender;     // Sweep service
    address token;       // Token to sweep
    uint160 allowance;   // Max per period
    uint48 period;       // Reset duration
    uint48 start;        // Valid from
    uint48 end;          // Valid until
    uint256 salt;
    bytes extraData;
}
```

**Use Case for Sweep:**
- Enable "auto-sweep" subscriptions
- User grants Sweep permission to sweep up to X per day/week/month
- Recurring DCA into DeFi positions
- "Set and forget" dust collection

---

### 5. **cdp-sdk** - Multi-Chain Account Management ⭐⭐⭐⭐
**Repo:** `coinbase/cdp-sdk`

**What it does:**
- Unified SDK for EVM + Solana
- Server-managed accounts (no client key management)
- Smart account creation and management
- Built-in swap functionality
- Transaction signing and sending

**Languages:** TypeScript, Python, Rust, Go

**Key Features:**
```typescript
// Create smart account
const smartAccount = await cdp.evm.createSmartAccount({ owner });

// Execute swap
const result = await smartAccount.swap({
  fromToken: "USDC",
  toToken: "WETH",
  network: "base"
});

// Send user operation
const { userOpHash } = await smartAccount.sendUserOperation({
  calls: [{ to, data, value }],
  paymasterUrl: "https://your-paymaster.com"
});
```

**Use Case for Sweep:**
- Manage user wallets on backend
- Execute swaps across chains
- Integrate with smart accounts
- Unified API for EVM + Solana

---

### 6. **agentkit** - AI Agent Integration ⭐⭐⭐
**Repo:** `coinbase/agentkit`
**Stars:** 1,031

**What it does:**
- Enable AI agents to perform onchain operations
- Built-in wallet management
- Action toolkit for common operations

**Use Case for Sweep:**
- Build AI-powered sweep assistant
- Natural language sweep commands
- Intelligent DeFi routing recommendations
- "Hey Sweep, sweep my dust into Aave"

---

## 🏗️ Architecture with Coinbase Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                        SWEEP                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │   User UI   │───▶│  Backend API │───▶│  x402 Paywall    │  │
│  │  (React)    │    │  (Node.js)   │    │  (Monetization)  │  │
│  └─────────────┘    └──────────────┘    └──────────────────┘  │
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
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │ │
│  │  │ Gas in USDC │  │ Gas in USDT │  │ Gas in Dust │       │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘       │ │
│  └───────────────────────────────────────────────────────────┘ │
│         │                                                       │
│         ▼                                                       │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                 SPEND PERMISSIONS                          │ │
│  │  "User grants Sweep 100 USDC/month sweep allowance"       │ │
│  └───────────────────────────────────────────────────────────┘ │
│         │                                                       │
│         ▼                                                       │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                DEX AGGREGATORS                             │ │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐      │ │
│  │  │  1inch  │  │ Jupiter │  │  Li.Fi  │  │  Socket │      │ │
│  │  │  (EVM)  │  │(Solana) │  │ (Cross) │  │ (Cross) │      │ │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘      │ │
│  └───────────────────────────────────────────────────────────┘ │
│         │                                                       │
│         ▼                                                       │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                    DEFI TARGETS                            │ │
│  │  ┌───────┐  ┌───────┐  ┌───────┐  ┌───────┐  ┌───────┐  │ │
│  │  │ Aave  │  │ Yearn │  │ Beefy │  │ Jito  │  │Marinade│  │ │
│  │  └───────┘  └───────┘  └───────┘  └───────┘  └───────┘  │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 💰 Revenue Model with Coinbase Stack

### 1. **Per-Sweep Fees (x402)**
- Charge 0.5-1% per sweep via x402 protocol
- USDC payment on Base (low fees)
- Automatic settlement

### 2. **Gas Spread (verifying-paymaster)**
- Set exchange rate slightly above market
- User pays 1.05 USDC for 1 USDC worth of gas
- 5% margin on gas

### 3. **Subscription Tiers (spend-permissions)**
- Free: Manual sweeps only
- Pro ($5/mo): Auto-sweep up to $100/month
- Enterprise: Custom limits + API access

### 4. **DeFi Affiliate**
- Referral fees from protocols
- Aave/Yearn/Beefy partnerships

---

## 🚀 Implementation Priority

| Priority | Component | Purpose |
|----------|-----------|---------|
| 1 | **verifying-paymaster** | Core gas abstraction - let users pay in any ERC-20 |
| 2 | **smart-wallet** | User account creation with passkeys |
| 3 | **cdp-sdk** | Backend operations, swaps, transaction management |
| 4 | **x402** | Monetization layer |
| 5 | **spend-permissions** | Auto-sweep subscriptions |
| 6 | **agentkit** | AI assistant (Phase 2) |

---

## 🔗 Deployed Contracts

### Base Mainnet
- Smart Wallet Factory: `0xBA5ED110eFDBa3D005bfC882d75358ACBbB85842`
- EntryPoint (v0.7): Standard ERC-4337 address

### Key Dependencies
- OpenZeppelin Contracts
- Account Abstraction (eth-infinitism)
- Solady (gas-optimized libs)

---

## 📚 Next Steps

1. **Fork & Deploy verifying-paymaster** - Customize for dust token acceptance
2. **Set up CDP API keys** - Get access to cdp-sdk
3. **Design user flow** - Smart wallet creation → Sweep → DeFi
4. **Build paymaster service** - Off-chain signer for gas sponsorship
5. **Integrate x402** - API monetization layer

---

## Summary

The Coinbase stack provides everything needed for Sweep:
- ✅ Gas abstraction (verifying-paymaster)
- ✅ Smart accounts (smart-wallet)
- ✅ Multi-chain support (cdp-sdk - EVM + Solana)
- ✅ Recurring permissions (spend-permissions)
- ✅ API monetization (x402)
- ✅ AI integration ready (agentkit)

This is a production-ready infrastructure stack that handles the hardest parts of what we're building!
