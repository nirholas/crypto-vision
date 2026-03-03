// src/tools/custodial/index.ts
// Binance.US Custodial Solution Tools
// For institutional custody partners (e.g., Anchorage, BitGo)

import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { makeSignedRequest } from "../../config/binanceUsClient.js";

// Common schema for rail parameter (custodial partner)
const railSchema = z.string().describe("Custodial partner name (e.g., ANCHORAGE, BITGO). Must be uppercase.");

// Order type enum
const orderTypeEnum = z.enum([
    "LIMIT",
    "MARKET",
    "STOP_LOSS",
    "STOP_LOSS_LIMIT",
    "TAKE_PROFIT",
    "TAKE_PROFIT_LIMIT",
    "LIMIT_MAKER"
]);

// Order side enum
const orderSideEnum = z.enum(["BUY", "SELL"]);

// Time in force enum
const timeInForceEnum = z.enum(["GTC", "IOC", "FOK"]);

/**
 * Register all Binance.US Custodial Solution tools
 * 
 * ⚠️ IMPORTANT: These APIs require a special Custodial Solution API key type.
 * Standard Binance.US API keys will NOT work with these endpoints.
 * 
 * Custodial Solution is designed for institutional custody partners like
 * Anchorage, allowing them to trade on behalf of their clients while
 * maintaining custody of the assets.
 */
export function registerCustodialTools(server: McpServer) {
    // =====================================================================
    // GET /sapi/v1/custodian/balance - Get Custodial Account Balance
    // =====================================================================
    server.tool(
        "binance_us_cust_balance",
        `Get balance information for Binance.US exchange wallet and custodial sub-account.

⚠️ REQUIRES CUSTODIAL SOLUTION API KEY - Standard API keys will not work.

This endpoint is for institutional custody partners (e.g., Anchorage, BitGo).

Response includes:
- exchangeWalletBalance: Balances in your Binance.US exchange wallet
- custodialAcctBalance: Balances in your custodial sub-account

Each balance entry contains:
- asset: Asset symbol
- free: Available balance
- locked: Locked balance
- inSettlement: Amount in settlement (custodial only)
- lastUpdatedTime: Last update timestamp`,
        {
            rail: railSchema
        },
        async (params) => {
            try {
                const response = await makeSignedRequest("GET", "/sapi/v1/custodian/balance", {
                    rail: params.rail.toUpperCase()
                });

                return {
                    content: [{
                        type: "text",
                        text: `Successfully retrieved custodial balance. Response: ${JSON.stringify(response, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get custodial balance: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );

    // =====================================================================
    // GET /sapi/v1/custodian/supportedAssetList - Get Supported Assets
    // =====================================================================
    server.tool(
        "binance_us_cust_supported_assets",
        `Get list of assets supported for custodial solution transfers and settlements.

⚠️ REQUIRES CUSTODIAL SOLUTION API KEY

Response includes:
- transferEligible: Assets that can be transferred
- settlementEligible: Assets that can be settled

Each asset entry contains:
- asset: Asset symbol
- precision: Decimal precision
- network: Supported blockchain networks`,
        {
            rail: railSchema
        },
        async (params) => {
            try {
                const response = await makeSignedRequest("GET", "/sapi/v1/custodian/supportedAssetList", {
                    rail: params.rail.toUpperCase()
                });

                return {
                    content: [{
                        type: "text",
                        text: `Successfully retrieved supported assets. Response: ${JSON.stringify(response, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get supported assets: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );

    // =====================================================================
    // POST /sapi/v1/custodian/walletTransfer - Transfer from Exchange Wallet
    // =====================================================================
    server.tool(
        "binance_us_cust_wallet_transfer",
        `Transfer assets from Binance.US exchange wallet to custodial sub-account.

⚠️ REQUIRES CUSTODIAL SOLUTION API KEY

Use this to move assets from your Binance.US exchange wallet to your 
custodial sub-account for trading.

Response includes:
- asset: Transferred asset
- amount: Transfer amount
- clientOrderId: Your reference ID (or auto-generated)
- transferId: Unique transfer identifier
- status: Transfer status (SUCCESS, PENDING, etc.)
- createTime: Transfer creation timestamp`,
        {
            rail: railSchema,
            asset: z.string().describe("Asset to transfer (e.g., BTC, ETH)"),
            amount: z.number().positive().describe("Amount to transfer"),
            clientOrderId: z.string().optional().describe("Your unique reference ID (auto-generated if not provided)")
        },
        async (params) => {
            try {
                const response = await makeSignedRequest("POST", "/sapi/v1/custodian/walletTransfer", {
                    rail: params.rail.toUpperCase(),
                    asset: params.asset.toUpperCase(),
                    amount: params.amount,
                    ...(params.clientOrderId && { clientOrderId: params.clientOrderId })
                });

                return {
                    content: [{
                        type: "text",
                        text: `Wallet transfer completed. Transfer ID: ${response.transferId}, Status: ${response.status}. Response: ${JSON.stringify(response, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to execute wallet transfer: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );

    // =====================================================================
    // POST /sapi/v1/custodian/custodianTransfer - Transfer from Custodian
    // =====================================================================
    server.tool(
        "binance_us_cust_transfer",
        `Transfer assets from custodial partner account to Binance.US custodial sub-account.

⚠️ REQUIRES CUSTODIAL SOLUTION API KEY

Use this to move assets from your custodial partner (e.g., Anchorage) 
to your Binance.US custodial sub-account for trading.

Response includes:
- asset: Transferred asset
- amount: Transfer amount
- transferId: Unique transfer identifier
- custodyAccountId/custodyAccountName: Custodian account details
- status: Transfer status
- createTime: Transfer creation timestamp`,
        {
            rail: railSchema,
            asset: z.string().describe("Asset to transfer (e.g., BTC, ETH)"),
            amount: z.number().positive().describe("Amount to transfer"),
            clientOrderId: z.string().optional().describe("Your unique reference ID (auto-generated if not provided)")
        },
        async (params) => {
            try {
                const response = await makeSignedRequest("POST", "/sapi/v1/custodian/custodianTransfer", {
                    rail: params.rail.toUpperCase(),
                    asset: params.asset.toUpperCase(),
                    amount: params.amount,
                    ...(params.clientOrderId && { clientOrderId: params.clientOrderId })
                });

                return {
                    content: [{
                        type: "text",
                        text: `Custodian transfer initiated. Transfer ID: ${response.transferId}, Status: ${response.status}. Response: ${JSON.stringify(response, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to execute custodian transfer: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );

    // =====================================================================
    // POST /sapi/v1/custodian/undoTransfer - Undo Transfer
    // =====================================================================
    server.tool(
        "binance_us_cust_undo_transfer",
        `Undo a previous transfer from your custodial partner.

⚠️ REQUIRES CUSTODIAL SOLUTION API KEY

Use this to reverse a custodian transfer that hasn't been fully processed.

Response includes:
- transferId: New transfer ID for the undo operation
- asset: Asset being returned
- amount: Amount being returned`,
        {
            rail: railSchema,
            originTransferId: z.string().describe("Original transfer ID to undo")
        },
        async (params) => {
            try {
                const response = await makeSignedRequest("POST", "/sapi/v1/custodian/undoTransfer", {
                    rail: params.rail.toUpperCase(),
                    originTransferId: params.originTransferId
                });

                return {
                    content: [{
                        type: "text",
                        text: `Transfer undo completed. Response: ${JSON.stringify(response, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to undo transfer: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );

    // =====================================================================
    // GET /sapi/v1/custodian/walletTransferHistory - Wallet Transfer History
    // =====================================================================
    server.tool(
        "binance_us_cust_wallet_transfer_history",
        `Get history of transfers from Binance.US exchange wallet to custodial sub-account.

⚠️ REQUIRES CUSTODIAL SOLUTION API KEY

Response includes:
- data: Array of transfer records
- total: Total number of transfers

Each transfer record contains: transferId, clientOrderId, asset, amount, 
status, createTime, updateTime`,
        {
            rail: railSchema,
            transferId: z.string().optional().describe("Filter by specific transfer ID"),
            clientOrderId: z.string().optional().describe("Filter by client order ID"),
            asset: z.string().optional().describe("Filter by asset (e.g., BTC)"),
            startTime: z.number().optional().describe("Start timestamp (default: 90 days ago)"),
            endTime: z.number().optional().describe("End timestamp (default: now)"),
            page: z.number().int().positive().optional().default(1).describe("Page number (default: 1)"),
            limit: z.number().int().min(1).max(100).optional().default(20).describe("Records per page (default: 20, max: 100)")
        },
        async (params) => {
            try {
                const response = await makeSignedRequest("GET", "/sapi/v1/custodian/walletTransferHistory", {
                    rail: params.rail.toUpperCase(),
                    ...(params.transferId && { transferId: params.transferId }),
                    ...(params.clientOrderId && { clientOrderId: params.clientOrderId }),
                    ...(params.asset && { asset: params.asset.toUpperCase() }),
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.page && { page: params.page }),
                    ...(params.limit && { limit: params.limit })
                });

                return {
                    content: [{
                        type: "text",
                        text: `Retrieved ${response.total} wallet transfers. Response: ${JSON.stringify(response, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get wallet transfer history: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );

    // =====================================================================
    // GET /sapi/v1/custodian/custodianTransferHistory - Custodian Transfer History
    // =====================================================================
    server.tool(
        "binance_us_cust_transfer_history",
        `Get history of transfers from custodial partner to Binance.US custodial sub-account.

⚠️ REQUIRES CUSTODIAL SOLUTION API KEY

Includes ExpressTrade transfers, Custodian transfers, and Undo transfers.

Response includes:
- data: Array of transfer records
- total: Total number of transfers

Each record contains: transferId, clientOrderId, asset, amount, status, 
expressTrade flag, createTime, updateTime`,
        {
            rail: railSchema,
            transferId: z.string().optional().describe("Filter by specific transfer ID"),
            clientOrderId: z.string().optional().describe("Filter by client order ID"),
            expressTradeTransfer: z.boolean().optional().default(false).describe("Filter ExpressTrade transfers only"),
            asset: z.string().optional().describe("Filter by asset (e.g., BTC)"),
            startTime: z.number().optional().describe("Start timestamp (default: 90 days ago)"),
            endTime: z.number().optional().describe("End timestamp (default: now)"),
            page: z.number().int().positive().optional().default(1).describe("Page number (default: 1)"),
            limit: z.number().int().min(1).max(100).optional().default(20).describe("Records per page (default: 20, max: 100)")
        },
        async (params) => {
            try {
                const response = await makeSignedRequest("GET", "/sapi/v1/custodian/custodianTransferHistory", {
                    rail: params.rail.toUpperCase(),
                    ...(params.transferId && { transferId: params.transferId }),
                    ...(params.clientOrderId && { clientOrderId: params.clientOrderId }),
                    ...(params.expressTradeTransfer !== undefined && { expressTradeTransfer: params.expressTradeTransfer }),
                    ...(params.asset && { asset: params.asset.toUpperCase() }),
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.page && { page: params.page }),
                    ...(params.limit && { limit: params.limit })
                });

                return {
                    content: [{
                        type: "text",
                        text: `Retrieved ${response.total} custodian transfers. Response: ${JSON.stringify(response, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get custodian transfer history: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );

    // =====================================================================
    // GET /sapi/v1/custodian/availableBalance - Get Available Balance
    // =====================================================================
    server.tool(
        "binance_us_cust_available_balance",
        `Get available balance in the custodial sub-account for trading.

⚠️ REQUIRES CUSTODIAL SOLUTION API KEY

Returns the balance available for placing new orders.`,
        {
            rail: railSchema,
            asset: z.string().optional().describe("Filter by specific asset")
        },
        async (params) => {
            try {
                const response = await makeSignedRequest("GET", "/sapi/v1/custodian/availableBalance", {
                    rail: params.rail.toUpperCase(),
                    ...(params.asset && { asset: params.asset.toUpperCase() })
                });

                return {
                    content: [{
                        type: "text",
                        text: `Successfully retrieved available balance. Response: ${JSON.stringify(response, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get available balance: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );

    // =====================================================================
    // POST /sapi/v1/custodian/order - Place Custodial Order
    // =====================================================================
    server.tool(
        "binance_us_cust_new_order",
        `Place a new trade order through the custodial solution.

⚠️ REQUIRES CUSTODIAL SOLUTION API KEY

Supported order types:
- LIMIT: Requires timeInForce, quantity, price
- MARKET: Requires quantity OR quoteOrderQty
- STOP_LOSS: Requires quantity, stopPrice (executes as MARKET when triggered)
- STOP_LOSS_LIMIT: Requires timeInForce, quantity, price, stopPrice
- TAKE_PROFIT: Requires quantity, stopPrice (executes as MARKET when triggered)
- TAKE_PROFIT_LIMIT: Requires timeInForce, quantity, price, stopPrice
- LIMIT_MAKER: Requires quantity, price (POST-ONLY order)

ExpressTrade Feature:
When allowExpressTrade=true and custodial sub-account balance is insufficient,
the full amount will be automatically transferred from the custodial partner.

Response includes: symbol, orderId, status, type, side, price, quantity, 
executedQty, and expressTradeFlag`,
        {
            rail: railSchema,
            symbol: z.string().describe("Trading pair (e.g., BTCUSD, ETHUSD)"),
            side: orderSideEnum.describe("Order side: BUY or SELL"),
            type: orderTypeEnum.describe("Order type"),
            timeInForce: timeInForceEnum.optional().describe("GTC (Good Til Canceled), IOC (Immediate or Cancel), FOK (Fill or Kill)"),
            quantity: z.number().positive().optional().describe("Order quantity in base asset"),
            quoteOrderQty: z.number().positive().optional().describe("Order quantity in quote asset (MARKET orders only)"),
            price: z.number().positive().optional().describe("Order price (required for LIMIT orders)"),
            stopPrice: z.number().positive().optional().describe("Stop/trigger price for stop orders"),
            icebergQty: z.number().positive().optional().describe("Iceberg order quantity"),
            asset: z.string().optional().describe("Asset for ExpressTrade (the asset being sold)"),
            allowExpressTrade: z.boolean().optional().default(false).describe("Enable ExpressTrade for auto-funding")
        },
        async (params) => {
            try {
                const response = await makeSignedRequest("POST", "/sapi/v1/custodian/order", {
                    rail: params.rail.toUpperCase(),
                    symbol: params.symbol.toUpperCase(),
                    side: params.side,
                    type: params.type,
                    ...(params.timeInForce && { timeInForce: params.timeInForce }),
                    ...(params.quantity && { quantity: params.quantity }),
                    ...(params.quoteOrderQty && { quoteOrderQty: params.quoteOrderQty }),
                    ...(params.price && { price: params.price }),
                    ...(params.stopPrice && { stopPrice: params.stopPrice }),
                    ...(params.icebergQty && { icebergQty: params.icebergQty }),
                    ...(params.asset && { asset: params.asset.toUpperCase() }),
                    ...(params.allowExpressTrade !== undefined && { allowExpressTrade: params.allowExpressTrade })
                });

                return {
                    content: [{
                        type: "text",
                        text: `Custodial order placed. Order ID: ${response.orderId}, Status: ${response.status}. Response: ${JSON.stringify(response, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to place custodial order: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );

    // =====================================================================
    // POST /sapi/v1/custodian/ocoOrder - Place Custodial OCO Order
    // =====================================================================
    server.tool(
        "binance_us_cust_oco_order",
        `Place a new OCO (One-Cancels-the-Other) order through the custodial solution.

⚠️ REQUIRES CUSTODIAL SOLUTION API KEY

OCO orders combine a limit order with a stop-loss order. When one executes, 
the other is automatically canceled.

Price Restrictions:
- SELL: Limit Price > Last Price > Stop Price
- BUY: Limit Price < Last Price < Stop Price

Quantity: Both legs must have the same quantity (iceberg qty can differ).

Note: OCO counts as 2 orders against rate limits.

Response includes orderListId, orders array, and orderReports with details.`,
        {
            rail: railSchema,
            symbol: z.string().describe("Trading pair (e.g., BTCUSD, ETHUSD)"),
            side: orderSideEnum.describe("Order side: BUY or SELL"),
            quantity: z.number().positive().describe("Order quantity (same for both legs)"),
            price: z.number().positive().describe("Limit order price"),
            stopPrice: z.number().positive().describe("Stop trigger price"),
            limitClientOrderId: z.string().optional().describe("Unique ID for the limit order"),
            limitIcebergQty: z.number().positive().optional().describe("Iceberg qty for limit leg"),
            stopClientOrderId: z.string().optional().describe("Unique ID for the stop leg"),
            stopLimitPrice: z.number().positive().optional().describe("Limit price for stop-limit leg"),
            stopIcebergQty: z.number().positive().optional().describe("Iceberg qty for stop leg"),
            stopLimitTimeInForce: timeInForceEnum.optional().describe("Time in force for stop-limit leg"),
            asset: z.string().optional().describe("Asset for ExpressTrade"),
            allowExpressTrade: z.boolean().optional().default(false).describe("Enable ExpressTrade")
        },
        async (params) => {
            try {
                const response = await makeSignedRequest("POST", "/sapi/v1/custodian/ocoOrder", {
                    rail: params.rail.toUpperCase(),
                    symbol: params.symbol.toUpperCase(),
                    side: params.side,
                    quantity: params.quantity,
                    price: params.price,
                    stopPrice: params.stopPrice,
                    ...(params.limitClientOrderId && { limitClientOrderId: params.limitClientOrderId }),
                    ...(params.limitIcebergQty && { limitIcebergQty: params.limitIcebergQty }),
                    ...(params.stopClientOrderId && { stopClientOrderId: params.stopClientOrderId }),
                    ...(params.stopLimitPrice && { stopLimitPrice: params.stopLimitPrice }),
                    ...(params.stopIcebergQty && { stopIcebergQty: params.stopIcebergQty }),
                    ...(params.stopLimitTimeInForce && { stopLimitTimeInForce: params.stopLimitTimeInForce }),
                    ...(params.asset && { asset: params.asset.toUpperCase() }),
                    ...(params.allowExpressTrade !== undefined && { allowExpressTrade: params.allowExpressTrade })
                });

                return {
                    content: [{
                        type: "text",
                        text: `Custodial OCO order placed. Order List ID: ${response.orderListId}, Status: ${response.listOrderStatus}. Response: ${JSON.stringify(response, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to place custodial OCO order: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );

    // =====================================================================
    // GET /sapi/v1/custodian/openOrders - Get Open Orders
    // =====================================================================
    server.tool(
        "binance_us_cust_open_orders",
        `Get all open custodial trade orders.

⚠️ REQUIRES CUSTODIAL SOLUTION API KEY

⚠️ Do not call without a symbol parameter as it returns all pairs and can be slow.

Response is an array of open orders with: symbol, orderId, price, origQty,
executedQty, status, type, side, stopPrice, time, updateTime, isWorking,
expressTradeFlag`,
        {
            rail: railSchema,
            symbol: z.string().optional().describe("Trading pair (e.g., BTCUSD). Recommended to always specify.")
        },
        async (params) => {
            try {
                const response = await makeSignedRequest("GET", "/sapi/v1/custodian/openOrders", {
                    rail: params.rail.toUpperCase(),
                    ...(params.symbol && { symbol: params.symbol.toUpperCase() })
                });

                return {
                    content: [{
                        type: "text",
                        text: `Retrieved ${Array.isArray(response) ? response.length : 0} open orders. Response: ${JSON.stringify(response, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get open orders: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );

    // =====================================================================
    // GET /sapi/v1/custodian/order - Get Order
    // =====================================================================
    server.tool(
        "binance_us_cust_get_order",
        `Get details of a specific custodial trade order.

⚠️ REQUIRES CUSTODIAL SOLUTION API KEY

Response includes: symbol, orderId, price, origQty, executedQty, 
cummulativeQuoteQty, status, timeInForce, type, side, stopPrice, 
icebergQty, time, updateTime, isWorking, expressTradeFlag`,
        {
            rail: railSchema,
            symbol: z.string().describe("Trading pair (e.g., BTCUSD)"),
            orderId: z.number().int().describe("Order ID to query")
        },
        async (params) => {
            try {
                const response = await makeSignedRequest("GET", "/sapi/v1/custodian/order", {
                    rail: params.rail.toUpperCase(),
                    symbol: params.symbol.toUpperCase(),
                    orderId: params.orderId
                });

                return {
                    content: [{
                        type: "text",
                        text: `Order retrieved. Status: ${response.status}. Response: ${JSON.stringify(response, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get order: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );

    // =====================================================================
    // GET /sapi/v1/custodian/orderHistory - Get Order History
    // =====================================================================
    server.tool(
        "binance_us_cust_order_history",
        `Get historical custodial trade orders.

⚠️ REQUIRES CUSTODIAL SOLUTION API KEY

If symbol is not sent, orders for all symbols will be returned.

Response is an array of orders with full details including status, 
executedQty, and expressTradeFlag.`,
        {
            rail: railSchema,
            symbol: z.string().optional().describe("Trading pair (e.g., BTCUSD). If omitted, returns all symbols."),
            startTime: z.number().optional().describe("Start timestamp in milliseconds"),
            endTime: z.number().optional().describe("End timestamp in milliseconds"),
            fromId: z.number().int().optional().describe("Start from this order ID"),
            limit: z.number().int().min(1).max(1000).optional().default(200).describe("Max records (default: 200)")
        },
        async (params) => {
            try {
                const response = await makeSignedRequest("GET", "/sapi/v1/custodian/orderHistory", {
                    rail: params.rail.toUpperCase(),
                    ...(params.symbol && { symbol: params.symbol.toUpperCase() }),
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.fromId && { fromId: params.fromId }),
                    ...(params.limit && { limit: params.limit })
                });

                return {
                    content: [{
                        type: "text",
                        text: `Retrieved ${Array.isArray(response) ? response.length : 0} historical orders. Response: ${JSON.stringify(response, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get order history: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );

    // =====================================================================
    // GET /sapi/v1/custodian/tradeHistory - Get Trade History
    // =====================================================================
    server.tool(
        "binance_us_cust_trade_history",
        `Get historical custodial trades (filled orders).

⚠️ REQUIRES CUSTODIAL SOLUTION API KEY

Returns actual executed trades with price, quantity, and commission details.

Response includes for each trade: symbol, price, qty, quoteQty, time,
isBuyer, isMaker, isBestMatch, orderId, commission, commissionAsset`,
        {
            rail: railSchema,
            symbol: z.string().optional().describe("Trading pair (e.g., BTCUSD)"),
            orderId: z.number().int().optional().describe("Filter by order ID"),
            startTime: z.number().optional().describe("Start timestamp"),
            endTime: z.number().optional().describe("End timestamp"),
            fromId: z.number().int().optional().describe("Start from this trade ID"),
            limit: z.number().int().min(1).max(1000).optional().default(200).describe("Max records (default: 200)")
        },
        async (params) => {
            try {
                const response = await makeSignedRequest("GET", "/sapi/v1/custodian/tradeHistory", {
                    rail: params.rail.toUpperCase(),
                    ...(params.symbol && { symbol: params.symbol.toUpperCase() }),
                    ...(params.orderId && { orderId: params.orderId }),
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.fromId && { fromId: params.fromId }),
                    ...(params.limit && { limit: params.limit })
                });

                return {
                    content: [{
                        type: "text",
                        text: `Retrieved ${Array.isArray(response) ? response.length : 0} trades. Response: ${JSON.stringify(response, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get trade history: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );

    // =====================================================================
    // DELETE /sapi/v1/custodian/cancelOrder - Cancel Order
    // =====================================================================
    server.tool(
        "binance_us_cust_cancel_order",
        `Cancel an active custodial trade order.

⚠️ REQUIRES CUSTODIAL SOLUTION API KEY

Either orderId or origClientOrderId must be provided.

Response includes the canceled order details with status: CANCELED`,
        {
            rail: railSchema,
            symbol: z.string().describe("Trading pair (e.g., BTCUSD)"),
            orderId: z.number().int().optional().describe("Order ID to cancel"),
            origClientOrderId: z.string().optional().describe("Original client order ID to cancel"),
            newClientOrderId: z.string().optional().describe("New client order ID for this cancel operation")
        },
        async (params) => {
            try {
                if (!params.orderId && !params.origClientOrderId) {
                    throw new Error("Either orderId or origClientOrderId must be provided");
                }

                const response = await makeSignedRequest("DELETE", "/sapi/v1/custodian/cancelOrder", {
                    rail: params.rail.toUpperCase(),
                    symbol: params.symbol.toUpperCase(),
                    ...(params.orderId && { orderId: params.orderId }),
                    ...(params.origClientOrderId && { origClientOrderId: params.origClientOrderId }),
                    ...(params.newClientOrderId && { newClientOrderId: params.newClientOrderId })
                });

                return {
                    content: [{
                        type: "text",
                        text: `Order canceled. Order ID: ${response.orderId}, Status: ${response.status}. Response: ${JSON.stringify(response, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to cancel order: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );

    // =====================================================================
    // DELETE /sapi/v1/custodian/cancelOrdersBySymbol - Cancel All Orders for Symbol
    // =====================================================================
    server.tool(
        "binance_us_cust_cancel_orders_symbol",
        `Cancel all active custodial orders for a specific trading pair.

⚠️ REQUIRES CUSTODIAL SOLUTION API KEY

This includes OCO orders. Use with caution.

Response is an array of all canceled orders.`,
        {
            rail: railSchema,
            symbol: z.string().describe("Trading pair to cancel all orders for (e.g., BTCUSD)")
        },
        async (params) => {
            try {
                const response = await makeSignedRequest("DELETE", "/sapi/v1/custodian/cancelOrdersBySymbol", {
                    rail: params.rail.toUpperCase(),
                    symbol: params.symbol.toUpperCase()
                });

                return {
                    content: [{
                        type: "text",
                        text: `All orders canceled for ${params.symbol}. Canceled ${Array.isArray(response) ? response.length : 0} orders. Response: ${JSON.stringify(response, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to cancel orders: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );

    // =====================================================================
    // DELETE /sapi/v1/custodian/cancelOcoOrder - Cancel OCO Order
    // =====================================================================
    server.tool(
        "binance_us_cust_cancel_oco",
        `Cancel an entire OCO (One-Cancels-the-Other) order list.

⚠️ REQUIRES CUSTODIAL SOLUTION API KEY

This cancels both legs of the OCO order.

Response includes orderListId, orders array, and orderReports with 
canceled order details.`,
        {
            rail: railSchema,
            symbol: z.string().describe("Trading pair (e.g., BTCUSD)"),
            orderListId: z.number().int().describe("OCO order list ID to cancel"),
            listClientOrderId: z.string().optional().describe("List client order ID"),
            newClientOrderId: z.string().optional().describe("New client order ID for cancel operation")
        },
        async (params) => {
            try {
                const response = await makeSignedRequest("DELETE", "/sapi/v1/custodian/cancelOcoOrder", {
                    rail: params.rail.toUpperCase(),
                    symbol: params.symbol.toUpperCase(),
                    orderListId: params.orderListId,
                    ...(params.listClientOrderId && { listClientOrderId: params.listClientOrderId }),
                    ...(params.newClientOrderId && { newClientOrderId: params.newClientOrderId })
                });

                return {
                    content: [{
                        type: "text",
                        text: `OCO order canceled. List ID: ${response.orderListId}, Status: ${response.listOrderStatus}. Response: ${JSON.stringify(response, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to cancel OCO order: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );

    // =====================================================================
    // GET /sapi/v1/custodian/settlementSetting - Get Settlement Settings
    // =====================================================================
    server.tool(
        "binance_us_cust_settlement_settings",
        `Get current settlement settings for custodial solution.

⚠️ REQUIRES CUSTODIAL SOLUTION API KEY

Shows automatic settlement configuration and schedule.

Response includes:
- settlementActive: Whether auto-settlement is enabled
- frequencyInHours: Settlement frequency (e.g., 24 hours)
- nextTriggerTime: Timestamp of next scheduled settlement`,
        {
            rail: railSchema
        },
        async (params) => {
            try {
                const response = await makeSignedRequest("GET", "/sapi/v1/custodian/settlementSetting", {
                    rail: params.rail.toUpperCase()
                });

                return {
                    content: [{
                        type: "text",
                        text: `Settlement settings retrieved. Active: ${response.settlementActive}, Next: ${new Date(response.nextTriggerTime).toISOString()}. Response: ${JSON.stringify(response, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get settlement settings: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );

    // =====================================================================
    // GET /sapi/v1/custodian/settlementHistory - Get Settlement History
    // =====================================================================
    server.tool(
        "binance_us_cust_settlement_history",
        `Get historical settlement records for custodial solution.

⚠️ REQUIRES CUSTODIAL SOLUTION API KEY

Shows past automatic settlements to custodial partner.

Response includes:
- records: Array of settlement records
- total: Total number of settlements

Each record contains:
- status: PROCESS, SUCCESS, or FAILURE
- triggerTime: When settlement was triggered
- settlementId: Unique settlement identifier
- settlementAssets: Array of assets settled with amounts and addresses`,
        {
            rail: railSchema,
            startTime: z.number().optional().describe("Start timestamp"),
            endTime: z.number().optional().describe("End timestamp"),
            limit: z.number().int().min(1).max(100).optional().default(5).describe("Max records (default: 5, max: 100)"),
            page: z.number().int().positive().optional().default(1).describe("Page number (default: 1)")
        },
        async (params) => {
            try {
                const response = await makeSignedRequest("GET", "/sapi/v1/custodian/settlementHistory", {
                    rail: params.rail.toUpperCase(),
                    ...(params.startTime && { startTime: params.startTime }),
                    ...(params.endTime && { endTime: params.endTime }),
                    ...(params.limit && { limit: params.limit }),
                    ...(params.page && { page: params.page })
                });

                return {
                    content: [{
                        type: "text",
                        text: `Retrieved ${response.total} settlement records. Response: ${JSON.stringify(response, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get settlement history: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
