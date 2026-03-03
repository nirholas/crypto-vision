import { type Context, type Next } from "hono";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { getDb, users } from "../../db/index.js";
import { eq } from "drizzle-orm";
import { getRedis } from "../../utils/redis.js";
import { generateNonce, SiweMessage } from "siwe";

// SIWE session data
export interface SiweSession {
  userId: string;
  walletAddress: string;
  smartWalletAddress?: string;
  chainId: number;
  issuedAt: number;
  expiresAt: number;
}

// Extend Hono context with session
declare module "hono" {
  interface ContextVariableMap {
    session: SiweSession;
    walletAddress: string;
    userId: string;
  }
}

// Session cookie/header name
const SESSION_HEADER = "x-session-token";
const SESSION_PREFIX = "session:";
const SESSION_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

/**
 * Generate a nonce for SIWE authentication
 */
export async function generateSiweNonce(walletAddress: string): Promise<string> {
  const nonce = generateNonce();
  const redis = getRedis();

  // Store nonce with 10 minute expiry
  await redis.setex(`nonce:${walletAddress.toLowerCase()}`, 600, nonce);

  return nonce;
}

/**
 * Verify a SIWE message and create a session
 */
export async function verifySiweMessage(
  message: string,
  signature: string
): Promise<{ session: SiweSession; token: string }> {
  const redis = getRedis();
  const db = getDb();

  try {
    // Parse the SIWE message
    const siweMessage = new SiweMessage(message);

    // Verify the nonce
    const storedNonce = await redis.get(
      `nonce:${siweMessage.address.toLowerCase()}`
    );
    if (!storedNonce || storedNonce !== siweMessage.nonce) {
      throw new Error("Invalid or expired nonce");
    }

    // Verify the signature
    const isValid = await siweMessage.verify({
      signature,
      nonce: siweMessage.nonce,
    });

    if (!isValid.success) {
      throw new Error("Invalid signature");
    }

    // Delete the used nonce
    await redis.del(`nonce:${siweMessage.address.toLowerCase()}`);

    // Find or create user
    let user = await db.query.users.findFirst({
      where: eq(users.walletAddress, siweMessage.address.toLowerCase()),
    });

    if (!user) {
      const [newUser] = await db
        .insert(users)
        .values({
          walletAddress: siweMessage.address.toLowerCase(),
        })
        .returning();
      user = newUser;
    }

    // Update last active
    await db
      .update(users)
      .set({ lastActive: new Date() })
      .where(eq(users.id, user.id));

    // Create session
    const now = Date.now();
    const session: SiweSession = {
      userId: user.id,
      walletAddress: siweMessage.address.toLowerCase(),
      smartWalletAddress: user.smartWalletAddress ?? undefined,
      chainId: siweMessage.chainId,
      issuedAt: now,
      expiresAt: now + SESSION_TTL * 1000,
    };

    // Generate session token
    const token = Buffer.from(
      `${user.id}:${now}:${Math.random().toString(36).slice(2)}`
    ).toString("base64url");

    // Store session in Redis
    await redis.setex(
      `${SESSION_PREFIX}${token}`,
      SESSION_TTL,
      JSON.stringify(session)
    );

    return { session, token };
  } catch (error) {
    console.error("[Auth] SIWE verification failed:", error);
    throw new Error("Authentication failed");
  }
}

/**
 * Get session from token
 */
async function getSession(token: string): Promise<SiweSession | null> {
  const redis = getRedis();
  const sessionData = await redis.get(`${SESSION_PREFIX}${token}`);

  if (!sessionData) {
    return null;
  }

  const session = JSON.parse(sessionData) as SiweSession;

  // Check if expired
  if (session.expiresAt < Date.now()) {
    await redis.del(`${SESSION_PREFIX}${token}`);
    return null;
  }

  return session;
}

/**
 * Invalidate a session
 */
export async function invalidateSession(token: string): Promise<void> {
  const redis = getRedis();
  await redis.del(`${SESSION_PREFIX}${token}`);
}

/**
 * SIWE authentication middleware
 * Requires a valid session token in the x-session-token header
 */
export const authMiddleware = createMiddleware(async (c: Context, next: Next) => {
  const token = c.req.header(SESSION_HEADER);

  if (!token) {
    throw new HTTPException(401, {
      message: "Missing authentication token",
    });
  }

  const session = await getSession(token);

  if (!session) {
    throw new HTTPException(401, {
      message: "Invalid or expired session",
    });
  }

  // Set session data in context
  c.set("session", session);
  c.set("walletAddress", session.walletAddress);
  c.set("userId", session.userId);

  await next();
});

/**
 * Optional auth middleware - allows unauthenticated requests
 */
export const optionalAuthMiddleware = createMiddleware(
  async (c: Context, next: Next) => {
    const token = c.req.header(SESSION_HEADER);

    if (token) {
      const session = await getSession(token);
      if (session) {
        c.set("session", session);
        c.set("walletAddress", session.walletAddress);
        c.set("userId", session.userId);
      }
    }

    await next();
  }
);

/**
 * Verify wallet ownership middleware
 * Requires the request to include a valid signature for the wallet address
 */
export const verifyWalletMiddleware = createMiddleware(
  async (c: Context, next: Next) => {
    const session = c.get("session");
    const requestedAddress = c.req.param("address");

    if (!session) {
      throw new HTTPException(401, {
        message: "Authentication required",
      });
    }

    // Check if user owns this wallet
    if (
      requestedAddress &&
      requestedAddress.toLowerCase() !== session.walletAddress.toLowerCase()
    ) {
      throw new HTTPException(403, {
        message: "Not authorized to access this wallet",
      });
    }

    await next();
  }
);
