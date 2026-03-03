# Aave V3 Protocol Research

## Overview

Aave V3 is a decentralized lending and borrowing protocol that allows users to supply assets to earn yield and borrow against their collateral. For Sweep's "dust destination" integration, users can supply small token amounts to Aave to earn interest over time.

---

## 1. Contract Interfaces

### IPool Interface

The main entry point for all user interactions.

```solidity
interface IPool {
    // Supply tokens to the protocol
    function supply(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 referralCode
    ) external;

    // Supply with EIP-2612 permit (gasless approval)
    function supplyWithPermit(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 referralCode,
        uint256 deadline,
        uint8 permitV,
        bytes32 permitR,
        bytes32 permitS
    ) external;

    // Withdraw tokens from the protocol
    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external returns (uint256);

    // Legacy deposit function (calls supply internally)
    function deposit(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 referralCode
    ) external;

    // Get reserve data
    function getReserveData(
        address asset
    ) external view returns (DataTypes.ReserveData memory);

    // Get user account data
    function getUserAccountData(
        address user
    ) external view returns (
        uint256 totalCollateralBase,
        uint256 totalDebtBase,
        uint256 availableBorrowsBase,
        uint256 currentLiquidationThreshold,
        uint256 ltv,
        uint256 healthFactor
    );

    // Get the normalized income (for calculating current aToken balance)
    function getReserveNormalizedIncome(
        address asset
    ) external view returns (uint256);

    // Flash loans
    function flashLoan(
        address receiverAddress,
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata interestRateModes,
        address onBehalfOf,
        bytes calldata params,
        uint16 referralCode
    ) external;

    function flashLoanSimple(
        address receiverAddress,
        address asset,
        uint256 amount,
        bytes calldata params,
        uint16 referralCode
    ) external;
}
```

### IPoolDataProvider Interface

For querying reserve and user data.

```solidity
interface IPoolDataProvider {
    // Get reserve configuration data
    function getReserveConfigurationData(address asset) external view returns (
        uint256 decimals,
        uint256 ltv,
        uint256 liquidationThreshold,
        uint256 liquidationBonus,
        uint256 reserveFactor,
        bool usageAsCollateralEnabled,
        bool borrowingEnabled,
        bool stableBorrowRateEnabled,
        bool isActive,
        bool isFrozen
    );

    // Get reserve data
    function getReserveData(address asset) external view returns (
        uint256 unbacked,
        uint256 accruedToTreasuryScaled,
        uint256 totalAToken,
        uint256 totalStableDebt,
        uint256 totalVariableDebt,
        uint256 liquidityRate,
        uint256 variableBorrowRate,
        uint256 stableBorrowRate,
        uint256 averageStableBorrowRate,
        uint256 liquidityIndex,
        uint256 variableBorrowIndex,
        uint40 lastUpdateTimestamp
    );

    // Get reserve token addresses
    function getReserveTokensAddresses(address asset) external view returns (
        address aTokenAddress,
        address stableDebtTokenAddress,
        address variableDebtTokenAddress
    );

    // Get user reserve data
    function getUserReserveData(address asset, address user) external view returns (
        uint256 currentATokenBalance,
        uint256 currentStableDebt,
        uint256 currentVariableDebt,
        uint256 principalStableDebt,
        uint256 scaledVariableDebt,
        uint256 stableBorrowRate,
        uint256 liquidityRate,
        uint40 stableRateLastUpdated,
        bool usageAsCollateralEnabled
    );

    // Check if flash loan is enabled
    function getFlashLoanEnabled(address asset) external view returns (bool);

    // Get reserve caps
    function getReserveCaps(address asset) external view returns (
        uint256 borrowCap,
        uint256 supplyCap
    );
}
```

---

## 2. SDK Usage

### @aave/contract-helpers

TypeScript SDK for interacting with Aave contracts.

```typescript
import { Pool, WETHGatewayService, L2Pool } from '@aave/contract-helpers';

// Initialize Pool service
const pool = new Pool(provider, {
    POOL: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2', // Ethereum mainnet
    WETH_GATEWAY: '0xD322A49006FC828F9B5B37Ab215F99B4E5caB19C',
});

// Supply tokens
const supplyTxs = await pool.supply({
    user: userAddress,
    reserve: tokenAddress, // e.g., DAI address
    amount: '1000000000000000000', // Amount in wei
    onBehalfOf: userAddress,
    referralCode: '0',
});

// Submit transactions
for (const tx of supplyTxs) {
    const txResponse = await signer.sendTransaction(tx);
    await txResponse.wait();
}

// Supply with Permit (gasless approval)
const supplyWithPermitTxs = await pool.supplyWithPermit({
    user: userAddress,
    reserve: tokenAddress,
    amount: '1000000000000000000',
    signature: signedPermit, // EIP-2612 signature
    onBehalfOf: userAddress,
    deadline: Math.floor(Date.now() / 1000) + 3600,
});

// Sign ERC20 approval (for permit)
const signedApproval = await pool.signERC20Approval({
    user: userAddress,
    reserve: tokenAddress,
    amount: '1000000000000000000',
    deadline: Math.floor(Date.now() / 1000) + 3600,
});

// Withdraw tokens
const withdrawTxs = await pool.withdraw({
    user: userAddress,
    reserve: tokenAddress,
    amount: '-1', // -1 for max (all balance)
    aTokenAddress: aTokenAddress,
    onBehalfOf: userAddress,
});

// For native ETH, use WETHGatewayService
const wethGateway = new WETHGatewayService(provider, {
    WETH_GATEWAY: '0xD322A49006FC828F9B5B37Ab215F99B4E5caB19C',
    POOL: poolAddress,
});

// Deposit ETH
const depositETHTxs = await wethGateway.depositETH({
    lendingPool: poolAddress,
    user: userAddress,
    amount: '1000000000000000000', // 1 ETH
    onBehalfOf: userAddress,
    referralCode: '0',
});

// For L2 chains (Arbitrum, Optimism, etc.)
const l2Pool = new L2Pool(provider, {
    L2_POOL: l2PoolAddress,
    ENCODER: l2EncoderAddress,
});

// L2 optimized supply (smaller calldata)
const l2SupplyTxs = await l2Pool.supply({
    user: userAddress,
    reserve: tokenAddress,
    amount: '1000000000000000000',
    onBehalfOf: userAddress,
    referralCode: '0',
});
```

### @aave/math-utils

For calculating APY, user positions, and reserve data.

```typescript
import {
    formatReserves,
    formatUserSummary,
    formatReservesAndIncentives,
    formatUserSummaryAndIncentives,
    calculateHealthFactorFromBalances,
    calculateAvailableBorrowsMarketReferenceCurrency,
} from '@aave/math-utils';
import dayjs from 'dayjs';

// Format reserve data with APY calculations
const formattedReserves = formatReserves({
    reserves: reservesArray,
    currentTimestamp: dayjs().unix(),
    marketReferenceCurrencyDecimals: baseCurrencyData.marketReferenceCurrencyDecimals,
    marketReferencePriceInUsd: baseCurrencyData.marketReferenceCurrencyPriceInUsd,
});

// Each formatted reserve includes:
// - supplyAPY: Annual percentage yield for suppliers
// - variableBorrowAPY: Variable borrow rate
// - totalLiquidity: Total supplied
// - availableLiquidity: Available to borrow
// - borrowUsageRatio: Utilization rate

// Format user summary with health factor
const userSummary = formatUserSummary({
    currentTimestamp: dayjs().unix(),
    marketReferencePriceInUsd: baseCurrencyData.marketReferenceCurrencyPriceInUsd,
    marketReferenceCurrencyDecimals: baseCurrencyData.marketReferenceCurrencyDecimals,
    userReserves: userReservesArray,
    formattedReserves: formattedReserves,
    userEmodeCategoryId: userEmodeCategoryId,
});

// User summary includes:
// - healthFactor: Position safety (> 1 is safe, < 1 = liquidatable)
// - totalCollateralUSD: Total collateral value
// - totalBorrowsUSD: Total debt value
// - availableBorrowsUSD: Remaining borrowing capacity
// - userReservesData: Array of user's positions

// Include incentives/rewards data
const userSummaryWithIncentives = formatUserSummaryAndIncentives({
    currentTimestamp: dayjs().unix(),
    marketReferencePriceInUsd: baseCurrencyData.marketReferenceCurrencyPriceInUsd,
    marketReferenceCurrencyDecimals: baseCurrencyData.marketReferenceCurrencyDecimals,
    userReserves: userReservesArray,
    formattedReserves: formattedReserves,
    userEmodeCategoryId: userEmodeCategoryId,
    reserveIncentives: reserveIncentivesArray,
    userIncentives: userIncentivesArray,
});
```

---

## 3. Supported Chains & Contract Addresses

### Ethereum Mainnet
| Contract | Address |
|----------|---------|
| Pool | `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2` |
| PoolAddressesProvider | `0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e` |
| PoolDataProvider | `0x7B4EB56E7CD4b454BA8ff71E4518426369a138a3` |
| WETH Gateway | `0xD322A49006FC828F9B5B37Ab215F99B4E5caB19C` |

### Polygon
| Contract | Address |
|----------|---------|
| Pool | `0x794a61358D6845594F94dc1DB02A252b5b4814aD` |
| PoolAddressesProvider | `0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb` |
| PoolDataProvider | `0x69FA688f1Dc47d4B5d8029D5a35FB7a548310654` |

### Arbitrum
| Contract | Address |
|----------|---------|
| Pool | `0x794a61358D6845594F94dc1DB02A252b5b4814aD` |
| PoolAddressesProvider | `0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb` |
| L2Pool | `0x794a61358D6845594F94dc1DB02A252b5b4814aD` |
| L2Encoder | `0x9abADECD08572e0eA5aF4d47A9C7984a5AA503dC` |

### Optimism
| Contract | Address |
|----------|---------|
| Pool | `0x794a61358D6845594F94dc1DB02A252b5b4814aD` |
| PoolAddressesProvider | `0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb` |
| L2Pool | `0x794a61358D6845594F94dc1DB02A252b5b4814aD` |

### Base
| Contract | Address |
|----------|---------|
| Pool | `0xA238Dd80C259a72e81d7e4664a9801593F98d1c5` |
| PoolAddressesProvider | `0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D` |

### Avalanche
| Contract | Address |
|----------|---------|
| Pool | `0x794a61358D6845594F94dc1DB02A252b5b4814aD` |
| PoolAddressesProvider | `0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb` |

### Other Supported Chains
- **BNB Chain**: Pool at `0x6807dc923806fE8Fd134338EABCA509979a7e0cB`
- **Gnosis**: Pool at `0xb50201558B00496A145fE76f7424749556E326D8`
- **Metis**: Pool at `0x90df02551bB792286e8D4f13E0e357b4Bf1D6a57`
- **zkSync Era**: Pool at `0x78e30497a3c7527d953c6B1E3541b021A98Ac43c`
- **Scroll**: Pool at `0x11fCfe756c05AD438e312a7fd934381537D3cFfe`
- **Linea**: Pool at `0x2f9bB73a8e98793e26Cb2F6C4ad037BDf1C6B269`

---

## 4. Supply Flow

### Standard Supply Flow (approve → supply)

```typescript
// Step 1: Approve token spending
const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
await tokenContract.approve(poolAddress, amount);

// Step 2: Supply to Aave
const pool = new ethers.Contract(poolAddress, POOL_ABI, signer);
await pool.supply(
    tokenAddress,  // asset address
    amount,        // amount to supply
    userAddress,   // onBehalfOf (recipient of aTokens)
    0              // referralCode
);
```

### Supply with Permit (single transaction)

```typescript
// EIP-2612 permit signature
const deadline = Math.floor(Date.now() / 1000) + 3600;
const signature = await signer._signTypedData(
    {
        name: tokenName,
        version: '1',
        chainId: chainId,
        verifyingContract: tokenAddress,
    },
    {
        Permit: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'nonce', type: 'uint256' },
            { name: 'deadline', type: 'uint256' },
        ],
    },
    {
        owner: userAddress,
        spender: poolAddress,
        value: amount,
        nonce: nonce,
        deadline: deadline,
    }
);

const { v, r, s } = ethers.utils.splitSignature(signature);

// Supply with permit in single transaction
await pool.supplyWithPermit(
    tokenAddress,
    amount,
    userAddress,
    0,         // referralCode
    deadline,
    v,
    r,
    s
);
```

---

## 5. aTokens (Receipt Tokens)

aTokens are interest-bearing tokens that represent your deposit. They automatically accrue interest.

### Key Concepts

```solidity
// aToken balance = scaledBalance × liquidityIndex / RAY
// The balance grows automatically as interest accrues

interface IAToken {
    // Get underlying asset address
    function UNDERLYING_ASSET_ADDRESS() external view returns (address);
    
    // Get Pool address
    function POOL() external view returns (address);
    
    // Standard ERC20 balanceOf (includes accrued interest)
    function balanceOf(address user) external view returns (uint256);
    
    // Scaled balance (without interest accrual)
    function scaledBalanceOf(address user) external view returns (uint256);
    
    // Get scaled balance and total supply
    function getScaledUserBalanceAndSupply(address user) 
        external view returns (uint256, uint256);
    
    // Get previous index for interest calculation
    function getPreviousIndex(address user) external view returns (uint256);
}
```

### How aTokens Work

1. **Mint**: When you supply 100 DAI, you receive ~100 aDAI (scaled by liquidity index)
2. **Interest Accrual**: Your aDAI balance automatically increases as borrowers pay interest
3. **Burn**: When you withdraw, aTokens are burned and underlying tokens returned
4. **1:1 Peg**: aTokens maintain a 1:1 peg with underlying (100 aDAI = 100 DAI + accrued interest)

### Balance Calculation

```typescript
// Actual balance = scaledBalance × normalizedIncome / RAY
const RAY = BigNumber.from(10).pow(27);
const actualBalance = scaledBalance.mul(normalizedIncome).div(RAY);
```

---

## 6. Interest Rates

### Querying Current APY

```typescript
import { formatReserves } from '@aave/math-utils';

// Using math-utils
const formattedReserves = formatReserves({
    reserves: reservesArray,
    currentTimestamp: Math.floor(Date.now() / 1000),
    marketReferenceCurrencyDecimals: 8,
    marketReferencePriceInUsd: baseCurrencyData.marketReferenceCurrencyPriceInUsd,
});

const daiReserve = formattedReserves.find(r => r.symbol === 'DAI');
console.log('Supply APY:', daiReserve.supplyAPY); // e.g., "0.0312" = 3.12%
console.log('Variable Borrow APY:', daiReserve.variableBorrowAPY);

// Direct from contract
const reserveData = await poolDataProvider.getReserveData(daiAddress);
// liquidityRate is in RAY (10^27) and represents per-second rate
// APY = ((1 + liquidityRate / SECONDS_PER_YEAR) ^ SECONDS_PER_YEAR) - 1
```

### Rate Calculation

```typescript
const SECONDS_PER_YEAR = 31536000;
const RAY = BigNumber.from(10).pow(27);

// Convert rate to APY
function rayToAPY(rayRate: BigNumber): number {
    const ratePerSecond = rayRate.toNumber() / 1e27;
    return Math.pow(1 + ratePerSecond, SECONDS_PER_YEAR) - 1;
}
```

---

## 7. Health Factor

Health Factor determines liquidation risk for borrowers.

```typescript
// Health Factor = (Total Collateral × Liquidation Threshold) / Total Debt

// > 1: Position is safe
// = 1: At liquidation threshold
// < 1: Position can be liquidated

// Query from contract
const { healthFactor } = await pool.getUserAccountData(userAddress);
// healthFactor is in WAD (10^18), divide by 1e18 for decimal value

// Calculate manually
import { calculateHealthFactorFromBalances } from '@aave/math-utils';

const healthFactor = calculateHealthFactorFromBalances({
    collateralBalanceMarketReferenceCurrency,
    borrowBalanceMarketReferenceCurrency,
    currentLiquidationThreshold,
});
```

### Important Thresholds

- **Health Factor > 1**: Safe, no liquidation risk
- **Health Factor = 1**: At liquidation threshold
- **Health Factor < 1**: Subject to liquidation (up to 50% of debt)
- **Recommended**: Keep health factor > 1.5 for safety buffer

---

## 8. Flash Loans

Flash loans allow borrowing without collateral if repaid within the same transaction.

### IFlashLoanSimpleReceiver Interface

```solidity
interface IFlashLoanSimpleReceiver {
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external returns (bool);
    
    function ADDRESSES_PROVIDER() external view returns (IPoolAddressesProvider);
    function POOL() external view returns (IPool);
}
```

### Flash Loan Implementation

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import {FlashLoanSimpleReceiverBase} from "@aave/v3-core/contracts/flashloan/base/FlashLoanSimpleReceiverBase.sol";
import {IPoolAddressesProvider} from "@aave/v3-core/contracts/interfaces/IPoolAddressesProvider.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MyFlashLoanReceiver is FlashLoanSimpleReceiverBase {
    constructor(IPoolAddressesProvider provider) 
        FlashLoanSimpleReceiverBase(provider) {}
    
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        // Your logic here (arbitrage, liquidation, etc.)
        
        // Approve repayment
        uint256 amountOwed = amount + premium;
        IERC20(asset).approve(address(POOL), amountOwed);
        
        return true;
    }
    
    function requestFlashLoan(address asset, uint256 amount) external {
        POOL.flashLoanSimple(
            address(this),  // receiverAddress
            asset,          // asset to borrow
            amount,         // amount
            "",             // params
            0               // referralCode
        );
    }
}
```

### Flash Loan Premium

- Default premium: **0.09%** (9 bps)
- Premium split: 70% to LPs, 30% to protocol treasury
- Authorized flash borrowers can have 0% premium

---

## 9. Permit (Gasless Approvals)

EIP-2612 permit allows approvals via signature, enabling single-transaction supply.

### Checking Permit Support

```typescript
// Check if token supports permit
const tokenContract = new ethers.Contract(tokenAddress, [
    'function nonces(address owner) external view returns (uint256)',
    'function DOMAIN_SEPARATOR() external view returns (bytes32)',
], provider);

try {
    await tokenContract.nonces(userAddress);
    console.log('Token supports permit');
} catch {
    console.log('Token does not support permit');
}
```

### Generating Permit Signature

```typescript
async function generatePermitSignature(
    signer: Signer,
    tokenAddress: string,
    spender: string,
    amount: BigNumber,
    deadline: number
) {
    const token = new ethers.Contract(tokenAddress, [
        'function name() view returns (string)',
        'function nonces(address) view returns (uint256)',
        'function DOMAIN_SEPARATOR() view returns (bytes32)',
    ], signer);
    
    const [name, nonce, chainId] = await Promise.all([
        token.name(),
        token.nonces(await signer.getAddress()),
        signer.getChainId(),
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
    
    const value = {
        owner: await signer.getAddress(),
        spender,
        value: amount,
        nonce,
        deadline,
    };
    
    const signature = await signer._signTypedData(domain, types, value);
    return ethers.utils.splitSignature(signature);
}
```

---

## 10. Integration Example for Dust Destination

```typescript
import { Pool } from '@aave/contract-helpers';
import { ethers } from 'ethers';

const AAVE_POOL_ADDRESSES = {
    1: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',      // Ethereum
    137: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',    // Polygon
    42161: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',  // Arbitrum
    10: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',     // Optimism
    8453: '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5',   // Base
};

async function supplyDustToAave(
    signer: ethers.Signer,
    chainId: number,
    tokenAddress: string,
    amount: BigNumber
) {
    const poolAddress = AAVE_POOL_ADDRESSES[chainId];
    const userAddress = await signer.getAddress();
    
    // Check if token supports permit for gasless approval
    const supportsPermit = await checkPermitSupport(tokenAddress, signer);
    
    if (supportsPermit) {
        // Single transaction with permit
        const deadline = Math.floor(Date.now() / 1000) + 3600;
        const { v, r, s } = await generatePermitSignature(
            signer,
            tokenAddress,
            poolAddress,
            amount,
            deadline
        );
        
        const pool = new ethers.Contract(poolAddress, POOL_ABI, signer);
        return pool.supplyWithPermit(
            tokenAddress,
            amount,
            userAddress,
            0,
            deadline,
            v,
            r,
            s
        );
    } else {
        // Standard approve + supply flow
        const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
        await token.approve(poolAddress, amount);
        
        const pool = new ethers.Contract(poolAddress, POOL_ABI, signer);
        return pool.supply(tokenAddress, amount, userAddress, 0);
    }
}
```

---

## Key Considerations for Sweep Integration

1. **Minimum Amounts**: No minimum deposit, but gas costs may exceed value for very small amounts
2. **Supported Assets**: Only whitelisted assets can be supplied (check `getReservesList()`)
3. **Supply Caps**: Some assets have supply caps; check before supplying
4. **Gas Optimization**: Use permit for supported tokens to save one transaction
5. **L2 Preference**: Consider L2 chains (Arbitrum, Optimism, Base) for lower gas costs
6. **Interest Accrual**: Interest accrues automatically; no claim needed
7. **Withdrawal**: Users can withdraw anytime (subject to liquidity)

---

## NPM Packages

```bash
npm install @aave/contract-helpers @aave/math-utils
```

## Official Resources

- Documentation: https://docs.aave.com/
- GitHub: https://github.com/aave/aave-v3-core
- Address Book: https://github.com/bgd-labs/aave-address-book
- SDK: https://github.com/aave/aave-utilities
