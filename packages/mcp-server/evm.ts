/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

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

// Import data/analytics modules
import { registerDefi } from "@/modules/defi/index.js"
import { registerDexAnalytics } from "@/modules/dex-analytics/index.js"
import { registerGovernance } from "@/modules/governance/index.js"
import { registerMarketData } from "@/modules/market-data/index.js"
import { registerNews } from "@/modules/news/index.js"
import { registerSocial } from "@/modules/social/index.js"
import { registerUtils } from "@/modules/utils/index.js"

// Import new modules (from web3-mcp integration)
import { registerCoinGecko } from "@/modules/coingecko/index.js"
import { registerRubic } from "@/modules/rubic/index.js"

// Import new modules (technical indicators, screeners, research)
import { registerIndicators } from "@/modules/indicators/index.js"
import { registerTradingView } from "@/modules/tradingview/index.js"
import { registerResearch } from "@/modules/research/index.js"

// Import non-EVM chain vendors (from web3-mcp integration)
import { registerSolana } from "@/vendors/solana/index.js"
import { registerUTXOChains } from "@/vendors/utxo/index.js"
import { registerRipple } from "@/vendors/ripple/index.js"
import { registerTon } from "@/vendors/ton/index.js"
import { registerThorchain } from "@/vendors/thorchain/index.js"

// Import new chain vendors (Cosmos, Near, Sui, Aptos)
import { registerCosmos } from "@/vendors/cosmos/index.js"
import { registerNear } from "@/vendors/near/index.js"
import { registerSui } from "@/vendors/sui/index.js"
import { registerAptos } from "@/vendors/aptos/index.js"

// Import new feature modules
import { registerWebSockets } from "@/modules/websockets/index.js"
import { registerPortfolioTracker } from "@/modules/portfolio/index.js"
import { registerWalletAnalytics } from "@/modules/wallet-analytics/index.js"
import { registerAlerts } from "@/modules/alerts/index.js"
import { registerAIPrompts } from "@/modules/ai-prompts/index.js"
import { registerHistoricalData } from "@/modules/historical-data/index.js"
import { registerServerUtils } from "@/modules/server-utils/index.js"

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
  registerGovernance(server)

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

  // News module
  registerNews(server)

  // Analytics & market data modules
  registerDefi(server)
  registerDexAnalytics(server)
  registerMarketData(server)
  registerSocial(server)

  // New modules from web3-mcp integration
  registerCoinGecko(server)
  registerRubic(server)

  // Technical indicators & strategies (50+ indicators)
  registerIndicators(server)

  // TradingView-style screeners
  registerTradingView(server)

  // Research tools
  registerResearch(server)

  // Non-EVM chain modules from web3-mcp integration
  registerSolana(server)
  registerUTXOChains(server) // Bitcoin, Litecoin, Dogecoin
  registerRipple(server)
  registerTon(server)
  registerThorchain(server)

  // New chain modules
  registerCosmos(server)
  registerNear(server)
  registerSui(server)
  registerAptos(server)

  // New feature modules
  registerWebSockets(server)
  registerPortfolioTracker(server)
  registerWalletAnalytics(server)
  registerAlerts(server)
  registerAIPrompts(server)
  registerHistoricalData(server)
  registerServerUtils(server)
}
