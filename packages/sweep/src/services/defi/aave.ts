/**
 * Aave V3 Protocol Integration
 * Supply assets to earn yield on Aave V3 lending pools
 */

import { type Address, type Hex, encodeFunctionData, parseUnits, formatUnits } from "viem";
import { getViemClient } from "../../utils/viem.js";
import { cacheGetOrFetch } from "../../utils/redis.js";
import {
  DeFiProtocol,
  DeFiProductType,
  RiskLevel,
  type DeFiProvider,
  type DeFiVault,
  type LendingPool,
  type DeFiReserve,
  type DeFiAsset,
  type ApyData,
  type DepositQuote,
  type WithdrawQuote,
  type DeFiPosition,
  DeFiError,
  InsufficientLiquidityError,
} from "./types.js";

// ============================================================
// Aave V3 Contract Addresses
// ============================================================

const AAVE_V3_ADDRESSES: Record<string, {
  pool: Address;
  poolDataProvider: Address;
  uiPoolDataProvider: Address;
  wethGateway: Address;
}> = {
  ethereum: {
    pool: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
    poolDataProvider: "0x7B4EB56E7CD4b454BA8ff71E4518426369a138a3",
    uiPoolDataProvider: "0x91c0eA31b49B69Ea18607702c61F0300b0Fc30f7",
    wethGateway: "0x893411580e590D62dDBca8a703d61Cc4A8c7b2b9",
  },
  arbitrum: {
    pool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
    poolDataProvider: "0x69FA688f1Dc47d4B5d8029D5a35FB7a548310654",
    uiPoolDataProvider: "0x145dE30c929a065582da84Cf96F88460dB9745A7",
    wethGateway: "0xC09e69E79106861dF5d289dA88349f10e2dc6b5C",
  },
  polygon: {
    pool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
    poolDataProvider: "0x69FA688f1Dc47d4B5d8029D5a35FB7a548310654",
    uiPoolDataProvider: "0xC69728f11E9E6127733751c8410432913123acf1",
    wethGateway: "0x1e4b7A6b903680eab0c5dAbcb8fD429cD2a9598c",
  },
  base: {
    pool: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
    poolDataProvider: "0x2d8A3C5677189723C4cB8873CfC9C8976FDF38Ac",
    uiPoolDataProvider: "0x174446a6741300cD2E7C1b1A636Fee99c8F83502",
    wethGateway: "0x8be473dCfA93132559B118a2e512E4e10D2E6f9E",
  },
  optimism: {
    pool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
    poolDataProvider: "0x69FA688f1Dc47d4B5d8029D5a35FB7a548310654",
    uiPoolDataProvider: "0xbd83DdBE37fc91923d59C8c1E0bDe0CccCa332d5",
    wethGateway: "0x76D3030728e52DEB8848d5613aBaDE88441cbc59",
  },
};

// ============================================================
// ABIs
// ============================================================

const POOL_ABI = [
  {
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "onBehalfOf", type: "address" },
      { name: "referralCode", type: "uint16" },
    ],
    name: "supply",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "to", type: "address" },
    ],
    name: "withdraw",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "user", type: "address" }],
    name: "getUserAccountData",
    outputs: [
      { name: "totalCollateralBase", type: "uint256" },
      { name: "totalDebtBase", type: "uint256" },
      { name: "availableBorrowsBase", type: "uint256" },
      { name: "currentLiquidationThreshold", type: "uint256" },
      { name: "ltv", type: "uint256" },
      { name: "healthFactor", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

const POOL_DATA_PROVIDER_ABI = [
  {
    inputs: [{ name: "asset", type: "address" }],
    name: "getReserveData",
    outputs: [
      { name: "unbacked", type: "uint256" },
      { name: "accruedToTreasuryScaled", type: "uint256" },
      { name: "totalAToken", type: "uint256" },
      { name: "totalStableDebt", type: "uint256" },
      { name: "totalVariableDebt", type: "uint256" },
      { name: "liquidityRate", type: "uint256" },
      { name: "variableBorrowRate", type: "uint256" },
      { name: "stableBorrowRate", type: "uint256" },
      { name: "averageStableBorrowRate", type: "uint256" },
      { name: "liquidityIndex", type: "uint256" },
      { name: "variableBorrowIndex", type: "uint256" },
      { name: "lastUpdateTimestamp", type: "uint40" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "asset", type: "address" }],
    name: "getATokenTotalSupply",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "asset", type: "address" }, { name: "user", type: "address" }],
    name: "getUserReserveData",
    outputs: [
      { name: "currentATokenBalance", type: "uint256" },
      { name: "currentStableDebt", type: "uint256" },
      { name: "currentVariableDebt", type: "uint256" },
      { name: "principalStableDebt", type: "uint256" },
      { name: "scaledVariableDebt", type: "uint256" },
      { name: "stableBorrowRate", type: "uint256" },
      { name: "liquidityRate", type: "uint256" },
      { name: "stableRateLastUpdated", type: "uint40" },
      { name: "usageAsCollateralEnabled", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "asset", type: "address" }],
    name: "getReserveConfigurationData",
    outputs: [
      { name: "decimals", type: "uint256" },
      { name: "ltv", type: "uint256" },
      { name: "liquidationThreshold", type: "uint256" },
      { name: "liquidationBonus", type: "uint256" },
      { name: "reserveFactor", type: "uint256" },
      { name: "usageAsCollateralEnabled", type: "bool" },
      { name: "borrowingEnabled", type: "bool" },
      { name: "stableBorrowRateEnabled", type: "bool" },
      { name: "isActive", type: "bool" },
      { name: "isFrozen", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getAllReservesTokens",
    outputs: [
      {
        components: [
          { name: "symbol", type: "string" },
          { name: "tokenAddress", type: "address" },
        ],
        name: "",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "asset", type: "address" }],
    name: "getReserveTokensAddresses",
    outputs: [
      { name: "aTokenAddress", type: "address" },
      { name: "stableDebtTokenAddress", type: "address" },
      { name: "variableDebtTokenAddress", type: "address" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

const WETH_GATEWAY_ABI = [
  {
    inputs: [
      { name: "pool", type: "address" },
      { name: "onBehalfOf", type: "address" },
      { name: "referralCode", type: "uint16" },
    ],
    name: "depositETH",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      { name: "pool", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "to", type: "address" },
    ],
    name: "withdrawETH",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

// ============================================================
// Known Assets
// ============================================================

const AAVE_ASSETS: Record<string, Record<string, { address: Address; decimals: number; symbol: string }>> = {
  ethereum: {
    USDC: { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6, symbol: "USDC" },
    USDT: { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6, symbol: "USDT" },
    DAI: { address: "0x6B175474E89094C44Da98b954EescdeCB5", decimals: 18, symbol: "DAI" },
    WETH: { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", decimals: 18, symbol: "WETH" },
    WBTC: { address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", decimals: 8, symbol: "WBTC" },
  },
  arbitrum: {
    USDC: { address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6, symbol: "USDC" },
    "USDC.e": { address: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8", decimals: 6, symbol: "USDC.e" },
    USDT: { address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", decimals: 6, symbol: "USDT" },
    WETH: { address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", decimals: 18, symbol: "WETH" },
    WBTC: { address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f", decimals: 8, symbol: "WBTC" },
    ARB: { address: "0x912CE59144191C1204E64559FE8253a0e49E6548", decimals: 18, symbol: "ARB" },
  },
  polygon: {
    USDC: { address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", decimals: 6, symbol: "USDC" },
    "USDC.e": { address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", decimals: 6, symbol: "USDC.e" },
    USDT: { address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", decimals: 6, symbol: "USDT" },
    WETH: { address: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", decimals: 18, symbol: "WETH" },
    WMATIC: { address: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", decimals: 18, symbol: "WMATIC" },
  },
  base: {
    USDC: { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6, symbol: "USDC" },
    WETH: { address: "0x4200000000000000000000000000000000000006", decimals: 18, symbol: "WETH" },
    cbETH: { address: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22", decimals: 18, symbol: "cbETH" },
  },
  optimism: {
    USDC: { address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", decimals: 6, symbol: "USDC" },
    "USDC.e": { address: "0x7F5c764cBc14f9669B88837ca1490cCa17c31607", decimals: 6, symbol: "USDC.e" },
    USDT: { address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", decimals: 6, symbol: "USDT" },
    WETH: { address: "0x4200000000000000000000000000000000000006", decimals: 18, symbol: "WETH" },
    OP: { address: "0x4200000000000000000000000000000000000042", decimals: 18, symbol: "OP" },
  },
};

// ============================================================
// Helper Functions
// ============================================================

/**
 * Convert ray (27 decimals) to APY percentage
 */
function rayToApy(ray: bigint): number {
  const RAY = 10n ** 27n;
  const SECONDS_PER_YEAR = 31536000n;
  
  // APY = (1 + rate/SECONDS_PER_YEAR)^SECONDS_PER_YEAR - 1
  // Simplified: APY ≈ rate (for small rates)
  const ratePerSecond = Number(ray) / Number(RAY);
  const apy = Math.pow(1 + ratePerSecond / Number(SECONDS_PER_YEAR), Number(SECONDS_PER_YEAR)) - 1;
  
  return apy;
}

/**
 * Get Aave V3 addresses for a chain
 */
function getAaveAddresses(chain: string) {
  const addresses = AAVE_V3_ADDRESSES[chain];
  if (!addresses) {
    throw new DeFiError(
      `Aave V3 not supported on ${chain}`,
      DeFiProtocol.AAVE,
      "UNSUPPORTED_CHAIN"
    );
  }
  return addresses;
}

// ============================================================
// Aave Provider Implementation
// ============================================================

export class AaveProvider implements DeFiProvider {
  protocol = DeFiProtocol.AAVE;
  name = "Aave V3";
  supportedChains = Object.keys(AAVE_V3_ADDRESSES);

  /**
   * Get all Aave V3 vaults (lending pools) on a chain
   */
  async getVaults(chain: string): Promise<LendingPool[]> {
    const cacheKey = `aave:vaults:${chain}`;
    
    return cacheGetOrFetch(cacheKey, async () => {
      const addresses = getAaveAddresses(chain);
      const client = getViemClient(chain as any);

      // Get all reserve tokens
      // Note: Using 'as any' to work around viem type strictness with authorizationList
      const reserveTokens = await client.readContract({
        address: addresses.poolDataProvider,
        abi: POOL_DATA_PROVIDER_ABI,
        functionName: "getAllReservesTokens",
      } as any) as { symbol: string; tokenAddress: Address }[];

      const pools: LendingPool[] = [];

      for (const { symbol, tokenAddress } of reserveTokens) {
        try {
          // Get reserve configuration
          // Note: Using 'as any' to work around viem type strictness
          const [configData, reserveData, tokenAddresses] = await Promise.all([
            client.readContract({
              address: addresses.poolDataProvider,
              abi: POOL_DATA_PROVIDER_ABI,
              functionName: "getReserveConfigurationData",
              args: [tokenAddress],
            } as any),
            client.readContract({
              address: addresses.poolDataProvider,
              abi: POOL_DATA_PROVIDER_ABI,
              functionName: "getReserveData",
              args: [tokenAddress],
            } as any),
            client.readContract({
              address: addresses.poolDataProvider,
              abi: POOL_DATA_PROVIDER_ABI,
              functionName: "getReserveTokensAddresses",
              args: [tokenAddress],
            } as any),
          ]);

          const [decimals, ltv, liquidationThreshold, , , , , , isActive, isFrozen] = configData as unknown as [
            bigint, bigint, bigint, bigint, bigint, boolean, boolean, boolean, boolean, boolean
          ];

          if (!isActive || isFrozen) continue;

          const [, , totalAToken, totalStableDebt, totalVariableDebt, liquidityRate, , , , , ,] = reserveData as unknown as [
            bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint
          ];

          const [aTokenAddress] = tokenAddresses as [Address, Address, Address];

          const supplyApy = rayToApy(liquidityRate);
          const totalSupply = formatUnits(totalAToken, Number(decimals));
          const totalBorrow = formatUnits(totalStableDebt + totalVariableDebt, Number(decimals));
          const availableLiquidity = formatUnits(
            totalAToken - totalStableDebt - totalVariableDebt,
            Number(decimals)
          );

          const utilizationRate = Number(totalBorrow) / (Number(totalSupply) || 1);

          const depositAsset: DeFiAsset = {
            address: tokenAddress,
            symbol,
            name: symbol,
            decimals: Number(decimals),
            chain,
          };

          const receiptAsset: DeFiAsset = {
            address: aTokenAddress,
            symbol: `a${symbol}`,
            name: `Aave ${chain} ${symbol}`,
            decimals: Number(decimals),
            chain,
          };

          const reserve: DeFiReserve = {
            ...depositAsset,
            totalSupply,
            totalBorrow,
            availableLiquidity,
            utilizationRate,
            supplyApy,
            ltv: Number(ltv) / 10000,
            liquidationThreshold: Number(liquidationThreshold) / 10000,
          };

          // Estimate TVL (would need price oracle for accurate USD value)
          const tvlUsd = Number(totalSupply) * 1; // Placeholder

          const pool: LendingPool = {
            id: `aave-${chain}-${symbol.toLowerCase()}`,
            protocol: DeFiProtocol.AAVE,
            productType: DeFiProductType.LENDING,
            name: `Aave ${symbol} Supply`,
            symbol: `a${symbol}`,
            address: addresses.pool,
            chain,
            chainId: AAVE_V3_ADDRESSES[chain] ? getChainId(chain) : 0,
            depositToken: depositAsset,
            receiptToken: receiptAsset,
            apy: supplyApy,
            apyBase: supplyApy,
            tvlUsd,
            riskLevel: RiskLevel.LOW,
            audited: true,
            active: true,
            reserves: [reserve],
            lastUpdated: Date.now(),
          };

          pools.push(pool);
        } catch (error) {
          console.error(`Error fetching Aave reserve ${symbol} on ${chain}:`, error);
        }
      }

      return pools;
    }, 300); // Cache for 5 minutes
  }

  /**
   * Get a specific vault
   */
  async getVault(chain: string, vaultAddress: string): Promise<LendingPool | null> {
    const vaults = await this.getVaults(chain);
    return vaults.find(
      (v) => v.depositToken.address.toLowerCase() === vaultAddress.toLowerCase()
    ) || null;
  }

  /**
   * Get APY data for a reserve
   */
  async getApy(chain: string, assetAddress: string): Promise<ApyData> {
    const addresses = getAaveAddresses(chain);
    const client = getViemClient(chain as any);

    const reserveData = await client.readContract({
      address: addresses.poolDataProvider,
      abi: POOL_DATA_PROVIDER_ABI,
      functionName: "getReserveData",
      args: [assetAddress as Address],
    } as any) as unknown as [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint];

    const liquidityRate = reserveData[5];
    const apy = rayToApy(liquidityRate);

    return {
      protocol: DeFiProtocol.AAVE,
      vault: assetAddress,
      chain,
      asset: assetAddress,
      apy,
      apyBase: apy,
      apyReward: 0,
      lastUpdated: Date.now(),
    };
  }

  /**
   * Get deposit quote
   */
  async getDepositQuote(
    chain: string,
    assetAddress: string,
    amount: string,
    userAddress: string
  ): Promise<DepositQuote> {
    const addresses = getAaveAddresses(chain);
    const vault = await this.getVault(chain, assetAddress);
    
    if (!vault) {
      throw new DeFiError(
        `Asset ${assetAddress} not found on Aave ${chain}`,
        DeFiProtocol.AAVE,
        "ASSET_NOT_FOUND"
      );
    }

    const depositAsset = vault.depositToken;
    const receiptAsset = vault.receiptToken!;
    const parsedAmount = parseUnits(amount, depositAsset.decimals);

    // Check liquidity
    const reserve = vault.reserves[0];
    if (BigInt(parseUnits(amount, depositAsset.decimals)) > BigInt(parseUnits(reserve.availableLiquidity, depositAsset.decimals))) {
      throw new InsufficientLiquidityError(
        DeFiProtocol.AAVE,
        reserve.availableLiquidity,
        amount
      );
    }

    // Build supply calldata
    const calldata = encodeFunctionData({
      abi: POOL_ABI,
      functionName: "supply",
      args: [
        assetAddress as Address,
        parsedAmount,
        userAddress as Address,
        0, // referral code
      ],
    });

    // For native ETH, use WETH gateway
    const isNativeEth = assetAddress.toLowerCase() === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
    const depositCalldata = isNativeEth
      ? encodeFunctionData({
          abi: WETH_GATEWAY_ABI,
          functionName: "depositETH",
          args: [addresses.pool, userAddress as Address, 0],
        })
      : calldata;

    const currentApy = vault.apy;
    const depositValueUsd = Number(amount) * (depositAsset.priceUsd || 1);

    // Calculate projected yields
    const projectedYield1d = depositValueUsd * (currentApy / 365);
    const projectedYield7d = depositValueUsd * (currentApy / 365) * 7;
    const projectedYield30d = depositValueUsd * (currentApy / 365) * 30;
    const projectedYield1y = depositValueUsd * currentApy;

    return {
      id: `aave-deposit-${Date.now()}`,
      protocol: DeFiProtocol.AAVE,
      vault,
      chain,
      depositToken: depositAsset,
      depositAmount: amount,
      depositValueUsd,
      receiptToken: receiptAsset,
      expectedReceiptAmount: amount, // 1:1 for aTokens
      expectedReceiptValueUsd: depositValueUsd,
      currentApy,
      projectedYield1d,
      projectedYield7d,
      projectedYield30d,
      projectedYield1y,
      estimatedGasUsd: 0.5, // Estimate
      protocolFeeUsd: 0,
      slippageBps: 0, // No slippage for supply
      calldata: depositCalldata,
      to: isNativeEth ? addresses.wethGateway : addresses.pool,
      value: isNativeEth ? parsedAmount.toString() : "0",
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
      createdAt: Date.now(),
    };
  }

  /**
   * Get withdraw quote
   */
  async getWithdrawQuote(
    chain: string,
    assetAddress: string,
    amount: string,
    userAddress: string
  ): Promise<WithdrawQuote> {
    const addresses = getAaveAddresses(chain);
    const vault = await this.getVault(chain, assetAddress);
    
    if (!vault) {
      throw new DeFiError(
        `Asset ${assetAddress} not found on Aave ${chain}`,
        DeFiProtocol.AAVE,
        "ASSET_NOT_FOUND"
      );
    }

    const withdrawAsset = vault.depositToken;
    const receiptAsset = vault.receiptToken!;
    const parsedAmount = parseUnits(amount, withdrawAsset.decimals);

    // Build withdraw calldata
    const calldata = encodeFunctionData({
      abi: POOL_ABI,
      functionName: "withdraw",
      args: [
        assetAddress as Address,
        parsedAmount,
        userAddress as Address,
      ],
    });

    const withdrawValueUsd = Number(amount) * (withdrawAsset.priceUsd || 1);

    return {
      id: `aave-withdraw-${Date.now()}`,
      protocol: DeFiProtocol.AAVE,
      vault,
      chain,
      receiptToken: receiptAsset,
      receiptAmount: amount,
      receiptValueUsd: withdrawValueUsd,
      withdrawToken: withdrawAsset,
      expectedWithdrawAmount: amount,
      expectedWithdrawValueUsd: withdrawValueUsd,
      estimatedGasUsd: 0.5,
      protocolFeeUsd: 0,
      slippageBps: 0,
      instantWithdrawAvailable: true,
      calldata,
      to: addresses.pool,
      expiresAt: Date.now() + 5 * 60 * 1000,
      createdAt: Date.now(),
    };
  }

  /**
   * Get user positions
   */
  async getPositions(chain: string, userAddress: string): Promise<DeFiPosition[]> {
    const addresses = getAaveAddresses(chain);
    const client = getViemClient(chain as any);
    const vaults = await this.getVaults(chain);
    const positions: DeFiPosition[] = [];

    for (const vault of vaults) {
      try {
        const userData = await client.readContract({
          address: addresses.poolDataProvider,
          abi: POOL_DATA_PROVIDER_ABI,
          functionName: "getUserReserveData",
          args: [vault.depositToken.address as Address, userAddress as Address],
        } as any) as unknown as [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, boolean];

        const [currentATokenBalance] = userData;

        if (currentATokenBalance === 0n) continue;

        const balanceFormatted = formatUnits(currentATokenBalance, vault.depositToken.decimals);
        const valueUsd = Number(balanceFormatted) * (vault.depositToken.priceUsd || 1);

        positions.push({
          id: `aave-pos-${chain}-${vault.depositToken.symbol}-${userAddress}`,
          userId: userAddress,
          walletAddress: userAddress as Address,
          protocol: DeFiProtocol.AAVE,
          vault,
          chain,
          depositToken: vault.depositToken,
          depositedAmount: balanceFormatted,
          depositedValueUsd: valueUsd,
          receiptToken: vault.receiptToken,
          receiptAmount: balanceFormatted,
          currentValueUsd: valueUsd,
          unrealizedPnl: 0, // Would need historical data
          unrealizedPnlPercent: 0,
          realizedPnl: 0,
          totalEarned: 0,
          enteredAt: Date.now(),
          lastUpdated: Date.now(),
        });
      } catch (error) {
        console.error(`Error fetching Aave position for ${vault.depositToken.symbol}:`, error);
      }
    }

    return positions;
  }

  /**
   * Get a specific position
   */
  async getPosition(
    chain: string,
    assetAddress: string,
    userAddress: string
  ): Promise<DeFiPosition | null> {
    const positions = await this.getPositions(chain, userAddress);
    return positions.find(
      (p) => p.depositToken.address.toLowerCase() === assetAddress.toLowerCase()
    ) || null;
  }

  /**
   * Get user's health factor
   */
  async getHealthFactor(chain: string, userAddress: string): Promise<number> {
    const addresses = getAaveAddresses(chain);
    const client = getViemClient(chain as any);

    const accountData = await client.readContract({
      address: addresses.pool,
      abi: POOL_ABI,
      functionName: "getUserAccountData",
      args: [userAddress as Address],
    } as any) as unknown as [bigint, bigint, bigint, bigint, bigint, bigint];

    const healthFactor = accountData[5];
    
    // Health factor is in 18 decimals, max uint256 means no debt
    if (healthFactor === BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")) {
      return Infinity;
    }

    return Number(formatUnits(healthFactor, 18));
  }
}

// ============================================================
// Helper to get chain ID
// ============================================================

function getChainId(chain: string): number {
  const chainIds: Record<string, number> = {
    ethereum: 1,
    arbitrum: 42161,
    polygon: 137,
    base: 8453,
    optimism: 10,
  };
  return chainIds[chain] || 0;
}

// ============================================================
// Export singleton
// ============================================================

export const aaveProvider = new AaveProvider();
export default aaveProvider;
