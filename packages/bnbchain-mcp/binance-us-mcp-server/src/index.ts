/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
#!/usr/bin/env node

import dotenv from "dotenv";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// Tool module imports
import { registerGeneralTools } from "./tools/general/index.js";
import { registerMarketTools } from "./tools/market/index.js";
import { registerBinanceUsTradeTools } from "./tools/trade/index.js";
import { registerWalletTools } from "./tools/wallet/index.js";
import { registerAccountTools } from "./tools/account/index.js";
import { registerOtcTools } from "./tools/otc/index.js";
import { registerStakingTools } from "./tools/staking/index.js";
import { registerSubaccountTools } from "./tools/subaccount/index.js";
import { registerUserDataStreamTools } from "./tools/userdata-stream/index.js";
import { registerCustodialTools } from "./tools/custodial/index.js";
import { registerCustodialSolutionTools } from "./tools/custodial-solution/index.js";
import { registerCreditLineTools } from "./tools/creditline/index.js";


// Load environment variables
dotenv.config();

/**
 * Binance.US MCP Server
 * 
 * A Model Context Protocol server providing access to Binance.US exchange APIs.
 * 
 * Key Differences from Binance.com:
 * - US regulatory compliance
 * - No futures, margin, or lending
 * - Custodial Solution API (unique to US)
 * - Credit Line API (unique to US)
 * 
 * API Key Types:
 * - Exchange API Keys: Standard trading access
 * - Custodial Solution API Keys: For custody partners
 * - Credit Line API Keys: For institutional credit
 * 
 * Environment Variables:
 * - BINANCE_US_API_KEY: Your Binance.US API key
 * - BINANCE_US_API_SECRET: Your Binance.US API secret
 */

// Main server entry
export async function main() {
  const server = new McpServer({
    name: "binance-us-mcp",
    version: "1.0.0",
  });

  // Register tool modules
  // Each tool module will register its own set of tools with the server
  
  // General System Tools (ping, time, status, exchange info)
  registerGeneralTools(server);
  
  // Market Data Tools (public endpoints)
  registerMarketTools(server);
  
  // Spot Trading Tools (requires TRADE permission)
  registerBinanceUsTradeTools(server);
  
  // Wallet Tools (requires USER_DATA permission)
  registerWalletTools(server);
  
  // Account Tools (requires USER_DATA permission)
  registerAccountTools(server);
  
  // OTC Trading Tools
  registerOtcTools(server);
  
  // Staking Tools
  registerStakingTools(server);
  
  // Sub-Account Tools
  registerSubaccountTools(server);
  
  // User Data Stream Tools (for real-time account updates)
  registerUserDataStreamTools(server);
  
  // Custodial Solution Tools (requires Custodial Solution API key)
  registerCustodialTools(server);
  
  // Custodial Solution Transfer/Settlement Tools (requires Custodial Solution API key)
  registerCustodialSolutionTools(server);
  
  // Credit Line Tools (requires Credit Line API key)
  registerCreditLineTools(server);

  // Connect to stdio transport for MCP communication
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  // Log startup (to stderr to not interfere with MCP protocol)
  console.error("Binance.US MCP server started");
}

// Run the server
main().catch((error) => {
  console.error("Fatal error starting Binance.US MCP server:", error);
  process.exit(1);
});
