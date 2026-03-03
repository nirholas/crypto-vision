/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import type { Hex } from "viem"
import { z } from "zod"

// Get default private key from environment variables, use sample key if not set
export const DEFAULT_PRIVATE_KEY = process.env.PRIVATE_KEY || ""

// Common parameters
export const networkParam = z
  .enum(["testnet", "mainnet"])
  .optional()
  .default("testnet")
  .describe("Network name (e.g. 'testnet', 'mainnet'). Defaults to testnet.")

export const privateKeyParam = z
  .string()
  .optional()
  .default(DEFAULT_PRIVATE_KEY)
  .describe(
    "Private key of the account in hex format. SECURITY: This is used only for transaction signing."
  )

export const bucketNameParam = z
  .string()
  .optional()
  .default("created-by-universal-crypto-mcp")
  .describe(
    "The bucket name to use. If not provided, will use default 'created-by-universal-crypto-mcp'"
  )
