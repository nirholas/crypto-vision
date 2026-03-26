/**
 * Safely parse a hex string to BigInt.
 * Returns null if the input is not valid hex.
 */
export function safeHexToBigInt(hex: unknown): bigint | null {
  if (typeof hex !== 'string') return null;
  const normalized = hex.startsWith('0x') ? hex : `0x${hex}`;
  if (!/^0x[0-9a-fA-F]+$/.test(normalized)) return null;
  try {
    return BigInt(normalized);
  } catch {
    return null;
  }
}

/**
 * Safely normalize a hex address.
 * Returns null if not a valid 20-byte Ethereum address.
 */
export function safeNormalizeAddress(addr: unknown): string | null {
  if (typeof addr !== 'string') return null;
  if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) return null;
  return addr.toLowerCase();
}

/**
 * Convert a USDC base-unit amount (6 decimals) to a display string.
 * E.g. 100000n → "0.100000 USDC"
 */
export function formatUsdc(amount: bigint): string {
  const str = amount.toString().padStart(7, '0');
  const whole = str.slice(0, -6) || '0';
  const frac = str.slice(-6);
  return `${whole}.${frac} USDC`;
}
