/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { formatEther, parseEther } from "viem"

/**
 * Utility functions for formatting and parsing values
 */
export const utils = {
  // Convert ether to wei
  parseEther,

  // Convert wei to ether
  formatEther,

  // Format a bigint to a string
  formatBigInt: (value: bigint): string => value.toString(),

  // Format an object to JSON with bigint handling
  formatJson: (obj: unknown): string =>
    JSON.stringify(
      obj,
      (_, value) => (typeof value === "bigint" ? value.toString() : value),
      2
    ),

  // Format a number with commas
  formatNumber: (value: number | string): string => {
    return Number(value).toLocaleString()
  },

  // Convert a hex string to a number
  hexToNumber: (hex: string): number => {
    return parseInt(hex, 16)
  },

  // Convert a number to a hex string
  numberToHex: (num: number): string => {
    return "0x" + num.toString(16)
  }
}
