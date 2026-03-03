// src/tools/account/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { makeSignedRequest } from "../../config/binanceUsClient.js";

/**
 * Register all Account-related tools for Binance.US
 * 
 * Account endpoints provide access to:
 * - Account balances and permissions
 * - Trade history
 * - Rate limit usage
 * - Trading fees
 * - 30-day trading volume
 */
export function registerAccountTools(server: McpServer) {
    // =====================================================
    // binance_us_account_info
    // GET /api/v3/account
    // =====================================================
    server.tool(
        "binance_us_account_info",
        "Get current account information including balances and permissions. Returns all asset balances (free and locked), account permissions, and trading status.",
        {
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000. Default: 5000"),
        },
        async ({ recvWindow }) => {
            try {
                const params: Record<string, any> = {};
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const data = await makeSignedRequest("GET", "/api/v3/account", params);
                
                // Format balances for readability
                const nonZeroBalances = data.balances?.filter(
                    (b: { free: string; locked: string }) => 
                        parseFloat(b.free) > 0 || parseFloat(b.locked) > 0
                ) || [];
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            makerCommission: data.makerCommission,
                            takerCommission: data.takerCommission,
                            buyerCommission: data.buyerCommission,
                            sellerCommission: data.sellerCommission,
                            canTrade: data.canTrade,
                            canWithdraw: data.canWithdraw,
                            canDeposit: data.canDeposit,
                            updateTime: data.updateTime,
                            accountType: data.accountType,
                            balances: nonZeroBalances,
                            permissions: data.permissions
                        }, null, 2)
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get account info: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );

    // =====================================================
    // binance_us_my_trades
    // GET /api/v3/myTrades
    // =====================================================
    server.tool(
        "binance_us_my_trades",
        "Get trade history for a specific trading pair. Returns executed trades including price, quantity, commission, and timestamps.",
        {
            symbol: z.string().describe("Trading pair symbol, e.g., BTCUSD, ETHUSD"),
            orderId: z.number().optional().describe("Filter by order ID"),
            startTime: z.number().optional().describe("Start time in milliseconds"),
            endTime: z.number().optional().describe("End time in milliseconds"),
            fromId: z.number().optional().describe("Trade ID to fetch from. Default gets most recent trades."),
            limit: z.number().optional().describe("Number of trades to return. Default: 500, Max: 1000"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000"),
        },
        async ({ symbol, orderId, startTime, endTime, fromId, limit, recvWindow }) => {
            try {
                const params: Record<string, any> = { symbol };
                if (orderId !== undefined) params.orderId = orderId;
                if (startTime !== undefined) params.startTime = startTime;
                if (endTime !== undefined) params.endTime = endTime;
                if (fromId !== undefined) params.fromId = fromId;
                if (limit !== undefined) params.limit = limit;
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const data = await makeSignedRequest("GET", "/api/v3/myTrades", params);
                
                return {
                    content: [{
                        type: "text",
                        text: `Trade history for ${symbol}:\n${JSON.stringify(data, null, 2)}`
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

    // =====================================================
    // binance_us_rate_limits
    // GET /api/v3/rateLimit/order
    // =====================================================
    server.tool(
        "binance_us_rate_limits",
        "Get current trade order count rate limits for all time intervals. Shows how many orders you can place within each interval.",
        {
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000"),
        },
        async ({ recvWindow }) => {
            try {
                const params: Record<string, any> = {};
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const data = await makeSignedRequest("GET", "/api/v3/rateLimit/order", params);
                
                return {
                    content: [{
                        type: "text",
                        text: `Order Rate Limits:\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get rate limits: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );

    // =====================================================
    // binance_us_trade_fee
    // GET /sapi/v1/asset/query/trading-fee
    // =====================================================
    server.tool(
        "binance_us_trade_fee",
        "Get your current maker & taker fee rates for spot trading based on your VIP level. BNB fee discount (25% off) is not factored in.",
        {
            symbol: z.string().optional().describe("Trading pair symbol. If not specified, returns fees for all symbols."),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000"),
        },
        async ({ symbol, recvWindow }) => {
            try {
                const params: Record<string, any> = {};
                if (symbol !== undefined) params.symbol = symbol;
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const data = await makeSignedRequest("GET", "/sapi/v1/asset/query/trading-fee", params);
                
                return {
                    content: [{
                        type: "text",
                        text: `Trading Fees:\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get trading fees: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );

    // =====================================================
    // binance_us_trade_volume
    // GET /sapi/v1/asset/query/trading-volume
    // =====================================================
    server.tool(
        "binance_us_trade_volume",
        "Get total trade volume for the past 30 days. Volume is calculated on a rolling basis every day at 0:00 AM (UTC).",
        {
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000"),
        },
        async ({ recvWindow }) => {
            try {
                const params: Record<string, any> = {};
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const data = await makeSignedRequest("GET", "/sapi/v1/asset/query/trading-volume", params);
                
                return {
                    content: [{
                        type: "text",
                        text: `Past 30 Days Trading Volume: ${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get trading volume: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
