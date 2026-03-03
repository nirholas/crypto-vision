/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/tools/wallet/index.ts
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { makeSignedRequest } from "../../config/binanceUsClient.js";

/**
 * Register all Wallet-related tools for Binance.US
 * 
 * Wallet endpoints provide access to:
 * - Asset configuration and network status
 * - Crypto withdrawals
 * - Fiat withdrawals (via BITGO)
 * - Withdrawal history
 * - Deposit history
 * - Deposit addresses
 */
export function registerWalletTools(server: McpServer) {
    // =====================================================
    // binance_us_asset_config
    // GET /sapi/v1/capital/config/getall
    // =====================================================
    server.tool(
        "binance_us_asset_config",
        "Get details of all crypto assets including fees, withdrawal limits, and network status. Shows deposit/withdrawal enabled status per network.",
        {
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000"),
        },
        async ({ recvWindow }) => {
            try {
                const params: Record<string, any> = {};
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const data = await makeSignedRequest("GET", "/sapi/v1/capital/config/getall", params);
                
                return {
                    content: [{
                        type: "text",
                        text: `Asset Configuration:\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get asset config: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );

    // =====================================================
    // binance_us_withdraw_crypto
    // POST /sapi/v1/capital/withdraw/apply
    // =====================================================
    server.tool(
        "binance_us_withdraw_crypto",
        "Submit a crypto withdrawal request. Requires withdrawal permission on API key. ⚠️ This action transfers funds OUT of your account - verify address carefully!",
        {
            coin: z.string().describe("Asset symbol, e.g., BTC, ETH, USDT"),
            network: z.string().describe("Withdrawal network, e.g., ERC20, BEP20, BTC. Ensure address type matches network!"),
            address: z.string().describe("Withdrawal destination address"),
            amount: z.number().describe("Withdrawal amount"),
            addressTag: z.string().optional().describe("Memo/tag for coins like XRP, XMR, etc."),
            withdrawOrderId: z.string().optional().describe("Client ID for the withdrawal (for your reference)"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000"),
        },
        async ({ coin, network, address, amount, addressTag, withdrawOrderId, recvWindow }) => {
            try {
                const params: Record<string, any> = {
                    coin,
                    network,
                    address,
                    amount
                };
                if (addressTag !== undefined) params.addressTag = addressTag;
                if (withdrawOrderId !== undefined) params.withdrawOrderId = withdrawOrderId;
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const data = await makeSignedRequest("POST", "/sapi/v1/capital/withdraw/apply", params);
                
                return {
                    content: [{
                        type: "text",
                        text: `Withdrawal request submitted successfully!\nWithdrawal ID: ${data.id}\nCoin: ${coin}\nAmount: ${amount}\nNetwork: ${network}\nAddress: ${address}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to submit withdrawal: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );

    // =====================================================
    // binance_us_withdraw_fiat
    // POST /sapi/v1/fiatpayment/withdraw/apply
    // =====================================================
    server.tool(
        "binance_us_withdraw_fiat",
        "Submit a USD withdrawal request via BITGO. ⚠️ This action transfers USD OUT of your account!",
        {
            paymentAccount: z.string().describe("The account to withdraw funds to"),
            amount: z.number().describe("USD amount to withdraw"),
            paymentMethod: z.literal("BITGO").default("BITGO").describe("Payment method (default: BITGO)"),
            fiatCurrency: z.literal("USD").default("USD").describe("Fiat currency (default: USD)"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000"),
        },
        async ({ paymentAccount, amount, paymentMethod, fiatCurrency, recvWindow }) => {
            try {
                const params: Record<string, any> = {
                    paymentMethod: paymentMethod || "BITGO",
                    paymentAccount,
                    amount,
                    fiatCurrency: fiatCurrency || "USD"
                };
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const data = await makeSignedRequest("POST", "/sapi/v1/fiatpayment/withdraw/apply", params);
                
                return {
                    content: [{
                        type: "text",
                        text: `Fiat withdrawal submitted!\nOrder ID: ${data.orderId}\nChannel: ${data.channelCode}\nAmount: ${data.amount} ${data.currencyCode}\nStatus: ${data.orderStatus}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to submit fiat withdrawal: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );

    // =====================================================
    // binance_us_withdraw_history
    // GET /sapi/v1/capital/withdraw/history
    // =====================================================
    server.tool(
        "binance_us_withdraw_history",
        "Get crypto withdrawal history. Filter by coin, status, or time range.",
        {
            coin: z.string().optional().describe("Filter by coin symbol"),
            withdrawOrderId: z.string().optional().describe("Filter by client withdrawal ID"),
            status: z.number().optional().describe("Status filter: 0=email sent, 1=canceled, 2=awaiting approval, 3=rejected, 4=processing, 5=failure, 6=completed"),
            startTime: z.number().optional().describe("Start time in ms. Default: 90 days ago"),
            endTime: z.number().optional().describe("End time in ms. Default: now"),
            offset: z.number().optional().describe("Pagination offset. Default: 0"),
            limit: z.number().optional().describe("Number of results. Default: 1000, Max: 1000"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000"),
        },
        async ({ coin, withdrawOrderId, status, startTime, endTime, offset, limit, recvWindow }) => {
            try {
                const params: Record<string, any> = {};
                if (coin !== undefined) params.coin = coin;
                if (withdrawOrderId !== undefined) params.withdrawOrderId = withdrawOrderId;
                if (status !== undefined) params.status = status;
                if (startTime !== undefined) params.startTime = startTime;
                if (endTime !== undefined) params.endTime = endTime;
                if (offset !== undefined) params.offset = offset;
                if (limit !== undefined) params.limit = limit;
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const data = await makeSignedRequest("GET", "/sapi/v1/capital/withdraw/history", params);
                
                return {
                    content: [{
                        type: "text",
                        text: `Withdrawal History:\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get withdrawal history: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );

    // =====================================================
    // binance_us_deposit_history
    // GET /sapi/v1/capital/deposit/hisrec
    // =====================================================
    server.tool(
        "binance_us_deposit_history",
        "Get crypto deposit history. Filter by coin, status, or time range.",
        {
            coin: z.string().optional().describe("Filter by coin symbol"),
            status: z.number().optional().describe("Status filter: 0=pending, 1=success, 6=credited but cannot withdraw"),
            startTime: z.number().optional().describe("Start time in ms. Default: 90 days ago"),
            endTime: z.number().optional().describe("End time in ms. Default: now"),
            offset: z.number().optional().describe("Pagination offset. Default: 0"),
            limit: z.number().optional().describe("Number of results. Default: 1000, Max: 1000"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000"),
        },
        async ({ coin, status, startTime, endTime, offset, limit, recvWindow }) => {
            try {
                const params: Record<string, any> = {};
                if (coin !== undefined) params.coin = coin;
                if (status !== undefined) params.status = status;
                if (startTime !== undefined) params.startTime = startTime;
                if (endTime !== undefined) params.endTime = endTime;
                if (offset !== undefined) params.offset = offset;
                if (limit !== undefined) params.limit = limit;
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const data = await makeSignedRequest("GET", "/sapi/v1/capital/deposit/hisrec", params);
                
                return {
                    content: [{
                        type: "text",
                        text: `Deposit History:\n${JSON.stringify(data, null, 2)}`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get deposit history: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );

    // =====================================================
    // binance_us_deposit_address
    // GET /sapi/v1/capital/deposit/address
    // =====================================================
    server.tool(
        "binance_us_deposit_address",
        "Get a deposit address for a specific crypto asset. Use this to receive funds into your Binance.US account.",
        {
            coin: z.string().describe("Coin symbol to get deposit address for, e.g., BTC, ETH"),
            network: z.string().optional().describe("Specific network to get address for, e.g., ERC20, BEP20"),
            recvWindow: z.number().optional().describe("The value cannot be greater than 60000"),
        },
        async ({ coin, network, recvWindow }) => {
            try {
                const params: Record<string, any> = { coin };
                if (network !== undefined) params.network = network;
                if (recvWindow !== undefined) params.recvWindow = recvWindow;
                
                const data = await makeSignedRequest("GET", "/sapi/v1/capital/deposit/address", params);
                
                return {
                    content: [{
                        type: "text",
                        text: `Deposit Address for ${coin}:\nAddress: ${data.address}\nTag/Memo: ${data.tag || "N/A"}\nURL: ${data.url || "N/A"}\n\n⚠️ Only send ${coin} to this address. Sending other assets may result in permanent loss.`
                    }]
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `Failed to get deposit address: ${errorMessage}` }],
                    isError: true
                };
            }
        }
    );
}
