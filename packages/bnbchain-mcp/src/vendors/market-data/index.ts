/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerTools } from './tools/toolFactory.js';
import { allToolConfigs } from './tools/toolConfigs.js';

// Create server instance
const server = new McpServer({
    name: 'universal-crypto-mcp',
    version: '1.0.0',
    capabilities: {
        resources: {},
        tools: {},
    },
});

// Register all tools from configurations
registerTools(server, allToolConfigs);

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Universal Crypto MCP running on stdio');
}

main().catch((error) => {
    console.error('Fatal error in main():', error);
    process.exit(1);
});
