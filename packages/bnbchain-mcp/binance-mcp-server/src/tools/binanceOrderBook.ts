/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { spotClient } from "../config/client.js";

export function registerBinanceOrderBook(server: McpServer) {
  server.tool(
    "binanceOrderBook",
    "check binance order book",
    {
        symbol: z.string().describe("symbol: exemple: BTCUSDT"),
    },
    async ({ symbol }) => {
      try {

        const orderBook = await spotClient.orderBook(symbol, {limit: 50});

        return {
          content: [
            {
              type: "text",
              text: `Get binance order book successfully. data: ${JSON.stringify(orderBook)}}`,
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
