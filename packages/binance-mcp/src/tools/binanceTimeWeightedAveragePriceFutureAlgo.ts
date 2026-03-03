import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { algoClient, spotClient } from "../config/client.js";

export function registerBinanceTimeWeightedAveragePriceFutureAlgo(server: McpServer) {
  server.tool(
    "binanceTimeWeightedAveragePriceFutureAlgo",
    `Place a new spot TWAP order with Algo service. Trading for large orders can generate significant selling pressure on the market`,
    {
      symbol: z.string().describe("symbol: exemple: BTCUSDT"),
      side: z.enum(["BUY", "SELL"]).describe("BUY or SELL"),
      quantity: z.number().describe("quantity Quantity of base asset; Maximum notional per order is 200k, 2mm or 10mm, depending on symbol. Please reduce your size if you order is above the maximum notional per order."),
      duration: z.number().describe("duration Duration for TWAP orders in seconds. [300, 86400]"),
    },
    async ({ symbol, side, quantity, duration }) => {
      try {

        console.log({ symbol, side, quantity, duration });

        const result = await algoClient.restAPI.timeWeightedAveragePriceSpotAlgo({
          symbol,
          side,
          quantity,
          duration,
        });


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
