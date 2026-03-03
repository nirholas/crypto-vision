#!/usr/bin/env node
/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
/**
 * Universal Crypto MCP Server CLI
 * 
 * Command-line interface for running the Universal Crypto MCP Server
 */

import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function showHelp() {
    console.log(`
Universal Crypto MCP Server CLI

Usage:
  universal-crypto-mcp [options]

Options:
  --api-key <key>     Set Tatum API key
  --help, -h          Show this help message
  --version, -v       Show version

Environment Variables:
  UNIVERSAL_CRYPTO_API_KEY       Tatum API key (required)

Examples:
  universal-crypto-mcp --api-key your-api-key
  UNIVERSAL_CRYPTO_API_KEY=your-key universal-crypto-mcp

This MCP server provides 14 tools for blockchain operations:
  • 10 Blockchain Data tools (balances, transactions, NFTs, etc.)
  • 4 RPC Gateway tools (direct blockchain access)

For more information, visit: https://docs.tatum.io
`);
}

function showVersion() {
    const packagePath = path.join(__dirname, '../package.json');
    if (fs.existsSync(packagePath)) {
        const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        console.log(`Universal Crypto MCP Server v${pkg.version}`);
    } else {
        console.log('Universal Crypto MCP Server');
    }
}

function parseArguments(args: string[], env: Record<string, string | undefined>): void {
    let i = 0;
    while (i < args.length) {
        const arg = args[i];
        
        switch (arg) {
            case '--help':
            case '-h':
                showHelp();
                process.exit(0);
                break;
                
            case '--version':
            case '-v':
                showVersion();
                process.exit(0);
                break;
                
            case '--api-key':
                if (i + 1 < args.length) {
                    env.UNIVERSAL_CRYPTO_API_KEY = args[i + 1];
                    i += 2; // Skip current and next argument
                } else {
                    console.error('Error: --api-key requires a value');
                    process.exit(1);
                }
                break;
                
            default:
                if (arg.startsWith('-')) {
                    console.error(`Error: Unknown option ${arg}`);
                    console.error('Use --help for usage information');
                    process.exit(1);
                } else {
                    i++; // Move to next argument
                }
                break;
        }
    }
}

function main() {
    const args = process.argv.slice(2);
    const env = { ...process.env };
    
    parseArguments(args, env);
    
    // Check for API key
    if (!env.UNIVERSAL_CRYPTO_API_KEY) {
        console.error('Error: Tatum API key is required');
        console.error('Set it using --api-key option or UNIVERSAL_CRYPTO_API_KEY environment variable');
        console.error('Get your API key at: https://dashboard.tatum.io');
        process.exit(1);
    }
    
    // Start the MCP server
    const serverPath = path.join(__dirname, 'index.js');
    
    // All output to stderr to avoid interfering with MCP JSON protocol
    console.error('Starting Universal Crypto MCP Server...');
    console.error(`API Key: ${env.UNIVERSAL_CRYPTO_API_KEY.substring(0, 8)}...`);
    console.error('');
    
    const child = spawn('node', [serverPath], {
        env,
        stdio: 'inherit'
    });
    
    child.on('error', (error) => {
        console.error('Failed to start server:', error.message);
        process.exit(1);
    });
    
    child.on('exit', (code) => {
        process.exit(code ?? 0);
    });
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.error('Shutting down Universal Crypto MCP Server...');
        child.kill('SIGINT');
    });
    
    process.on('SIGTERM', () => {
        child.kill('SIGTERM');
    });
}

// Always run main when this script is executed
main();