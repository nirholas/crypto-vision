/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { indexerClient } from '../../../algorand-client.js';
import { ResponseProcessor } from '../../../utils/responseProcessor.js';
import type { 
  ApplicationResponse,
  ApplicationsResponse,
  ApplicationLogsResponse,
  Box
} from 'algosdk/dist/types/client/v2/indexer/models/types';
import algosdk from 'algosdk';

export const applicationTools = [
  {
    name: 'api_indexer_lookup_applications',
    description: 'Get application information from indexer',
    inputSchema: {
      type: 'object',
      properties: {
        appId: {
          type: 'integer',
          description: 'Application ID'
        }
      },
      required: ['appId']
    }
  },
  {
    name: 'api_indexer_lookup_application_logs',
    description: 'Get application log messages',
    inputSchema: {
      type: 'object',
      properties: {
        appId: {
          type: 'integer',
          description: 'Application ID'
        },
        limit: {
          type: 'integer',
          description: 'Maximum number of logs to return'
        },
        minRound: {
          type: 'integer',
          description: 'Only return logs after this round'
        },
        maxRound: {
          type: 'integer',
          description: 'Only return logs before this round'
        },
        txid: {
          type: 'string',
          description: 'Filter by transaction ID'
        },
        sender: {
          type: 'string',
          description: 'Filter by sender address'
        },
        nextToken: {
          type: 'string',
          description: 'Token for retrieving the next page of results'
        }
      },
      required: ['appId']
    }
  },
  {
    name: 'api_indexer_search_for_applications',
    description: 'Search for applications with various criteria',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'integer',
          description: 'Maximum number of applications to return'
        },
        creator: {
          type: 'string',
          description: 'Filter by creator address'
        },
        nextToken: {
          type: 'string',
          description: 'Token for retrieving the next page of results'
        }
      }
    }
  },
  {
    name: 'api_indexer_lookup_application_box',
    description: 'Get application box by name',
    inputSchema: {
      type: 'object',
      properties: {
        appId: {
          type: 'integer',
          description: 'Application ID'
        },
        boxName: {
          type: 'string',
          description: 'Box name Buffer'
        }
      },
      required: ['appId', 'boxName']
    }
  },
  {
    name: 'api_indexer_lookup_application_boxes',
    description: 'Get all application boxes',
    inputSchema: {
      type: 'object',
      properties: {
        appId: {
          type: 'integer',
          description: 'Application ID'
        },
        maxBoxes: {
          type: 'integer',
          description: 'Maximum number of boxes to return'
        }
      },
      required: ['appId']
    }
  }
];

export async function lookupApplications(appId: number): Promise<ApplicationResponse> {
  try {
    console.log(`Looking up application info for ID ${appId}`);
    const response = await indexerClient.lookupApplications(appId).do() as ApplicationResponse;
    console.log('Application response:', JSON.stringify(response, null, 2));
    return response;
  } catch (error) {
    console.error('Application lookup error:', error);
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to get application info: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function lookupApplicationLogs(appId: number, params?: {
  limit?: number;
  minRound?: number;
  maxRound?: number;
  txid?: string;
  sender?: string;
  nextToken?: string;
}): Promise<ApplicationLogsResponse> {
  try {
    console.log(`Looking up logs for application ${appId}`);
    let search = indexerClient.lookupApplicationLogs(appId);

    if (params?.limit) {
      search = search.limit(params.limit);
    }
    if (params?.minRound) {
      search = search.minRound(params.minRound);
    }
    if (params?.maxRound) {
      search = search.maxRound(params.maxRound);
    }
    if (params?.txid) {
      search = search.txid(params.txid);
    }
    if (params?.sender) {
      search = search.sender(params.sender);
    }
    if (params?.nextToken) {
      search = search.nextToken(params.nextToken);
    }

    const response = await search.do() as ApplicationLogsResponse;
    console.log('Application logs response:', JSON.stringify(response, null, 2));
    return response;
  } catch (error) {
    console.error('Application logs lookup error:', error);
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to get application logs: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function searchForApplications(params?: {
  limit?: number;
  creator?: string;
  nextToken?: string;
}): Promise<ApplicationsResponse> {
  try {
    console.log('Searching applications with params:', params);
    let search = indexerClient.searchForApplications();

    if (params?.limit) {
      search = search.limit(params.limit);
    }
    if (params?.creator) {
      search = search.creator(params.creator);
    }
    if (params?.nextToken) {
      search = search.nextToken(params.nextToken);
    }

    const response = await search.do() as ApplicationsResponse;
    console.log('Search applications response:', JSON.stringify(response, null, 2));
    return response;
  } catch (error) {
    console.error('Search applications error:', error);
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to search applications: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function lookupApplicationBoxByIDandName(appId: number, boxName: string): Promise<Box> {
  try {
    let boxNameBytes: Buffer;

    // Check if string is a valid number
    if (!isNaN(Number(boxName))) {
      boxNameBytes = Buffer.from(boxName);
    }
    // Check if string is a valid Algorand address
    else if (algosdk.isValidAddress(boxName)) {
      boxNameBytes = Buffer.from(boxName);
    }
    // Try to decode as base64, if it fails then treat as regular string
    else {
      try {
        // Test if the string is valid base64
        Buffer.from(boxName, 'base64').toString('base64');
        // If we get here, it's valid base64
        boxNameBytes = Buffer.from(boxName, 'base64');
      } catch {
        // If base64 decoding fails, treat as regular string
        boxNameBytes = Buffer.from(boxName);
      }
    }

    console.log('Box name bytes:', boxNameBytes);
    const response = await indexerClient.lookupApplicationBoxByIDandName(appId, boxNameBytes).do() as Box;
    console.log('Box response:', JSON.stringify(response, null, 2));
    return response;
  } catch (error) {
    console.error('Box fetch error:', error);
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to get application box: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function searchForApplicationBoxes(appId: number, maxBoxes?: number): Promise<any> {
  try {
    console.log(`Searching boxes for application ${appId}`);
    let search = indexerClient.searchForApplicationBoxes(appId);
    if (maxBoxes !== undefined) {
      search = search.limit(maxBoxes);
    }
    const response = await search.do();
    console.log('Application boxes response:', JSON.stringify(response, null, 2));
    return response;
  } catch (error) {
    console.error('Application boxes fetch error:', error);
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to get application boxes: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export const handleApplicationTools = ResponseProcessor.wrapResourceHandler(async function handleApplicationTools(args: any): Promise<any> {
  const name = args.name;
  
  switch (name) {
    case 'api_indexer_lookup_applications': {
      const { appId } = args;
      const info = await lookupApplications(appId);
      return info.application;
    }
    case 'api_indexer_lookup_application_logs': {
      const { appId, ...params } = args;
      const logs = await lookupApplicationLogs(appId, params);
      return logs;
    }
    case 'api_indexer_search_for_applications': {
      const info = await searchForApplications(args);
      return info.applications;
    }
    case 'api_indexer_lookup_application_box': {
      const { appId, boxName } = args;
      const box = await lookupApplicationBoxByIDandName(appId, boxName);
      return box;
    }
    case 'api_indexer_lookup_application_boxes': {
      const { appId, maxBoxes } = args;
      const boxes = await searchForApplicationBoxes(appId, maxBoxes);
      return boxes.boxes;
    }
    default:
      throw new McpError(
        ErrorCode.MethodNotFound,
        `Unknown tool: ${name}`
      );
  }
});
