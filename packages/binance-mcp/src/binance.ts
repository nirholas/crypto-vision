// src/binance.ts
// Central registration file for all Binance modules

import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

// Import module registration functions
import { registerBinanceSpotTools } from "./modules/spot/index.js"
import { registerBinanceAlgoTools } from "./modules/algo/index.js"
import { registerBinanceSimpleEarnTools } from "./modules/simple-earn/index.js"
import { registerBinanceC2CTradeHistoryTools } from "./modules/c2c/index.js"
import { registerBinanceConvertTools } from "./modules/convert/index.js"
import { registerBinanceWalletTools } from "./modules/wallet/index.js"
import { registerBinanceCopyTradingTools } from "./modules/copy-trading/index.js"
import { registerBinanceFiatDepositWithdrawHistoryTools } from "./modules/fiat/index.js"
import { registerBinanceNFTTools } from "./modules/nft/index.js"
import { registerBinancePayTools } from "./modules/pay/index.js"
import { registerBinanceRebateTools } from "./modules/rebate/index.js"
import { registerBinanceDualInvestmentTools } from "./modules/dual-investment/index.js"
import { registerBinanceMiningTools } from "./modules/mining/index.js"
import { registerBinanceVipLoanTools } from "./modules/vip-loan/index.js"
import { registerBinanceStakingTools } from "./modules/staking/index.js"
import { registerPortfolioMargin } from "./modules/portfolio-margin/index.js"
import { registerGiftCard } from "./modules/gift-card/index.js"
import { registerSubAccount } from "./modules/sub-account/index.js"

// NOTE: The following modules are disabled due to missing/incompatible npm packages:
// - Margin (@binance/margin doesn't exist, needs refactoring to use connector-typescript)
// - Options (@binance/options doesn't exist)
// - Auto-Invest (API methods don't match current @binance/auto-invest SDK)
// - Crypto Loans (API methods don't match current @binance/crypto-loan SDK)
// - Futures USD-M (@binance/futures doesn't exist)
// - Futures COIN-M (@binance/futures doesn't exist)

/**
 * Register all Binance modules with the MCP server
 */
export function registerBinance(server: McpServer) {
  // Core trading modules
  registerBinanceSpotTools(server)
  registerBinanceAlgoTools(server)
  
  // Earn & Investment modules
  registerBinanceSimpleEarnTools(server)
  registerBinanceDualInvestmentTools(server)
  registerBinanceStakingTools(server)
  
  // Trading modules
  registerBinanceC2CTradeHistoryTools(server)
  registerBinanceConvertTools(server)
  registerBinanceCopyTradingTools(server)
  
  // Wallet & Finance modules
  registerBinanceWalletTools(server)
  registerBinanceFiatDepositWithdrawHistoryTools(server)
  registerBinanceVipLoanTools(server)
  
  // Portfolio Margin module
  registerPortfolioMargin(server)
  
  // Gift Card module
  registerGiftCard(server)
  
  // Sub-Account Management module
  registerSubAccount(server)
  
  // Other modules
  registerBinanceNFTTools(server)
  registerBinancePayTools(server)
  registerBinanceRebateTools(server)
  registerBinanceMiningTools(server)
}

