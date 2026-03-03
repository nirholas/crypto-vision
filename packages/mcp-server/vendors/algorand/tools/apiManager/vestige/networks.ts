/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { Tool, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { ResponseProcessor } from '../../../utils/responseProcessor.js';
import { env } from '../../../env.js';

export const networkTools: Tool[] = [
  {
    name: 'api_vestige_view_networks',
    description: 'Get all networks',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'api_vestige_view_network_by_id',
    description: 'Get network by id',
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
  }
];

export const handleNetworkTools = ResponseProcessor.wrapResourceHandler(async function handleNetworkTools(args: any): Promise<any> {
  const name = args.name;
  const baseUrl = env.vestige_api_url;
  let endpoint = '';

  switch (name) {
    case 'api_vestige_view_networks':
      endpoint = '/networks';
      break;
    case 'api_vestige_view_network_by_id':
      endpoint = `/networks/${args.network_id}`;
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
      if (value !== undefined && key !== 'network_id') {
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
      `Failed to fetch network data: ${error instanceof Error ? error.message : String(error)}`
    );
  }
});
