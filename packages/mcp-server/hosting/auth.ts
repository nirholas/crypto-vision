/**
 * Authentication for MCP Hosting Platform
 * @description Simple JWT-based auth with bcrypt password hashing
 * @author nirholas
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Logger from '@/utils/logger.js';
import type { MCPHostingUser } from './types.js';

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'agenti-mcp-hosting-secret-change-in-production';
const JWT_EXPIRES_IN = '7d';
const BCRYPT_ROUNDS = 12;

// TODO: Replace with database storage (Prisma/Postgres)
// In-memory user storage for development
const users = new Map<string, StoredUser>();
const usersByEmail = new Map<string, string>(); // email -> id mapping

interface StoredUser {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  tier: 'free' | 'pro' | 'business' | 'enterprise';
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  tier: 'free' | 'pro' | 'business' | 'enterprise';
}

export interface AuthTokenPayload {
  userId: string;
  email: string;
  tier: string;
  iat: number;
  exp: number;
}

export interface SignUpResult {
  user: AuthUser;
  token: string;
}

export interface SignInResult {
  user: AuthUser;
  token: string;
}

/**
 * Generate a unique user ID
 */
function generateUserId(): string {
  return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a username from email
 */
function generateUsername(email: string): string {
  const base = (email.split('@')[0] || 'user').toLowerCase().replace(/[^a-z0-9]/g, '');
  const suffix = Math.random().toString(36).substr(2, 4);
  return `${base}${suffix}`;
}

/**
 * Sign up a new user
 */
export async function signUp(
  email: string,
  password: string,
  username?: string
): Promise<SignUpResult> {
  // Validate email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('Invalid email format');
  }

  // Check if email already exists
  if (usersByEmail.has(email.toLowerCase())) {
    throw new Error('Email already registered');
  }

  // Validate password
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  // Create user
  const id = generateUserId();
  const finalUsername = username || generateUsername(email);
  const now = new Date();

  const user: StoredUser = {
    id,
    email: email.toLowerCase(),
    username: finalUsername,
    passwordHash,
    tier: 'free',
    createdAt: now,
    updatedAt: now,
  };

  // Store user
  users.set(id, user);
  usersByEmail.set(email.toLowerCase(), id);

  Logger.info('User signed up', { userId: id, email: user.email });

  // Generate token
  const token = generateToken(user);

  return {
    user: sanitizeUser(user),
    token,
  };
}

/**
 * Sign in an existing user
 */
export async function signIn(
  email: string,
  password: string
): Promise<SignInResult> {
  // Find user by email
  const userId = usersByEmail.get(email.toLowerCase());
  if (!userId) {
    throw new Error('Invalid email or password');
  }

  const user = users.get(userId);
  if (!user) {
    throw new Error('Invalid email or password');
  }

  // Verify password
  const validPassword = await bcrypt.compare(password, user.passwordHash);
  if (!validPassword) {
    throw new Error('Invalid email or password');
  }

  Logger.info('User signed in', { userId: user.id, email: user.email });

  // Generate token
  const token = generateToken(user);

  return {
    user: sanitizeUser(user),
    token,
  };
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): AuthTokenPayload {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
    return payload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    }
    throw error;
  }
}

/**
 * Get user from token
 */
export function getUserFromToken(token: string): AuthUser | null {
  try {
    const payload = verifyToken(token);
    const user = users.get(payload.userId);
    if (!user) return null;
    return sanitizeUser(user);
  } catch {
    return null;
  }
}

/**
 * Get user by ID
 */
export function getUserById(id: string): AuthUser | null {
  const user = users.get(id);
  if (!user) return null;
  return sanitizeUser(user);
}

/**
 * Update user tier (called after Stripe webhook)
 */
export async function updateUserTier(
  userId: string,
  tier: 'free' | 'pro' | 'business' | 'enterprise',
  stripeCustomerId?: string,
  stripeSubscriptionId?: string
): Promise<AuthUser> {
  const user = users.get(userId);
  if (!user) {
    throw new Error('User not found');
  }

  user.tier = tier;
  user.updatedAt = new Date();
  
  if (stripeCustomerId) {
    user.stripeCustomerId = stripeCustomerId;
  }
  if (stripeSubscriptionId) {
    user.stripeSubscriptionId = stripeSubscriptionId;
  }

  users.set(userId, user);
  
  Logger.info('User tier updated', { userId, tier });

  return sanitizeUser(user);
}

/**
 * Update user Stripe info
 */
export async function updateUserStripeInfo(
  userId: string,
  stripeCustomerId: string,
  stripeSubscriptionId?: string
): Promise<void> {
  const user = users.get(userId);
  if (!user) {
    throw new Error('User not found');
  }

  user.stripeCustomerId = stripeCustomerId;
  if (stripeSubscriptionId) {
    user.stripeSubscriptionId = stripeSubscriptionId;
  }
  user.updatedAt = new Date();

  users.set(userId, user);
}

/**
 * Get user's Stripe customer ID
 */
export function getStripeCustomerId(userId: string): string | null {
  const user = users.get(userId);
  return user?.stripeCustomerId || null;
}

/**
 * Generate JWT token for user
 */
function generateToken(user: StoredUser): string {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      tier: user.tier,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Refresh token (generate new token for existing user)
 */
export function refreshToken(userId: string): string | null {
  const user = users.get(userId);
  if (!user) return null;
  return generateToken(user);
}

/**
 * Remove sensitive data from user object
 */
function sanitizeUser(user: StoredUser): AuthUser {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    tier: user.tier,
  };
}

/**
 * Middleware helper to extract token from Authorization header
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  if (!authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}

/**
 * Hash a password (utility for migrations)
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verify a password against hash (utility)
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export default {
  signUp,
  signIn,
  verifyToken,
  getUserFromToken,
  getUserById,
  updateUserTier,
  updateUserStripeInfo,
  getStripeCustomerId,
  refreshToken,
  extractBearerToken,
  hashPassword,
  verifyPassword,
};
