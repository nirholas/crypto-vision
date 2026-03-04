/**
 * GraphQL API Endpoint
 * 
 * Provides flexible querying for power users.
 * Supports introspection and typed queries.
 * 
 * @route POST /api/v2/graphql
 */

import { NextRequest, NextResponse } from 'next/server';
import { hybridAuthMiddleware } from '@/lib/x402';
import { logger, createRequestContext, completeRequest } from '@/lib/monitoring';
import { 
  getCoinMarkets, 
  getCoinDetails, 
  getGlobalData, 
  getTrendingCoins,
  searchCoins,
  getDefiTVL,
  getGasPrices,
  getVolatilityMetrics,
} from '@/lib/data-sources';

const ENDPOINT = '/api/v2/graphql';

// =============================================================================
// GRAPHQL SCHEMA DEFINITION
// =============================================================================

const typeDefs = `
  type Query {
    # Get list of coins with market data
    coins(page: Int, perPage: Int, order: String, ids: [String]): CoinConnection!
    
    # Get single coin details
    coin(id: String!): Coin
    
    # Get global market data
    global: GlobalData!
    
    # Get trending coins
    trending: [TrendingCoin!]!
    
    # Search for coins
    search(query: String!): SearchResults!
    
    # Get DeFi protocols
    defi(limit: Int, category: String): DefiData!
    
    # Get gas prices
    gas(network: String): GasData!
    
    # Get volatility metrics
    volatility(ids: [String]): VolatilityData!
  }
  
  type CoinConnection {
    coins: [CoinMarket!]!
    total: Int!
    page: Int!
    perPage: Int!
  }
  
  type CoinMarket {
    id: String!
    symbol: String!
    name: String!
    price: Float!
    marketCap: Float!
    rank: Int!
    volume24h: Float!
    priceChange24h: Float
    priceChangePercent24h: Float
    priceChangePercent7d: Float
    priceChangePercent30d: Float
    circulatingSupply: Float
    totalSupply: Float
    maxSupply: Float
    ath: Float
    athChangePercent: Float
    image: String
    lastUpdated: String
  }
  
  type Coin {
    id: String!
    symbol: String!
    name: String!
    price: Float!
    marketCap: Float!
    rank: Int!
    volume24h: Float!
    priceChange24h: Float
    description: String
    homepage: String
    github: [String]
    twitter: String
    reddit: String
    categories: [String]
    genesisDate: String
    hashingAlgorithm: String
    developerScore: Float
    communityScore: Float
    liquidityScore: Float
    sentimentUp: Float
    sentimentDown: Float
    lastUpdated: String
  }
  
  type GlobalData {
    totalMarketCap: Float!
    totalVolume24h: Float!
    btcDominance: Float!
    ethDominance: Float!
    activeCryptocurrencies: Int!
    markets: Int!
    marketCapChange24h: Float
    lastUpdated: String
  }
  
  type TrendingCoin {
    id: String!
    name: String!
    symbol: String!
    rank: Int
    thumb: String
    priceBtc: Float
    score: Int
  }
  
  type SearchResults {
    coins: [SearchResult!]!
    total: Int!
  }
  
  type SearchResult {
    id: String!
    name: String!
    symbol: String!
    rank: Int
    thumb: String
    type: String
  }
  
  type DefiData {
    protocols: [DefiProtocol!]!
    totalTVL: Float!
    protocolCount: Int!
  }
  
  type DefiProtocol {
    id: String!
    name: String!
    symbol: String
    tvl: Float!
    change24h: Float
    change7d: Float
    category: String
    chains: [String]
  }
  
  type GasData {
    ethereum: GasNetwork
    bitcoin: GasNetwork
  }
  
  type GasNetwork {
    slow: Float!
    standard: Float!
    fast: Float!
    unit: String!
  }
  
  type VolatilityData {
    metrics: [VolatilityMetric!]!
    summary: VolatilitySummary!
  }
  
  type VolatilityMetric {
    id: String!
    symbol: String!
    name: String!
    volatility24h: Float
    volatility7d: Float
    volatility30d: Float
    maxDrawdown30d: Float
    sharpeRatio: Float
    beta: Float
    riskLevel: String
  }
  
  type VolatilitySummary {
    averageVolatility30d: Float!
    highRiskCount: Int!
    totalAnalyzed: Int!
  }
`;

// =============================================================================
// RESOLVERS
// =============================================================================

interface GraphQLArgs {
  [key: string]: unknown;
}

const resolvers = {
  coins: async (args: GraphQLArgs) => {
    const page = (args.page as number) || 1;
    const perPage = (args.perPage as number) || 100;
    const order = (args.order as string) || 'market_cap_desc';
    const ids = args.ids as string[] | undefined;
    
    const coins = await getCoinMarkets({
      page,
      perPage,
      order,
      ids,
    });
    
    return {
      coins,
      total: coins.length,
      page,
      perPage,
    };
  },
  
  coin: async (args: GraphQLArgs) => {
    const id = args.id as string;
    return getCoinDetails(id);
  },
  
  global: async () => {
    return getGlobalData();
  },
  
  trending: async () => {
    const result = await getTrendingCoins();
    return result;
  },
  
  search: async (args: GraphQLArgs) => {
    const query = args.query as string;
    const result = await searchCoins(query);
    return {
      coins: result,
      total: result.length,
    };
  },
  
  defi: async () => {
    const result = await getDefiTVL();
    return {
      protocols: result.protocols || [],
      totalTVL: result.totalTVL || 0,
      protocolCount: result.protocols?.length || 0,
    };
  },
  
  gas: async () => {
    const result = await getGasPrices();
    return {
      ethereum: result.ethereum ? {
        ...result.ethereum,
        unit: 'gwei',
      } : null,
      bitcoin: result.bitcoin ? {
        ...result.bitcoin,
        unit: 'sat/vB',
      } : null,
    };
  },
  
  volatility: async (args: GraphQLArgs) => {
    const ids = (args.ids as string[]) || ['bitcoin', 'ethereum'];
    const result = await getVolatilityMetrics(ids);
    const avgVolatility = result.length > 0 
      ? result.reduce((sum, m) => sum + (m.volatility30d || 0), 0) / result.length
      : 0;
    const highRiskCount = result.filter(m => (m.volatility30d || 0) > 50).length;
    
    return {
      metrics: result,
      summary: {
        averageVolatility30d: avgVolatility,
        highRiskCount,
        totalAnalyzed: result.length,
      },
    };
  },
};

// =============================================================================
// SIMPLE GRAPHQL PARSER
// =============================================================================

interface ParsedQuery {
  operation: string;
  fields: string[];
  args: Record<string, unknown>;
}

function parseGraphQLQuery(query: string): ParsedQuery[] {
  const queries: ParsedQuery[] = [];
  
  // Remove comments
  const cleaned = query.replace(/#[^\n]*/g, '').trim();
  
  // Extract query block
  const queryMatch = cleaned.match(/\{\s*([\s\S]+)\s*\}/);
  if (!queryMatch) return queries;
  
  const body = queryMatch[1];
  
  // Parse each top-level field
  const fieldRegex = /(\w+)(?:\s*\(\s*([^)]*)\s*\))?\s*(?:\{([^}]*)\})?/g;
  let match;
  
  while ((match = fieldRegex.exec(body)) !== null) {
    const [, operation, argsStr, fieldsStr] = match;
    
    // Parse arguments
    const args: Record<string, unknown> = {};
    if (argsStr) {
      const argPairs = argsStr.match(/(\w+)\s*:\s*("[^"]*"|\[[^\]]*\]|\d+|true|false|\w+)/g);
      if (argPairs) {
        for (const pair of argPairs) {
          const [key, value] = pair.split(':').map(s => s.trim());
          try {
            args[key] = JSON.parse(value.replace(/'/g, '"'));
          } catch {
            args[key] = value.replace(/^"|"$/g, '');
          }
        }
      }
    }
    
    // Parse requested fields
    const fields = fieldsStr 
      ? fieldsStr.split(/\s+/).filter(f => f && !f.includes('{') && !f.includes('}'))
      : [];
    
    queries.push({ operation, fields, args });
  }
  
  return queries;
}

function selectFields<T extends Record<string, unknown>>(obj: T, fields: string[]): Partial<T> {
  if (!fields.length) return obj;
  
  const result: Partial<T> = {};
  for (const field of fields) {
    if (field in obj) {
      result[field as keyof T] = obj[field as keyof T];
    }
  }
  return result;
}

// =============================================================================
// ROUTE HANDLER
// =============================================================================

export async function POST(request: NextRequest) {
  const startTime = performance.now();
  const ctx = createRequestContext(ENDPOINT, 'POST');
  
  const authResponse = await hybridAuthMiddleware(request, ENDPOINT);
  if (authResponse) {
    completeRequest(ctx, 401);
    return authResponse;
  }
  
  try {
    const body = await request.json();
    const { query, variables } = body;
    
    if (!query) {
      return NextResponse.json(
        { errors: [{ message: 'Query is required' }] },
        { status: 400 }
      );
    }
    
    // Handle introspection
    if (query.includes('__schema') || query.includes('__type')) {
      return NextResponse.json({
        data: {
          __schema: {
            types: [
              { name: 'Query', kind: 'OBJECT' },
              { name: 'CoinMarket', kind: 'OBJECT' },
              { name: 'Coin', kind: 'OBJECT' },
              { name: 'GlobalData', kind: 'OBJECT' },
            ],
            queryType: { name: 'Query' },
          },
        },
      });
    }
    
    // Parse and execute query
    const parsedQueries = parseGraphQLQuery(query);
    const data: Record<string, unknown> = {};
    const errors: Array<{ message: string; path: string[] }> = [];
    
    for (const pq of parsedQueries) {
      const resolver = resolvers[pq.operation as keyof typeof resolvers];
      
      if (!resolver) {
        errors.push({
          message: `Unknown field: ${pq.operation}`,
          path: [pq.operation],
        });
        continue;
      }
      
      try {
        // Merge variables into args
        const args = { ...pq.args };
        if (variables) {
          for (const [key, value] of Object.entries(variables)) {
            if (!(key in args)) {
              args[key] = value;
            }
          }
        }
        
        const result = await resolver(args);
        
        // Apply field selection for arrays - cast through unknown to avoid type conflicts
        if (Array.isArray(result)) {
          data[pq.operation] = result.map(item => 
            typeof item === 'object' && item !== null
              ? selectFields(item as unknown as Record<string, unknown>, pq.fields)
              : item
          );
        } else if (typeof result === 'object' && result !== null) {
          // For objects with nested arrays (like coins connection)
          const obj = { ...result } as Record<string, unknown>;
          for (const [key, value] of Object.entries(obj)) {
            if (Array.isArray(value)) {
              obj[key] = value.map(item =>
                typeof item === 'object' && item !== null
                  ? selectFields(item as unknown as Record<string, unknown>, pq.fields)
                  : item
              );
            }
          }
          data[pq.operation] = obj;
        } else {
          data[pq.operation] = result;
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        errors.push({
          message: errorMessage,
          path: [pq.operation],
        });
        logger.error(`GraphQL resolver error: ${pq.operation} - ${errorMessage}`);
      }
    }
    
    const latencyMs = performance.now() - startTime;
    completeRequest(ctx, 200);
    
    return NextResponse.json({
      data: Object.keys(data).length > 0 ? data : null,
      errors: errors.length > 0 ? errors : undefined,
      extensions: {
        timing: { totalMs: Math.round(latencyMs) },
        requestId: ctx.requestId,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`GraphQL request failed: ${errorMessage}`);
    completeRequest(ctx, 500, error instanceof Error ? error : undefined);
    
    return NextResponse.json(
      {
        data: null,
        errors: [{ message: 'Internal server error' }],
      },
      { status: 500 }
    );
  }
}

// GET for GraphQL Playground/introspection
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  // If query param provided, treat as GET query
  const query = searchParams.get('query');
  if (query) {
    const mockRequest = new NextRequest(request.url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify({ query }),
    });
    return POST(mockRequest);
  }
  
  // Return GraphQL playground HTML
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>GraphQL Playground | Crypto Data API</title>
  <link rel="stylesheet" href="https://unpkg.com/graphiql@3.0.10/graphiql.min.css" />
  <style>
    body { margin: 0; height: 100vh; }
    #graphiql { height: 100vh; }
  </style>
</head>
<body>
  <div id="graphiql">Loading...</div>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/graphiql@3.0.10/graphiql.min.js"></script>
  <script>
    const fetcher = GraphiQL.createFetcher({
      url: '/api/v2/graphql',
      headers: {
        'X-API-Key': localStorage.getItem('crypto_api_key') || ''
      }
    });
    
    ReactDOM.createRoot(document.getElementById('graphiql')).render(
      React.createElement(GraphiQL, {
        fetcher,
        defaultQuery: \`# Welcome to the Crypto Data GraphQL API!
# Try a query:

{
  coins(page: 1, perPage: 10) {
    coins {
      id
      name
      symbol
      price
      marketCap
      priceChangePercent24h
    }
    total
  }
  
  global {
    totalMarketCap
    btcDominance
    ethDominance
  }
  
  trending {
    id
    name
    symbol
    score
  }
}
\`
      })
    );
  </script>
</body>
</html>
  `;
  
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}

// OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}
