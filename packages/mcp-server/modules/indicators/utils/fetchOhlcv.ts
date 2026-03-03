/**
 * OHLCV Data Fetching Utility
 * 
 * @author nich
 * @website https://x.com/nichxbt
 * @github https://github.com/nirholas
 * @license Apache-2.0
 */
import ccxt from "ccxt";

export interface OhlcvAsset {
  dates: Date[];
  openings: number[];
  highs: number[];
  lows: number[];
  closings: number[];
  volumes: number[];
}

// Initialize exchange - defaults to binance, can be overridden via env
const exchangeId = process.env.EXCHANGE_NAME || "binance";

let exchange: ccxt.Exchange;

function getExchange(): ccxt.Exchange {
  if (!exchange) {
    const ExchangeClass = ccxt[exchangeId as keyof typeof ccxt] as new (config?: ccxt.ExchangeOptions) => ccxt.Exchange;
    if (!ExchangeClass) {
      throw new Error(`Exchange ${exchangeId} not supported by ccxt`);
    }
    exchange = new ExchangeClass({
      enableRateLimit: true,
    });
  }
  return exchange;
}

export async function fetchOhlcvData(
  symbol: string,
  timeframe: string,
  limit: number
): Promise<OhlcvAsset> {
  const ex = getExchange();
  
  if (!ex.has["fetchOHLCV"]) {
    throw new Error(`${exchangeId} does not support fetchOHLCV`);
  }

  const ohlcv = await ex.fetchOHLCV(symbol, timeframe, undefined, limit);

  return {
    dates: ohlcv.map((row) => new Date(row[0] as number)),
    openings: ohlcv.map((row) => row[1] as number),
    highs: ohlcv.map((row) => row[2] as number),
    lows: ohlcv.map((row) => row[3] as number),
    closings: ohlcv.map((row) => row[4] as number),
    volumes: ohlcv.map((row) => row[5] as number),
  };
}
