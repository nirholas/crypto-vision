/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import type { Hex } from "viem"
import { z } from "zod"

// Private key is read exclusively from environment variable — never accept as user input
const getPrivateKey = (): string => {
  const key = process.env.PRIVATE_KEY;
  if (!key) throw new Error('PRIVATE_KEY environment variable is not set. Configure it in your .env file.');
  return key;
};

// Common parameters
export const networkParam = z
  .enum(["testnet", "mainnet"])
  .optional()
  .default("testnet")
  .describe("Network name (e.g. 'testnet', 'mainnet'). Defaults to testnet.")

export const privateKeyParam = z
  .string()
  .optional()
  .describe(
    "Private key read from PRIVATE_KEY environment variable. Do not pass this as user input."
  )
  .transform(() => getPrivateKey())

export const bucketNameParam = z
  .string()
  .optional()
  .default("created-by-universal-crypto-mcp")
  .describe(
    "The bucket name to use. If not provided, will use default 'created-by-universal-crypto-mcp'"
  )
