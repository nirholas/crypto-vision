/**
 * Etherscan API Integration
 * Ethereum network data: gas, supply, prices, transactions
 *
 * Base URL: https://api.etherscan.io/api
 * Free tier: 5 calls/second, requires free API key
 *
 * Also includes Basescan, Arbiscan, Polygonscan support
 *
 * @module etherscan
 */

import { CACHE_TTL } from './external-apis';
import { cache } from './cache';

// =============================================================================
// Configuration
// =============================================================================

const EXPLORERS = {
  ethereum: {
    url: 'https://api.etherscan.io/api',
    name: 'Etherscan',
    chainId: 1,
  },
  base: {
    url: 'https://api.basescan.org/api',
    name: 'Basescan',
    chainId: 8453,
  },
  arbitrum: {
    url: 'https://api.arbiscan.io/api',
    name: 'Arbiscan',
    chainId: 42161,
  },
  polygon: {
    url: 'https://api.polygonscan.com/api',
    name: 'Polygonscan',
    chainId: 137,
  },
  optimism: {
    url: 'https://api-optimistic.etherscan.io/api',
    name: 'Optimism Etherscan',
    chainId: 10,
  },
  bsc: {
    url: 'https://api.bscscan.com/api',
    name: 'BSCScan',
    chainId: 56,
  },
  avalanche: {
    url: 'https://api.snowtrace.io/api',
    name: 'Snowtrace',
    chainId: 43114,
  },
} as const;

export type Chain = keyof typeof EXPLORERS;

// =============================================================================
// Types
// =============================================================================

export interface EtherscanGasOracle {
  LastBlock: string;
  SafeGasPrice: string;
  ProposeGasPrice: string;
  FastGasPrice: string;
  suggestBaseFee: string;
  gasUsedRatio: string;
  UsdPrice?: string;
}

export interface EtherscanEthPrice {
  ethbtc: string;
  ethbtc_timestamp: string;
  ethusd: string;
  ethusd_timestamp: string;
}

export interface EtherscanEthSupply {
  EthSupply: string;
  Eth2Staking: string;
  BurntFees: string;
  WithdrawnTotal: string;
}

export interface EtherscanNodeCount {
  UTCDate: string;
  TotalNodeCount: string;
}

export interface EtherscanDailyStats {
  UTCDate: string;
  unixTimeStamp: string;
  transactionCount?: string;
  blockCount?: string;
  networkHashRate?: string;
  difficulty?: string;
  newAddressCount?: string;
  gasUsed?: string;
  averageGasPrice?: string;
  averageGasLimit?: string;
}

export interface EtherscanTransaction {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  nonce: string;
  blockHash: string;
  transactionIndex: string;
  from: string;
  to: string;
  value: string;
  gas: string;
  gasPrice: string;
  isError: string;
  txreceipt_status: string;
  input: string;
  contractAddress: string;
  cumulativeGasUsed: string;
  gasUsed: string;
  confirmations: string;
  methodId: string;
  functionName: string;
}

export interface EtherscanTokenTransfer {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  nonce: string;
  blockHash: string;
  from: string;
  contractAddress: string;
  to: string;
  value: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimal: string;
  transactionIndex: string;
  gas: string;
  gasPrice: string;
  gasUsed: string;
  cumulativeGasUsed: string;
  input: string;
  confirmations: string;
}

export interface EtherscanBlock {
  blockNumber: string;
  timeStamp: string;
  blockMiner: string;
  blockReward: string;
  uncles: string[];
  uncleInclusionReward: string;
}

export interface EtherscanContractABI {
  status: string;
  message: string;
  result: string;
}

export interface EtherscanContractSourceCode {
  SourceCode: string;
  ABI: string;
  ContractName: string;
  CompilerVersion: string;
  OptimizationUsed: string;
  Runs: string;
  ConstructorArguments: string;
  EVMVersion: string;
  Library: string;
  LicenseType: string;
  Proxy: string;
  Implementation: string;
  SwarmSource: string;
}

export interface EtherscanTokenInfo {
  contractAddress: string;
  tokenName: string;
  symbol: string;
  divisor: string;
  tokenType: string;
  totalSupply: string;
  blueCheckmark: string;
  description: string;
  website: string;
  email: string;
  blog: string;
  reddit: string;
  slack: string;
  facebook: string;
  twitter: string;
  bitcointalk: string;
  github: string;
  telegram: string;
  wechat: string;
  linkedin: string;
  discord: string;
  whitepaper: string;
  tokenPriceUSD: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

function getApiKey(chain: Chain = 'ethereum'): string {
  const envKeys: Record<Chain, string> = {
    ethereum: 'ETHERSCAN_API_KEY',
    base: 'BASESCAN_API_KEY',
    arbitrum: 'ARBISCAN_API_KEY',
    polygon: 'POLYGONSCAN_API_KEY',
    optimism: 'OPTIMISM_API_KEY',
    bsc: 'BSCSCAN_API_KEY',
    avalanche: 'SNOWTRACE_API_KEY',
  };

  // Try chain-specific key first, then fall back to ETHERSCAN_API_KEY
  return process.env[envKeys[chain]] || process.env.ETHERSCAN_API_KEY || '';
}

async function fetchEtherscan<T>(
  chain: Chain,
  module: string,
  action: string,
  params: Record<string, string> = {}
): Promise<T> {
  const explorer = EXPLORERS[chain];
  const apiKey = getApiKey(chain);

  const urlParams = new URLSearchParams({
    module,
    action,
    ...params,
  });

  if (apiKey) {
    urlParams.set('apikey', apiKey);
  }

  const url = `${explorer.url}?${urlParams.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`${explorer.name} API error: ${response.status}`);
  }

  const result = await response.json();

  if (result.status === '0' && result.message !== 'No transactions found') {
    throw new Error(`${explorer.name} API error: ${result.message || result.result}`);
  }

  return result.result;
}

// =============================================================================
// Gas Tracker API Functions
// =============================================================================

/**
 * Get current gas oracle data
 */
export async function getGasOracle(chain: Chain = 'ethereum'): Promise<EtherscanGasOracle> {
  const cacheKey = `etherscan:gas:${chain}`;
  const cached = cache.get<EtherscanGasOracle>(cacheKey);
  if (cached) return cached;

  const data = await fetchEtherscan<EtherscanGasOracle>(chain, 'gastracker', 'gasoracle');
  cache.set(cacheKey, data, CACHE_TTL.gas);

  return data;
}

/**
 * Get gas estimate for confirmation time
 */
export async function getGasEstimate(
  gasPrice: number,
  chain: Chain = 'ethereum'
): Promise<string> {
  const cacheKey = `etherscan:gasestimate:${chain}:${gasPrice}`;
  const cached = cache.get<string>(cacheKey);
  if (cached) return cached;

  const data = await fetchEtherscan<string>(chain, 'gastracker', 'gasestimate', {
    gasprice: gasPrice.toString(),
  });

  cache.set(cacheKey, data, CACHE_TTL.gas);
  return data;
}

/**
 * Get normalized gas prices for all supported chains
 */
export async function getAllChainGasPrices(): Promise<
  Array<{
    chain: Chain;
    chainId: number;
    name: string;
    safeGas: number;
    standardGas: number;
    fastGas: number;
    baseFee: number | null;
  }>
> {
  const chains: Chain[] = ['ethereum', 'polygon', 'arbitrum', 'optimism', 'base', 'bsc', 'avalanche'];

  const results = await Promise.allSettled(chains.map((chain) => getGasOracle(chain)));

  return results
    .map((result, index) => {
      const chain = chains[index];
      const explorer = EXPLORERS[chain];

      if (result.status === 'rejected') {
        return null;
      }

      const gas = result.value;
      return {
        chain,
        chainId: explorer.chainId,
        name: explorer.name,
        safeGas: parseFloat(gas.SafeGasPrice) || 0,
        standardGas: parseFloat(gas.ProposeGasPrice) || 0,
        fastGas: parseFloat(gas.FastGasPrice) || 0,
        baseFee: gas.suggestBaseFee ? parseFloat(gas.suggestBaseFee) : null,
      };
    })
    .filter((g) => g !== null) as Array<{
    chain: Chain;
    chainId: number;
    name: string;
    safeGas: number;
    standardGas: number;
    fastGas: number;
    baseFee: number | null;
  }>;
}

// =============================================================================
// Stats API Functions
// =============================================================================

/**
 * Get ETH price
 */
export async function getEthPrice(): Promise<EtherscanEthPrice> {
  const cacheKey = 'etherscan:ethprice';
  const cached = cache.get<EtherscanEthPrice>(cacheKey);
  if (cached) return cached;

  const data = await fetchEtherscan<EtherscanEthPrice>('ethereum', 'stats', 'ethprice');
  cache.set(cacheKey, data, CACHE_TTL.prices);

  return data;
}

/**
 * Get ETH supply (including staking and burnt)
 */
export async function getEthSupply(): Promise<EtherscanEthSupply> {
  const cacheKey = 'etherscan:ethsupply2';
  const cached = cache.get<EtherscanEthSupply>(cacheKey);
  if (cached) return cached;

  const data = await fetchEtherscan<EtherscanEthSupply>('ethereum', 'stats', 'ethsupply2');
  cache.set(cacheKey, data, CACHE_TTL.global);

  return data;
}

/**
 * Get total ETH supply (simple)
 */
export async function getTotalEthSupply(): Promise<string> {
  const cacheKey = 'etherscan:ethsupply';
  const cached = cache.get<string>(cacheKey);
  if (cached) return cached;

  const data = await fetchEtherscan<string>('ethereum', 'stats', 'ethsupply');
  cache.set(cacheKey, data, CACHE_TTL.global);

  return data;
}

/**
 * Get node count
 */
export async function getNodeCount(): Promise<EtherscanNodeCount> {
  const cacheKey = 'etherscan:nodecount';
  const cached = cache.get<EtherscanNodeCount>(cacheKey);
  if (cached) return cached;

  const data = await fetchEtherscan<EtherscanNodeCount>('ethereum', 'stats', 'nodecount');
  cache.set(cacheKey, data, CACHE_TTL.global);

  return data;
}

/**
 * Get daily transaction count
 */
export async function getDailyTxCount(
  startdate: string,
  enddate: string,
  sort: 'asc' | 'desc' = 'asc'
): Promise<EtherscanDailyStats[]> {
  const cacheKey = `etherscan:dailytx:${startdate}-${enddate}-${sort}`;
  const cached = cache.get<EtherscanDailyStats[]>(cacheKey);
  if (cached) return cached;

  const data = await fetchEtherscan<EtherscanDailyStats[]>('ethereum', 'stats', 'dailytx', {
    startdate,
    enddate,
    sort,
  });

  cache.set(cacheKey, data, CACHE_TTL.historical_1d);
  return data;
}

/**
 * Get daily new address count
 */
export async function getDailyNewAddresses(
  startdate: string,
  enddate: string,
  sort: 'asc' | 'desc' = 'asc'
): Promise<EtherscanDailyStats[]> {
  const cacheKey = `etherscan:dailynewaddress:${startdate}-${enddate}-${sort}`;
  const cached = cache.get<EtherscanDailyStats[]>(cacheKey);
  if (cached) return cached;

  const data = await fetchEtherscan<EtherscanDailyStats[]>('ethereum', 'stats', 'dailynewaddress', {
    startdate,
    enddate,
    sort,
  });

  cache.set(cacheKey, data, CACHE_TTL.historical_1d);
  return data;
}

/**
 * Get daily network utilization
 */
export async function getDailyNetworkUtilization(
  startdate: string,
  enddate: string,
  sort: 'asc' | 'desc' = 'asc'
): Promise<EtherscanDailyStats[]> {
  const cacheKey = `etherscan:dailynetutilization:${startdate}-${enddate}-${sort}`;
  const cached = cache.get<EtherscanDailyStats[]>(cacheKey);
  if (cached) return cached;

  const data = await fetchEtherscan<EtherscanDailyStats[]>(
    'ethereum',
    'stats',
    'dailynetutilization',
    {
      startdate,
      enddate,
      sort,
    }
  );

  cache.set(cacheKey, data, CACHE_TTL.historical_1d);
  return data;
}

/**
 * Get daily average gas price
 */
export async function getDailyAvgGasPrice(
  startdate: string,
  enddate: string,
  sort: 'asc' | 'desc' = 'asc'
): Promise<EtherscanDailyStats[]> {
  const cacheKey = `etherscan:dailyavggasprice:${startdate}-${enddate}-${sort}`;
  const cached = cache.get<EtherscanDailyStats[]>(cacheKey);
  if (cached) return cached;

  const data = await fetchEtherscan<EtherscanDailyStats[]>('ethereum', 'stats', 'dailyavggasprice', {
    startdate,
    enddate,
    sort,
  });

  cache.set(cacheKey, data, CACHE_TTL.historical_1d);
  return data;
}

// =============================================================================
// Account API Functions
// =============================================================================

/**
 * Get ETH balance for address
 */
export async function getBalance(address: string, chain: Chain = 'ethereum'): Promise<string> {
  const cacheKey = `etherscan:balance:${chain}:${address}`;
  const cached = cache.get<string>(cacheKey);
  if (cached) return cached;

  const data = await fetchEtherscan<string>(chain, 'account', 'balance', {
    address,
    tag: 'latest',
  });

  cache.set(cacheKey, data, CACHE_TTL.prices);
  return data;
}

/**
 * Get ETH balance for multiple addresses
 */
export async function getMultiBalance(
  addresses: string[],
  chain: Chain = 'ethereum'
): Promise<Array<{ account: string; balance: string }>> {
  const cacheKey = `etherscan:multibalance:${chain}:${addresses.join(',')}`;
  const cached = cache.get<Array<{ account: string; balance: string }>>(cacheKey);
  if (cached) return cached;

  const data = await fetchEtherscan<Array<{ account: string; balance: string }>>(
    chain,
    'account',
    'balancemulti',
    {
      address: addresses.join(','),
      tag: 'latest',
    }
  );

  cache.set(cacheKey, data, CACHE_TTL.prices);
  return data;
}

/**
 * Get normal transactions for address
 */
export async function getTransactions(
  address: string,
  chain: Chain = 'ethereum',
  page: number = 1,
  offset: number = 10,
  sort: 'asc' | 'desc' = 'desc'
): Promise<EtherscanTransaction[]> {
  const cacheKey = `etherscan:txlist:${chain}:${address}:${page}:${offset}:${sort}`;
  const cached = cache.get<EtherscanTransaction[]>(cacheKey);
  if (cached) return cached;

  const data = await fetchEtherscan<EtherscanTransaction[]>(chain, 'account', 'txlist', {
    address,
    page: page.toString(),
    offset: offset.toString(),
    sort,
  });

  cache.set(cacheKey, data, CACHE_TTL.blocks);
  return data;
}

/**
 * Get ERC-20 token transfers for address
 */
export async function getTokenTransfers(
  address: string,
  chain: Chain = 'ethereum',
  contractAddress?: string,
  page: number = 1,
  offset: number = 10,
  sort: 'asc' | 'desc' = 'desc'
): Promise<EtherscanTokenTransfer[]> {
  const cacheKey = `etherscan:tokentx:${chain}:${address}:${contractAddress || 'all'}:${page}:${offset}:${sort}`;
  const cached = cache.get<EtherscanTokenTransfer[]>(cacheKey);
  if (cached) return cached;

  const params: Record<string, string> = {
    address,
    page: page.toString(),
    offset: offset.toString(),
    sort,
  };

  if (contractAddress) {
    params.contractaddress = contractAddress;
  }

  const data = await fetchEtherscan<EtherscanTokenTransfer[]>(chain, 'account', 'tokentx', params);

  cache.set(cacheKey, data, CACHE_TTL.blocks);
  return data;
}

// =============================================================================
// Contract API Functions
// =============================================================================

/**
 * Get contract ABI
 */
export async function getContractABI(
  address: string,
  chain: Chain = 'ethereum'
): Promise<string> {
  const cacheKey = `etherscan:abi:${chain}:${address}`;
  const cached = cache.get<string>(cacheKey);
  if (cached) return cached;

  const data = await fetchEtherscan<string>(chain, 'contract', 'getabi', {
    address,
  });

  cache.set(cacheKey, data, CACHE_TTL.static);
  return data;
}

/**
 * Get contract source code
 */
export async function getContractSource(
  address: string,
  chain: Chain = 'ethereum'
): Promise<EtherscanContractSourceCode[]> {
  const cacheKey = `etherscan:source:${chain}:${address}`;
  const cached = cache.get<EtherscanContractSourceCode[]>(cacheKey);
  if (cached) return cached;

  const data = await fetchEtherscan<EtherscanContractSourceCode[]>(
    chain,
    'contract',
    'getsourcecode',
    {
      address,
    }
  );

  cache.set(cacheKey, data, CACHE_TTL.static);
  return data;
}

// =============================================================================
// Token API Functions
// =============================================================================

/**
 * Get token info by contract address
 */
export async function getTokenInfo(
  contractAddress: string,
  chain: Chain = 'ethereum'
): Promise<EtherscanTokenInfo[]> {
  const cacheKey = `etherscan:tokeninfo:${chain}:${contractAddress}`;
  const cached = cache.get<EtherscanTokenInfo[]>(cacheKey);
  if (cached) return cached;

  const data = await fetchEtherscan<EtherscanTokenInfo[]>(chain, 'token', 'tokeninfo', {
    contractaddress: contractAddress,
  });

  cache.set(cacheKey, data, CACHE_TTL.static);
  return data;
}

/**
 * Get token holder count
 */
export async function getTokenHolderCount(
  contractAddress: string,
  chain: Chain = 'ethereum'
): Promise<string> {
  const cacheKey = `etherscan:tokenholdercount:${chain}:${contractAddress}`;
  const cached = cache.get<string>(cacheKey);
  if (cached) return cached;

  const data = await fetchEtherscan<string>(chain, 'token', 'tokenholdercount', {
    contractaddress: contractAddress,
  });

  cache.set(cacheKey, data, CACHE_TTL.global);
  return data;
}

// =============================================================================
// Block API Functions
// =============================================================================

/**
 * Get block reward by block number
 */
export async function getBlockReward(
  blockNo: number,
  chain: Chain = 'ethereum'
): Promise<EtherscanBlock> {
  const cacheKey = `etherscan:blockreward:${chain}:${blockNo}`;
  const cached = cache.get<EtherscanBlock>(cacheKey);
  if (cached) return cached;

  const data = await fetchEtherscan<EtherscanBlock>(chain, 'block', 'getblockreward', {
    blockno: blockNo.toString(),
  });

  cache.set(cacheKey, data, CACHE_TTL.static);
  return data;
}

/**
 * Get block number by timestamp
 */
export async function getBlockByTimestamp(
  timestamp: number,
  closest: 'before' | 'after' = 'before',
  chain: Chain = 'ethereum'
): Promise<string> {
  const cacheKey = `etherscan:blockbytime:${chain}:${timestamp}:${closest}`;
  const cached = cache.get<string>(cacheKey);
  if (cached) return cached;

  const data = await fetchEtherscan<string>(chain, 'block', 'getblocknobytime', {
    timestamp: timestamp.toString(),
    closest,
  });

  cache.set(cacheKey, data, CACHE_TTL.static);
  return data;
}

// =============================================================================
// Composite Functions
// =============================================================================

/**
 * Get comprehensive Ethereum network stats
 */
export async function getNetworkStats(): Promise<{
  price: EtherscanEthPrice;
  supply: EtherscanEthSupply;
  gas: EtherscanGasOracle;
  nodes: EtherscanNodeCount | null;
}> {
  const [price, supply, gas, nodes] = await Promise.allSettled([
    getEthPrice(),
    getEthSupply(),
    getGasOracle(),
    getNodeCount(),
  ]);

  return {
    price: price.status === 'fulfilled' ? price.value : ({} as EtherscanEthPrice),
    supply: supply.status === 'fulfilled' ? supply.value : ({} as EtherscanEthSupply),
    gas: gas.status === 'fulfilled' ? gas.value : ({} as EtherscanGasOracle),
    nodes: nodes.status === 'fulfilled' ? nodes.value : null,
  };
}

/**
 * Get wallet overview with balance and recent transactions
 */
export async function getWalletOverview(
  address: string,
  chain: Chain = 'ethereum'
): Promise<{
  balance: string;
  balanceEth: number;
  transactions: EtherscanTransaction[];
  tokenTransfers: EtherscanTokenTransfer[];
}> {
  const [balance, transactions, tokenTransfers] = await Promise.allSettled([
    getBalance(address, chain),
    getTransactions(address, chain, 1, 10),
    getTokenTransfers(address, chain, undefined, 1, 10),
  ]);

  const balanceWei = balance.status === 'fulfilled' ? balance.value : '0';
  const balanceEth = parseFloat(balanceWei) / 1e18;

  return {
    balance: balanceWei,
    balanceEth,
    transactions: transactions.status === 'fulfilled' ? transactions.value : [],
    tokenTransfers: tokenTransfers.status === 'fulfilled' ? tokenTransfers.value : [],
  };
}

/**
 * Get gas price comparison across chains
 */
export async function getGasComparison(): Promise<
  Array<{
    chain: string;
    chainId: number;
    fastGwei: number;
    standardGwei: number;
    slowGwei: number;
    estimatedFastTxCost: number;
    estimatedStandardTxCost: number;
  }>
> {
  const gasPrices = await getAllChainGasPrices();
  const ethPrice = await getEthPrice();
  const ethUsd = parseFloat(ethPrice.ethusd);

  // Standard ETH transfer gas: 21000
  const standardGas = 21000;

  return gasPrices.map((g) => ({
    chain: g.name,
    chainId: g.chainId,
    fastGwei: g.fastGas,
    standardGwei: g.standardGas,
    slowGwei: g.safeGas,
    estimatedFastTxCost: (g.fastGas * standardGas * ethUsd) / 1e9,
    estimatedStandardTxCost: (g.standardGas * standardGas * ethUsd) / 1e9,
  }));
}

/**
 * Format wei to ETH string
 */
export function weiToEth(wei: string | number): number {
  return parseFloat(wei.toString()) / 1e18;
}

/**
 * Format gwei to ETH string
 */
export function gweiToEth(gwei: number): number {
  return gwei / 1e9;
}
