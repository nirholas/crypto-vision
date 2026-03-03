import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { algoClient, spotClient } from "../config/client.js";
import { OrderType, type Side } from "@binance/connector-typescript";

export function registerBinanceSpotPlaceOrder(server: McpServer) {
  server.tool(
    "binanceSpotPlaceOrder",
    `Trading for small orders will not generate significant selling pressure on the market`,
    {
      symbol: z.string().describe("symbol: exemple: BTCUSDT"),
      side: z.enum(["BUY", "SELL"]).describe("BUY or SELL"),
      quantity: z.number().describe("quantity Quantity of base asset").optional(),
      quoteOrderQty: z.number().describe(`MARKET orders using quoteOrderQty specifies the amount the user wants to spend (when buying) or receive (when selling) the quote asset; the correct quantity will be determined based on the market liquidity and quoteOrderQty.
      E.g. Using the symbol BTCUSDT:
      BUY side, the order will buy as many BTC as quoteOrderQty USDT can.
      SELL side, the order will sell as much BTC needed to receive quoteOrderQty USDT.`).optional(),
    },
    async ({ symbol, side, quantity, quoteOrderQty }) => {
      try {


        const result = await spotClient.newOrder(symbol, side as Side, OrderType.MARKET, {
            quantity,
            quoteOrderQty,
        })


        return {
          content: [
            {
              type: "text",
              text: `Place a new spot TWAP order with Algo service successfully. result: ${JSON.stringify(result)}}`,
            },
          ],
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        return {
          content: [
            { type: "text", text: `Server failed: ${errorMessage}` },
          ],
          isError: true,
        };
      }
    }
  );
}
