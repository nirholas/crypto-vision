/**
 * Security Scanner Service
 * @description Scans tool endpoints for security vulnerabilities and threats
 * @author nirholas
 * @license Apache-2.0
 */

import Logger from "@/utils/logger.js"
import type {
  SecurityScanResult,
  SecurityFinding,
  SecuritySeverity,
  DomainInfo,
  CORSPolicy,
  RedirectInfo,
} from "./types.js"

/**
 * Configuration for security scanning
 */
export interface SecurityScannerConfig {
  /** Maximum redirects to follow */
  maxRedirects: number
  /** Timeout for requests in milliseconds */
  requestTimeout: number
  /** Enable deep scanning (slower but more thorough) */
  deepScan: boolean
  /** Check external domain reputation APIs */
  checkDomainReputation: boolean
}

const DEFAULT_CONFIG: SecurityScannerConfig = {
  maxRedirects: 5,
  requestTimeout: 30000,
  deepScan: false,
  checkDomainReputation: true,
}

/**
 * Known malicious patterns
 */
const MALICIOUS_PATTERNS = {
  // Suspicious URL patterns
  suspiciousUrls: [
    /bit\.ly/i,
    /tinyurl\.com/i,
    /goo\.gl/i,
    /t\.co/i,
    /ow\.ly/i,
  ],
  // Phishing indicators
  phishingPatterns: [
    /login.*verify/i,
    /account.*confirm/i,
    /secure.*update/i,
    /wallet.*connect/i,
    /claim.*reward/i,
  ],
  // Malware indicators in responses
  malwarePatterns: [
    /<script[^>]*>.*eval\(/i,
    /document\.write\(unescape/i,
    /window\.location\s*=\s*["'][^"']*\?/i,
  ],
}

/**
 * In-memory storage for security scan data
 */
interface SecurityStorage {
  scans: Map<string, SecurityScanResult[]>
  blocklist: Set<string>
  domainCache: Map<string, DomainInfo>
}

const storage: SecurityStorage = {
  scans: new Map(),
  blocklist: new Set(),
  domainCache: new Map(),
}

/**
 * Security Scanner Service
 * Scans tool endpoints for security vulnerabilities and potential threats
 */
export class SecurityScanner {
  private config: SecurityScannerConfig

  constructor(config: Partial<SecurityScannerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Perform a full security scan on a tool endpoint
   */
  async scanEndpoint(toolId: string, endpoint: string): Promise<SecurityScanResult> {
    const findings: SecurityFinding[] = []
    const redirects: RedirectInfo[] = []

    Logger.debug(`Starting security scan for tool ${toolId}: ${endpoint}`)

    try {
      const url = new URL(endpoint)

      // Check URL for suspicious patterns
      this.checkSuspiciousUrl(endpoint, findings)

      // Check domain reputation
      const domainInfo = await this.checkDomainReputation(url.hostname)

      // Check SSL/TLS
      if (url.protocol === "https:") {
        await this.checkSSLSecurity(endpoint, findings)
      } else {
        findings.push({
          id: "no-https",
          severity: "high",
          category: "transport",
          title: "No HTTPS",
          description: "Endpoint does not use HTTPS encryption",
          remediation: "Enable HTTPS on the endpoint to encrypt traffic",
          cwe: "CWE-319",
        })
      }

      // Check for malicious redirects
      await this.checkRedirects(endpoint, redirects, findings)

      // Check CORS policy
      const corsPolicy = await this.checkCORSPolicy(endpoint)

      // Check response headers
      await this.checkSecurityHeaders(endpoint, findings)

      // Check response content for malicious patterns
      await this.checkResponseContent(endpoint, findings)

      // Calculate security score
      const score = this.calculateSecurityScore(findings, domainInfo)

      const result: SecurityScanResult = {
        toolId,
        timestamp: Date.now(),
        passed: findings.filter(f => f.severity === "critical" || f.severity === "high").length === 0,
        score,
        findings,
        domainInfo,
        corsPolicy,
        redirects,
      }

      // Store scan result
      this.storeScanResult(toolId, result)

      Logger.info(`Security scan completed for ${toolId}: score ${score}/100, ${findings.length} findings`)

      return result
    } catch (error) {
      const result: SecurityScanResult = {
        toolId,
        timestamp: Date.now(),
        passed: false,
        score: 0,
        findings: [{
          id: "scan-error",
          severity: "critical",
          category: "scan",
          title: "Security scan failed",
          description: error instanceof Error ? error.message : "Unknown error during scan",
        }],
        domainInfo: {
          domain: new URL(endpoint).hostname,
          reputation: "unknown",
          trustScore: 0,
          blacklisted: false,
          phishing: false,
          malware: false,
        },
        corsPolicy: null,
        redirects: [],
      }

      this.storeScanResult(toolId, result)
      return result
    }
  }

  /**
   * Check URL for suspicious patterns
   */
  private checkSuspiciousUrl(url: string, findings: SecurityFinding[]): void {
    // Check for URL shorteners
    for (const pattern of MALICIOUS_PATTERNS.suspiciousUrls) {
      if (pattern.test(url)) {
        findings.push({
          id: "url-shortener",
          severity: "medium",
          category: "url",
          title: "URL shortener detected",
          description: "Endpoint uses a URL shortener which can obscure malicious destinations",
          remediation: "Use direct URLs instead of shortened URLs",
        })
        break
      }
    }

    // Check for suspicious query parameters
    const urlObj = new URL(url)
    const suspiciousParams = ["redirect", "url", "next", "return", "callback", "goto"]
    for (const param of suspiciousParams) {
      if (urlObj.searchParams.has(param)) {
        findings.push({
          id: "suspicious-param",
          severity: "low",
          category: "url",
          title: "Suspicious URL parameter",
          description: `URL contains potentially dangerous parameter: ${param}`,
          remediation: "Review if this parameter is necessary",
        })
      }
    }

    // Check for IP address instead of domain
    const ipPattern = /^https?:\/\/(\d{1,3}\.){3}\d{1,3}/
    if (ipPattern.test(url)) {
      findings.push({
        id: "ip-address-url",
        severity: "medium",
        category: "url",
        title: "IP address in URL",
        description: "Endpoint uses IP address instead of domain name",
        remediation: "Use a proper domain name with valid SSL certificate",
      })
    }
  }

  /**
   * Check domain reputation
   */
  async checkDomainReputation(domain: string): Promise<DomainInfo> {
    // Check cache first
    const cached = storage.domainCache.get(domain)
    if (cached && Date.now() - (cached.registeredAt || 0) < 24 * 60 * 60 * 1000) {
      return cached
    }

    // In production, you would call external APIs like:
    // - Google Safe Browsing API
    // - VirusTotal API
    // - PhishTank API
    // For now, we'll do basic checks

    const domainInfo: DomainInfo = {
      domain,
      reputation: "neutral",
      trustScore: 50,
      blacklisted: false,
      phishing: false,
      malware: false,
    }

    // Check against local blocklist
    if (storage.blocklist.has(domain)) {
      domainInfo.reputation = "malicious"
      domainInfo.trustScore = 0
      domainInfo.blacklisted = true
    }

    // Check for known trusted TLDs
    const trustedTLDs = [".gov", ".edu", ".mil"]
    const suspiciousTLDs = [".tk", ".ml", ".ga", ".cf", ".gq", ".xyz", ".top"]

    for (const tld of trustedTLDs) {
      if (domain.endsWith(tld)) {
        domainInfo.trustScore = Math.min(domainInfo.trustScore + 20, 100)
        domainInfo.reputation = "good"
        break
      }
    }

    for (const tld of suspiciousTLDs) {
      if (domain.endsWith(tld)) {
        domainInfo.trustScore = Math.max(domainInfo.trustScore - 20, 0)
        if (domainInfo.trustScore < 30) {
          domainInfo.reputation = "suspicious"
        }
        break
      }
    }

    // Check domain age (simulated)
    // In production, you'd use WHOIS lookup
    domainInfo.registeredAt = Date.now() - 365 * 24 * 60 * 60 * 1000 // Simulated 1 year old

    // Cache the result
    storage.domainCache.set(domain, domainInfo)

    return domainInfo
  }

  /**
   * Check SSL/TLS security
   */
  private async checkSSLSecurity(endpoint: string, findings: SecurityFinding[]): Promise<void> {
    try {
      // Basic SSL check via fetch
      const response = await fetch(endpoint, {
        method: "HEAD",
      })

      // In production, you'd use a TLS library to check:
      // - Certificate validity
      // - Certificate chain
      // - TLS version
      // - Cipher suites
      // - HSTS

      // Check for HSTS header
      const hsts = response.headers.get("strict-transport-security")
      if (!hsts) {
        findings.push({
          id: "no-hsts",
          severity: "medium",
          category: "headers",
          title: "No HSTS header",
          description: "Missing HTTP Strict Transport Security header",
          remediation: "Add Strict-Transport-Security header with max-age",
          cwe: "CWE-523",
        })
      }
    } catch (error) {
      findings.push({
        id: "ssl-error",
        severity: "high",
        category: "ssl",
        title: "SSL/TLS error",
        description: error instanceof Error ? error.message : "SSL certificate validation failed",
        remediation: "Ensure SSL certificate is valid and properly configured",
        cwe: "CWE-295",
      })
    }
  }

  /**
   * Check for malicious redirects
   */
  private async checkRedirects(
    endpoint: string,
    redirects: RedirectInfo[],
    findings: SecurityFinding[]
  ): Promise<void> {
    let currentUrl = endpoint
    const visited = new Set<string>()

    for (let i = 0; i < this.config.maxRedirects; i++) {
      if (visited.has(currentUrl)) {
        findings.push({
          id: "redirect-loop",
          severity: "high",
          category: "redirect",
          title: "Redirect loop detected",
          description: `Circular redirect detected at ${currentUrl}`,
          remediation: "Fix the redirect configuration to prevent loops",
        })
        break
      }

      visited.add(currentUrl)

      try {
        const response = await fetch(currentUrl, {
          method: "HEAD",
          redirect: "manual",
        })

        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get("location")
          if (location) {
            const nextUrl = new URL(location, currentUrl).toString()
            const redirect: RedirectInfo = {
              from: currentUrl,
              to: nextUrl,
              statusCode: response.status,
              suspicious: false,
            }

            // Check if redirect goes to a different domain
            const fromDomain = new URL(currentUrl).hostname
            const toDomain = new URL(nextUrl).hostname

            if (fromDomain !== toDomain) {
              redirect.suspicious = true
              redirect.reason = "Cross-domain redirect"
              findings.push({
                id: "cross-domain-redirect",
                severity: "medium",
                category: "redirect",
                title: "Cross-domain redirect",
                description: `Redirect from ${fromDomain} to ${toDomain}`,
                remediation: "Verify the redirect target is legitimate",
              })
            }

            redirects.push(redirect)
            currentUrl = nextUrl
          } else {
            break
          }
        } else {
          break
        }
      } catch {
        break
      }
    }

    if (redirects.length > 3) {
      findings.push({
        id: "excessive-redirects",
        severity: "low",
        category: "redirect",
        title: "Excessive redirects",
        description: `${redirects.length} redirects detected`,
        remediation: "Reduce the number of redirects for better performance",
      })
    }
  }

  /**
   * Check CORS policy
   */
  private async checkCORSPolicy(endpoint: string): Promise<CORSPolicy | null> {
    try {
      const response = await fetch(endpoint, {
        method: "OPTIONS",
        headers: {
          "Origin": "https://test-origin.com",
          "Access-Control-Request-Method": "GET",
        },
      })

      const corsPolicy: CORSPolicy = {
        allowedOrigins: [],
        allowedMethods: [],
        allowedHeaders: [],
        exposeHeaders: [],
        allowCredentials: false,
        maxAge: 0,
        issues: [],
      }

      // Parse CORS headers
      const allowOrigin = response.headers.get("access-control-allow-origin")
      if (allowOrigin) {
        corsPolicy.allowedOrigins = allowOrigin === "*" ? ["*"] : [allowOrigin]
        if (allowOrigin === "*") {
          corsPolicy.issues.push("Wildcard origin allows any domain")
        }
      }

      const allowMethods = response.headers.get("access-control-allow-methods")
      if (allowMethods) {
        corsPolicy.allowedMethods = allowMethods.split(",").map(m => m.trim())
      }

      const allowHeaders = response.headers.get("access-control-allow-headers")
      if (allowHeaders) {
        corsPolicy.allowedHeaders = allowHeaders.split(",").map(h => h.trim())
      }

      const exposeHeaders = response.headers.get("access-control-expose-headers")
      if (exposeHeaders) {
        corsPolicy.exposeHeaders = exposeHeaders.split(",").map(h => h.trim())
      }

      const allowCredentials = response.headers.get("access-control-allow-credentials")
      corsPolicy.allowCredentials = allowCredentials === "true"

      if (corsPolicy.allowCredentials && corsPolicy.allowedOrigins.includes("*")) {
        corsPolicy.issues.push("Credentials allowed with wildcard origin is a security risk")
      }

      const maxAge = response.headers.get("access-control-max-age")
      if (maxAge) {
        corsPolicy.maxAge = parseInt(maxAge, 10)
      }

      return corsPolicy
    } catch {
      return null
    }
  }

  /**
   * Check security-related response headers
   */
  private async checkSecurityHeaders(endpoint: string, findings: SecurityFinding[]): Promise<void> {
    try {
      const response = await fetch(endpoint, { method: "HEAD" })

      const securityHeaders: Record<string, { severity: SecuritySeverity; message: string }> = {
        "x-content-type-options": {
          severity: "medium",
          message: "Missing X-Content-Type-Options header (prevents MIME sniffing)",
        },
        "x-frame-options": {
          severity: "medium",
          message: "Missing X-Frame-Options header (prevents clickjacking)",
        },
        "x-xss-protection": {
          severity: "low",
          message: "Missing X-XSS-Protection header",
        },
        "content-security-policy": {
          severity: "medium",
          message: "Missing Content-Security-Policy header",
        },
        "referrer-policy": {
          severity: "low",
          message: "Missing Referrer-Policy header",
        },
      }

      for (const [header, info] of Object.entries(securityHeaders)) {
        if (!response.headers.get(header)) {
          findings.push({
            id: `missing-${header}`,
            severity: info.severity,
            category: "headers",
            title: `Missing ${header}`,
            description: info.message,
            remediation: `Add the ${header} header to responses`,
          })
        }
      }

      // Check for information disclosure
      const serverHeader = response.headers.get("server")
      if (serverHeader && /\d+\.\d+/.test(serverHeader)) {
        findings.push({
          id: "server-version-disclosure",
          severity: "info",
          category: "headers",
          title: "Server version disclosed",
          description: `Server header reveals version information: ${serverHeader}`,
          remediation: "Remove or obfuscate the Server header version",
          cwe: "CWE-200",
        })
      }

      const poweredBy = response.headers.get("x-powered-by")
      if (poweredBy) {
        findings.push({
          id: "x-powered-by",
          severity: "info",
          category: "headers",
          title: "X-Powered-By header present",
          description: `X-Powered-By header reveals technology: ${poweredBy}`,
          remediation: "Remove the X-Powered-By header",
          cwe: "CWE-200",
        })
      }
    } catch {
      // Ignore header check errors
    }
  }

  /**
   * Check response content for malicious patterns
   */
  private async checkResponseContent(endpoint: string, findings: SecurityFinding[]): Promise<void> {
    try {
      const response = await fetch(endpoint)
      const content = await response.text()

      // Check for malware patterns
      for (const pattern of MALICIOUS_PATTERNS.malwarePatterns) {
        if (pattern.test(content)) {
          findings.push({
            id: "malicious-script",
            severity: "critical",
            category: "content",
            title: "Potentially malicious script detected",
            description: "Response contains patterns commonly associated with malicious scripts",
            remediation: "Review and remove any suspicious code",
            cwe: "CWE-94",
          })
          break
        }
      }

      // Check for phishing patterns
      for (const pattern of MALICIOUS_PATTERNS.phishingPatterns) {
        if (pattern.test(content)) {
          findings.push({
            id: "phishing-indicator",
            severity: "high",
            category: "content",
            title: "Potential phishing indicator",
            description: "Response contains patterns commonly associated with phishing",
            remediation: "Review content for phishing attempts",
          })
          break
        }
      }

      // Check for sensitive data exposure
      const sensitivePatterns = [
        { pattern: /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/i, name: "API key" },
        { pattern: /password\s*[:=]\s*['"][^'"]+['"]/i, name: "Password" },
        { pattern: /secret\s*[:=]\s*['"][^'"]+['"]/i, name: "Secret" },
        { pattern: /private[_-]?key/i, name: "Private key" },
      ]

      for (const { pattern, name } of sensitivePatterns) {
        if (pattern.test(content)) {
          findings.push({
            id: "sensitive-data-exposure",
            severity: "critical",
            category: "content",
            title: "Potential sensitive data exposure",
            description: `Response may contain exposed ${name}`,
            remediation: "Remove sensitive data from public responses",
            cwe: "CWE-200",
          })
        }
      }
    } catch {
      // Ignore content check errors
    }
  }

  /**
   * Calculate security score based on findings
   */
  private calculateSecurityScore(findings: SecurityFinding[], domainInfo: DomainInfo): number {
    let score = 100

    // Deduct points based on severity
    const severityDeductions: Record<SecuritySeverity, number> = {
      critical: 30,
      high: 20,
      medium: 10,
      low: 5,
      info: 1,
    }

    for (const finding of findings) {
      score -= severityDeductions[finding.severity]
    }

    // Factor in domain reputation
    score = score * (domainInfo.trustScore / 100)

    // Ensure score is within bounds
    return Math.max(0, Math.min(100, Math.round(score)))
  }

  /**
   * Store scan result
   */
  private storeScanResult(toolId: string, result: SecurityScanResult): void {
    const existing = storage.scans.get(toolId) || []

    // Keep last 50 scans
    if (existing.length >= 50) {
      existing.shift()
    }

    existing.push(result)
    storage.scans.set(toolId, existing)
  }

  /**
   * Get scan history for a tool
   */
  getScanHistory(toolId: string, limit: number = 10): SecurityScanResult[] {
    const scans = storage.scans.get(toolId) || []
    return scans.slice(-limit)
  }

  /**
   * Get latest scan result for a tool
   */
  getLatestScan(toolId: string): SecurityScanResult | null {
    const scans = storage.scans.get(toolId) || []
    return scans.length > 0 ? (scans[scans.length - 1] ?? null) : null
  }

  /**
   * Add domain to blocklist
   */
  addToBlocklist(domain: string): void {
    storage.blocklist.add(domain.toLowerCase())
    Logger.warn(`Domain added to blocklist: ${domain}`)
  }

  /**
   * Remove domain from blocklist
   */
  removeFromBlocklist(domain: string): void {
    storage.blocklist.delete(domain.toLowerCase())
    Logger.info(`Domain removed from blocklist: ${domain}`)
  }

  /**
   * Check if domain is blocklisted
   */
  isBlocklisted(domain: string): boolean {
    return storage.blocklist.has(domain.toLowerCase())
  }

  /**
   * Get all blocklisted domains
   */
  getBlocklist(): string[] {
    return Array.from(storage.blocklist)
  }

  /**
   * Quick security check (faster, less thorough)
   */
  async quickCheck(endpoint: string): Promise<{
    passed: boolean
    score: number
    criticalFindings: SecurityFinding[]
  }> {
    const findings: SecurityFinding[] = []

    try {
      const url = new URL(endpoint)

      // Quick URL check
      this.checkSuspiciousUrl(endpoint, findings)

      // Check if blocklisted
      if (this.isBlocklisted(url.hostname)) {
        findings.push({
          id: "blocklisted",
          severity: "critical",
          category: "blocklist",
          title: "Domain is blocklisted",
          description: `Domain ${url.hostname} is on the security blocklist`,
        })
      }

      // Quick SSL check
      if (url.protocol !== "https:") {
        findings.push({
          id: "no-https",
          severity: "high",
          category: "transport",
          title: "No HTTPS",
          description: "Endpoint does not use HTTPS",
        })
      }

      const criticalFindings = findings.filter(
        f => f.severity === "critical" || f.severity === "high"
      )

      return {
        passed: criticalFindings.length === 0,
        score: Math.max(0, 100 - criticalFindings.length * 25),
        criticalFindings,
      }
    } catch (error) {
      return {
        passed: false,
        score: 0,
        criticalFindings: [{
          id: "check-error",
          severity: "critical",
          category: "error",
          title: "Security check failed",
          description: error instanceof Error ? error.message : "Unknown error",
        }],
      }
    }
  }
}

/**
 * Singleton instance
 */
export const securityScanner = new SecurityScanner()
