/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
const ccxt = require("ccxt");

// Initialize ccxt client
const exid = process.env.EXCHANGE_NAME || "binance"
const exchange = new ccxt[exid]({
  enableRateLimit: true,
});

// Reusable function to fetch OHLCV data and return an Asset object
async function fetchOhlcvData(symbol, timeframe, limit) {
  try {
    if (!exchange.has["fetchOHLCV"]) {
      throw new Error(`${exid} does not support fetchOHLCV`);
    }  
    const ohlcv = await exchange.fetchOHLCV(symbol, timeframe, undefined, limit);
    return {
      dates: ohlcv.map((row) => new Date(row[0])), // Timestamps as Date objects
      openings: ohlcv.map((row) => row[1]), // Open prices
      highs: ohlcv.map((row) => row[2]),    // High prices
      lows: ohlcv.map((row) => row[3]),     // Low prices
      closings: ohlcv.map((row) => row[4]), // Close prices (required)
      volumes: ohlcv.map((row) => row[5]),  // Volumes
    };
  } catch (error) {
    throw new Error(`Failed to fetch OHLCV data: ${error.message}`);
  }
}

module.exports = fetchOhlcvData;