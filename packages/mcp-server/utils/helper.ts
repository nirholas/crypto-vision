/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
/**
 * Custom replacer function for JSON.stringify that handles BigInt
 * @param _key The current key being processed
 * @param value The value to process
 * @returns The processed value
 */
const bigIntReplacer = (_key: string, value: any) => {
  // Handle BigInt specifically
  if (typeof value === "bigint") {
    return value.toString()
  }
  // Return other values as-is
  return value
}

/**
 * Safely stringify any JSON value, including those with BigInt
 * @param value The value to stringify
 * @param space Number of spaces to use for indentation (optional)
 * @returns A JSON string representation of the value
 */
export const safeStringify = (value: any, space?: number): string => {
  try {
    return JSON.stringify(value, bigIntReplacer, space)
  } catch (error) {
    // If there's still an error, return a fallback string
    console.error("Error in safeStringify:", error)
    return JSON.stringify({ error: "Unable to stringify value" })
  }
}

/**
 * Safely parse a JSON string
 * @param text The JSON string to parse
 * @returns The parsed value
 */
export const safeParse = (text: string): any => {
  try {
    return JSON.parse(text)
  } catch (error) {
    console.error("Error in safeParse:", error)
    return null
  }
}

export const mcpToolRes = {
  // Unified error handling
  error: (error: unknown, operation: string) => {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error ${operation}: ${error instanceof Error ? error.message : String(error)}`
        }
      ]
    }
  },
  // Unified response formatting
  success: (data: unknown) => {
    return {
      content: [
        {
          type: "text" as const,
          text: safeStringify(data, 2)
        }
      ]
    }
  }
}
