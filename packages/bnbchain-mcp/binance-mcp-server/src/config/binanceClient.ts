/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/config/binanceClient.ts
import { Spot } from "@binance/spot";
import { SimpleEarn } from "@binance/simple-earn";
import { Algo } from "@binance/algo";
import { C2C } from "@binance/c2c";
import { Convert } from "@binance/convert";
import { Wallet } from "@binance/wallet";
import { CopyTrading } from "@binance/copy-trading";
import { Fiat } from "@binance/fiat";
import { NFT } from "@binance/nft";
import { Pay } from "@binance/pay";
import { Rebate } from "@binance/rebate";
import { DualInvestment } from "@binance/dual-investment";
import { Mining } from "@binance/mining";
import { VipLoan } from "@binance/vip-loan";
import { Staking } from "@binance/staking";
import { Margin } from "@binance/margin";
import { Futures } from "@binance/futures";
import { GiftCard } from "@binance/gift-card";
import { AutoInvest } from "@binance/auto-invest";
import { CryptoLoan } from "@binance/crypto-loan";
import { PortfolioMargin } from "@binance/portfolio-margin";
import { Options } from "@binance/options";

const API_KEY = process.env.BINANCE_API_KEY;
const API_SECRET = process.env.BINANCE_API_SECRET;
const BASE_URL = "https://api.binance.com";
const FUTURES_BASE_URL = "https://fapi.binance.com";
const DELIVERY_BASE_URL = "https://dapi.binance.com";
const OPTIONS_BASE_URL = "https://eapi.binance.com";

const configurationRestAPI = {
    apiKey: API_KEY ?? "",
    apiSecret: API_SECRET ?? "",
    basePath: BASE_URL ?? ""
};

const futuresConfigurationRestAPI = {
    apiKey: API_KEY ?? "",
    apiSecret: API_SECRET ?? "",
    basePath: FUTURES_BASE_URL
};

const deliveryConfigurationRestAPI = {
    apiKey: API_KEY ?? "",
    apiSecret: API_SECRET ?? "",
    basePath: DELIVERY_BASE_URL
};

const optionsConfigurationRestAPI = {
    apiKey: API_KEY ?? "",
    apiSecret: API_SECRET ?? "",
    basePath: OPTIONS_BASE_URL
};

// Spot Trading
export const spotClient = new Spot({ configurationRestAPI });

// Algo Trading
export const algoClient = new Algo({ configurationRestAPI });

// Earn & Investment
export const simpleEarnClient = new SimpleEarn({ configurationRestAPI });
export const dualInvestmentClient = new DualInvestment({ configurationRestAPI });
export const stakingClient = new Staking({ configurationRestAPI });
export const autoInvestClient = new AutoInvest({ configurationRestAPI });

// Trading
export const c2cClient = new C2C({ configurationRestAPI });
export const convertClient = new Convert({ configurationRestAPI });
export const copyTradingClient = new CopyTrading({ configurationRestAPI });

// Margin Trading
export const marginClient = new Margin({ configurationRestAPI });

// Futures Trading
export const futuresClient = new Futures({ configurationRestAPI: futuresConfigurationRestAPI });
export const deliveryClient = new Futures({ configurationRestAPI: deliveryConfigurationRestAPI });

// Options Trading
export const optionsClient = new Options({ configurationRestAPI: optionsConfigurationRestAPI });

// Loans
export const vipLoanClient = new VipLoan({ configurationRestAPI });
export const cryptoLoanClient = new CryptoLoan({ configurationRestAPI });

// Portfolio Margin
export const portfolioMarginClient = new PortfolioMargin({ configurationRestAPI });

// Wallet & Finance
export const walletClient = new Wallet({ configurationRestAPI });
export const fiatClient = new Fiat({ configurationRestAPI });

// Other
export const nftClient = new NFT({ configurationRestAPI });
export const payClient = new Pay({ configurationRestAPI });
export const rebateClient = new Rebate({ configurationRestAPI });
export const miningClient = new Mining({ configurationRestAPI });
export const giftCardClient = new GiftCard({ configurationRestAPI });
