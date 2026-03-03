/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

// Import EVM module registration functions
import { registerBlocks } from "@/evm/modules/blocks/index.js"
import { registerBridge } from "@/evm/modules/bridge/index.js"
import { registerContracts } from "@/evm/modules/contracts/index.js"
import { registerDeployment } from "@/evm/modules/deployment/index.js"
import { registerDomains } from "@/evm/modules/domains/index.js"
import { registerEvents } from "@/evm/modules/events/index.js"
import { registerGas } from "@/evm/modules/gas/index.js"
import { registerLending } from "@/evm/modules/lending/index.js"
import { registerMEV } from "@/evm/modules/mev/index.js"
import { registerMulticall } from "@/evm/modules/multicall/index.js"
import { registerNetwork } from "@/evm/modules/network/index.js"
import { registerNFT } from "@/evm/modules/nft/index.js"
import { registerPortfolio } from "@/evm/modules/portfolio/index.js"
import { registerPriceFeeds } from "@/evm/modules/price-feeds/index.js"
import { registerSecurity } from "@/evm/modules/security/index.js"
import { registerSignatures } from "@/evm/modules/signatures/index.js"
import { registerStaking } from "@/evm/modules/staking/index.js"
import { registerSwap } from "@/evm/modules/swap/index.js"
import { registerTokens } from "@/evm/modules/tokens/index.js"
import { registerTransactions } from "@/evm/modules/transactions/index.js"
import { registerWallet } from "@/evm/modules/wallet/index.js"
// NOTE: evm/modules/governance is deliberately excluded — modules/governance is the superset

// Import data/analytics modules
import { registerDefi } from "@/modules/defi/index.js"
import { registerDexAnalytics } from "@/modules/dex-analytics/index.js"
import { registerGovernance } from "@/modules/governance/index.js"
import { registerMarketData } from "@/modules/market-data/index.js"
import { registerNews } from "@/modules/news/index.js"
import { registerSocial } from "@/modules/social/index.js"
import { registerUtils } from "@/modules/utils/index.js"

/**
 * Register all EVM modules with the MCP server
 */
export function registerEVM(server: McpServer) {
  // Core modules
  registerNetwork(server)
  registerBlocks(server)
  registerTransactions(server)
  registerContracts(server)

  // Token modules
  registerTokens(server)
  registerNFT(server)

  // DeFi modules
  registerSwap(server)
  registerStaking(server)
  registerLending(server)
  registerBridge(server)

  // Utility modules
  registerGas(server)
  registerEvents(server)
  registerMulticall(server)
  registerSignatures(server)
  registerDomains(server)
  registerWallet(server)
  registerPortfolio(server)
  registerUtils(server)

  // Deployment & MEV modules
  registerDeployment(server)
  registerMEV(server)

  // Data modules
  registerPriceFeeds(server)
  registerSecurity(server)

  // Governance (from modules/ — superset of evm/modules/governance)
  registerGovernance(server)

  // News module
  registerNews(server)

  // Analytics & market data modules
  registerDefi(server)
  registerDexAnalytics(server)
  registerMarketData(server)
  registerSocial(server)
}
