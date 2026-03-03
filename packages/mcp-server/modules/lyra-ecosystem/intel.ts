/**
 * Lyra Intel Service
 * @description Code analysis and security scanning with x402 payments
 * @author nirholas
 * @license Apache-2.0
 * 
 * Lyra Intel provides:
 * - Free: Basic file analysis
 * - $0.05: Security vulnerability scan
 * - $0.10: Full repository audit
 * - $1.00: Enterprise monorepo analysis
 */

import type { AxiosInstance } from "axios";
import type {
  LyraIntelConfig,
  FileAnalysisResult,
  SecurityScanResult,
  RepoAuditResult,
  EnterpriseAnalysisResult,
  LyraPaymentResult,
} from "./types.js";
import { LYRA_SERVICE_URLS, LYRA_PRICES, LYRA_API_VERSION } from "./constants.js";
import Logger from "@/utils/logger.js";

/**
 * Lyra Intel service client with x402 payment integration
 */
export class LyraIntel {
  private api: AxiosInstance;
  private config: Required<LyraIntelConfig>;
  private cache: Map<string, { data: unknown; expires: number }>;
  private paymentCallback?: (result: LyraPaymentResult) => void;

  constructor(
    api: AxiosInstance,
    config: LyraIntelConfig = {},
    onPayment?: (result: LyraPaymentResult) => void
  ) {
    this.api = api;
    this.config = {
      baseUrl: config.baseUrl ?? LYRA_SERVICE_URLS.intel.production,
      enableCaching: config.enableCaching ?? true,
      cacheTtlMs: config.cacheTtlMs ?? 5 * 60 * 1000,
    };
    this.cache = new Map();
    this.paymentCallback = onPayment;
  }

  // ==========================================================================
  // Free Tier: Basic File Analysis
  // ==========================================================================

  /**
   * Analyze a single file (FREE)
   * 
   * @example
   * ```typescript
   * const result = await intel.analyzeFile({
   *   content: "const x = 1;",
   *   filename: "example.ts"
   * });
   * ```
   */
  async analyzeFile(options: {
    content: string;
    filename: string;
    language?: string;
  }): Promise<FileAnalysisResult> {
    const cacheKey = `file:${options.filename}:${this.hashContent(options.content)}`;
    
    if (this.config.enableCaching) {
      const cached = this.getFromCache<FileAnalysisResult>(cacheKey);
      if (cached) return cached;
    }

    Logger.debug(`[LyraIntel] Analyzing file: ${options.filename}`);

    const response = await this.api.post<FileAnalysisResult>(
      `${this.config.baseUrl}/${LYRA_API_VERSION}/analyze/file`,
      {
        content: options.content,
        filename: options.filename,
        language: options.language,
      }
    );

    if (this.config.enableCaching) {
      this.setCache(cacheKey, response.data);
    }

    return response.data;
  }

  // ==========================================================================
  // $0.05: Security Scan
  // ==========================================================================

  /**
   * Perform a security vulnerability scan ($0.05)
   * 
   * Scans code for:
   * - SQL injection
   * - XSS vulnerabilities
   * - Insecure dependencies
   * - Hardcoded secrets
   * - OWASP Top 10
   * 
   * @example
   * ```typescript
   * const result = await intel.securityScan("https://github.com/user/repo");
   * console.log(`Security score: ${result.score}/100`);
   * ```
   */
  async securityScan(repoUrl: string): Promise<SecurityScanResult> {
    const cacheKey = `security:${repoUrl}`;
    
    if (this.config.enableCaching) {
      const cached = this.getFromCache<SecurityScanResult>(cacheKey);
      if (cached) return cached;
    }

    Logger.info(`[LyraIntel] Security scan: ${repoUrl} (cost: $${LYRA_PRICES.intel.securityScan})`);

    // This endpoint returns 402 if payment required
    const response = await this.api.post<SecurityScanResult & { payment?: LyraPaymentResult }>(
      `${this.config.baseUrl}/${LYRA_API_VERSION}/scan/security`,
      { repoUrl }
    );

    // Report payment if occurred
    if (response.data.payment && this.paymentCallback) {
      this.paymentCallback(response.data.payment);
    }

    const result = { ...response.data };
    delete (result as Record<string, unknown>).payment;

    if (this.config.enableCaching) {
      this.setCache(cacheKey, result);
    }

    return result;
  }

  // ==========================================================================
  // $0.10: Full Repository Audit
  // ==========================================================================

  /**
   * Perform a full repository audit ($0.10)
   * 
   * Includes:
   * - Security analysis
   * - Code quality metrics
   * - Maintainability score
   * - Technical debt estimation
   * - Best practice recommendations
   * 
   * @example
   * ```typescript
   * const audit = await intel.repoAudit("https://github.com/user/repo");
   * console.log(`Overall score: ${audit.overallScore}/100`);
   * ```
   */
  async repoAudit(
    repoUrl: string,
    options?: {
      branch?: string;
      excludePaths?: string[];
      focus?: ("security" | "quality" | "performance")[];
    }
  ): Promise<RepoAuditResult> {
    Logger.info(`[LyraIntel] Full repo audit: ${repoUrl} (cost: $${LYRA_PRICES.intel.repoAudit})`);

    const response = await this.api.post<RepoAuditResult & { payment?: LyraPaymentResult }>(
      `${this.config.baseUrl}/${LYRA_API_VERSION}/audit/repo`,
      {
        repoUrl,
        branch: options?.branch ?? "main",
        excludePaths: options?.excludePaths ?? [],
        focus: options?.focus ?? ["security", "quality"],
      }
    );

    if (response.data.payment && this.paymentCallback) {
      this.paymentCallback(response.data.payment);
    }

    const result = { ...response.data };
    delete (result as Record<string, unknown>).payment;

    return result;
  }

  // ==========================================================================
  // $1.00: Enterprise Monorepo Analysis
  // ==========================================================================

  /**
   * Enterprise-grade monorepo analysis ($1.00)
   * 
   * Comprehensive analysis for large codebases:
   * - Cross-package dependency analysis
   * - Circular dependency detection
   * - Build optimization recommendations
   * - Architecture assessment
   * - Security across all packages
   * 
   * @example
   * ```typescript
   * const analysis = await intel.enterpriseAnalysis("https://github.com/org/monorepo");
   * console.log(`Packages: ${analysis.monorepoInfo.packages}`);
   * ```
   */
  async enterpriseAnalysis(
    repoUrl: string,
    options?: {
      branch?: string;
      packageManager?: "npm" | "yarn" | "pnpm" | "bun";
      workspacePattern?: string;
    }
  ): Promise<EnterpriseAnalysisResult> {
    Logger.info(`[LyraIntel] Enterprise analysis: ${repoUrl} (cost: $${LYRA_PRICES.intel.enterpriseAnalysis})`);

    const response = await this.api.post<EnterpriseAnalysisResult & { payment?: LyraPaymentResult }>(
      `${this.config.baseUrl}/${LYRA_API_VERSION}/audit/enterprise`,
      {
        repoUrl,
        branch: options?.branch ?? "main",
        packageManager: options?.packageManager ?? "npm",
        workspacePattern: options?.workspacePattern,
      }
    );

    if (response.data.payment && this.paymentCallback) {
      this.paymentCallback(response.data.payment);
    }

    const result = { ...response.data };
    delete (result as Record<string, unknown>).payment;

    return result;
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Get pricing information for Lyra Intel services
   */
  getPricing(): typeof LYRA_PRICES.intel {
    return LYRA_PRICES.intel;
  }

  /**
   * Check estimated cost before running an operation
   */
  estimateCost(operation: keyof typeof LYRA_PRICES.intel): string {
    return LYRA_PRICES.intel[operation];
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && cached.expires > Date.now()) {
      return cached.data as T;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache(key: string, data: unknown): void {
    this.cache.set(key, {
      data,
      expires: Date.now() + this.config.cacheTtlMs,
    });
  }

  private hashContent(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }
}
