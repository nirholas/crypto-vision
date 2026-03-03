/**
 * Lido Protocol Integration
 * Liquid staking for ETH with stETH/wstETH
 */

import { type Address, type Hex, encodeFunctionData, parseUnits, formatUnits, parseEther, formatEther } from "viem";
import { getViemClient } from "../../utils/viem.js";
import { cacheGetOrFetch } from "../../utils/redis.js";
import {
  DeFiProtocol,
  DeFiProductType,
  RiskLevel,
  type DeFiProvider,
  type StakingPool,
  type DeFiAsset,
  type ApyData,
  type DepositQuote,
  type WithdrawQuote,
  type DeFiPosition,
  DeFiError,
} from "./types.js";

// ============================================================
// Lido Contract Addresses
// ============================================================

const LIDO_ADDRESSES: Record<string, {
  stETH: Address;
  wstETH: Address;
  withdrawalQueue?: Address;
}> = {
  ethereum: {
    stETH: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84",
    wstETH: "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0",
    withdrawalQueue: "0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1",
  },
  arbitrum: {
    stETH: "0x0000000000000000000000000000000000000000", // Not available
    wstETH: "0x5979D7b546E38E414F7E9822514be443A4800529",
  },
  polygon: {
    stETH: "0x0000000000000000000000000000000000000000",
    wstETH: "0x03b54A6e9a984069379fae1a4fC4dBAE93B3bCCD",
  },
  optimism: {
    stETH: "0x0000000000000000000000000000000000000000",
    wstETH: "0x1F32b1c2345538c0c6f582fCB022739c4A194Ebb",
  },
  base: {
    stETH: "0x0000000000000000000000000000000000000000",
    wstETH: "0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452",
  },
};

const LIDO_SUPPORTED_CHAINS = Object.keys(LIDO_ADDRESSES);

// Lido API endpoints
const LIDO_API_BASE = "https://eth-api.lido.fi";

// ============================================================
// ABIs
// ============================================================

const STETH_ABI = [
  {
    inputs: [{ name: "_referral", type: "address" }],
    name: "submit",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [{ name: "_account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getTotalPooledEther",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getTotalShares",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "_account", type: "address" }],
    name: "sharesOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "_sharesAmount", type: "uint256" }],
    name: "getPooledEthByShares",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "_ethAmount", type: "uint256" }],
    name: "getSharesByPooledEth",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const WSTETH_ABI = [
  {
    inputs: [{ name: "_stETHAmount", type: "uint256" }],
    name: "wrap",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "_wstETHAmount", type: "uint256" }],
    name: "unwrap",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "_wstETHAmount", type: "uint256" }],
    name: "getStETHByWstETH",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "_stETHAmount", type: "uint256" }],
    name: "getWstETHByStETH",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "stEthPerToken",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "tokensPerStEth",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const WITHDRAWAL_QUEUE_ABI = [
  {
    inputs: [
      { name: "_amounts", type: "uint256[]" },
      { name: "_owner", type: "address" },
    ],
    name: "requestWithdrawals",
    outputs: [{ name: "requestIds", type: "uint256[]" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "_requestIds", type: "uint256[]" }],
    name: "claimWithdrawals",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "_requestId", type: "uint256" }],
    name: "getWithdrawalStatus",
    outputs: [
      {
        components: [
          { name: "amountOfStETH", type: "uint256" },
          { name: "amountOfShares", type: "uint256" },
          { name: "owner", type: "address" },
          { name: "timestamp", type: "uint256" },
          { name: "isFinalized", type: "bool" },
          { name: "isClaimed", type: "bool" },
        ],
        name: "status",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

// ============================================================
// API Response Types
// ============================================================

interface LidoApyResponse {
  data: {
    apr: number;
    smaApr: number;
  };
  meta: {
    symbol: string;
    address: string;
    chainId: number;
  };
}

interface LidoStatsResponse {
  totalStaked: number;
  totalStakers: number;
  marketCap: number;
}

// ============================================================
// Helper Functions
// ============================================================

async function fetchLidoApy(): Promise<number> {
  try {
    const response = await fetch(`${LIDO_API_BASE}/v1/protocol/steth/apr/sma`);
    if (!response.ok) {
      throw new Error(`Lido API error: ${response.status}`);
    }
    const data = await response.json() as LidoApyResponse;
    return data.data.smaApr / 100; // Convert to decimal
  } catch (error) {
    console.error("Error fetching Lido APY:", error);
    return 0.04; // Default 4% fallback
  }
}

async function fetchLidoTvl(): Promise<number> {
  try {
    const response = await fetch(`${LIDO_API_BASE}/v1/protocol/steth/stats`);
    if (!response.ok) {
      throw new Error(`Lido stats API error: ${response.status}`);
    }
    const data = await response.json() as LidoStatsResponse;
    return data.totalStaked;
  } catch (error) {
    console.error("Error fetching Lido TVL:", error);
    return 0;
  }
}

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
// Lido Provider Implementation
// ============================================================

export class LidoProvider implements DeFiProvider {
  protocol = DeFiProtocol.LIDO;
  name = "Lido";
  supportedChains = LIDO_SUPPORTED_CHAINS;

  /**
   * Get Lido staking pools
   */
  async getVaults(chain: string): Promise<StakingPool[]> {
    const addresses = LIDO_ADDRESSES[chain];
    if (!addresses) {
      return [];
    }

    const cacheKey = `lido:pools:${chain}`;

    return cacheGetOrFetch(cacheKey, async () => {
      const [apy, tvl] = await Promise.all([
        fetchLidoApy(),
        fetchLidoTvl(),
      ]);

      const ethAsset: DeFiAsset = {
        address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" as Address, // Native ETH
        symbol: "ETH",
        name: "Ether",
        decimals: 18,
        chain,
      };

      const stETHAsset: DeFiAsset = {
        address: addresses.stETH,
        symbol: "stETH",
        name: "Lido Staked ETH",
        decimals: 18,
        chain,
      };

      const wstETHAsset: DeFiAsset = {
        address: addresses.wstETH,
        symbol: "wstETH",
        name: "Wrapped Lido Staked ETH",
        decimals: 18,
        chain,
      };

      const pools: StakingPool[] = [];

      // Only mainnet has direct staking
      if (chain === "ethereum") {
        pools.push({
          id: `lido-${chain}-steth`,
          protocol: DeFiProtocol.LIDO,
          productType: DeFiProductType.STAKING,
          name: "Lido stETH",
          symbol: "stETH",
          address: addresses.stETH,
          chain,
          chainId: getChainId(chain),
          depositToken: ethAsset,
          receiptToken: stETHAsset,
          apy,
          apyBase: apy,
          tvlUsd: tvl,
          riskLevel: RiskLevel.LOW,
          audited: true,
          active: true,
          stakingToken: ethAsset,
          rewardToken: stETHAsset,
          minStake: "0",
          maxStake: undefined,
          unbondingPeriod: 0, // stETH is liquid
          cooldownPeriod: 0,
          compounding: true,
          description: "Stake ETH and receive stETH. Earn Ethereum staking rewards.",
          lastUpdated: Date.now(),
        });
      }

      // wstETH is available on all supported chains
      pools.push({
        id: `lido-${chain}-wsteth`,
        protocol: DeFiProtocol.LIDO,
        productType: DeFiProductType.STAKING,
        name: "Lido wstETH",
        symbol: "wstETH",
        address: addresses.wstETH,
        chain,
        chainId: getChainId(chain),
        depositToken: chain === "ethereum" ? stETHAsset : wstETHAsset,
        receiptToken: wstETHAsset,
        apy,
        apyBase: apy,
        tvlUsd: tvl,
        riskLevel: RiskLevel.LOW,
        audited: true,
        active: true,
        stakingToken: chain === "ethereum" ? stETHAsset : wstETHAsset,
        rewardToken: wstETHAsset,
        minStake: "0",
        maxStake: undefined,
        unbondingPeriod: 0,
        cooldownPeriod: 0,
        compounding: true,
        description: "Wrapped stETH with non-rebasing balance. Ideal for DeFi.",
        lastUpdated: Date.now(),
      });

      return pools;
    }, 300);
  }

  /**
   * Get a specific pool
   */
  async getVault(chain: string, poolAddress: string): Promise<StakingPool | null> {
    const pools = await this.getVaults(chain);
    return pools.find(
      (p) => p.address.toLowerCase() === poolAddress.toLowerCase()
    ) || null;
  }

  /**
   * Get APY data
   */
  async getApy(chain: string, poolAddress: string): Promise<ApyData> {
    const apy = await fetchLidoApy();

    return {
      protocol: DeFiProtocol.LIDO,
      vault: poolAddress,
      chain,
      asset: "ETH",
      apy,
      apyBase: apy,
      apyReward: 0,
      lastUpdated: Date.now(),
    };
  }

  /**
   * Get deposit quote for ETH -> stETH
   */
  async getDepositQuote(
    chain: string,
    poolAddress: string,
    amount: string,
    userAddress: string
  ): Promise<DepositQuote> {
    const pool = await this.getVault(chain, poolAddress);
    
    if (!pool) {
      throw new DeFiError(
        `Pool ${poolAddress} not found on Lido ${chain}`,
        DeFiProtocol.LIDO,
        "POOL_NOT_FOUND"
      );
    }

    const addresses = LIDO_ADDRESSES[chain];
    if (!addresses) {
      throw new DeFiError(
        `Lido not supported on ${chain}`,
        DeFiProtocol.LIDO,
        "CHAIN_NOT_SUPPORTED"
      );
    }

    const parsedAmount = parseEther(amount);
    let calldata: Hex;
    let value: string;
    let to: Address;
    let expectedReceiptAmount: string;

    // Determine if stETH or wstETH pool
    if (poolAddress.toLowerCase() === addresses.stETH.toLowerCase()) {
      // ETH -> stETH (direct stake)
      calldata = encodeFunctionData({
        abi: STETH_ABI,
        functionName: "submit",
        args: ["0x0000000000000000000000000000000000000000" as Address], // No referral
      });
      value = parsedAmount.toString();
      to = addresses.stETH;
      expectedReceiptAmount = amount; // 1:1 for stETH
    } else if (poolAddress.toLowerCase() === addresses.wstETH.toLowerCase()) {
      // stETH -> wstETH (wrap)
      const client = getViemClient(chain as any);
      const expectedWstETH = await client.readContract({
        address: addresses.wstETH,
        abi: WSTETH_ABI,
        functionName: "getWstETHByStETH",
        args: [parsedAmount],
      }) as bigint;

      calldata = encodeFunctionData({
        abi: WSTETH_ABI,
        functionName: "wrap",
        args: [parsedAmount],
      });
      value = "0";
      to = addresses.wstETH;
      expectedReceiptAmount = formatEther(expectedWstETH);
    } else {
      throw new DeFiError(
        `Unknown Lido pool ${poolAddress}`,
        DeFiProtocol.LIDO,
        "UNKNOWN_POOL"
      );
    }

    const depositValueUsd = Number(amount) * 2000; // Approximate ETH price
    const currentApy = pool.apy;

    // Calculate projected yields
    const projectedYield1d = depositValueUsd * (currentApy / 365);
    const projectedYield7d = depositValueUsd * (currentApy / 365) * 7;
    const projectedYield30d = depositValueUsd * (currentApy / 365) * 30;
    const projectedYield1y = depositValueUsd * currentApy;

    return {
      id: `lido-deposit-${Date.now()}`,
      protocol: DeFiProtocol.LIDO,
      vault: pool,
      chain,
      depositToken: pool.depositToken,
      depositAmount: amount,
      depositValueUsd,
      receiptToken: pool.receiptToken,
      expectedReceiptAmount,
      expectedReceiptValueUsd: depositValueUsd,
      currentApy,
      projectedYield1d,
      projectedYield7d,
      projectedYield30d,
      projectedYield1y,
      estimatedGasUsd: 1.5,
      protocolFeeUsd: 0,
      slippageBps: 0, // No slippage for staking
      calldata,
      to,
      value,
      expiresAt: Date.now() + 5 * 60 * 1000,
      createdAt: Date.now(),
    };
  }

  /**
   * Get withdraw quote (unstaking)
   */
  async getWithdrawQuote(
    chain: string,
    poolAddress: string,
    amount: string,
    userAddress: string
  ): Promise<WithdrawQuote> {
    const pool = await this.getVault(chain, poolAddress);
    
    if (!pool) {
      throw new DeFiError(
        `Pool ${poolAddress} not found on Lido ${chain}`,
        DeFiProtocol.LIDO,
        "POOL_NOT_FOUND"
      );
    }

    const addresses = LIDO_ADDRESSES[chain];
    if (!addresses) {
      throw new DeFiError(
        `Lido not supported on ${chain}`,
        DeFiProtocol.LIDO,
        "CHAIN_NOT_SUPPORTED"
      );
    }

    const parsedAmount = parseEther(amount);
    let calldata: Hex;
    let to: Address;
    let expectedWithdrawAmount: string;
    let withdrawalDelay: number | undefined;
    let instantWithdrawAvailable = true;

    // wstETH -> stETH (unwrap)
    if (poolAddress.toLowerCase() === addresses.wstETH.toLowerCase()) {
      const client = getViemClient(chain as any);
      const expectedStETH = await client.readContract({
        address: addresses.wstETH,
        abi: WSTETH_ABI,
        functionName: "getStETHByWstETH",
        args: [parsedAmount],
      }) as bigint;

      calldata = encodeFunctionData({
        abi: WSTETH_ABI,
        functionName: "unwrap",
        args: [parsedAmount],
      });
      to = addresses.wstETH;
      expectedWithdrawAmount = formatEther(expectedStETH);
    } 
    // stETH -> ETH (via withdrawal queue)
    else if (poolAddress.toLowerCase() === addresses.stETH.toLowerCase() && addresses.withdrawalQueue) {
      calldata = encodeFunctionData({
        abi: WITHDRAWAL_QUEUE_ABI,
        functionName: "requestWithdrawals",
        args: [[parsedAmount], userAddress as Address],
      });
      to = addresses.withdrawalQueue;
      expectedWithdrawAmount = amount;
      withdrawalDelay = 1 * 24 * 60 * 60; // ~1 day average
      instantWithdrawAvailable = false;
    } else {
      throw new DeFiError(
        `Withdrawal not supported for ${poolAddress}`,
        DeFiProtocol.LIDO,
        "WITHDRAWAL_NOT_SUPPORTED"
      );
    }

    const withdrawValueUsd = Number(amount) * 2000;

    return {
      id: `lido-withdraw-${Date.now()}`,
      protocol: DeFiProtocol.LIDO,
      vault: pool,
      chain,
      receiptToken: pool.receiptToken!,
      receiptAmount: amount,
      receiptValueUsd: withdrawValueUsd,
      withdrawToken: pool.depositToken,
      expectedWithdrawAmount,
      expectedWithdrawValueUsd: withdrawValueUsd,
      estimatedGasUsd: 2.0,
      protocolFeeUsd: 0,
      slippageBps: 0,
      withdrawalDelay,
      instantWithdrawAvailable,
      calldata,
      to,
      expiresAt: Date.now() + 5 * 60 * 1000,
      createdAt: Date.now(),
    };
  }

  /**
   * Get user positions
   */
  async getPositions(chain: string, userAddress: string): Promise<DeFiPosition[]> {
    const addresses = LIDO_ADDRESSES[chain];
    if (!addresses) {
      return [];
    }

    const client = getViemClient(chain as any);
    const positions: DeFiPosition[] = [];
    const pools = await this.getVaults(chain);

    // Check stETH balance (mainnet only)
    if (chain === "ethereum" && addresses.stETH !== "0x0000000000000000000000000000000000000000") {
      try {
        const stETHBalance = await client.readContract({
          address: addresses.stETH,
          abi: STETH_ABI,
          functionName: "balanceOf",
          args: [userAddress as Address],
        }) as bigint;

        if (stETHBalance > 0n) {
          const amount = formatEther(stETHBalance);
          const valueUsd = Number(amount) * 2000;
          const pool = pools.find((p) => p.address.toLowerCase() === addresses.stETH.toLowerCase());

          if (pool) {
            positions.push({
              id: `lido-pos-${chain}-steth-${userAddress}`,
              userId: userAddress,
              walletAddress: userAddress as Address,
              protocol: DeFiProtocol.LIDO,
              vault: pool,
              chain,
              depositToken: pool.depositToken,
              depositedAmount: amount,
              depositedValueUsd: valueUsd,
              receiptToken: pool.receiptToken,
              receiptAmount: amount,
              currentValueUsd: valueUsd,
              unrealizedPnl: 0,
              unrealizedPnlPercent: 0,
              realizedPnl: 0,
              totalEarned: 0,
              enteredAt: Date.now(),
              lastUpdated: Date.now(),
            });
          }
        }
      } catch (error) {
        console.error("Error fetching stETH balance:", error);
      }
    }

    // Check wstETH balance
    try {
      const wstETHBalance = await client.readContract({
        address: addresses.wstETH,
        abi: WSTETH_ABI,
        functionName: "balanceOf",
        args: [userAddress as Address],
      }) as bigint;

      if (wstETHBalance > 0n) {
        const amount = formatEther(wstETHBalance);
        
        // Get stETH equivalent
        let stETHEquivalent = wstETHBalance;
        if (chain === "ethereum") {
          stETHEquivalent = await client.readContract({
            address: addresses.wstETH,
            abi: WSTETH_ABI,
            functionName: "getStETHByWstETH",
            args: [wstETHBalance],
          }) as bigint;
        }
        
        const stETHAmount = formatEther(stETHEquivalent);
        const valueUsd = Number(stETHAmount) * 2000;
        const pool = pools.find((p) => p.address.toLowerCase() === addresses.wstETH.toLowerCase());

        if (pool) {
          positions.push({
            id: `lido-pos-${chain}-wsteth-${userAddress}`,
            userId: userAddress,
            walletAddress: userAddress as Address,
            protocol: DeFiProtocol.LIDO,
            vault: pool,
            chain,
            depositToken: pool.depositToken,
            depositedAmount: stETHAmount,
            depositedValueUsd: valueUsd,
            receiptToken: pool.receiptToken,
            receiptAmount: amount,
            currentValueUsd: valueUsd,
            unrealizedPnl: 0,
            unrealizedPnlPercent: 0,
            realizedPnl: 0,
            totalEarned: 0,
            enteredAt: Date.now(),
            lastUpdated: Date.now(),
          });
        }
      }
    } catch (error) {
      console.error("Error fetching wstETH balance:", error);
    }

    return positions;
  }

  /**
   * Get a specific position
   */
  async getPosition(
    chain: string,
    poolAddress: string,
    userAddress: string
  ): Promise<DeFiPosition | null> {
    const positions = await this.getPositions(chain, userAddress);
    return positions.find(
      (p) => p.vault.address.toLowerCase() === poolAddress.toLowerCase()
    ) || null;
  }
}

// ============================================================
// Export singleton
// ============================================================

export const lidoProvider = new LidoProvider();
export default lidoProvider;
