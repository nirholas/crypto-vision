/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/binance.ts
// Central registration file for all Binance modules

import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

// Import module registration functions
import { registerSpot } from "./modules/spot/index.js"
import { registerAlgo } from "./modules/algo/index.js"
import { registerSimpleEarn } from "./modules/simple-earn/index.js"
import { registerC2C } from "./modules/c2c/index.js"
import { registerConvert } from "./modules/convert/index.js"
import { registerWallet } from "./modules/wallet/index.js"
import { registerCopyTrading } from "./modules/copy-trading/index.js"
import { registerFiat } from "./modules/fiat/index.js"
import { registerNFT } from "./modules/nft/index.js"
import { registerPay } from "./modules/pay/index.js"
import { registerRebate } from "./modules/rebate/index.js"
import { registerDualInvestment } from "./modules/dual-investment/index.js"
import { registerMining } from "./modules/mining/index.js"
import { registerVipLoan } from "./modules/vip-loan/index.js"
import { registerStaking } from "./modules/staking/index.js"
import { registerMargin } from "./modules/margin/index.js"
import { registerOptions } from "./modules/options/index.js"
import { registerPortfolioMargin } from "./modules/portfolio-margin/index.js"
import { registerAutoInvest } from "./modules/auto-invest/index.js"
import { registerFuturesUSDM } from "./modules/futures-usdm/index.js"
import { registerFuturesCOINM } from "./modules/futures-coinm/index.js"
import { registerGiftCard } from "./modules/gift-card/index.js"
import { registerCryptoLoans } from "./modules/crypto-loans/index.js"

/**
 * Register all Binance modules with the MCP server
 */
export function registerBinance(server: McpServer) {
  // Core trading modules
  registerSpot(server)
  registerAlgo(server)
  
  // Margin trading module
  registerMargin(server)
  
  // Futures trading modules
  registerFuturesUSDM(server)
  registerFuturesCOINM(server)
  
  // Options trading module
  registerOptions(server)
  
  // Portfolio Margin module
  registerPortfolioMargin(server)
  
  // Earn & Investment modules
  registerSimpleEarn(server)
  registerDualInvestment(server)
  registerStaking(server)
  registerAutoInvest(server)
  
  // Trading modules
  registerC2C(server)
  registerConvert(server)
  registerCopyTrading(server)
  
  // Wallet & Finance modules
  registerWallet(server)
  registerFiat(server)
  registerVipLoan(server)
  registerCryptoLoans(server)
  
  // Other modules
  registerNFT(server)
  registerPay(server)
  registerRebate(server)
  registerMining(server)
  registerGiftCard(server)
}
