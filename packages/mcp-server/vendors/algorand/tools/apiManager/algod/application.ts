/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { algodClient } from '../../../algorand-client.js';
import type { 
  Application,
  Box,
  BoxesResponse
} from 'algosdk/dist/types/client/v2/algod/models/types';
import algosdk from 'algosdk';

export const applicationTools = [
  {
    name: 'api_algod_get_application_by_id',
    description: 'Get application information',
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
    name: 'api_algod_get_application_box',
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
          description: 'Box name. '
        }
      },
      required: ['appId', 'boxName']
    }
  },
  {
    name: 'api_algod_get_application_boxes',
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

export async function getApplicationByID(appId: number): Promise<any> {
  try {
    console.log(`Fetching application info for ID ${appId}`);
    const response = await algodClient.getApplicationByID(appId).do() as any;
    console.log('Application response:', JSON.stringify(response, null, 2));
    return response;
  } catch (error) {
    console.error('Application fetch error:', error);
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to get application info: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function getApplicationBoxByName(appId: number, boxName: string): Promise<Box> {
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
    const response = await algodClient.getApplicationBoxByName(appId, boxNameBytes).do() as Box;
    console.log('Box response:', JSON.stringify(response, null, 2));
    return response;
  } catch (error) {
    console.error('Box fetch error:', error);
    console.error('Box name in error:', boxName);
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to get application box: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function getApplicationBoxes(appId: number, maxBoxes?: number): Promise<any> {
  try {
    console.log(`Fetching boxes for application ${appId}`);
    let search = algodClient.getApplicationBoxes(appId);
    if (maxBoxes !== undefined) {
      search = search.max(maxBoxes);
    }
    const response = await search.do() as BoxesResponse;
    console.log('Boxes response:', JSON.stringify(response, null, 2));
    // Ensure the response has the correct structure with boxes array
    return {
      boxes: response.boxes || []
    };
  } catch (error) {
    console.error('Boxes fetch error:', error);
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to get application boxes: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function handleApplicationTools(name: string, args: any): Promise<any> {
  switch (name) {
    case 'api_algod_get_application_by_id': {
      const { appId } = args;
      const info = await getApplicationByID(appId);
      return info;
    }
    case 'api_algod_get_application_box': {
      const { appId, boxName } = args;
      const box = await getApplicationBoxByName(appId, boxName);
      return box;
    }
    case 'api_algod_get_application_boxes': {
      const { appId, maxBoxes } = args;
      const boxes = await getApplicationBoxes(appId, maxBoxes);
      return boxes;
    }
    default:
      throw new McpError(
        ErrorCode.MethodNotFound,
        `Unknown tool: ${name}`
      );
  }
}
