#!/usr/bin/env node
/**
 * Enhanced CLI with Live Data
 * Wrapper that adds real API calls to the CLI
 *
 * @author nich
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import {
  fetchLivePrice,
  fetchMarketOverview,
  fetchGasPrice,
  fetchWalletBalance,
  fetchTrendingCoins,
  fetchMultiplePrices,
  formatLargeNumber,
  formatPercentage,
  SYMBOL_TO_ID,
} from "./live-data.js"

// ANSI colors
const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
}

const c = (color: keyof typeof colors, text: string) =>
  `${colors[color]}${text}${colors.reset}`

/**
 * Get live price with formatted output
 */
export async function getLivePrice(symbol: string): Promise<string> {
  const upperSymbol = symbol.toUpperCase()
  
  // Check if symbol is supported
  if (!SYMBOL_TO_ID[upperSymbol]) {
    const supported = Object.keys(SYMBOL_TO_ID).slice(0, 20).join(", ")
    return `${c("red", "✗")} Unknown symbol: ${symbol}
${c("dim", "Supported:")} ${supported}...`
  }

  const price = await fetchLivePrice(upperSymbol)
  
  if (!price) {
    return `${c("yellow", "⚠")} Could not fetch live price for ${symbol}. Try again later.`
  }

  const pct = formatPercentage(price.change24h)
  const changeColor = pct.isPositive ? "green" : "red"

  return `
${c("bold", "💰 " + price.symbol)}
  ${c("cyan", "Price:")}      ${c("bold", "$" + price.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 }))}
  ${c("cyan", "24h:")}        ${c(changeColor, pct.value)}
  ${c("cyan", "Market Cap:")} ${formatLargeNumber(price.marketCap)}
  ${c("cyan", "Volume:")}     ${formatLargeNumber(price.volume24h)}`
}

/**
 * Get live market overview
 */
export async function getLiveMarketOverview(): Promise<string> {
  const [market, topPrices, trending] = await Promise.all([
    fetchMarketOverview(),
    fetchMultiplePrices(["BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "AVAX", "DOGE"]),
    fetchTrendingCoins(),
  ])

  if (!market) {
    return `${c("yellow", "⚠")} Could not fetch market data. Try again later.`
  }

  const fgColor =
    market.fearGreedIndex >= 70
      ? "green"
      : market.fearGreedIndex <= 30
        ? "red"
        : "yellow"

  let output = `
${c("bold", "📊 Global Market Overview")}
${c("cyan", "═".repeat(50))}

  ${c("dim", "Total Market Cap:")}  ${formatLargeNumber(market.totalMarketCap)}
  ${c("dim", "24h Volume:")}        ${formatLargeNumber(market.totalVolume24h)}
  ${c("dim", "BTC Dominance:")}     ${market.btcDominance.toFixed(1)}%
  ${c("dim", "ETH Dominance:")}     ${market.ethDominance.toFixed(1)}%
  ${c("dim", "Active Coins:")}      ${market.activeCryptocurrencies.toLocaleString()}
  ${c("dim", "Fear & Greed:")}      ${c(fgColor, `${market.fearGreedIndex} (${market.fearGreedLabel})`)}

${c("bold", "📈 Top Cryptocurrencies")}
${c("cyan", "─".repeat(50))}`

  for (const [symbol, data] of topPrices) {
    const pct = formatPercentage(data.change24h)
    const changeColor = pct.isPositive ? "green" : "red"
    const priceStr = data.price >= 1 
      ? data.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : data.price.toFixed(4)
    
    output += `\n  ${symbol.padEnd(6)} $${priceStr.padEnd(12)} ${c(changeColor, pct.value.padEnd(8))} ${c("dim", formatLargeNumber(data.marketCap))}`
  }

  if (trending && trending.length > 0) {
    output += `\n\n${c("bold", "🔥 Trending")}`
    output += `\n${c("cyan", "─".repeat(50))}`
    for (const coin of trending.slice(0, 5)) {
      output += `\n  ${c("yellow", "●")} ${coin.name} (${coin.symbol}) ${c("dim", `#${coin.marketCapRank}`)}`
    }
  }

  return output
}

/**
 * Get live gas prices
 */
export async function getLiveGasPrice(chain: string): Promise<string> {
  const supportedChains = ["ethereum", "arbitrum", "base", "polygon", "bsc"]
  const lowerChain = chain.toLowerCase()

  if (!supportedChains.includes(lowerChain)) {
    return `${c("red", "✗")} Unknown chain: ${chain}
${c("dim", "Supported:")} ${supportedChains.join(", ")}`
  }

  const gas = await fetchGasPrice(lowerChain)

  if (!gas) {
    return `${c("yellow", "⚠")} Could not fetch gas prices for ${chain}. Try again later.`
  }

  let output = `
${c("bold", "⛽ Gas Prices")} ${c("dim", `(${chain})`)}
${c("cyan", "═".repeat(40))}

  ${c("green", "🐢 Low:")}     ${gas.low.toFixed(2)} ${gas.unit}
  ${c("yellow", "🚶 Average:")} ${gas.average.toFixed(2)} ${gas.unit}
  ${c("red", "🚀 Fast:")}    ${gas.high.toFixed(2)} ${gas.unit}`

  if (gas.baseFee) {
    output += `\n\n  ${c("dim", "Base Fee:")}  ${gas.baseFee.toFixed(2)} ${gas.unit}`
  }

  // Add estimated transaction costs for common operations
  const ethPrice = await fetchLivePrice("ETH")
  if (ethPrice && lowerChain !== "bsc") {
    const transferGas = 21000
    const swapGas = 150000
    const avgGwei = gas.average

    const transferCostEth = (transferGas * avgGwei) / 1e9
    const swapCostEth = (swapGas * avgGwei) / 1e9

    const transferCostUsd = transferCostEth * ethPrice.price
    const swapCostUsd = swapCostEth * ethPrice.price

    output += `\n\n${c("bold", "💸 Estimated Costs")} ${c("dim", `@ ${avgGwei} ${gas.unit}`)}`
    output += `\n  ${c("dim", "ETH Transfer:")} ~$${transferCostUsd.toFixed(4)}`
    output += `\n  ${c("dim", "DEX Swap:")}     ~$${swapCostUsd.toFixed(4)}`
  }

  return output
}

/**
 * Get live wallet balance
 */
export async function getLiveBalance(address: string, chain: string): Promise<string> {
  const supportedChains = ["ethereum", "arbitrum", "base", "polygon", "optimism", "bsc", "avalanche"]
  const lowerChain = chain.toLowerCase()

  if (!supportedChains.includes(lowerChain)) {
    return `${c("red", "✗")} Unknown chain: ${chain}
${c("dim", "Supported:")} ${supportedChains.join(", ")}`
  }

  // Validate address format
  if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
    return `${c("red", "✗")} Invalid address format. Expected 0x... (42 characters)`
  }

  const balance = await fetchWalletBalance(address, lowerChain)

  if (!balance) {
    return `${c("yellow", "⚠")} Could not fetch balance. Check address and try again.`
  }

  const shortAddr = `${address.slice(0, 8)}...${address.slice(-6)}`

  let output = `
${c("bold", "💰 Wallet Balance")}
${c("cyan", "═".repeat(50))}

  ${c("dim", "Address:")} ${shortAddr}
  ${c("dim", "Chain:")}   ${chain}
  ${c("dim", "Balance:")} ${c("green", balance.balance)} ${balance.symbol}`

  if (balance.balanceUsd !== undefined) {
    output += `\n  ${c("dim", "Value:")}   ${c("bold", "$" + balance.balanceUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}`
  }

  return output
}

export {
  fetchLivePrice,
  fetchMarketOverview,
  fetchGasPrice,
  fetchWalletBalance,
  fetchTrendingCoins,
}
