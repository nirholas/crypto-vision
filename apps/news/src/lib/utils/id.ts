/**
 * ID Generation Utilities
 * 
 * Provides cryptographically secure, unique ID generation
 * for all system components.
 * 
 * Compatible with Edge runtime (uses Web Crypto API).
 * 
 * @module lib/utils/id
 */

/**
 * Generate a UUID using Web Crypto API (Edge-compatible)
 */
function getRandomUUID(): string {
  // Use Web Crypto API (works in Edge runtime)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback: generate UUID v4 manually
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    // Last resort fallback (should never happen in modern runtimes)
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  // Set version (4) and variant bits
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Generate a cryptographically secure unique ID with optional prefix
 * Uses crypto.randomUUID() for maximum uniqueness and security
 * 
 * @param prefix - Optional prefix to identify the ID type (e.g., 'alert', 'export', 'session')
 * @returns A unique ID string in format: prefix_uuid or just uuid
 * 
 * @example
 * generateId() // "550e8400-e29b-41d4-a716-446655440000"
 * generateId('alert') // "alert_550e8400-e29b-41d4-a716-446655440000"
 * generateId('export') // "export_550e8400-e29b-41d4-a716-446655440000"
 */
export function generateId(prefix?: string): string {
  const uuid = getRandomUUID();
  return prefix ? `${prefix}_${uuid}` : uuid;
}

/**
 * Generate a short unique ID for cases where full UUID is too long
 * Uses timestamp + crypto random for uniqueness while keeping it shorter
 * 
 * @param prefix - Required prefix to identify the ID type
 * @returns A shorter unique ID string in format: prefix_timestamp_random
 * 
 * @example
 * generateShortId('bt') // "bt_l8x9y2z3_a1b2c3d4"
 * generateShortId('ws') // "ws_l8x9y2z3_e5f6g7h8"
 */
export function generateShortId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  // Use crypto.getRandomValues for secure random component
  const randomBytes = new Uint8Array(6);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(randomBytes);
  } else {
    // Fallback (should not happen in modern runtimes)
    for (let i = 0; i < 6; i++) {
      randomBytes[i] = Math.floor(Math.random() * 256);
    }
  }
  const random = Array.from(randomBytes)
    .map(b => b.toString(36).padStart(2, '0'))
    .join('')
    .substring(0, 8);
  
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Generate a verification token (for email verification, password reset, etc.)
 * Uses full UUID for maximum security
 * 
 * @returns A secure verification token
 */
export function generateVerificationToken(): string {
  return getRandomUUID().replace(/-/g, '') + getRandomUUID().replace(/-/g, '');
}

/**
 * Validate if a string looks like a valid ID from this system
 * 
 * @param id - The ID string to validate
 * @param expectedPrefix - Optional expected prefix
 * @returns true if the ID appears valid
 */
export function isValidId(id: string, expectedPrefix?: string): boolean {
  if (!id || typeof id !== 'string') return false;
  
  if (expectedPrefix) {
    if (!id.startsWith(`${expectedPrefix}_`)) return false;
  }
  
  // Check for UUID format (with or without prefix)
  const uuidPart = expectedPrefix ? id.substring(expectedPrefix.length + 1) : id;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const shortIdRegex = /^[0-9a-z]+_[0-9a-z]+$/i;
  
  return uuidRegex.test(uuidPart) || shortIdRegex.test(id);
}
