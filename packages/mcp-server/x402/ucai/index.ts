/**
 * UCAI x402 Module
 * @description Universal Contract AI with x402 payment capabilities
 * @author nirholas
 * @license Apache-2.0
 * 
 * UCAI enables AI agents to interact with smart contracts using x402 payments.
 * Features include:
 * - Gas Sponsorship - Pay for user's gas with x402
 * - Premium Contract Analysis - Security audits ($0.05)
 * - Transaction Simulation - Preview outcomes ($0.01)
 * - Historical Contract Data - Query past data ($0.02)
 * - Custom ABI Generation - From unverified contracts ($0.10)
 * 
 * @example
 * ```typescript
 * import { registerUCAI } from "@/x402/ucai"
 * 
 * // Register UCAI tools with MCP server
 * registerUCAI(server)
 * ```
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { registerUCAITools } from "./tools.js"
import Logger from "@/utils/logger.js"

// Re-export types
export * from "./types.js"

// Re-export services
export { GasSponsorshipService, getGasSponsorService } from "./gas-sponsorship.js"
export { ContractAnalysisService, getContractAnalysisService } from "./contract-analysis.js"
export { TransactionSimulationService, getTransactionSimulationService } from "./transaction-simulation.js"
export { HistoricalDataService, getHistoricalDataService } from "./historical-data.js"
export { ABIGenerationService, getABIGenerationService } from "./abi-generation.js"
export { UCAIPaymentService, getUCAIPaymentService } from "./payment.js"

// Re-export tools registration
export { registerUCAITools } from "./tools.js"

/**
 * Register all UCAI x402 tools with an MCP server
 * 
 * @param server - The MCP server to register tools with
 */
export function registerUCAI(server: McpServer): void {
  Logger.info("Initializing UCAI x402 smart contract AI payment module")
  
  registerUCAITools(server)
  
  Logger.info("UCAI x402 module initialized successfully")
}

export default registerUCAI
