/**
 * Disputes Module Index
 * @description Exports for the dispute resolution system
 * @author nirholas
 * @license Apache-2.0
 */

export * from "./types.js"
export { DisputeManager, disputeManager, type DisputeManagerConfig } from "./manager.js"
export { AutoResolver, autoResolver, type AutoResolverConfig } from "./auto-resolver.js"
export { ArbitrationDAO, arbitrationDAO, type ArbitrationConfig } from "./arbitration.js"
