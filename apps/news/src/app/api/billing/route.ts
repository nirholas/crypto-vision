/**
 * Billing API Routes
 * 
 * Handles subscription management, checkout sessions,
 * and billing portal access.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { 
  getOrCreateCustomer,
  createCheckoutSession,
  createPortalSession,
  getCustomerBilling,
  cancelSubscription,
  resumeSubscription,
  listInvoices,
  getUpcomingInvoice,
  getCurrentUsage,
  getUsageHistory,
  BILLING_TIERS,
  type BillingTier,
} from '@/lib/billing';

/**
 * GET /api/billing
 * Get current billing status and usage
 */
export async function GET(request: NextRequest) {
  try {
    // In production, get customerId from authenticated session
    const customerId = request.headers.get('x-stripe-customer-id');
    const apiKeyId = request.headers.get('x-api-key-id');

    if (!customerId || !apiKeyId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get billing info
    const billing = await getCustomerBilling(customerId);
    
    if (!billing) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Get usage data
    const usage = getCurrentUsage(apiKeyId, billing.tier);
    const usageHistory = getUsageHistory(apiKeyId, 30);

    // Get invoices
    const invoices = await listInvoices(customerId, 5);
    const upcomingInvoice = await getUpcomingInvoice(customerId);

    // Get tier info
    const tierInfo = BILLING_TIERS[billing.tier];

    return NextResponse.json({
      subscription: {
        tier: billing.tier,
        tierName: tierInfo.name,
        status: billing.status,
        cancelAtPeriodEnd: billing.cancelAtPeriodEnd,
        currentPeriod: {
          start: billing.currentPeriod.start.toISOString(),
          end: billing.currentPeriod.end.toISOString(),
        },
      },
      usage: {
        current: usage.usage,
        limits: usage.limits,
        overages: usage.overages,
        estimatedOverageCost: usage.estimatedCost,
        period: {
          start: usage.period.start.toISOString(),
          end: usage.period.end.toISOString(),
        },
      },
      usageHistory,
      invoices: invoices.map(inv => ({
        id: inv.id,
        number: inv.number,
        status: inv.status,
        amountDue: inv.amount_due / 100,
        amountPaid: inv.amount_paid / 100,
        currency: inv.currency,
        created: new Date(inv.created * 1000).toISOString(),
        invoicePdf: inv.invoice_pdf,
        hostedInvoiceUrl: inv.hosted_invoice_url,
      })),
      upcomingInvoice: upcomingInvoice ? {
        amountDue: upcomingInvoice.amount_due / 100,
        dueDate: upcomingInvoice.due_date 
          ? new Date(upcomingInvoice.due_date * 1000).toISOString()
          : null,
        lineItems: upcomingInvoice.lines.data.map((item: { description: string | null; amount: number }) => ({
          description: item.description,
          amount: item.amount / 100,
        })),
      } : null,
      availableTiers: Object.values(BILLING_TIERS).map(tier => ({
        id: tier.id,
        name: tier.name,
        description: tier.description,
        priceMonthly: tier.priceMonthly,
        priceYearly: tier.priceYearly,
        features: tier.features,
      })),
    });
  } catch (error) {
    console.error('Billing GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch billing information' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/billing
 * Create checkout session or manage subscription
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, email, tier, billingPeriod = 'monthly' } = body;

    switch (action) {
      case 'checkout': {
        if (!email || !tier) {
          return NextResponse.json(
            { error: 'Email and tier are required' },
            { status: 400 }
          );
        }

        if (tier === 'free') {
          return NextResponse.json(
            { error: 'Cannot checkout for free tier' },
            { status: 400 }
          );
        }

        // Get or create customer
        const customer = await getOrCreateCustomer(email);

        // Create checkout session
        const session = await createCheckoutSession({
          customerId: customer.id,
          tier: tier as BillingTier,
          billingPeriod,
        });

        return NextResponse.json({
          sessionId: session.id,
          url: session.url,
        });
      }

      case 'portal': {
        const customerId = request.headers.get('x-stripe-customer-id');
        
        if (!customerId) {
          return NextResponse.json(
            { error: 'Customer ID required' },
            { status: 400 }
          );
        }

        const session = await createPortalSession(customerId);

        return NextResponse.json({
          url: session.url,
        });
      }

      case 'cancel': {
        const subscriptionId = body.subscriptionId;
        const immediately = body.immediately || false;

        if (!subscriptionId) {
          return NextResponse.json(
            { error: 'Subscription ID required' },
            { status: 400 }
          );
        }

        const subscription = await cancelSubscription(subscriptionId, immediately);

        return NextResponse.json({
          success: true,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          cancelAt: subscription.cancel_at 
            ? new Date(subscription.cancel_at * 1000).toISOString()
            : null,
        });
      }

      case 'resume': {
        const subscriptionId = body.subscriptionId;

        if (!subscriptionId) {
          return NextResponse.json(
            { error: 'Subscription ID required' },
            { status: 400 }
          );
        }

        const subscription = await resumeSubscription(subscriptionId);

        return NextResponse.json({
          success: true,
          status: subscription.status,
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Billing POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process request' },
      { status: 500 }
    );
  }
}
