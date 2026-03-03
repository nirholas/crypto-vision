/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { Tool, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { ResponseProcessor } from '../../../utils/responseProcessor.js';
import { env } from '../../../env.js';

export const noteTools: Tool[] = [
  {
    name: 'api_vestige_view_notes',
    description: 'Get notes by network id and optionally asset id',
    inputSchema: {
      type: 'object',
      properties: {
        network_id: {
          type: 'integer',
          description: 'Network ID'
        },
        asset_id: {
          type: 'integer',
          description: 'Optional asset ID filter'
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
      required: ['network_id']
    }
  },
  {
    name: 'api_vestige_view_first_asset_notes',
    description: 'Get first note for assets',
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
    name: 'api_vestige_view_asset_notes_count',
    description: 'Get notes count for assets',
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
  }
];

export const handleNoteTools = ResponseProcessor.wrapResourceHandler(async function handleNoteTools(args: any): Promise<any> {
  const name = args.name;
  const baseUrl = env.vestige_api_url;
  let endpoint = '';

  switch (name) {
    case 'api_vestige_view_notes':
      endpoint = '/notes';
      break;
    case 'api_vestige_view_first_asset_notes':
      endpoint = '/notes/first';
      break;
    case 'api_vestige_view_asset_notes_count':
      endpoint = '/notes/count';
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
      if (value !== undefined) {
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
      `Failed to fetch note data: ${error instanceof Error ? error.message : String(error)}`
    );
  }
});
