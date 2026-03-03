/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { Tool, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { ResponseProcessor } from '../../../utils/responseProcessor.js';
import { env } from '../../../env.js';

export const marketTools: Tool[] = [
  // Additional Market Information
  {
    name: 'api_ultrade_market_chains',
    description: 'Get blockchain chains',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'api_ultrade_market_withdrawal_fee',
    description: 'Get withdrawal fee',
    inputSchema: {
      type: 'object',
      properties: {
        tokenIndex: {
          type: 'string',
          description: 'Token index'
        },
        tokenChainId: {
          type: 'number',
          description: 'Token chain ID'
        },
        recipientChainId: {
          type: 'number',
          description: 'Recipient chain ID'
        }
      },
      required: ['tokenIndex', 'tokenChainId', 'recipientChainId']
    }
  },
  {
    name: 'api_ultrade_market_operation_details',
    description: 'Get operation details',
    inputSchema: {
      type: 'object',
      properties: {
        operationId: {
          type: 'string',
          description: 'Operation ID'
        }
      },
      required: ['operationId']
    }
  },
  {
    name: 'api_ultrade_market_markets',
    description: 'Get markets',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'api_ultrade_market_balances',
    description: 'Get account balances',
    inputSchema: {
      type: 'object',
      properties: {
        walletAddress: {
          type: 'string',
          description: 'Login wallet address'
        },
        walletToken: {
          type: 'string',
          description: 'Login session token'
        },
        tradingKey: {
          type: 'string',
          description: 'Trading key address'
        }
      },
      required: ['walletAddress']
    }
  },
  {
    name: 'api_ultrade_market_order_message',
    description: 'Generate message from the order data',
    inputSchema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            symbol: { type: 'string' },
            side: { type: 'string', enum: ['buy', 'sell'] },
            type: { type: 'string', enum: ['limit', 'market'] },
            quantity: { type: 'string' },
            price: { type: 'string' },
            loginAddress: { type: 'string' },
            loginChainId: { type: 'number' }
          },
          required: ['symbol', 'side', 'type', 'quantity', 'loginAddress', 'loginChainId']
        }
      },
      required: ['data']
    }
  },
  {
    name: 'api_ultrade_market_create_orders',
    description: 'Create new orders',
    inputSchema: {
      type: 'object',
      properties: {
        orders: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              signature: { type: 'string' }
            },
            required: ['message', 'signature']
          }
        },
        walletAddress: {
          type: 'string',
          description: 'Login wallet address'
        },
        walletToken: {
          type: 'string',
          description: 'Login session token'
        }
      },
      required: ['orders', 'walletAddress', 'walletToken']
    }
  },
  {
    name: 'api_ultrade_market_create_order',
    description: 'Create new order',
    inputSchema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'The signed message in hex format'
        },
        signature: {
          type: 'string',
          description: 'The signature of the message'
        },
        walletAddress: {
          type: 'string',
          description: 'Login wallet address'
        },
        walletToken: {
          type: 'string',
          description: 'Login session token'
        }
      },
      required: ['message', 'signature', 'walletAddress', 'walletToken']
    }
  },
  {
    name: 'api_ultrade_market_cancel_orders',
    description: 'Cancel multiple open orders',
    inputSchema: {
      type: 'object',
      properties: {
        orderIds: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of order IDs to cancel'
        },
        walletAddress: {
          type: 'string',
          description: 'Login wallet address'
        },
        walletToken: {
          type: 'string',
          description: 'Login session token'
        }
      },
      required: ['orderIds', 'walletAddress', 'walletToken']
    }
  },
  {
    name: 'api_ultrade_market_cancel_order',
    description: 'Cancel open order',
    inputSchema: {
      type: 'object',
      properties: {
        orderId: {
          type: 'number',
          description: 'Order ID to cancel'
        },
        walletAddress: {
          type: 'string',
          description: 'Login wallet address'
        },
        walletToken: {
          type: 'string',
          description: 'Login session token'
        }
      },
      required: ['orderId', 'walletAddress', 'walletToken']
    }
  },
  // Market Information
  {
    name: 'api_ultrade_market_price',
    description: 'Get last market price by pair symbol',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: { 
          type: 'string',
          description: 'Market symbol, e.g. sol_eth'
        }
      },
      required: ['symbol']
    }
  },
  {
    name: 'api_ultrade_market_depth',
    description: 'Get order book depth',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Market symbol, e.g. sol_eth'
        },
        depth: {
          type: 'number',
          description: 'If depth > 100, then the response will truncate to 100'
        }
      },
      required: ['symbol', 'depth']
    }
  },
  {
    name: 'api_ultrade_market_last_trades',
    description: 'Get last trades',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Market symbol, e.g. sol_eth'
        },
        limit: {
          type: 'number',
          description: 'Amount of trades. If limit > 100, then truncated to 100',
          maximum: 100,
          default: 100
        }
      },
      required: ['symbol']
    }
  },

  // Market Configuration
  {
    name: 'api_ultrade_market_symbols',
    description: 'Get market symbols',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'api_ultrade_market_settings',
    description: 'Get market settings',
    inputSchema: {
      type: 'object',
      properties: {
        domain: {
          type: 'string',
          description: 'Domain of the dApp'
        }
      },
      required: ['domain']
    }
  },
  {
    name: 'api_ultrade_market_details',
    description: 'Get market details',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Market symbol, e.g. sol_eth'
        }
      },
      required: ['symbol']
    }
  },

  // Order Operations
  {
    name: 'api_ultrade_market_order_by_id',
    description: 'Get order by ID',
    inputSchema: {
      type: 'object',
      properties: {
        orderId: {
          type: 'number',
          description: 'Order ID'
        },
        walletAddress: {
          type: 'string',
          description: 'Login wallet address'
        },
        walletToken: {
          type: 'string',
          description: 'Login session token'
        },
        tradingKey: {
          type: 'string',
          description: 'Trading key address'
        }
      },
      required: ['orderId', 'walletAddress']
    }
  },
  {
    name: 'api_ultrade_market_orders',
    description: 'Get orders',
    inputSchema: {
      type: 'object',
      properties: {
        walletAddress: {
          type: 'string',
          description: 'Login wallet address'
        },
        walletToken: {
          type: 'string',
          description: 'Login session token'
        },
        tradingKey: {
          type: 'string',
          description: 'Trading key address'
        },
        companyId: {
          type: 'string',
          description: 'Optional header for filtering orders by company pairs'
        }
      },
      required: ['walletAddress']
    }
  },
  {
    name: 'api_ultrade_market_open_orders',
    description: 'Get open orders',
    inputSchema: {
      type: 'object',
      properties: {
        walletAddress: {
          type: 'string',
          description: 'Login wallet address'
        },
        walletToken: {
          type: 'string',
          description: 'Login session token'
        },
        tradingKey: {
          type: 'string',
          description: 'Trading key address'
        },
        symbol: {
          type: 'string',
          description: 'Optional market symbol filter'
        }
      },
      required: ['walletAddress']
    }
  },

  // Other Market Data
  {
    name: 'api_ultrade_market_history',
    description: 'Get market history',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Market symbol, e.g. sol_eth'
        },
        interval: {
          type: 'string',
          description: 'Resolution interval'
        },
        startTime: {
          type: 'number',
          description: 'UTC timestamp in seconds'
        },
        endTime: {
          type: 'number',
          description: 'UTC timestamp in seconds'
        },
        limit: {
          type: 'number',
          description: 'Max amount of candles'
        },
        format: {
          type: 'string',
          description: 'Response format',
          enum: ['object', 'array'],
          default: 'object'
        }
      },
      required: ['symbol', 'interval', 'startTime', 'endTime']
    }
  },
  {
    name: 'api_ultrade_market_assets',
    description: 'Get trading assets',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'api_ultrade_market_fee_rates',
    description: 'Get fee rates',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
];

interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  queryParams?: Record<string, any>;
  body?: any;
}

async function makeRequest(endpoint: string, options: RequestOptions = {}): Promise<any> {
  const { method = 'GET', headers = {}, queryParams = {} } = options;
  
  try {
    let url = `${env.ultrade_api_url}${endpoint}`;
    const params = new URLSearchParams();
    
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined) {
        params.append(key, String(value));
      }
    }
    
    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    });

    if (!response.ok) {
      throw new McpError(
        ErrorCode.InternalError,
        `Ultrade API error: ${response.status} ${response.statusText}`
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to make request: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

async function getMarketPrice(symbol: string): Promise<any> {
  return makeRequest('/market/price', {
    queryParams: { symbol }
  });
}

async function getMarketDepth(symbol: string, depth: number): Promise<any> {
  return makeRequest('/market/depth', {
    queryParams: { symbol, depth }
  });
}

async function getLastTrades(symbol: string, limit?: number): Promise<any> {
  return makeRequest('/market/last-trades', {
    queryParams: { symbol, limit }
  });
}

async function getMarketSymbols(): Promise<any> {
  return makeRequest('/market/symbols');
}

async function getMarketSettings(domain: string): Promise<any> {
  return makeRequest('/market/settings', {
    headers: { 'wl-domain': 'ultrade.org' }  
  });
}

async function getMarketDetails(symbol: string): Promise<any> {
  return makeRequest('/market/market', {
    queryParams: { symbol }
  });
}

async function getOrderById(orderId: number, auth: { walletAddress: string, walletToken?: string, tradingKey?: string }): Promise<any> {
  const headers: Record<string, string> = {
    'x-wallet-address': auth.walletAddress
  };
  if (auth.walletToken) headers['x-wallet-token'] = auth.walletToken;
  if (auth.tradingKey) headers['x-trading-key'] = auth.tradingKey;

  return makeRequest(`/market/order/${orderId}`, { headers });
}

async function getOrders(auth: { walletAddress: string, walletToken?: string, tradingKey?: string, companyId?: string }): Promise<any> {
  const headers: Record<string, string> = {
    'x-wallet-address': auth.walletAddress
  };
  if (auth.walletToken) headers['x-wallet-token'] = auth.walletToken;
  if (auth.tradingKey) headers['x-trading-key'] = auth.tradingKey;

  return makeRequest('/market/orders', {
    headers,
    queryParams: auth.companyId ? { companyId: auth.companyId } : undefined
  });
}

async function getOpenOrders(auth: { walletAddress: string, walletToken?: string, tradingKey?: string }, symbol?: string): Promise<any> {
  const headers: Record<string, string> = {
    'x-wallet-address': auth.walletAddress
  };
  if (auth.walletToken) headers['x-wallet-token'] = auth.walletToken;
  if (auth.tradingKey) headers['x-trading-key'] = auth.tradingKey;

  return makeRequest('/market/open-orders', {
    headers,
    queryParams: symbol ? { symbol } : undefined
  });
}

async function getMarketHistory(params: {
  symbol: string,
  interval: string,
  startTime: number,
  endTime: number,
  limit?: number,
  format?: 'object' | 'array'
}): Promise<any> {
  return makeRequest('/market/history', { queryParams: params });
}

async function getMarketAssets(): Promise<any> {
  return makeRequest('/market/assets');
}

async function getFeeRates(): Promise<any> {
  return makeRequest('/market/fee-rates');
}

async function getChains(): Promise<any> {
  return makeRequest('/market/chains');
}

async function getWithdrawalFee(params: {
  tokenIndex: string;
  tokenChainId: number;
  recipientChainId: number;
}): Promise<any> {
  return makeRequest('/market/withdrawal-fee', {
    queryParams: params
  });
}

async function getOperationDetails(operationId: string): Promise<any> {
  return makeRequest(`/market/operation-details/${operationId}`);
}

async function getMarkets(): Promise<any> {
  return makeRequest('/market/markets');
}

async function getBalances(auth: {
  walletAddress: string;
  walletToken?: string;
  tradingKey?: string;
}): Promise<any> {
  const headers: Record<string, string> = {
    'x-wallet-address': auth.walletAddress
  };
  if (auth.walletToken) headers['x-wallet-token'] = auth.walletToken;
  if (auth.tradingKey) headers['x-trading-key'] = auth.tradingKey;

  return makeRequest('/market/balances', { headers });
}

async function getOrderMessage(data: {
  symbol: string;
  side: 'buy' | 'sell';
  type: 'limit' | 'market';
  quantity: string;
  price?: string;
  loginAddress: string;
  loginChainId: number;
}): Promise<any> {
  return makeRequest('/market/order/message', {
    method: 'POST',
    body: { data }
  });
}

async function createOrders(params: {
  orders: Array<{ message: string; signature: string }>;
  walletAddress: string;
  walletToken: string;
}): Promise<any> {
  return makeRequest('/market/orders', {
    method: 'POST',
    headers: {
      'x-wallet-address': params.walletAddress,
      'x-wallet-token': params.walletToken
    },
    body: params.orders
  });
}

async function createOrder(params: {
  message: string;
  signature: string;
  walletAddress: string;
  walletToken: string;
}): Promise<any> {
  return makeRequest('/market/order', {
    method: 'POST',
    headers: {
      'x-wallet-address': params.walletAddress,
      'x-wallet-token': params.walletToken
    },
    body: {
      message: params.message,
      signature: params.signature
    }
  });
}

async function cancelOrders(params: {
  orderIds: number[];
  walletAddress: string;
  walletToken: string;
}): Promise<any> {
  return makeRequest('/market/orders', {
    method: 'DELETE',
    headers: {
      'x-wallet-address': params.walletAddress,
      'x-wallet-token': params.walletToken
    },
    body: { orderIds: params.orderIds }
  });
}

async function cancelOrder(params: {
  orderId: number;
  walletAddress: string;
  walletToken: string;
}): Promise<any> {
  return makeRequest('/market/order', {
    method: 'DELETE',
    headers: {
      'x-wallet-address': params.walletAddress,
      'x-wallet-token': params.walletToken
    },
    queryParams: { orderId: params.orderId }
  });
}

export async function handleMarketTools(args: any): Promise<any> {
  switch (args.name) {
    case 'api_ultrade_market_price':
      return await getMarketPrice(args.symbol);
    
    case 'api_ultrade_market_depth':
      return await getMarketDepth(args.symbol, args.depth);
    
    case 'api_ultrade_market_last_trades':
      return await getLastTrades(args.symbol, args.limit);
    
    case 'api_ultrade_market_symbols':
      return await getMarketSymbols();
    
    case 'api_ultrade_market_settings':
      return await getMarketSettings(args.domain);
    
    case 'api_ultrade_market_details':
      return await getMarketDetails(args.symbol);
    
    case 'api_ultrade_market_order_by_id':
      return await getOrderById(args.orderId, {
        walletAddress: args.walletAddress,
        walletToken: args.walletToken,
        tradingKey: args.tradingKey
      });
    
    case 'api_ultrade_market_orders':
      return await getOrders({
        walletAddress: args.walletAddress,
        walletToken: args.walletToken,
        tradingKey: args.tradingKey,
        companyId: args.companyId
      });
    
    case 'api_ultrade_market_open_orders':
      return await getOpenOrders({
        walletAddress: args.walletAddress,
        walletToken: args.walletToken,
        tradingKey: args.tradingKey
      }, args.symbol);
    
    case 'api_ultrade_market_history':
      return await getMarketHistory({
        symbol: args.symbol,
        interval: args.interval,
        startTime: args.startTime,
        endTime: args.endTime,
        limit: args.limit,
        format: args.format
      });
    
    case 'api_ultrade_market_assets':
      return await getMarketAssets();
    
    case 'api_ultrade_market_fee_rates':
      return await getFeeRates();
    
    case 'api_ultrade_market_chains':
      return await getChains();

    case 'api_ultrade_market_withdrawal_fee':
      return await getWithdrawalFee({
        tokenIndex: args.tokenIndex,
        tokenChainId: args.tokenChainId,
        recipientChainId: args.recipientChainId
      });

    case 'api_ultrade_market_operation_details':
      return await getOperationDetails(args.operationId);

    case 'api_ultrade_market_markets':
      return await getMarkets();

    case 'api_ultrade_market_balances':
      return await getBalances({
        walletAddress: args.walletAddress,
        walletToken: args.walletToken,
        tradingKey: args.tradingKey
      });

    case 'api_ultrade_market_order_message':
      return await getOrderMessage(args.data);

    case 'api_ultrade_market_create_orders':
      return await createOrders({
        orders: args.orders,
        walletAddress: args.walletAddress,
        walletToken: args.walletToken
      });

    case 'api_ultrade_market_create_order':
      return await createOrder({
        message: args.message,
        signature: args.signature,
        walletAddress: args.walletAddress,
        walletToken: args.walletToken
      });

    case 'api_ultrade_market_cancel_orders':
      return await cancelOrders({
        orderIds: args.orderIds,
        walletAddress: args.walletAddress,
        walletToken: args.walletToken
      });

    case 'api_ultrade_market_cancel_order':
      return await cancelOrder({
        orderId: args.orderId,
        walletAddress: args.walletAddress,
        walletToken: args.walletToken
      });

    default:
      throw new McpError(
        ErrorCode.MethodNotFound,
        `Unknown tool: ${args.name}`
      );
  }
}
