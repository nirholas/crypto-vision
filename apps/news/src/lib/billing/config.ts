/**
 * Stripe Billing Configuration
 * 
 * Enterprise-grade usage-based billing for API access.
 * Supports metered billing, subscription tiers, and usage tracking.
 */

// Subscription tiers with pricing and limits
export const BILLING_TIERS = {
  free: {
    id: 'free',
    name: 'Free',
    description: 'Perfect for hobbyists and testing',
    priceMonthly: 0,
    priceYearly: 0,
    stripePriceIdMonthly: null,
    stripePriceIdYearly: null,
    features: {
      requestsPerMonth: 1000,
      requestsPerMinute: 10,
      historicalData: '7d',
      alertsLimit: 3,
      webhooks: false,
      prioritySupport: false,
      aiFeatures: false,
      exportFormats: ['json'],
      customBranding: false,
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    description: 'For serious traders and developers',
    priceMonthly: 29,
    priceYearly: 290,
    stripePriceIdMonthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
    stripePriceIdYearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID,
    features: {
      requestsPerMonth: 50000,
      requestsPerMinute: 100,
      historicalData: '90d',
      alertsLimit: 25,
      webhooks: true,
      prioritySupport: false,
      aiFeatures: true,
      exportFormats: ['json', 'csv', 'excel'],
      customBranding: false,
    },
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Unlimited access for organizations',
    priceMonthly: 199,
    priceYearly: 1990,
    stripePriceIdMonthly: process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID,
    stripePriceIdYearly: process.env.STRIPE_ENTERPRISE_YEARLY_PRICE_ID,
    features: {
      requestsPerMonth: -1, // Unlimited
      requestsPerMinute: 1000,
      historicalData: 'unlimited',
      alertsLimit: -1,
      webhooks: true,
      prioritySupport: true,
      aiFeatures: true,
      exportFormats: ['json', 'csv', 'excel', 'parquet'],
      customBranding: true,
    },
  },
} as const;

// Metered usage pricing (pay-per-use overage)
export const USAGE_PRICING = {
  apiRequests: {
    unitName: 'API Request',
    pricePerUnit: 0.0001, // $0.0001 per request = $0.10 per 1000
    stripeMeterId: process.env.STRIPE_API_USAGE_METER_ID,
  },
  aiTokens: {
    unitName: 'AI Token',
    pricePerUnit: 0.00001, // $0.01 per 1000 tokens
    stripeMeterId: process.env.STRIPE_AI_USAGE_METER_ID,
  },
  webhookDeliveries: {
    unitName: 'Webhook Delivery',
    pricePerUnit: 0.001, // $0.001 per delivery
    stripeMeterId: process.env.STRIPE_WEBHOOK_USAGE_METER_ID,
  },
  dataExports: {
    unitName: 'Data Export (MB)',
    pricePerUnit: 0.01, // $0.01 per MB
    stripeMeterId: process.env.STRIPE_EXPORT_USAGE_METER_ID,
  },
};

// Stripe configuration
export const STRIPE_CONFIG = {
  publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
  secretKey: process.env.STRIPE_SECRET_KEY!,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
  portalReturnUrl: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing`,
  successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing?success=true`,
  cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing?canceled=true`,
};

export type BillingTier = keyof typeof BILLING_TIERS;
export type UsageType = keyof typeof USAGE_PRICING;

export interface UsageRecord {
  type: UsageType;
  quantity: number;
  timestamp: Date;
  metadata?: Record<string, string>;
}

export interface BillingPeriod {
  start: Date;
  end: Date;
  usage: Record<UsageType, number>;
  invoiceId?: string;
  status: 'current' | 'invoiced' | 'paid' | 'failed';
}

export interface CustomerBilling {
  customerId: string;
  subscriptionId: string | null;
  tier: BillingTier;
  status: 'active' | 'past_due' | 'canceled' | 'trialing';
  currentPeriod: BillingPeriod;
  paymentMethodId: string | null;
  cancelAtPeriodEnd: boolean;
}
