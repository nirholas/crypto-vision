/**
 * Sperax MCP Server - Blockchain Provider
 *
 * Viem-based blockchain interaction layer for Arbitrum One
 */

import {
  createPublicClient,
  http,
  type PublicClient,
  parseAbi,
} from 'viem';
import { arbitrum } from 'viem/chains';
import { getRpcUrl } from './config.js';

// Re-export Address type for consumers
export type { Address } from 'viem';

// Singleton client instance
let client: PublicClient | null = null;

/**
 * Get the Viem public client for Arbitrum
 */
export const getClient = (): PublicClient => {
  if (!client) {
    client = createPublicClient({
      chain: arbitrum,
      transport: http(getRpcUrl()),
      batch: {
        multicall: true,
      },
    });
  }
  return client;
};

// ============================================================================
// Contract ABIs (minimal for read operations)
// ============================================================================

/**
 * USDs Stablecoin ABI
 */
export const USDs_ABI = parseAbi([
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function creditsBalanceOf(address account) view returns (uint256 credits, uint256 creditsPerToken)',
  'function rebaseState(address account) view returns (uint8)',
  'function nonRebasingSupply() view returns (uint256)',
  'function rebasingCreditsPerToken() view returns (uint256)',
]);
// Alias for consistency
export const USDsABI = USDs_ABI;

/**
 * SPA Token ABI
 */
export const SPA_ABI = parseAbi([
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function circulatingSupply() view returns (uint256)',
]);
export const SPAABI = SPA_ABI;

/**
 * veSPA Staking ABI
 */
export const VeSPA_ABI = parseAbi([
  'function locked(address account) view returns (int128 amount, uint256 end)',
  'function balanceOf(address account) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function supply() view returns (uint256)',
  'function epoch() view returns (uint256)',
  'function point_history(uint256 epoch) view returns (int128 bias, int128 slope, uint256 ts, uint256 blk)',
]);
export const VeSPAABI = VeSPA_ABI;

/**
 * xSPA Redemption ABI
 */
export const XSpa_ABI = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function vestingInfo(address account) view returns (uint256 amount, uint256 startTime, uint256 endTime)',
  'function getRedeemableAmount(address account, uint256 vestingDays) view returns (uint256)',
]);
export const XSpaABI = XSpa_ABI;

/**
 * Vault ABI
 */
export const Vault_ABI = parseAbi([
  'function totalValueLocked() view returns (uint256)',
  'function mintingFee() view returns (uint256)',
  'function redemptionFee() view returns (uint256)',
  'function collateralRatio() view returns (uint256)',
  'function paused() view returns (bool)',
  'function collaterals(address token) view returns (bool mintAllowed, bool redeemAllowed, uint16 allocationPercentage, uint16 baseFee, address strategy, bool exists)',
  'function getAllCollaterals() view returns (address[])',
  'function getCollateralBalance(address token) view returns (uint256)',
]);
export const VaultABI = Vault_ABI;

/**
 * Rebase Manager ABI
 */
export const RebaseManager_ABI = parseAbi([
  'function vault() view returns (address)',
  'function dripper() view returns (address)',
  'function gap() view returns (uint256)',
  'function aprCap() view returns (uint256)',
  'function aprBottom() view returns (uint256)',
  'function lastRebaseTS() view returns (uint256)',
  'function getMinAndMaxRebaseAmt() view returns (uint256 minRebaseAmt, uint256 maxRebaseAmt)',
  'function getAvailableRebaseAmt() view returns (uint256)',
]);
export const RebaseManagerABI = RebaseManager_ABI;

/**
 * Dripper ABI
 */
export const Dripper_ABI = parseAbi([
  'function dripRate() view returns (uint256)',
  'function dripDuration() view returns (uint256)',
  'function lastCollectTimestamp() view returns (uint256)',
  'function availableFunds() view returns (uint256)',
  'function rewardToken() view returns (address)',
]);
export const DripperABI = Dripper_ABI;

/**
 * SPA Buyback ABI
 */
export const SPABuyback_ABI = parseAbi([
  'function totalBurned() view returns (uint256)',
  'function pendingBurn() view returns (uint256)',
  'function weeklyBurnRate() view returns (uint256)',
  'function lastBurnTimestamp() view returns (uint256)',
]);
export const SPABuybackABI = SPABuyback_ABI;

/**
 * Yield Reserve ABI
 */
export const YieldReserve_ABI = parseAbi([
  'function vault() view returns (address)',
  'function oracle() view returns (address)',
  'function buyback() view returns (address)',
  'function dripper() view returns (address)',
  'function buybackPercentage() view returns (uint256)',
  'function tokenData(address token) view returns (bool srcAllowed, bool dstAllowed, uint160 conversionFactor)',
  'function getTokenBForTokenA(address srcToken, address dstToken, uint256 amountIn) view returns (uint256)',
]);
export const YieldReserveABI = YieldReserve_ABI;

/**
 * Chainlink Oracle ABI
 */
export const Oracle_ABI = parseAbi([
  'function latestAnswer() view returns (int256)',
  'function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
  'function decimals() view returns (uint8)',
  'function description() view returns (string)',
]);
export const OracleABI = Oracle_ABI;

/**
 * Master Price Oracle ABI
 */
export const MasterPriceOracle_ABI = parseAbi([
  'function getPrice(address token) view returns (uint256)',
  'function getUnderlyingPrice(address cToken) view returns (uint256)',
]);
export const MasterPriceOracleABI = MasterPriceOracle_ABI;

/**
 * Farm Registry ABI
 */
export const FarmRegistry_ABI = parseAbi([
  'function getAllFarms() view returns (address[])',
  'function getActiveFarms() view returns (address[])',
  'function farmInfo(address farm) view returns (address lpToken, address rewarder, uint256 startTime, uint256 endTime, bool isActive)',
  'function farmCount() view returns (uint256)',
]);
export const FarmRegistryABI = FarmRegistry_ABI;

/**
 * Individual Farm ABI
 */
export const Farm_ABI = parseAbi([
  'function stakingToken() view returns (address)',
  'function rewardsToken() view returns (address)',
  'function totalStaked() view returns (uint256)',
  'function rewardRate() view returns (uint256)',
  'function periodFinish() view returns (uint256)',
  'function lastUpdateTime() view returns (uint256)',
  'function rewardPerTokenStored() view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function earned(address account) view returns (uint256)',
]);
export const FarmABI = Farm_ABI;

/**
 * Standard ERC20 ABI
 */
export const ERC20_ABI = parseAbi([
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
]);
export const ERC20ABI = ERC20_ABI;

/**
 * Collateral Manager ABI
 */
export const CollateralManager_ABI = parseAbi([
  'function collateralInfo(address collateral) view returns (bool mintAllowed, bool redeemAllowed, bool allocationAllowed, bool exists, address defaultStrategy, uint16 baseMintFee, uint16 baseRedeemFee, uint16 downsidePeg, uint16 desiredCollateralComposition, uint16 collateralCapacityUsed, uint256 conversionFactor)',
  'function getAllCollaterals() view returns (address[])',
  'function getCollateralStrategies(address collateral) view returns (address[])',
  'function getCollateralInStrategies(address collateral) view returns (uint256)',
  'function getCollateralInVault(address collateral) view returns (uint256)',
  'function getCollateralInAStrategy(address collateral, address strategy) view returns (uint256)',
  'function isValidStrategy(address collateral, address strategy) view returns (bool)',
  'function getFeeCalibrationData(address collateral) view returns (uint16 baseMintFee, uint16 baseRedeemFee, uint16 composition, uint256 totalCollateral)',
]);
export const CollateralManagerABI = CollateralManager_ABI;

/**
 * Fee Calculator ABI
 */
export const FeeCalculator_ABI = parseAbi([
  'function getMintFee(address collateral) view returns (uint256)',
  'function getRedeemFee(address collateral) view returns (uint256)',
]);
export const FeeCalculatorABI = FeeCalculator_ABI;

/**
 * Strategy ABI (Base for all strategies)
 */
export const Strategy_ABI = parseAbi([
  'function vault() view returns (address)',
  'function checkBalance(address asset) view returns (uint256)',
  'function checkAvailableBalance(address asset) view returns (uint256)',
  'function checkInterestEarned(address asset) view returns (uint256)',
  'function supportsCollateral(address asset) view returns (bool)',
  'function harvestIncentiveRate() view returns (uint16)',
  'function assetToPToken(address asset) view returns (address)',
]);
export const StrategyABI = Strategy_ABI;

// ============================================================================
// Contract Read Helpers
// ============================================================================

interface ReadContractParams {
  address: `0x${string}`;
  abi: readonly unknown[];
  functionName: string;
  args?: readonly unknown[];
}

/**
 * Read from a contract with error handling
 */
export async function readContract<T>(params: ReadContractParams): Promise<T> {
  const client = getClient();
  try {
    const result = await client.readContract({
      address: params.address,
      abi: params.abi,
      functionName: params.functionName,
      args: params.args || [],
    });
    return result as T;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(
      `Failed to read ${params.functionName} from ${params.address}: ${errorMessage}`
    );
  }
}

interface MulticallContract {
  address: `0x${string}`;
  abi: readonly unknown[];
  functionName: string;
  args?: readonly unknown[];
}

/**
 * Batch read multiple contract calls using multicall
 */
export async function multicall<T extends readonly unknown[]>(
  contracts: MulticallContract[]
): Promise<T> {
  const client = getClient();
  try {
    const results = await client.multicall({
      contracts: contracts.map((c) => ({
        address: c.address,
        abi: c.abi,
        functionName: c.functionName,
        args: c.args || [],
      })),
    });
    return results.map((r: { status: string; result?: unknown }) => 
      (r.status === 'success' ? r.result : null)
    ) as T;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Multicall failed: ${errorMessage}`);
  }
}

/**
 * Get the current block number
 */
export async function getBlockNumber(): Promise<bigint> {
  const client = getClient();
  return client.getBlockNumber();
}

/**
 * Get the current timestamp from the chain
 */
export async function getBlockTimestamp(): Promise<bigint> {
  const client = getClient();
  const block = await client.getBlock();
  return block.timestamp;
}
