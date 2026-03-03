/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Tool schemas
export const knowledgeToolSchemas = {
  getKnowledgeDoc: {
    type: 'object',
    properties: {
      documents: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of document keys (e.g. ["ARCs:specs:arc-0020.md"])'
      }
    },
    required: ['documents']
  }
};

export class KnowledgeManager {
  static readonly knowledgeTools = [
    {
      name: 'get_knowledge_doc',
      description: 'Get markdown content for specified knowledge documents',
      inputSchema: knowledgeToolSchemas.getKnowledgeDoc,
    }
  ];

  // Tool handlers
  static async handleTool(name: string, args: Record<string, unknown>) {
    try {
      switch (name) {
        case 'get_knowledge_doc':
          if (!Array.isArray(args.documents)) {
            throw new McpError(ErrorCode.InvalidParams, 'Documents array is required');
          }

          const results = await Promise.all(args.documents.map(async (docKey) => {
            if (typeof docKey !== 'string') {
              throw new McpError(ErrorCode.InvalidParams, 'Document key must be a string');
            }
            const __dirname = path.dirname(fileURLToPath(import.meta.url));
            const twoLevelsUp = path.resolve(__dirname, '../');
            console.log('Current directory:', __dirname);
            try {
              const filePath = path.resolve(
                twoLevelsUp,
                'resources/knowledge/taxonomy',
                docKey
              );
              const content = await fs.readFile(filePath, 'utf-8');
              return content;
            } catch (error) {
              console.error(`[MCP Error] Failed to read document ${docKey}:`, error);
              throw new McpError(
                ErrorCode.InternalError,
                `Failed to read document ${docKey}: ${error instanceof Error ? error.message : 'Unknown error'}`
              );
            }
          }));

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ documents: results }, null, 2)
            }]
          };

        default:
          console.error(`[MCP Error] Unknown tool requested: ${name}`);
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${name}`
          );
      }
    } catch (error) {
      if (error instanceof McpError) {
        console.error(`[MCP Error] ${error.code}: ${error.message}`);
        throw error;
      }
      console.error('[MCP Error] Unexpected error:', error);
      throw new McpError(
        ErrorCode.InternalError,
        `Operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
