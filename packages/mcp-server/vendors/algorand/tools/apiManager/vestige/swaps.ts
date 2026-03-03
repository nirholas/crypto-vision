/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { Tool, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { ResponseProcessor } from '../../../utils/responseProcessor.js';
import { env } from '../../../env.js';

export const swapTools: Tool[] = [
  {
    name: 'api_vestige_view_swaps',
    description: 'Get swaps',
    inputSchema: {
      type: 'object',
      properties: {
        network_id: {
          type: 'integer',
          description: 'Network ID'
        },
        start: {
          type: 'integer',
          description: 'Start timestamp'
        },
        end: {
          type: 'integer',
          description: 'Optional end timestamp'
        },
        protocol_id: {
          type: 'integer',
          description: 'Optional protocol ID filter'
        },
        asset_id: {
          type: 'integer',
          description: 'Optional asset ID filter'
        },
        address: {
          type: 'string',
          description: 'Optional address filter'
        },
        executor: {
          type: 'string',
          description: 'Optional executor filter'
        },
        next: {
          type: 'string',
          description: 'Optional next token for pagination'
        },
        denominating_asset_id: {
          type: 'integer',
          description: 'Optional denominating asset ID',
          default: 0
        },
        limit: {
          type: 'integer',
          description: 'Maximum number of results',
          default: 50,
          maximum: 250,
          minimum: 1
        },
        order_dir: {
          type: 'string',
          description: 'Order direction (asc/desc)',
          default: 'desc',
          pattern: '^(asc|desc)$'
        }
      },
      required: ['network_id', 'start']
    }
  },
  {
    name: 'api_vestige_get_best_v4_swap_data',
    description: 'Get best V4 swap data',
    inputSchema: {
      type: 'object',
      properties: {
        from_asa: {
          type: 'integer',
          description: 'Source ASA ID'
        },
        to_asa: {
          type: 'integer',
          description: 'Target ASA ID'
        },
        amount: {
          type: 'integer',
          description: 'Amount to swap'
        },
        mode: {
          type: 'string',
          description: 'Swap mode (sef/sfe)',
          pattern: '^(sef|sfe)$'
        },
        denominating_asset_id: {
          type: 'integer',
          description: 'Optional denominating asset ID',
          default: 0
        },
        enabled_providers: {
          type: 'string',
          description: 'Optional comma-separated list of enabled providers'
        },
        disabled_providers: {
          type: 'string',
          description: 'Optional comma-separated list of disabled providers'
        }
      },
      required: ['from_asa', 'to_asa', 'amount', 'mode']
    }
  },
  {
    name: 'api_vestige_get_v4_swap_discount',
    description: 'Get V4 swap discount',
    inputSchema: {
      type: 'object',
      properties: {
        address: {
          type: 'string',
          description: 'Account address'
        }
      },
      required: ['address']
    }
  },
  {
    name: 'api_vestige_get_v4_swap_data_transactions',
    description: 'Get V4 swap data transactions',
    inputSchema: {
      type: 'object',
      properties: {
        sender: {
          type: 'string',
          description: 'Sender address'
        },
        slippage: {
          type: 'number',
          description: 'Slippage tolerance'
        },
        random_signer: {
          type: 'string',
          description: 'Optional random signer address'
        },
        swap_data: {
          type: 'object',
          description: 'V4 swap data from get_best_v4_swap_data'
        }
      },
      required: ['sender', 'slippage', 'swap_data']
    }
  },
  {
    name: 'api_vestige_get_aggregator_stats',
    description: 'Get aggregator stats',
    inputSchema: {
      type: 'object',
      properties: {
        denominating_asset_id: {
          type: 'integer',
          description: 'Optional denominating asset ID',
          default: 0
        }
      }
    }
  }
];

export const handleSwapTools = ResponseProcessor.wrapResourceHandler(async function handleSwapTools(args: any): Promise<any> {
  const name = args.name;
  const baseUrl = env.vestige_api_url;
  let endpoint = '';
  let method = 'GET';

  switch (name) {
    case 'api_vestige_view_swaps':
      endpoint = '/swaps';
      break;
    case 'api_vestige_get_best_v4_swap_data':
      endpoint = '/swap/v4';
      break;
    case 'api_vestige_get_v4_swap_discount':
      endpoint = '/swap/v4/fee';
      break;
    case 'api_vestige_get_v4_swap_data_transactions':
      endpoint = '/swap/v4/transactions';
      method = 'POST';
      break;
    case 'api_vestige_get_aggregator_stats':
      endpoint = '/swap/v4/stats';
      break;
    default:
      throw new McpError(
        ErrorCode.MethodNotFound,
        `Unknown tool: ${name}`
      );
  }

  try {
    // Add query parameters if they exist
    const queryParams = new URLSearchParams();
    for (const [key, value] of Object.entries(args)) {
      if (value !== undefined && key !== 'swap_data') {
        queryParams.append(key, String(value));
      }
    }
    const url = `${baseUrl}${endpoint}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

    const options: RequestInit = {
      method
    };

    // Add body for POST requests
    if (method === 'POST' && args.swap_data) {
      options.body = JSON.stringify(args.swap_data);
      options.headers = {
        'Content-Type': 'application/json'
      };
    }

    const response = await fetch(url, options);
    if (!response.ok) {
      throw new McpError(
        ErrorCode.InternalError,
        `Vestige API error: ${response.status} ${response.statusText}`
      );
    }
    const data = await response.json();
    return data;
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to fetch swap data: ${error instanceof Error ? error.message : String(error)}`
    );
  }
});
