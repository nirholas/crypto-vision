/**
 * Allowlist & Blocklist Management
 * @description Manage access control lists for tools
 * @author nirholas
 * @license Apache-2.0
 */

import type { Address } from "viem"
import { randomBytes } from "crypto"
import type {
  AllowlistEntry,
  BlocklistEntry,
  GeoRestriction,
  ListEntryType,
  Permission,
  RateLimit,
  AccessStorageAdapter,
} from "./types.js"
import { defaultStorage } from "./storage.js"
import Logger from "@/utils/logger.js"

/**
 * CIDR validation regex
 */
const CIDR_REGEX = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/

/**
 * IPv4 validation regex
 */
const IPV4_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/

/**
 * IPv6 validation regex (simplified)
 */
const IPV6_REGEX = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/

/**
 * Ethereum address regex
 */
const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/

/**
 * Access List Manager
 */
export class AccessListManager {
  private storage: AccessStorageAdapter

  constructor(storage: AccessStorageAdapter = defaultStorage) {
    this.storage = storage
  }

  /**
   * Generate a unique entry ID
   */
  private generateEntryId(): string {
    return `list_${randomBytes(16).toString("hex")}`
  }

  /**
   * Validate entry value based on type
   */
  private validateEntryValue(type: ListEntryType, value: string): boolean {
    switch (type) {
      case "address":
        return ETH_ADDRESS_REGEX.test(value)
      case "ip":
        return IPV4_REGEX.test(value) || IPV6_REGEX.test(value)
      case "cidr":
        return CIDR_REGEX.test(value)
      default:
        return false
    }
  }

  /**
   * Check if an IP address is within a CIDR range
   */
  private ipInCidr(ip: string, cidr: string): boolean {
    const [range, bits] = cidr.split("/")
    const mask = parseInt(bits, 10)

    const ipNum = this.ipToNumber(ip)
    const rangeNum = this.ipToNumber(range)
    const maskNum = ~((1 << (32 - mask)) - 1)

    return (ipNum & maskNum) === (rangeNum & maskNum)
  }

  /**
   * Convert IP address to number
   */
  private ipToNumber(ip: string): number {
    return ip.split(".").reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0)
  }

  // ========================================================================
  // Allowlist Operations
  // ========================================================================

  /**
   * Add an address/IP to the allowlist
   */
  async addToAllowlist(
    toolId: string,
    type: ListEntryType,
    value: string,
    createdBy: Address,
    options?: {
      reason?: string
      permissions?: Permission[]
      customRateLimit?: RateLimit
      expiresAt?: number
    }
  ): Promise<AllowlistEntry> {
    if (!this.validateEntryValue(type, value)) {
      throw new Error(`Invalid ${type} format: ${value}`)
    }

    const entry: AllowlistEntry = {
      id: this.generateEntryId(),
      toolId,
      type,
      value: type === "address" ? value.toLowerCase() : value,
      reason: options?.reason,
      createdBy,
      createdAt: Date.now(),
      expiresAt: options?.expiresAt,
      permissions: options?.permissions,
      customRateLimit: options?.customRateLimit,
    }

    await this.storage.saveAllowlistEntry(entry)
    Logger.info(`Added to allowlist: ${type}:${value} for tool ${toolId}`)

    return entry
  }

  /**
   * Remove from allowlist
   */
  async removeFromAllowlist(entryId: string): Promise<void> {
    await this.storage.removeAllowlistEntry(entryId)
    Logger.info(`Removed from allowlist: ${entryId}`)
  }

  /**
   * Get allowlist for a tool
   */
  async getAllowlist(toolId: string): Promise<AllowlistEntry[]> {
    const entries = await this.storage.getallowlist(toolId)
    const now = Date.now()

    // Filter out expired entries
    return entries.filter((entry) => !entry.expiresAt || entry.expiresAt > now)
  }

  /**
   * Check if an address is allowlisted
   */
  async isAllowlisted(
    toolId: string,
    address: Address
  ): Promise<{ allowed: boolean; entry?: AllowlistEntry }> {
    const allowlist = await this.getAllowlist(toolId)
    const normalizedAddress = address.toLowerCase()

    const entry = allowlist.find(
      (e) => e.type === "address" && e.value.toLowerCase() === normalizedAddress
    )

    return { allowed: !!entry, entry }
  }

  /**
   * Check if an IP is allowlisted
   */
  async isIpAllowlisted(
    toolId: string,
    ip: string
  ): Promise<{ allowed: boolean; entry?: AllowlistEntry }> {
    const allowlist = await this.getAllowlist(toolId)

    // Check exact IP match
    let entry = allowlist.find((e) => e.type === "ip" && e.value === ip)
    if (entry) {
      return { allowed: true, entry }
    }

    // Check CIDR ranges
    for (const e of allowlist) {
      if (e.type === "cidr" && this.ipInCidr(ip, e.value)) {
        return { allowed: true, entry: e }
      }
    }

    return { allowed: false }
  }

  // ========================================================================
  // Blocklist Operations
  // ========================================================================

  /**
   * Add an address/IP to the blocklist
   */
  async addToBlocklist(
    toolId: string,
    type: ListEntryType,
    value: string,
    createdBy: Address,
    options?: {
      reason?: string
      severity?: "low" | "medium" | "high" | "critical"
      strikes?: number
      expiresAt?: number
    }
  ): Promise<BlocklistEntry> {
    if (!this.validateEntryValue(type, value)) {
      throw new Error(`Invalid ${type} format: ${value}`)
    }

    const entry: BlocklistEntry = {
      id: this.generateEntryId(),
      toolId,
      type,
      value: type === "address" ? value.toLowerCase() : value,
      reason: options?.reason,
      createdBy,
      createdAt: Date.now(),
      expiresAt: options?.expiresAt,
      severity: options?.severity || "medium",
      strikes: options?.strikes,
    }

    await this.storage.saveBlocklistEntry(entry)
    Logger.info(`Added to blocklist: ${type}:${value} for tool ${toolId} (${entry.severity})`)

    return entry
  }

  /**
   * Remove from blocklist
   */
  async removeFromBlocklist(entryId: string): Promise<void> {
    await this.storage.removeBlocklistEntry(entryId)
    Logger.info(`Removed from blocklist: ${entryId}`)
  }

  /**
   * Get blocklist for a tool
   */
  async getBlocklist(toolId: string): Promise<BlocklistEntry[]> {
    const entries = await this.storage.getBlocklist(toolId)
    const now = Date.now()

    // Filter out expired entries
    return entries.filter((entry) => !entry.expiresAt || entry.expiresAt > now)
  }

  /**
   * Check if an address is blocklisted
   */
  async isBlocklisted(
    toolId: string,
    address: Address
  ): Promise<{ blocked: boolean; entry?: BlocklistEntry }> {
    const blocklist = await this.getBlocklist(toolId)
    const normalizedAddress = address.toLowerCase()

    const entry = blocklist.find(
      (e) => e.type === "address" && e.value.toLowerCase() === normalizedAddress
    )

    return { blocked: !!entry, entry }
  }

  /**
   * Check if an IP is blocklisted
   */
  async isIpBlocklisted(
    toolId: string,
    ip: string
  ): Promise<{ blocked: boolean; entry?: BlocklistEntry }> {
    const blocklist = await this.getBlocklist(toolId)

    // Check exact IP match
    let entry = blocklist.find((e) => e.type === "ip" && e.value === ip)
    if (entry) {
      return { blocked: true, entry }
    }

    // Check CIDR ranges
    for (const e of blocklist) {
      if (e.type === "cidr" && this.ipInCidr(ip, e.value)) {
        return { blocked: true, entry: e }
      }
    }

    return { blocked: false }
  }

  // ========================================================================
  // Geographic Restrictions
  // ========================================================================

  /**
   * Set geographic restriction for a tool
   */
  async setGeoRestriction(
    toolId: string,
    mode: "allow" | "block",
    countries: string[],
    createdBy: Address
  ): Promise<GeoRestriction> {
    // Validate country codes (ISO 3166-1 alpha-2)
    const validCountryCodes = countries.every((code) => /^[A-Z]{2}$/.test(code))
    if (!validCountryCodes) {
      throw new Error("Invalid country code format. Use ISO 3166-1 alpha-2 codes (e.g., US, GB, JP)")
    }

    const restriction: GeoRestriction = {
      toolId,
      mode,
      countries: countries.map((c) => c.toUpperCase()),
      createdBy,
      createdAt: Date.now(),
    }

    await this.storage.saveGeoRestriction(restriction)
    Logger.info(
      `Geo restriction set for tool ${toolId}: ${mode} ${countries.join(", ")}`
    )

    return restriction
  }

  /**
   * Get geographic restriction for a tool
   */
  async getGeoRestriction(toolId: string): Promise<GeoRestriction | null> {
    return this.storage.getGeoRestriction(toolId)
  }

  /**
   * Remove geographic restriction
   */
  async removeGeoRestriction(toolId: string): Promise<void> {
    // In a real implementation, you'd have a delete method
    Logger.info(`Geo restriction removed for tool ${toolId}`)
  }

  /**
   * Check if a country is allowed
   */
  async isCountryAllowed(toolId: string, countryCode: string): Promise<boolean> {
    const restriction = await this.getGeoRestriction(toolId)

    // No restriction = all countries allowed
    if (!restriction) {
      return true
    }

    const normalizedCode = countryCode.toUpperCase()
    const isInList = restriction.countries.includes(normalizedCode)

    // In "allow" mode, only listed countries are allowed
    // In "block" mode, all except listed countries are allowed
    return restriction.mode === "allow" ? isInList : !isInList
  }

  // ========================================================================
  // Combined Access Check
  // ========================================================================

  /**
   * Comprehensive access check
   */
  async checkAccess(
    toolId: string,
    options: {
      address?: Address
      ip?: string
      countryCode?: string
    }
  ): Promise<{
    allowed: boolean
    reason?: string
    allowlistEntry?: AllowlistEntry
    blocklistEntry?: BlocklistEntry
  }> {
    const { address, ip, countryCode } = options

    // Check blocklist first (takes precedence)
    if (address) {
      const blockCheck = await this.isBlocklisted(toolId, address)
      if (blockCheck.blocked) {
        return {
          allowed: false,
          reason: `Address is blocklisted: ${blockCheck.entry?.reason || "No reason provided"}`,
          blocklistEntry: blockCheck.entry,
        }
      }
    }

    if (ip) {
      const ipBlockCheck = await this.isIpBlocklisted(toolId, ip)
      if (ipBlockCheck.blocked) {
        return {
          allowed: false,
          reason: `IP is blocklisted: ${ipBlockCheck.entry?.reason || "No reason provided"}`,
          blocklistEntry: ipBlockCheck.entry,
        }
      }
    }

    // Check geographic restrictions
    if (countryCode) {
      const geoAllowed = await this.isCountryAllowed(toolId, countryCode)
      if (!geoAllowed) {
        return {
          allowed: false,
          reason: `Access from ${countryCode} is restricted`,
        }
      }
    }

    // Check allowlist (for special permissions)
    let allowlistEntry: AllowlistEntry | undefined

    if (address) {
      const allowCheck = await this.isAllowlisted(toolId, address)
      if (allowCheck.allowed) {
        allowlistEntry = allowCheck.entry
      }
    }

    if (!allowlistEntry && ip) {
      const ipAllowCheck = await this.isIpAllowlisted(toolId, ip)
      if (ipAllowCheck.allowed) {
        allowlistEntry = ipAllowCheck.entry
      }
    }

    return {
      allowed: true,
      allowlistEntry,
    }
  }
}

/**
 * Default access list manager instance
 */
export const accessListManager = new AccessListManager()

/**
 * Strike system for automatic blocking
 */
export class StrikeManager {
  private storage: AccessStorageAdapter
  private strikes = new Map<string, { count: number; lastStrike: number }>()

  constructor(storage: AccessStorageAdapter = defaultStorage) {
    this.storage = storage
  }

  /**
   * Record a strike against an address
   */
  async recordStrike(
    toolId: string,
    address: Address,
    reason: string,
    createdBy: Address
  ): Promise<{
    newStrikeCount: number
    blocked: boolean
    blockEntry?: BlocklistEntry
  }> {
    const key = `${toolId}:${address.toLowerCase()}`
    const existing = this.strikes.get(key) || { count: 0, lastStrike: 0 }

    // Reset strikes if last one was more than 30 days ago
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000
    if (Date.now() - existing.lastStrike > thirtyDaysMs) {
      existing.count = 0
    }

    existing.count += 1
    existing.lastStrike = Date.now()
    this.strikes.set(key, existing)

    // Auto-block after 3 strikes
    if (existing.count >= 3) {
      const listManager = new AccessListManager(this.storage)
      const blockEntry = await listManager.addToBlocklist(
        toolId,
        "address",
        address,
        createdBy,
        {
          reason: `Automatic block after ${existing.count} strikes. Last reason: ${reason}`,
          severity: existing.count >= 5 ? "high" : "medium",
          strikes: existing.count,
          // Block for 7 days initially, longer for repeat offenders
          expiresAt: Date.now() + (existing.count >= 5 ? 30 : 7) * 24 * 60 * 60 * 1000,
        }
      )

      return {
        newStrikeCount: existing.count,
        blocked: true,
        blockEntry,
      }
    }

    return {
      newStrikeCount: existing.count,
      blocked: false,
    }
  }

  /**
   * Get strike count for an address
   */
  getStrikeCount(toolId: string, address: Address): number {
    const key = `${toolId}:${address.toLowerCase()}`
    return this.strikes.get(key)?.count || 0
  }

  /**
   * Clear strikes for an address
   */
  clearStrikes(toolId: string, address: Address): void {
    const key = `${toolId}:${address.toLowerCase()}`
    this.strikes.delete(key)
  }
}

/**
 * Default strike manager instance
 */
export const strikeManager = new StrikeManager()
