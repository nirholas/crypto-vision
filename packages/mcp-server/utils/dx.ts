/**
 * Developer Experience (DX) Utilities
 * Colorful output, progress indicators, and helpful error messages
 *
 * @description Make Universal Crypto MCP delightful to use
 * @author nich
 * @license Apache-2.0
 */

/* eslint-disable no-console */

// Reference Node.js globals
declare const process: {
  stdout: { write: (str: string) => void }
  env: Record<string, string | undefined>
}
declare const console: { log: (...args: unknown[]) => void }

// ANSI Colors and Styles
export const styles = {
  // Reset
  reset: "\x1b[0m",

  // Text styles
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  italic: "\x1b[3m",
  underline: "\x1b[4m",

  // Foreground colors
  black: "\x1b[30m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",

  // Bright foreground colors
  brightRed: "\x1b[91m",
  brightGreen: "\x1b[92m",
  brightYellow: "\x1b[93m",
  brightBlue: "\x1b[94m",
  brightMagenta: "\x1b[95m",
  brightCyan: "\x1b[96m",

  // Background colors
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgBlue: "\x1b[44m",
  bgMagenta: "\x1b[45m",
  bgCyan: "\x1b[46m",
} as const

export type StyleKey = keyof typeof styles

/**
 * Apply color/style to text
 */
export function colorize(style: StyleKey, text: string): string {
  return `${styles[style]}${text}${styles.reset}`
}

/**
 * Apply multiple styles to text
 */
export function styled(text: string, ...styleKeys: StyleKey[]): string {
  const prefix = styleKeys.map((k) => styles[k]).join("")
  return `${prefix}${text}${styles.reset}`
}

// Emoji icons for different message types
export const icons = {
  // Status
  success: "✅",
  error: "❌",
  warning: "⚠️",
  info: "ℹ️",
  debug: "🔍",

  // Actions
  loading: "⏳",
  complete: "✔️",
  pending: "⏸️",
  running: "▶️",

  // Crypto
  wallet: "💰",
  payment: "💳",
  send: "📤",
  receive: "📥",
  swap: "🔄",
  bridge: "🌉",
  yield: "📈",

  // Chains
  chain: "⛓️",
  ethereum: "⟠",
  solana: "◎",
  bitcoin: "₿",

  // Other
  robot: "🤖",
  money: "💵",
  star: "⭐",
  rocket: "🚀",
  fire: "🔥",
  sparkles: "✨",
  lock: "🔒",
  key: "🔑",
  gear: "⚙️",
  link: "🔗",
  clock: "🕐",
  chart: "📊",
  gas: "⛽",
} as const

// Spinner animation frames
export const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

// Timer functions from global scope
const _setInterval = (typeof globalThis !== 'undefined' && 'setInterval' in globalThis) 
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ? (globalThis as any).setInterval as (fn: () => void, ms: number) => number
  : (fn: () => void, ms: number) => { fn(); return 0 }
const _clearInterval = (typeof globalThis !== 'undefined' && 'clearInterval' in globalThis)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ? (globalThis as any).clearInterval as (id: number) => void
  : () => {}

/**
 * Create an animated spinner
 */
export class Spinner {
  private frameIndex = 0
  private interval: number | null = null
  private message: string

  constructor(message: string) {
    this.message = message
  }

  start(): void {
    this.interval = _setInterval(() => {
      const frame = spinnerFrames[this.frameIndex] ?? "⠋"
      process.stdout.write(`\r${colorize("cyan", frame)} ${this.message}`)
      this.frameIndex = (this.frameIndex + 1) % spinnerFrames.length
    }, 80)
  }

  stop(finalMessage?: string): void {
    if (this.interval !== null) {
      _clearInterval(this.interval)
      this.interval = null
    }
    process.stdout.write("\r" + " ".repeat(this.message.length + 5) + "\r")
    if (finalMessage) {
      console.log(finalMessage)
    }
  }

  success(message: string): void {
    this.stop(`${icons.success} ${colorize("green", message)}`)
  }

  fail(message: string): void {
    this.stop(`${icons.error} ${colorize("red", message)}`)
  }
}

/**
 * Progress bar for long operations
 */
export function progressBar(current: number, total: number, width = 30): string {
  const percent = Math.round((current / total) * 100)
  const filled = Math.round((current / total) * width)
  const empty = width - filled

  const filledBar = colorize("green", "█".repeat(filled))
  const emptyBar = colorize("dim", "░".repeat(empty))

  return `[${filledBar}${emptyBar}] ${percent}%`
}

/**
 * Format a box around text
 */
export function box(content: string, title?: string): string {
  const lines = content.split("\n")
  const maxWidth = Math.max(...lines.map((l) => l.length), title?.length || 0) + 4
  const top = title
    ? `╭─ ${colorize("bold", title)} ${"─".repeat(maxWidth - title.length - 4)}╮`
    : `╭${"─".repeat(maxWidth)}╮`
  const bottom = `╰${"─".repeat(maxWidth)}╯`

  const paddedLines = lines.map((line) => {
    const padding = maxWidth - line.length - 2
    return `│ ${line}${" ".repeat(padding)} │`
  })

  return [top, ...paddedLines, bottom].join("\n")
}

// Helpful error messages with suggestions
export const errorMessages = {
  NO_PRIVATE_KEY: {
    title: "Missing Private Key",
    message: "X402_PRIVATE_KEY environment variable is not set.",
    suggestion: `Set your private key:
  ${colorize("dim", "export X402_PRIVATE_KEY=0x...")}

${colorize("yellow", "⚠️  Security tip:")} Never commit your private key to git!`,
    emoji: icons.key,
  },

  INSUFFICIENT_BALANCE: {
    title: "Insufficient Balance",
    message: "Your wallet doesn't have enough funds for this operation.",
    suggestion: `Check your balance with x402_balance tool.
Fund your wallet by sending USDs to your address.`,
    emoji: icons.wallet,
  },

  INVALID_ADDRESS: {
    title: "Invalid Address",
    message: "The provided address is not a valid Ethereum address.",
    suggestion: `Addresses should:
  • Start with 0x
  • Be 42 characters long
  • Contain only hex characters (0-9, a-f)`,
    emoji: icons.error,
  },

  NETWORK_ERROR: {
    title: "Network Error",
    message: "Failed to connect to the blockchain network.",
    suggestion: `Try these solutions:
  • Check your internet connection
  • Set a custom RPC: export X402_RPC_URL=https://...
  • Try again in a few seconds`,
    emoji: icons.chain,
  },

  PAYMENT_FAILED: {
    title: "Payment Failed",
    message: "The x402 payment could not be completed.",
    suggestion: `Possible causes:
  • Insufficient balance
  • Gas price too low
  • Network congestion

Check your balance and try again.`,
    emoji: icons.payment,
  },

  RATE_LIMITED: {
    title: "Rate Limited",
    message: "Too many requests. Please slow down.",
    suggestion: `You're making requests too quickly.
Wait a few seconds before trying again.`,
    emoji: icons.clock,
  },

  INVALID_CHAIN: {
    title: "Invalid Chain",
    message: "The specified chain is not supported.",
    suggestion: `Supported EVM chains: ethereum, arbitrum, base, polygon, optimism
Supported SVM chains: solana-mainnet, solana-devnet`,
    emoji: icons.chain,
  },
} as const

/**
 * Format a helpful error message
 */
export function formatError(
  errorKey: keyof typeof errorMessages
): string {
  const err = errorMessages[errorKey]
  return `
${err.emoji} ${colorize("red", colorize("bold", err.title))}

${err.message}

${colorize("cyan", "💡 Suggestion:")}
${err.suggestion}
`
}

/**
 * Log with emoji prefix
 */
export const log = {
  info: (msg: string) => console.log(`${icons.info} ${msg}`),
  success: (msg: string) => console.log(`${icons.success} ${colorize("green", msg)}`),
  warning: (msg: string) => console.log(`${icons.warning} ${colorize("yellow", msg)}`),
  error: (msg: string) => console.log(`${icons.error} ${colorize("red", msg)}`),
  debug: (msg: string) => console.log(`${icons.debug} ${colorize("dim", msg)}`),

  // Crypto-specific logs
  wallet: (msg: string) => console.log(`${icons.wallet} ${msg}`),
  payment: (msg: string) => console.log(`${icons.payment} ${colorize("green", msg)}`),
  swap: (msg: string) => console.log(`${icons.swap} ${msg}`),
  bridge: (msg: string) => console.log(`${icons.bridge} ${msg}`),
  chain: (msg: string) => console.log(`${icons.chain} ${msg}`),
}

/**
 * Format currency amount
 */
export function formatCurrency(
  amount: number | string,
  symbol = "USDs",
  decimals = 2
): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount
  return `${num.toFixed(decimals)} ${symbol}`
}

/**
 * Format address with truncation
 */
export function formatAddress(address: string, chars = 6): string {
  if (address.length <= chars * 2 + 2) return address
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`
}

/**
 * Format transaction hash
 */
export function formatTxHash(hash: string): string {
  return formatAddress(hash, 8)
}

/**
 * Print a beautiful welcome message
 */
export function printWelcome(): void {
  console.log(`
${colorize("cyan", styled("🤖💰 Universal Crypto MCP", "bold"))}
${colorize("dim", "The first MCP server that lets AI agents send and receive crypto payments.")}

${icons.rocket} Ready to give Claude some money!

${colorize("cyan", "Quick Start:")}
  ${colorize("dim", "1.")} Set your key: ${colorize("yellow", "export X402_PRIVATE_KEY=0x...")}
  ${colorize("dim", "2.")} Fund wallet with USDs on Arbitrum
  ${colorize("dim", "3.")} Ask Claude to make a paid request!

${colorize("dim", "Docs: https://github.com/nirholas/universal-crypto-mcp")}
`)
}

/**
 * Print x402 payment summary
 */
export function printPaymentSummary(params: {
  amount: string
  to: string
  chain: string
  txHash: string
  newBalance: string
}): void {
  console.log(`
${colorize("green", "━".repeat(50))}
${icons.payment} ${colorize("bold", "Payment Successful!")}
${colorize("green", "━".repeat(50))}

  ${colorize("dim", "Amount:")}    ${colorize("green", params.amount)} USDs
  ${colorize("dim", "To:")}        ${formatAddress(params.to)}
  ${colorize("dim", "Chain:")}     ${params.chain}
  ${colorize("dim", "Tx:")}        ${formatTxHash(params.txHash)}

${colorize("green", "━".repeat(50))}
  ${icons.wallet} New Balance: ${colorize("bold", params.newBalance)} USDs
${colorize("green", "━".repeat(50))}
`)
}
