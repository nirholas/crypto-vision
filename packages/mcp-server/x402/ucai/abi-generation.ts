/**
 * UCAI Custom ABI Generation Service
 * @description x402-powered ABI generation from unverified contracts
 * @author nirholas
 * @license Apache-2.0
 * @price $0.10 per generation
 */

import {
  createPublicClient,
  http,
  parseAbi,
  keccak256,
  toHex,
  type Address,
  type Hex,
} from "viem"
import { arbitrum, base, mainnet, polygon, optimism, bsc } from "viem/chains"
import type {
  ABIGenerationRequest,
  ABIGenerationResult,
  ABIItem,
  ABIParameter,
  ContractStandard,
} from "./types.js"
import { UCAI_PRICING } from "./types.js"
import Logger from "@/utils/logger.js"

// Chain configurations
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CHAINS: Record<string, any> = {
  ethereum: mainnet,
  arbitrum,
  base,
  polygon,
  optimism,
  bsc,
}

// Block explorer APIs
const EXPLORER_APIS: Record<string, string> = {
  ethereum: "https://api.etherscan.io/api",
  arbitrum: "https://api.arbiscan.io/api",
  base: "https://api.basescan.org/api",
  polygon: "https://api.polygonscan.com/api",
  optimism: "https://api-optimistic.etherscan.io/api",
  bsc: "https://api.bscscan.com/api",
}

// Common function signatures (4 bytes)
const KNOWN_FUNCTION_SIGNATURES: Record<string, { name: string; inputs: ABIParameter[]; outputs: ABIParameter[] }> = {
  // ERC20
  "06fdde03": { name: "name", inputs: [], outputs: [{ name: "", type: "string" }] },
  "95d89b41": { name: "symbol", inputs: [], outputs: [{ name: "", type: "string" }] },
  "313ce567": { name: "decimals", inputs: [], outputs: [{ name: "", type: "uint8" }] },
  "18160ddd": { name: "totalSupply", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  "70a08231": { name: "balanceOf", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  "a9059cbb": { name: "transfer", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },
  "23b872dd": { name: "transferFrom", inputs: [{ name: "from", type: "address" }, { name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },
  "095ea7b3": { name: "approve", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },
  "dd62ed3e": { name: "allowance", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ name: "", type: "uint256" }] },

  // ERC721
  "6352211e": { name: "ownerOf", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "address" }] },
  "b88d4fde": { name: "safeTransferFrom", inputs: [{ name: "from", type: "address" }, { name: "to", type: "address" }, { name: "tokenId", type: "uint256" }, { name: "data", type: "bytes" }], outputs: [] },
  "42842e0e": { name: "safeTransferFrom", inputs: [{ name: "from", type: "address" }, { name: "to", type: "address" }, { name: "tokenId", type: "uint256" }], outputs: [] },
  "081812fc": { name: "getApproved", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "address" }] },
  "a22cb465": { name: "setApprovalForAll", inputs: [{ name: "operator", type: "address" }, { name: "approved", type: "bool" }], outputs: [] },
  "e985e9c5": { name: "isApprovedForAll", inputs: [{ name: "owner", type: "address" }, { name: "operator", type: "address" }], outputs: [{ name: "", type: "bool" }] },
  "c87b56dd": { name: "tokenURI", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "string" }] },

  // ERC1155
  "00fdd58e": { name: "balanceOf", inputs: [{ name: "account", type: "address" }, { name: "id", type: "uint256" }], outputs: [{ name: "", type: "uint256" }] },
  "4e1273f4": { name: "balanceOfBatch", inputs: [{ name: "accounts", type: "address[]" }, { name: "ids", type: "uint256[]" }], outputs: [{ name: "", type: "uint256[]" }] },
  "f242432a": { name: "safeTransferFrom", inputs: [{ name: "from", type: "address" }, { name: "to", type: "address" }, { name: "id", type: "uint256" }, { name: "amount", type: "uint256" }, { name: "data", type: "bytes" }], outputs: [] },
  "2eb2c2d6": { name: "safeBatchTransferFrom", inputs: [{ name: "from", type: "address" }, { name: "to", type: "address" }, { name: "ids", type: "uint256[]" }, { name: "amounts", type: "uint256[]" }, { name: "data", type: "bytes" }], outputs: [] },
  "0e89341c": { name: "uri", inputs: [{ name: "id", type: "uint256" }], outputs: [{ name: "", type: "string" }] },

  // Ownable
  "8da5cb5b": { name: "owner", inputs: [], outputs: [{ name: "", type: "address" }] },
  "715018a6": { name: "renounceOwnership", inputs: [], outputs: [] },
  "f2fde38b": { name: "transferOwnership", inputs: [{ name: "newOwner", type: "address" }], outputs: [] },

  // Pausable
  "5c975abb": { name: "paused", inputs: [], outputs: [{ name: "", type: "bool" }] },
  "8456cb59": { name: "pause", inputs: [], outputs: [] },
  "3f4ba83a": { name: "unpause", inputs: [], outputs: [] },

  // AccessControl
  "91d14854": { name: "hasRole", inputs: [{ name: "role", type: "bytes32" }, { name: "account", type: "address" }], outputs: [{ name: "", type: "bool" }] },
  "2f2ff15d": { name: "grantRole", inputs: [{ name: "role", type: "bytes32" }, { name: "account", type: "address" }], outputs: [] },
  "d547741f": { name: "revokeRole", inputs: [{ name: "role", type: "bytes32" }, { name: "account", type: "address" }], outputs: [] },
  "36568abe": { name: "renounceRole", inputs: [{ name: "role", type: "bytes32" }, { name: "account", type: "address" }], outputs: [] },
  "a217fddf": { name: "DEFAULT_ADMIN_ROLE", inputs: [], outputs: [{ name: "", type: "bytes32" }] },

  // Proxy
  "5c60da1b": { name: "implementation", inputs: [], outputs: [{ name: "", type: "address" }] },
  "f851a440": { name: "admin", inputs: [], outputs: [{ name: "", type: "address" }] },
  "3659cfe6": { name: "upgradeTo", inputs: [{ name: "newImplementation", type: "address" }], outputs: [] },
  "4f1ef286": { name: "upgradeToAndCall", inputs: [{ name: "newImplementation", type: "address" }, { name: "data", type: "bytes" }], outputs: [] },

  // Common DeFi
  "d0e30db0": { name: "deposit", inputs: [], outputs: [] },
  "2e1a7d4d": { name: "withdraw", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
  "38d52e0f": { name: "asset", inputs: [], outputs: [{ name: "", type: "address" }] },
  "b6b55f25": { name: "deposit", inputs: [{ name: "assets", type: "uint256" }], outputs: [{ name: "", type: "uint256" }] },
  "ba087652": { name: "redeem", inputs: [{ name: "shares", type: "uint256" }, { name: "receiver", type: "address" }, { name: "owner", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
}

// Known event signatures
const KNOWN_EVENT_SIGNATURES: Record<string, { name: string; inputs: ABIParameter[] }> = {
  "ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef": {
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
    ],
  },
  "8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925": {
    name: "Approval",
    inputs: [
      { name: "owner", type: "address", indexed: true },
      { name: "spender", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
    ],
  },
  "8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0": {
    name: "OwnershipTransferred",
    inputs: [
      { name: "previousOwner", type: "address", indexed: true },
      { name: "newOwner", type: "address", indexed: true },
    ],
  },
}

// Standard interface detection
const STANDARD_INTERFACES: Record<ContractStandard, string[]> = {
  ERC20: ["06fdde03", "95d89b41", "313ce567", "18160ddd", "70a08231", "a9059cbb", "095ea7b3"],
  ERC721: ["6352211e", "b88d4fde", "081812fc", "a22cb465", "e985e9c5", "c87b56dd"],
  ERC1155: ["00fdd58e", "4e1273f4", "f242432a", "2eb2c2d6", "0e89341c"],
  ERC777: ["06fdde03", "95d89b41", "313ce567", "18160ddd", "959b8c3f"],
  ERC4626: ["38d52e0f", "b6b55f25", "ba087652", "07a2d13a", "c6e6f592"],
  Ownable: ["8da5cb5b", "715018a6", "f2fde38b"],
  Pausable: ["5c975abb", "8456cb59", "3f4ba83a"],
  AccessControl: ["91d14854", "2f2ff15d", "d547741f", "36568abe"],
  Upgradeable: ["5c60da1b", "3659cfe6", "4f1ef286"],
  Proxy: ["5c60da1b", "f851a440"],
  Timelock: ["d4b839921", "26782247", "b1c94d94"],
  Governor: ["02a251a3", "160cbed7", "7b3c71d3", "56781388"],
  Unknown: [],
}

/**
 * Custom ABI Generation Service
 * 
 * Generates ABIs from unverified contracts using bytecode analysis,
 * pattern matching, and AI-enhanced interface detection.
 */
export class ABIGenerationService {
  private explorerApiKeys: Record<string, string> = {}

  constructor(apiKeys?: Record<string, string>) {
    this.explorerApiKeys = apiKeys ?? {
      ethereum: process.env.ETHERSCAN_API_KEY ?? "",
      arbitrum: process.env.ARBISCAN_API_KEY ?? "",
      base: process.env.BASESCAN_API_KEY ?? "",
      polygon: process.env.POLYGONSCAN_API_KEY ?? "",
      optimism: process.env.OPTIMISTIC_API_KEY ?? "",
      bsc: process.env.BSCSCAN_API_KEY ?? "",
    }
  }

  /**
   * Generate ABI for a contract
   * 
   * @param request - ABI generation request
   * @returns ABI generation result
   */
  async generateABI(request: ABIGenerationRequest): Promise<ABIGenerationResult> {
    const { contractAddress, network, includeDescriptions, detectStandards } = request

    const chain = CHAINS[network]
    if (!chain) {
      throw new Error(`Unsupported network: ${network}`)
    }

    const publicClient = createPublicClient({
      chain,
      transport: http(),
    })

    Logger.info(`Generating ABI for ${contractAddress} on ${network}`)

    // Initialize result
    const result: ABIGenerationResult = {
      abi: [],
      bytecode: "0x" as Hex,
      detectedStandards: [],
      confidence: 0,
      method: "pattern_matching",
      warnings: [],
    }

    // First, try to get verified ABI from block explorer
    const verifiedABI = await this.getVerifiedABI(contractAddress, network)
    if (verifiedABI) {
      result.abi = verifiedABI
      result.method = "verified"
      result.confidence = 100

      if (detectStandards) {
        result.detectedStandards = this.detectStandards(verifiedABI)
      }

      return result
    }

    // Get contract bytecode
    const bytecode = await publicClient.getCode({ address: contractAddress })
    if (!bytecode || bytecode === "0x") {
      throw new Error("No contract code at this address")
    }

    result.bytecode = bytecode

    // Extract function selectors from bytecode
    const selectors = this.extractFunctionSelectors(bytecode)
    Logger.info(`Found ${selectors.length} function selectors`)

    // Match selectors against known signatures
    const matchedFunctions: ABIItem[] = []
    const unmatchedSelectors: string[] = []

    for (const selector of selectors) {
      const known = KNOWN_FUNCTION_SIGNATURES[selector]
      if (known) {
        matchedFunctions.push({
          type: "function",
          name: known.name,
          inputs: known.inputs,
          outputs: known.outputs,
          stateMutability: this.inferStateMutability(known.name, bytecode, selector),
          description: includeDescriptions ? this.generateDescription(known.name) : undefined,
        })
      } else {
        unmatchedSelectors.push(selector)
      }
    }

    // Try to decode unmatched selectors using 4byte.directory
    if (unmatchedSelectors.length > 0) {
      const decoded = await this.decodeSelectorsFromDirectory(unmatchedSelectors)
      for (const func of decoded) {
        matchedFunctions.push({
          ...func,
          description: includeDescriptions ? this.generateDescription(func.name ?? "unknown") : undefined,
        })
      }
    }

    // Extract events from bytecode
    const eventSignatures = this.extractEventSignatures(bytecode)
    for (const sig of eventSignatures) {
      const known = KNOWN_EVENT_SIGNATURES[sig]
      if (known) {
        matchedFunctions.push({
          type: "event",
          name: known.name,
          inputs: known.inputs,
          description: includeDescriptions ? this.generateEventDescription(known.name) : undefined,
        })
      }
    }

    result.abi = matchedFunctions

    // Detect standards
    if (detectStandards) {
      result.detectedStandards = this.detectStandardsFromSelectors(selectors)
      result.contractType = this.guessContractType(result.detectedStandards)
    }

    // Calculate confidence
    const matchedCount = selectors.length - unmatchedSelectors.length
    result.confidence = Math.round((matchedCount / Math.max(selectors.length, 1)) * 100)

    // Add warnings
    if (unmatchedSelectors.length > 0) {
      result.warnings.push(`${unmatchedSelectors.length} function selectors could not be decoded`)
    }

    if (result.confidence < 50) {
      result.warnings.push("Low confidence ABI - many functions could not be identified")
    }

    // Check for proxy pattern
    const isProxy = await this.checkIfProxy(publicClient, contractAddress, bytecode)
    if (isProxy) {
      result.warnings.push("Contract appears to be a proxy - consider analyzing implementation contract")
      result.detectedStandards.push("Proxy")
    }

    return result
  }

  /**
   * Get verified ABI from block explorer
   */
  private async getVerifiedABI(
    address: Address,
    network: string
  ): Promise<ABIItem[] | null> {
    const apiUrl = EXPLORER_APIS[network]
    const apiKey = this.explorerApiKeys[network]

    if (!apiUrl) {
      return null
    }

    try {
      const url = `${apiUrl}?module=contract&action=getabi&address=${address}${apiKey ? `&apikey=${apiKey}` : ""}`
      const response = await fetch(url)
      const data = await response.json() as { status: string; result?: string }

      if (data.status === "1" && data.result) {
        const abi = JSON.parse(data.result)
        return abi as ABIItem[]
      }

      return null
    } catch (error) {
      Logger.debug("Failed to get verified ABI:", error)
      return null
    }
  }

  /**
   * Extract function selectors from bytecode
   */
  private extractFunctionSelectors(bytecode: Hex): string[] {
    const selectors: Set<string> = new Set()
    const hex = bytecode.slice(2).toLowerCase()

    // Look for PUSH4 instructions (0x63) followed by 4 bytes
    // This is a common pattern in Solidity-compiled contracts
    const push4Pattern = /63([0-9a-f]{8})/g
    let match

    while ((match = push4Pattern.exec(hex)) !== null) {
      const selector = match[1]
      // Filter out unlikely selectors (all zeros, common constants)
      if (selector && selector !== "00000000" && selector !== "ffffffff") {
        selectors.add(selector)
      }
    }

    // Also look for EQ comparisons with selectors
    const eqPattern = /80([0-9a-f]{8})14/g
    while ((match = eqPattern.exec(hex)) !== null) {
      const selector = match[1]
      if (selector) {
        selectors.add(selector)
      }
    }

    return Array.from(selectors)
  }

  /**
   * Extract event signatures from bytecode
   */
  private extractEventSignatures(bytecode: Hex): string[] {
    const signatures: Set<string> = new Set()
    const hex = bytecode.slice(2).toLowerCase()

    // Look for LOG instructions with known event signatures
    // Event signatures are 32 bytes (64 hex chars)
    for (const sig of Object.keys(KNOWN_EVENT_SIGNATURES)) {
      if (hex.includes(sig)) {
        signatures.add(sig)
      }
    }

    return Array.from(signatures)
  }

  /**
   * Decode selectors using 4byte.directory
   */
  private async decodeSelectorsFromDirectory(selectors: string[]): Promise<ABIItem[]> {
    const decoded: ABIItem[] = []

    for (const selector of selectors) {
      try {
        const response = await fetch(
          `https://www.4byte.directory/api/v1/signatures/?hex_signature=0x${selector}`
        )
        const data = await response.json() as { results?: Array<{ text_signature: string }> }

        if (data.results && data.results.length > 0) {
          // Take the most popular (first) result
          const firstResult = data.results[0]
          if (firstResult) {
            const sig = firstResult.text_signature
            const parsed = this.parseTextSignature(sig)
            if (parsed) {
              decoded.push(parsed)
            }
          }
        }
      } catch {
        // Failed to decode this selector
      }
    }

    return decoded
  }

  /**
   * Parse text signature like "transfer(address,uint256)"
   */
  private parseTextSignature(sig: string): ABIItem | null {
    const match = sig.match(/^(\w+)\((.*)\)$/)
    if (!match) {
      return null
    }

    const name = match[1]
    const paramsStr = match[2]
    
    const inputs: ABIParameter[] = []
    if (paramsStr) {
      const params = paramsStr.split(",")
      for (let i = 0; i < params.length; i++) {
        const param = params[i]
        if (param) {
          inputs.push({
            name: `arg${i}`,
            type: param.trim(),
          })
        }
      }
    }

    return {
      type: "function",
      name,
      inputs,
      outputs: [],
      stateMutability: "nonpayable",
    }
  }

  /**
   * Infer state mutability from function name and bytecode
   */
  private inferStateMutability(
    name: string,
    bytecode: Hex,
    selector: string
  ): "pure" | "view" | "nonpayable" | "payable" {
    // Common view functions
    const viewFunctions = [
      "name", "symbol", "decimals", "totalSupply", "balanceOf",
      "allowance", "owner", "paused", "ownerOf", "getApproved",
      "isApprovedForAll", "tokenURI", "uri", "implementation", "admin",
    ]

    if (viewFunctions.includes(name)) {
      return "view"
    }

    // Common payable functions
    const payableFunctions = ["deposit", "buy", "mint"]
    if (payableFunctions.some(f => name.toLowerCase().includes(f))) {
      return "payable"
    }

    // Default to nonpayable
    return "nonpayable"
  }

  /**
   * Detect standards from ABI
   */
  private detectStandards(abi: ABIItem[]): ContractStandard[] {
    const functionNames = new Set<string>(
      abi
        .filter(item => item.type === "function" && item.name)
        .map(item => item.name!)
    )

    return this.detectStandardsFromNames(functionNames)
  }

  /**
   * Detect standards from function selectors
   */
  private detectStandardsFromSelectors(selectors: string[]): ContractStandard[] {
    const selectorSet = new Set(selectors)
    const detected: ContractStandard[] = []

    for (const [standard, requiredSelectors] of Object.entries(STANDARD_INTERFACES)) {
      if (standard === "Unknown") continue

      const matchCount = requiredSelectors.filter(s => selectorSet.has(s)).length
      const matchRatio = matchCount / requiredSelectors.length

      if (matchRatio >= 0.7) {
        detected.push(standard as ContractStandard)
      }
    }

    return detected
  }

  /**
   * Detect standards from function names
   */
  private detectStandardsFromNames(names: Set<string>): ContractStandard[] {
    const detected: ContractStandard[] = []

    // ERC20
    const erc20Required = ["name", "symbol", "decimals", "totalSupply", "balanceOf", "transfer", "approve"]
    if (erc20Required.filter(n => names.has(n)).length >= 5) {
      detected.push("ERC20")
    }

    // ERC721
    const erc721Required = ["ownerOf", "balanceOf", "safeTransferFrom", "approve", "setApprovalForAll"]
    if (erc721Required.filter(n => names.has(n)).length >= 3) {
      detected.push("ERC721")
    }

    // ERC1155
    if (names.has("balanceOfBatch") || names.has("safeBatchTransferFrom")) {
      detected.push("ERC1155")
    }

    // Ownable
    if (names.has("owner") && (names.has("transferOwnership") || names.has("renounceOwnership"))) {
      detected.push("Ownable")
    }

    // Pausable
    if (names.has("paused") && names.has("pause")) {
      detected.push("Pausable")
    }

    // AccessControl
    if (names.has("hasRole") && names.has("grantRole")) {
      detected.push("AccessControl")
    }

    return detected
  }

  /**
   * Guess contract type from detected standards
   */
  private guessContractType(standards: ContractStandard[]): string {
    if (standards.includes("ERC20")) {
      if (standards.includes("ERC4626")) {
        return "ERC4626 Tokenized Vault"
      }
      return "ERC20 Token"
    }

    if (standards.includes("ERC721")) {
      return "ERC721 NFT"
    }

    if (standards.includes("ERC1155")) {
      return "ERC1155 Multi-Token"
    }

    if (standards.includes("Governor")) {
      return "Governance Contract"
    }

    if (standards.includes("Proxy") || standards.includes("Upgradeable")) {
      return "Proxy Contract"
    }

    return "Unknown Contract Type"
  }

  /**
   * Check if contract is a proxy
   */
  private async checkIfProxy(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client: any,
    address: Address,
    bytecode: Hex
  ): Promise<boolean> {
    // Check EIP-1967 storage slot
    const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"

    try {
      const slot = await client.getStorageAt({
        address,
        slot: IMPLEMENTATION_SLOT as Hex,
      })

      if (slot && slot !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
        return true
      }
    } catch {
      // Not a proxy
    }

    // Check for DELEGATECALL in bytecode (f4 opcode)
    if (bytecode.toLowerCase().includes("f4")) {
      return true
    }

    return false
  }

  /**
   * Generate description for a function
   */
  private generateDescription(name: string): string {
    const descriptions: Record<string, string> = {
      name: "Returns the name of the token",
      symbol: "Returns the symbol of the token",
      decimals: "Returns the number of decimals used by the token",
      totalSupply: "Returns the total supply of tokens",
      balanceOf: "Returns the token balance of an account",
      transfer: "Transfers tokens to a recipient",
      transferFrom: "Transfers tokens from one account to another (requires approval)",
      approve: "Approves a spender to transfer tokens on behalf of the caller",
      allowance: "Returns the remaining amount a spender is allowed to transfer",
      owner: "Returns the owner of the contract",
      transferOwnership: "Transfers ownership to a new address",
      renounceOwnership: "Renounces ownership, leaving the contract without an owner",
      paused: "Returns whether the contract is paused",
      pause: "Pauses the contract",
      unpause: "Unpauses the contract",
      ownerOf: "Returns the owner of a specific NFT",
      tokenURI: "Returns the metadata URI for a specific token",
      mint: "Mints new tokens",
      burn: "Burns tokens",
      deposit: "Deposits tokens into the contract",
      withdraw: "Withdraws tokens from the contract",
    }

    return descriptions[name] ?? `Calls the ${name} function`
  }

  /**
   * Generate description for an event
   */
  private generateEventDescription(name: string): string {
    const descriptions: Record<string, string> = {
      Transfer: "Emitted when tokens are transferred",
      Approval: "Emitted when an approval is granted",
      OwnershipTransferred: "Emitted when ownership is transferred",
      Paused: "Emitted when the contract is paused",
      Unpaused: "Emitted when the contract is unpaused",
    }

    return descriptions[name] ?? `Emitted when ${name} occurs`
  }

  /**
   * Get pricing for ABI generation
   */
  getPricing(): string {
    return UCAI_PRICING.ABI_GENERATION
  }
}

// Singleton instance
let abiService: ABIGenerationService | null = null

/**
 * Get or create ABI generation service
 */
export function getABIGenerationService(): ABIGenerationService {
  if (!abiService) {
    abiService = new ABIGenerationService()
  }
  return abiService
}

export default ABIGenerationService
