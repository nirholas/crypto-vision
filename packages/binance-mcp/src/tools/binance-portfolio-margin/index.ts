// src/tools/binance-portfolio-margin/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinancePortfolioMarginGetAccount } from "./getPortfolioMarginAccount.js";
import { registerBinancePortfolioMarginGetCollateralRate } from "./getCollateralRate.js";
import { registerBinancePortfolioMarginGetBankruptcyLoanAmount } from "./getPortfolioMarginBankruptcyLoanAmount.js";
import { registerBinancePortfolioMarginRepayBankruptcyLoan } from "./repayPortfolioMarginBankruptcyLoan.js";
import { registerBinancePortfolioMarginGetInterestHistory } from "./getPortfolioMarginInterestHistory.js";
import { registerBinancePortfolioMarginGetAssetIndexPrice } from "./getPortfolioMarginAssetIndexPrice.js";
import { registerBinancePortfolioMarginFundAutoCollection } from "./fundAutoCollection.js";
import { registerBinancePortfolioMarginFundCollection } from "./fundCollection.js";
import { registerBinancePortfolioMarginBnbTransfer } from "./bnbTransfer.js";
import { registerBinancePortfolioMarginChangeAutoRepayFutures } from "./changeAutoRepayFutures.js";
import { registerBinancePortfolioMarginGetAutoRepayFuturesStatus } from "./getAutoRepayFuturesStatus.js";
import { registerBinancePortfolioMarginRepayFuturesNegativeBalance } from "./repayFuturesNegativeBalance.js";
import { registerBinancePortfolioMarginGetAssetLeverage } from "./getPortfolioMarginAssetLeverage.js";
import { registerBinancePortfolioMarginGetAccountBalance } from "./getAccountBalance.js";

export function registerBinancePortfolioMarginTools(server: McpServer) {
    // Account Information
    registerBinancePortfolioMarginGetAccount(server);
    registerBinancePortfolioMarginGetAccountBalance(server);
    registerBinancePortfolioMarginGetCollateralRate(server);
    registerBinancePortfolioMarginGetAssetLeverage(server);
    registerBinancePortfolioMarginGetAssetIndexPrice(server);
    
    // Interest & Loan Management
    registerBinancePortfolioMarginGetInterestHistory(server);
    registerBinancePortfolioMarginGetBankruptcyLoanAmount(server);
    registerBinancePortfolioMarginRepayBankruptcyLoan(server);
    
    // Fund Management
    registerBinancePortfolioMarginFundAutoCollection(server);
    registerBinancePortfolioMarginFundCollection(server);
    registerBinancePortfolioMarginBnbTransfer(server);
    
    // Futures Auto-Repay
    registerBinancePortfolioMarginChangeAutoRepayFutures(server);
    registerBinancePortfolioMarginGetAutoRepayFuturesStatus(server);
    registerBinancePortfolioMarginRepayFuturesNegativeBalance(server);
}
