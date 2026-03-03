/**
 * @fileoverview X402 Payment Analytics
 * @description Track payments, revenue by endpoint, top payers, export data
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 * 
 * @example Basic Usage
 * ```typescript
 * const analytics = new X402Analytics({ storagePath: './data/payments.json' });
 * 
 * // Record a payment
 * await analytics.recordPayment({
 *   txHash: '0x...',
 *   chain: 'arbitrum',
 *   amount: '0.01',
 *   token: 'USDs',
 *   payer: '0x...',
 *   resource: '/api/joke'
 * });
 * 
 * // Get revenue summary
 * const summary = await analytics.getRevenueSummary();
 * console.log(`Total: $${summary.total}, Payments: ${summary.count}`);
 * 
 * // Export to CSV
 * const csv = await analytics.export({ format: 'csv' });
 * ```
 */

import type { Address, Hash } from 'viem';
import type { X402Chain, X402Token } from '../sdk/types.js';
import type {
  PaymentRecord,
  RevenueSummary,
  EndpointRevenue,
  TopPayer,
  AnalyticsQueryOptions,
  ExportOptions,
  ExportFormat,
} from './types.js';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import Logger from '@/utils/logger.js';

// ============================================================================
// Analytics Storage Interface
// ============================================================================

/**
 * Analytics storage backend interface
 */
export interface AnalyticsStorage {
  /** Save a payment record */
  save(record: PaymentRecord): Promise<void>;
  /** Query payment records */
  query(options: AnalyticsQueryOptions): Promise<PaymentRecord[]>;
  /** Get all records */
  getAll(): Promise<PaymentRecord[]>;
  /** Get count of records */
  count(options?: AnalyticsQueryOptions): Promise<number>;
  /** Clear all records */
  clear(): Promise<void>;
}

// ============================================================================
// In-Memory Storage
// ============================================================================

/**
 * Simple in-memory analytics storage
 * Good for development/testing
 */
export class InMemoryAnalyticsStorage implements AnalyticsStorage {
  private records: PaymentRecord[] = [];

  async save(record: PaymentRecord): Promise<void> {
    this.records.push(record);
  }

  async query(options: AnalyticsQueryOptions): Promise<PaymentRecord[]> {
    let filtered = [...this.records];

    if (options.startTime) {
      filtered = filtered.filter(r => r.timestamp >= options.startTime!);
    }
    if (options.endTime) {
      filtered = filtered.filter(r => r.timestamp <= options.endTime!);
    }
    if (options.resource) {
      filtered = filtered.filter(r => r.resource === options.resource);
    }
    if (options.payer) {
      filtered = filtered.filter(r => r.payer.toLowerCase() === options.payer!.toLowerCase());
    }
    if (options.chain) {
      filtered = filtered.filter(r => r.chain === options.chain);
    }

    // Sort by timestamp descending
    filtered.sort((a, b) => b.timestamp - a.timestamp);

    if (options.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  async getAll(): Promise<PaymentRecord[]> {
    return [...this.records];
  }

  async count(options?: AnalyticsQueryOptions): Promise<number> {
    if (!options) return this.records.length;
    return (await this.query(options)).length;
  }

  async clear(): Promise<void> {
    this.records = [];
  }
}

// ============================================================================
// JSON File Storage
// ============================================================================

/**
 * JSON file-based analytics storage
 * Persists data to disk
 */
export class JsonFileAnalyticsStorage implements AnalyticsStorage {
  private readonly filePath: string;
  private records: PaymentRecord[] = [];
  private loaded = false;
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  private async load(): Promise<void> {
    if (this.loaded) return;

    try {
      if (existsSync(this.filePath)) {
        const data = await readFile(this.filePath, 'utf-8');
        this.records = JSON.parse(data);
      }
    } catch (error) {
      Logger.warn(`x402: Failed to load analytics from ${this.filePath}: ${error}`);
      this.records = [];
    }

    this.loaded = true;
  }

  private async scheduleSave(): Promise<void> {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    // Debounce saves
    this.saveTimeout = setTimeout(async () => {
      try {
        const dir = dirname(this.filePath);
        if (!existsSync(dir)) {
          await mkdir(dir, { recursive: true });
        }
        await writeFile(this.filePath, JSON.stringify(this.records, null, 2));
      } catch (error) {
        Logger.error(`x402: Failed to save analytics to ${this.filePath}: ${error}`);
      }
    }, 1000);
  }

  async save(record: PaymentRecord): Promise<void> {
    await this.load();
    this.records.push(record);
    await this.scheduleSave();
  }

  async query(options: AnalyticsQueryOptions): Promise<PaymentRecord[]> {
    await this.load();

    let filtered = [...this.records];

    if (options.startTime) {
      filtered = filtered.filter(r => r.timestamp >= options.startTime!);
    }
    if (options.endTime) {
      filtered = filtered.filter(r => r.timestamp <= options.endTime!);
    }
    if (options.resource) {
      filtered = filtered.filter(r => r.resource === options.resource);
    }
    if (options.payer) {
      filtered = filtered.filter(r => r.payer.toLowerCase() === options.payer!.toLowerCase());
    }
    if (options.chain) {
      filtered = filtered.filter(r => r.chain === options.chain);
    }

    filtered.sort((a, b) => b.timestamp - a.timestamp);

    if (options.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  async getAll(): Promise<PaymentRecord[]> {
    await this.load();
    return [...this.records];
  }

  async count(options?: AnalyticsQueryOptions): Promise<number> {
    await this.load();
    if (!options) return this.records.length;
    return (await this.query(options)).length;
  }

  async clear(): Promise<void> {
    this.records = [];
    await this.scheduleSave();
  }
}

// ============================================================================
// Main Analytics Class
// ============================================================================

/**
 * Analytics configuration
 */
export interface AnalyticsConfig {
  /** Storage backend (default: in-memory) */
  storage?: AnalyticsStorage;
  /** File path for JSON storage */
  storagePath?: string;
  /** Default token for calculations */
  defaultToken?: X402Token;
  /** Default chain */
  defaultChain?: X402Chain;
}

/**
 * X402 Payment Analytics
 * 
 * Tracks payments, calculates revenue, and exports data
 */
export class X402Analytics {
  private readonly storage: AnalyticsStorage;
  private readonly defaultToken: X402Token;
  private readonly defaultChain: X402Chain;

  constructor(config: AnalyticsConfig = {}) {
    this.defaultToken = config.defaultToken || 'USDs';
    this.defaultChain = config.defaultChain || 'arbitrum';

    if (config.storage) {
      this.storage = config.storage;
    } else if (config.storagePath) {
      this.storage = new JsonFileAnalyticsStorage(config.storagePath);
    } else {
      this.storage = new InMemoryAnalyticsStorage();
    }
  }

  // ============================================================================
  // Recording
  // ============================================================================

  /**
   * Record a payment
   * 
   * @example
   * ```typescript
   * await analytics.recordPayment({
   *   txHash: '0xabc...',
   *   chain: 'arbitrum',
   *   amount: '0.01',
   *   token: 'USDs',
   *   payer: '0x1234...',
   *   resource: '/api/joke',
   *   method: 'GET',
   *   statusCode: 200
   * });
   * ```
   */
  async recordPayment(payment: Omit<PaymentRecord, 'id' | 'timestamp'> & { timestamp?: number }): Promise<string> {
    const id = this.generateId();
    const record: PaymentRecord = {
      id,
      timestamp: payment.timestamp || Date.now(),
      ...payment,
    };

    await this.storage.save(record);
    Logger.debug(`x402: Recorded payment ${id} - ${payment.amount} ${payment.token} for ${payment.resource}`);

    return id;
  }

  /**
   * Generate unique payment ID
   */
  private generateId(): string {
    return `pay_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  // ============================================================================
  // Revenue Queries
  // ============================================================================

  /**
   * Get revenue summary
   * 
   * @example
   * ```typescript
   * // Total revenue
   * const total = await analytics.getRevenueSummary();
   * 
   * // Today's revenue
   * const today = await analytics.getRevenueSummary({
   *   startTime: new Date().setHours(0, 0, 0, 0)
   * });
   * 
   * // Revenue for specific endpoint
   * const jokeRevenue = await analytics.getRevenueSummary({
   *   resource: '/api/joke'
   * });
   * ```
   */
  async getRevenueSummary(options: AnalyticsQueryOptions = {}): Promise<RevenueSummary> {
    const records = await this.storage.query(options);
    
    const total = records.reduce((sum, r) => sum + parseFloat(r.amount), 0);
    const uniquePayers = new Set(records.map(r => r.payer.toLowerCase())).size;
    
    const periodStart = options.startTime || (records.length > 0 ? Math.min(...records.map(r => r.timestamp)) : Date.now());
    const periodEnd = options.endTime || Date.now();

    return {
      total: total.toFixed(6),
      count: records.length,
      average: records.length > 0 ? (total / records.length).toFixed(6) : '0',
      uniquePayers,
      token: this.defaultToken,
      periodStart,
      periodEnd,
    };
  }

  /**
   * Get revenue broken down by endpoint
   * 
   * @example
   * ```typescript
   * const byEndpoint = await analytics.getRevenueByEndpoint();
   * // [
   * //   { resource: '/api/joke', total: '10.50', count: 1050, percentage: 70 },
   * //   { resource: '/api/summary', total: '4.50', count: 45, percentage: 30 }
   * // ]
   * ```
   */
  async getRevenueByEndpoint(options: AnalyticsQueryOptions = {}): Promise<EndpointRevenue[]> {
    const records = await this.storage.query(options);
    
    // Group by resource
    const byResource = new Map<string, { total: number; count: number }>();
    let totalRevenue = 0;

    for (const record of records) {
      const existing = byResource.get(record.resource) || { total: 0, count: 0 };
      const amount = parseFloat(record.amount);
      existing.total += amount;
      existing.count++;
      totalRevenue += amount;
      byResource.set(record.resource, existing);
    }

    // Convert to array and calculate percentages
    const result: EndpointRevenue[] = [];
    for (const [resource, data] of byResource.entries()) {
      result.push({
        resource,
        total: data.total.toFixed(6),
        count: data.count,
        percentage: totalRevenue > 0 ? (data.total / totalRevenue) * 100 : 0,
      });
    }

    // Sort by total descending
    result.sort((a, b) => parseFloat(b.total) - parseFloat(a.total));

    return result;
  }

  /**
   * Get revenue over time (for charts)
   * 
   * @example
   * ```typescript
   * const daily = await analytics.getRevenueOverTime({
   *   groupBy: 'day',
   *   startTime: Date.now() - 30 * 24 * 60 * 60 * 1000
   * });
   * ```
   */
  async getRevenueOverTime(options: AnalyticsQueryOptions & { groupBy?: 'hour' | 'day' | 'week' | 'month' } = {}): Promise<Array<{
    period: string;
    periodStart: number;
    periodEnd: number;
    total: string;
    count: number;
  }>> {
    const { groupBy = 'day', ...queryOptions } = options;
    const records = await this.storage.query(queryOptions);

    // Group by period
    const byPeriod = new Map<string, { start: number; end: number; total: number; count: number }>();

    for (const record of records) {
      const date = new Date(record.timestamp);
      let periodKey: string;
      let periodStart: number;
      let periodEnd: number;

      switch (groupBy) {
        case 'hour':
          periodKey = `${date.toISOString().slice(0, 13)}:00:00.000Z`;
          periodStart = new Date(periodKey).getTime();
          periodEnd = periodStart + 60 * 60 * 1000 - 1;
          break;
        case 'day':
          periodKey = date.toISOString().slice(0, 10);
          periodStart = new Date(periodKey).getTime();
          periodEnd = periodStart + 24 * 60 * 60 * 1000 - 1;
          break;
        case 'week':
          const dayOfWeek = date.getUTCDay();
          const weekStart = new Date(date.getTime() - dayOfWeek * 24 * 60 * 60 * 1000);
          periodKey = weekStart.toISOString().slice(0, 10);
          periodStart = new Date(periodKey).getTime();
          periodEnd = periodStart + 7 * 24 * 60 * 60 * 1000 - 1;
          break;
        case 'month':
          periodKey = date.toISOString().slice(0, 7);
          periodStart = new Date(`${periodKey}-01`).getTime();
          const nextMonth = new Date(periodStart);
          nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
          periodEnd = nextMonth.getTime() - 1;
          break;
      }

      const existing = byPeriod.get(periodKey) || { start: periodStart, end: periodEnd, total: 0, count: 0 };
      existing.total += parseFloat(record.amount);
      existing.count++;
      byPeriod.set(periodKey, existing);
    }

    // Convert to array and sort by period
    const result = Array.from(byPeriod.entries())
      .map(([period, data]) => ({
        period,
        periodStart: data.start,
        periodEnd: data.end,
        total: data.total.toFixed(6),
        count: data.count,
      }))
      .sort((a, b) => a.periodStart - b.periodStart);

    return result;
  }

  // ============================================================================
  // Payer Analysis
  // ============================================================================

  /**
   * Get top payers
   * 
   * @example
   * ```typescript
   * const topPayers = await analytics.getTopPayers({ limit: 10 });
   * ```
   */
  async getTopPayers(options: AnalyticsQueryOptions = {}): Promise<TopPayer[]> {
    const records = await this.storage.query(options);
    
    // Group by payer
    const byPayer = new Map<string, {
      total: number;
      count: number;
      firstPayment: number;
      lastPayment: number;
    }>();

    for (const record of records) {
      const payerKey = record.payer.toLowerCase();
      const existing = byPayer.get(payerKey) || {
        total: 0,
        count: 0,
        firstPayment: record.timestamp,
        lastPayment: record.timestamp,
      };

      existing.total += parseFloat(record.amount);
      existing.count++;
      existing.firstPayment = Math.min(existing.firstPayment, record.timestamp);
      existing.lastPayment = Math.max(existing.lastPayment, record.timestamp);
      byPayer.set(payerKey, existing);
    }

    // Convert to array
    const result: TopPayer[] = Array.from(byPayer.entries()).map(([address, data]) => ({
      address: address as Address,
      total: data.total.toFixed(6),
      count: data.count,
      firstPayment: data.firstPayment,
      lastPayment: data.lastPayment,
    }));

    // Sort by total descending
    result.sort((a, b) => parseFloat(b.total) - parseFloat(a.total));

    // Apply limit
    if (options.limit) {
      return result.slice(0, options.limit);
    }

    return result;
  }

  /**
   * Get payment history for a specific payer
   */
  async getPayerHistory(payer: Address, options: Omit<AnalyticsQueryOptions, 'payer'> = {}): Promise<PaymentRecord[]> {
    return this.storage.query({ ...options, payer });
  }

  // ============================================================================
  // Export
  // ============================================================================

  /**
   * Export analytics data
   * 
   * @example
   * ```typescript
   * // Export as JSON
   * const json = await analytics.export({ format: 'json' });
   * 
   * // Export as CSV
   * const csv = await analytics.export({ format: 'csv' });
   * 
   * // Export with filters
   * const filtered = await analytics.export({
   *   format: 'csv',
   *   startTime: Date.now() - 7 * 24 * 60 * 60 * 1000,
   *   resource: '/api/premium'
   * });
   * ```
   */
  async export(options: ExportOptions): Promise<string> {
    const { format, includeMetadata = false, ...queryOptions } = options;
    const records = await this.storage.query(queryOptions);

    switch (format) {
      case 'json':
        return this.exportJson(records, includeMetadata);
      case 'csv':
        return this.exportCsv(records, includeMetadata);
      case 'xlsx':
        // Would need xlsx library for proper Excel export
        // For now, return CSV-compatible format
        return this.exportCsv(records, includeMetadata);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Export to JSON
   */
  private exportJson(records: PaymentRecord[], includeMetadata: boolean): string {
    if (!includeMetadata) {
      records = records.map(r => {
        const { metadata, ...rest } = r;
        return rest;
      });
    }
    return JSON.stringify(records, null, 2);
  }

  /**
   * Export to CSV
   */
  private exportCsv(records: PaymentRecord[], includeMetadata: boolean): string {
    if (records.length === 0) {
      return 'id,txHash,chain,amount,token,payer,resource,method,statusCode,timestamp';
    }

    const headers = ['id', 'txHash', 'chain', 'amount', 'token', 'payer', 'resource', 'method', 'statusCode', 'timestamp'];
    if (includeMetadata) {
      headers.push('metadata');
    }

    const rows = records.map(r => {
      const row = [
        r.id,
        r.txHash,
        r.chain,
        r.amount,
        r.token,
        r.payer,
        r.resource,
        r.method || '',
        r.statusCode?.toString() || '',
        new Date(r.timestamp).toISOString(),
      ];

      if (includeMetadata) {
        row.push(r.metadata ? JSON.stringify(r.metadata) : '');
      }

      return row.map(v => this.escapeCsvValue(String(v))).join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Escape CSV value
   */
  private escapeCsvValue(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get recent payments
   */
  async getRecentPayments(limit = 10): Promise<PaymentRecord[]> {
    return this.storage.query({ limit });
  }

  /**
   * Get total payment count
   */
  async getTotalCount(): Promise<number> {
    return this.storage.count();
  }

  /**
   * Clear all analytics data
   * WARNING: This is irreversible
   */
  async clear(): Promise<void> {
    await this.storage.clear();
    Logger.warn('x402: Analytics data cleared');
  }

  /**
   * Get summary statistics
   */
  async getStats(): Promise<{
    totalPayments: number;
    totalRevenue: string;
    uniquePayers: number;
    uniqueResources: number;
    averagePayment: string;
    firstPayment: number | null;
    lastPayment: number | null;
  }> {
    const records = await this.storage.getAll();
    
    if (records.length === 0) {
      return {
        totalPayments: 0,
        totalRevenue: '0',
        uniquePayers: 0,
        uniqueResources: 0,
        averagePayment: '0',
        firstPayment: null,
        lastPayment: null,
      };
    }

    const totalRevenue = records.reduce((sum, r) => sum + parseFloat(r.amount), 0);
    const uniquePayers = new Set(records.map(r => r.payer.toLowerCase())).size;
    const uniqueResources = new Set(records.map(r => r.resource)).size;
    const timestamps = records.map(r => r.timestamp);

    return {
      totalPayments: records.length,
      totalRevenue: totalRevenue.toFixed(6),
      uniquePayers,
      uniqueResources,
      averagePayment: (totalRevenue / records.length).toFixed(6),
      firstPayment: Math.min(...timestamps),
      lastPayment: Math.max(...timestamps),
    };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create analytics with file storage
 */
export function createFileAnalytics(filePath: string, options: Omit<AnalyticsConfig, 'storagePath' | 'storage'> = {}): X402Analytics {
  return new X402Analytics({ ...options, storagePath: filePath });
}

/**
 * Create analytics with in-memory storage
 */
export function createMemoryAnalytics(options: Omit<AnalyticsConfig, 'storagePath' | 'storage'> = {}): X402Analytics {
  return new X402Analytics({ ...options, storage: new InMemoryAnalyticsStorage() });
}
