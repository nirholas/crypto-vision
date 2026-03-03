/**
 * Verification Types
 * @description Type definitions for the tool verification system
 * @author nirholas
 * @license Apache-2.0
 */

import type { Address } from "viem"

/**
 * Verification status levels
 */
export type VerificationStatus =
  | "pending"
  | "verified"
  | "failed"
  | "expired"
  | "suspended"

/**
 * Endpoint health status
 */
export type EndpointHealthStatus = "healthy" | "degraded" | "down" | "unknown"

/**
 * SSL certificate info
 */
export interface SSLCertificateInfo {
  valid: boolean
  issuer: string
  subject: string
  expiresAt: number
  daysUntilExpiry: number
  grade?: "A" | "B" | "C" | "D" | "F"
}

/**
 * Endpoint check result
 */
export interface EndpointCheckResult {
  toolId: string
  endpoint: string
  timestamp: number
  status: EndpointHealthStatus
  statusCode: number | null
  responseTime: number
  ssl: SSLCertificateInfo | null
  error?: string
  validResponse: boolean
}

/**
 * Uptime record for a tool
 */
export interface UptimeRecord {
  toolId: string
  period: "hour" | "day" | "week" | "month"
  totalChecks: number
  successfulChecks: number
  uptimePercent: number
  avgResponseTime: number
  minResponseTime: number
  maxResponseTime: number
  lastChecked: number
}

/**
 * Schema validation result
 */
export interface SchemaValidationResult {
  toolId: string
  timestamp: number
  valid: boolean
  schemaType: "openapi" | "jsonschema" | "custom"
  schemaVersion?: string
  errors: SchemaError[]
  warnings: SchemaWarning[]
}

/**
 * Schema error detail
 */
export interface SchemaError {
  path: string
  message: string
  keyword: string
  expectedType?: string
  actualType?: string
}

/**
 * Schema warning
 */
export interface SchemaWarning {
  path: string
  message: string
  suggestion?: string
}

/**
 * Tool declared schema
 */
export interface ToolSchema {
  toolId: string
  type: "openapi" | "jsonschema" | "custom"
  version?: string
  schema: Record<string, unknown>
  declaredAt: number
  lastValidated?: number
  validationHistory: SchemaValidationResult[]
}

/**
 * Security scan severity levels
 */
export type SecuritySeverity = "critical" | "high" | "medium" | "low" | "info"

/**
 * Security finding
 */
export interface SecurityFinding {
  id: string
  severity: SecuritySeverity
  category: string
  title: string
  description: string
  remediation?: string
  cwe?: string // Common Weakness Enumeration
}

/**
 * Security scan result
 */
export interface SecurityScanResult {
  toolId: string
  timestamp: number
  passed: boolean
  score: number // 0-100
  findings: SecurityFinding[]
  domainInfo: DomainInfo
  corsPolicy: CORSPolicy | null
  redirects: RedirectInfo[]
}

/**
 * Domain reputation info
 */
export interface DomainInfo {
  domain: string
  registeredAt?: number
  registrar?: string
  reputation: "good" | "neutral" | "suspicious" | "malicious" | "unknown"
  trustScore: number // 0-100
  blacklisted: boolean
  phishing: boolean
  malware: boolean
}

/**
 * CORS policy info
 */
export interface CORSPolicy {
  allowedOrigins: string[]
  allowedMethods: string[]
  allowedHeaders: string[]
  exposeHeaders: string[]
  allowCredentials: boolean
  maxAge: number
  issues: string[]
}

/**
 * Redirect info
 */
export interface RedirectInfo {
  from: string
  to: string
  statusCode: number
  suspicious: boolean
  reason?: string
}

/**
 * Full verification record
 */
export interface VerificationRecord {
  toolId: string
  status: VerificationStatus
  endpointCheck: EndpointCheckResult | null
  schemaValidation: SchemaValidationResult | null
  securityScan: SecurityScanResult | null
  lastVerified: number
  nextVerification: number
  history: VerificationHistoryEntry[]
}

/**
 * Verification history entry
 */
export interface VerificationHistoryEntry {
  timestamp: number
  type: "endpoint" | "schema" | "security" | "full"
  status: VerificationStatus
  details?: string
}

/**
 * Verification badge
 */
export interface VerificationBadge {
  type:
    | "verified_endpoint"
    | "security_audited"
    | "top_rated"
    | "trending"
    | "premium"
    | "new"
    | "high_volume"
  label: string
  icon: string
  earnedAt: number
  expiresAt?: number
  metadata?: Record<string, unknown>
}

/**
 * Tool badges collection
 */
export interface ToolBadges {
  toolId: string
  badges: VerificationBadge[]
  lastUpdated: number
}

/**
 * Verification request
 */
export interface VerificationRequest {
  id: string
  toolId: string
  requestedBy: Address
  requestedAt: number
  type: "automatic" | "manual"
  priority: "low" | "normal" | "high"
  status: "queued" | "processing" | "completed" | "failed"
  completedAt?: number
  result?: VerificationRecord
}

/**
 * Verification queue job
 */
export interface VerificationJob {
  jobId: string
  toolId: string
  type: "endpoint" | "schema" | "security" | "full"
  priority: number
  scheduledAt: number
  attempts: number
  maxAttempts: number
  lastError?: string
}

/**
 * Webhook notification for verification events
 */
export interface VerificationWebhook {
  id: string
  toolId: string
  ownerAddress: Address
  webhookUrl: string
  events: VerificationEventType[]
  secret: string
  active: boolean
  createdAt: number
}

/**
 * Verification event types for webhooks
 */
export type VerificationEventType =
  | "verification.started"
  | "verification.completed"
  | "verification.failed"
  | "endpoint.down"
  | "endpoint.recovered"
  | "schema.violation"
  | "security.issue"
  | "badge.earned"
  | "badge.lost"
