/**
 * The Graph Protocol API Integration
 * 
 * Decentralized indexing protocol for querying blockchain data.
 * Access to DeFi protocol subgraphs for real-time on-chain data.
 * 
 * @see https://thegraph.com/docs/en/
 * @module lib/apis/thegraph
 */

const GATEWAY_URL = 'https://gateway.thegraph.com/api';
const API_KEY = process.env.THEGRAPH_API_KEY || '';

// Popular subgraph IDs for DeFi protocols
const SUBGRAPHS = {
  uniswapV3: {
    ethereum: 'ELUcwgpm14LKPLrBRuVvPvNKHQ9HvwmtKgKSH6123cr7',
    arbitrum: 'FbCGRftH4a3yZugY7TnbYgPJVEv2LvMT6oF1fxPe9aJM',
    polygon: 'H2d2Y6MG3L5EALSfJMvMsKNL9AKvAqAhVGsVKT6ydPCU',
    optimism: 'Gc2YGhbL2cYGvQVepCbKBSVHXSdK8M8A5qx4tRdqcmvU',
    base: 'D2rGTaZfv9BaxEJYxLzHMKhsZSG4iVHTHr9HVxGpN3PH',
  },
  aaveV3: {
    ethereum: '4gHr2DhGqHBhKr6Yh7MzPVH3FEiE8VKXAdP8kQyLVZwP',
    arbitrum: 'JBnWrv9pvBvSi2pUZzba3VweGBTde6s44QvsDABP47Gt',
    polygon: 'Co2URyXjnxaw8WqxKyVHxKzQSLWx3hMZUWfPv16pZ3mG',
    optimism: 'JBnWrv9pvBvSi2pUZzba3VweGBTde6s44QvsDABP47Gt',
  },
  compoundV3: {
    ethereum: '3sPhNVdLo9mEuUVYoKkT66DQJ1tq6Tm8LfVJwPJLNtYH',
  },
  curveFinance: {
    ethereum: 'HAFKPqjhEkqUJhbCHfhQjLqbCuTpLWNGZ5RDsz3LcVPT',
  },
  gmx: {
    arbitrum: '2Rg6S91bLqS9PdyZgP6bUq3xJzJxKwQZjKLxHnqDpQQN',
  },
  lido: {
    ethereum: 'Sxx812XgeKyzQPaBpR5YZWmGV5fZuBWg3P5qwzrMNGk',
  },
  maker: {
    ethereum: 'QmPnLDh7X9j1vM6m2iZy1PdpqGMEKbKKBKvEGcDAKzPMCG',
  },
};

// =============================================================================
// Types
// =============================================================================

export interface SubgraphQuery {
  query: string;
  variables?: Record<string, unknown>;
}

export interface UniswapPool {
  id: string;
  token0: {
    id: string;
    symbol: string;
    name: string;
    decimals: string;
  };
  token1: {
    id: string;
    symbol: string;
    name: string;
    decimals: string;
  };
  feeTier: string;
  liquidity: string;
  sqrtPrice: string;
  token0Price: string;
  token1Price: string;
  volumeUSD: string;
  txCount: string;
  totalValueLockedUSD: string;
  totalValueLockedToken0: string;
  totalValueLockedToken1: string;
}

export interface UniswapSwap {
  id: string;
  timestamp: string;
  pool: { id: string };
  sender: string;
  recipient: string;
  amount0: string;
  amount1: string;
  amountUSD: string;
  sqrtPriceX96: string;
  tick: string;
}

export interface AaveMarket {
  id: string;
  name: string;
  inputToken: {
    id: string;
    symbol: string;
    name: string;
    decimals: number;
  };
  outputToken: {
    id: string;
    symbol: string;
    name: string;
  };
  totalValueLockedUSD: string;
  totalDepositBalanceUSD: string;
  totalBorrowBalanceUSD: string;
  rates: {
    rate: string;
    side: 'LENDER' | 'BORROWER';
    type: 'STABLE' | 'VARIABLE';
  }[];
}

export interface CurvePool {
  id: string;
  name: string;
  coins: {
    token: {
      id: string;
      symbol: string;
      decimals: string;
    };
    balance: string;
  }[];
  virtualPrice: string;
  A: string;
  fee: string;
  adminFee: string;
  tvl: string;
  dailyVolume: string;
  apy: string;
}

export interface DeFiProtocolData {
  protocol: string;
  chain: string;
  tvl: number;
  volume24h: number;
  users24h: number;
  transactions24h: number;
  topPools: Array<{
    id: string;
    name: string;
    tvl: number;
    volume24h: number;
    apy?: number;
  }>;
  timestamp: string;
}

export interface CrossProtocolAnalysis {
  protocols: DeFiProtocolData[];
  totalTvl: number;
  totalVolume24h: number;
  topYieldOpportunities: Array<{
    protocol: string;
    pool: string;
    apy: number;
    tvl: number;
    risk: 'low' | 'medium' | 'high';
  }>;
  liquidityDistribution: Record<string, number>;
  timestamp: string;
}

// =============================================================================
// API Functions
// =============================================================================

/**
 * Execute a GraphQL query against a subgraph
 */
async function querySubgraph<T>(
  subgraphId: string,
  query: SubgraphQuery
): Promise<T | null> {
  if (!API_KEY) {
    console.warn('The Graph API key not configured, using public gateway');
  }

  try {
    const url = API_KEY 
      ? `${GATEWAY_URL}/${API_KEY}/subgraphs/id/${subgraphId}`
      : `https://api.thegraph.com/subgraphs/id/${subgraphId}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(query),
      next: { revalidate: 60 }, // Cache for 1 minute
    });

    if (!response.ok) {
      console.error(`The Graph API error: ${response.status}`);
      return null;
    }

    const result = await response.json();
    
    if (result.errors) {
      console.error('GraphQL errors:', result.errors);
      return null;
    }

    return result.data;
  } catch (error) {
    console.error('The Graph API request failed:', error);
    return null;
  }
}

/**
 * Get Uniswap V3 pools
 */
export async function getUniswapPools(
  chain: keyof typeof SUBGRAPHS.uniswapV3 = 'ethereum',
  options?: { first?: number; orderBy?: string }
): Promise<UniswapPool[]> {
  const subgraphId = SUBGRAPHS.uniswapV3[chain];
  if (!subgraphId) return [];

  const query = {
    query: `
      query GetPools($first: Int!, $orderBy: String!) {
        pools(
          first: $first
          orderBy: $orderBy
          orderDirection: desc
          where: { liquidity_gt: "0" }
        ) {
          id
          token0 { id symbol name decimals }
          token1 { id symbol name decimals }
          feeTier
          liquidity
          sqrtPrice
          token0Price
          token1Price
          volumeUSD
          txCount
          totalValueLockedUSD
          totalValueLockedToken0
          totalValueLockedToken1
        }
      }
    `,
    variables: {
      first: options?.first || 50,
      orderBy: options?.orderBy || 'totalValueLockedUSD',
    },
  };

  const data = await querySubgraph<{ pools: UniswapPool[] }>(subgraphId, query);
  return data?.pools || [];
}

/**
 * Get recent Uniswap swaps
 */
export async function getUniswapSwaps(
  chain: keyof typeof SUBGRAPHS.uniswapV3 = 'ethereum',
  options?: { first?: number; poolId?: string }
): Promise<UniswapSwap[]> {
  const subgraphId = SUBGRAPHS.uniswapV3[chain];
  if (!subgraphId) return [];

  const whereClause = options?.poolId 
    ? `where: { pool: "${options.poolId}" }`
    : '';

  const query = {
    query: `
      query GetSwaps($first: Int!) {
        swaps(
          first: $first
          orderBy: timestamp
          orderDirection: desc
          ${whereClause}
        ) {
          id
          timestamp
          pool { id }
          sender
          recipient
          amount0
          amount1
          amountUSD
          sqrtPriceX96
          tick
        }
      }
    `,
    variables: {
      first: options?.first || 100,
    },
  };

  const data = await querySubgraph<{ swaps: UniswapSwap[] }>(subgraphId, query);
  return data?.swaps || [];
}

/**
 * Get Aave markets
 */
export async function getAaveMarkets(
  chain: keyof typeof SUBGRAPHS.aaveV3 = 'ethereum'
): Promise<AaveMarket[]> {
  const subgraphId = SUBGRAPHS.aaveV3[chain];
  if (!subgraphId) return [];

  const query = {
    query: `
      query GetMarkets {
        markets(
          first: 50
          orderBy: totalValueLockedUSD
          orderDirection: desc
        ) {
          id
          name
          inputToken { id symbol name decimals }
          outputToken { id symbol name }
          totalValueLockedUSD
          totalDepositBalanceUSD
          totalBorrowBalanceUSD
          rates {
            rate
            side
            type
          }
        }
      }
    `,
  };

  const data = await querySubgraph<{ markets: AaveMarket[] }>(subgraphId, query);
  return data?.markets || [];
}

/**
 * Get lending rates from Aave
 */
export async function getAaveLendingRates(
  chain: keyof typeof SUBGRAPHS.aaveV3 = 'ethereum'
): Promise<Array<{
  asset: string;
  symbol: string;
  supplyAPY: number;
  borrowAPY: number;
  tvl: number;
  utilization: number;
}>> {
  const markets = await getAaveMarkets(chain);

  return markets.map(market => {
    const supplyRate = market.rates.find(r => r.side === 'LENDER')?.rate || '0';
    const borrowRate = market.rates.find(r => r.side === 'BORROWER' && r.type === 'VARIABLE')?.rate || '0';
    
    const tvl = parseFloat(market.totalValueLockedUSD);
    const deposits = parseFloat(market.totalDepositBalanceUSD);
    const borrows = parseFloat(market.totalBorrowBalanceUSD);
    const utilization = deposits > 0 ? (borrows / deposits) * 100 : 0;

    return {
      asset: market.inputToken.id,
      symbol: market.inputToken.symbol,
      supplyAPY: parseFloat(supplyRate) * 100,
      borrowAPY: parseFloat(borrowRate) * 100,
      tvl,
      utilization,
    };
  });
}

/**
 * Get Curve Finance pools
 */
export async function getCurvePools(): Promise<CurvePool[]> {
  const subgraphId = SUBGRAPHS.curveFinance.ethereum;

  const query = {
    query: `
      query GetPools {
        pools(
          first: 50
          orderBy: tvl
          orderDirection: desc
          where: { tvl_gt: "1000000" }
        ) {
          id
          name
          coins {
            token { id symbol decimals }
            balance
          }
          virtualPrice
          A
          fee
          adminFee
          tvl
          dailyVolume
          apy
        }
      }
    `,
  };

  const data = await querySubgraph<{ pools: CurvePool[] }>(subgraphId, query);
  return data?.pools || [];
}

/**
 * Get protocol data summary
 */
export async function getProtocolData(
  protocol: keyof typeof SUBGRAPHS,
  chain: string = 'ethereum'
): Promise<DeFiProtocolData | null> {
  try {
    switch (protocol) {
      case 'uniswapV3': {
        const pools = await getUniswapPools(chain as keyof typeof SUBGRAPHS.uniswapV3);
        const tvl = pools.reduce((sum, p) => sum + parseFloat(p.totalValueLockedUSD), 0);
        const volume = pools.reduce((sum, p) => sum + parseFloat(p.volumeUSD), 0);
        const txs = pools.reduce((sum, p) => sum + parseInt(p.txCount), 0);

        return {
          protocol: 'Uniswap V3',
          chain,
          tvl,
          volume24h: volume / 365, // Rough daily estimate
          users24h: 0,
          transactions24h: txs,
          topPools: pools.slice(0, 10).map(p => ({
            id: p.id,
            name: `${p.token0.symbol}/${p.token1.symbol}`,
            tvl: parseFloat(p.totalValueLockedUSD),
            volume24h: parseFloat(p.volumeUSD) / 365,
          })),
          timestamp: new Date().toISOString(),
        };
      }
      case 'aaveV3': {
        const markets = await getAaveMarkets(chain as keyof typeof SUBGRAPHS.aaveV3);
        const tvl = markets.reduce((sum, m) => sum + parseFloat(m.totalValueLockedUSD), 0);

        return {
          protocol: 'Aave V3',
          chain,
          tvl,
          volume24h: 0,
          users24h: 0,
          transactions24h: 0,
          topPools: markets.slice(0, 10).map(m => ({
            id: m.id,
            name: m.inputToken.symbol,
            tvl: parseFloat(m.totalValueLockedUSD),
            volume24h: 0,
            apy: parseFloat(m.rates.find(r => r.side === 'LENDER')?.rate || '0') * 100,
          })),
          timestamp: new Date().toISOString(),
        };
      }
      case 'curveFinance': {
        const pools = await getCurvePools();
        const tvl = pools.reduce((sum, p) => sum + parseFloat(p.tvl), 0);

        return {
          protocol: 'Curve Finance',
          chain: 'ethereum',
          tvl,
          volume24h: pools.reduce((sum, p) => sum + parseFloat(p.dailyVolume || '0'), 0),
          users24h: 0,
          transactions24h: 0,
          topPools: pools.slice(0, 10).map(p => ({
            id: p.id,
            name: p.name,
            tvl: parseFloat(p.tvl),
            volume24h: parseFloat(p.dailyVolume || '0'),
            apy: parseFloat(p.apy || '0'),
          })),
          timestamp: new Date().toISOString(),
        };
      }
      default:
        return null;
    }
  } catch (error) {
    console.error(`Error fetching ${protocol} data:`, error);
    return null;
  }
}

/**
 * Get cross-protocol analysis
 */
export async function getCrossProtocolAnalysis(): Promise<CrossProtocolAnalysis> {
  const [uniswap, aave, curve] = await Promise.all([
    getProtocolData('uniswapV3', 'ethereum'),
    getProtocolData('aaveV3', 'ethereum'),
    getProtocolData('curveFinance', 'ethereum'),
  ]);

  const protocols = [uniswap, aave, curve].filter((p): p is DeFiProtocolData => p !== null);

  const totalTvl = protocols.reduce((sum, p) => sum + p.tvl, 0);
  const totalVolume24h = protocols.reduce((sum, p) => sum + p.volume24h, 0);

  // Find yield opportunities
  const yieldOpportunities: CrossProtocolAnalysis['topYieldOpportunities'] = [];

  if (aave) {
    aave.topPools.forEach(pool => {
      if (pool.apy && pool.apy > 1) {
        yieldOpportunities.push({
          protocol: 'Aave V3',
          pool: pool.name,
          apy: pool.apy,
          tvl: pool.tvl,
          risk: pool.apy > 10 ? 'high' : pool.apy > 5 ? 'medium' : 'low',
        });
      }
    });
  }

  if (curve) {
    curve.topPools.forEach(pool => {
      if (pool.apy && pool.apy > 1) {
        yieldOpportunities.push({
          protocol: 'Curve Finance',
          pool: pool.name,
          apy: pool.apy,
          tvl: pool.tvl,
          risk: pool.apy > 20 ? 'high' : pool.apy > 8 ? 'medium' : 'low',
        });
      }
    });
  }

  // Sort by APY
  yieldOpportunities.sort((a, b) => b.apy - a.apy);

  // Liquidity distribution
  const liquidityDistribution: Record<string, number> = {};
  protocols.forEach(p => {
    liquidityDistribution[p.protocol] = totalTvl > 0 ? (p.tvl / totalTvl) * 100 : 0;
  });

  return {
    protocols,
    totalTvl,
    totalVolume24h,
    topYieldOpportunities: yieldOpportunities.slice(0, 10),
    liquidityDistribution,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Execute custom GraphQL query against any subgraph
 */
export async function executeCustomQuery<T>(
  subgraphId: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<T | null> {
  return querySubgraph<T>(subgraphId, { query, variables });
}

/**
 * Get available subgraph IDs
 */
export function getAvailableSubgraphs(): typeof SUBGRAPHS {
  return SUBGRAPHS;
}
