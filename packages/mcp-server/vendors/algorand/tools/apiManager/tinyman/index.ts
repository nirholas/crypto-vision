/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { Tool, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { poolTools, handlePoolTools } from './pool.js';
import { liquidityTools, handleLiquidityTools } from './liquidity.js';
import { swapTools, handleSwapTools } from './swap.js';
import { analyticsTools, handleAnalyticsTools } from './analytics.js';
import { bootstrapTools, handleBootstrapTools } from './bootstrap.js';
import { removeLiquidityTools, handleRemoveLiquidityTools } from './remove_liquidity.js';
import { optInTools, handleOptInTools } from './opt_in.js';

// Combine all Tinyman tools
export const tinymanTools: Tool[] = [
  ...poolTools,
  ...liquidityTools,
  ...swapTools,
  ...analyticsTools,
  ...bootstrapTools,
  ...removeLiquidityTools,
  ...optInTools
];

// Handle all Tinyman tools
export async function handleTinymanTools(name: string, args: any): Promise<any> {
  try {
    const combinedArgs = { name, ...args };
    // Pool analytics tools (must come before pool tools due to prefix matching)
    if (name.startsWith('api_tinyman_get_pool_analytics')) {
      return handleAnalyticsTools(combinedArgs);
    }
    
    // Pool creation tools (must come before pool tools due to prefix matching)
    if (name.startsWith('api_tinyman_get_pool_creation')) {
      return handleBootstrapTools(combinedArgs);
    }

    // Pool tools
    if (name.startsWith('api_tinyman_get_pool')) {
      return handlePoolTools(combinedArgs);
    }

    // Remove liquidity tools (must come before liquidity tools due to prefix matching)
    if (name.startsWith('api_tinyman_get_remove_liquidity')) {
      return handleRemoveLiquidityTools(combinedArgs);
    }

    // Liquidity tools
    if (name.startsWith('api_tinyman_get_liquidity')) {
      return handleLiquidityTools(combinedArgs);
    }

    // Swap tools
    if (name.startsWith('api_tinyman_get_swap')) {
      return handleSwapTools(combinedArgs);
    }

    // Opt-in tools
    if (name.startsWith('api_tinyman_get_asset_optin') ||
        name.startsWith('api_tinyman_get_validator_opt')) {
      return handleOptInTools(combinedArgs);
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
      `Failed to handle Tinyman tool: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
