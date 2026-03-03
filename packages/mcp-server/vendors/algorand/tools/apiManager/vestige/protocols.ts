/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { Tool, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { ResponseProcessor } from '../../../utils/responseProcessor.js';
import { env } from '../../../env.js';

export const protocolTools: Tool[] = [
  {
    name: 'api_vestige_view_protocols',
    description: 'Get all protocols',
    inputSchema: {
      type: 'object',
      properties: {
        network_id: {
          type: 'integer',
          description: 'Network ID'
        }
      },
      required: ['network_id']
    }
  },
  {
    name: 'api_vestige_view_protocol_by_id',
    description: 'Get protocol by id',
    inputSchema: {
      type: 'object',
      properties: {
        protocol_id: {
          type: 'integer',
          description: 'Protocol ID'
        },
        network_id: {
          type: 'integer',
          description: 'Network ID'
        }
      },
      required: ['protocol_id', 'network_id']
    }
  },
  {
    name: 'api_vestige_view_protocol_volumes',
    description: 'Get protocol volumes at specific day. Defaults to current day.',
    inputSchema: {
      type: 'object',
      properties: {
        network_id: {
          type: 'integer',
          description: 'Network ID'
        },
        timestamp: {
          type: 'integer',
          description: 'Optional timestamp'
        },
        denominating_asset_id: {
          type: 'integer',
          description: 'Optional denominating asset ID',
          default: 0
        }
      },
      required: ['network_id']
    }
  }
];

export const handleProtocolTools = ResponseProcessor.wrapResourceHandler(async function handleProtocolTools(args: any): Promise<any> {
  const name = args.name;
  const baseUrl = env.vestige_api_url;
  let endpoint = '';

  switch (name) {
    case 'api_vestige_view_protocols':
      endpoint = '/protocols';
      break;
    case 'api_vestige_view_protocol_by_id':
      endpoint = `/protocols/${args.protocol_id}`;
      break;
    case 'api_vestige_view_protocol_volumes':
      endpoint = '/protocols/volume';
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
      if (value !== undefined && !['protocol_id', 'name', 'pageToken'].includes(key)) {
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
      `Failed to fetch protocol data: ${error instanceof Error ? error.message : String(error)}`
    );
  }
});
