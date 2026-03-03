/**
 * MCP Hosting Platform - "Shopify of MCP"
 * @description Allow users to create and host their own MCP servers under agenti.cash subdomains
 * @author nirholas
 * 
 * Business Model:
 * - Free tier: 1 MCP server, 1000 calls/month, agenti branding
 * - Pro tier ($29/mo): 5 servers, 50K calls/month, custom branding
 * - Business tier ($99/mo): Unlimited servers, 500K calls/month, custom domain
 * - Enterprise: Custom pricing, SLA, dedicated support
 * 
 * Revenue split on x402 payments:
 * - Creator gets 85%
 * - Platform gets 15%
 */

export interface MCPHostingUser {
  id: string;
  email: string;
  username: string;
  tier: 'free' | 'pro' | 'business' | 'enterprise';
  createdAt: Date;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

export interface HostedMCPServer {
  id: string;
  userId: string;
  name: string;
  description: string;
  subdomain: string; // e.g., "myserver" -> myserver.agenti.cash
  customDomain?: string; // For business/enterprise tiers
  status: 'active' | 'paused' | 'suspended';
  
  // Server configuration
  tools: HostedMCPTool[];
  prompts: HostedMCPPrompt[];
  resources: HostedMCPResource[];
  
  // Monetization
  pricing: MCPPricingConfig;
  
  // Stats
  totalCalls: number;
  totalRevenue: number;
  callsThisMonth: number;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface HostedMCPTool {
  id: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  
  // Implementation
  type: 'http' | 'code' | 'proxy';
  endpoint?: string; // For HTTP tools
  code?: string; // For code tools (sandboxed)
  proxyTarget?: string; // For proxy tools
  
  // Pricing (in USD)
  price: number;
  
  // Rate limiting
  rateLimit?: {
    requests: number;
    window: number; // seconds
  };
  
  enabled: boolean;
}

export interface HostedMCPPrompt {
  id: string;
  name: string;
  description: string;
  template: string;
  arguments: Array<{
    name: string;
    description: string;
    required: boolean;
  }>;
  price: number;
  enabled: boolean;
}

export interface HostedMCPResource {
  id: string;
  uri: string;
  name: string;
  description: string;
  mimeType: string;
  
  // Source
  type: 'static' | 'dynamic' | 'proxy';
  content?: string;
  endpoint?: string;
  
  price: number;
  enabled: boolean;
}

export interface MCPPricingConfig {
  // Default price for unlisted tools
  defaultToolPrice: number;
  
  // Revenue split (creator gets this %)
  creatorShare: number; // Default 85%
  
  // Accept these payment methods
  acceptedPayments: Array<'x402' | 'stripe' | 'crypto'>;
  
  // Wallet address for x402 payments
  payoutAddress?: string;
}

// Tier limits
export const TIER_LIMITS = {
  free: {
    maxServers: 1,
    maxToolsPerServer: 10,
    maxCallsPerMonth: 1000,
    customDomain: false,
    customBranding: false,
    analytics: 'basic',
    support: 'community',
  },
  pro: {
    maxServers: 5,
    maxToolsPerServer: 50,
    maxCallsPerMonth: 50000,
    customDomain: false,
    customBranding: true,
    analytics: 'advanced',
    support: 'email',
  },
  business: {
    maxServers: -1, // unlimited
    maxToolsPerServer: -1,
    maxCallsPerMonth: 500000,
    customDomain: true,
    customBranding: true,
    analytics: 'full',
    support: 'priority',
  },
  enterprise: {
    maxServers: -1,
    maxToolsPerServer: -1,
    maxCallsPerMonth: -1,
    customDomain: true,
    customBranding: true,
    analytics: 'full',
    support: 'dedicated',
  },
};

// Pricing
export const TIER_PRICING = {
  free: 0,
  pro: 29,
  business: 99,
  enterprise: null, // Custom pricing
};

// Platform revenue share (we take this % of x402 payments)
export const PLATFORM_FEE_PERCENTAGE = 15;

/**
 * Calculate payout for a tool call
 */
export function calculatePayout(
  toolPrice: number,
  creatorShare: number = 85
): { creatorAmount: number; platformAmount: number } {
  const platformAmount = toolPrice * (PLATFORM_FEE_PERCENTAGE / 100);
  const creatorAmount = toolPrice - platformAmount;
  
  return {
    creatorAmount,
    platformAmount,
  };
}

/**
 * Generate subdomain URL
 */
export function getServerUrl(subdomain: string, customDomain?: string): string {
  if (customDomain) {
    return `https://${customDomain}`;
  }
  return `https://${subdomain}.agenti.cash`;
}

/**
 * Validate subdomain
 */
export function isValidSubdomain(subdomain: string): boolean {
  // 3-32 chars, lowercase alphanumeric and hyphens, no leading/trailing hyphens
  const pattern = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;
  return pattern.test(subdomain);
}

/**
 * Reserved subdomains that can't be used
 */
export const RESERVED_SUBDOMAINS = [
  'www', 'api', 'app', 'admin', 'dashboard', 'docs', 'blog',
  'help', 'support', 'status', 'mail', 'smtp', 'ftp', 'ssh',
  'cdn', 'assets', 'static', 'media', 'images', 'files',
  'auth', 'login', 'signup', 'register', 'account', 'settings',
  'billing', 'payment', 'checkout', 'subscribe', 'pricing',
  'mcp', 'x402', 'agenti', 'crypto', 'defi', 'swap', 'trade',
];

export function isSubdomainAvailable(subdomain: string): boolean {
  if (!isValidSubdomain(subdomain)) return false;
  if (RESERVED_SUBDOMAINS.includes(subdomain)) return false;
  // TODO: Check database for existing subdomains
  return true;
}

export default {
  TIER_LIMITS,
  TIER_PRICING,
  PLATFORM_FEE_PERCENTAGE,
  calculatePayout,
  getServerUrl,
  isValidSubdomain,
  isSubdomainAvailable,
  RESERVED_SUBDOMAINS,
};
