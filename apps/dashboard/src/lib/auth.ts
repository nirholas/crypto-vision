/**
 * Authentication System
 * 
 * Enterprise-grade user authentication with:
 * - OAuth providers (Google, GitHub, Discord, Twitter)
 * - Magic link email authentication
 * - Session management with JWT
 * - User profile management
 * - Cross-device data sync
 * 
 * @module lib/auth
 */

import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { cookies } from 'next/headers';
import { cache } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export interface User {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  emailVerified: boolean;
  provider: AuthProvider;
  providerId: string | null;
  role: 'user' | 'pro' | 'admin';
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  settings: UserSettings;
}

export interface UserSettings {
  theme: 'light' | 'dark' | 'system';
  currency: string;
  timezone: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  weeklyDigest: boolean;
  priceAlertEmails: boolean;
  language: string;
}

export interface Session {
  id: string;
  userId: string;
  user: User;
  expiresAt: string;
  createdAt: string;
  userAgent: string | null;
  ipAddress: string | null;
}

export type AuthProvider = 'email' | 'google' | 'github' | 'discord' | 'twitter';

export interface AuthResult {
  success: boolean;
  user?: User;
  session?: Session;
  error?: string;
  requiresVerification?: boolean;
}

export interface MagicLinkToken {
  email: string;
  token: string;
  expiresAt: string;
  used: boolean;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const JWT_SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || process.env.JWT_SECRET || 'your-secret-key-min-32-chars-long!'
);
const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAGIC_LINK_DURATION = 15 * 60 * 1000; // 15 minutes

// OAuth provider configurations
export const OAUTH_PROVIDERS = {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
    scopes: ['openid', 'email', 'profile'],
  },
  github: {
    clientId: process.env.GITHUB_CLIENT_ID || '',
    clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
    scopes: ['read:user', 'user:email'],
  },
  discord: {
    clientId: process.env.DISCORD_CLIENT_ID || '',
    clientSecret: process.env.DISCORD_CLIENT_SECRET || '',
    authUrl: 'https://discord.com/api/oauth2/authorize',
    tokenUrl: 'https://discord.com/api/oauth2/token',
    userInfoUrl: 'https://discord.com/api/users/@me',
    scopes: ['identify', 'email'],
  },
  twitter: {
    clientId: process.env.TWITTER_CLIENT_ID || '',
    clientSecret: process.env.TWITTER_CLIENT_SECRET || '',
    authUrl: 'https://twitter.com/i/oauth2/authorize',
    tokenUrl: 'https://api.twitter.com/2/oauth2/token',
    userInfoUrl: 'https://api.twitter.com/2/users/me',
    scopes: ['tweet.read', 'users.read', 'offline.access'],
  },
} as const;

// =============================================================================
// IN-MEMORY STORAGE (Replace with database in production)
// =============================================================================

const users = new Map<string, User>();
const sessions = new Map<string, Session>();
const magicLinks = new Map<string, MagicLinkToken>();
const oauthStates = new Map<string, { provider: AuthProvider; redirectTo: string; expiresAt: number }>();

// Index for quick lookups
const usersByEmail = new Map<string, string>(); // email -> userId
const usersByProviderId = new Map<string, string>(); // provider:id -> userId

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return prefix ? `${prefix}_${timestamp}${random}` : `${timestamp}${random}`;
}

function generateSecureToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

const defaultSettings: UserSettings = {
  theme: 'dark',
  currency: 'USD',
  timezone: 'UTC',
  emailNotifications: true,
  pushNotifications: true,
  weeklyDigest: false,
  priceAlertEmails: true,
  language: 'en',
};

// =============================================================================
// JWT FUNCTIONS
// =============================================================================

export async function createSessionToken(session: Session): Promise<string> {
  return new SignJWT({
    sessionId: session.id,
    userId: session.userId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(session.expiresAt)
    .sign(JWT_SECRET);
}

export async function verifySessionToken(token: string): Promise<{ sessionId: string; userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      sessionId: payload.sessionId as string,
      userId: payload.userId as string,
    };
  } catch {
    return null;
  }
}

// =============================================================================
// USER MANAGEMENT
// =============================================================================

export async function createUser(data: {
  email: string;
  name?: string;
  image?: string;
  provider: AuthProvider;
  providerId?: string;
  emailVerified?: boolean;
}): Promise<User> {
  const id = generateId('usr');
  const now = new Date().toISOString();

  const user: User = {
    id,
    email: data.email.toLowerCase(),
    name: data.name || null,
    image: data.image || null,
    emailVerified: data.emailVerified || false,
    provider: data.provider,
    providerId: data.providerId || null,
    role: 'user',
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
    settings: { ...defaultSettings },
  };

  users.set(id, user);
  usersByEmail.set(user.email, id);
  
  if (data.providerId) {
    usersByProviderId.set(`${data.provider}:${data.providerId}`, id);
  }

  return user;
}

export async function getUserById(id: string): Promise<User | null> {
  return users.get(id) || null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const userId = usersByEmail.get(email.toLowerCase());
  if (!userId) return null;
  return users.get(userId) || null;
}

export async function getUserByProviderId(provider: AuthProvider, providerId: string): Promise<User | null> {
  const userId = usersByProviderId.get(`${provider}:${providerId}`);
  if (!userId) return null;
  return users.get(userId) || null;
}

export async function updateUser(id: string, updates: Partial<User>): Promise<User | null> {
  const user = users.get(id);
  if (!user) return null;

  const updatedUser: User = {
    ...user,
    ...updates,
    id: user.id, // Prevent ID change
    updatedAt: new Date().toISOString(),
  };

  users.set(id, updatedUser);
  return updatedUser;
}

export async function updateUserSettings(id: string, settings: Partial<UserSettings>): Promise<User | null> {
  const user = users.get(id);
  if (!user) return null;

  return updateUser(id, {
    settings: { ...user.settings, ...settings },
  });
}

// =============================================================================
// SESSION MANAGEMENT
// =============================================================================

export async function createSession(
  userId: string,
  metadata?: { userAgent?: string; ipAddress?: string }
): Promise<Session> {
  const user = await getUserById(userId);
  if (!user) throw new Error('User not found');

  const session: Session = {
    id: generateId('ses'),
    userId,
    user,
    expiresAt: new Date(Date.now() + SESSION_DURATION).toISOString(),
    createdAt: new Date().toISOString(),
    userAgent: metadata?.userAgent || null,
    ipAddress: metadata?.ipAddress || null,
  };

  sessions.set(session.id, session);

  // Update last login
  await updateUser(userId, { lastLoginAt: session.createdAt });

  return session;
}

export async function getSession(sessionId: string): Promise<Session | null> {
  const session = sessions.get(sessionId);
  if (!session) return null;

  // Check expiration
  if (new Date(session.expiresAt) < new Date()) {
    sessions.delete(sessionId);
    return null;
  }

  // Refresh user data
  const user = await getUserById(session.userId);
  if (!user) {
    sessions.delete(sessionId);
    return null;
  }

  return { ...session, user };
}

export async function deleteSession(sessionId: string): Promise<void> {
  sessions.delete(sessionId);
}

export async function deleteAllUserSessions(userId: string): Promise<void> {
  for (const [id, session] of sessions) {
    if (session.userId === userId) {
      sessions.delete(id);
    }
  }
}

// =============================================================================
// MAGIC LINK AUTHENTICATION
// =============================================================================

export async function createMagicLink(email: string): Promise<string> {
  const token = generateSecureToken();
  const expiresAt = new Date(Date.now() + MAGIC_LINK_DURATION).toISOString();

  magicLinks.set(token, {
    email: email.toLowerCase(),
    token,
    expiresAt,
    used: false,
  });

  // Clean up expired tokens
  for (const [t, data] of magicLinks) {
    if (new Date(data.expiresAt) < new Date() || data.used) {
      magicLinks.delete(t);
    }
  }

  return token;
}

export async function verifyMagicLink(token: string): Promise<AuthResult> {
  const magicLink = magicLinks.get(token);

  if (!magicLink) {
    return { success: false, error: 'Invalid or expired magic link' };
  }

  if (magicLink.used) {
    return { success: false, error: 'This magic link has already been used' };
  }

  if (new Date(magicLink.expiresAt) < new Date()) {
    magicLinks.delete(token);
    return { success: false, error: 'This magic link has expired' };
  }

  // Mark as used
  magicLink.used = true;
  magicLinks.set(token, magicLink);

  // Find or create user
  let user = await getUserByEmail(magicLink.email);
  
  if (!user) {
    user = await createUser({
      email: magicLink.email,
      provider: 'email',
      emailVerified: true,
    });
  } else {
    // Mark email as verified
    await updateUser(user.id, { emailVerified: true });
    user = (await getUserById(user.id))!;
  }

  // Create session
  const session = await createSession(user.id);

  return { success: true, user, session };
}

// =============================================================================
// OAUTH AUTHENTICATION
// =============================================================================

/**
 * Check if an OAuth provider is configured
 */
export function isOAuthProviderConfigured(provider: AuthProvider): boolean {
  if (provider === 'email') return true;
  const config = OAUTH_PROVIDERS[provider as keyof typeof OAUTH_PROVIDERS];
  return !!(config?.clientId && config?.clientSecret);
}

/**
 * Get list of configured OAuth providers
 */
export function getConfiguredOAuthProviders(): AuthProvider[] {
  return (['google', 'github', 'discord', 'twitter'] as AuthProvider[]).filter(isOAuthProviderConfigured);
}

export function getOAuthUrl(provider: AuthProvider, redirectTo: string = '/'): string {
  const config = OAUTH_PROVIDERS[provider as keyof typeof OAUTH_PROVIDERS];
  if (!config || !config.clientId || !config.clientSecret) {
    // Fallback: return a disabled state URL that will show an error
    console.warn(`[Auth] OAuth provider ${provider} not configured - missing credentials`);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return `${baseUrl}/auth/error?error=provider_not_configured&provider=${provider}`;
  }

  const state = generateSecureToken();
  oauthStates.set(state, {
    provider,
    redirectTo,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const redirectUri = `${baseUrl}/api/auth/callback/${provider}`;

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: config.scopes.join(' '),
    state,
  });

  // Provider-specific params
  if (provider === 'google') {
    params.set('access_type', 'offline');
    params.set('prompt', 'consent');
  }
  if (provider === 'twitter') {
    params.set('code_challenge_method', 'plain');
    params.set('code_challenge', state);
  }

  return `${config.authUrl}?${params.toString()}`;
}

export async function handleOAuthCallback(
  provider: AuthProvider,
  code: string,
  state: string
): Promise<AuthResult> {
  // Check if provider is configured
  if (!isOAuthProviderConfigured(provider)) {
    return { success: false, error: `OAuth provider ${provider} is not configured` };
  }

  // Verify state
  const stateData = oauthStates.get(state);
  if (!stateData || stateData.provider !== provider || stateData.expiresAt < Date.now()) {
    oauthStates.delete(state);
    return { success: false, error: 'Invalid or expired OAuth state' };
  }
  oauthStates.delete(state);

  const config = OAUTH_PROVIDERS[provider as keyof typeof OAUTH_PROVIDERS];
  if (!config || !config.clientId) {
    return { success: false, error: `Unknown provider: ${provider}` };
  }

  try {
    // Exchange code for tokens
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const redirectUri = `${baseUrl}/api/auth/callback/${provider}`;

    const tokenResponse = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        ...(provider === 'twitter' ? { code_verifier: state } : {}),
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('Token exchange failed:', error);
      return { success: false, error: 'Failed to authenticate with provider' };
    }

    const tokens = await tokenResponse.json();
    const accessToken = tokens.access_token;

    // Fetch user info
    const userResponse = await fetch(config.userInfoUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!userResponse.ok) {
      return { success: false, error: 'Failed to fetch user information' };
    }

    const userInfo = await userResponse.json();

    // Extract user data based on provider
    let email: string | null = null;
    let name: string | null = null;
    let image: string | null = null;
    let providerId: string;

    switch (provider) {
      case 'google':
        email = userInfo.email;
        name = userInfo.name;
        image = userInfo.picture;
        providerId = userInfo.sub;
        break;
      case 'github':
        email = userInfo.email;
        name = userInfo.name || userInfo.login;
        image = userInfo.avatar_url;
        providerId = String(userInfo.id);
        // GitHub may not return email, need to fetch separately
        if (!email) {
          const emailsResponse = await fetch('https://api.github.com/user/emails', {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (emailsResponse.ok) {
            const emails = await emailsResponse.json();
            const primary = emails.find((e: { primary: boolean }) => e.primary);
            email = primary?.email || emails[0]?.email;
          }
        }
        break;
      case 'discord':
        email = userInfo.email;
        name = userInfo.global_name || userInfo.username;
        image = userInfo.avatar
          ? `https://cdn.discordapp.com/avatars/${userInfo.id}/${userInfo.avatar}.png`
          : null;
        providerId = userInfo.id;
        break;
      case 'twitter':
        const twitterData = userInfo.data;
        email = null; // Twitter doesn't provide email in basic scope
        name = twitterData.name;
        image = twitterData.profile_image_url;
        providerId = twitterData.id;
        break;
      default:
        return { success: false, error: 'Unknown provider' };
    }

    if (!email && provider !== 'twitter') {
      return { success: false, error: 'Email not provided by OAuth provider' };
    }

    // Find or create user
    let user = await getUserByProviderId(provider, providerId);
    
    if (!user && email) {
      user = await getUserByEmail(email);
    }

    if (!user) {
      user = await createUser({
        email: email || `${providerId}@${provider}.oauth`,
        name: name ?? undefined,
        image: image ?? undefined,
        provider,
        providerId,
        emailVerified: !!email,
      });
    } else {
      // Update user info
      await updateUser(user.id, {
        name: name ?? user.name ?? undefined,
        image: image ?? user.image ?? undefined,
        emailVerified: user.emailVerified || !!email,
      });
      user = (await getUserById(user.id))!;
    }

    // Create session
    const session = await createSession(user.id);

    return { success: true, user, session };
  } catch (error) {
    console.error('OAuth error:', error);
    return { success: false, error: 'Authentication failed' };
  }
}

// =============================================================================
// SESSION COOKIE HELPERS
// =============================================================================

const SESSION_COOKIE_NAME = 'crypto-session';

export async function setSessionCookie(session: Session): Promise<void> {
  const token = await createSessionToken(session);
  const cookieStore = await cookies();
  
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: new Date(session.expiresAt),
    path: '/',
  });
}

export async function getSessionFromCookie(): Promise<Session | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    
    if (!token) return null;

    const payload = await verifySessionToken(token);
    if (!payload) return null;

    return getSession(payload.sessionId);
  } catch {
    return null;
  }
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

// =============================================================================
// CURRENT USER HELPER (cached per request)
// =============================================================================

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const session = await getSessionFromCookie();
  return session?.user || null;
});

export const getCurrentSession = cache(async (): Promise<Session | null> => {
  return getSessionFromCookie();
});

// =============================================================================
// AUTH ACTIONS
// =============================================================================

export async function signIn(
  provider: AuthProvider,
  options?: { email?: string; redirectTo?: string }
): Promise<AuthResult | string> {
  if (provider === 'email') {
    if (!options?.email) {
      return { success: false, error: 'Email is required' };
    }
    
    const token = await createMagicLink(options.email);
    
    // Return the token - caller should send the email
    return { 
      success: true, 
      requiresVerification: true,
      // In production, send email via email service
    };
  }

  // OAuth providers - return the auth URL
  return getOAuthUrl(provider, options?.redirectTo);
}

export async function signOut(): Promise<void> {
  const session = await getSessionFromCookie();
  if (session) {
    await deleteSession(session.id);
  }
  await clearSessionCookie();
}

// =============================================================================
// USER DATA SYNC
// =============================================================================

export interface UserData {
  watchlist: string[];
  portfolio: Record<string, unknown>;
  alerts: Record<string, unknown>[];
  bookmarks: string[];
  preferences: Record<string, unknown>;
}

const userDataStore = new Map<string, UserData>();

export async function getUserData(userId: string): Promise<UserData> {
  return userDataStore.get(userId) || {
    watchlist: [],
    portfolio: {},
    alerts: [],
    bookmarks: [],
    preferences: {},
  };
}

export async function updateUserData(userId: string, data: Partial<UserData>): Promise<UserData> {
  const existing = await getUserData(userId);
  const updated = { ...existing, ...data };
  userDataStore.set(userId, updated);
  return updated;
}

export async function syncUserData(
  userId: string,
  localData: UserData,
  strategy: 'merge' | 'replace' | 'server-wins' = 'merge'
): Promise<UserData> {
  const serverData = await getUserData(userId);

  if (strategy === 'replace') {
    return updateUserData(userId, localData);
  }

  if (strategy === 'server-wins') {
    return serverData;
  }

  // Merge strategy
  const merged: UserData = {
    watchlist: [...new Set([...serverData.watchlist, ...localData.watchlist])],
    portfolio: { ...serverData.portfolio, ...localData.portfolio },
    alerts: [...serverData.alerts, ...localData.alerts.filter(
      a => !serverData.alerts.some(sa => sa.id === a.id)
    )],
    bookmarks: [...new Set([...serverData.bookmarks, ...localData.bookmarks])],
    preferences: { ...serverData.preferences, ...localData.preferences },
  };

  return updateUserData(userId, merged);
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  createUser,
  getUserById,
  getUserByEmail,
  updateUser,
  updateUserSettings,
  createSession,
  getSession,
  deleteSession,
  createMagicLink,
  verifyMagicLink,
  getOAuthUrl,
  handleOAuthCallback,
  setSessionCookie,
  getSessionFromCookie,
  clearSessionCookie,
  getCurrentUser,
  getCurrentSession,
  signIn,
  signOut,
  getUserData,
  updateUserData,
  syncUserData,
};
