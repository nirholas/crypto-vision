/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/otc/index.ts
// Binance.US OTC (Over-The-Counter) Trading Tools
// Large block trades executed outside the regular order book

import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { makeSignedRequest } from "../../config/binanceUsClient.js";

/**
 * Register all Binance.US OTC trading tools
 * 
 * OTC trading allows large block trades to be executed outside the regular
 * order book, minimizing market impact for institutional traders.
 */
export function registerOtcTools(server: McpServer) {
    // =====================================================================
    // GET /sapi/v1/otc/coinPairs - Get Supported OTC Coin Pairs
    // =====================================================================
    server.tool(
        "binance_us_otc_coin_pairs",
        `Get a list of supported OTC (Over-The-Counter) trading pairs on Binance.US.

OTC trading allows large block trades to be executed outside the regular order book, 
minimizing market impact. This endpoint returns available coin pairs with their 
minimum and maximum trading limits.

Response includes:
- fromCoin/toCoin: The trading pair
- fromCoinMinAmount/fromCoinMaxAmount: Min/max amounts for the sell coin
- toCoinMinAmount/toCoinMaxAmount: Min/max amounts for the buy coin

Example: Convert large amounts of BTC to USDT without affecting market price.`,
        {
            fromCoin: z.string().optional().describe("Filter by source coin (e.g., BTC, SHIB)"),
            toCoin: z.string().optional().describe("Filter by destination coin (e.g., USDT, KSHIB)")
        },
        async (params) => {
            try {
                const response = await makeSignedRequest("GET", "/sapi/v1/otc/coinPairs", {
                    ...(params.fromCoin && { fromCoin: params.fromCoin.toUpperCase() }),
                    ...(params.toCoin && { toCoin: params.toCoin.toUpperCase() })
                });

                return {
                    content: [{
                        type: "text",
                        text: `Successfully retrieved OTC coin pairs. Response: ${JSON.stringify(response, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get OTC coin pairs: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );

    // =====================================================================
    // POST /sapi/v1/otc/quotes - Request Quote for OTC Trade
    // =====================================================================
    server.tool(
        "binance_us_otc_quote",
        `Request a quote for an OTC (Over-The-Counter) trade on Binance.US.

This endpoint requests a price quote for converting one coin to another via OTC.
The quote is valid for a limited time (check validTimestamp in response).

⚠️ IMPORTANT: The quote must be used quickly as it expires based on validTimestamp.

Parameters:
- fromCoin: The coin you want to sell (e.g., BTC, SHIB)
- toCoin: The coin you want to buy (e.g., USDT, KSHIB)
- requestCoin: Which coin's amount you're specifying (must be fromCoin or toCoin)
- requestAmount: The amount of the requestCoin

Response includes:
- symbol: Trading pair symbol
- ratio: Conversion ratio (e.g., 50550.26 for BTC/USDT)
- inverseRatio: Inverse conversion ratio
- validTimestamp: Unix timestamp when quote expires
- toAmount/fromAmount: Calculated amounts for the trade`,
        {
            fromCoin: z.string().describe("Coin to sell (e.g., BTC, SHIB)"),
            toCoin: z.string().describe("Coin to buy (e.g., USDT, KSHIB)"),
            requestCoin: z.string().describe("Which coin's amount you're specifying (fromCoin or toCoin)"),
            requestAmount: z.number().positive().describe("Amount of the request coin")
        },
        async (params) => {
            try {
                const response = await makeSignedRequest("POST", "/sapi/v1/otc/quotes", {
                    fromCoin: params.fromCoin.toUpperCase(),
                    toCoin: params.toCoin.toUpperCase(),
                    requestCoin: params.requestCoin.toUpperCase(),
                    requestAmount: params.requestAmount
                });

                return {
                    content: [{
                        type: "text",
                        text: `OTC Quote received successfully. ⚠️ Quote expires at timestamp ${response.validTimestamp}. Response: ${JSON.stringify(response, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get OTC quote: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );

    // =====================================================================
    // POST /sapi/v1/otc/orders - Place OTC Trade Order
    // =====================================================================
    server.tool(
        "binance_us_otc_place_order",
        `Place an OTC (Over-The-Counter) trade order using a previously acquired quote.

⚠️ IMPORTANT: You must first call binance_us_otc_quote to get a quoteId before placing an order.
The quote expires quickly, so place the order immediately after receiving the quote.

Order Status values:
- PROCESS: Order is being processed
- ACCEPT_SUCCESS: Order accepted, awaiting completion
- SUCCESS: Order completed successfully
- FAIL: Order failed

Response includes:
- orderId: Unique order identifier
- createTime: Order creation timestamp
- orderStatus: Current status of the order`,
        {
            quoteId: z.string().describe("Quote ID received from binance_us_otc_quote (e.g., '4e5446f2cc6f44ab86ab02abf19a2fd2')")
        },
        async (params) => {
            try {
                const response = await makeSignedRequest("POST", "/sapi/v1/otc/orders", {
                    quoteId: params.quoteId
                });

                return {
                    content: [{
                        type: "text",
                        text: `OTC order placed successfully. Order ID: ${response.orderId}, Status: ${response.orderStatus}. Response: ${JSON.stringify(response, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to place OTC order: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );

    // =====================================================================
    // GET /sapi/v1/otc/orders/{orderId} - Get OTC Order Details
    // =====================================================================
    server.tool(
        "binance_us_otc_get_order",
        `Get detailed information about a specific OTC (Over-The-Counter) trade order.

Use this to check the status and details of a previously placed OTC order.

Response includes:
- quoteId: Original quote ID used
- orderId: Order identifier
- orderStatus: SUCCESS, PROCESS, ACCEPT_SUCCESS, or FAIL
- fromCoin/fromAmount: Sold coin and amount
- toCoin/toAmount: Bought coin and amount
- ratio/inverseRatio: Exchange rates
- createTime: Order creation timestamp`,
        {
            orderId: z.string().describe("OTC order ID to query (e.g., '10002349')")
        },
        async (params) => {
            try {
                const response = await makeSignedRequest("GET", `/sapi/v1/otc/orders/${params.orderId}`);

                return {
                    content: [{
                        type: "text",
                        text: `OTC order details retrieved. Status: ${response.orderStatus}. Response: ${JSON.stringify(response, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get OTC order: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );

    // =====================================================================
    // GET /sapi/v1/otc/orders - Get All OTC Trade Orders
    // =====================================================================
    server.tool(
        "binance_us_otc_all_orders",
        `Query all OTC (Over-The-Counter) trade orders with optional filters.

Use this to retrieve your OTC trading history with various filtering options.

Response includes:
- total: Total number of orders matching filters
- rows: Array of order objects with full details

Each order contains: quoteId, orderId, orderStatus, fromCoin, fromAmount, 
toCoin, toAmount, ratio, inverseRatio, createTime`,
        {
            orderId: z.string().optional().describe("Filter by specific order ID"),
            fromCoin: z.string().optional().describe("Filter by source coin (e.g., BTC, KSHIB)"),
            toCoin: z.string().optional().describe("Filter by destination coin (e.g., USDT, SHIB)"),
            startTime: z.number().optional().describe("Start timestamp in milliseconds"),
            endTime: z.number().optional().describe("End timestamp in milliseconds"),
            page: z.number().int().positive().optional().describe("Page number (starts from 1)"),
            limit: z.number().int().min(1).max(100).optional().describe("Records per page (default: 10, max: 100)")
        },
        async (params) => {
            try {
                const response = await makeSignedRequest("GET", "/sapi/v1/otc/orders", {
                    ...(params.orderId && { orderId: params.orderId }),
                    ...(params.fromCoin && { fromCoin: params.fromCoin.toUpperCase() }),
                    ...(params.toCoin && { toCoin: params.toCoin.toUpperCase() }),
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.page && { page: params.page }),
                    ...(params.limit && { limit: params.limit })
                });

                return {
                    content: [{
                        type: "text",
                        text: `Retrieved ${response.total} OTC orders. Response: ${JSON.stringify(response, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get OTC orders: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );

    // =====================================================================
    // GET /sapi/v1/ocbs/orders - Get All OCBS (Fiat) Orders
    // =====================================================================
    server.tool(
        "binance_us_ocbs_orders",
        `Query all OCBS (One-Click-Buy-Sell) fiat orders on Binance.US.

OCBS allows direct fiat-to-crypto conversions. This endpoint retrieves your 
OCBS order history for fiat transactions (e.g., USD to BTC).

Response includes:
- total: Total number of OCBS orders
- dataList: Array of orders with details

Each order contains:
- quoteId, orderId, orderStatus (SUCCESS/FAIL)
- fromCoin/fromAmount: Source currency and amount
- toCoin/toAmount: Destination currency and amount
- feeCoin/feeAmount: Fee details
- ratio: Exchange rate
- createTime: Order timestamp`,
        {
            orderId: z.string().optional().describe("Filter by specific order ID"),
            startTime: z.number().optional().describe("Start timestamp in milliseconds"),
            endTime: z.number().optional().describe("End timestamp in milliseconds"),
            page: z.number().int().positive().optional().describe("Page number (starts from 1)"),
            limit: z.number().int().min(1).max(100).optional().describe("Records per page (default: 10, max: 100)")
        },
        async (params) => {
            try {
                const response = await makeSignedRequest("GET", "/sapi/v1/ocbs/orders", {
                    ...(params.orderId && { orderId: params.orderId }),
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.page && { page: params.page }),
                    ...(params.limit && { limit: params.limit })
                });

                return {
                    content: [{
                        type: "text",
                        text: `Retrieved ${response.total} OCBS orders. Response: ${JSON.stringify(response, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get OCBS orders: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
