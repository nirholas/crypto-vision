/**
 * Crypto Vision — Logger
 * Structured JSON logging via pino
 */

import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport:
    process.env.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
  base: { service: "crypto-vision" },
});
