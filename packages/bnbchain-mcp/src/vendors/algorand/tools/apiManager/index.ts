/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
import { algodTools, handleAlgodTools } from './algod/index.js';
import { indexerTools, handleIndexerTools } from './indexer/index.js';
import { nfdTools, handleNFDTools } from './nfd/index.js';
import { vestigeTools, handleVestigeTools } from './vestige/index.js';
import { tinymanTools, handleTinymanTools } from './tinyman/index.js';
import { ultradeTools, handleUltradeTools } from './ultrade/index.js';
import { exampleTools, handleExampleTools } from './example/index.js';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { ResponseProcessor } from '../../utils/responseProcessor.js';
import { env } from '../../env.js';
// Combine all API tools
export const apiManager = [
  ...algodTools,
  ...indexerTools,
  ...nfdTools,
  ...(env.vestige_active==='true' ? vestigeTools : []),
  ...(env.tinyman_active==='true' ? tinymanTools : []),
  ...(env.ultrade_active==='true' ? ultradeTools : []),
  ...exampleTools
];

// Handle all API tools
export async function handleApiManager(name: string, args: any): Promise<any> {
  try {
    let response;

    // Tinyman tools
    if (name.startsWith('api_tinyman_') && env.tinyman_active==='true') {
      response = await handleTinymanTools(name, args);
    }
    // Vestige tools
    else if (name.startsWith('api_vestige_') && env.vestige_active==='true') {
      response = await handleVestigeTools(name, args);
    }
    // Ultrade tools
    else if (name.startsWith('api_ultrade_')&& env.ultrade_active==='true') {
      response = await handleUltradeTools(name, args);
    }
    // NFD tools - check first since they're most specific
    else if (name.startsWith('api_nfd_')) {
      response = await handleNFDTools(name, args);
    }
    // Indexer tools
    else if (name.startsWith('api_indexer_')) {
      response = await handleIndexerTools(name, args);
    }
    // Algod tools - most general get_ prefix, check last
    else if (name.startsWith('api_algod_')) {
      response = await handleAlgodTools(name, args);
    }
    else if (name.startsWith('api_example_')) {
      response = await handleExampleTools(name, args);
    }
    else {
      throw new McpError(
        ErrorCode.MethodNotFound,
        `Unknown tool: ${name}`
      );
    }

    // Process and format the response
    return ResponseProcessor.processResponse(response, args?.pageToken);

  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to handle resource tool: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
