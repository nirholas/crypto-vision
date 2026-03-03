// src/tools/binance-staking/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceETHStakingApiTools } from "./ETH-staking-api/index.js";
import { registerBinanceSOLStakingApiTools } from "./SOL-staking-api/index.js";

export function registerBinanceStakingTools(server: McpServer) {
    registerBinanceETHStakingApiTools(server);
    registerBinanceSOLStakingApiTools(server);
}

// Alias for binance.ts compatibility
export { registerBinanceStakingTools as registerStaking };
