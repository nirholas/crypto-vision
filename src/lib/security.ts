/**
 * Crypto Vision — Security Hardening Utilities
 *
 * Reusable security functions for input sanitization, response safety,
 * and defense-in-depth measures. Used across routes and middleware.
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

// ─── Input Sanitization ─────────────────────────────────────

/**
 * Sanitize user input by stripping HTML, limiting length, and trimming.
 * Does NOT encode — use this for internal storage, not output rendering.
 */
export function sanitizeInput(input: string, maxLength = 1000): string {
  return input
    .slice(0, maxLength)
    .replace(/<[^>]*>/g, "")  // Strip all HTML tags
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")  // Strip control chars (keep \n, \r, \t)
    .trim();
}

/**
 * Sanitize a string for safe embedding in HTML contexts.
 * Encodes the 5 key characters that enable HTML/XSS injection.
 */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/**
 * Validate and sanitize a coin/protocol ID.
 * Only allows alphanumeric, hyphens, and underscores.
 * Returns null if the ID is invalid.
 */
export function sanitizeCoinId(id: string): string | null {
  const trimmed = id.trim().toLowerCase().slice(0, 128);
  return /^[a-z0-9_-]+$/.test(trimmed) ? trimmed : null;
}

/**
 * Validate an Ethereum hex address (40 hex chars after 0x prefix).
 */
export function isValidHexAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// ─── Path Traversal Protection ───────────────────────────────

/**
 * Check if a path contains traversal sequences.
 * Used to prevent directory traversal attacks on file/path-based endpoints.
 */
export function hasPathTraversal(input: string): boolean {
  const decoded = decodeURIComponent(input);
  return /\.\.[/\\]/.test(decoded) || decoded.includes("\x00");
}

// ─── Request Safety ──────────────────────────────────────────

/**
 * Validate that a request body size is within limits.
 * Returns true if the body is acceptable, false if too large.
 */
export function isBodySizeAcceptable(
  contentLength: number | undefined,
  maxBytes = 256 * 1024,
): boolean {
  if (contentLength === undefined) return true; // trust body-limit middleware
  return contentLength <= maxBytes;
}

// ─── Response Safety ─────────────────────────────────────────

/**
 * Strip sensitive data from error objects before sending to clients.
 * Never exposes stack traces, internal paths, or environment variables.
 */
export function sanitizeError(error: unknown): {
  message: string;
  code?: string;
} {
  if (error instanceof Error) {
    // Never leak stack traces or internal paths
    const message = error.message
      .replace(/\/[^\s]+/g, "[path]")      // Redact file paths
      .replace(/at\s+.+\(.+\)/g, "")       // Strip stack frames
      .replace(/\b(password|secret|key|token)\b[=:]\S+/gi, "[redacted]"); // Redact secrets

    return {
      message: message.slice(0, 500),
      code: "code" in error ? String((error as Record<string, unknown>).code) : undefined,
    };
  }

  return { message: "An unexpected error occurred" };
}

/**
 * Create a safe error response that never leaks internals.
 * Suitable for direct use in HTTP responses.
 */
export function safeErrorResponse(
  status: number,
  message: string,
  details?: string,
): { error: { status: number; message: string; details?: string } } {
  return {
    error: {
      status,
      message: sanitizeInput(message, 500),
      ...(details ? { details: sanitizeInput(details, 1000) } : {}),
    },
  };
}

// ─── Rate Limit Key Generation ───────────────────────────────

/**
 * Extract a stable client identifier for rate limiting.
 * Prefers X-Forwarded-For (behind load balancer), falls back to remote IP.
 * Strips port numbers and normalizes IPv6.
 */
export function extractClientIp(
  remoteAddr: string,
  forwardedFor?: string,
): string {
  const raw = forwardedFor?.split(",")[0]?.trim() || remoteAddr;
  // Strip port from IPv4:port
  const ip = raw.replace(/:\d+$/, "");
  // Normalize IPv6 loopback
  if (ip === "::1") return "127.0.0.1";
  return ip;
}

// ─── Content-Type Validation ─────────────────────────────────

/**
 * Validate that a Content-Type header is JSON.
 * Used in POST body validation middleware.
 */
export function isJsonContentType(contentType: string | undefined): boolean {
  if (!contentType) return false;
  const normalized = contentType.toLowerCase().split(";")[0].trim();
  return normalized === "application/json";
}

// ─── API Key Validation ──────────────────────────────────────

/**
 * Constant-time string comparison to prevent timing attacks on API keys.
 * Returns true if the two strings are equal.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
