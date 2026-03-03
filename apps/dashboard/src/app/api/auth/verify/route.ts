/**
 * Magic Link Verification Route
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyMagicLink, setSessionCookie, getUserByEmail } from '@/lib/auth';
import { sendWelcomeEmail } from '@/lib/email';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  const redirectTo = request.nextUrl.searchParams.get('redirect') || '/';

  if (!token) {
    return NextResponse.redirect(new URL('/auth/error?error=missing_token', request.url));
  }

  const result = await verifyMagicLink(token);

  if (!result.success) {
    return NextResponse.redirect(
      new URL(`/auth/error?error=${encodeURIComponent(result.error || 'verification_failed')}`, request.url)
    );
  }

  // Set session cookie
  await setSessionCookie(result.session!);

  // Send welcome email for new users
  if (result.user && result.user.createdAt === result.user.updatedAt) {
    await sendWelcomeEmail(result.user.email, result.user.name || undefined);
  }

  // Redirect to dashboard or specified URL
  return NextResponse.redirect(new URL(redirectTo, request.url));
}
