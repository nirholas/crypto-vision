# Smart Contracts Documentation

> **⚠️ CRITICAL: These contracts handle user funds. Audit all changes thoroughly before deployment.**

## Table of Contents

1. [Overview](#overview)
2. [Contract Architecture](#contract-architecture)
3. [Contracts Reference](#contracts-reference)
   - [SweepDustSweeper](#sweepdustsweeper)
   - [SweepBatchSwap](#sweepbatchswap)
   - [SweepPermit2Batcher](#sweeppermit2batcher)
   - [SweepVaultRouter](#sweepvaultrouter)
   - [SweepFeeCollector](#sweepfeecollector)
4. [Security Considerations](#security-considerations)
5. [Deployment](#deployment)
6. [Upgradeability](#upgradeability)
7. [Audit Status](#audit-status)

---

## Overview

The Sweep smart contract system enables gasless, multi-token sweeping with DeFi routing. The architecture consists of 5 core contracts that work together:

```
┌─────────────────────────────────────────────────────────────────┐
│                    SWEEP CONTRACT FLOW                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   User Signs Permit2 Signature                                   │
│           │                                                      │
│           ▼                                                      │
│   ┌──────────────────┐                                          │
│   │ SweepDustSweeper │ ◄─── Main Entry Point                    │
│   │  (Entry Point)   │                                          │
│   └────────┬─────────┘                                          │
│            │                                                     │
│   ┌────────┴────────┬─────────────────┐                        │
│   ▼                 ▼                 ▼                        │
│ ┌─────────────┐ ┌─────────────┐ ┌──────────────┐              │
│ │ Permit2     │ │ BatchSwap   │ │ VaultRouter  │              │
│ │ Batcher     │ │             │ │              │              │
│ │ (Transfers) │ │ (DEX Swaps) │ │ (DeFi Yield) │              │
│ └──────┬──────┘ └──────┬──────┘ └──────┬───────┘              │
│        │               │               │                       │
│        └───────────────┴───────────────┘                       │
│                        │                                        │
│                        ▼                                        │
│              ┌──────────────────┐                               │
│              │  FeeCollector    │                               │
│              │  (Protocol Fees) │                               │
│              └──────────────────┘                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Key Features

- **Single Transaction Sweeps**: Consolidate multiple tokens in one transaction
- **Permit2 Integration**: Gasless token approvals via signatures
- **DeFi Routing**: Direct deposits to Aave, Yearn, Beefy, Lido
- **Fee Management**: Configurable protocol fees with discounts
- **Reentrancy Protection**: All state-changing functions protected
- **Pausability**: Emergency pause mechanism on all contracts

---

## Contract Architecture

### Inheritance Structure

```
OpenZeppelin Contracts
├── Ownable2Step      → SweepDustSweeper, SweepVaultRouter, SweepFeeCollector
├── Ownable           → SweepBatchSwap, SweepPermit2Batcher
├── ReentrancyGuard   → All contracts
├── SafeERC20         → All contracts
└── EnumerableSet     → SweepFeeCollector
```

### Contract Addresses

| Contract | Ethereum | Base | Arbitrum | Polygon |
|----------|----------|------|----------|---------|
| SweepDustSweeper | `TBD` | `TBD` | `TBD` | `TBD` |
| SweepBatchSwap | `TBD` | `TBD` | `TBD` | `TBD` |
| SweepPermit2Batcher | `TBD` | `TBD` | `TBD` | `TBD` |
| SweepVaultRouter | `TBD` | `TBD` | `TBD` | `TBD` |
| SweepFeeCollector | `TBD` | `TBD` | `TBD` | `TBD` |
| **Permit2 (Canonical)** | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | Same | Same | Same |

---

## Contracts Reference

### SweepDustSweeper

**File**: [contracts/src/SweepDustSweeper.sol](../contracts/src/SweepDustSweeper.sol)  
**Lines**: 686  
**Inheritance**: `Ownable2Step`, `ReentrancyGuard`

The main entry point contract that orchestrates the entire sweep flow.

#### Constants

| Name | Value | Description |
|------|-------|-------------|
| `ETH_ADDRESS` | `0xEeee...EEeE` | Native ETH placeholder |
| `PERMIT2` | `0x0000...BA3` | Canonical Permit2 address |
| `MAX_BPS` | `10,000` | 100% in basis points |
| `WITNESS_TYPEHASH` | `keccak256(...)` | EIP-712 type hash for witness |

#### Enums

```solidity
enum SweepDestination {
    WALLET,     // Send to user's wallet
    AAVE,       // Deposit to Aave V3
    YEARN,      // Deposit to Yearn vault  
    BEEFY,      // Deposit to Beefy vault
    LIDO        // Stake to Lido
}
```

#### Key Structs

```solidity
struct SweepParams {
    IPermit2.PermitBatchTransferFrom permit;  // Permit2 data
    bytes signature;                           // User signature
    SweepBatchSwap.SwapParams[] swaps;        // Swap instructions
    address outputToken;                       // Target token
    uint256 minTotalOutput;                    // Slippage protection
    SweepDestination destination;              // Where to send
    address vaultAddress;                      // DeFi vault (if applicable)
    uint256 minVaultSharesOut;                 // Min shares from deposit
    address recipient;                         // Final recipient
    uint256 deadline;                          // Transaction deadline
}
```

#### Functions

| Function | Visibility | Description |
|----------|------------|-------------|
| `sweep(SweepParams)` | external | Main sweep with Permit2 |
| `sweepSimple(SimpleSweepParams)` | external | Sweep with pre-approved tokens |
| `sweepERC2612(ERC2612SweepParams)` | external | Sweep with ERC-2612 permits |
| `setVaultRouter(address)` | owner only | Update vault router |
| `setFeeCollector(address)` | owner only | Update fee collector |
| `pause(bool)` | owner only | Emergency pause |
| `rescue(token, to, amount)` | owner only | Rescue stuck tokens |

#### Events

```solidity
event SweepExecuted(
    address indexed user,
    uint256 tokensSwept,
    address outputToken,
    uint256 totalOutput,
    SweepDestination destination,
    uint256 feePaid
);
```

#### Security Features

- ✅ Two-step ownership transfer (Ownable2Step)
- ✅ Reentrancy protection on all external functions
- ✅ Deadline validation
- ✅ Minimum output slippage protection
- ✅ Pausable in emergencies
- ✅ EIP-712 typed signature validation

---

### SweepBatchSwap

**File**: [contracts/src/SweepBatchSwap.sol](../contracts/src/SweepBatchSwap.sol)  
**Lines**: 390  
**Inheritance**: `Ownable`, `ReentrancyGuard`

Handles batch execution of multiple token swaps through approved DEX routers.

#### Constants

| Name | Value | Description |
|------|-------|-------------|
| `ETH_ADDRESS` | `0xEeee...EEeE` | Native ETH placeholder |
| `MAX_BPS` | `10,000` | 100% in basis points |
| `MAX_FEE_BPS` | `500` | Maximum 5% fee |

#### Key Structs

```solidity
struct SwapParams {
    address tokenIn;       // Token to swap from
    address tokenOut;      // Token to swap to
    uint256 amountIn;      // Amount to swap
    uint256 minAmountOut;  // Minimum output (slippage)
    address router;        // DEX router address
    bytes routerData;      // Encoded swap calldata
}

struct BatchSwapParams {
    SwapParams[] swaps;    // Array of swaps
    address outputToken;   // Final output token
    address recipient;     // Where to send output
    uint256 deadline;      // Transaction deadline
}
```

#### Approved Routers

> **⚠️ SECURITY CRITICAL**: Only pre-approved routers can be called

| Router | Description | Status |
|--------|-------------|--------|
| 1inch Router v5 | Aggregation router | ✅ Approved |
| Uniswap V3 Router | Direct swaps | ✅ Approved |
| 0x Exchange Proxy | Order matching | ✅ Approved |
| CoW Protocol | MEV-protected | ✅ Approved |

#### Functions

| Function | Visibility | Description |
|----------|------------|-------------|
| `batchSwap(BatchSwapParams)` | external | Execute batch swaps |
| `approveRouter(address, bool)` | owner only | Approve/revoke router |
| `setFee(uint256)` | owner only | Update protocol fee |
| `setFeeCollector(address)` | owner only | Update fee recipient |

---

### SweepPermit2Batcher

**File**: [contracts/src/SweepPermit2Batcher.sol](../contracts/src/SweepPermit2Batcher.sol)  
**Lines**: 395  
**Inheritance**: `Ownable`, `ReentrancyGuard`

Enables gasless token transfers using Uniswap's Permit2 protocol.

#### Constants

| Name | Value | Description |
|------|-------|-------------|
| `PERMIT2` | `0x0000...BA3` | Canonical Permit2 |
| `WITNESS_TYPEHASH` | `keccak256(...)` | EIP-712 witness type |

#### Key Structs

```solidity
struct SweepBatchWitness {
    address outputToken;      // Expected output token
    uint256 minTotalOutput;   // Minimum output protection
    uint256 deadline;         // Signature deadline
    bytes32 swapsHash;        // Hash of swap params
}

struct BatchExecuteParams {
    IPermit2.PermitBatchTransferFrom permit;
    bytes signature;
    SweepBatchSwap.SwapParams[] swaps;
    address outputToken;
    uint256 minTotalOutput;
    address recipient;
    uint256 deadline;
}
```

#### EIP-712 Signature Format

```
SweepWitness(
    address outputToken,
    uint256 minOutput,
    address vaultDestination,
    uint256 deadline,
    bytes32 swapsHash
)
```

#### Security Features

- ✅ Nonce-based replay protection
- ✅ Deadline validation
- ✅ Witness verification (swap params hash)
- ✅ EIP-712 typed data signing

---

### SweepVaultRouter

**File**: [contracts/src/SweepVaultRouter.sol](../contracts/src/SweepVaultRouter.sol)  
**Lines**: 661  
**Inheritance**: `Ownable2Step`, `ReentrancyGuard`

Routes swept tokens to DeFi yield protocols.

#### Enums

```solidity
enum VaultType {
    AAVE_V3,      // Aave V3 lending pools
    YEARN_V2,     // Yearn V2 vaults
    YEARN_V3,     // Yearn V3 vaults
    BEEFY,        // Beefy autocompounding vaults
    LIDO,         // Lido stETH staking
    LIDO_WSTETH   // Lido wstETH (wrapped)
}
```

#### Constants

| Name | Value | Description |
|------|-------|-------------|
| `MAX_SLIPPAGE_BPS` | `5,000` | Maximum 50% slippage |
| `DEFAULT_SLIPPAGE_BPS` | `100` | Default 1% slippage |

#### Key Structs

```solidity
struct DepositParams {
    address vault;          // Vault/protocol address
    address token;          // Token to deposit
    uint256 amount;         // Deposit amount
    uint256 minSharesOut;   // Minimum shares received
    address recipient;      // Share recipient
    uint256 deadline;       // Transaction deadline
}
```

#### Supported Protocols

| Protocol | Networks | Function |
|----------|----------|----------|
| **Aave V3** | All EVM | `supply()` → aTokens |
| **Yearn V2** | Ethereum, Arbitrum | `deposit()` → yTokens |
| **Yearn V3** | Ethereum, Base | `deposit()` → shares |
| **Beefy** | All EVM | `deposit()` → mooTokens |
| **Lido** | Ethereum | `submit()` → stETH |

#### Functions

| Function | Visibility | Description |
|----------|------------|-------------|
| `deposit(DepositParams)` | external | Deposit to vault |
| `batchDeposit(BatchDepositParams)` | external | Multiple deposits |
| `approveVault(address, VaultType, bool)` | owner only | Approve vault |
| `setAavePool(chainId, address)` | owner only | Set Aave pool |
| `setLidoAddress(chainId, address)` | owner only | Set Lido address |

---

### SweepFeeCollector

**File**: [contracts/src/SweepFeeCollector.sol](../contracts/src/SweepFeeCollector.sol)  
**Lines**: 429  
**Inheritance**: `Ownable2Step`, `ReentrancyGuard`

Manages protocol fee collection and distribution.

#### Constants

| Name | Value | Description |
|------|-------|-------------|
| `MAX_FEE_BPS` | `500` | Maximum 5% fee |
| `DEFAULT_FEE_BPS` | `30` | Default 0.3% fee |
| `MIN_WITHDRAWAL_DELAY` | `1 hour` | Security delay |

#### Fee Structure

| Tier | Discount | Eligibility |
|------|----------|-------------|
| Standard | 0% | All users |
| Partner | 20% | Partner integrations |
| Premium | 50% | High-volume users |
| Whitelisted | 100% | Strategic partners |

#### Functions

| Function | Visibility | Description |
|----------|------------|-------------|
| `depositFee(token, amount, user)` | depositor only | Record fee deposit |
| `requestWithdrawal(token, amount)` | owner only | Initiate withdrawal |
| `executeWithdrawal(token)` | owner only | Execute after delay |
| `setFeeDiscount(address, bps)` | owner only | Set user discount |
| `toggleWithdrawalDelay(bool)` | owner only | Enable/disable delay |
| `emergencyWithdraw(token, to)` | owner only | Emergency rescue |

#### Security Features

- ✅ Time-delayed withdrawals (configurable)
- ✅ Only approved depositors can record fees
- ✅ Fee discount caps at 100%
- ✅ Emergency withdrawal mechanism

---

## Security Considerations

### Critical Security Points

> **⚠️ USER FUNDS AT RISK** - Follow these guidelines strictly

#### 1. Router Approvals

```solidity
// DANGER: Only approve verified DEX routers
function approveRouter(address router, bool approved) external onlyOwner {
    // Verify router is legitimate before approval
    approvedRouters[router] = approved;
}
```

**Risks**:
- Malicious router could steal tokens during swap
- Fake router could redirect output tokens

**Mitigations**:
- Only approve well-known, audited DEX routers
- Verify router addresses against official documentation
- Monitor for router contract upgrades

#### 2. Slippage Protection

```solidity
// Always enforce minAmountOut
if (amountOut < params.minAmountOut) revert InsufficientOutput();
```

**Risks**:
- MEV sandwich attacks
- Price manipulation
- Front-running

**Mitigations**:
- Set appropriate `minAmountOut` based on market conditions
- Use shorter deadlines (< 20 minutes)
- Consider private mempools (Flashbots, MEV Blocker)

#### 3. Permit2 Signatures

```solidity
// Verify witness hash matches swap params
bytes32 swapsHash = keccak256(abi.encode(params.swaps));
if (swapsHash != witness.swapsHash) revert InvalidWitness();
```

**Risks**:
- Signature replay attacks
- Witness manipulation
- Deadline bypass

**Mitigations**:
- Include all relevant params in witness
- Use user nonces for replay protection
- Validate deadline on-chain

#### 4. Vault Deposits

```solidity
// Validate minimum shares received
if (sharesReceived < params.minSharesOut) revert InsufficientOutput();
```

**Risks**:
- Vault manipulation before deposit
- Share price manipulation
- Rug pull vaults

**Mitigations**:
- Only approve verified vaults
- Set appropriate `minSharesOut`
- Monitor vault health metrics

### Reentrancy Protection

All contracts use OpenZeppelin's `ReentrancyGuard`:

```solidity
function batchSwap(BatchSwapParams calldata params)
    external
    payable
    nonReentrant  // ← Critical protection
    whenNotPaused
    validDeadline(params.deadline)
```

### Access Control Matrix

| Function | Owner | Approved Depositor | User |
|----------|-------|-------------------|------|
| `sweep()` | ✅ | ❌ | ✅ |
| `approveRouter()` | ✅ | ❌ | ❌ |
| `depositFee()` | ❌ | ✅ | ❌ |
| `withdrawFees()` | ✅ | ❌ | ❌ |
| `pause()` | ✅ | ❌ | ❌ |
| `rescue()` | ✅ | ❌ | ❌ |

---

## Deployment

### Prerequisites

1. **Foundry** installed
2. **Environment variables** configured
3. **Deployer wallet** funded

### Deployment Order

Contracts must be deployed in this order due to dependencies:

```bash
1. SweepFeeCollector(treasury, feeBps)
2. SweepBatchSwap(feeCollector, feeBps)
3. SweepPermit2Batcher(batchSwap)
4. SweepVaultRouter()
5. SweepDustSweeper(batchSwap, permit2Batcher, vaultRouter, feeCollector)
```

### Post-Deployment Checklist

- [ ] Transfer ownership to multisig
- [ ] Approve DEX routers on SweepBatchSwap
- [ ] Approve vaults on SweepVaultRouter
- [ ] Set protocol addresses (Aave pools, Lido, etc.)
- [ ] Approve SweepDustSweeper as fee depositor
- [ ] Enable withdrawal delay on FeeCollector
- [ ] Verify all contracts on block explorer

---

## Upgradeability

> **⚠️ IMPORTANT**: These contracts are NOT upgradeable by design.

### Rationale

1. **Security**: Upgradeable proxies add attack surface
2. **Trust**: Users can verify exactly what code handles their funds
3. **Simplicity**: No proxy admin keys to protect

### Migration Strategy

If updates are needed:

1. Deploy new contract set
2. Announce migration with timeline
3. Pause old contracts
4. Transfer treasury to new FeeCollector
5. Update frontend to use new contracts
6. Monitor for issues

---

## Audit Status

| Audit Firm | Date | Scope | Status |
|------------|------|-------|--------|
| TBD | TBD | All contracts | Pending |

### Known Issues

| ID | Severity | Description | Status |
|----|----------|-------------|--------|
| None | - | - | - |

### Bug Bounty

- **Critical**: Up to $50,000
- **High**: Up to $10,000
- **Medium**: Up to $2,500
- **Low**: Up to $500

Report vulnerabilities to: security@sweep.xyz

---

## Interface Addresses

### External Protocol Interfaces

| Protocol | Interface | Source |
|----------|-----------|--------|
| Permit2 | `IPermit2` | Uniswap |
| Aave V3 | `IAaveV3Pool` | Aave |
| Yearn | `IYearnVault` | Yearn |
| Beefy | `IBeefyVault` | Beefy |
| Lido | `ILido`, `IWstETH` | Lido |

### Interface Files

See [contracts/src/interfaces/](../contracts/src/interfaces/) for all interface definitions.
