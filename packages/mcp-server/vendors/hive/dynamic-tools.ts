/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { zodToJsonSchema } from 'zod-to-json-schema';
import { z } from 'zod';
import { ToolRegistry, getAllToolsInCategory } from './toolRegistry';
import { Tool } from '@modelcontextprotocol/sdk/types';

export function asTextContentResult(result: Object): any {
  // return {data: result}
  // Estimate token count (roughly 4 chars per token)
  const MAX_TOKENS = 25000;
  const CHARS_PER_TOKEN = 4;
  const maxChar = MAX_TOKENS * CHARS_PER_TOKEN; // ~100,000 chars for 25k tokens
  
  const jsonString = JSON.stringify(result, null, 2);
  
  if (jsonString.length > maxChar) {
    // Try to intelligently truncate if it's an array
    if (Array.isArray(result)) {
      const truncatedArray = result.slice(0, Math.floor(result.length * maxChar / jsonString.length));
      const truncatedJson = JSON.stringify({
        results: truncatedArray,
        truncated: true,
        originalLength: result.length,
        returnedLength: truncatedArray.length,
        message: "Response truncated due to size limits. Consider using pagination."
      }, null, 2);
      
      return {
        content: [
          {
            type: 'text',
            text: truncatedJson,
          },
        ],
      };
    }
    
    // For objects with results array
    if (typeof result === 'object' && result !== null && 'results' in result && Array.isArray((result as any).results)) {
      const originalResults = (result as any).results;
      const estimatedItemSize = jsonString.length / originalResults.length;
      const maxItems = Math.floor(maxChar / estimatedItemSize);
      
      const truncatedResult = {
        ...result,
        results: originalResults.slice(0, maxItems),
        truncated: true,
        originalCount: originalResults.length,
        returnedCount: maxItems,
        message: "Response truncated due to size limits. Use pagination parameters (limit/offset) for more results."
      };
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(truncatedResult, null, 2),
          },
        ],
      };
    }
    
    // Fallback to simple truncation
    const truncated = jsonString.substring(0, maxChar) + '\n... [TRUNCATED DUE TO SIZE LIMITS]';
    return {
      content: [
        {
          type: 'text',
          text: truncated,
        },
      ],
    };
  }
  
  return {
    content: [
      {
        type: 'text',
        text: jsonString,
      },
    ],
  };
}

function zodToInputSchema(schema: z.ZodSchema) {
  return {
    type: 'object' as const,
    ...(zodToJsonSchema(schema) as any),
  };
}

export function dynamicTools(endpoints) {
  const getEndpointSchema = z.object({
    endpoint: z.string().describe('The name of the endpoint to get the schema for.'),
  });
  
  const getEndpointTool = {
    metadata: {
      resource: 'dynamic_tools',
      operation: 'read' as const,
      tags: [],
    },
    tool: {
      name: 'get_api_endpoint_schema',
      description:
        'Get the schema for an endpoint in the HIVE API. You can use the schema returned by this tool to call an endpoint with the `call_api_endpoint` tool.',
      inputSchema: zodToInputSchema(getEndpointSchema),
    },
    handler: async (args: Record<string, unknown> | undefined) => {
      if (!args) {
        throw new Error('No endpoint provided');
      }
      const endpointName = getEndpointSchema.parse(args).endpoint;

      // First, look in the original endpoints array
      let endpoint = endpoints.find((e) => e.name === endpointName);
      
      if (!endpoint) {
        throw new Error(`Endpoint ${endpointName} not found`);
      }
      return asTextContentResult(endpoint);
    },
  };

  const callEndpointSchema = z.object({
    endpoint_name: z.string().describe('The name of the endpoint to call.'),
    args: z
      .record(z.string(), z.any())
      .describe(
        'The arguments to pass to the endpoint. This must match the schema returned by the `get_api_endpoint_schema` tool.',
      ),
  });

  const callEndpointTool = {
    metadata: {
      resource: 'dynamic_tools',
      operation: 'write' as const,
      tags: [],
    },
    tool: {
      name: 'call_api_endpoint',
      description:
        'call an endpoint in the HIVE API. Note: use the category endpoints to get the list of endpoints and `get_api_endpoint_schema` tool to get the schema for an endpoint.',
      inputSchema: zodToInputSchema(callEndpointSchema),
    },
    handler: null
  };

  // Create category-specific endpoints that act as list functionality
  const categoryTools = ToolRegistry.map(category => {
    const categorySchema = z.object({});
    
    const categoryEndpointName = category.name;
    
    return {
      metadata: {
        resource: 'dynamic_tools',
        operation: 'read' as const,
        tags: ['category'],
      },
      tool: {
        name: categoryEndpointName,
        description: `Get all endpoints in the "${category.category}" category. ${category.description}`,
        inputSchema: zodToInputSchema(categorySchema),
      },
      handler: async (
        args: Record<string, unknown> | undefined,
      ): Promise<any> => {
        const toolsInCategory = getAllToolsInCategory(category.category);
        
        return asTextContentResult({
          category: category.category,
          description: category.description,
          tools: toolsInCategory.map((tool ) => ({
            name: tool.name,
            description: tool.description
          })),
        });
      },
    };
  });

  return [getEndpointTool, callEndpointTool, ...categoryTools];
}


