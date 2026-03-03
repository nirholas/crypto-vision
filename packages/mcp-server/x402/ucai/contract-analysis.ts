/**
 * UCAI Premium Contract Analysis Service
 * @description x402-powered security analysis, rug pull detection, and verification
 * @author nirholas
 * @license Apache-2.0
 * @price $0.05 per analysis
 */

import {
  createPublicClient,
  http,
  getContract,
  parseAbi,
  formatUnits,
  type Address,
  type Hex,
  type PublicClient,
} from "viem"
import { arbitrum, base, mainnet, polygon, optimism, bsc } from "viem/chains"
import type {
  ContractAnalysisRequest,
  SecurityAuditResult,
  Vulnerability,
  OwnershipInfo,
  RugPullIndicators,
  RugIndicator,
  AnalysisType,
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

// Block explorer APIs for verification check
const EXPLORER_APIS: Record<string, string> = {
  ethereum: "https://api.etherscan.io/api",
  arbitrum: "https://api.arbiscan.io/api",
  base: "https://api.basescan.org/api",
  polygon: "https://api.polygonscan.com/api",
  optimism: "https://api-optimistic.etherscan.io/api",
  bsc: "https://api.bscscan.com/api",
}

// Common ABIs for analysis
const OWNABLE_ABI = parseAbi([
  "function owner() view returns (address)",
  "function renounceOwnership() external",
  "function transferOwnership(address) external",
])

const PAUSABLE_ABI = parseAbi([
  "function paused() view returns (bool)",
  "function pause() external",
  "function unpause() external",
])

const TOKEN_ABI = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function owner() view returns (address)",
  "function paused() view returns (bool)",
  "function isBlacklisted(address) view returns (bool)",
  "function blacklist(address) external",
  "function mint(address,uint256) external",
  "function _taxFee() view returns (uint256)",
  "function _liquidityFee() view returns (uint256)",
  "function _buyFee() view returns (uint256)",
  "function _sellFee() view returns (uint256)",
  "function tradingEnabled() view returns (bool)",
  "function maxTxAmount() view returns (uint256)",
  "function maxWalletSize() view returns (uint256)",
])

const PROXY_ABI = parseAbi([
  "function implementation() view returns (address)",
  "function admin() view returns (address)",
  "function upgradeTo(address) external",
  "function upgradeToAndCall(address,bytes) external",
])

const TIMELOCK_ABI = parseAbi([
  "function delay() view returns (uint256)",
  "function MINIMUM_DELAY() view returns (uint256)",
  "function admin() view returns (address)",
])

// Liquidity lock contracts
const LIQUIDITY_LOCKERS: Record<string, Record<string, Address>> = {
  ethereum: {
    unicrypt: "0x663A5C229c09b049E36dCc11a9B0d4a8Eb9db214",
    teamFinance: "0xE2fE530C047f2d85298b07D9333C05737f1435fB",
    pinkLock: "0x71B5759d73262FBb223956913ecF4ecC51057641",
  },
  bsc: {
    unicrypt: "0xC765bddB93b0D1c1A88282BA0fa6B2d00E3e0c83",
    pinkLock: "0x7ee058420e5937496F5a2096f04caA7721cF70cc",
    mudra: "0xAe37eBd8c56C8ad50Ac0741e5EfF7dD7e1DF1fBc",
  },
  arbitrum: {
    unicrypt: "0x9c991E4Cc5c73904fFFE8d9d9Db3a4dBf4a39E8A",
  },
}

// Known dangerous function selectors
const DANGEROUS_SELECTORS = {
  mint: "0x40c10f19",
  burn: "0x42966c68",
  pause: "0x8456cb59",
  unpause: "0x3f4ba83a",
  blacklist: "0x44337ea1",
  setFee: "0x69fe0e2d",
  withdrawAll: "0x853828b6",
  selfDestruct: "0xff9e78ac",
}

/**
 * Premium Contract Analysis Service
 * 
 * Provides comprehensive security analysis of smart contracts
 * including vulnerability detection, rug pull indicators, and more.
 */
export class ContractAnalysisService {
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
   * Perform comprehensive contract analysis
   * 
   * @param request - Analysis request
   * @returns Security audit result
   */
  async analyzeContract(request: ContractAnalysisRequest): Promise<SecurityAuditResult> {
    const { contractAddress, network, analysisType } = request

    const chain = CHAINS[network]
    if (!chain) {
      throw new Error(`Unsupported network: ${network}`)
    }

    const publicClient = createPublicClient({
      chain,
      transport: http(),
    })

    Logger.info(`Analyzing contract ${contractAddress} on ${network}`)

    // Initialize result
    const result: SecurityAuditResult = {
      securityScore: 100,
      riskLevel: "safe",
      vulnerabilities: [],
      ownership: {
        owner: "0x0000000000000000000000000000000000000000" as Address,
        isRenounced: true,
        hasTimelock: false,
        hasDangerousPermissions: false,
        permissions: [],
      },
      isProxy: false,
      verified: false,
      recommendations: [],
    }

    // Check if contract exists
    const code = await publicClient.getCode({ address: contractAddress })
    if (!code || code === "0x") {
      throw new Error("No contract code at this address")
    }

    // Run requested analysis types
    const analysisPromises: Promise<void>[] = []

    if (analysisType.includes("security_audit") || analysisType.includes("full_audit")) {
      analysisPromises.push(this.runSecurityAudit(publicClient, contractAddress, code, result))
    }

    if (analysisType.includes("ownership_analysis") || analysisType.includes("full_audit")) {
      analysisPromises.push(this.analyzeOwnership(publicClient, contractAddress, result))
    }

    if (analysisType.includes("proxy_detection") || analysisType.includes("full_audit")) {
      analysisPromises.push(this.detectProxy(publicClient, contractAddress, code, result))
    }

    if (analysisType.includes("contract_verification") || analysisType.includes("full_audit")) {
      analysisPromises.push(this.checkVerification(contractAddress, network, result))
    }

    await Promise.all(analysisPromises)

    // Calculate final score and risk level
    this.calculateFinalScore(result)

    return result
  }

  /**
   * Analyze contract for rug pull indicators
   */
  async analyzeRugPullRisk(
    contractAddress: Address,
    network: string
  ): Promise<RugPullIndicators> {
    const chain = CHAINS[network]
    if (!chain) {
      throw new Error(`Unsupported network: ${network}`)
    }

    const publicClient = createPublicClient({
      chain,
      transport: http(),
    })

    const indicators: RugIndicator[] = []
    let riskScore = 0

    // Check contract code
    const code = await publicClient.getCode({ address: contractAddress })
    if (!code || code === "0x") {
      throw new Error("No contract code at this address")
    }

    // Initialize result
    const result: RugPullIndicators = {
      riskScore: 0,
      isHoneypot: false,
      hasUnlimitedMint: false,
      canPauseTrading: false,
      hasBlacklist: false,
      hasHiddenOwner: false,
      liquidityLocked: false,
      contractAgeDays: 0,
      indicators: [],
    }

    // Check for mint function
    if (code.includes(DANGEROUS_SELECTORS.mint.slice(2))) {
      try {
        // Try to check if mint is unrestricted
        result.hasUnlimitedMint = true
        indicators.push({
          type: "unlimited_mint",
          risk: "critical",
          description: "Contract has mint function that could create unlimited tokens",
        })
        riskScore += 30
      } catch {
        // Mint might be restricted
      }
    }

    // Check for pause function
    if (code.includes(DANGEROUS_SELECTORS.pause.slice(2))) {
      try {
        await publicClient.readContract({
          address: contractAddress,
          abi: PAUSABLE_ABI,
          functionName: "paused",
        })
        result.canPauseTrading = true
        indicators.push({
          type: "pausable",
          risk: "medium",
          description: "Trading can be paused by owner",
        })
        riskScore += 15
      } catch {
        // Not pausable or different interface
      }
    }

    // Check for blacklist
    if (code.includes(DANGEROUS_SELECTORS.blacklist.slice(2))) {
      result.hasBlacklist = true
      indicators.push({
        type: "blacklist",
        risk: "medium",
        description: "Owner can blacklist addresses from trading",
      })
      riskScore += 15
    }

    // Check owner
    try {
      const owner = await publicClient.readContract({
        address: contractAddress,
        abi: OWNABLE_ABI,
        functionName: "owner",
      })
      
      if (owner !== "0x0000000000000000000000000000000000000000") {
        indicators.push({
          type: "active_owner",
          risk: "low",
          description: `Contract has active owner: ${owner}`,
        })
        riskScore += 5
      }
    } catch {
      // No owner function
    }

    // Check buy/sell fees
    try {
      const buyFee = await publicClient.readContract({
        address: contractAddress,
        abi: TOKEN_ABI,
        functionName: "_buyFee",
      })
      const sellFee = await publicClient.readContract({
        address: contractAddress,
        abi: TOKEN_ABI,
        functionName: "_sellFee",
      })

      result.buyTax = Number(buyFee)
      result.sellTax = Number(sellFee)

      if (Number(sellFee) > 20) {
        indicators.push({
          type: "high_sell_tax",
          risk: "critical",
          description: `Extremely high sell tax: ${sellFee}%`,
        })
        riskScore += 40
        result.isHoneypot = true
      } else if (Number(sellFee) > 10) {
        indicators.push({
          type: "high_sell_tax",
          risk: "high",
          description: `High sell tax: ${sellFee}%`,
        })
        riskScore += 20
      }
    } catch {
      // No fee functions or different interface
    }

    // Check trading status
    try {
      const tradingEnabled = await publicClient.readContract({
        address: contractAddress,
        abi: TOKEN_ABI,
        functionName: "tradingEnabled",
      })
      
      if (!tradingEnabled) {
        indicators.push({
          type: "trading_disabled",
          risk: "critical",
          description: "Trading is currently disabled",
        })
        riskScore += 30
        result.isHoneypot = true
      }
    } catch {
      // No tradingEnabled function
    }

    // Check contract age
    try {
      const block = await publicClient.getBlock({ blockTag: "latest" })
      // Would need to get deployment block - simplified for now
      result.contractAgeDays = 0 // Would calculate from deployment
    } catch {
      // Could not determine age
    }

    // Update result
    result.riskScore = Math.min(100, riskScore)
    result.indicators = indicators

    return result
  }

  /**
   * Run security audit on contract bytecode
   */
  private async runSecurityAudit(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client: any,
    address: Address,
    code: Hex,
    result: SecurityAuditResult
  ): Promise<void> {
    // Check for selfdestruct
    if (code.includes("ff") && code.includes("selfdestruct")) {
      result.vulnerabilities.push({
        type: "selfdestruct",
        severity: "critical",
        description: "Contract contains selfdestruct function",
        impact: "Contract can be permanently destroyed, losing all funds",
        recommendation: "Remove selfdestruct or add strict access controls",
      })
      result.securityScore -= 25
    }

    // Check for delegatecall
    if (code.includes("f4")) {
      result.vulnerabilities.push({
        type: "delegatecall",
        severity: "medium",
        description: "Contract uses delegatecall",
        impact: "Could allow arbitrary code execution if not properly secured",
        recommendation: "Ensure delegatecall targets are trusted and immutable",
      })
      result.securityScore -= 10
    }

    // Check for tx.origin
    if (code.toLowerCase().includes("3232")) {
      result.vulnerabilities.push({
        type: "tx_origin",
        severity: "medium",
        description: "Contract may use tx.origin for authentication",
        impact: "Vulnerable to phishing attacks",
        recommendation: "Use msg.sender instead of tx.origin",
      })
      result.securityScore -= 10
    }

    // Check code size (very small contracts are suspicious)
    if (code.length < 200) {
      result.vulnerabilities.push({
        type: "minimal_code",
        severity: "info",
        description: "Contract has very little code",
        impact: "May be a proxy or stub contract",
        recommendation: "Verify this is the expected behavior",
      })
    }
  }

  /**
   * Analyze contract ownership
   */
  private async analyzeOwnership(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client: any,
    address: Address,
    result: SecurityAuditResult
  ): Promise<void> {
    try {
      const owner = await client.readContract({
        address,
        abi: OWNABLE_ABI,
        functionName: "owner",
      }) as Address

      result.ownership.owner = owner
      result.ownership.isRenounced = owner === "0x0000000000000000000000000000000000000000"

      if (!result.ownership.isRenounced) {
        result.ownership.permissions.push("transferOwnership")
        result.ownership.permissions.push("renounceOwnership")
        result.securityScore -= 5
      }
    } catch {
      // No Ownable interface
      result.ownership.isRenounced = true
    }

    // Check for timelock
    try {
      const delay = await client.readContract({
        address,
        abi: TIMELOCK_ABI,
        functionName: "delay",
      })
      
      result.ownership.hasTimelock = true
      result.ownership.timelockDuration = Number(delay)
      result.securityScore += 5 // Timelock is good
    } catch {
      // No timelock
    }

    // Check for dangerous permissions
    const code = await client.getCode({ address })
    if (code) {
      for (const [name, selector] of Object.entries(DANGEROUS_SELECTORS)) {
        if (code.includes(selector.slice(2))) {
          result.ownership.permissions.push(name)
          if (["mint", "selfDestruct", "withdrawAll"].includes(name)) {
            result.ownership.hasDangerousPermissions = true
          }
        }
      }
    }

    if (result.ownership.hasDangerousPermissions && !result.ownership.isRenounced) {
      result.vulnerabilities.push({
        type: "dangerous_owner_permissions",
        severity: "high",
        description: "Owner has dangerous permissions like mint or withdraw",
        impact: "Owner could drain funds or manipulate token supply",
        recommendation: "Renounce ownership or add timelock/multisig",
      })
      result.securityScore -= 15
    }
  }

  /**
   * Detect if contract is a proxy
   */
  private async detectProxy(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client: any,
    address: Address,
    code: Hex,
    result: SecurityAuditResult
  ): Promise<void> {
    // Check EIP-1967 proxy storage slots
    const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"
    const ADMIN_SLOT = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103"

    try {
      const implSlot = await client.getStorageAt({
        address,
        slot: IMPLEMENTATION_SLOT as Hex,
      })

      if (implSlot && implSlot !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
        result.isProxy = true
        result.implementationAddress = ("0x" + implSlot.slice(26)) as Address

        // Check if implementation is verified
        result.recommendations.push(
          `This is a proxy contract. Implementation at ${result.implementationAddress} should also be audited.`
        )

        // Proxy adds some risk
        result.securityScore -= 5
      }
    } catch {
      // Not an EIP-1967 proxy
    }

    // Check for other proxy patterns
    try {
      const impl = await client.readContract({
        address,
        abi: PROXY_ABI,
        functionName: "implementation",
      }) as Address

      if (impl !== "0x0000000000000000000000000000000000000000") {
        result.isProxy = true
        result.implementationAddress = impl
      }
    } catch {
      // Not this type of proxy
    }
  }

  /**
   * Check if contract is verified on block explorer
   */
  private async checkVerification(
    address: Address,
    network: string,
    result: SecurityAuditResult
  ): Promise<void> {
    const apiUrl = EXPLORER_APIS[network]
    const apiKey = this.explorerApiKeys[network]

    if (!apiUrl) {
      return
    }

    try {
      const url = `${apiUrl}?module=contract&action=getsourcecode&address=${address}${apiKey ? `&apikey=${apiKey}` : ""}`
      const response = await fetch(url)
      const data = await response.json() as { status: string; result?: Array<{ SourceCode?: string }> }

      if (data.status === "1" && data.result?.[0]?.SourceCode) {
        result.verified = data.result[0].SourceCode !== ""
        
        if (result.verified) {
          result.securityScore += 10
          result.recommendations.push("Contract is verified - source code matches deployed bytecode.")
        } else {
          result.vulnerabilities.push({
            type: "unverified",
            severity: "medium",
            description: "Contract source code is not verified",
            impact: "Cannot verify contract behavior matches expectations",
            recommendation: "Request verification from contract deployer",
          })
          result.securityScore -= 15
        }
      }
    } catch (error) {
      Logger.warn("Failed to check verification:", error)
    }
  }

  /**
   * Calculate final security score and risk level
   */
  private calculateFinalScore(result: SecurityAuditResult): void {
    // Ensure score is between 0 and 100
    result.securityScore = Math.max(0, Math.min(100, result.securityScore))

    // Determine risk level
    if (result.securityScore >= 80) {
      result.riskLevel = "safe"
    } else if (result.securityScore >= 60) {
      result.riskLevel = "low"
    } else if (result.securityScore >= 40) {
      result.riskLevel = "medium"
    } else if (result.securityScore >= 20) {
      result.riskLevel = "high"
    } else {
      result.riskLevel = "critical"
    }

    // Add recommendations based on findings
    if (!result.verified) {
      result.recommendations.push("Verify contract source code on block explorer")
    }

    if (!result.ownership.isRenounced && result.ownership.hasDangerousPermissions) {
      result.recommendations.push("Consider renouncing ownership or using a multisig")
    }

    if (!result.ownership.hasTimelock && !result.ownership.isRenounced) {
      result.recommendations.push("Add a timelock for owner actions")
    }

    if (result.isProxy && !result.implementationAddress) {
      result.recommendations.push("Verify proxy implementation address")
    }
  }

  /**
   * Get analysis pricing
   */
  getPricing(): string {
    return UCAI_PRICING.CONTRACT_ANALYSIS
  }
}

// Singleton instance
let analysisService: ContractAnalysisService | null = null

/**
 * Get or create contract analysis service
 */
export function getContractAnalysisService(): ContractAnalysisService {
  if (!analysisService) {
    analysisService = new ContractAnalysisService()
  }
  return analysisService
}

export default ContractAnalysisService
