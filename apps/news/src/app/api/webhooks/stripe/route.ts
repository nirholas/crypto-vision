/**
 * Stripe Webhook Handler
 * 
 * Processes Stripe webhook events for subscription lifecycle,
 * payment confirmations, and invoice updates.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { constructWebhookEvent } from '@/lib/billing';

// Disable body parsing for webhook signature verification
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    let event;
    try {
      event = constructWebhookEvent(body, signature);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    // Process the event
    // Cast event.data.object for type safety with Stripe SDK
    const eventObject = event.data.object as unknown as Record<string, unknown>;
    
    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(eventObject);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(eventObject);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(eventObject);
        break;

      case 'invoice.paid':
        await handleInvoicePaid(eventObject);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(eventObject);
        break;

      case 'customer.created':
        await handleCustomerCreated(eventObject);
        break;

      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(eventObject);
        break;

      case 'checkout.session.completed':
        await handleCheckoutCompleted(eventObject);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

/**
 * Handle new subscription creation
 */
async function handleSubscriptionCreated(subscription: Record<string, unknown>) {
  const customerId = subscription.customer as string;
  const tier = (subscription.metadata as Record<string, string>)?.tier || 'pro';
  const status = subscription.status as string;

  console.log(`Subscription created for customer ${customerId}:`, {
    subscriptionId: subscription.id,
    tier,
    status,
  });

  // Update user's subscription tier in your database
  // await db.users.update({ stripeCustomerId: customerId }, { tier, subscriptionStatus: status });
  
  // Send welcome email
  // await sendEmail({ to: customer.email, template: 'subscription-welcome', data: { tier } });
}

/**
 * Handle subscription updates (tier changes, renewals)
 */
async function handleSubscriptionUpdated(subscription: Record<string, unknown>) {
  const customerId = subscription.customer as string;
  const tier = (subscription.metadata as Record<string, string>)?.tier;
  const status = subscription.status as string;
  const cancelAtPeriodEnd = subscription.cancel_at_period_end as boolean;

  console.log(`Subscription updated for customer ${customerId}:`, {
    subscriptionId: subscription.id,
    tier,
    status,
    cancelAtPeriodEnd,
  });

  // Update user's subscription status
  // await db.users.update({ stripeCustomerId: customerId }, { 
  //   tier, 
  //   subscriptionStatus: status,
  //   cancelAtPeriodEnd 
  // });

  // Send notification if cancellation scheduled
  if (cancelAtPeriodEnd) {
    const cancelAt = subscription.cancel_at as number;
    console.log(`Subscription will cancel at: ${new Date(cancelAt * 1000).toISOString()}`);
    // await sendEmail({ to: customer.email, template: 'subscription-cancellation-scheduled' });
  }
}

/**
 * Handle subscription deletion/cancellation
 */
async function handleSubscriptionDeleted(subscription: Record<string, unknown>) {
  const customerId = subscription.customer as string;

  console.log(`Subscription deleted for customer ${customerId}:`, {
    subscriptionId: subscription.id,
  });

  // Downgrade user to free tier
  // await db.users.update({ stripeCustomerId: customerId }, { tier: 'free', subscriptionId: null });
  
  // Send cancellation confirmation
  // await sendEmail({ to: customer.email, template: 'subscription-canceled' });
}

/**
 * Handle successful invoice payment
 */
async function handleInvoicePaid(invoice: Record<string, unknown>) {
  const customerId = invoice.customer as string;
  const amountPaid = invoice.amount_paid as number;
  const invoiceId = invoice.id as string;

  console.log(`Invoice paid for customer ${customerId}:`, {
    invoiceId,
    amountPaid: amountPaid / 100,
    currency: invoice.currency,
  });

  // Record payment in your system
  // await db.payments.create({
  //   customerId,
  //   invoiceId,
  //   amount: amountPaid,
  //   currency: invoice.currency,
  //   paidAt: new Date(),
  // });

  // Send receipt
  // await sendEmail({ to: customer.email, template: 'invoice-paid', data: { invoiceId, amount: amountPaid } });
}

/**
 * Handle failed invoice payment
 */
async function handleInvoicePaymentFailed(invoice: Record<string, unknown>) {
  const customerId = invoice.customer as string;
  const attemptCount = invoice.attempt_count as number;

  console.log(`Invoice payment failed for customer ${customerId}:`, {
    invoiceId: invoice.id,
    attemptCount,
  });

  // Update subscription status
  // await db.users.update({ stripeCustomerId: customerId }, { subscriptionStatus: 'past_due' });

  // Send payment failed notification
  // await sendEmail({ 
  //   to: customer.email, 
  //   template: 'payment-failed', 
  //   data: { attemptCount, updatePaymentUrl: '/settings/billing' } 
  // });

  // If multiple failures, consider downgrading or suspending
  if (attemptCount >= 3) {
    console.log(`Multiple payment failures for ${customerId}, consider suspension`);
    // await suspendAccount(customerId);
  }
}

/**
 * Handle new customer creation
 */
async function handleCustomerCreated(customer: Record<string, unknown>) {
  console.log(`Customer created:`, {
    customerId: customer.id,
    email: customer.email,
  });

  // Link Stripe customer to your user
  // await db.users.update({ email: customer.email }, { stripeCustomerId: customer.id });
}

/**
 * Handle successful payment
 */
async function handlePaymentSucceeded(paymentIntent: Record<string, unknown>) {
  console.log(`Payment succeeded:`, {
    paymentIntentId: paymentIntent.id,
    amount: (paymentIntent.amount as number) / 100,
    customer: paymentIntent.customer,
  });
}

/**
 * Handle checkout session completion
 */
async function handleCheckoutCompleted(session: Record<string, unknown>) {
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  console.log(`Checkout completed:`, {
    sessionId: session.id,
    customerId,
    subscriptionId,
    mode: session.mode,
  });

  // Update user with subscription
  // await db.users.update({ stripeCustomerId: customerId }, { subscriptionId });
}
