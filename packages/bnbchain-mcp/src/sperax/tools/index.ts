/**
 * Sperax MCP Server - Tool Exports
 *
 * Central index for all MCP tools organized by domain.
 * Total: 85 tools across 16 categories
 *
 * Protocol Tools (67):
 * - USDs, SPA, Demeter, Vault, Dripper, Oracle, Analytics, Governance, YieldReserve, Portfolio
 * - Subgraph, Supply, Swap
 *
 * Ecosystem Tools (18):
 * - Agents: DeFi AI agent definitions API
 * - Plugins: SperaxOS plugin marketplace
 * - News: Crypto news aggregation
 */

// Domain-specific tool exports (Protocol)
export { usdsTools } from './usds.js';
export { spaTools } from './spa.js';
export { demeterTools } from './demeter.js';
export { vaultTools } from './vault.js';
export { dripperTools } from './dripper.js';
export { oracleTools } from './oracle.js';
export { analyticsTools } from './analytics.js';
export { governanceTools } from './governance.js';
export { yieldReserveTools } from './yield-reserve.js';
export { portfolioTools } from './portfolio.js';
export { subgraphTools } from './subgraph.js';
export { supplyTools } from './supply.js';
export { swapTools } from './swap.js';

// Ecosystem tool exports
export { agentsTools } from './agents.js';
export { pluginsTools } from './plugins.js';
export { newsTools } from './news.js';

// Import all tools for aggregation (Protocol)
import { usdsTools } from './usds.js';
import { spaTools } from './spa.js';
import { demeterTools } from './demeter.js';
import { vaultTools } from './vault.js';
import { dripperTools } from './dripper.js';
import { oracleTools } from './oracle.js';
import { analyticsTools } from './analytics.js';
import { governanceTools } from './governance.js';
import { yieldReserveTools } from './yield-reserve.js';
import { portfolioTools } from './portfolio.js';
import { subgraphTools } from './subgraph.js';
import { supplyTools } from './supply.js';
import { swapTools } from './swap.js';

// Import ecosystem tools
import { agentsTools } from './agents.js';
import { pluginsTools } from './plugins.js';
import { newsTools } from './news.js';

/**
 * All tools aggregated for server registration
 *
 * Protocol Categories:
 * - USDs: 7 tools (stablecoin operations)
 * - SPA: 8 tools (token & staking)
 * - Demeter: 7 tools (yield farming)
 * - Vault: 10 tools (collateral & strategies)
 * - Dripper: 5 tools (yield distribution)
 * - Oracle: 5 tools (price feeds)
 * - Analytics: 6 tools (protocol metrics)
 * - Governance: 5 tools (DAO operations)
 * - YieldReserve: 4 tools (yield collection & distribution)
 * - Portfolio: 2 tools (user position aggregation)
 * - Subgraph: 5 tools (historical data queries)
 * - Supply: 3 tools (circulating supply data)
 * - Swap: 3 tools (DEX routing & quotes)
 *
 * Ecosystem Categories:
 * - Agents: 5 tools (DeFi AI agent API)
 * - Plugins: 6 tools (SperaxOS plugin marketplace)
 * - News: 7 tools (crypto news aggregation)
 */
export const allTools = [
  // Protocol tools
  ...usdsTools,
  ...spaTools,
  ...demeterTools,
  ...vaultTools,
  ...dripperTools,
  ...oracleTools,
  ...analyticsTools,
  ...governanceTools,
  ...yieldReserveTools,
  ...portfolioTools,
  ...subgraphTools,
  ...supplyTools,
  ...swapTools,
  // Ecosystem tools
  ...agentsTools,
  ...pluginsTools,
  ...newsTools,
];

/**
 * Protocol tools only (for core Sperax operations)
 */
export const protocolTools = [
  ...usdsTools,
  ...spaTools,
  ...demeterTools,
  ...vaultTools,
  ...dripperTools,
  ...oracleTools,
  ...analyticsTools,
  ...governanceTools,
  ...yieldReserveTools,
  ...portfolioTools,
  ...subgraphTools,
  ...supplyTools,
  ...swapTools,
];

/**
 * Ecosystem tools only (agents, plugins, news)
 */
export const ecosystemTools = [
  ...agentsTools,
  ...pluginsTools,
  ...newsTools,
];

/**
 * Tool count by category
 */
export const toolCategories = {
  // Protocol categories
  usds: usdsTools.length,
  spa: spaTools.length,
  demeter: demeterTools.length,
  vault: vaultTools.length,
  dripper: dripperTools.length,
  oracle: oracleTools.length,
  analytics: analyticsTools.length,
  governance: governanceTools.length,
  yieldReserve: yieldReserveTools.length,
  portfolio: portfolioTools.length,
  subgraph: subgraphTools.length,
  supply: supplyTools.length,
  swap: swapTools.length,
  // Ecosystem categories
  agents: agentsTools.length,
  plugins: pluginsTools.length,
  news: newsTools.length,
  // Totals
  protocolTotal: 0,
  ecosystemTotal: 0,
  total: 0,
};

// Calculate totals
toolCategories.protocolTotal = 
  toolCategories.usds + toolCategories.spa + toolCategories.demeter +
  toolCategories.vault + toolCategories.dripper + toolCategories.oracle +
  toolCategories.analytics + toolCategories.governance + toolCategories.yieldReserve +
  toolCategories.portfolio + toolCategories.subgraph + toolCategories.supply +
  toolCategories.swap;

toolCategories.ecosystemTotal = 
  toolCategories.agents + toolCategories.plugins + toolCategories.news;

toolCategories.total = toolCategories.protocolTotal + toolCategories.ecosystemTotal;
