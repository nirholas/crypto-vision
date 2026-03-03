/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/trade/orders.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { makeSignedRequest, hasApiCredentials, BINANCE_US_CONFIG } from "../../config/binanceUsClient.js";

// Common Binance error codes for better error messages
const BINANCE_ERROR_CODES: Record<number, string> = {
    [-1000]: "Unknown error occurred",
    [-1001]: "Disconnected - internal error",
    [-1002]: "Unauthorized - check API key permissions",
    [-1003]: "Too many requests - rate limit exceeded",
    [-1006]: "Unexpected response - try again",
    [-1007]: "Timeout waiting for response",
    [-1013]: "Invalid quantity - check LOT_SIZE filter",
    [-1014]: "Unknown order composition",
    [-1015]: "Too many orders - rate limit exceeded",
    [-1016]: "Service shutting down",
    [-1020]: "Unsupported operation",
    [-1021]: "Invalid timestamp - check recvWindow",
    [-1022]: "Invalid signature",
    [-1100]: "Illegal characters in parameter",
    [-1101]: "Too many parameters sent",
    [-1102]: "Mandatory parameter missing",
    [-1103]: "Unknown parameter sent",
    [-1104]: "Not all parameters read",
    [-1105]: "Parameter is empty",
    [-1106]: "Parameter not required",
    [-1111]: "Precision over maximum for asset",
    [-1112]: "No orders on book for symbol",
    [-1114]: "TimeInForce parameter not required",
    [-1115]: "Invalid timeInForce value",
    [-1116]: "Invalid orderType value",
    [-1117]: "Invalid side value",
    [-1118]: "New client order ID is empty",
    [-1119]: "Original client order ID is empty",
    [-1120]: "Invalid interval value",
    [-1121]: "Invalid symbol",
    [-1125]: "Invalid listen key",
    [-1127]: "Listen key lookup interval too big",
    [-1128]: "Invalid optional parameter combination",
    [-1130]: "Invalid data sent for parameter",
    [-2010]: "New order rejected",
    [-2011]: "Cancel rejected - check order status",
    [-2013]: "Order does not exist",
    [-2014]: "API key format invalid",
    [-2015]: "Rejected - invalid API key, IP, or permissions",
    [-2016]: "No trading window could be found",
    [-2018]: "Balance is insufficient",
    [-2019]: "Margin is insufficient",
    [-2020]: "Unable to fill order",
    [-2021]: "Order would immediately trigger stop price",
    [-2022]: "ReduceOnly rejected - position already reduced",
    [-2024]: "Position does not exist",
    [-2026]: "Order would immediately match and trade"
};

/**
 * Get human-readable error message for Binance error code
 */
function getBinanceErrorMessage(code: number): string {
    return BINANCE_ERROR_CODES[code] || `Unknown error code: ${code}`;
}

/**
 * Check API credentials before making requests
 */
function checkCredentials(): string | null {
    if (!hasApiCredentials()) {
        return "❌ API credentials not configured. Please set BINANCE_US_API_KEY and BINANCE_US_API_SECRET environment variables.";
    }
    return null;
}

/**
 * Validate recvWindow parameter
 */
function validateRecvWindow(recvWindow?: number): string | null {
    if (recvWindow !== undefined && recvWindow > BINANCE_US_CONFIG.MAX_RECV_WINDOW) {
        return `❌ recvWindow cannot exceed ${BINANCE_US_CONFIG.MAX_RECV_WINDOW}ms (60 seconds).`;
    }
    return null;
}

/**
 * Validate symbol format (basic check)
 */
function validateSymbol(symbol: string): string | null {
    if (!symbol || symbol.length < 2 || symbol.length > 20) {
        return "❌ Invalid symbol format. Symbol should be 2-20 characters (e.g., BTCUSD, ETHUSD).";
    }
    if (!/^[A-Z0-9]+$/.test(symbol.toUpperCase())) {
        return "❌ Invalid symbol format. Symbol should contain only letters and numbers.";
    }
    return null;
}

// Order type enum
const OrderType = z.enum([
    "LIMIT",
    "MARKET", 
    "STOP_LOSS",
    "STOP_LOSS_LIMIT",
    "TAKE_PROFIT",
    "TAKE_PROFIT_LIMIT",
    "LIMIT_MAKER"
]);

// Time in force enum
const TimeInForce = z.enum(["GTC", "IOC", "FOK"]);

// Order side enum
const OrderSide = z.enum(["BUY", "SELL"]);

// Response type enum
const OrderRespType = z.enum(["ACK", "RESULT", "FULL"]);

// Self trade prevention mode enum
const SelfTradePreventionMode = z.enum(["EXPIRE_TAKER", "EXPIRE_MAKER", "EXPIRE_BOTH", "NONE"]);

// Cancel replace mode enum
const CancelReplaceMode = z.enum(["STOP_ON_FAILURE", "ALLOW_FAILURE"]);

// Cancel restrictions enum
const CancelRestrictions = z.enum(["ONLY_NEW", "ONLY_PARTIALLY_FILLED"]);

/**
 * Register new order tool
 */
export function registerBinanceUsNewOrder(server: McpServer) {
    server.tool(
        "binance_us_new_order",
        "Place a new trade order on Binance.US. Supports LIMIT, MARKET, STOP_LOSS, STOP_LOSS_LIMIT, TAKE_PROFIT, TAKE_PROFIT_LIMIT, and LIMIT_MAKER order types.",
        {
            symbol: z.string().describe("Trading pair symbol (e.g., BTCUSD, ETHUSD)"),
            side: OrderSide.describe("Order side: BUY or SELL"),
            type: OrderType.describe("Order type: LIMIT, MARKET, STOP_LOSS, STOP_LOSS_LIMIT, TAKE_PROFIT, TAKE_PROFIT_LIMIT, LIMIT_MAKER"),
            timeInForce: TimeInForce.optional().describe("Time in force: GTC (Good Till Cancel), IOC (Immediate Or Cancel), FOK (Fill Or Kill). Required for LIMIT orders."),
            quantity: z.number().optional().describe("Order quantity in base asset. Required for most order types."),
            quoteOrderQty: z.number().optional().describe("Order quantity in quote asset. Can be used for MARKET orders instead of quantity."),
            price: z.number().optional().describe("Order price. Required for LIMIT and LIMIT_MAKER orders."),
            newClientOrderId: z.string().optional().describe("Unique client order ID. Auto-generated if not provided."),
            stopPrice: z.number().optional().describe("Stop price. Required for STOP_LOSS_LIMIT and TAKE_PROFIT_LIMIT orders."),
            trailingDelta: z.number().optional().describe("Trailing delta for trailing stop orders in BIPS (1 BIP = 0.01%)."),
            icebergQty: z.number().optional().describe("Iceberg quantity for iceberg orders. timeInForce must be GTC."),
            newOrderRespType: OrderRespType.optional().describe("Response type: ACK, RESULT, or FULL. MARKET/LIMIT default to FULL, others to ACK."),
            selfTradePreventionMode: SelfTradePreventionMode.optional().describe("Self-trade prevention mode: EXPIRE_TAKER, EXPIRE_MAKER, EXPIRE_BOTH, NONE."),
            recvWindow: z.number().optional().describe("Receive window in milliseconds (max 60000).")
        },
        async (params) => {
            try {
                // Check API credentials first
                const credError = checkCredentials();
                if (credError) return { content: [{ type: "text", text: credError }], isError: true };

                // Validate symbol
                const symbolError = validateSymbol(params.symbol);
                if (symbolError) return { content: [{ type: "text", text: symbolError }], isError: true };

                // Validate recvWindow
                const recvWindowError = validateRecvWindow(params.recvWindow);
                if (recvWindowError) return { content: [{ type: "text", text: recvWindowError }], isError: true };

                // Validate order type requirements
                const validationError = validateOrderParams(params);
                if (validationError) {
                    return {
                        content: [{ type: "text", text: validationError }],
                        isError: true
                    };
                }

                const response = await makeSignedRequest("POST", "/api/v3/order", params);

                return {
                    content: [{
                        type: "text",
                        text: `✅ Order placed successfully!\n\n` +
                              `Order ID: ${response.orderId}\n` +
                              `Symbol: ${response.symbol}\n` +
                              `Side: ${response.side}\n` +
                              `Type: ${response.type}\n` +
                              `Status: ${response.status || 'PENDING'}\n` +
                              (response.price ? `Price: ${response.price}\n` : '') +
                              (response.origQty ? `Quantity: ${response.origQty}\n` : '') +
                              (response.executedQty ? `Executed: ${response.executedQty}\n` : '') +
                              `\nFull Response: ${JSON.stringify(response, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                // Try to extract Binance error code for better messaging
                const codeMatch = errorMessage.match(/code:\s*(-?\d+)/);
                const additionalHelp = codeMatch && codeMatch[1] ? `\n\nHint: ${getBinanceErrorMessage(parseInt(codeMatch[1]))}` : '';
                return {
                    content: [{ type: "text", text: `❌ Failed to place order: ${errorMessage}${additionalHelp}` }],
                    isError: true
                };
            }
        }
    );
}

/**
 * Register test order tool
 */
export function registerBinanceUsTestOrder(server: McpServer) {
    server.tool(
        "binance_us_test_order",
        "Test a new order on Binance.US without actually placing it. Validates order parameters and signature without executing the trade.",
        {
            symbol: z.string().describe("Trading pair symbol (e.g., BTCUSD, ETHUSD)"),
            side: OrderSide.describe("Order side: BUY or SELL"),
            type: OrderType.describe("Order type: LIMIT, MARKET, STOP_LOSS, STOP_LOSS_LIMIT, TAKE_PROFIT, TAKE_PROFIT_LIMIT, LIMIT_MAKER"),
            timeInForce: TimeInForce.optional().describe("Time in force: GTC, IOC, or FOK"),
            quantity: z.number().optional().describe("Order quantity in base asset"),
            quoteOrderQty: z.number().optional().describe("Order quantity in quote asset (for MARKET orders)"),
            price: z.number().optional().describe("Order price"),
            newClientOrderId: z.string().optional().describe("Unique client order ID"),
            stopPrice: z.number().optional().describe("Stop price for stop orders"),
            trailingDelta: z.number().optional().describe("Trailing delta in BIPS"),
            icebergQty: z.number().optional().describe("Iceberg quantity"),
            newOrderRespType: OrderRespType.optional().describe("Response type"),
            selfTradePreventionMode: SelfTradePreventionMode.optional().describe("Self-trade prevention mode"),
            recvWindow: z.number().optional().describe("Receive window in milliseconds (max 60000)")
        },
        async (params) => {
            try {
                // Check API credentials first
                const credError = checkCredentials();
                if (credError) return { content: [{ type: "text", text: credError }], isError: true };

                // Validate symbol and recvWindow
                const symbolError = validateSymbol(params.symbol);
                if (symbolError) return { content: [{ type: "text", text: symbolError }], isError: true };
                const recvWindowError = validateRecvWindow(params.recvWindow);
                if (recvWindowError) return { content: [{ type: "text", text: recvWindowError }], isError: true };

                const validationError = validateOrderParams(params);
                if (validationError) {
                    return {
                        content: [{ type: "text", text: validationError }],
                        isError: true
                    };
                }

                await makeSignedRequest("POST", "/api/v3/order/test", params);

                return {
                    content: [{
                        type: "text",
                        text: `✅ Test order validated successfully!\n\n` +
                              `Symbol: ${params.symbol}\n` +
                              `Side: ${params.side}\n` +
                              `Type: ${params.type}\n` +
                              (params.quantity ? `Quantity: ${params.quantity}\n` : '') +
                              (params.price ? `Price: ${params.price}\n` : '') +
                              `\nThe order parameters are valid and can be submitted.`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                const codeMatch = errorMessage.match(/code:\s*(-?\d+)/);
                const additionalHelp = codeMatch && codeMatch[1] ? `\n\nHint: ${getBinanceErrorMessage(parseInt(codeMatch[1]))}` : '';
                return {
                    content: [{ type: "text", text: `❌ Test order validation failed: ${errorMessage}${additionalHelp}` }],
                    isError: true
                };
            }
        }
    );
}

/**
 * Register get order tool
 */
export function registerBinanceUsGetOrder(server: McpServer) {
    server.tool(
        "binance_us_get_order",
        "Query the status of a specific order on Binance.US. Either orderId or origClientOrderId must be provided.",
        {
            symbol: z.string().describe("Trading pair symbol (e.g., BTCUSD)"),
            orderId: z.number().optional().describe("The order ID to query"),
            origClientOrderId: z.string().optional().describe("The original client order ID to query"),
            recvWindow: z.number().optional().describe("Receive window in milliseconds (max 60000)")
        },
        async (params) => {
            try {
                // Check API credentials first
                const credError = checkCredentials();
                if (credError) return { content: [{ type: "text", text: credError }], isError: true };

                // Validate symbol and recvWindow
                const symbolError = validateSymbol(params.symbol);
                if (symbolError) return { content: [{ type: "text", text: symbolError }], isError: true };
                const recvWindowError = validateRecvWindow(params.recvWindow);
                if (recvWindowError) return { content: [{ type: "text", text: recvWindowError }], isError: true };

                if (!params.orderId && !params.origClientOrderId) {
                    return {
                        content: [{ type: "text", text: "❌ Either orderId or origClientOrderId must be provided." }],
                        isError: true
                    };
                }

                const response = await makeSignedRequest("GET", "/api/v3/order", params);

                return {
                    content: [{
                        type: "text",
                        text: `📋 Order Status\n\n` +
                              `Order ID: ${response.orderId}\n` +
                              `Symbol: ${response.symbol}\n` +
                              `Status: ${response.status}\n` +
                              `Side: ${response.side}\n` +
                              `Type: ${response.type}\n` +
                              `Price: ${response.price}\n` +
                              `Original Qty: ${response.origQty}\n` +
                              `Executed Qty: ${response.executedQty}\n` +
                              `Time In Force: ${response.timeInForce}\n` +
                              (response.stopPrice !== "0.00000000" ? `Stop Price: ${response.stopPrice}\n` : '') +
                              `Created: ${new Date(response.time).toISOString()}\n` +
                              `Updated: ${new Date(response.updateTime).toISOString()}\n` +
                              `\nFull Response: ${JSON.stringify(response, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                const codeMatch = errorMessage.match(/code:\s*(-?\d+)/);
                const additionalHelp = codeMatch && codeMatch[1] ? `\n\nHint: ${getBinanceErrorMessage(parseInt(codeMatch[1]))}` : '';
                return {
                    content: [{ type: "text", text: `❌ Failed to get order: ${errorMessage}${additionalHelp}` }],
                    isError: true
                };
            }
        }
    );
}

/**
 * Register cancel order tool
 */
export function registerBinanceUsCancelOrder(server: McpServer) {
    server.tool(
        "binance_us_cancel_order",
        "Cancel an active order on Binance.US. Either orderId or origClientOrderId must be provided.",
        {
            symbol: z.string().describe("Trading pair symbol (e.g., BTCUSD)"),
            orderId: z.number().optional().describe("The order ID to cancel"),
            origClientOrderId: z.string().optional().describe("The original client order ID to cancel"),
            newClientOrderId: z.string().optional().describe("New client order ID for this cancel request"),
            cancelRestrictions: CancelRestrictions.optional().describe("Cancel restrictions: ONLY_NEW or ONLY_PARTIALLY_FILLED"),
            recvWindow: z.number().optional().describe("Receive window in milliseconds (max 60000)")
        },
        async (params) => {
            try {
                // Check API credentials first
                const credError = checkCredentials();
                if (credError) return { content: [{ type: "text", text: credError }], isError: true };

                // Validate symbol and recvWindow
                const symbolError = validateSymbol(params.symbol);
                if (symbolError) return { content: [{ type: "text", text: symbolError }], isError: true };
                const recvWindowError = validateRecvWindow(params.recvWindow);
                if (recvWindowError) return { content: [{ type: "text", text: recvWindowError }], isError: true };

                if (!params.orderId && !params.origClientOrderId) {
                    return {
                        content: [{ type: "text", text: "❌ Either orderId or origClientOrderId must be provided." }],
                        isError: true
                    };
                }

                const response = await makeSignedRequest("DELETE", "/api/v3/order", params);

                return {
                    content: [{
                        type: "text",
                        text: `✅ Order cancelled successfully!\n\n` +
                              `Order ID: ${response.orderId}\n` +
                              `Symbol: ${response.symbol}\n` +
                              `Status: ${response.status}\n` +
                              `Side: ${response.side}\n` +
                              `Type: ${response.type}\n` +
                              `Price: ${response.price}\n` +
                              `Original Qty: ${response.origQty}\n` +
                              `Executed Qty: ${response.executedQty}\n` +
                              `\nFull Response: ${JSON.stringify(response, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                const codeMatch = errorMessage.match(/code:\s*(-?\d+)/);
                const additionalHelp = codeMatch && codeMatch[1] ? `\n\nHint: ${getBinanceErrorMessage(parseInt(codeMatch[1]))}` : '';
                return {
                    content: [{ type: "text", text: `❌ Failed to cancel order: ${errorMessage}${additionalHelp}` }],
                    isError: true
                };
            }
        }
    );
}

/**
 * Register cancel and replace order tool
 */
export function registerBinanceUsCancelReplace(server: McpServer) {
    server.tool(
        "binance_us_cancel_replace",
        "Cancel an existing order and place a new order on the same symbol atomically. This is useful for modifying order parameters.",
        {
            symbol: z.string().describe("Trading pair symbol (e.g., BTCUSD)"),
            side: OrderSide.describe("Order side: BUY or SELL"),
            type: OrderType.describe("Order type for the new order"),
            cancelReplaceMode: CancelReplaceMode.describe("STOP_ON_FAILURE: Don't place new order if cancel fails. ALLOW_FAILURE: Place new order even if cancel fails."),
            cancelOrderId: z.number().optional().describe("Order ID to cancel. Either this or cancelOrigClientOrderId required."),
            cancelOrigClientOrderId: z.string().optional().describe("Client order ID to cancel. Either this or cancelOrderId required."),
            timeInForce: TimeInForce.optional().describe("Time in force for new order"),
            quantity: z.number().optional().describe("Quantity for new order"),
            quoteOrderQty: z.number().optional().describe("Quote order quantity for new order"),
            price: z.number().optional().describe("Price for new order"),
            cancelNewClientOrderId: z.string().optional().describe("Client order ID for the cancel"),
            newClientOrderId: z.string().optional().describe("Client order ID for the new order"),
            stopPrice: z.number().optional().describe("Stop price for new order"),
            trailingDelta: z.number().optional().describe("Trailing delta for new order"),
            icebergQty: z.number().optional().describe("Iceberg quantity for new order"),
            newOrderRespType: OrderRespType.optional().describe("Response type for new order"),
            selfTradePreventionMode: SelfTradePreventionMode.optional().describe("Self-trade prevention mode"),
            cancelRestrictions: CancelRestrictions.optional().describe("Cancel restrictions"),
            recvWindow: z.number().optional().describe("Receive window in milliseconds (max 60000)")
        },
        async (params) => {
            try {
                // Check API credentials first
                const credError = checkCredentials();
                if (credError) return { content: [{ type: "text", text: credError }], isError: true };

                // Validate symbol and recvWindow
                const symbolError = validateSymbol(params.symbol);
                if (symbolError) return { content: [{ type: "text", text: symbolError }], isError: true };
                const recvWindowError = validateRecvWindow(params.recvWindow);
                if (recvWindowError) return { content: [{ type: "text", text: recvWindowError }], isError: true };

                if (!params.cancelOrderId && !params.cancelOrigClientOrderId) {
                    return {
                        content: [{ type: "text", text: "❌ Either cancelOrderId or cancelOrigClientOrderId must be provided." }],
                        isError: true
                    };
                }

                const response = await makeSignedRequest("POST", "/api/v3/order/cancelReplace", params);

                return {
                    content: [{
                        type: "text",
                        text: `✅ Cancel and Replace completed!\n\n` +
                              `Cancel Result: ${response.cancelResult}\n` +
                              `New Order Result: ${response.newOrderResult}\n` +
                              `\n--- Cancelled Order ---\n` +
                              (response.cancelResponse ? 
                                  `Order ID: ${response.cancelResponse.orderId}\n` +
                                  `Status: ${response.cancelResponse.status}\n` : 
                                  'N/A\n') +
                              `\n--- New Order ---\n` +
                              (response.newOrderResponse ?
                                  `Order ID: ${response.newOrderResponse.orderId}\n` +
                                  `Status: ${response.newOrderResponse.status}\n` +
                                  `Price: ${response.newOrderResponse.price}\n` +
                                  `Quantity: ${response.newOrderResponse.origQty}\n` :
                                  'N/A\n') +
                              `\nFull Response: ${JSON.stringify(response, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                const codeMatch = errorMessage.match(/code:\s*(-?\d+)/);
                const additionalHelp = codeMatch && codeMatch[1] ? `\n\nHint: ${getBinanceErrorMessage(parseInt(codeMatch[1]))}` : '';
                return {
                    content: [{ type: "text", text: `❌ Failed to cancel and replace order: ${errorMessage}${additionalHelp}` }],
                    isError: true
                };
            }
        }
    );
}

/**
 * Register open orders tool
 */
export function registerBinanceUsOpenOrders(server: McpServer) {
    server.tool(
        "binance_us_open_orders",
        "Get all open orders on Binance.US. Can be filtered by symbol. Warning: Querying without symbol is heavier on rate limits (weight 40 vs 3).",
        {
            symbol: z.string().optional().describe("Trading pair symbol to filter by (e.g., BTCUSD). If omitted, returns all open orders."),
            recvWindow: z.number().optional().describe("Receive window in milliseconds (max 60000)")
        },
        async (params) => {
            try {
                // Check API credentials first
                const credError = checkCredentials();
                if (credError) return { content: [{ type: "text", text: credError }], isError: true };

                // Validate optional symbol and recvWindow
                if (params.symbol) {
                    const symbolError = validateSymbol(params.symbol);
                    if (symbolError) return { content: [{ type: "text", text: symbolError }], isError: true };
                }
                const recvWindowError = validateRecvWindow(params.recvWindow);
                if (recvWindowError) return { content: [{ type: "text", text: recvWindowError }], isError: true };

                const response = await makeSignedRequest("GET", "/api/v3/openOrders", params);

                if (!response || response.length === 0) {
                    return {
                        content: [{
                            type: "text",
                            text: params.symbol 
                                ? `📋 No open orders found for ${params.symbol}`
                                : `📋 No open orders found`
                        }]
                    };
                }

                const orderList = response.map((order: any) => 
                    `• ${order.symbol} | ${order.side} ${order.type} | ` +
                    `Qty: ${order.origQty} @ ${order.price} | ` +
                    `Status: ${order.status} | ID: ${order.orderId}`
                ).join('\n');

                return {
                    content: [{
                        type: "text",
                        text: `📋 Open Orders${params.symbol ? ` for ${params.symbol}` : ''}\n` +
                              `Total: ${response.length}\n\n` +
                              `${orderList}\n\n` +
                              `Full Response: ${JSON.stringify(response, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                const codeMatch = errorMessage.match(/code:\s*(-?\d+)/);
                const additionalHelp = codeMatch && codeMatch[1] ? `\n\nHint: ${getBinanceErrorMessage(parseInt(codeMatch[1]))}` : '';
                return {
                    content: [{ type: "text", text: `❌ Failed to get open orders: ${errorMessage}${additionalHelp}` }],
                    isError: true
                };
            }
        }
    );
}

/**
 * Register all orders history tool
 */
export function registerBinanceUsAllOrders(server: McpServer) {
    server.tool(
        "binance_us_all_orders",
        "Get all orders (active, canceled, or filled) for a symbol on Binance.US. Returns order history.",
        {
            symbol: z.string().describe("Trading pair symbol (e.g., BTCUSD)"),
            orderId: z.number().optional().describe("Order ID to start from. Gets orders >= this orderId."),
            startTime: z.number().optional().describe("Start time in milliseconds"),
            endTime: z.number().optional().describe("End time in milliseconds"),
            limit: z.number().optional().describe("Number of orders to return (default 500, max 1000)"),
            recvWindow: z.number().optional().describe("Receive window in milliseconds (max 60000)")
        },
        async (params) => {
            try {
                // Check API credentials first
                const credError = checkCredentials();
                if (credError) return { content: [{ type: "text", text: credError }], isError: true };

                // Validate symbol and recvWindow
                const symbolError = validateSymbol(params.symbol);
                if (symbolError) return { content: [{ type: "text", text: symbolError }], isError: true };
                const recvWindowError = validateRecvWindow(params.recvWindow);
                if (recvWindowError) return { content: [{ type: "text", text: recvWindowError }], isError: true };

                // Validate limit
                if (params.limit !== undefined && (params.limit < 1 || params.limit > 1000)) {
                    return {
                        content: [{ type: "text", text: "❌ limit must be between 1 and 1000." }],
                        isError: true
                    };
                }

                const response = await makeSignedRequest("GET", "/api/v3/allOrders", params);

                if (!response || response.length === 0) {
                    return {
                        content: [{
                            type: "text",
                            text: `📋 No orders found for ${params.symbol}`
                        }]
                    };
                }

                const orderList = response.slice(0, 10).map((order: any) => 
                    `• ${order.side} ${order.type} | Qty: ${order.origQty} @ ${order.price} | ` +
                    `Status: ${order.status} | ID: ${order.orderId} | ${new Date(order.time).toISOString()}`
                ).join('\n');

                return {
                    content: [{
                        type: "text",
                        text: `📋 Order History for ${params.symbol}\n` +
                              `Total Retrieved: ${response.length}\n\n` +
                              `Recent Orders (showing up to 10):\n${orderList}\n\n` +
                              `Full Response: ${JSON.stringify(response, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                const codeMatch = errorMessage.match(/code:\s*(-?\d+)/);
                const additionalHelp = codeMatch && codeMatch[1] ? `\n\nHint: ${getBinanceErrorMessage(parseInt(codeMatch[1]))}` : '';
                return {
                    content: [{ type: "text", text: `❌ Failed to get order history: ${errorMessage}${additionalHelp}` }],
                    isError: true
                };
            }
        }
    );
}

/**
 * Validate order parameters based on order type
 */
function validateOrderParams(params: any): string | null {
    const { type, timeInForce, quantity, quoteOrderQty, price, stopPrice, trailingDelta, icebergQty } = params;

    switch (type) {
        case "LIMIT":
            if (!timeInForce) return "❌ LIMIT orders require timeInForce parameter.";
            if (!quantity) return "❌ LIMIT orders require quantity parameter.";
            if (!price) return "❌ LIMIT orders require price parameter.";
            break;
            
        case "MARKET":
            if (!quantity && !quoteOrderQty) return "❌ MARKET orders require either quantity or quoteOrderQty.";
            break;
            
        case "STOP_LOSS":
            if (!quantity) return "❌ STOP_LOSS orders require quantity parameter.";
            if (!stopPrice && !trailingDelta) return "❌ STOP_LOSS orders require stopPrice or trailingDelta.";
            break;
            
        case "STOP_LOSS_LIMIT":
            if (!timeInForce) return "❌ STOP_LOSS_LIMIT orders require timeInForce parameter.";
            if (!quantity) return "❌ STOP_LOSS_LIMIT orders require quantity parameter.";
            if (!price) return "❌ STOP_LOSS_LIMIT orders require price parameter.";
            if (!stopPrice && !trailingDelta) return "❌ STOP_LOSS_LIMIT orders require stopPrice or trailingDelta.";
            break;
            
        case "TAKE_PROFIT":
            if (!quantity) return "❌ TAKE_PROFIT orders require quantity parameter.";
            if (!stopPrice && !trailingDelta) return "❌ TAKE_PROFIT orders require stopPrice or trailingDelta.";
            break;
            
        case "TAKE_PROFIT_LIMIT":
            if (!timeInForce) return "❌ TAKE_PROFIT_LIMIT orders require timeInForce parameter.";
            if (!quantity) return "❌ TAKE_PROFIT_LIMIT orders require quantity parameter.";
            if (!price) return "❌ TAKE_PROFIT_LIMIT orders require price parameter.";
            if (!stopPrice && !trailingDelta) return "❌ TAKE_PROFIT_LIMIT orders require stopPrice or trailingDelta.";
            break;
            
        case "LIMIT_MAKER":
            if (!quantity) return "❌ LIMIT_MAKER orders require quantity parameter.";
            if (!price) return "❌ LIMIT_MAKER orders require price parameter.";
            break;
    }

    // Iceberg order validation
    if (icebergQty && timeInForce !== "GTC") {
        return "❌ Iceberg orders must have timeInForce set to GTC.";
    }

    return null;
}

/**
 * Register cancel all open orders for symbol tool
 */
export function registerBinanceUsCancelAllOpenOrders(server: McpServer) {
    server.tool(
        "binance_us_cancel_all_open_orders",
        "Cancel all active orders on a symbol on Binance.US. This includes OCO orders. Use with caution - this will cancel ALL open orders for the specified symbol.",
        {
            symbol: z.string().describe("Trading pair symbol (e.g., BTCUSD). Required - all open orders for this symbol will be cancelled."),
            recvWindow: z.number().optional().describe("Receive window in milliseconds (max 60000)")
        },
        async (params) => {
            try {
                // Check API credentials first
                const credError = checkCredentials();
                if (credError) return { content: [{ type: "text", text: credError }], isError: true };

                // Validate symbol
                const symbolError = validateSymbol(params.symbol);
                if (symbolError) return { content: [{ type: "text", text: symbolError }], isError: true };

                // Validate recvWindow
                const recvWindowError = validateRecvWindow(params.recvWindow);
                if (recvWindowError) return { content: [{ type: "text", text: recvWindowError }], isError: true };

                const response = await makeSignedRequest("DELETE", "/api/v3/openOrders", params);

                if (!response || response.length === 0) {
                    return {
                        content: [{
                            type: "text",
                            text: `📋 No open orders found to cancel for ${params.symbol}`
                        }]
                    };
                }

                const cancelledList = response.map((order: any) => 
                    `• Order ID: ${order.orderId} | ${order.side} ${order.type} | ` +
                    `Qty: ${order.origQty} @ ${order.price} | Status: ${order.status}`
                ).join('\n');

                return {
                    content: [{
                        type: "text",
                        text: `✅ Cancelled ${response.length} orders for ${params.symbol}!\n\n` +
                              `Cancelled Orders:\n${cancelledList}\n\n` +
                              `Full Response: ${JSON.stringify(response, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                const codeMatch = errorMessage.match(/code:\s*(-?\d+)/);
                const additionalHelp = codeMatch && codeMatch[1] ? `\n\nHint: ${getBinanceErrorMessage(parseInt(codeMatch[1]))}` : '';
                return {
                    content: [{ type: "text", text: `❌ Failed to cancel all open orders: ${errorMessage}${additionalHelp}` }],
                    isError: true
                };
            }
        }
    );
}

/**
 * Register all standard order tools
 */
export function registerBinanceUsOrderTools(server: McpServer) {
    registerBinanceUsNewOrder(server);
    registerBinanceUsTestOrder(server);
    registerBinanceUsGetOrder(server);
    registerBinanceUsCancelOrder(server);
    registerBinanceUsCancelReplace(server);
    registerBinanceUsCancelAllOpenOrders(server);
    registerBinanceUsOpenOrders(server);
    registerBinanceUsAllOrders(server);
}
