# DeFi Protocol Integration - Sweep Yield Destinations

> **Purpose**: After users sweep their dust into a single token, route it into yield-bearing DeFi positions across EVM chains and Solana for 600,000 users.

---

## Table of Contents

1. [Aave V3](#1-aave-v3)
2. [Yearn V3](#2-yearn-v3)
3. [Beefy Finance](#3-beefy-finance)
4. [Liquid Staking Protocols](#4-liquid-staking-protocols)
5. [Yield Aggregation Strategy](#5-yield-aggregation-strategy)
6. [Position Tracking](#6-position-tracking)
7. [Withdrawal Mechanics](#7-withdrawal-mechanics)
8. [Recommended Routing Logic](#8-recommended-routing-logic)

---

## 1. Aave V3

### Overview

Aave V3 is a decentralized lending protocol. Users supply assets to earn yield from borrowers. Receipt tokens (aTokens) automatically accrue interest.

### Supported Chains & Contract Addresses

| Chain | Pool Contract | Data Provider |
|-------|---------------|---------------|
| **Ethereum** | `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2` | `0x7B4EB56E7CD4b454BA8ff71E4518426369a138a3` |
| **Polygon** | `0x794a61358D6845594F94dc1DB02A252b5b4814aD` | `0x69FA688f1Dc47d4B5d8029D5a35FB7a548310654` |
| **Arbitrum** | `0x794a61358D6845594F94dc1DB02A252b5b4814aD` | `0x69FA688f1Dc47d4B5d8029D5a35FB7a548310654` |
| **Optimism** | `0x794a61358D6845594F94dc1DB02A252b5b4814aD` | `0x69FA688f1Dc47d4B5d8029D5a35FB7a548310654` |
| **Base** | `0xA238Dd80C259a72e81d7e4664a9801593F98d1c5` | `0x2d8A3C5677189723C4cB8873CfC9C8976FDF38Ac` |
| **BNB Chain** | `0x6807dc923806fE8Fd134338EABCA509979a7e0cB` | `0x41585C50524fb8c3899B43D7D797d9486AAc94DB` |
| **Avalanche** | `0x794a61358D6845594F94dc1DB02A252b5b4814aD` | `0x69FA688f1Dc47d4B5d8029D5a35FB7a548310654` |
| **Linea** | `0x2f9bB73a8e98793e26Cb2F6C4ad037BDf1C6B269` | `0x8F44Fd754285aa6A2b8B9B97739B79746e0475a7` |

### Supply Mechanics

#### Standard Supply (Approve + Deposit)

```typescript
import { ethers } from 'ethers';

const POOL_ABI = [
  'function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external',
  'function withdraw(address asset, uint256 amount, address to) external returns (uint256)',
  'function getReserveData(address asset) external view returns (tuple)',
];

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function balanceOf(address account) external view returns (uint256)',
];

async function supplyToAave(
  signer: ethers.Signer,
  poolAddress: string,
  tokenAddress: string,
  amount: bigint
) {
  const userAddress = await signer.getAddress();
  
  // Step 1: Approve
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
  const approveTx = await token.approve(poolAddress, amount);
  await approveTx.wait();
  
  // Step 2: Supply
  const pool = new ethers.Contract(poolAddress, POOL_ABI, signer);
  const supplyTx = await pool.supply(
    tokenAddress,  // asset
    amount,        // amount
    userAddress,   // onBehalfOf
    0              // referralCode
  );
  
  return supplyTx.wait();
}
```

#### Supply with Permit (Single Transaction)

```typescript
async function supplyWithPermit(
  signer: ethers.Signer,
  poolAddress: string,
  tokenAddress: string,
  amount: bigint
) {
  const userAddress = await signer.getAddress();
  const chainId = await signer.getChainId();
  
  // Generate permit signature
  const deadline = Math.floor(Date.now() / 1000) + 3600;
  
  const token = new ethers.Contract(tokenAddress, [
    'function name() view returns (string)',
    'function nonces(address) view returns (uint256)',
  ], signer);
  
  const [name, nonce] = await Promise.all([
    token.name(),
    token.nonces(userAddress),
  ]);
  
  const domain = {
    name,
    version: '1',
    chainId,
    verifyingContract: tokenAddress,
  };
  
  const types = {
    Permit: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
  };
  
  const signature = await signer.signTypedData(domain, types, {
    owner: userAddress,
    spender: poolAddress,
    value: amount,
    nonce,
    deadline,
  });
  
  const { v, r, s } = ethers.Signature.from(signature);
  
  // Supply with permit
  const pool = new ethers.Contract(poolAddress, [
    'function supplyWithPermit(address asset, uint256 amount, address onBehalfOf, uint16 referralCode, uint256 deadline, uint8 permitV, bytes32 permitR, bytes32 permitS) external',
  ], signer);
  
  return pool.supplyWithPermit(
    tokenAddress, amount, userAddress, 0, deadline, v, r, s
  );
}
```

### aToken Mechanics

- **1:1 Peg**: aTokens maintain 1:1 value with underlying
- **Auto-Compounding**: Balance increases automatically via rebasing
- **Transferable**: Can be sent to other addresses
- **No Claim Needed**: Interest accrues directly to balance

```typescript
// Get aToken address for an asset
async function getATokenAddress(dataProvider: ethers.Contract, asset: string) {
  const { aTokenAddress } = await dataProvider.getReserveTokensAddresses(asset);
  return aTokenAddress;
}

// aToken balance = scaledBalance × normalizedIncome / RAY
const RAY = 10n ** 27n;
const actualBalance = (scaledBalance * normalizedIncome) / RAY;
```

### Gas Costs (Estimates)

| Chain | Approve | Supply | Supply w/Permit |
|-------|---------|--------|-----------------|
| **Ethereum** | ~45,000 | ~180,000 | ~210,000 |
| **Arbitrum** | ~45,000 | ~180,000 | ~210,000 |
| **Base** | ~45,000 | ~180,000 | ~210,000 |
| **Polygon** | ~45,000 | ~180,000 | ~210,000 |

**Cost Analysis** (at typical gas prices):
- Ethereum: ~$3-10 for supply
- L2s (Arbitrum, Base, Optimism): ~$0.05-0.30 for supply

### Minimum Deposits

**Protocol Minimum**: None enforced by Aave contracts

**Practical Minimums** (based on gas economics):
| Chain | Recommended Minimum |
|-------|---------------------|
| Ethereum | $50+ |
| Arbitrum | $1+ |
| Base | $1+ |
| Polygon | $0.50+ |

### SDK Integration

```bash
npm install @aave/contract-helpers @aave/math-utils
```

```typescript
import { Pool, WETHGatewayService } from '@aave/contract-helpers';
import { formatReserves, formatUserSummary } from '@aave/math-utils';

// Initialize Pool service
const pool = new Pool(provider, {
  POOL: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
  WETH_GATEWAY: '0xD322A49006FC828F9B5B37Ab215F99B4E5caB19C',
});

// Supply tokens via SDK
const supplyTxs = await pool.supply({
  user: userAddress,
  reserve: tokenAddress,
  amount: amount.toString(),
  onBehalfOf: userAddress,
  referralCode: '0',
});

// Execute transactions
for (const tx of supplyTxs) {
  const response = await signer.sendTransaction(tx);
  await response.wait();
}

// For native ETH deposits
const wethGateway = new WETHGatewayService(provider, {
  WETH_GATEWAY: '0xD322A49006FC828F9B5B37Ab215F99B4E5caB19C',
  POOL: poolAddress,
});

const ethDepositTxs = await wethGateway.depositETH({
  lendingPool: poolAddress,
  user: userAddress,
  amount: ethers.parseEther('1').toString(),
});
```

### Query Current APY

```typescript
import { formatReserves } from '@aave/math-utils';

// Fetch reserve data from subgraph or contracts
const formattedReserves = formatReserves({
  reserves: rawReservesData,
  currentTimestamp: Math.floor(Date.now() / 1000),
  marketReferenceCurrencyDecimals: 8,
  marketReferencePriceInUsd: baseCurrencyPriceInUsd,
});

// Find specific asset APY
const usdcReserve = formattedReserves.find(r => r.symbol === 'USDC');
console.log('Supply APY:', parseFloat(usdcReserve.supplyAPY) * 100, '%');
// Typical output: 3-5% for stablecoins
```

---

## 2. Yearn V3

### Overview

Yearn V3 is an auto-compounding yield aggregator that deploys capital to various DeFi strategies automatically. Users deposit tokens and receive vault shares (yTokens) that appreciate in value.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    YEARN V3 ARCHITECTURE                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  User → [Vault] → [Strategy 1] → Protocol A (Aave)         │
│              │                                              │
│              └─→ [Strategy 2] → Protocol B (Compound)       │
│              │                                              │
│              └─→ [Strategy 3] → Protocol C (Curve)          │
│                                                             │
│  Vault shares (yToken) represent proportional ownership     │
│  Strategies harvest and compound automatically              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Supported Chains

| Chain | Registry Address | Status |
|-------|------------------|--------|
| **Ethereum** | `0x5C62E9B26e666f7E8e5A9B8b1e9f8b8e8e8e8e8e` | Active |
| **Polygon** | `0x79286Dd38C9bC6CCb3670dCC96F2f4A4e8b8E8e8` | Active |
| **Arbitrum** | `0x3199437193625DCcD6F9C9e98BDf93582200Eb1f` | Active |
| **Base** | `0xF3885eDe00171997BFadAa98E01E167B53a78Ec5` | Active |
| **Optimism** | `0x444045c5C13C246e117eD36437303cac8E250aB0` | Active |

### Vault Deposit Mechanics

```solidity
// Yearn V3 Vault Interface
interface IYearnVault {
    // Deposit underlying tokens, receive vault shares
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
    
    // Deposit with slippage protection
    function deposit(uint256 assets, address receiver, uint256 maxLoss) external returns (uint256 shares);
    
    // Withdraw shares for underlying tokens
    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares);
    
    // Redeem shares for underlying
    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets);
    
    // Preview functions
    function previewDeposit(uint256 assets) external view returns (uint256 shares);
    function previewWithdraw(uint256 assets) external view returns (uint256 shares);
    function previewRedeem(uint256 shares) external view returns (uint256 assets);
    
    // Conversion helpers
    function convertToShares(uint256 assets) external view returns (uint256);
    function convertToAssets(uint256 shares) external view returns (uint256);
    
    // Total assets under management
    function totalAssets() external view returns (uint256);
    
    // Current price per share
    function pricePerShare() external view returns (uint256);
    
    // Underlying token
    function asset() external view returns (address);
}
```

### TypeScript Integration

```typescript
const YEARN_VAULT_ABI = [
  'function deposit(uint256 assets, address receiver) external returns (uint256 shares)',
  'function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares)',
  'function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets)',
  'function previewDeposit(uint256 assets) external view returns (uint256)',
  'function pricePerShare() external view returns (uint256)',
  'function totalAssets() external view returns (uint256)',
  'function asset() external view returns (address)',
  'function balanceOf(address) external view returns (uint256)',
];

async function depositToYearn(
  signer: ethers.Signer,
  vaultAddress: string,
  amount: bigint
) {
  const userAddress = await signer.getAddress();
  const vault = new ethers.Contract(vaultAddress, YEARN_VAULT_ABI, signer);
  
  // Get underlying token
  const assetAddress = await vault.asset();
  const asset = new ethers.Contract(assetAddress, ERC20_ABI, signer);
  
  // Approve vault to spend tokens
  await (await asset.approve(vaultAddress, amount)).wait();
  
  // Preview shares to receive
  const expectedShares = await vault.previewDeposit(amount);
  console.log(`Expected shares: ${expectedShares}`);
  
  // Deposit
  const tx = await vault.deposit(amount, userAddress);
  const receipt = await tx.wait();
  
  return { receipt, expectedShares };
}

async function withdrawFromYearn(
  signer: ethers.Signer,
  vaultAddress: string,
  sharesToRedeem: bigint
) {
  const userAddress = await signer.getAddress();
  const vault = new ethers.Contract(vaultAddress, YEARN_VAULT_ABI, signer);
  
  // Preview assets to receive
  const expectedAssets = await vault.previewRedeem(sharesToRedeem);
  
  // Redeem shares for underlying
  const tx = await vault.redeem(sharesToRedeem, userAddress, userAddress);
  return tx.wait();
}
```

### Yearn API

```typescript
// Yearn V3 API - Get all vaults
const YEARN_API = 'https://api.yearn.fi/v1/chains';

interface YearnVault {
  address: string;
  name: string;
  symbol: string;
  token: {
    address: string;
    symbol: string;
    decimals: number;
  };
  tvl: {
    totalAssets: string;
    tvl: number;
  };
  apy: {
    net_apy: number;
    fees: {
      performance: number;
      management: number;
    };
  };
  strategies: Strategy[];
}

async function getYearnVaults(chainId: number): Promise<YearnVault[]> {
  const response = await fetch(`${YEARN_API}/${chainId}/vaults/all`);
  return response.json();
}

async function getVaultAPY(vaultAddress: string, chainId: number) {
  const vaults = await getYearnVaults(chainId);
  const vault = vaults.find(v => v.address.toLowerCase() === vaultAddress.toLowerCase());
  return vault?.apy?.net_apy || 0;
}

// Find best vault for a token
async function findBestVaultForToken(tokenAddress: string, chainId: number) {
  const vaults = await getYearnVaults(chainId);
  const tokenVaults = vaults.filter(
    v => v.token.address.toLowerCase() === tokenAddress.toLowerCase()
  );
  
  // Sort by APY descending
  tokenVaults.sort((a, b) => (b.apy?.net_apy || 0) - (a.apy?.net_apy || 0));
  
  return tokenVaults[0];
}
```

### yToken/Share Mechanics

- **ERC-4626 Standard**: Yearn V3 implements the tokenized vault standard
- **Share Appreciation**: Share value increases as vault earns yield
- **No Rebasing**: Unlike aTokens, balance stays constant; value per share increases

```typescript
// Calculate current value of user's position
async function getPositionValue(vault: ethers.Contract, userAddress: string) {
  const shares = await vault.balanceOf(userAddress);
  const assetsValue = await vault.convertToAssets(shares);
  return assetsValue;
}

// Track value over time
// Initial: 100 shares × 1.0 price = 100 tokens
// After 1 year: 100 shares × 1.05 price = 105 tokens (5% APY)
```

### Gas Costs

| Chain | Approve | Deposit | Withdraw |
|-------|---------|---------|----------|
| **Ethereum** | ~45,000 | ~150,000 | ~180,000 |
| **Arbitrum** | ~45,000 | ~150,000 | ~180,000 |
| **Base** | ~45,000 | ~150,000 | ~180,000 |

### Minimum Deposits

- **Protocol Minimum**: None enforced
- **Practical Minimum**: $10+ on Ethereum, $1+ on L2s

---

## 3. Beefy Finance

### Overview

Beefy is a decentralized multi-chain yield optimizer that auto-compounds rewards across 20+ chains. It simplifies DeFi yield farming by automating harvest and reinvestment.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    BEEFY ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  User Deposits → [Beefy Vault] → [Strategy] → Underlying   │
│                                                             │
│  mooToken (receipt) ← Vault tracks share of pool           │
│                                                             │
│  Strategy Actions:                                          │
│  1. Deposit to underlying (LP, lending, staking)           │
│  2. Harvest rewards periodically                           │
│  3. Swap rewards to base asset                             │
│  4. Reinvest (compound)                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Supported Chains (20+)

| Chain | Vault Count | Example Vaults |
|-------|-------------|----------------|
| **Ethereum** | 50+ | USDC, ETH, wstETH |
| **BNB Chain** | 200+ | BUSD, CAKE, BNB |
| **Polygon** | 150+ | USDC, MATIC, AAVE |
| **Arbitrum** | 100+ | ETH, USDC, GMX |
| **Optimism** | 80+ | OP, ETH, USDC |
| **Base** | 50+ | ETH, USDC |
| **Avalanche** | 100+ | AVAX, USDC, JOE |
| **Fantom** | 80+ | FTM, USDC |
| **Cronos** | 40+ | CRO, USDC |
| **Gnosis** | 30+ | xDAI, GNO |
| **Linea** | 20+ | ETH, USDC |

### Beefy API

```typescript
const BEEFY_API = 'https://api.beefy.finance';

// Get all vaults
async function getAllVaults() {
  const response = await fetch(`${BEEFY_API}/vaults`);
  return response.json();
}

// Get APYs for all vaults
async function getVaultApys() {
  const response = await fetch(`${BEEFY_API}/apy`);
  return response.json();
}

// Get TVL data
async function getTvls() {
  const response = await fetch(`${BEEFY_API}/tvl`);
  return response.json();
}

// Get vault prices (price per share)
async function getPrices() {
  const response = await fetch(`${BEEFY_API}/lps`);
  return response.json();
}

// Beefy Vault Interface
interface BeefyVault {
  id: string;
  name: string;
  token: string;
  tokenAddress: string;
  earnedToken: string;           // mooToken symbol
  earnedTokenAddress: string;    // Vault address
  earnContractAddress: string;   // Strategy address
  chain: string;
  status: 'active' | 'paused' | 'eol';
  platformId: string;            // e.g., 'aave', 'curve', 'uniswap'
  assets: string[];
  risks: string[];
  strategyTypeId: string;
  buyTokenUrl?: string;
  addLiquidityUrl?: string;
}

// Find vaults by chain and token
async function findVaults(chain: string, tokenSymbol: string) {
  const vaults = await getAllVaults();
  const apys = await getVaultApys();
  
  return vaults
    .filter(v => 
      v.chain === chain && 
      v.status === 'active' &&
      v.assets.some(a => a.toLowerCase() === tokenSymbol.toLowerCase())
    )
    .map(v => ({
      ...v,
      apy: apys[v.id] || 0
    }))
    .sort((a, b) => b.apy - a.apy);
}
```

### Vault Deposit Mechanics

```solidity
// Beefy Vault Interface (mooToken)
interface IBeefyVault {
    // Deposit underlying tokens
    function deposit(uint256 _amount) external;
    
    // Deposit all tokens user has approved
    function depositAll() external;
    
    // Withdraw shares for underlying
    function withdraw(uint256 _shares) external;
    
    // Withdraw all shares
    function withdrawAll() external;
    
    // Price per share (in underlying decimals)
    function getPricePerFullShare() external view returns (uint256);
    
    // Total underlying in vault
    function balance() external view returns (uint256);
    
    // Underlying token address
    function want() external view returns (address);
    
    // Strategy address
    function strategy() external view returns (address);
}
```

### TypeScript Integration

```typescript
const BEEFY_VAULT_ABI = [
  'function deposit(uint256 _amount) external',
  'function depositAll() external',
  'function withdraw(uint256 _shares) external',
  'function withdrawAll() external',
  'function getPricePerFullShare() external view returns (uint256)',
  'function balance() external view returns (uint256)',
  'function want() external view returns (address)',
  'function balanceOf(address) external view returns (uint256)',
];

async function depositToBeefy(
  signer: ethers.Signer,
  vaultAddress: string,
  amount: bigint
) {
  const vault = new ethers.Contract(vaultAddress, BEEFY_VAULT_ABI, signer);
  
  // Get underlying token
  const wantAddress = await vault.want();
  const want = new ethers.Contract(wantAddress, ERC20_ABI, signer);
  
  // Approve vault
  await (await want.approve(vaultAddress, amount)).wait();
  
  // Get price per share before deposit (for share calculation)
  const pricePerShare = await vault.getPricePerFullShare();
  
  // Deposit
  const tx = await vault.deposit(amount);
  const receipt = await tx.wait();
  
  return { receipt, pricePerShare };
}

async function withdrawFromBeefy(
  signer: ethers.Signer,
  vaultAddress: string,
  shares: bigint
) {
  const vault = new ethers.Contract(vaultAddress, BEEFY_VAULT_ABI, signer);
  
  // Get expected output
  const pricePerShare = await vault.getPricePerFullShare();
  const expectedOutput = (shares * pricePerShare) / (10n ** 18n);
  
  const tx = await vault.withdraw(shares);
  return tx.wait();
}

// Calculate current value
async function getBeefyPositionValue(
  vaultAddress: string,
  userAddress: string,
  provider: ethers.Provider
) {
  const vault = new ethers.Contract(vaultAddress, BEEFY_VAULT_ABI, provider);
  
  const shares = await vault.balanceOf(userAddress);
  const pricePerShare = await vault.getPricePerFullShare();
  
  // Value = shares × pricePerShare / 1e18
  const value = (shares * pricePerShare) / (10n ** 18n);
  
  return { shares, pricePerShare, value };
}
```

### Auto-Compounding Mechanics

```
Compounding Frequency: Every 1-24 hours (varies by vault)

Process:
1. Strategy harvests rewards from underlying protocol
2. Rewards swapped to underlying token via DEX
3. Underlying re-deposited to protocol
4. pricePerFullShare increases
5. User's shares now worth more

No user action required - fully automated
```

### Gas Costs

| Chain | Deposit | Withdraw |
|-------|---------|----------|
| **Ethereum** | ~200,000 | ~250,000 |
| **BNB Chain** | ~200,000 | ~250,000 |
| **Arbitrum** | ~200,000 | ~250,000 |
| **Base** | ~200,000 | ~250,000 |
| **Polygon** | ~200,000 | ~250,000 |

### Beefy Vault Discovery

```typescript
// Complete vault discovery flow
async function discoverBestVault(
  chain: string,
  tokenAddress: string,
  minTvl: number = 100000  // $100k minimum TVL
) {
  const vaults = await getAllVaults();
  const apys = await getVaultApys();
  const tvls = await getTvls();
  
  // Filter and sort
  const candidates = vaults
    .filter(v => 
      v.chain === chain &&
      v.status === 'active' &&
      v.tokenAddress?.toLowerCase() === tokenAddress.toLowerCase()
    )
    .map(v => ({
      ...v,
      apy: apys[v.id] || 0,
      tvl: tvls[v.id] || 0,
    }))
    .filter(v => v.tvl >= minTvl)
    .sort((a, b) => b.apy - a.apy);
  
  return candidates[0];  // Highest APY vault with sufficient TVL
}
```

---

## 4. Liquid Staking Protocols

### 4.1 Lido (stETH/wstETH)

#### Overview
Lido is the largest liquid staking protocol. Users stake ETH and receive stETH, a liquid token representing their staked position. wstETH is a wrapped, non-rebasing version.

#### Contract Addresses

| Contract | Ethereum Address |
|----------|------------------|
| **Lido (stETH)** | `0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84` |
| **wstETH** | `0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0` |
| **Withdrawal Queue** | `0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1` |

#### Deposit Flow

```typescript
// Lido stETH Interface
interface ILido {
  // Stake ETH, receive stETH
  function submit(address _referral) external payable returns (uint256);
  
  // Get stETH balance (rebasing)
  function balanceOf(address _account) external view returns (uint256);
  
  // Get shares (non-rebasing internal accounting)
  function sharesOf(address _account) external view returns (uint256);
  
  // Convert shares to stETH amount
  function getPooledEthByShares(uint256 _shares) external view returns (uint256);
  
  // Current APR
  function getCurrentStakeLimit() external view returns (uint256);
}

// wstETH Interface (wrapped stETH - non-rebasing)
interface IWstETH {
  // Wrap stETH to wstETH
  function wrap(uint256 _stETHAmount) external returns (uint256);
  
  // Unwrap wstETH to stETH
  function unwrap(uint256 _wstETHAmount) external returns (uint256);
  
  // Get stETH amount for wstETH amount
  function getStETHByWstETH(uint256 _wstETHAmount) external view returns (uint256);
  
  // Get wstETH amount for stETH amount
  function getWstETHByStETH(uint256 _stETHAmount) external view returns (uint256);
  
  // Current exchange rate
  function stEthPerToken() external view returns (uint256);
}
```

#### Staking Implementation

```typescript
const LIDO_ADDRESS = '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84';
const WSTETH_ADDRESS = '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0';

async function stakeETHWithLido(
  signer: ethers.Signer,
  ethAmount: bigint,
  wrapToWstETH: boolean = true
) {
  const userAddress = await signer.getAddress();
  
  // Step 1: Stake ETH → stETH
  const lido = new ethers.Contract(LIDO_ADDRESS, [
    'function submit(address _referral) external payable returns (uint256)',
  ], signer);
  
  const stakeTx = await lido.submit(
    ethers.ZeroAddress,  // referral (can use your address for tracking)
    { value: ethAmount }
  );
  await stakeTx.wait();
  
  if (!wrapToWstETH) {
    return { token: 'stETH', amount: ethAmount };
  }
  
  // Step 2: Wrap stETH → wstETH (recommended for DeFi composability)
  const stETH = new ethers.Contract(LIDO_ADDRESS, ERC20_ABI, signer);
  const stETHBalance = await stETH.balanceOf(userAddress);
  
  // Approve wstETH contract
  await (await stETH.approve(WSTETH_ADDRESS, stETHBalance)).wait();
  
  // Wrap
  const wstETH = new ethers.Contract(WSTETH_ADDRESS, [
    'function wrap(uint256 _stETHAmount) external returns (uint256)',
  ], signer);
  
  const wrapTx = await wstETH.wrap(stETHBalance);
  const receipt = await wrapTx.wait();
  
  return { token: 'wstETH', receipt };
}
```

#### stETH vs wstETH

| Feature | stETH | wstETH |
|---------|-------|--------|
| **Rebasing** | Yes - balance increases daily | No - value per token increases |
| **DeFi Compatible** | Limited (rebasing issues) | Yes - preferred for DeFi |
| **Exchange Rate** | 1 stETH ≈ 1 ETH | 1 wstETH ≈ 1.15+ ETH (increases) |
| **Tracking** | Complex (balance changes) | Simple (balance constant) |

**Recommendation**: Use wstETH for Sweep positions - easier to track.

#### Current APY
- **Lido stETH APY**: ~3.5-4.5% (variable based on Ethereum staking rewards)
- Check live: `https://lido.fi/ethereum`

### 4.2 Rocket Pool (rETH)

#### Overview
Rocket Pool is a decentralized liquid staking protocol. Users stake ETH and receive rETH, which appreciates in value over time (non-rebasing).

#### Contract Addresses

| Contract | Ethereum Address |
|----------|------------------|
| **rETH Token** | `0xae78736Cd615f374D3085123A210448E74Fc6393` |
| **Deposit Pool** | `0xDD3f50F8A6CafbE9b31a427582963f465E745AF8` |
| **Storage** | `0x1d8f8f00cfa6758d7bE78336684788Fb0ee0Fa46` |

#### Deposit Flow

```typescript
// Rocket Pool Deposit Interface
interface IRocketDepositPool {
  // Deposit ETH, receive rETH
  function deposit() external payable;
  
  // Get current deposit pool balance
  function getBalance() external view returns (uint256);
  
  // Check if deposits are enabled
  function getDepositEnabled() external view returns (bool);
  
  // Get maximum deposit size
  function getMaximumDepositPoolSize() external view returns (uint256);
}

// rETH Token Interface
interface IRocketTokenRETH {
  // Get ETH value of rETH amount
  function getEthValue(uint256 _rethAmount) external view returns (uint256);
  
  // Get rETH amount for ETH value
  function getRethValue(uint256 _ethAmount) external view returns (uint256);
  
  // Current exchange rate (ETH per rETH)
  function getExchangeRate() external view returns (uint256);
  
  // Burn rETH to receive ETH (if pool has liquidity)
  function burn(uint256 _rethAmount) external;
}
```

#### Staking Implementation

```typescript
const ROCKET_DEPOSIT_POOL = '0xDD3f50F8A6CafbE9b31a427582963f465E745AF8';
const RETH_ADDRESS = '0xae78736Cd615f374D3085123A210448E74Fc6393';

async function stakeETHWithRocketPool(
  signer: ethers.Signer,
  ethAmount: bigint
) {
  // Check if deposits are enabled
  const depositPool = new ethers.Contract(ROCKET_DEPOSIT_POOL, [
    'function deposit() external payable',
    'function getDepositEnabled() external view returns (bool)',
    'function getBalance() external view returns (uint256)',
  ], signer);
  
  const depositsEnabled = await depositPool.getDepositEnabled();
  if (!depositsEnabled) {
    throw new Error('Rocket Pool deposits temporarily disabled');
  }
  
  // Check deposit pool has capacity
  const poolBalance = await depositPool.getBalance();
  const maxSize = await depositPool.getMaximumDepositPoolSize();
  if (poolBalance + ethAmount > maxSize) {
    throw new Error('Deposit would exceed pool capacity');
  }
  
  // Deposit ETH → receive rETH
  const tx = await depositPool.deposit({ value: ethAmount });
  return tx.wait();
}

// Get rETH exchange rate
async function getRETHExchangeRate(provider: ethers.Provider) {
  const reth = new ethers.Contract(RETH_ADDRESS, [
    'function getExchangeRate() external view returns (uint256)',
  ], provider);
  
  const rate = await reth.getExchangeRate();
  // Rate is in wei, 1e18 = 1 ETH per rETH
  return Number(rate) / 1e18;
}
```

#### Current APY
- **Rocket Pool rETH APY**: ~3.3-4.2% (slightly lower than Lido due to protocol fee)
- Check live: `https://rocketscan.io/`

### 4.3 Jito (Solana - jitoSOL)

#### Overview
Jito is the leading liquid staking protocol on Solana, offering MEV rewards in addition to staking yield.

#### Program Addresses

| Component | Address |
|-----------|---------|
| **Stake Pool** | `Jito4APyf642JPZPx3hGc6WWJ8zPKtRbRs4P815Awbb` |
| **jitoSOL Mint** | `J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn` |

#### Deposit Flow

```typescript
import { 
  Connection, 
  PublicKey, 
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL 
} from '@solana/web3.js';
import { 
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';

const JITO_STAKE_POOL = new PublicKey('Jito4APyf642JPZPx3hGc6WWJ8zPKtRbRs4P815Awbb');
const JITO_SOL_MINT = new PublicKey('J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn');

// Jito Stake Pool Program
const JITO_PROGRAM_ID = new PublicKey('SPoo1Ku8WFXoNDMHPsrGSTSG1Y47rzgn41SLUNakuHy');

async function stakeSOLWithJito(
  connection: Connection,
  wallet: any,  // Solana wallet adapter
  lamports: number
) {
  const userPubkey = wallet.publicKey;
  
  // Get or create jitoSOL token account
  const jitoSolAta = await getAssociatedTokenAddress(
    JITO_SOL_MINT,
    userPubkey
  );
  
  const tx = new Transaction();
  
  // Create ATA if needed
  const ataInfo = await connection.getAccountInfo(jitoSolAta);
  if (!ataInfo) {
    tx.add(createAssociatedTokenAccountInstruction(
      userPubkey,
      jitoSolAta,
      userPubkey,
      JITO_SOL_MINT
    ));
  }
  
  // Add stake instruction (using Jito SDK or manual instruction)
  // Jito provides an SDK: @jito-foundation/jito-ts
  
  // For direct integration, use Jito's deposit instruction
  // This requires building the instruction manually with proper accounts
  
  return wallet.sendTransaction(tx, connection);
}

// Using Jito SDK (recommended)
import { StakePoolSDK } from '@jito-foundation/jito-ts';

async function stakeWithJitoSDK(
  connection: Connection,
  wallet: any,
  solAmount: number
) {
  const sdk = new StakePoolSDK(connection);
  
  const { transaction } = await sdk.depositSol(
    wallet.publicKey,
    solAmount * LAMPORTS_PER_SOL
  );
  
  return wallet.sendTransaction(transaction, connection);
}
```

#### Current APY
- **Jito jitoSOL APY**: ~7-8% (includes MEV rewards)
- Higher than other Solana LSTs due to MEV revenue sharing
- Check live: `https://www.jito.network/`

### 4.4 Marinade (Solana - mSOL)

#### Overview
Marinade is a decentralized liquid staking protocol on Solana that distributes stake across 100+ validators.

#### Program Addresses

| Component | Address |
|-----------|---------|
| **Marinade Finance** | `MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD` |
| **mSOL Mint** | `mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So` |

#### Deposit Flow

```typescript
import { Marinade, MarinadeConfig } from '@marinade.finance/marinade-ts-sdk';

async function stakeSOLWithMarinade(
  connection: Connection,
  wallet: any,
  solAmount: number
) {
  const config = new MarinadeConfig({
    connection,
    publicKey: wallet.publicKey,
  });
  
  const marinade = new Marinade(config);
  
  // Deposit SOL → receive mSOL
  const { transaction } = await marinade.deposit(solAmount);
  
  return wallet.sendTransaction(transaction, connection);
}

// Liquid unstake (instant, small fee)
async function liquidUnstake(
  connection: Connection,
  wallet: any,
  msolAmount: number
) {
  const config = new MarinadeConfig({
    connection,
    publicKey: wallet.publicKey,
  });
  
  const marinade = new Marinade(config);
  
  // Instant unstake with ~0.3% fee
  const { transaction } = await marinade.liquidUnstake(msolAmount);
  
  return wallet.sendTransaction(transaction, connection);
}

// Delayed unstake (no fee, ~2-3 days)
async function delayedUnstake(
  connection: Connection,
  wallet: any,
  msolAmount: number
) {
  const config = new MarinadeConfig({
    connection,
    publicKey: wallet.publicKey,
  });
  
  const marinade = new Marinade(config);
  
  // Create unstake ticket
  const { transaction } = await marinade.orderUnstake(msolAmount);
  
  return wallet.sendTransaction(transaction, connection);
}
```

#### Current APY
- **Marinade mSOL APY**: ~6.5-7.5%
- Check live: `https://marinade.finance/`

### Liquid Staking Comparison

| Protocol | Chain | Token | APY | Rebasing | Min Stake | Withdrawal |
|----------|-------|-------|-----|----------|-----------|------------|
| **Lido** | Ethereum | stETH/wstETH | 3.5-4.5% | stETH: Yes, wstETH: No | None | Queue (days) or DEX |
| **Rocket Pool** | Ethereum | rETH | 3.3-4.2% | No | None | Burn or DEX |
| **Jito** | Solana | jitoSOL | 7-8% | No | None | Instant or delayed |
| **Marinade** | Solana | mSOL | 6.5-7.5% | No | None | Instant (0.3% fee) or delayed |

---

## 5. Yield Aggregation Strategy

### Protocol Selection Logic

```typescript
interface YieldOpportunity {
  protocol: string;
  chain: number;
  token: string;
  vaultAddress: string;
  apy: number;
  tvl: number;
  riskScore: number;  // 1-10, lower is safer
  minDeposit: bigint;
  gasCost: bigint;
}

// Risk scoring factors
const RISK_FACTORS = {
  PROTOCOL_AGE: 0.2,      // Older = safer
  TVL: 0.25,              // Higher TVL = safer
  AUDIT_COUNT: 0.2,       // More audits = safer
  SMART_CONTRACT_RISK: 0.2,
  CHAIN_RISK: 0.15,       // L1 safer than L2
};

// Protocol risk scores (1-10, lower is safer)
const PROTOCOL_RISK = {
  'aave': 2,
  'yearn': 3,
  'beefy': 4,
  'lido': 2,
  'rocketpool': 3,
  'jito': 4,
  'marinade': 4,
};

function selectBestYield(
  opportunities: YieldOpportunity[],
  userRiskTolerance: 'conservative' | 'moderate' | 'aggressive',
  minTvl: number = 1000000
): YieldOpportunity {
  // Filter by minimum TVL
  const filtered = opportunities.filter(o => o.tvl >= minTvl);
  
  // Risk tolerance thresholds
  const maxRisk = {
    conservative: 3,
    moderate: 5,
    aggressive: 8,
  }[userRiskTolerance];
  
  // Filter by risk
  const safeOpportunities = filtered.filter(o => o.riskScore <= maxRisk);
  
  // Calculate risk-adjusted APY
  const scored = safeOpportunities.map(o => ({
    ...o,
    adjustedApy: o.apy * (1 - o.riskScore / 20),  // Penalize higher risk
  }));
  
  // Sort by adjusted APY
  scored.sort((a, b) => b.adjustedApy - a.adjustedApy);
  
  return scored[0];
}
```

### Routing Decision Tree

```
                    ┌─────────────────────────┐
                    │   Swept Token Type?     │
                    └───────────┬─────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
   ┌─────────┐           ┌─────────────┐          ┌─────────┐
   │  ETH    │           │ Stablecoins │          │  Other  │
   └────┬────┘           │(USDC/USDT)  │          └────┬────┘
        │                └──────┬──────┘               │
        │                       │                      │
        ▼                       ▼                      ▼
┌───────────────┐      ┌───────────────┐      ┌───────────────┐
│ Amount > $100?│      │ Chain?        │      │ Swap to ETH   │
└───────┬───────┘      └───────┬───────┘      │ or stablecoin │
        │                      │              └───────┬───────┘
   Yes  │  No                  │                      │
        │   │         ┌────────┴────────┐             │
        ▼   ▼         ▼                 ▼             ▼
   ┌────────────┐  ┌─────────┐    ┌─────────────┐  ┌─────────┐
   │ Lido/wstETH│  │ Beefy   │    │ Aave (L2)   │  │ Re-route│
   │ (if ETH L1)│  │ ETH     │    │ Best APY    │  │ from    │
   │ or rETH    │  │ Vault   │    │             │  │ start   │
   └────────────┘  └─────────┘    └─────────────┘  └─────────┘

SOLANA PATH:
                    ┌─────────────────────────┐
                    │   Token Type?           │
                    └───────────┬─────────────┘
                                │
                ┌───────────────┴───────────────┐
                │                               │
                ▼                               ▼
           ┌─────────┐                    ┌─────────────┐
           │   SOL   │                    │ SPL Token   │
           └────┬────┘                    └──────┬──────┘
                │                                │
                ▼                                ▼
        ┌───────────────┐              ┌───────────────┐
        │ Jito jitoSOL  │              │ Swap to SOL   │
        │ (higher MEV   │              │ via Jupiter   │
        │  rewards)     │              │ then Jito     │
        │ OR            │              └───────────────┘
        │ Marinade mSOL │
        └───────────────┘
```

### Token-to-Protocol Mapping

```typescript
const ROUTING_TABLE: Record<string, Record<number, string>> = {
  // ETH routing
  'ETH': {
    1: 'lido',        // Mainnet → Lido (wstETH)
    10: 'aave',       // Optimism → Aave
    42161: 'aave',    // Arbitrum → Aave
    8453: 'aave',     // Base → Aave
    137: 'aave',      // Polygon → Aave
  },
  
  // Stablecoin routing (USDC)
  'USDC': {
    1: 'yearn',       // Mainnet → Yearn (gas efficient)
    10: 'aave',       // Optimism → Aave
    42161: 'aave',    // Arbitrum → Aave
    8453: 'aave',     // Base → Aave
    137: 'aave',      // Polygon → Aave
    56: 'beefy',      // BNB → Beefy
  },
  
  // USDT routing
  'USDT': {
    1: 'yearn',
    10: 'aave',
    42161: 'aave',
    8453: 'aave',
    137: 'aave',
    56: 'beefy',
  },
  
  // SOL routing (Solana)
  'SOL': {
    'solana': 'jito',  // Jito for MEV rewards
  },
};

function getProtocolForToken(token: string, chainId: number): string {
  return ROUTING_TABLE[token]?.[chainId] || 'beefy';  // Default to Beefy
}
```

### APY Aggregation Service

```typescript
interface APYSource {
  protocol: string;
  fetchAPY: (chainId: number, token: string) => Promise<number>;
}

const APY_SOURCES: APYSource[] = [
  {
    protocol: 'aave',
    fetchAPY: async (chainId, token) => {
      // Use Aave subgraph or SDK
      const reserves = await fetchAaveReserves(chainId);
      const reserve = reserves.find(r => r.symbol === token);
      return parseFloat(reserve?.supplyAPY || '0') * 100;
    },
  },
  {
    protocol: 'yearn',
    fetchAPY: async (chainId, token) => {
      const vaults = await getYearnVaults(chainId);
      const vault = vaults.find(v => v.token.symbol === token);
      return (vault?.apy?.net_apy || 0) * 100;
    },
  },
  {
    protocol: 'beefy',
    fetchAPY: async (chainId, token) => {
      const apys = await fetch('https://api.beefy.finance/apy').then(r => r.json());
      // Find best vault for token on chain
      const vaults = await getAllVaults();
      const chainVault = vaults.find(
        v => v.chain === CHAIN_NAMES[chainId] && v.token === token
      );
      return chainVault ? (apys[chainVault.id] || 0) * 100 : 0;
    },
  },
];

async function getBestAPY(chainId: number, token: string) {
  const results = await Promise.all(
    APY_SOURCES.map(async source => ({
      protocol: source.protocol,
      apy: await source.fetchAPY(chainId, token),
    }))
  );
  
  return results.reduce((best, current) => 
    current.apy > best.apy ? current : best
  );
}
```

---

## 6. Position Tracking

### Unified Position Schema

```typescript
interface DeFiPosition {
  id: string;                    // Unique position ID
  userId: string;                // User wallet address
  protocol: 'aave' | 'yearn' | 'beefy' | 'lido' | 'rocketpool' | 'jito' | 'marinade';
  chain: number | 'solana';
  
  // Deposit info
  depositToken: string;          // Original token deposited
  depositAmount: bigint;         // Amount deposited
  depositTxHash: string;         // Deposit transaction
  depositTimestamp: number;      // Unix timestamp
  
  // Position info  
  receiptToken: string;          // aToken, yToken, mooToken, etc.
  receiptTokenAddress: string;   // Receipt token contract
  receiptAmount: bigint;         // Shares received
  vaultAddress: string;          // Vault/pool address
  
  // Current value (updated periodically)
  currentValue: bigint;          // Current value in deposit token
  unrealizedPnl: bigint;         // Profit/loss
  apy: number;                   // Current APY
  
  // Status
  status: 'active' | 'withdrawn' | 'migrated';
  lastUpdated: number;
}

// Position tracker class
class PositionTracker {
  private positions: Map<string, DeFiPosition> = new Map();
  
  async trackDeposit(params: {
    userId: string;
    protocol: string;
    chain: number;
    depositToken: string;
    depositAmount: bigint;
    receiptToken: string;
    receiptAmount: bigint;
    vaultAddress: string;
    txHash: string;
  }): Promise<DeFiPosition> {
    const position: DeFiPosition = {
      id: `${params.userId}-${params.protocol}-${params.chain}-${Date.now()}`,
      ...params,
      depositTimestamp: Date.now(),
      currentValue: params.depositAmount,
      unrealizedPnl: 0n,
      apy: 0,
      status: 'active',
      lastUpdated: Date.now(),
    };
    
    this.positions.set(position.id, position);
    await this.persistPosition(position);
    
    return position;
  }
  
  async updatePositionValue(positionId: string): Promise<void> {
    const position = this.positions.get(positionId);
    if (!position) return;
    
    const currentValue = await this.fetchCurrentValue(position);
    position.currentValue = currentValue;
    position.unrealizedPnl = currentValue - position.depositAmount;
    position.lastUpdated = Date.now();
    
    await this.persistPosition(position);
  }
  
  private async fetchCurrentValue(position: DeFiPosition): Promise<bigint> {
    switch (position.protocol) {
      case 'aave':
        return this.getAavePositionValue(position);
      case 'yearn':
        return this.getYearnPositionValue(position);
      case 'beefy':
        return this.getBeefyPositionValue(position);
      case 'lido':
        return this.getLidoPositionValue(position);
      // ... other protocols
    }
  }
  
  private async getAavePositionValue(position: DeFiPosition): Promise<bigint> {
    // aToken balance = current value (1:1 with underlying)
    const provider = getProvider(position.chain);
    const aToken = new ethers.Contract(position.receiptTokenAddress, ERC20_ABI, provider);
    return aToken.balanceOf(position.userId);
  }
  
  private async getYearnPositionValue(position: DeFiPosition): Promise<bigint> {
    const provider = getProvider(position.chain);
    const vault = new ethers.Contract(position.vaultAddress, YEARN_VAULT_ABI, provider);
    const shares = await vault.balanceOf(position.userId);
    return vault.convertToAssets(shares);
  }
  
  private async getBeefyPositionValue(position: DeFiPosition): Promise<bigint> {
    const provider = getProvider(position.chain);
    const vault = new ethers.Contract(position.vaultAddress, BEEFY_VAULT_ABI, provider);
    const shares = await vault.balanceOf(position.userId);
    const pricePerShare = await vault.getPricePerFullShare();
    return (shares * pricePerShare) / (10n ** 18n);
  }
}
```

### Subgraph Queries (Alternative to Direct Calls)

```graphql
# Aave V3 Subgraph - User Positions
query GetUserPositions($user: String!) {
  userReserves(where: { user: $user }) {
    reserve {
      symbol
      underlyingAsset
      aToken {
        id
      }
    }
    currentATokenBalance
    scaledATokenBalance
    liquidityRate
  }
}

# Yearn Subgraph
query GetYearnPositions($user: String!) {
  accountVaultPositions(where: { account: $user }) {
    vault {
      id
      symbol
      token {
        symbol
      }
    }
    balanceShares
    balanceTokens
  }
}
```

---

## 7. Withdrawal Mechanics

### Aave Withdrawal

```typescript
async function withdrawFromAave(
  signer: ethers.Signer,
  poolAddress: string,
  tokenAddress: string,
  amount: bigint | 'max'
) {
  const userAddress = await signer.getAddress();
  const pool = new ethers.Contract(poolAddress, POOL_ABI, signer);
  
  // Use max uint256 to withdraw all
  const withdrawAmount = amount === 'max' 
    ? ethers.MaxUint256 
    : amount;
  
  const tx = await pool.withdraw(
    tokenAddress,
    withdrawAmount,
    userAddress
  );
  
  return tx.wait();
}
```

### Yearn Withdrawal

```typescript
async function withdrawFromYearn(
  signer: ethers.Signer,
  vaultAddress: string,
  shares: bigint | 'max'
) {
  const userAddress = await signer.getAddress();
  const vault = new ethers.Contract(vaultAddress, YEARN_VAULT_ABI, signer);
  
  const sharesToRedeem = shares === 'max'
    ? await vault.balanceOf(userAddress)
    : shares;
  
  const tx = await vault.redeem(sharesToRedeem, userAddress, userAddress);
  return tx.wait();
}
```

### Beefy Withdrawal

```typescript
async function withdrawFromBeefy(
  signer: ethers.Signer,
  vaultAddress: string,
  shares: bigint | 'max'
) {
  const vault = new ethers.Contract(vaultAddress, BEEFY_VAULT_ABI, signer);
  
  if (shares === 'max') {
    const tx = await vault.withdrawAll();
    return tx.wait();
  }
  
  const tx = await vault.withdraw(shares);
  return tx.wait();
}
```

### Liquid Staking Withdrawal

```typescript
// Lido - Via DEX (instant) or Queue (delayed)
async function withdrawFromLido(
  signer: ethers.Signer,
  wstethAmount: bigint,
  method: 'dex' | 'queue'
) {
  if (method === 'dex') {
    // Swap wstETH → ETH via 1inch or Uniswap
    return swapViaDex(wstethAmount, WSTETH_ADDRESS, 'ETH');
  }
  
  // Queue withdrawal
  const wstETH = new ethers.Contract(WSTETH_ADDRESS, ['function unwrap(uint256) returns (uint256)'], signer);
  await wstETH.unwrap(wstethAmount);
  
  const withdrawalQueue = new ethers.Contract(
    '0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1',
    ['function requestWithdrawals(uint256[] amounts, address owner) returns (uint256[])'],
    signer
  );
  
  // This creates a withdrawal NFT that can be claimed after processing
  return withdrawalQueue.requestWithdrawals([wstethAmount], await signer.getAddress());
}

// Jito/Marinade - Instant unstake available
async function withdrawFromJito(
  connection: Connection,
  wallet: any,
  jitoSolAmount: number
) {
  // Use Jito SDK for instant unstake
  const sdk = new StakePoolSDK(connection);
  const { transaction } = await sdk.withdrawSol(wallet.publicKey, jitoSolAmount);
  return wallet.sendTransaction(transaction, connection);
}
```

### Unified Withdrawal Interface

```typescript
interface WithdrawalResult {
  success: boolean;
  txHash: string;
  amountReceived: bigint;
  token: string;
  estimatedTime?: number;  // For queued withdrawals
}

async function withdrawPosition(
  position: DeFiPosition,
  signer: ethers.Signer | any,  // Solana wallet
  amount: bigint | 'max'
): Promise<WithdrawalResult> {
  switch (position.protocol) {
    case 'aave':
      return withdrawFromAave(signer, position.vaultAddress, position.depositToken, amount);
    
    case 'yearn':
      return withdrawFromYearn(signer, position.vaultAddress, amount);
    
    case 'beefy':
      return withdrawFromBeefy(signer, position.vaultAddress, amount);
    
    case 'lido':
      return withdrawFromLido(signer, amount, 'dex');  // Default to instant
    
    case 'jito':
      return withdrawFromJito(connection, signer, Number(amount) / 1e9);
    
    case 'marinade':
      return liquidUnstake(connection, signer, Number(amount) / 1e9);
    
    default:
      throw new Error(`Unsupported protocol: ${position.protocol}`);
  }
}
```

---

## 8. Recommended Routing Logic

### Complete Routing Implementation

```typescript
interface RoutingDecision {
  protocol: string;
  vaultAddress: string;
  expectedApy: number;
  estimatedGas: bigint;
  minProfitableDeposit: bigint;
  depositFunction: (amount: bigint) => Promise<any>;
}

async function routeDustToYield(
  chain: number | 'solana',
  token: string,
  tokenAddress: string,
  amount: bigint,
  userRiskTolerance: 'conservative' | 'moderate' | 'aggressive' = 'moderate'
): Promise<RoutingDecision> {
  
  // Step 1: Get all yield opportunities
  const opportunities = await Promise.all([
    getAaveOpportunity(chain, tokenAddress),
    getYearnOpportunity(chain, tokenAddress),
    getBeefyOpportunity(chain, tokenAddress),
    chain === 'solana' ? getJitoOpportunity() : null,
    chain === 1 && token === 'ETH' ? getLidoOpportunity() : null,
  ]).then(results => results.filter(Boolean));
  
  // Step 2: Calculate gas costs for each
  const withGas = await Promise.all(
    opportunities.map(async opp => ({
      ...opp,
      gasCost: await estimateDepositGas(opp.protocol, chain),
    }))
  );
  
  // Step 3: Filter by profitability
  // Position must earn back gas costs within 30 days
  const profitable = withGas.filter(opp => {
    const monthlyYield = (amount * BigInt(Math.floor(opp.apy * 100))) / 10000n / 12n;
    return monthlyYield > opp.gasCost;
  });
  
  if (profitable.length === 0) {
    // Amount too small - suggest accumulating more
    throw new Error(`Amount too small for profitable deposit. Minimum: ${calculateMinDeposit(chain)}`);
  }
  
  // Step 4: Risk-adjusted selection
  const riskThreshold = { conservative: 3, moderate: 5, aggressive: 8 }[userRiskTolerance];
  const safeOptions = profitable.filter(o => PROTOCOL_RISK[o.protocol] <= riskThreshold);
  
  // Step 5: Select best option
  const best = safeOptions.reduce((a, b) => 
    a.apy > b.apy ? a : b
  );
  
  return best;
}

// Gas estimation
async function estimateDepositGas(protocol: string, chain: number): Promise<bigint> {
  const gasUnits = {
    aave: 200000n,
    yearn: 150000n,
    beefy: 200000n,
    lido: 100000n,
  }[protocol] || 200000n;
  
  const gasPrice = await getGasPrice(chain);
  return gasUnits * gasPrice;
}

// Calculate minimum profitable deposit
function calculateMinDeposit(chain: number): bigint {
  // Assumes 5% APY, wants to earn back gas in 30 days
  const typicalGas = {
    1: ethers.parseEther('0.01'),     // ~$30 on mainnet
    42161: ethers.parseEther('0.0001'), // ~$0.30 on Arbitrum
    8453: ethers.parseEther('0.0001'),  // ~$0.30 on Base
    137: ethers.parseEther('0.0001'),   // ~$0.10 on Polygon
  }[chain] || ethers.parseEther('0.001');
  
  // minDeposit = gasCost / (apy / 12)
  // For 5% APY: minDeposit = gasCost * 240
  return typicalGas * 240n;
}
```

### Final Recommendation Matrix

| Scenario | Token | Chain | Protocol | Reason |
|----------|-------|-------|----------|--------|
| Large ETH ($100+) | ETH | Ethereum | Lido (wstETH) | Best ETH yield, safe |
| Small ETH (<$100) | ETH | L2 | Aave | Lower gas, still earns |
| Stablecoins | USDC/USDT | Any | Aave | Consistent ~4% APY |
| Stablecoins (risky) | USDC | Any | Beefy | Higher APY, more risk |
| Native SOL | SOL | Solana | Jito | Best APY with MEV |
| Small amounts | Any | L2 | Beefy | Multi-chain, auto-compound |

### Integration Checklist

- [ ] Aave V3: Multi-chain deposits with permit support
- [ ] Yearn V3: ERC-4626 vault deposits
- [ ] Beefy: Vault discovery API + deposits
- [ ] Lido: ETH staking → wstETH
- [ ] Rocket Pool: ETH staking → rETH
- [ ] Jito: SOL staking → jitoSOL
- [ ] Marinade: SOL staking → mSOL
- [ ] Position tracking database
- [ ] APY aggregation service
- [ ] Withdrawal handlers for each protocol
- [ ] Gas estimation for routing decisions
- [ ] Risk scoring for protocol selection

---

## Appendix: Contract ABIs

### Minimal ERC-20 ABI
```typescript
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function balanceOf(address account) external view returns (uint256)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function transfer(address to, uint256 amount) external returns (bool)',
];
```

### Aave Pool ABI (Minimal)
```typescript
const AAVE_POOL_ABI = [
  'function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external',
  'function supplyWithPermit(address asset, uint256 amount, address onBehalfOf, uint16 referralCode, uint256 deadline, uint8 permitV, bytes32 permitR, bytes32 permitS) external',
  'function withdraw(address asset, uint256 amount, address to) external returns (uint256)',
  'function getReserveData(address asset) external view returns (tuple)',
  'function getReservesList() external view returns (address[])',
];
```

### Yearn Vault ABI (Minimal)
```typescript
const YEARN_VAULT_ABI = [
  'function deposit(uint256 assets, address receiver) external returns (uint256)',
  'function withdraw(uint256 assets, address receiver, address owner) external returns (uint256)',
  'function redeem(uint256 shares, address receiver, address owner) external returns (uint256)',
  'function convertToAssets(uint256 shares) external view returns (uint256)',
  'function convertToShares(uint256 assets) external view returns (uint256)',
  'function pricePerShare() external view returns (uint256)',
  'function asset() external view returns (address)',
  'function balanceOf(address) external view returns (uint256)',
];
```

### Beefy Vault ABI (Minimal)
```typescript
const BEEFY_VAULT_ABI = [
  'function deposit(uint256 _amount) external',
  'function depositAll() external',
  'function withdraw(uint256 _shares) external',
  'function withdrawAll() external',
  'function getPricePerFullShare() external view returns (uint256)',
  'function want() external view returns (address)',
  'function balance() external view returns (uint256)',
  'function balanceOf(address) external view returns (uint256)',
];
```

---

## NPM Packages Summary

```bash
# EVM Integration
npm install ethers @aave/contract-helpers @aave/math-utils

# Solana Integration  
npm install @solana/web3.js @solana/spl-token
npm install @jito-foundation/jito-ts
npm install @marinade.finance/marinade-ts-sdk

# Optional: API clients
npm install axios node-fetch
```

---

*Last Updated: January 2026*
*Version: 1.0*
