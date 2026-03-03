/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { Tool, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { networkTools, handleNetworkTools } from './networks.js';
import { protocolTools, handleProtocolTools } from './protocols.js';
import { assetTools, handleAssetTools } from './assets.js';
import { poolTools, handlePoolTools } from './pools.js';
import { vaultTools, handleVaultTools } from './vaults.js';
import { balanceTools, handleBalanceTools } from './balances.js';
import { noteTools, handleNoteTools } from './notes.js';
import { swapTools, handleSwapTools } from './swaps.js';

// Export all Vestige tools
export const vestigeTools: Tool[] = [
  ...networkTools,
  ...protocolTools,
  ...assetTools,
  ...poolTools,
  ...vaultTools,
  ...balanceTools,
  ...noteTools,
  ...swapTools
];

// Handle all Vestige tools
export async function handleVestigeTools(name: string, args: any): Promise<any> {
  try {
    const combinedArgs = { name, ...args };
    // Network tools
    if (name.startsWith('api_vestige_view_network')) {
      return handleNetworkTools(combinedArgs);
    }

    // Protocol tools
    if (name.startsWith('api_vestige_view_protocol')) {
      return handleProtocolTools(combinedArgs);
    }

    

    // Pool tools
    if (name.startsWith('api_vestige_view_pool')) {
      return handlePoolTools(combinedArgs);
    }

    // Vault tools
    if (name.startsWith('api_vestige_view_vault')) {
      return handleVaultTools(combinedArgs);
    }

    // Balance tools
    if (name.startsWith('api_vestige_view_balance')) {
      return handleBalanceTools(combinedArgs);
    }
    
    // Note tools
    if (name.includes("_notes")) {
      return handleNoteTools(combinedArgs);
    }
    // Asset tools
    if (name.startsWith('api_vestige_view_asset')) {
      return handleAssetTools(combinedArgs);
    }

    // Swap tools
    if (name.startsWith('api_vestige_') &&
      (name.includes('_swap') || name.includes('_swaps') || name.includes('get_aggregator_stats'))) {
      return handleSwapTools(combinedArgs);
    }

    throw new McpError(
      ErrorCode.MethodNotFound,
      `Unknown tool: ${name}`
    );
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to handle Vestige tool: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
