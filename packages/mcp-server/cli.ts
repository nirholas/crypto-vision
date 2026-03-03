#!/usr/bin/env node
/**
 * Agenti - Interactive CLI
 * Query crypto data directly from the command line
 *
 * @author nich
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import readline from "readline"

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
  bgGreen: "\x1b[42m",
  bgBlue: "\x1b[44m",
  bgYellow: "\x1b[43m",
}

const c = (color: keyof typeof colors, text: string) => `${colors[color]}${text}${colors.reset}`

// Beautiful ASCII Banner
const BANNER = `
${c("cyan", "   ██╗   ██╗███╗   ██╗██╗    ██████╗██████╗ ██╗   ██╗██████╗ ████████╗ ██████╗ ")}
${c("cyan", "   ██║   ██║████╗  ██║██║   ██╔════╝██╔══██╗╚██╗ ██╔╝██╔══██╗╚══██╔══╝██╔═══██╗")}
${c("cyan", "   ██║   ██║██╔██╗ ██║██║   ██║     ██████╔╝ ╚████╔╝ ██████╔╝   ██║   ██║   ██║")}
${c("cyan", "   ██║   ██║██║╚██╗██║██║   ██║     ██╔══██╗  ╚██╔╝  ██╔═══╝    ██║   ██║   ██║")}
${c("cyan", "   ╚██████╔╝██║ ╚████║██║   ╚██████╗██║  ██║   ██║   ██║        ██║   ╚██████╔╝")}
${c("cyan", "    ╚═════╝ ╚═╝  ╚═══╝╚═╝    ╚═════╝╚═╝  ╚═╝   ╚═╝   ╚═╝        ╚═╝    ╚═════╝ ")}
${c("yellow", "                          ███╗   ███╗ ██████╗██████╗ ")}
${c("yellow", "                          ████╗ ████║██╔════╝██╔══██╗")}
${c("yellow", "                          ██╔████╔██║██║     ██████╔╝")}
${c("yellow", "                          ██║╚██╔╝██║██║     ██╔═══╝ ")}
${c("yellow", "                          ██║ ╚═╝ ██║╚██████╗██║     ")}
${c("yellow", "                          ╚═╝     ╚═╝ ╚═════╝╚═╝     ")}

   ${c("bold", "🤖 Give Claude Money!")} ${c("dim", "•")} ${c("green", "💰 x402 Payments")} ${c("dim", "•")} ${c("blue", "⛓️  20+ Chains")} ${c("dim", "•")} ${c("magenta", "🔧 380+ Tools")}
`

// Compact banner for narrow terminals
const BANNER_COMPACT = `
  ${c("cyan", "╔═══════════════════════════════════════════════════════════╗")}
  ${c("cyan", "║")}  ${c("bold", "🤖💰 UNIVERSAL CRYPTO MCP")}                                 ${c("cyan", "║")}
  ${c("cyan", "║")}  ${c("dim", "═══════════════════════════════════════════════════════")}  ${c("cyan", "║")}
  ${c("cyan", "║")}  ${c("yellow", "Give Claude Money!")} AI agents with crypto superpowers.   ${c("cyan", "║")}
  ${c("cyan", "╚═══════════════════════════════════════════════════════════╝")}
`

// Loading spinner frames
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

// Mock data for CLI demo (in production, these would call actual APIs)
const mockPrices: Record<string, { price: number; change24h: number }> = {
  BTC: { price: 95000, change24h: 2.5 },
  ETH: { price: 3500, change24h: 1.8 },
  SOL: { price: 180, change24h: 4.2 },
  BNB: { price: 600, change24h: -0.5 },
  AVAX: { price: 35, change24h: 3.1 },
  ATOM: { price: 8, change24h: -1.2 },
  NEAR: { price: 5, change24h: 2.8 },
  SUI: { price: 3.5, change24h: 5.5 },
  APT: { price: 9, change24h: 1.5 },
  USDS: { price: 1.0, change24h: 0.01 },
}

async function getPrice(symbol: string): Promise<string> {
  const data = mockPrices[symbol.toUpperCase()]
  if (!data) {
    return `${c("red", "✗")} Unknown symbol: ${symbol}`
  }
  const changeColor = data.change24h >= 0 ? "green" : "red"
  const changeSign = data.change24h >= 0 ? "+" : ""
  return `${c("cyan", symbol.toUpperCase())}: ${c("bold", "$" + data.price.toLocaleString())} (${c(changeColor, changeSign + data.change24h + "%")} 24h)`
}

async function getMarketOverview(): Promise<string> {
  const lines = [
    c("bold", "\n📊 Market Overview\n"),
    `${c("dim", "Total Market Cap:")} $3.2T`,
    `${c("dim", "24h Volume:")} $125B`,
    `${c("dim", "BTC Dominance:")} 58.5%`,
    `${c("dim", "Fear & Greed:")} 72 (Greed)`,
    "",
    c("bold", "Top Coins:"),
  ]

  for (const [symbol, data] of Object.entries(mockPrices).slice(0, 5)) {
    const changeColor = data.change24h >= 0 ? "green" : "red"
    const changeSign = data.change24h >= 0 ? "+" : ""
    lines.push(
      `  ${symbol.padEnd(6)} $${data.price.toLocaleString().padEnd(10)} ${c(changeColor, changeSign + data.change24h + "%")}`
    )
  }

  return lines.join("\n")
}

async function getGasPrice(chain: string): Promise<string> {
  const gasPrices: Record<string, { low: number; avg: number; high: number }> = {
    ethereum: { low: 15, avg: 22, high: 35 },
    bsc: { low: 1, avg: 3, high: 5 },
    polygon: { low: 30, avg: 50, high: 80 },
    arbitrum: { low: 0.1, avg: 0.15, high: 0.25 },
  }

  const data = gasPrices[chain.toLowerCase()]
  if (!data) {
    return `${c("red", "✗")} Unknown chain: ${chain}. Available: ethereum, bsc, polygon, arbitrum`
  }

  return `
${c("bold", "⛽ Gas Prices")} (${chain})
  ${c("green", "Low:")}  ${data.low} Gwei
  ${c("yellow", "Avg:")}  ${data.avg} Gwei
  ${c("red", "High:")} ${data.high} Gwei`
}

async function getBalance(address: string, chain: string): Promise<string> {
  // Mock balance
  const balance = (Math.random() * 10).toFixed(4)
  const symbol = chain === "ethereum" ? "ETH" : chain === "bsc" ? "BNB" : "MATIC"
  return `
${c("bold", "💰 Balance")}
  Address: ${c("dim", address.slice(0, 10) + "..." + address.slice(-8))}
  Chain: ${chain}
  Balance: ${c("green", balance)} ${symbol}`
}

function showHelp(): string {
  return `
${c("bold", "🤖💰 Agenti - Interactive CLI")}
${c("dim", "Give Claude Money! The first MCP with x402 payments.")}

${c("cyan", "📊 Market Commands:")}
  ${c("yellow", "price <symbol>")}        Get price for a token (e.g., price btc)
  ${c("yellow", "market")}                Get market overview
  ${c("yellow", "gas <chain>")}           Get gas prices (ethereum, bsc, polygon, arbitrum)
  ${c("yellow", "chains")}                List supported chains

${c("green", "💰 Wallet Commands:")}
  ${c("yellow", "balance <addr> <chain>")} Get wallet balance
  ${c("yellow", "x402")}                  Show x402 payment status

${c("magenta", "🔧 System Commands:")}
  ${c("yellow", "help")}                  Show this help
  ${c("yellow", "banner")}                Show the beautiful banner again
  ${c("yellow", "exit")}                  Exit CLI

${c("cyan", "📝 Examples:")}
  ${c("dim", ">")} price eth
  ${c("dim", ">")} gas arbitrum
  ${c("dim", ">")} balance 0x1234...5678 ethereum
  ${c("dim", ">")} market
`
}

function showChains(): string {
  return `
${c("bold", "⛓️  Supported Chains")}

${c("cyan", "EVM Chains:")}
  ${c("green", "●")} Ethereum    ${c("green", "●")} Arbitrum    ${c("green", "●")} Base
  ${c("green", "●")} Polygon     ${c("green", "●")} Optimism    ${c("green", "●")} BSC
  ${c("green", "●")} Avalanche   ${c("green", "●")} Fantom      ${c("green", "●")} zkSync
  ${c("green", "●")} Linea       ${c("green", "●")} Scroll      ${c("green", "●")} Blast

${c("yellow", "Non-EVM Chains:")}
  ${c("green", "●")} Solana      ${c("green", "●")} Bitcoin     ${c("green", "●")} Cosmos
  ${c("green", "●")} Near        ${c("green", "●")} Sui         ${c("green", "●")} Aptos
  ${c("green", "●")} TON         ${c("green", "●")} Ripple      ${c("green", "●")} Thorchain

${c("magenta", "x402 Payment Chains:")}
  ${c("green", "●")} Arbitrum ${c("dim", "(primary)")}
  ${c("green", "●")} Base
  ${c("green", "●")} Ethereum
  ${c("green", "●")} Polygon
  ${c("green", "●")} Optimism
  ${c("green", "●")} Solana ${c("dim", "(SVM)")}
`
}

function showX402Status(): string {
  const hasKey = process.env.X402_PRIVATE_KEY ? true : false
  const chain = process.env.X402_CHAIN || "arbitrum"
  const maxPayment = process.env.X402_MAX_PAYMENT || "1.00"
  
  return `
${c("bold", "💰 x402 Payment Protocol Status")}

${c("cyan", "╭─────────────────────────────────────────╮")}
${c("cyan", "│")}  ${c("bold", "Configuration")}                         ${c("cyan", "│")}
${c("cyan", "├─────────────────────────────────────────┤")}
${c("cyan", "│")}  Private Key:  ${hasKey ? c("green", "✓ Configured") : c("red", "✗ Not set")}             ${c("cyan", "│")}
${c("cyan", "│")}  Chain:        ${c("yellow", chain.padEnd(20))}       ${c("cyan", "│")}
${c("cyan", "│")}  Max Payment:  ${c("green", "$" + maxPayment.padEnd(18))}       ${c("cyan", "│")}
${c("cyan", "╰─────────────────────────────────────────╯")}

${hasKey ? "" : `${c("yellow", "⚠️  To enable x402 payments, set:")}
   ${c("dim", "export X402_PRIVATE_KEY=0x...")}
   ${c("dim", "export X402_CHAIN=arbitrum")}
`}
${c("dim", "Learn more: https://github.com/nirholas/agenti")}
`
}

async function processCommand(input: string): Promise<string> {
  const parts = input.trim().split(/\s+/)
  const command = parts[0]?.toLowerCase()

  switch (command) {
    case "price":
      if (!parts[1]) return `${c("red", "✗")} Usage: price <symbol>`
      return getPrice(parts[1])

    case "market":
      return getMarketOverview()

    case "gas":
      if (!parts[1]) return `${c("red", "✗")} Usage: gas <chain>`
      return getGasPrice(parts[1])

    case "balance":
      if (!parts[1] || !parts[2]) return `${c("red", "✗")} Usage: balance <address> <chain>`
      return getBalance(parts[1], parts[2])

    case "chains":
      return showChains()

    case "x402":
      return showX402Status()

    case "banner":
      return BANNER

    case "help":
    case "?":
      return showHelp()

    case "exit":
    case "quit":
    case "q":
      console.log(`\n${c("cyan", "👋 Thanks for using Agenti!")}`)
      console.log(`${c("dim", "⭐ Star us on GitHub: github.com/nirholas/agenti")}\n`)
      process.exit(0)

    case "":
      return ""

    default:
      return `${c("red", "✗")} Unknown command: ${c("yellow", command)}
  ${c("dim", "Type")} ${c("cyan", "'help'")} ${c("dim", "for available commands.")}`
  }
}

async function main() {
  // Check terminal width for banner selection
  const termWidth = process.stdout.columns || 80
  const banner = termWidth >= 90 ? BANNER : BANNER_COMPACT
  
  console.log(banner)
  console.log(`${c("dim", "  Type")} ${c("cyan", "'help'")} ${c("dim", "for commands,")} ${c("cyan", "'exit'")} ${c("dim", "to quit")}\n`)

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  const prompt = () => {
    rl.question(`${c("cyan", "🤖")} ${c("bold", "crypto")}${c("dim", ">")} `, async (input) => {
      try {
        const result = await processCommand(input)
        if (result) console.log(result)
      } catch (error) {
        console.log(`${c("red", "❌ Error:")} ${error}`)
      }
      prompt()
    })
  }

  prompt()
}

// Run if called directly
if (process.argv[1]?.endsWith("cli.ts") || process.argv[1]?.endsWith("cli.js")) {
  main()
}

export { processCommand, getPrice, getMarketOverview, getGasPrice, BANNER, BANNER_COMPACT, SPINNER_FRAMES }
