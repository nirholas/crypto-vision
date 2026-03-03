/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { z, ZodType } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { universalApiHandler } from '../services/request.js';
import { UNIVERSAL_CRYPTO_API_BASE } from '../config/constants.js';
import { saveToCache, getFromCache } from '../utils/cache.js';

// Tool configuration interface
export interface ToolConfig<T> {
    name: string;
    description: string;
    endpoint: string;
    method?: string; // HTTP method (GET, POST, PUT, DELETE, etc.)
    basePath?: string; // Optional, defaults to UNIVERSAL_CRYPTO_API_BASE
    parameters: Record<string, ZodType>;
    isLocal?: boolean; // Flag indicating if this tool performs a local operation
}

// Register all tools with the MCP server
export function registerTools(server: McpServer, toolConfigs: ToolConfig<any>[]) {
    toolConfigs.forEach((config) => {
        server.tool(config.name, config.description, config.parameters, async (params: Record<string, any>) => {
            // Handle local operations
            if (config.isLocal) {
                // Handle specific local tools
                if (config.name === 'save-share-token') {
                    await saveToCache('shareToken', params.shareToken);
                    return {
                        content: [
                            {
                                type: 'text',
                                text: 'Share token saved successfully',
                            },
                        ],
                    };
                }

                if (config.name === 'get-share-token') {
                    const shareToken = await getFromCache('shareToken');

                    return {
                        content: [
                            {
                                type: 'text',
                                text: shareToken ? shareToken : 'No share token found in cache',
                                isError: !shareToken,
                            },
                        ],
                    };
                }
                // Future local tools can be added here

                // Default response for unhandled local tools
                return {
                    content: [
                        {
                            type: 'text',
                            text: 'Operation completed',
                        },
                    ],
                };
            }

            // Handle API operations
            const basePath = config.basePath || UNIVERSAL_CRYPTO_API_BASE;
            const method = config.method || 'GET';

            // Methods that typically have a request body
            const bodyMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];

            // For GET/DELETE requests, all params go in the URL
            // For POST/PUT/PATCH, send params as the body
            if (bodyMethods.includes(method.toUpperCase())) {
                return universalApiHandler(basePath, config.endpoint, method, {}, params);
            } else {
                return universalApiHandler(basePath, config.endpoint, method, params);
            }
        });
    });
}

// Create a standard tool configuration
export function createToolConfig<T>(
    name: string,
    description: string,
    endpoint: string,
    parameters: Record<string, ZodType>,
    method: string = 'GET',
    basePath?: string,
    isLocal: boolean = false
): ToolConfig<T> {
    return {
        name,
        description,
        endpoint,
        method,
        parameters,
        basePath,
        isLocal,
    };
}
