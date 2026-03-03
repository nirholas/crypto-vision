/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// src/utils/logger.ts

type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR"

const LOG_LEVELS: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
}

const currentLevel = (process.env.LOG_LEVEL as LogLevel) || "INFO"

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel]
}

function formatMessage(level: LogLevel, message: string, ...args: unknown[]): string {
  const timestamp = new Date().toISOString()
  const formattedArgs = args.length > 0 ? " " + args.map(a => JSON.stringify(a)).join(" ") : ""
  return `[${timestamp}] [${level}] ${message}${formattedArgs}`
}

const Logger = {
  debug: (message: string, ...args: unknown[]) => {
    if (shouldLog("DEBUG")) {
      console.debug(formatMessage("DEBUG", message, ...args))
    }
  },
  info: (message: string, ...args: unknown[]) => {
    if (shouldLog("INFO")) {
      console.info(formatMessage("INFO", message, ...args))
    }
  },
  warn: (message: string, ...args: unknown[]) => {
    if (shouldLog("WARN")) {
      console.warn(formatMessage("WARN", message, ...args))
    }
  },
  error: (message: string, ...args: unknown[]) => {
    if (shouldLog("ERROR")) {
      console.error(formatMessage("ERROR", message, ...args))
    }
  }
}

export default Logger
