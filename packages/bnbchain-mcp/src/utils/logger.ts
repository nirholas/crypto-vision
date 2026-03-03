import * as util from "node:util"

enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

type LogLevelStrings = keyof typeof LogLevel

class Logger {
  private static currentLevel: LogLevel = Logger.getLogLevelFromEnv()

  private static getLogLevelFromEnv(): LogLevel {
    const envLevel = (
      process.env.LOG_LEVEL || "INFO"
    ).toUpperCase() as LogLevelStrings
    return LogLevel[envLevel] ?? LogLevel.INFO
  }

  private static shouldLog(level: LogLevel): boolean {
    return level >= this.currentLevel
  }

  private static formatMessage(
    level: LogLevelStrings,
    message: string,
    meta?: any
  ): string {
    const timestamp = new Date().toISOString()
    const metaStr = meta
      ? " " + util.inspect(meta, { depth: 5, colors: true })
      : ""
    return `[${timestamp}] ${level}: ${message}${metaStr}`
  }

  static setLogLevel(level: LogLevelStrings) {
    this.currentLevel = LogLevel[level]
  }

  static debug(message: string, meta?: any) {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(this.formatMessage("DEBUG", message, meta))
    }
  }

  static info(message: string, meta?: any) {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(this.formatMessage("INFO", message, meta))
    }
  }

  static warn(message: string, meta?: any) {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage("WARN", message, meta))
    }
  }

  static error(message: string, meta?: any) {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatMessage("ERROR", message, meta))
    }
  }

  static getLevel(): LogLevelStrings {
    return LogLevel[this.currentLevel] as LogLevelStrings
  }
}

export default Logger
