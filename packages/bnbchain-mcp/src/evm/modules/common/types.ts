import { z } from "zod"

export const defaultNetworkParam = z
  .string()
  .describe(
    "Network name (e.g. 'bsc', 'opbnb', 'ethereum', 'base', etc.) or chain ID. Supports others main popular networks. Defaults to BSC mainnet."
  )
  .default("bsc")

export const networkSchema = z
  .string()
  .describe(
    "Network name (e.g. 'bsc', 'opbnb', 'ethereum', 'base', etc.) or chain ID. Supports others main popular networks. Defaults to BSC mainnet."
  )
  .optional()

export const privateKeyParam = z
  .string()
  .describe(
    "Private key read from PRIVATE_KEY environment variable. Do not pass this as user input."
  )
  .optional()
  .transform(() => {
    const key = process.env.PRIVATE_KEY;
    if (!key) throw new Error('PRIVATE_KEY environment variable is not set. Configure it in your .env file.');
    return key;
  })
