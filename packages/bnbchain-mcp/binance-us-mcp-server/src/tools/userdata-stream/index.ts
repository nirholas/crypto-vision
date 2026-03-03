/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/userdata-stream/index.ts
// User Data Stream management for real-time account updates
// These endpoints manage listen keys for WebSocket user data streams

import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { makeSignedRequest, BINANCE_US_CONFIG } from "../../config/binanceUsClient.js";

/**
 * Register User Data Stream tools for Binance.US
 * 
 * User Data Streams provide real-time updates for:
 * - Account balance updates
 * - Order updates (new, filled, canceled, etc.)
 * - Position updates
 * 
 * Workflow:
 * 1. Create a listen key using binance_us_create_listen_key
 * 2. Connect to WebSocket: wss://stream.binance.us:9443/ws/<listenKey>
 * 3. Keep-alive every 30 minutes using binance_us_keepalive_listen_key
 * 4. Close when done using binance_us_close_listen_key
 * 
 * Listen keys expire after 60 minutes without a keep-alive.
 */
export function registerUserDataStreamTools(server: McpServer) {
    // =====================================================================
    // POST /api/v3/userDataStream - Create Listen Key
    // =====================================================================
    server.tool(
        "binance_us_create_listen_key",
        `Create a new listen key for User Data Stream WebSocket connection.

The listen key is used to subscribe to real-time account updates via WebSocket.
Connect to: ${BINANCE_US_CONFIG.WS_URL}/ws/<listenKey>

⚠️ IMPORTANT:
- Listen keys are valid for 60 minutes
- Use binance_us_keepalive_listen_key every 30 minutes to extend validity
- A stream will close when the listen key expires
- You can only have ONE active listen key per account

The stream sends updates for:
- outboundAccountPosition: Account balance updates
- balanceUpdate: Deposit/withdrawal updates  
- executionReport: Order/trade updates

This endpoint requires API key but does NOT require signature.`,
        {},
        async () => {
            try {
                // This endpoint only requires API key, not signature
                // But we use makeSignedRequest since it adds the API key header
                const response = await makeSignedRequest("POST", "/api/v3/userDataStream", {});
                
                return {
                    content: [{
                        type: "text",
                        text: `Listen key created successfully!

Listen Key: ${response.listenKey}

WebSocket URL: ${BINANCE_US_CONFIG.WS_URL}/ws/${response.listenKey}

⚠️ Remember to:
1. Keep-alive every 30 minutes (use binance_us_keepalive_listen_key)
2. Close the stream when done (use binance_us_close_listen_key)
3. The key expires after 60 minutes without keep-alive

Response: ${JSON.stringify(response, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to create listen key: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );

    // =====================================================================
    // PUT /api/v3/userDataStream - Keep-alive Listen Key
    // =====================================================================
    server.tool(
        "binance_us_keepalive_listen_key",
        `Extend the validity of a listen key by 60 minutes.

⚠️ IMPORTANT:
- Call this every 30 minutes to prevent the stream from closing
- If the key expires, you'll need to create a new one
- This resets the 60-minute expiration timer

This endpoint requires API key but does NOT require signature.`,
        {
            listenKey: z.string().describe("The listen key to keep alive")
        },
        async ({ listenKey }) => {
            try {
                await makeSignedRequest("PUT", "/api/v3/userDataStream", { listenKey });
                
                return {
                    content: [{
                        type: "text",
                        text: `Listen key extended successfully!

Listen Key: ${listenKey}
New expiration: 60 minutes from now

Remember to call this again in 30 minutes to maintain the connection.`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to extend listen key: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );

    // =====================================================================
    // DELETE /api/v3/userDataStream - Close Listen Key
    // =====================================================================
    server.tool(
        "binance_us_close_listen_key",
        `Close a User Data Stream by invalidating the listen key.

Use this when you're done receiving real-time updates.
After closing, the WebSocket connection will be terminated.

This endpoint requires API key but does NOT require signature.`,
        {
            listenKey: z.string().describe("The listen key to close/invalidate")
        },
        async ({ listenKey }) => {
            try {
                await makeSignedRequest("DELETE", "/api/v3/userDataStream", { listenKey });
                
                return {
                    content: [{
                        type: "text",
                        text: `Listen key closed successfully!

The User Data Stream has been terminated.
Listen Key ${listenKey} is no longer valid.

To receive real-time updates again, create a new listen key.`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to close listen key: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );

    // =====================================================================
    // Informational tool about WebSocket streams
    // =====================================================================
    server.tool(
        "binance_us_websocket_info",
        `Get information about available WebSocket streams on Binance.US.

Returns details about:
- Market data streams (public)
- User data streams (requires listen key)
- Connection URLs and limits`,
        {},
        async () => {
            const info = {
                baseUrl: BINANCE_US_CONFIG.WS_URL,
                marketDataStreams: {
                    description: "Public market data streams (no authentication required)",
                    singleStream: `${BINANCE_US_CONFIG.WS_URL}/ws/<streamName>`,
                    multipleStreams: `${BINANCE_US_CONFIG.WS_URL}/stream?streams=<stream1>/<stream2>`,
                    availableStreams: [
                        "<symbol>@aggTrade - Aggregate trade stream",
                        "<symbol>@trade - Trade stream",
                        "<symbol>@kline_<interval> - Kline/candlestick stream",
                        "<symbol>@miniTicker - Individual mini ticker",
                        "!miniTicker@arr - All market mini tickers",
                        "<symbol>@ticker - Individual ticker",
                        "!ticker@arr - All market tickers",
                        "<symbol>@ticker_<window> - Rolling window ticker (1h, 4h)",
                        "<symbol>@bookTicker - Individual book ticker",
                        "<symbol>@depth<levels> - Partial book depth (5, 10, 20)",
                        "<symbol>@depth<levels>@100ms - Fast partial book depth",
                        "<symbol>@depth - Diff depth stream",
                        "<symbol>@depth@100ms - Fast diff depth stream"
                    ]
                },
                userDataStream: {
                    description: "Private account/order updates (requires listen key)",
                    url: `${BINANCE_US_CONFIG.WS_URL}/ws/<listenKey>`,
                    events: [
                        "outboundAccountPosition - Account balance changes",
                        "balanceUpdate - Deposits/withdrawals",
                        "executionReport - Order updates"
                    ],
                    notes: [
                        "Use binance_us_create_listen_key to get a listen key",
                        "Keep-alive every 30 minutes",
                        "Keys expire after 60 minutes without keep-alive"
                    ]
                },
                limits: {
                    maxConnections: 5,
                    maxStreamsPerConnection: 1024,
                    messageLimit: "5 messages per second per connection"
                }
            };

            return {
                content: [{
                    type: "text",
                    text: `Binance.US WebSocket Information:\n\n${JSON.stringify(info, null, 2)}`
                }]
            };
        }
    );
}
