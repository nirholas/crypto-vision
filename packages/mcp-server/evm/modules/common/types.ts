/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
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
    "Private key in hex format (with or without 0x prefix). SECURITY: This is used only for address derivation and is not stored. The private key will not be logged or displayed in chat history."
  )
  .default(process.env.PRIVATE_KEY as string)
