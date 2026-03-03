/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { UNIVERSAL_CRYPTO_API_KEY } from '../config/constants.js';

// Helper function for making Universal Crypto API requests
export async function makeRequestCsApi<T>(url: string, method: string = 'GET', params: Record<string, any> = {}, body?: any): Promise<T | null> {
    const headers = {
        'X-API-KEY': UNIVERSAL_CRYPTO_API_KEY,
        'Content-Type': 'application/json',
    };

    try {
        // Build request options
        const options: RequestInit = { method, headers };

        // Add body for non-GET requests if provided
        if (method !== 'GET' && body) {
            options.body = JSON.stringify(body);
        }

        // Add query params for all requests
        const queryParams = new URLSearchParams(params);
        const queryString = queryParams.toString();
        const urlWithParams = queryString ? `${url}?${queryString}` : url;

        const response = await fetch(urlWithParams, options);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return (await response.json()) as T;
    } catch (error) {
        return null;
    }
}

// Universal handler for API requests
export async function universalApiHandler<T>(
    basePath: string,
    endpoint: string,
    method: string = 'GET',
    params: Record<string, any> = {},
    body?: any
): Promise<{
    content: Array<{ type: 'text'; text: string; isError?: boolean }>;
}> {
    try {
        // Handle path parameters - replace {paramName} in endpoint with actual values
        let processedEndpoint = endpoint;
        let processedParams = { ...params };

        // Find all path parameters in the endpoint (e.g., {coinId}, {id}, {type})
        const pathParamMatches = endpoint.match(/\{([^}]+)\}/g);

        if (pathParamMatches) {
            for (const match of pathParamMatches) {
                const paramName = match.slice(1, -1); // Remove { and }

                if (processedParams[paramName] !== undefined) {
                    // Replace the placeholder with the actual value
                    processedEndpoint = processedEndpoint.replace(match, processedParams[paramName]);
                    // Remove the parameter from query params since it's now part of the path
                    delete processedParams[paramName];
                } else {
                    throw new Error(`Required path parameter '${paramName}' is missing`);
                }
            }
        }

        // MCP clients might not support '~' in parameter names, so we replace '-' with '~' specifically for the /coins endpoint before making the request.
        if (endpoint === '/coins') {
            processedParams = Object.entries(processedParams).reduce((acc, [key, value]) => {
                acc[key.replace(/-/g, '~')] = value;
                return acc;
            }, {} as Record<string, any>);
        }

        const url = `${basePath}${processedEndpoint}`;
        const data = await makeRequestCsApi<T>(url, method, processedParams, body);

        if (!data) {
            return {
                content: [{ type: 'text', text: 'Something went wrong', isError: true }],
            };
        }

        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(data),
                },
            ],
        };
    } catch (error) {
        return {
            content: [{ type: 'text', text: `Error: ${error}`, isError: true }],
        };
    }
}
