/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/trade/oco.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { makeSignedRequest, hasApiCredentials, BINANCE_US_CONFIG } from "../../config/binanceUsClient.js";

// Common Binance error codes for better error messages
const BINANCE_ERROR_CODES: Record<number, string> = {
    [-1000]: "Unknown error occurred",
    [-1002]: "Unauthorized - check API key permissions",
    [-1003]: "Too many requests - rate limit exceeded",
    [-1013]: "Invalid quantity - check LOT_SIZE filter",
    [-1021]: "Invalid timestamp - check recvWindow",
    [-1022]: "Invalid signature",
    [-1102]: "Mandatory parameter missing",
    [-1111]: "Precision over maximum for asset",
    [-1121]: "Invalid symbol",
    [-2010]: "New order rejected",
    [-2011]: "Cancel rejected - check order status",
    [-2013]: "Order does not exist",
    [-2015]: "Rejected - invalid API key, IP, or permissions",
    [-2018]: "Balance is insufficient",
    [-2021]: "Order would immediately trigger stop price"
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

// Order side enum
const OrderSide = z.enum(["BUY", "SELL"]);

// Time in force enum
const TimeInForce = z.enum(["GTC", "IOC", "FOK"]);

// Response type enum
const OrderRespType = z.enum(["ACK", "RESULT", "FULL"]);

// Self trade prevention mode enum
const SelfTradePreventionMode = z.enum(["EXPIRE_TAKER", "EXPIRE_MAKER", "EXPIRE_BOTH", "NONE"]);

/**
 * Register new OCO order tool
 */
export function registerBinanceUsNewOco(server: McpServer) {
    server.tool(
        "binance_us_new_oco",
        "Place a new OCO (One-Cancels-the-Other) order on Binance.US. OCO orders combine a limit order with a stop-loss order. When one triggers, the other is automatically cancelled. Note: For SELL OCOs, limit price > stop price. For BUY OCOs, limit price < stop price.",
        {
            symbol: z.string().describe("Trading pair symbol (e.g., BTCUSD, ETHUSD)"),
            side: OrderSide.describe("Order side: BUY or SELL"),
            quantity: z.number().describe("Order quantity for both legs of the OCO"),
            price: z.number().describe("Limit order price"),
            stopPrice: z.number().describe("Stop price that triggers the stop-loss order"),
            stopLimitPrice: z.number().optional().describe("Limit price for the stop-loss leg. If provided, stopLimitTimeInForce is required."),
            stopLimitTimeInForce: TimeInForce.optional().describe("Time in force for stop-limit order: GTC, IOC, or FOK. Required if stopLimitPrice is provided."),
            listClientOrderId: z.string().optional().describe("Unique ID for the entire OCO order list"),
            limitClientOrderId: z.string().optional().describe("Unique ID for the limit order leg"),
            stopClientOrderId: z.string().optional().describe("Unique ID for the stop-loss leg"),
            limitIcebergQty: z.number().optional().describe("Iceberg quantity for the limit leg"),
            stopIcebergQty: z.number().optional().describe("Iceberg quantity for the stop-loss leg"),
            trailingDelta: z.number().optional().describe("Trailing delta in BIPS for the stop leg"),
            newOrderRespType: OrderRespType.optional().describe("Response type: ACK, RESULT, or FULL"),
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

                // Validate OCO parameters
                const validationError = validateOcoParams(params);
                if (validationError) {
                    return {
                        content: [{ type: "text", text: validationError }],
                        isError: true
                    };
                }

                const response = await makeSignedRequest("POST", "/api/v3/order/oco", params);

                const orders = response.orders || [];
                const orderReports = response.orderReports || [];

                return {
                    content: [{
                        type: "text",
                        text: `✅ OCO Order placed successfully!\n\n` +
                              `Order List ID: ${response.orderListId}\n` +
                              `Symbol: ${response.symbol}\n` +
                              `Status: ${response.listStatusType}\n` +
                              `Contingency Type: ${response.contingencyType}\n` +
                              `\n--- Orders ---\n` +
                              orders.map((order: any) => 
                                  `• Order ID: ${order.orderId} | Client ID: ${order.clientOrderId}`
                              ).join('\n') +
                              `\n\n--- Order Details ---\n` +
                              orderReports.map((report: any) =>
                                  `• ${report.type} | Side: ${report.side} | ` +
                                  `Qty: ${report.origQty} @ ${report.price} | ` +
                                  `Status: ${report.status}` +
                                  (report.stopPrice ? ` | Stop: ${report.stopPrice}` : '')
                              ).join('\n') +
                              `\n\nFull Response: ${JSON.stringify(response, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                const codeMatch = errorMessage.match(/code:\s*(-?\d+)/);
                const additionalHelp = codeMatch && codeMatch[1] ? `\n\nHint: ${getBinanceErrorMessage(parseInt(codeMatch[1]))}` : '';
                return {
                    content: [{ type: "text", text: `❌ Failed to place OCO order: ${errorMessage}${additionalHelp}` }],
                    isError: true
                };
            }
        }
    );
}

/**
 * Register get OCO order tool
 */
export function registerBinanceUsGetOco(server: McpServer) {
    server.tool(
        "binance_us_get_oco",
        "Query a specific OCO order on Binance.US. Either orderListId or origClientOrderId must be provided.",
        {
            orderListId: z.number().optional().describe("The order list ID to query"),
            origClientOrderId: z.string().optional().describe("The original client order ID to query"),
            recvWindow: z.number().optional().describe("Receive window in milliseconds (max 60000)")
        },
        async (params) => {
            try {
                // Check API credentials first
                const credError = checkCredentials();
                if (credError) return { content: [{ type: "text", text: credError }], isError: true };
                const recvWindowError = validateRecvWindow(params.recvWindow);
                if (recvWindowError) return { content: [{ type: "text", text: recvWindowError }], isError: true };

                if (!params.orderListId && !params.origClientOrderId) {
                    return {
                        content: [{ type: "text", text: "❌ Either orderListId or origClientOrderId must be provided." }],
                        isError: true
                    };
                }

                const response = await makeSignedRequest("GET", "/api/v3/orderList", params);

                const orders = response.orders || [];

                return {
                    content: [{
                        type: "text",
                        text: `📋 OCO Order Details\n\n` +
                              `Order List ID: ${response.orderListId}\n` +
                              `Symbol: ${response.symbol}\n` +
                              `Contingency Type: ${response.contingencyType}\n` +
                              `List Status: ${response.listStatusType}\n` +
                              `List Order Status: ${response.listOrderStatus}\n` +
                              `Client Order ID: ${response.listClientOrderId}\n` +
                              `Transaction Time: ${new Date(response.transactionTime).toISOString()}\n` +
                              `\n--- Orders ---\n` +
                              orders.map((order: any) => 
                                  `• Symbol: ${order.symbol} | Order ID: ${order.orderId} | Client ID: ${order.clientOrderId}`
                              ).join('\n') +
                              `\n\nFull Response: ${JSON.stringify(response, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                const codeMatch = errorMessage.match(/code:\s*(-?\d+)/);
                const additionalHelp = codeMatch && codeMatch[1] ? `\n\nHint: ${getBinanceErrorMessage(parseInt(codeMatch[1]))}` : '';
                return {
                    content: [{ type: "text", text: `❌ Failed to get OCO order: ${errorMessage}${additionalHelp}` }],
                    isError: true
                };
            }
        }
    );
}

/**
 * Register cancel OCO order tool
 */
export function registerBinanceUsCancelOco(server: McpServer) {
    server.tool(
        "binance_us_cancel_oco",
        "Cancel an entire OCO order on Binance.US. Cancelling any individual leg will cancel the entire OCO.",
        {
            symbol: z.string().describe("Trading pair symbol (e.g., BTCUSD)"),
            orderListId: z.number().optional().describe("The order list ID to cancel"),
            listClientOrderId: z.string().optional().describe("The list client order ID to cancel"),
            newClientOrderId: z.string().optional().describe("New client order ID for this cancel request"),
            recvWindow: z.number().optional().describe("Receive window in milliseconds (max 60000)")
        },
        async (params) => {
            try {
                // Check API credentials first
                const credError = checkCredentials();
                if (credError) return { content: [{ type: "text", text: credError }], isError: true };
                const symbolError = validateSymbol(params.symbol);
                if (symbolError) return { content: [{ type: "text", text: symbolError }], isError: true };
                const recvWindowError = validateRecvWindow(params.recvWindow);
                if (recvWindowError) return { content: [{ type: "text", text: recvWindowError }], isError: true };

                if (!params.orderListId && !params.listClientOrderId) {
                    return {
                        content: [{ type: "text", text: "❌ Either orderListId or listClientOrderId must be provided." }],
                        isError: true
                    };
                }

                const response = await makeSignedRequest("DELETE", "/api/v3/orderList", params);

                const orderReports = response.orderReports || [];

                return {
                    content: [{
                        type: "text",
                        text: `✅ OCO Order cancelled successfully!\n\n` +
                              `Order List ID: ${response.orderListId}\n` +
                              `Symbol: ${response.symbol}\n` +
                              `Status: ${response.listStatusType}\n` +
                              `Order Status: ${response.listOrderStatus}\n` +
                              `\n--- Cancelled Orders ---\n` +
                              orderReports.map((report: any) =>
                                  `• Order ID: ${report.orderId} | ${report.type} | ` +
                                  `Qty: ${report.origQty} @ ${report.price} | ` +
                                  `Status: ${report.status}`
                              ).join('\n') +
                              `\n\nFull Response: ${JSON.stringify(response, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                const codeMatch = errorMessage.match(/code:\s*(-?\d+)/);
                const additionalHelp = codeMatch && codeMatch[1] ? `\n\nHint: ${getBinanceErrorMessage(parseInt(codeMatch[1]))}` : '';
                return {
                    content: [{ type: "text", text: `❌ Failed to cancel OCO order: ${errorMessage}${additionalHelp}` }],
                    isError: true
                };
            }
        }
    );
}

/**
 * Register open OCO orders tool
 */
export function registerBinanceUsOpenOco(server: McpServer) {
    server.tool(
        "binance_us_open_oco",
        "Get all open OCO orders on Binance.US.",
        {
            recvWindow: z.number().optional().describe("Receive window in milliseconds (max 60000)")
        },
        async (params) => {
            try {
                // Check API credentials first
                const credError = checkCredentials();
                if (credError) return { content: [{ type: "text", text: credError }], isError: true };
                const recvWindowError = validateRecvWindow(params.recvWindow);
                if (recvWindowError) return { content: [{ type: "text", text: recvWindowError }], isError: true };

                const response = await makeSignedRequest("GET", "/api/v3/openOrderList", params);

                if (!response || response.length === 0) {
                    return {
                        content: [{
                            type: "text",
                            text: `📋 No open OCO orders found`
                        }]
                    };
                }

                const ocoList = response.map((oco: any) => {
                    const orders = oco.orders || [];
                    return `\n📦 Order List ID: ${oco.orderListId}\n` +
                           `   Symbol: ${oco.symbol}\n` +
                           `   Status: ${oco.listStatusType} / ${oco.listOrderStatus}\n` +
                           `   Client ID: ${oco.listClientOrderId}\n` +
                           `   Orders:\n` +
                           orders.map((order: any) => 
                               `     • Order ID: ${order.orderId} | Client ID: ${order.clientOrderId}`
                           ).join('\n');
                }).join('\n');

                return {
                    content: [{
                        type: "text",
                        text: `📋 Open OCO Orders\n` +
                              `Total: ${response.length}\n` +
                              `${ocoList}\n\n` +
                              `Full Response: ${JSON.stringify(response, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                const codeMatch = errorMessage.match(/code:\s*(-?\d+)/);
                const additionalHelp = codeMatch && codeMatch[1] ? `\n\nHint: ${getBinanceErrorMessage(parseInt(codeMatch[1]))}` : '';
                return {
                    content: [{ type: "text", text: `❌ Failed to get open OCO orders: ${errorMessage}${additionalHelp}` }],
                    isError: true
                };
            }
        }
    );
}

/**
 * Register all OCO orders history tool
 */
export function registerBinanceUsAllOcoOrders(server: McpServer) {
    server.tool(
        "binance_us_all_oco_orders",
        "Get all OCO orders (history) on Binance.US. Returns up to 1000 orders.",
        {
            fromId: z.number().optional().describe("Order list ID to start from. Cannot be used with startTime/endTime."),
            startTime: z.number().optional().describe("Start time in milliseconds. Cannot be used with fromId."),
            endTime: z.number().optional().describe("End time in milliseconds. Cannot be used with fromId."),
            limit: z.number().optional().describe("Number of results (default 500, max 1000)"),
            recvWindow: z.number().optional().describe("Receive window in milliseconds (max 60000)")
        },
        async (params) => {
            try {
                // Check API credentials first
                const credError = checkCredentials();
                if (credError) return { content: [{ type: "text", text: credError }], isError: true };
                const recvWindowError = validateRecvWindow(params.recvWindow);
                if (recvWindowError) return { content: [{ type: "text", text: recvWindowError }], isError: true };

                // Validate mutually exclusive parameters
                if (params.fromId && (params.startTime || params.endTime)) {
                    return {
                        content: [{ type: "text", text: "❌ fromId cannot be used together with startTime or endTime." }],
                        isError: true
                    };
                }

                // Validate limit
                if (params.limit !== undefined && (params.limit < 1 || params.limit > 1000)) {
                    return {
                        content: [{ type: "text", text: "❌ limit must be between 1 and 1000." }],
                        isError: true
                    };
                }

                const response = await makeSignedRequest("GET", "/api/v3/allOrderList", params);

                if (!response || response.length === 0) {
                    return {
                        content: [{
                            type: "text",
                            text: `📋 No OCO order history found`
                        }]
                    };
                }

                const ocoList = response.slice(0, 10).map((oco: any) => {
                    const orders = oco.orders || [];
                    return `• List ID: ${oco.orderListId} | ${oco.symbol} | ` +
                           `Status: ${oco.listOrderStatus} | ` +
                           `Orders: ${orders.length} | ` +
                           `${new Date(oco.transactionTime).toISOString()}`;
                }).join('\n');

                return {
                    content: [{
                        type: "text",
                        text: `📋 OCO Order History\n` +
                              `Total Retrieved: ${response.length}\n\n` +
                              `Recent Orders (showing up to 10):\n${ocoList}\n\n` +
                              `Full Response: ${JSON.stringify(response, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                const codeMatch = errorMessage.match(/code:\s*(-?\d+)/);
                const additionalHelp = codeMatch && codeMatch[1] ? `\n\nHint: ${getBinanceErrorMessage(parseInt(codeMatch[1]))}` : '';
                return {
                    content: [{ type: "text", text: `❌ Failed to get OCO order history: ${errorMessage}${additionalHelp}` }],
                    isError: true
                };
            }
        }
    );
}

/**
 * Validate OCO order parameters
 */
function validateOcoParams(params: any): string | null {
    const { side, price, stopPrice, stopLimitPrice, stopLimitTimeInForce, quantity } = params;

    // Validate quantity
    if (!quantity || quantity <= 0) {
        return "❌ quantity must be greater than 0.";
    }

    // Validate price
    if (!price || price <= 0) {
        return "❌ price must be greater than 0.";
    }

    // Validate stopPrice
    if (!stopPrice || stopPrice <= 0) {
        return "❌ stopPrice must be greater than 0.";
    }

    // Validate stop limit price requires time in force
    if (stopLimitPrice && !stopLimitTimeInForce) {
        return "❌ stopLimitTimeInForce is required when stopLimitPrice is provided.";
    }

    // Validate price restrictions based on side with helpful warnings
    if (side === "SELL" && price <= stopPrice) {
        return "⚠️ For SELL OCO orders, limit price should typically be greater than stop price. " +
               "Price restrictions: Limit Price > Last Price > Stop Price";
    }
    
    if (side === "BUY" && price >= stopPrice) {
        return "⚠️ For BUY OCO orders, limit price should typically be less than stop price. " +
               "Price restrictions: Limit Price < Last Price < Stop Price";
    }

    return null;
}

/**
 * Register all OCO order tools
 */
export function registerBinanceUsOcoTools(server: McpServer) {
    registerBinanceUsNewOco(server);
    registerBinanceUsGetOco(server);
    registerBinanceUsCancelOco(server);
    registerBinanceUsOpenOco(server);
    registerBinanceUsAllOcoOrders(server);
}