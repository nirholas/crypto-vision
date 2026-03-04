/**
 * OAuth Callback Handler
 * 
 * Handles OAuth callbacks for all providers
 */

import { NextRequest, NextResponse } from 'next/server';
import { handleOAuthCallback, setSessionCookie, type AuthProvider } from '@/lib/auth';
import { sendWelcomeEmail } from '@/lib/email';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // Handle OAuth errors
  if (error) {
    console.error(`OAuth error from ${provider}:`, error);
    return NextResponse.redirect(
      new URL(`/auth/error?error=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/auth/error?error=missing_parameters', request.url)
    );
  }

  // Validate provider
  const validProviders: AuthProvider[] = ['google', 'github', 'discord', 'twitter'];
  if (!validProviders.includes(provider as AuthProvider)) {
    return NextResponse.redirect(
      new URL('/auth/error?error=invalid_provider', request.url)
    );
  }

  // Handle the callback
  const result = await handleOAuthCallback(provider as AuthProvider, code, state);

  if (!result.success) {
    console.error('OAuth callback failed:', result.error);
    return NextResponse.redirect(
      new URL(`/auth/error?error=${encodeURIComponent(result.error || 'callback_failed')}`, request.url)
    );
  }

  // Set session cookie
  await setSessionCookie(result.session!);

  // Send welcome email for new users
  const isNewUser = result.user!.createdAt === result.user!.updatedAt;
  if (isNewUser && result.user!.email && result.user!.emailVerified) {
    await sendWelcomeEmail(result.user!.email, result.user!.name || undefined);
  }

  // Redirect to home or dashboard
  return NextResponse.redirect(new URL('/', request.url));
}
