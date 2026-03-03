/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
// Library entry point - exports for use as a dependency
export { registerEVM } from "./evm/index.js"
export * from "./evm/chains.js"
export * from "./evm/services/index.js"

// Re-export types
export type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
