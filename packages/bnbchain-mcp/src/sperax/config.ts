/**
 * Sperax MCP Server Configuration
 *
 * Contract addresses and chain configuration for Arbitrum One
 */

// Chain Configuration
export const CHAIN_ID = 42161; // Arbitrum One
export const CHAIN_NAME = 'arbitrum';
export const DEFAULT_RPC_URL = 'https://arb1.arbitrum.io/rpc';

// Get RPC URL from environment or use default
export const getRpcUrl = (): string => {
  if (typeof process !== 'undefined' && process.env?.ARBITRUM_RPC_URL) {
    return process.env.ARBITRUM_RPC_URL;
  }
  return DEFAULT_RPC_URL;
};

/**
 * All Sperax contract addresses on Arbitrum One
 */
export const CONTRACTS = {
  // Core Protocol
  USDS: '0xD74f5255D557944cf7Dd0E45FF521520002D5748' as const,
  SPA: '0x5575552988A3A80504bBaeB1311674fCFd40aD4B' as const,
  VAULT: '0x6Bbc476Ee35CBA9e9c3A59fc5b10d7a0BC6f74Ca' as const,

  // Staking Contracts
  VESPA: '0x2e2071180682Ce6C247B1eF93d382D509F5F6A17' as const,
  XSPA: '0x0966E72256d6055145902F72F9D3B6a194B9cCc3' as const,

  // Yield Distribution
  SPA_BUYBACK: '0xFbc0d3cA777722d234FE01dba94DeDeDb277AFe3' as const,
  YIELD_RESERVE: '0x0CB89A7A6a9E0d9E06EE0c52De040db0e2B079E6' as const,
  DRIPPER: '0xEaA79893D17d4c1b3e76c684e7A89B3D46a6fb03' as const,
  REBASE_MANAGER: '0xC21b3b55Db3cb0B6CA6F96c18E9534c96E1d4cfc' as const,

  // Collateral Manager
  COLLATERAL_MANAGER: '0xdA6B48BA29fE5F0f32eB52FBA21D26DACA04E5e7' as const,

  // Oracles
  MASTER_PRICE_ORACLE: '0x14D99412dAB1878dC01Fe7a1664cdE85896e8E50' as const,
  CHAINLINK_ORACLE: '0xB9e5A70e1B1F3C99Db6Ed28f67d8d7d1248F8b3B' as const,
  SPA_ORACLE: '0x5Fb534B4B07a0E417B449E264A8c7A6f9C5C2C69' as const,
  USDS_ORACLE: '0x1C27c2a4aD63DE5F44f5a0e7a651e3FC7F3BBBe3' as const,

  // Demeter Protocol
  FARM_REGISTRY: '0x45bC6B44107837E7aBB21E2CaCbe7612Fce222e0' as const,
  REWARDER_FACTORY: '0x926477bAF60C25857419CC9Bf52E914881E1bDD3' as const,
  FARM_DEPLOYER: '0x0d9EFD8f11c0a09DB8C2CCBfF4cC6c26Ad98b956' as const,

  // Supported Collateral Tokens
  USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' as const, // Native USDC
  USDCe: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8' as const, // Bridged USDC.e
  USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9' as const,
  DAI: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1' as const,
  FRAX: '0x17FC002b466eEc40DaE837Fc4bE5c67993ddBd6F' as const,

  // Yield Strategies
  AAVE_STRATEGY: '0x5E8422345238F34275888049021821E8E08CAa1f' as const,
  COMPOUND_STRATEGY: '0x8c9532a60E0E7C6BbD2B2c1303F63aCE1c3e9811' as const,
  STARGATE_STRATEGY: '0x6cD7bEF920f4C05aF3386A2c0070e1e26CD85c85' as const,
  FLUID_STRATEGY: '0xE0f51Ec5f35B0D7Ce31b26b8C15b9B9f3fF1f5C5' as const,

  // Fee Calculator
  FEE_CALCULATOR: '0xC2C3D9F5C5A5dE5A5a5c5D5e5F5A5b5c5D5E5F5a' as const,

  // Multicall
  MULTICALL3: '0xcA11bde05977b3631167028862bE2a173976CA11' as const,
} as const;

// Type exports for contract addresses
export type ContractName = keyof typeof CONTRACTS;
export type ContractAddress = (typeof CONTRACTS)[ContractName];

/**
 * Chainlink Oracle addresses on Arbitrum One
 */
export const ORACLES = {
  USDC_USD: '0x50834F3163758fcC1Df9973b6e91f0F0F0363003' as const,
  USDCe_USD: '0x50834F3163758fcC1Df9973b6e91f0F0F0363003' as const, // Same oracle for USDC.e
  USDT_USD: '0x3f3f5dF88dC9F13eac63DF89EC16ef6e7E25DdE7' as const,
  DAI_USD: '0xc5C8E77B397E531B8EC06BFb0048328B30E9eCfB' as const,
  FRAX_USD: '0x0809E3d38d1B4214958faf06D8b1B1a2b73f2ab8' as const,
  ETH_USD: '0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612' as const,
} as const;

/**
 * Collateral token metadata with oracle addresses
 */
export interface CollateralConfig {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  oracle: string;
}

export const COLLATERALS: Record<string, CollateralConfig> = {
  USDC: {
    address: CONTRACTS.USDC,
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    oracle: ORACLES.USDC_USD,
  },
  USDCe: {
    address: CONTRACTS.USDCe,
    symbol: 'USDC.e',
    name: 'Bridged USD Coin',
    decimals: 6,
    oracle: ORACLES.USDCe_USD,
  },
  USDT: {
    address: CONTRACTS.USDT,
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    oracle: ORACLES.USDT_USD,
  },
  DAI: {
    address: CONTRACTS.DAI,
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    decimals: 18,
    oracle: ORACLES.DAI_USD,
  },
  FRAX: {
    address: CONTRACTS.FRAX,
    symbol: 'FRAX',
    name: 'Frax',
    decimals: 18,
    oracle: ORACLES.FRAX_USD,
  },
};

/**
 * Key protocol constants
 */
export const PROTOCOL_CONSTANTS = {
  // veSPA
  MIN_LOCK_DAYS: 7,
  MAX_LOCK_DAYS: 1460, // 4 years
  VESPA_PRECISION: 1e18,
  
  // xSPA
  MIN_VESTING_DAYS: 15,
  MAX_VESTING_DAYS: 180,
  MIN_REDEMPTION_RATIO: 0.5,  // 50% at 15 days
  MAX_REDEMPTION_RATIO: 1.0,  // 100% at 180 days
  
  // USDs
  USDS_DECIMALS: 18,
  CREDITS_DECIMALS: 27,
  
  // Yield
  YIELD_TO_USDs_RATIO: 0.7,   // 70% to USDs holders
  YIELD_TO_BUYBACK_RATIO: 0.3, // 30% to SPA buyback
  
  // Rebase Parameters
  REBASE_GAP_SECONDS: 86400,  // 24 hours minimum between rebases
  APR_CAP: 2500,              // 25% max APR (basis points * 100)
  APR_BOTTOM: 300,            // 3% min APR threshold for rebase
  MIN_REBASE_THRESHOLD: 0.03, // 3% minimum yield to trigger rebase
  
  // Collateral Safety Parameters
  DOWNSIDE_PEG: 9700,         // 97 cents - minting pauses if below
  DEPEG_THRESHOLD: 0.03,      // 3% depeg triggers mint pause
  
  // Strategy Allocation Caps (basis points)
  USDC_STRATEGY_CAP: 7500,    // 75% max per strategy
  USDCe_STRATEGY_CAP: 5000,   // 50% max per strategy
  USDT_STRATEGY_CAP: 7500,    // 75% max per strategy
  
  // Demeter
  FARM_CREATION_FEE: 100,     // 100 USDs
  MAX_REWARD_TOKENS: 4,       // Max 4 reward tokens per farm
  DEFAULT_REWARD_TOKEN: 'SPA', // SPA is default reward on Arbitrum
  
  // Strategy Parameters
  STRATEGY_ALLOCATION_CAP: 7500, // 75% max allocation to any single strategy
} as const;

/**
 * Yield strategy configurations
 */
export interface StrategyConfig {
  address: string;
  name: string;
  protocol: string;
  collaterals: string[];
  allocationCap: number; // basis points
  isActive: boolean;
}

export const STRATEGIES: Record<string, StrategyConfig> = {
  AAVE: {
    address: CONTRACTS.AAVE_STRATEGY,
    name: 'Aave V3 Strategy',
    protocol: 'Aave',
    collaterals: ['USDC', 'USDCe', 'USDT'],
    allocationCap: 7500,
    isActive: true,
  },
  COMPOUND: {
    address: CONTRACTS.COMPOUND_STRATEGY,
    name: 'Compound V3 Strategy',
    protocol: 'Compound',
    collaterals: ['USDC', 'USDCe'],
    allocationCap: 7500,
    isActive: true,
  },
  STARGATE: {
    address: CONTRACTS.STARGATE_STRATEGY,
    name: 'Stargate Strategy',
    protocol: 'Stargate',
    collaterals: ['USDCe', 'USDT'],
    allocationCap: 5000,
    isActive: true,
  },
  FLUID: {
    address: CONTRACTS.FLUID_STRATEGY,
    name: 'Fluid Strategy',
    protocol: 'Fluid',
    collaterals: ['USDC', 'USDCe', 'USDT'],
    allocationCap: 7500,
    isActive: true,
  },
};

/**
 * Rebase state enum matching contract
 */
export enum RebaseState {
  NotSet = 0,
  OptOut = 1,
  OptIn = 2,
}

/**
 * Helper to get rebase state string
 */
export const getRebaseStateString = (state: number): string => {
  switch (state) {
    case RebaseState.NotSet:
      return 'Not Set (Default: Opt-In for EOAs)';
    case RebaseState.OptOut:
      return 'Opted Out (No Rebases)';
    case RebaseState.OptIn:
      return 'Opted In (Receives Rebases)';
    default:
      return 'Unknown';
  }
};
