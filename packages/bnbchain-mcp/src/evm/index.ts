import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

import { registerBlocks } from "./modules/blocks/index.js"
import { registerContracts } from "./modules/contracts/index.js"
import { registerNetwork } from "./modules/network/index.js"
import { registerNFT } from "./modules/nft/index.js"
import { registerTokens } from "./modules/tokens/index.js"
import { registerTransactions } from "./modules/transactions/index.js"
import { registerWallet } from "./modules/wallet/index.js"

// New extended modules
import { registerSwap } from "./modules/swap/index.js"
import { registerBridge } from "./modules/bridge/index.js"
import { registerGas } from "./modules/gas/index.js"
import { registerMulticall } from "./modules/multicall/index.js"
import { registerEvents } from "./modules/events/index.js"
import { registerSecurity } from "./modules/security/index.js"
import { registerStaking } from "./modules/staking/index.js"
import { registerSignatures } from "./modules/signatures/index.js"
import { registerLending } from "./modules/lending/index.js"
import { registerPriceFeeds } from "./modules/price-feeds/index.js"
import { registerPortfolio } from "./modules/portfolio/index.js"
import { registerDomains } from "./modules/domains/index.js"
import { registerGovernance } from "./modules/governance/index.js"

export function registerEVM(server: McpServer) {
  // Core modules
  registerBlocks(server)
  registerContracts(server)
  registerNetwork(server)
  registerTokens(server)
  registerTransactions(server)
  registerWallet(server)
  registerNFT(server)
  
  // Extended modules
  registerSwap(server)
  registerBridge(server)
  registerGas(server)
  registerMulticall(server)
  registerEvents(server)
  registerSecurity(server)
  registerStaking(server)
  registerSignatures(server)
  registerLending(server)
  registerPriceFeeds(server)
  registerPortfolio(server)
  registerDomains(server)
  registerGovernance(server)
}
