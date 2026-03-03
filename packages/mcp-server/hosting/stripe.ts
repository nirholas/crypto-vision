/**
 * Stripe Integration for MCP Hosting Platform
 * @description Subscription management for Pro, Business, and Enterprise tiers
 * @author nirholas
 */

import Stripe from 'stripe';
import Logger from '@/utils/logger.js';
import { TIER_PRICING, type MCPHostingUser } from './types.js';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-12-15.clover',
});

// Stripe Product/Price IDs - create these in Stripe Dashboard
export const STRIPE_PRICES = {
  pro: process.env.STRIPE_PRICE_PRO || 'price_pro_monthly',
  business: process.env.STRIPE_PRICE_BUSINESS || 'price_business_monthly',
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE || 'price_enterprise_monthly',
} as const;

export type SubscriptionTier = 'pro' | 'business' | 'enterprise';

export interface CheckoutSessionResult {
  sessionId: string;
  url: string;
}

export interface SubscriptionStatus {
  active: boolean;
  tier: SubscriptionTier | 'free';
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  customerId: string | null;
}

/**
 * Create a Stripe checkout session for subscription
 */
export async function createCheckoutSession(
  userId: string,
  tier: SubscriptionTier,
  email: string,
  successUrl: string,
  cancelUrl: string
): Promise<CheckoutSessionResult> {
  const priceId = STRIPE_PRICES[tier];
  
  if (!priceId) {
    throw new Error(`Invalid subscription tier: ${tier}`);
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      metadata: {
        userId,
        tier,
      },
      subscription_data: {
        metadata: {
          userId,
          tier,
        },
      },
    });

    Logger.info('Checkout session created', { userId, tier, sessionId: session.id });

    return {
      sessionId: session.id,
      url: session.url!,
    };
  } catch (error) {
    Logger.error('Failed to create checkout session', { userId, tier, error });
    throw error;
  }
}

/**
 * Handle Stripe webhook events
 */
export async function handleWebhook(
  event: Stripe.Event,
  onSubscriptionUpdate: (userId: string, status: SubscriptionStatus) => Promise<void>
): Promise<void> {
  Logger.info('Processing Stripe webhook', { type: event.type });

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const tier = session.metadata?.tier as SubscriptionTier;
      
      if (userId && tier) {
        await onSubscriptionUpdate(userId, {
          active: true,
          tier,
          currentPeriodEnd: null, // Will be updated by subscription.updated
          cancelAtPeriodEnd: false,
          customerId: session.customer as string,
        });
        Logger.info('Subscription activated via checkout', { userId, tier });
      }
      break;
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.userId;
      const tier = subscription.metadata?.tier as SubscriptionTier;
      
      if (userId) {
        await onSubscriptionUpdate(userId, {
          active: subscription.status === 'active',
          tier: tier || 'free',
          currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          customerId: subscription.customer as string,
        });
        Logger.info('Subscription updated', { userId, status: subscription.status });
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.userId;
      
      if (userId) {
        await onSubscriptionUpdate(userId, {
          active: false,
          tier: 'free',
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          customerId: subscription.customer as string,
        });
        Logger.info('Subscription cancelled', { userId });
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      Logger.warn('Payment failed', { 
        customerId: invoice.customer,
        invoiceId: invoice.id,
      });
      // TODO: Send email notification to user
      break;
    }

    default:
      Logger.debug('Unhandled webhook event', { type: event.type });
  }
}

/**
 * Get subscription status for a customer
 */
export async function getSubscriptionStatus(
  customerId: string
): Promise<SubscriptionStatus> {
  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      return {
        active: false,
        tier: 'free',
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        customerId,
      };
    }

    const subscription = subscriptions.data[0];
    if (!subscription) {
      return {
        active: false,
        tier: 'free',
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        customerId,
      };
    }
    const tier = subscription.metadata?.tier as SubscriptionTier || 'pro';

    return {
      active: true,
      tier,
      currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      customerId,
    };
  } catch (error) {
    Logger.error('Failed to get subscription status', { customerId, error });
    throw error;
  }
}

/**
 * Cancel a subscription at period end
 */
export async function cancelSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  try {
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
    
    Logger.info('Subscription set to cancel', { subscriptionId });
    return subscription;
  } catch (error) {
    Logger.error('Failed to cancel subscription', { subscriptionId, error });
    throw error;
  }
}

/**
 * Immediately cancel a subscription
 */
export async function cancelSubscriptionImmediately(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  try {
    const subscription = await stripe.subscriptions.cancel(subscriptionId);
    Logger.info('Subscription cancelled immediately', { subscriptionId });
    return subscription;
  } catch (error) {
    Logger.error('Failed to cancel subscription immediately', { subscriptionId, error });
    throw error;
  }
}

/**
 * Create a customer portal session for managing subscription
 */
export async function createPortalSession(
  customerId: string,
  returnUrl: string
): Promise<string> {
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    
    return session.url;
  } catch (error) {
    Logger.error('Failed to create portal session', { customerId, error });
    throw error;
  }
}

/**
 * Verify Stripe webhook signature
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET not configured');
  }
  
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

/**
 * Get Stripe instance for advanced usage
 */
export function getStripeInstance(): Stripe {
  return stripe;
}

export default {
  createCheckoutSession,
  handleWebhook,
  getSubscriptionStatus,
  cancelSubscription,
  cancelSubscriptionImmediately,
  createPortalSession,
  verifyWebhookSignature,
  getStripeInstance,
  STRIPE_PRICES,
};
