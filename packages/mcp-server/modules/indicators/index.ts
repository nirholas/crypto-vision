/**
 * Crypto Technical Indicators Module
 * 
 * @author nich
 * @website https://x.com/nichxbt
 * @github https://github.com/nirholas
 * @license Apache-2.0
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTrendIndicators } from "./trend.js";
import { registerMomentumIndicators } from "./momentum.js";
import { registerVolatilityIndicators } from "./volatility.js";
import { registerVolumeIndicators } from "./volume.js";
import { registerTrendStrategies } from "./strategies/trend.js";
import { registerMomentumStrategies } from "./strategies/momentum.js";
import { registerVolatilityStrategies } from "./strategies/volatility.js";
import { registerVolumeStrategies } from "./strategies/volume.js";

export function registerIndicators(server: McpServer): void {
  // Register indicators
  registerTrendIndicators(server);
  registerMomentumIndicators(server);
  registerVolatilityIndicators(server);
  registerVolumeIndicators(server);
  
  // Register strategies
  registerTrendStrategies(server);
  registerMomentumStrategies(server);
  registerVolatilityStrategies(server);
  registerVolumeStrategies(server);
}
