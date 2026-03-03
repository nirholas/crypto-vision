/**
 * @fileoverview X402 Server MCP Tools
 * @description MCP tools for server-side x402 payment management
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 * 
 * Tools for receiving payments:
 * - x402_create_protected_endpoint - Define a new paywall
 * - x402_list_earnings - See revenue
 * - x402_withdraw_earnings - Withdraw funds
 * - x402_set_pricing - Configure prices
 * - x402_server_status - Check server configuration
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Address } from 'viem';
import type { X402Chain, X402Token } from '../sdk/types.js';
import type { ProtectedEndpoint, PaywallOptions, DynamicPricingOptions } from './types.js';
import { X402Analytics, createFileAnalytics } from './analytics.js';
import { X402Facilitator, createFacilitatorFromEnv } from './facilitator.js';
import { loadX402ServerConfig, validateX402ServerConfig, isX402ServerConfigured, getSafeConfigForLogging } from './config.js';
import { dynamicPrice, fixedPrice, resourceBasedPrice, tieredPrice } from './pricing.js';
import Logger from '@/utils/logger.js';

// ============================================================================
// State Management
// ============================================================================

// In-memory store for protected endpoints (would use database in production)
const protectedEndpoints = new Map<string, ProtectedEndpoint>();

// Analytics instance
let analytics: X402Analytics | null = null;

// Facilitator instance
let facilitator: X402Facilitator | null = null;

/**
 * Get or create analytics instance
 */
function getAnalytics(): X402Analytics {
  if (!analytics) {
    const config = loadX402ServerConfig();
    analytics = createFileAnalytics(config.analyticsPath || './data/x402-payments.json');
  }
  return analytics;
}

/**
 * Get or create facilitator instance
 */
function getFacilitator(): X402Facilitator | null {
  if (!facilitator) {
    const config = loadX402ServerConfig();
    if (config.facilitator) {
      facilitator = createFacilitatorFromEnv();
    }
  }
  return facilitator;
}

// ============================================================================
// Tool Registration
// ============================================================================

/**
 * Register x402 server tools with MCP server
 */
export function registerX402ServerTools(server: McpServer): void {
  const config = loadX402ServerConfig();
  const validation = validateX402ServerConfig(config);
  
  if (validation.errors.length > 0) {
    validation.errors.forEach(err => Logger.warn(`x402 Server: ${err}`));
  }

  // Tool 1: Create Protected Endpoint
  server.tool(
    "x402_create_protected_endpoint",
    "Define a new paywall-protected endpoint. This tool configures pricing for an API endpoint that will require x402 payment.",
    {
      path: z.string().describe("URL path pattern (e.g., '/api/joke', '/api/premium/*')"),
      price: z.string().describe("Price in USD (e.g., '0.001' for $0.001)"),
      token: z.enum(["USDs", "USDC", "USDT", "DAI"]).default("USDs").describe("Payment token"),
      network: z.enum(["arbitrum", "base", "ethereum", "polygon", "optimism", "bsc"]).default("arbitrum").describe("Blockchain network"),
      description: z.string().optional().describe("Human-readable description of the endpoint"),
      methods: z.array(z.string()).optional().describe("HTTP methods (default: all)"),
      rateLimit: z.number().optional().describe("Max requests per payer per hour"),
    },
    async ({ path, price, token, network, description, methods, rateLimit }) => {
      try {
        const endpoint: ProtectedEndpoint = {
          path,
          methods,
          pricing: {
            price,
            token: token as X402Token,
            network: network as X402Chain,
            description,
          },
          description,
          enabled: true,
          rateLimit,
        };

        protectedEndpoints.set(path, endpoint);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: `Protected endpoint created: ${path}`,
              endpoint: {
                path,
                price: `${price} ${token}`,
                network,
                description,
                methods: methods || ['*'],
                rateLimit: rateLimit || 'unlimited',
                recipient: config.walletAddress || 'not configured',
              },
              integrationCode: generateIntegrationCode(path, { price, token: token as X402Token, network: network as X402Chain, description }),
            }, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Failed to create endpoint",
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool 2: List Earnings
  server.tool(
    "x402_list_earnings",
    "View your x402 payment revenue. Shows earnings by endpoint, top payers, and revenue over time.",
    {
      period: z.enum(["today", "week", "month", "all"]).default("all").describe("Time period to analyze"),
      groupBy: z.enum(["endpoint", "payer", "time"]).optional().describe("How to group the data"),
      limit: z.number().default(10).describe("Maximum results to return"),
    },
    async ({ period, groupBy, limit }) => {
      try {
        const analyticsInstance = getAnalytics();
        
        // Calculate time range
        const now = Date.now();
        let startTime: number | undefined;
        
        switch (period) {
          case 'today':
            startTime = new Date().setHours(0, 0, 0, 0);
            break;
          case 'week':
            startTime = now - 7 * 24 * 60 * 60 * 1000;
            break;
          case 'month':
            startTime = now - 30 * 24 * 60 * 60 * 1000;
            break;
          case 'all':
            startTime = undefined;
            break;
        }

        const queryOptions = { startTime, limit };

        // Get summary
        const summary = await analyticsInstance.getRevenueSummary(queryOptions);
        
        // Get additional data based on groupBy
        let groupedData: unknown = null;
        
        switch (groupBy) {
          case 'endpoint':
            groupedData = await analyticsInstance.getRevenueByEndpoint(queryOptions);
            break;
          case 'payer':
            groupedData = await analyticsInstance.getTopPayers(queryOptions);
            break;
          case 'time':
            groupedData = await analyticsInstance.getRevenueOverTime({ ...queryOptions, groupBy: 'day' });
            break;
        }

        // Get recent payments
        const recentPayments = await analyticsInstance.getRecentPayments(5);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              period,
              summary: {
                totalRevenue: `${summary.total} ${summary.token}`,
                totalPayments: summary.count,
                averagePayment: `${summary.average} ${summary.token}`,
                uniquePayers: summary.uniquePayers,
              },
              groupedData,
              recentPayments: recentPayments.map(p => ({
                amount: `${p.amount} ${p.token}`,
                resource: p.resource,
                payer: `${p.payer.slice(0, 6)}...${p.payer.slice(-4)}`,
                time: new Date(p.timestamp).toISOString(),
              })),
            }, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Failed to fetch earnings",
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool 3: Withdraw Earnings
  server.tool(
    "x402_withdraw_earnings",
    "Withdraw accumulated earnings from the facilitator to your wallet.",
    {
      amount: z.string().describe("Amount to withdraw ('all' for entire balance, or specific amount)"),
      token: z.enum(["USDs", "USDC", "USDT"]).default("USDs").describe("Token to withdraw"),
      toAddress: z.string().optional().describe("Destination address (defaults to configured wallet)"),
    },
    async ({ amount, token, toAddress }) => {
      try {
        const fac = getFacilitator();
        if (!fac) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: false,
                error: "No facilitator configured. Set X402_FACILITATOR_TYPE and X402_FACILITATOR_URL environment variables.",
                hint: "Without a facilitator, payments are direct on-chain transfers to your wallet.",
              }, null, 2),
            }],
            isError: true,
          };
        }

        const destination = (toAddress || config.walletAddress) as Address;
        if (!destination) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: false,
                error: "No destination address. Provide toAddress or set X402_SERVER_WALLET.",
              }, null, 2),
            }],
            isError: true,
          };
        }

        // Get current balance
        const balance = await fac.getBalance(config.defaultChain);

        if (amount !== 'all') {
          const amountFloat = parseFloat(amount);
          const availableFloat = parseFloat(balance.available);
          if (amountFloat > availableFloat) {
            return {
              content: [{
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: `Insufficient balance. Available: ${balance.available} ${balance.token}, requested: ${amount}`,
                  balance: {
                    available: balance.available,
                    pending: balance.pending,
                    token: balance.token,
                  },
                }, null, 2),
              }],
              isError: true,
            };
          }
        }

        // Execute withdrawal
        const txHash = await fac.withdraw(amount, token as X402Token, config.defaultChain, destination);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: `Withdrawal initiated`,
              withdrawal: {
                amount: amount === 'all' ? balance.available : amount,
                token,
                destination: destination,
                txHash,
                chain: config.defaultChain,
              },
              remainingBalance: amount === 'all' ? '0' : (parseFloat(balance.available) - parseFloat(amount)).toFixed(6),
            }, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Withdrawal failed",
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool 4: Set Pricing
  server.tool(
    "x402_set_pricing",
    "Configure pricing for an existing endpoint. Supports fixed, dynamic, tiered, and resource-based pricing.",
    {
      path: z.string().describe("Endpoint path to configure"),
      pricingType: z.enum(["fixed", "dynamic", "tiered", "resource"]).describe("Type of pricing strategy"),
      basePrice: z.string().describe("Base price in USD"),
      perToken: z.string().optional().describe("Additional price per AI token (for dynamic pricing)"),
      perKB: z.string().optional().describe("Additional price per KB response (for dynamic pricing)"),
      tiers: z.array(z.object({
        maxRequests: z.number().optional(),
        price: z.string(),
        name: z.string().optional(),
      })).optional().describe("Price tiers (for tiered pricing)"),
      minPrice: z.string().optional().describe("Minimum price floor"),
      maxPrice: z.string().optional().describe("Maximum price cap"),
    },
    async ({ path, pricingType, basePrice, perToken, perKB, tiers, minPrice, maxPrice }) => {
      try {
        const endpoint = protectedEndpoints.get(path);
        
        let pricingConfig: PaywallOptions | DynamicPricingOptions;
        
        switch (pricingType) {
          case 'fixed':
            pricingConfig = {
              price: basePrice,
              token: config.defaultToken,
              network: config.defaultChain,
            };
            break;
            
          case 'dynamic':
            pricingConfig = {
              base: basePrice,
              perToken,
              perKB,
              minPrice,
              maxPrice,
              token: config.defaultToken,
              network: config.defaultChain,
            };
            break;
            
          case 'tiered':
            if (!tiers || tiers.length === 0) {
              throw new Error("Tiered pricing requires at least one tier");
            }
            pricingConfig = {
              base: tiers[0]?.price || basePrice,
              token: config.defaultToken,
              network: config.defaultChain,
            };
            break;
            
          case 'resource':
            pricingConfig = {
              base: basePrice,
              token: config.defaultToken,
              network: config.defaultChain,
            };
            break;
            
          default:
            throw new Error(`Unknown pricing type: ${pricingType}`);
        }

        // Update or create endpoint
        const updatedEndpoint: ProtectedEndpoint = {
          ...(endpoint || { path, enabled: true }),
          pricing: pricingConfig,
        };

        protectedEndpoints.set(path, updatedEndpoint);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: `Pricing updated for ${path}`,
              pricing: {
                type: pricingType,
                base: basePrice,
                perToken,
                perKB,
                tiers,
                minPrice,
                maxPrice,
                token: config.defaultToken,
                network: config.defaultChain,
              },
            }, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Failed to set pricing",
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool 5: Server Status
  server.tool(
    "x402_server_status",
    "Check x402 server configuration and status. Shows wallet, facilitator connection, and endpoint configuration.",
    {},
    async () => {
      try {
        const serverConfig = loadX402ServerConfig();
        const validationResult = validateX402ServerConfig(serverConfig);
        const safeConfig = getSafeConfigForLogging(serverConfig);
        
        // Check facilitator health if configured
        let facilitatorStatus: unknown = null;
        const fac = getFacilitator();
        if (fac) {
          try {
            facilitatorStatus = await fac.health();
          } catch {
            facilitatorStatus = { status: 'unreachable' };
          }
        }

        // Get analytics stats
        const analyticsInstance = getAnalytics();
        const stats = await analyticsInstance.getStats();

        // List configured endpoints
        const endpoints = Array.from(protectedEndpoints.entries()).map(([path, ep]) => ({
          path,
          enabled: ep.enabled,
          pricing: 'price' in ep.pricing ? `${ep.pricing.price} ${ep.pricing.token}` : `Dynamic (base: ${ep.pricing.base})`,
          rateLimit: ep.rateLimit || 'unlimited',
        }));

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              configured: isX402ServerConfigured(),
              valid: validationResult.valid,
              config: safeConfig,
              validation: {
                errors: validationResult.errors,
                warnings: validationResult.warnings,
              },
              facilitator: facilitatorStatus,
              analytics: {
                totalPayments: stats.totalPayments,
                totalRevenue: stats.totalRevenue,
                uniquePayers: stats.uniquePayers,
              },
              endpoints,
            }, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Failed to get status",
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool 6: Export Analytics
  server.tool(
    "x402_export_analytics",
    "Export payment analytics data to JSON or CSV format.",
    {
      format: z.enum(["json", "csv"]).default("json").describe("Export format"),
      period: z.enum(["today", "week", "month", "all"]).default("all").describe("Time period"),
    },
    async ({ format, period }) => {
      try {
        const analyticsInstance = getAnalytics();
        
        let startTime: number | undefined;
        const now = Date.now();
        
        switch (period) {
          case 'today':
            startTime = new Date().setHours(0, 0, 0, 0);
            break;
          case 'week':
            startTime = now - 7 * 24 * 60 * 60 * 1000;
            break;
          case 'month':
            startTime = now - 30 * 24 * 60 * 60 * 1000;
            break;
        }

        const data = await analyticsInstance.export({
          format: format as 'json' | 'csv',
          startTime,
        });

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              format,
              period,
              data: format === 'json' ? JSON.parse(data) : data,
            }, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Export failed",
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  // Tool 7: List Protected Endpoints
  server.tool(
    "x402_list_endpoints",
    "List all configured protected endpoints with their pricing.",
    {},
    async () => {
      try {
        const endpoints = Array.from(protectedEndpoints.entries()).map(([path, ep]) => {
          const pricing = ep.pricing;
          return {
            path,
            enabled: ep.enabled,
            description: ep.description,
            methods: ep.methods || ['*'],
            rateLimit: ep.rateLimit,
            pricing: 'price' in pricing ? {
              type: 'fixed',
              price: pricing.price,
              token: pricing.token,
              network: pricing.network,
            } : {
              type: 'dynamic',
              base: pricing.base,
              token: pricing.token,
              network: pricing.network,
            },
          };
        });

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              count: endpoints.length,
              endpoints,
              defaultConfig: {
                wallet: config.walletAddress ? `${config.walletAddress.slice(0, 6)}...` : 'not set',
                chain: config.defaultChain,
                token: config.defaultToken,
              },
            }, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Failed to list endpoints",
            }, null, 2),
          }],
          isError: true,
        };
      }
    }
  );

  Logger.info("x402: Server tools registered 🏗️");
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate integration code snippet for an endpoint
 */
function generateIntegrationCode(path: string, options: PaywallOptions): string {
  return `
// Express middleware integration
import { x402Paywall } from '@x402/server';

app.get('${path}', x402Paywall({
  price: '${options.price}',
  token: '${options.token}',
  network: '${options.network}',
  description: '${options.description || ''}'
}), (req, res) => {
  // Your handler code here
  res.json({ data: 'Protected content!' });
});
`.trim();
}

/**
 * Get protected endpoints (for external use)
 */
export function getProtectedEndpoints(): Map<string, ProtectedEndpoint> {
  return new Map(protectedEndpoints);
}

/**
 * Register a protected endpoint programmatically
 */
export function registerProtectedEndpoint(endpoint: ProtectedEndpoint): void {
  protectedEndpoints.set(endpoint.path, endpoint);
}
