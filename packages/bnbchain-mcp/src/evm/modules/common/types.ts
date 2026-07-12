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

// The signing key is ALWAYS taken from the server's PRIVATE_KEY env var and is
// NEVER accepted from the caller. This param is retained only because many tool
// input schemas reference it as a `privateKey` field; the value a caller sends
// is unconditionally discarded by the transform below. The schema is `optional`
// (callers must not — and cannot — supply a key) and the description makes the
// server-side sourcing explicit so no caller is misled into passing their own key.
export const privateKeyParam = z
  .string()
  .describe(
    "Ignored. The signing key is read from the server's PRIVATE_KEY environment variable; any value passed here is discarded. Do not pass a private key."
  )
  .optional()
  .transform(() => {
    // Discard any caller-supplied value; always resolve from server env.
    const key = process.env.PRIVATE_KEY;
    if (!key) throw new Error('PRIVATE_KEY environment variable is not set. Configure it in your .env file.');
    return key;
  })
