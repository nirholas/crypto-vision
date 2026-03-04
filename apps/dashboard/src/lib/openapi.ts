/**
 * OpenAPI 3.1 Specification Generator
 * 
 * Auto-generates OpenAPI documentation from Zod schemas.
 * Provides interactive API documentation for v2 endpoints.
 * 
 * @module openapi
 */

import { z } from 'zod';

// =============================================================================
// OPENAPI TYPES
// =============================================================================

interface OpenAPIInfo {
  title: string;
  version: string;
  description?: string;
  contact?: {
    name?: string;
    url?: string;
    email?: string;
  };
  license?: {
    name: string;
    url?: string;
  };
}

interface OpenAPIServer {
  url: string;
  description?: string;
}

interface OpenAPIParameter {
  name: string;
  in: 'query' | 'path' | 'header';
  required?: boolean;
  description?: string;
  schema: Record<string, unknown>;
  example?: unknown;
}

interface OpenAPIResponse {
  description: string;
  content?: {
    [key: string]: {
      schema: Record<string, unknown>;
      example?: unknown;
    };
  };
}

interface OpenAPIOperation {
  operationId: string;
  summary: string;
  description?: string;
  tags?: string[];
  parameters?: OpenAPIParameter[];
  requestBody?: {
    required?: boolean;
    content: {
      'application/json': {
        schema: Record<string, unknown>;
        example?: unknown;
      };
    };
  };
  responses: Record<string, OpenAPIResponse>;
  security?: Array<Record<string, string[]>>;
  'x-price'?: string;
}

interface OpenAPIPath {
  get?: OpenAPIOperation;
  post?: OpenAPIOperation;
  put?: OpenAPIOperation;
  delete?: OpenAPIOperation;
}

interface OpenAPISecurityScheme {
  type: string;
  description?: string;
  name?: string;
  in?: string;
  scheme?: string;
}

interface OpenAPISpec {
  openapi: string;
  info: OpenAPIInfo;
  servers: OpenAPIServer[];
  paths: Record<string, OpenAPIPath>;
  components: {
    securitySchemes?: Record<string, OpenAPISecurityScheme>;
    schemas?: Record<string, Record<string, unknown>>;
  };
  tags?: Array<{ name: string; description?: string }>;
}

// =============================================================================
// ZOD TO JSON SCHEMA CONVERTER
// =============================================================================

function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  if (schema instanceof z.ZodString) {
    const checks = (schema as any)._def.checks || [];
    const result: Record<string, unknown> = { type: 'string' };
    
    for (const check of checks) {
      if (check.kind === 'min') result.minLength = check.value;
      if (check.kind === 'max') result.maxLength = check.value;
      if (check.kind === 'regex') result.pattern = check.regex.source;
    }
    
    return result;
  }
  
  if (schema instanceof z.ZodNumber) {
    const checks = (schema as any)._def.checks || [];
    const result: Record<string, unknown> = { type: 'number' };
    
    for (const check of checks) {
      if (check.kind === 'int') result.type = 'integer';
      if (check.kind === 'min') result.minimum = check.value;
      if (check.kind === 'max') result.maximum = check.value;
    }
    
    return result;
  }
  
  if (schema instanceof z.ZodBoolean) {
    return { type: 'boolean' };
  }
  
  if (schema instanceof z.ZodArray) {
    return {
      type: 'array',
      items: zodToJsonSchema((schema as any)._def.type),
    };
  }
  
  if (schema instanceof z.ZodObject) {
    const shape = (schema as any)._def.shape();
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    
    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodToJsonSchema(value as z.ZodTypeAny);
      if (!(value instanceof z.ZodOptional)) {
        required.push(key);
      }
    }
    
    return {
      type: 'object',
      properties,
      ...(required.length > 0 && { required }),
    };
  }
  
  if (schema instanceof z.ZodEnum) {
    return {
      type: 'string',
      enum: (schema as any)._def.values,
    };
  }
  
  if (schema instanceof z.ZodOptional) {
    return zodToJsonSchema((schema as any)._def.innerType);
  }
  
  if (schema instanceof z.ZodDefault) {
    const inner = zodToJsonSchema((schema as any)._def.innerType);
    return {
      ...inner,
      default: (schema as any)._def.defaultValue(),
    };
  }
  
  if (schema instanceof z.ZodEffects) {
    return zodToJsonSchema((schema as any)._def.schema);
  }
  
  return { type: 'string' };
}

// =============================================================================
// OPENAPI SPEC DEFINITION
// =============================================================================

export function generateOpenAPISpec(): OpenAPISpec {
  return {
    openapi: '3.1.0',
    info: {
      title: 'Crypto Data Aggregator API',
      version: '2.0.0',
      description: `
# Crypto Data Aggregator API v2

Comprehensive cryptocurrency and DeFi data API with enhanced security and reliability.

## Features
- Real-time market data for 10,000+ cryptocurrencies
- Historical price data and charting
- DeFi protocol TVL tracking
- Volatility and risk metrics
- Gas/fee estimates for multiple networks
- Search and trending functionality

## Authentication
All endpoints require authentication via one of:
- **API Key**: Include \`X-API-Key\` header or \`api_key\` query parameter
- **x402 Payment**: Pay-per-request with USDC on Base network

## Rate Limits
- Free tier: 100 requests/day
- Pro tier: 10,000 requests/day
- Enterprise: Unlimited
- x402: Pay per request (no limit)

## Response Format
All responses follow a consistent format:
\`\`\`json
{
  "success": true,
  "data": { ... },
  "meta": {
    "endpoint": "/api/v2/...",
    "requestId": "abc123",
    "timestamp": "2026-01-24T12:00:00Z"
  }
}
\`\`\`
      `.trim(),
      contact: {
        name: 'API Support',
        url: 'https://crypto-data-aggregator.vercel.app/docs',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'https://crypto-data-aggregator.vercel.app',
        description: 'Production server',
      },
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    tags: [
      { name: 'Market Data', description: 'Cryptocurrency market data and prices' },
      { name: 'Historical', description: 'Historical price and chart data' },
      { name: 'DeFi', description: 'DeFi protocol data and TVL' },
      { name: 'Analytics', description: 'Volatility, risk, and trending data' },
      { name: 'Utilities', description: 'Search, gas tracker, and health' },
    ],
    paths: {
      '/api/v2/coins': {
        get: {
          operationId: 'getCoins',
          summary: 'List cryptocurrencies',
          description: 'Returns paginated list of cryptocurrencies with market data including price, market cap, volume, and price changes.',
          tags: ['Market Data'],
          'x-price': '$0.001',
          parameters: [
            {
              name: 'page',
              in: 'query',
              description: 'Page number (1-indexed)',
              schema: { type: 'integer', minimum: 1, maximum: 1000, default: 1 },
              example: 1,
            },
            {
              name: 'per_page',
              in: 'query',
              description: 'Results per page',
              schema: { type: 'integer', minimum: 1, maximum: 250, default: 100 },
              example: 100,
            },
            {
              name: 'order',
              in: 'query',
              description: 'Sort order',
              schema: {
                type: 'string',
                enum: ['market_cap_desc', 'market_cap_asc', 'volume_desc', 'volume_asc', 'price_desc', 'price_asc'],
                default: 'market_cap_desc',
              },
            },
            {
              name: 'ids',
              in: 'query',
              description: 'Comma-separated coin IDs to filter',
              schema: { type: 'string' },
              example: 'bitcoin,ethereum,solana',
            },
            {
              name: 'sparkline',
              in: 'query',
              description: 'Include 7-day sparkline data',
              schema: { type: 'boolean', default: false },
            },
          ],
          responses: {
            '200': {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/CoinMarketData' },
                      },
                      meta: { $ref: '#/components/schemas/ResponseMeta' },
                    },
                  },
                },
              },
            },
            '400': { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
            '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
            '503': { description: 'Service unavailable', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
          security: [{ apiKey: [] }, { x402: [] }],
        },
      },
      '/api/v2/coin/{id}': {
        get: {
          operationId: 'getCoinById',
          summary: 'Get coin details',
          description: 'Returns detailed information about a specific cryptocurrency including description, links, scores, and extended metrics.',
          tags: ['Market Data'],
          'x-price': '$0.002',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              description: 'Coin ID (e.g., bitcoin, ethereum)',
              schema: { type: 'string', pattern: '^[a-z0-9-]+$' },
              example: 'bitcoin',
            },
          ],
          responses: {
            '200': {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: { $ref: '#/components/schemas/CoinDetails' },
                      meta: { $ref: '#/components/schemas/ResponseMeta' },
                    },
                  },
                },
              },
            },
            '404': { description: 'Coin not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
          security: [{ apiKey: [] }, { x402: [] }],
        },
      },
      '/api/v2/historical/{id}': {
        get: {
          operationId: 'getHistoricalPrices',
          summary: 'Get historical prices',
          description: 'Returns historical price, market cap, and volume data for charting.',
          tags: ['Historical'],
          'x-price': '$0.003',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              description: 'Coin ID',
              schema: { type: 'string' },
              example: 'bitcoin',
            },
            {
              name: 'days',
              in: 'query',
              description: 'Number of days of data',
              schema: { type: 'integer', enum: [1, 7, 14, 30, 90, 180, 365], default: 30 },
            },
          ],
          responses: {
            '200': {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          prices: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/HistoricalPrice' },
                          },
                          summary: { $ref: '#/components/schemas/PriceSummary' },
                        },
                      },
                      meta: { $ref: '#/components/schemas/ResponseMeta' },
                    },
                  },
                },
              },
            },
          },
          security: [{ apiKey: [] }, { x402: [] }],
        },
      },
      '/api/v2/global': {
        get: {
          operationId: 'getGlobalData',
          summary: 'Get global market data',
          description: 'Returns global cryptocurrency market statistics including total market cap, volume, and dominance.',
          tags: ['Market Data'],
          'x-price': '$0.001',
          responses: {
            '200': {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          market: { $ref: '#/components/schemas/GlobalMarketData' },
                          sentiment: { $ref: '#/components/schemas/FearGreedIndex' },
                        },
                      },
                      meta: { $ref: '#/components/schemas/ResponseMeta' },
                    },
                  },
                },
              },
            },
          },
          security: [{ apiKey: [] }, { x402: [] }],
        },
      },
      '/api/v2/defi': {
        get: {
          operationId: 'getDefiData',
          summary: 'Get DeFi protocol data',
          description: 'Returns DeFi protocol TVL rankings and statistics.',
          tags: ['DeFi'],
          'x-price': '$0.002',
          parameters: [
            {
              name: 'limit',
              in: 'query',
              description: 'Number of protocols to return',
              schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
            },
            {
              name: 'category',
              in: 'query',
              description: 'Filter by category (e.g., DEX, Lending)',
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          protocols: { type: 'array', items: { $ref: '#/components/schemas/DefiProtocol' } },
                          summary: { $ref: '#/components/schemas/DefiSummary' },
                        },
                      },
                      meta: { $ref: '#/components/schemas/ResponseMeta' },
                    },
                  },
                },
              },
            },
          },
          security: [{ apiKey: [] }, { x402: [] }],
        },
      },
      '/api/v2/gas': {
        get: {
          operationId: 'getGasPrices',
          summary: 'Get gas/fee estimates',
          description: 'Returns current gas prices for Ethereum and Bitcoin networks.',
          tags: ['Utilities'],
          'x-price': '$0.0005',
          parameters: [
            {
              name: 'network',
              in: 'query',
              description: 'Network to get gas for',
              schema: { type: 'string', enum: ['all', 'ethereum', 'eth', 'bitcoin', 'btc'], default: 'all' },
            },
          ],
          responses: {
            '200': {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: { $ref: '#/components/schemas/GasPrices' },
                      meta: { $ref: '#/components/schemas/ResponseMeta' },
                    },
                  },
                },
              },
            },
          },
          security: [{ apiKey: [] }, { x402: [] }],
        },
      },
      '/api/v2/ticker': {
        get: {
          operationId: 'getTicker',
          summary: 'Get real-time ticker',
          description: 'Returns real-time price ticker with bid/ask spread.',
          tags: ['Market Data'],
          'x-price': '$0.001',
          parameters: [
            {
              name: 'symbol',
              in: 'query',
              description: 'Single symbol (e.g., BTC)',
              schema: { type: 'string' },
              example: 'BTC',
            },
            {
              name: 'symbols',
              in: 'query',
              description: 'Comma-separated symbols',
              schema: { type: 'string' },
              example: 'BTC,ETH,SOL',
            },
          ],
          responses: {
            '200': {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: { $ref: '#/components/schemas/TickerData' },
                      meta: { $ref: '#/components/schemas/ResponseMeta' },
                    },
                  },
                },
              },
            },
          },
          security: [{ apiKey: [] }, { x402: [] }],
        },
      },
      '/api/v2/search': {
        get: {
          operationId: 'search',
          summary: 'Search cryptocurrencies',
          description: 'Search for coins and exchanges by name or symbol.',
          tags: ['Utilities'],
          'x-price': '$0.001',
          parameters: [
            {
              name: 'q',
              in: 'query',
              required: true,
              description: 'Search query (min 2 characters)',
              schema: { type: 'string', minLength: 2, maxLength: 100 },
              example: 'bitcoin',
            },
          ],
          responses: {
            '200': {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          coins: { type: 'array', items: { $ref: '#/components/schemas/SearchResult' } },
                          exchanges: { type: 'array', items: { $ref: '#/components/schemas/SearchResult' } },
                          total: { type: 'integer' },
                        },
                      },
                      meta: { $ref: '#/components/schemas/ResponseMeta' },
                    },
                  },
                },
              },
            },
          },
          security: [{ apiKey: [] }, { x402: [] }],
        },
      },
      '/api/v2/trending': {
        get: {
          operationId: 'getTrending',
          summary: 'Get trending coins',
          description: 'Returns currently trending cryptocurrencies based on search popularity.',
          tags: ['Analytics'],
          'x-price': '$0.001',
          responses: {
            '200': {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          coins: { type: 'array', items: { $ref: '#/components/schemas/TrendingCoin' } },
                          count: { type: 'integer' },
                        },
                      },
                      meta: { $ref: '#/components/schemas/ResponseMeta' },
                    },
                  },
                },
              },
            },
          },
          security: [{ apiKey: [] }, { x402: [] }],
        },
      },
      '/api/v2/volatility': {
        get: {
          operationId: 'getVolatility',
          summary: 'Get volatility metrics',
          description: 'Returns volatility analysis including Sharpe ratio, max drawdown, and risk classification.',
          tags: ['Analytics'],
          'x-price': '$0.002',
          parameters: [
            {
              name: 'ids',
              in: 'query',
              description: 'Comma-separated coin IDs (max 10)',
              schema: { type: 'string' },
              example: 'bitcoin,ethereum,solana',
            },
          ],
          responses: {
            '200': {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          metrics: { type: 'array', items: { $ref: '#/components/schemas/VolatilityMetrics' } },
                          summary: { $ref: '#/components/schemas/VolatilitySummary' },
                        },
                      },
                      meta: { $ref: '#/components/schemas/ResponseMeta' },
                    },
                  },
                },
              },
            },
          },
          security: [{ apiKey: [] }, { x402: [] }],
        },
      },
      '/api/v2/health': {
        get: {
          operationId: 'getHealth',
          summary: 'Health check',
          description: 'Returns API health status and metrics. No authentication required.',
          tags: ['Utilities'],
          'x-price': 'Free',
          responses: {
            '200': {
              description: 'API is healthy',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/HealthResponse' },
                },
              },
            },
            '503': {
              description: 'API is degraded or unhealthy',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/HealthResponse' },
                },
              },
            },
          },
        },
      },
      '/api/v2/batch': {
        post: {
          operationId: 'batch',
          summary: 'Batch requests',
          description: 'Execute multiple API operations in a single request. Maximum 10 operations per batch.',
          tags: ['Utilities'],
          'x-price': 'Sum of individual requests',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    requests: {
                      type: 'array',
                      maxItems: 10,
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string', description: 'Optional request ID for correlation' },
                          endpoint: { type: 'string', enum: ['coins', 'coin', 'global', 'defi', 'gas', 'ticker', 'search', 'trending', 'volatility', 'historical'] },
                          params: { type: 'object', additionalProperties: true },
                        },
                        required: ['endpoint'],
                      },
                    },
                  },
                  required: ['requests'],
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Batch results',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/BatchResponse' },
                },
              },
            },
          },
          security: [{ apiKey: [] }, { x402: [] }],
        },
      },
      '/api/v2/graphql': {
        post: {
          operationId: 'graphql',
          summary: 'GraphQL endpoint',
          description: 'Execute GraphQL queries for flexible data fetching. Supports introspection.',
          tags: ['Utilities'],
          'x-price': 'Based on resolved fields',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    query: { type: 'string', description: 'GraphQL query string' },
                    variables: { type: 'object', additionalProperties: true },
                  },
                  required: ['query'],
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'GraphQL response',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: { type: 'object', nullable: true },
                      errors: { type: 'array', items: { type: 'object' } },
                    },
                  },
                },
              },
            },
          },
          security: [{ apiKey: [] }, { x402: [] }],
        },
        get: {
          operationId: 'graphqlPlayground',
          summary: 'GraphQL Playground',
          description: 'Interactive GraphQL IDE for exploring the API.',
          tags: ['Utilities'],
          'x-price': 'Free',
          responses: {
            '200': {
              description: 'GraphQL Playground HTML',
              content: { 'text/html': { schema: { type: 'string' } } },
            },
          },
        },
      },
      '/api/v2/webhooks': {
        get: {
          operationId: 'listWebhooks',
          summary: 'List webhooks',
          description: 'List all webhook subscriptions for your API key.',
          tags: ['Webhooks'],
          responses: {
            '200': {
              description: 'List of webhooks',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: {
                        type: 'object',
                        properties: {
                          webhooks: { type: 'array', items: { $ref: '#/components/schemas/Webhook' } },
                          count: { type: 'integer' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          security: [{ apiKey: [] }],
        },
        post: {
          operationId: 'createWebhook',
          summary: 'Create webhook',
          description: 'Subscribe to events with a webhook URL.',
          tags: ['Webhooks'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    url: { type: 'string', format: 'uri' },
                    events: { type: 'array', items: { type: 'string' } },
                    secret: { type: 'string', minLength: 16 },
                  },
                  required: ['url', 'events'],
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Webhook created',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Webhook' } } },
            },
          },
          security: [{ apiKey: [] }],
        },
        delete: {
          operationId: 'deleteWebhook',
          summary: 'Delete webhook',
          description: 'Remove a webhook subscription.',
          tags: ['Webhooks'],
          parameters: [
            { name: 'id', in: 'query', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': { description: 'Webhook deleted' },
          },
          security: [{ apiKey: [] }],
        },
      },
    },
    components: {
      securitySchemes: {
        apiKey: {
          type: 'apiKey',
          name: 'X-API-Key',
          in: 'header',
          description: 'API key for authentication. Can also be passed as `api_key` query parameter.',
        },
        x402: {
          type: 'apiKey',
          name: 'PAYMENT-SIGNATURE',
          in: 'header',
          description: 'x402 payment signature for pay-per-request access. See https://docs.x402.org',
        },
      },
      schemas: {
        CoinMarketData: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'bitcoin' },
            symbol: { type: 'string', example: 'BTC' },
            name: { type: 'string', example: 'Bitcoin' },
            price: { type: 'number', example: 95000 },
            marketCap: { type: 'number', example: 1870000000000 },
            rank: { type: 'integer', example: 1 },
            volume24h: { type: 'number', example: 45000000000 },
            priceChange24h: { type: 'number', example: 1500 },
            priceChangePercent24h: { type: 'number', example: 1.6 },
            priceChangePercent7d: { type: 'number', example: 5.2 },
            priceChangePercent30d: { type: 'number', example: 12.5 },
            circulatingSupply: { type: 'number', example: 19600000 },
            totalSupply: { type: 'number', nullable: true, example: 21000000 },
            maxSupply: { type: 'number', nullable: true, example: 21000000 },
            ath: { type: 'number', example: 108000 },
            athChangePercent: { type: 'number', example: -12.04 },
            image: { type: 'string', format: 'uri' },
            sparkline: { type: 'array', items: { type: 'number' } },
            lastUpdated: { type: 'string', format: 'date-time' },
          },
        },
        CoinDetails: {
          allOf: [
            { $ref: '#/components/schemas/CoinMarketData' },
            {
              type: 'object',
              properties: {
                description: { type: 'string' },
                homepage: { type: 'string', format: 'uri' },
                github: { type: 'array', items: { type: 'string', format: 'uri' } },
                twitter: { type: 'string' },
                reddit: { type: 'string', format: 'uri' },
                categories: { type: 'array', items: { type: 'string' } },
                genesisDate: { type: 'string', format: 'date', nullable: true },
                hashingAlgorithm: { type: 'string', nullable: true },
                blockTime: { type: 'number', nullable: true },
                developerScore: { type: 'number' },
                communityScore: { type: 'number' },
                liquidityScore: { type: 'number' },
                sentimentUp: { type: 'number' },
                sentimentDown: { type: 'number' },
              },
            },
          ],
        },
        HistoricalPrice: {
          type: 'object',
          properties: {
            timestamp: { type: 'integer', description: 'Unix timestamp in milliseconds' },
            price: { type: 'number' },
            marketCap: { type: 'number' },
            volume: { type: 'number' },
          },
        },
        PriceSummary: {
          type: 'object',
          properties: {
            open: { type: 'number' },
            close: { type: 'number' },
            high: { type: 'number' },
            low: { type: 'number' },
            change: { type: 'number', description: 'Percentage change' },
            dataPoints: { type: 'integer' },
          },
        },
        GlobalMarketData: {
          type: 'object',
          properties: {
            totalMarketCap: { type: 'number', example: 3500000000000 },
            totalVolume24h: { type: 'number', example: 150000000000 },
            btcDominance: { type: 'number', example: 52.5 },
            ethDominance: { type: 'number', example: 17.2 },
            activeCryptocurrencies: { type: 'integer', example: 10000 },
            markets: { type: 'integer', example: 800 },
            marketCapChange24h: { type: 'number', example: 2.5 },
            lastUpdated: { type: 'string', format: 'date-time' },
          },
        },
        FearGreedIndex: {
          type: 'object',
          properties: {
            value: { type: 'integer', minimum: 0, maximum: 100, example: 65 },
            classification: { type: 'string', enum: ['Extreme Fear', 'Fear', 'Neutral', 'Greed', 'Extreme Greed'], example: 'Greed' },
            timestamp: { type: 'string', format: 'date-time' },
            previousClose: { type: 'integer' },
            weekAgo: { type: 'integer' },
            monthAgo: { type: 'integer' },
          },
        },
        DefiProtocol: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            symbol: { type: 'string' },
            tvl: { type: 'number' },
            change24h: { type: 'number' },
            change7d: { type: 'number' },
            category: { type: 'string' },
            chains: { type: 'array', items: { type: 'string' } },
          },
        },
        DefiSummary: {
          type: 'object',
          properties: {
            totalTVL: { type: 'number' },
            protocolCount: { type: 'integer' },
            topCategory: { type: 'string' },
          },
        },
        GasPrices: {
          type: 'object',
          properties: {
            ethereum: {
              type: 'object',
              properties: {
                slow: { type: 'number', description: 'Gwei' },
                standard: { type: 'number' },
                fast: { type: 'number' },
              },
            },
            bitcoin: {
              type: 'object',
              properties: {
                slow: { type: 'number', description: 'sat/vB' },
                standard: { type: 'number' },
                fast: { type: 'number' },
              },
            },
            units: { type: 'object' },
            recommendations: { type: 'object' },
          },
        },
        TickerData: {
          type: 'object',
          properties: {
            symbol: { type: 'string' },
            price: { type: 'number' },
            bid: { type: 'number' },
            ask: { type: 'number' },
            volume: { type: 'number' },
            high24h: { type: 'number' },
            low24h: { type: 'number' },
            change24h: { type: 'number' },
          },
        },
        SearchResult: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            symbol: { type: 'string' },
            rank: { type: 'integer', nullable: true },
            thumb: { type: 'string', format: 'uri' },
            type: { type: 'string', enum: ['coin', 'exchange', 'nft'] },
          },
        },
        TrendingCoin: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            symbol: { type: 'string' },
            rank: { type: 'integer' },
            thumb: { type: 'string', format: 'uri' },
            priceBtc: { type: 'number' },
            score: { type: 'integer' },
          },
        },
        VolatilityMetrics: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            symbol: { type: 'string' },
            name: { type: 'string' },
            volatility24h: { type: 'number' },
            volatility7d: { type: 'number' },
            volatility30d: { type: 'number' },
            maxDrawdown30d: { type: 'number' },
            sharpeRatio: { type: 'number' },
            beta: { type: 'number' },
            riskLevel: { type: 'string', enum: ['low', 'medium', 'high', 'extreme'] },
          },
        },
        VolatilitySummary: {
          type: 'object',
          properties: {
            averageVolatility30d: { type: 'number' },
            highRiskAssets: { type: 'integer' },
            totalAnalyzed: { type: 'integer' },
            riskDistribution: {
              type: 'object',
              properties: {
                low: { type: 'integer' },
                medium: { type: 'integer' },
                high: { type: 'integer' },
                extreme: { type: 'integer' },
              },
            },
          },
        },
        HealthResponse: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['healthy', 'degraded', 'error'] },
            version: { type: 'string' },
            uptime: { type: 'number', description: 'Uptime in seconds' },
            latency: { type: 'string' },
            dataAvailability: {
              type: 'object',
              properties: {
                status: { type: 'string' },
                coverage: { type: 'string' },
              },
            },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        ResponseMeta: {
          type: 'object',
          properties: {
            endpoint: { type: 'string' },
            requestId: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string' },
            code: { type: 'string', enum: ['VALIDATION_ERROR', 'UNAUTHORIZED', 'NOT_FOUND', 'RATE_LIMITED', 'SERVICE_UNAVAILABLE', 'INTERNAL_ERROR'] },
            requestId: { type: 'string' },
            details: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  message: { type: 'string' },
                },
              },
            },
          },
        },
        BatchResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                results: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      endpoint: { type: 'string' },
                      success: { type: 'boolean' },
                      data: { type: 'object' },
                      error: { type: 'string' },
                    },
                  },
                },
                summary: {
                  type: 'object',
                  properties: {
                    total: { type: 'integer' },
                    successful: { type: 'integer' },
                    failed: { type: 'integer' },
                  },
                },
              },
            },
          },
        },
        Webhook: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            url: { type: 'string', format: 'uri' },
            events: { type: 'array', items: { type: 'string' } },
            active: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            lastTriggeredAt: { type: 'string', format: 'date-time', nullable: true },
            totalDeliveries: { type: 'integer' },
            successRate: { type: 'number' },
          },
        },
      },
    },
  };
}

/**
 * Get OpenAPI spec as JSON string
 */
export function getOpenAPIJSON(): string {
  return JSON.stringify(generateOpenAPISpec(), null, 2);
}

/**
 * Get OpenAPI spec as YAML string
 */
export function getOpenAPIYAML(): string {
  const spec = generateOpenAPISpec();
  return jsonToYaml(spec);
}

function jsonToYaml(obj: unknown, indent = 0): string {
  const spaces = '  '.repeat(indent);
  
  if (obj === null) return 'null';
  if (typeof obj === 'boolean') return obj ? 'true' : 'false';
  if (typeof obj === 'number') return String(obj);
  if (typeof obj === 'string') {
    if (obj.includes('\n')) {
      const lines = obj.split('\n').map(line => spaces + '  ' + line).join('\n');
      return '|\n' + lines;
    }
    if (obj.match(/[:#\[\]{}|>!@%&*?]/)) {
      return `"${obj.replace(/"/g, '\\"')}"`;
    }
    return obj;
  }
  
  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    return obj.map(item => {
      const value = jsonToYaml(item, indent + 1);
      if (typeof item === 'object' && item !== null) {
        return `${spaces}- ${value.trim().replace(/^\s+/, '')}`;
      }
      return `${spaces}- ${value}`;
    }).join('\n');
  }
  
  if (typeof obj === 'object') {
    const entries = Object.entries(obj);
    if (entries.length === 0) return '{}';
    return entries.map(([key, value]) => {
      const yamlValue = jsonToYaml(value, indent + 1);
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        return `${spaces}${key}:\n${yamlValue}`;
      }
      if (Array.isArray(value)) {
        return `${spaces}${key}:\n${yamlValue}`;
      }
      return `${spaces}${key}: ${yamlValue}`;
    }).join('\n');
  }
  
  return String(obj);
}
