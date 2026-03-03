/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/binance-gift-card/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBinanceGiftCardCreate } from "./createGiftCard.js";
import { registerBinanceGiftCardRedeem } from "./redeemGiftCard.js";
import { registerBinanceGiftCardVerify } from "./verifyGiftCard.js";
import { registerBinanceGiftCardBuyCode } from "./buyCode.js";
import { registerBinanceGiftCardTokenLimit } from "./tokenLimit.js";
import { registerBinanceGiftCardRsaPublicKey } from "./rsaPublicKey.js";
import { registerBinanceGiftCardCreateDualToken } from "./createDualTokenGiftCard.js";
import { registerBinanceGiftCardRedeemDualToken } from "./redeemDualTokenGiftCard.js";

export function registerBinanceGiftCardTools(server: McpServer) {
    // Create Gift Cards
    registerBinanceGiftCardCreate(server);
    registerBinanceGiftCardCreateDualToken(server);
    
    // Redeem Gift Cards
    registerBinanceGiftCardRedeem(server);
    registerBinanceGiftCardRedeemDualToken(server);
    
    // Verify & Info
    registerBinanceGiftCardVerify(server);
    registerBinanceGiftCardBuyCode(server);
    registerBinanceGiftCardTokenLimit(server);
    registerBinanceGiftCardRsaPublicKey(server);
}
