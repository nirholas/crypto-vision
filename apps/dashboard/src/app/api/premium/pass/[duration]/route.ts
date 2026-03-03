/**
 * Access Pass Purchase Endpoint
 *
 * POST /api/premium/pass/[duration]
 *
 * Purchase a time-based access pass for unlimited API access.
 * Requires x402 payment for the pass price.
 *
 * @param duration - 'hour' | 'day' | 'week'
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  PASS_CONFIG,
  createPass,
  getActivePass,
  getPassPaymentRequirements,
  getPassStatus,
  type PassDuration,
} from '@/lib/x402/passes';
import { PAYMENT_ADDRESS, CURRENT_NETWORK, USDC_ADDRESS } from '@/lib/x402/config';

export const runtime = 'edge';

// Valid durations
const VALID_DURATIONS = ['hour', 'day', 'week'] as const;

interface RouteParams {
  params: Promise<{ duration: string }>;
}

/**
 * GET - Get pass pricing info
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { duration } = await params;

  if (!VALID_DURATIONS.includes(duration as PassDuration)) {
    return NextResponse.json(
      {
        error: 'Invalid Duration',
        message: `Valid options: ${VALID_DURATIONS.join(', ')}`,
        options: VALID_DURATIONS.map((d) => {
          const config = PASS_CONFIG[d];
          return {
            passDuration: d,
            name: config.name,
            priceUsd: config.priceUsd,
            features: config.features,
            purchaseUrl: `/api/premium/pass/${d}`,
          };
        }),
      },
      { status: 400 }
    );
  }

  const config = PASS_CONFIG[duration as PassDuration];

  // Check if user already has active pass
  const walletAddress = request.headers.get('X-Wallet-Address');
  let activePass = null;
  if (walletAddress) {
    const pass = await getActivePass(walletAddress);
    if (pass) {
      activePass = {
        ...pass,
        status: getPassStatus(pass),
      };
    }
  }

  return NextResponse.json({
    duration,
    name: config.name,
    description: config.description,
    price: {
      usd: config.priceUsd,
      usdc: config.priceUsdc,
      formatted: `$${config.priceUsd.toFixed(2)}`,
    },
    duration_seconds: config.durationSeconds,
    features: config.features,
    rate_limit: config.rateLimit,
    payment: {
      network: CURRENT_NETWORK,
      asset: USDC_ADDRESS,
      payTo: PAYMENT_ADDRESS,
    },
    activePass,
    purchaseMethod: 'POST with x402 payment header',
  });
}

/**
 * POST - Purchase a pass with x402 payment
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { duration } = await params;

  if (!VALID_DURATIONS.includes(duration as PassDuration)) {
    return NextResponse.json(
      {
        error: 'Invalid Duration',
        message: `Valid options: ${VALID_DURATIONS.join(', ')}`,
      },
      { status: 400 }
    );
  }

  const passDuration = duration as PassDuration;
  const config = PASS_CONFIG[passDuration];

  // Check for x402 payment header
  const paymentHeader = request.headers.get('X-Payment') || request.headers.get('Payment');

  if (!paymentHeader) {
    // Return 402 with payment requirements
    const paymentRequired = getPassPaymentRequirements(passDuration);
    const encoded = Buffer.from(JSON.stringify(paymentRequired)).toString('base64');

    return NextResponse.json(
      {
        error: 'Payment Required',
        message: `Purchase ${config.name} for $${config.priceUsd.toFixed(2)} USDC`,
        resource: `/api/premium/pass/${duration}`,
        ...paymentRequired,
      },
      {
        status: 402,
        headers: {
          'X-PAYMENT-REQUIRED': encoded,
          'Access-Control-Expose-Headers': 'X-PAYMENT-REQUIRED',
        },
      }
    );
  }

  // Parse and verify payment
  let payment;
  try {
    payment = JSON.parse(Buffer.from(paymentHeader, 'base64').toString('utf-8'));
  } catch {
    return NextResponse.json(
      { error: 'Invalid Payment', message: 'Could not parse payment header' },
      { status: 400 }
    );
  }

  // Verify payment amount
  const amountPaid = payment.payload?.authorization?.amount || '0';
  if (BigInt(amountPaid) < BigInt(config.priceUsdc)) {
    return NextResponse.json(
      {
        error: 'Insufficient Payment',
        message: `Required: ${config.priceUsd} USDC, Received: ${Number(amountPaid) / 1_000_000} USDC`,
      },
      { status: 402 }
    );
  }

  // Extract wallet address
  const walletAddress = payment.payload?.authorization?.from;
  if (!walletAddress) {
    return NextResponse.json(
      { error: 'Invalid Payment', message: 'Missing wallet address' },
      { status: 400 }
    );
  }

  // Check for existing active pass
  const existingPass = await getActivePass(walletAddress);
  if (existingPass) {
    const status = getPassStatus(existingPass);
    return NextResponse.json(
      {
        error: 'Active Pass Exists',
        message: `You already have an active ${existingPass.duration} pass`,
        pass: {
          id: existingPass.id,
          duration: existingPass.duration,
          expiresAt: existingPass.expiresAt,
          remaining: status.remainingFormatted,
        },
        suggestion: 'Wait for current pass to expire or use it',
      },
      { status: 409 }
    );
  }

  // Create the pass
  const transactionHash = payment.transactionHash || undefined;
  const pass = await createPass(walletAddress, passDuration, transactionHash);
  const status = getPassStatus(pass);

  return NextResponse.json(
    {
      success: true,
      message: `${config.name} activated successfully!`,
      pass: {
        id: pass.id,
        duration: pass.duration,
        startsAt: pass.startsAt,
        expiresAt: pass.expiresAt,
        remaining: status.remainingFormatted,
        rateLimit: config.rateLimit,
      },
      features: config.features,
      usage: {
        requestsMade: 0,
        rateLimit: `${config.rateLimit}/min`,
      },
    },
    {
      status: 201,
      headers: {
        'X-Pass-Id': pass.id,
        'X-Pass-Expires': pass.expiresAt,
      },
    }
  );
}

/**
 * OPTIONS for CORS
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type, X-Payment, Payment, X-Wallet-Address, Authorization',
      'Access-Control-Expose-Headers': 'X-PAYMENT-REQUIRED, X-Pass-Id, X-Pass-Expires',
      'Access-Control-Max-Age': '86400',
    },
  });
}
