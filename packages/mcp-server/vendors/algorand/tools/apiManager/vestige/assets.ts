/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { Tool, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { ResponseProcessor } from '../../../utils/responseProcessor.js';
import { env } from '../../../env.js';

export const assetTools: Tool[] = [
  // Asset List and Search
  {
    name: 'api_vestige_view_assets',
    description: 'Get data about assets',
    inputSchema: {
      type: 'object',
      properties: {
        network_id: {
          type: 'integer',
          description: 'Network ID'
        },
        asset_ids: {
          type: 'string',
          description: 'Comma-separated list of asset IDs'
        }
      },
      required: ['network_id', 'asset_ids']
    }
  },
  {
    name: 'api_vestige_view_assets_list',
    description: 'Get asset list',
    inputSchema: {
      type: 'object',
      properties: {
        network_id: {
          type: 'integer',
          description: 'Network ID'
        },
        asset_ids: {
          type: 'string',
          description: 'Optional comma-separated list of asset IDs'
        },
        denominating_asset_id: {
          type: 'integer',
          description: 'Optional denominating asset ID',
          default: 0
        },
        include_labels: {
          type: 'string',
          description: 'Optional comma-separated list of labels to include'
        },
        exclude_labels: {
          type: 'string',
          description: 'Optional comma-separated list of labels to exclude'
        },
        limit: {
          type: 'integer',
          description: 'Maximum number of results',
          default: 50,
          maximum: 250,
          minimum: 1
        },
        offset: {
          type: 'integer',
          description: 'Number of results to skip',
          default: 0,
          minimum: 0
        },
        order_by: {
          type: 'string',
          description: 'Field to order by'
        },
        order_dir: {
          type: 'string',
          description: 'Order direction (asc/desc)',
          default: 'desc',
          pattern: '^(asc|desc)$'
        },
        tvl__lt: {
          type: 'number',
          description: 'Filter by TVL less than'
        },
        tvl__gt: {
          type: 'number',
          description: 'Filter by TVL greater than'
        },
        market_cap__lt: {
          type: 'number',
          description: 'Filter by market cap less than'
        },
        market_cap__gt: {
          type: 'number',
          description: 'Filter by market cap greater than'
        },
        fully_diluted_market_cap__lt: {
          type: 'number',
          description: 'Filter by fully diluted market cap less than'
        },
        fully_diluted_market_cap__gt: {
          type: 'number',
          description: 'Filter by fully diluted market cap greater than'
        },
        volume1d__lt: {
          type: 'number',
          description: 'Filter by 24h volume less than'
        },
        volume1d__gt: {
          type: 'number',
          description: 'Filter by 24h volume greater than'
        },
        created_at__lt: {
          type: 'integer',
          description: 'Filter by creation time less than'
        },
        created_at__gt: {
          type: 'integer',
          description: 'Filter by creation time greater than'
        }
      },
      required: ['network_id']
    }
  },
  {
    name: 'api_vestige_view_assets_search',
    description: 'Search assets by query',
    inputSchema: {
      type: 'object',
      properties: {
        network_id: {
          type: 'integer',
          description: 'Network ID'
        },
        query: {
          type: 'string',
          description: 'Search query'
        },
        protocol_id: {
          type: 'integer',
          description: 'Optional protocol ID filter'
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
        offset: {
          type: 'integer',
          description: 'Number of results to skip',
          default: 0,
          minimum: 0
        },
        order_by: {
          type: 'string',
          description: 'Field to order by'
        },
        order_dir: {
          type: 'string',
          description: 'Order direction (asc/desc)',
          default: 'desc',
          pattern: '^(asc|desc)$'
        }
      },
      required: ['network_id', 'query']
    }
  },

  // Asset Details and Price
  {
    name: 'api_vestige_view_asset_price',
    description: 'Get asset prices',
    inputSchema: {
      type: 'object',
      properties: {
        network_id: {
          type: 'integer',
          description: 'Network ID'
        },
        asset_ids: {
          type: 'string',
          description: 'Comma-separated list of asset IDs'
        },
        denominating_asset_id: {
          type: 'integer',
          description: 'Optional denominating asset ID',
          default: 0
        }
      },
      required: ['network_id', 'asset_ids']
    }
  },

  // Asset History and Candles
  {
    name: 'api_vestige_view_asset_candles',
    description: 'Get asset candles',
    inputSchema: {
      type: 'object',
      properties: {
        network_id: {
          type: 'integer',
          description: 'Network ID'
        },
        asset_id: {
          type: 'integer',
          description: 'Asset ID'
        },
        interval: {
          type: 'integer',
          description: 'Candle interval in seconds'
        },
        start: {
          type: 'integer',
          description: 'Start timestamp'
        },
        end: {
          type: 'integer',
          description: 'Optional end timestamp'
        },
        denominating_asset_id: {
          type: 'integer',
          description: 'Optional denominating asset ID',
          default: 0
        },
        volume_in_denominating_asset: {
          type: 'boolean',
          description: 'Whether to return volume in denominating asset',
          default: false
        }
      },
      required: ['network_id', 'asset_id', 'interval', 'start']
    }
  },
  {
    name: 'api_vestige_view_asset_history',
    description: 'Get asset volume, swaps, total lockup, vwap and confidence history',
    inputSchema: {
      type: 'object',
      properties: {
        network_id: {
          type: 'integer',
          description: 'Network ID'
        },
        asset_id: {
          type: 'integer',
          description: 'Asset ID'
        },
        interval: {
          type: 'integer',
          description: 'History interval in seconds'
        },
        start: {
          type: 'integer',
          description: 'Start timestamp'
        },
        end: {
          type: 'integer',
          description: 'Optional end timestamp'
        },
        denominating_asset_id: {
          type: 'integer',
          description: 'Optional denominating asset ID',
          default: 0
        },
        volume_in_denominating_asset: {
          type: 'boolean',
          description: 'Whether to return volume in denominating asset',
          default: false
        }
      },
      required: ['network_id', 'asset_id', 'interval', 'start']
    }
  },

  // Asset Composition
  {
    name: 'api_vestige_view_asset_composition',
    description: 'Get asset lockups based on protocol and pair',
    inputSchema: {
      type: 'object',
      properties: {
        network_id: {
          type: 'integer',
          description: 'Network ID'
        },
        asset_id: {
          type: 'integer',
          description: 'Asset ID'
        }
      },
      required: ['network_id', 'asset_id']
    }
  }
];



export const handleAssetTools = ResponseProcessor.wrapResourceHandler(async function handleAssetTools(args: any): Promise<any> {
  const name = args.name;
  const baseUrl = env.vestige_api_url;
  let endpoint = '';

  switch (name) {
    case 'api_vestige_view_assets':
      endpoint = '/assets';
      break;
    case 'api_vestige_view_assets_list':
      endpoint = '/assets/list';
      break;
    case 'api_vestige_view_assets_search':
      endpoint = '/assets/search';
      break;
    case 'api_vestige_view_asset_price':
      endpoint = '/assets/price';
      break;
    case 'api_vestige_view_asset_candles':
      endpoint = `/assets/${args.asset_id}/candles`;
      break;
    case 'api_vestige_view_asset_history':
      endpoint = `/assets/${args.asset_id}/history`;
      break;
    case 'api_vestige_view_asset_composition':
      endpoint = `/assets/${args.asset_id}/composition`;
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
      if (value !== undefined && key !== 'asset_id') {
        queryParams.append(key, String(value));
      }
    }
    const url = `${baseUrl}${endpoint}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

    const response = await fetch(url);
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
      `Failed to fetch asset data: ${error instanceof Error ? error.message : String(error)}`
    );
  }
});
