/**
 * Newsletter Subscription & Email Digest System
 *
 * Features:
 * - Email subscription management
 * - Daily/weekly digest generation
 * - Multiple email providers (Resend, SendGrid, Postmark)
 * 
 * Uses unified storage layer (Upstash Redis / memory fallback)
 */

import * as storage from './storage';

// Storage namespace
const NAMESPACE = 'newsletter';
const SUBSCRIBERS_KEY = 'subscribers'; // Hash: id -> Subscriber
const EMAIL_INDEX_KEY = 'email_index'; // Hash: email -> id
const TOKEN_INDEX_KEY = 'token_index'; // Hash: token -> id

// Types
export interface Subscriber {
  id: string;
  email: string;
  frequency: 'daily' | 'weekly' | 'breaking';
  categories: string[];
  sources: string[];
  verified: boolean;
  createdAt: string;
  lastSentAt?: string;
  unsubscribeToken: string;
}

export interface DigestEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

// =============================================================================
// STORAGE HELPERS
// =============================================================================

async function getSubscriberById(id: string): Promise<Subscriber | null> {
  return storage.hget<Subscriber>(`${NAMESPACE}:${SUBSCRIBERS_KEY}`, id);
}

async function getSubscriberByEmail(email: string): Promise<Subscriber | null> {
  const id = await storage.hget<string>(`${NAMESPACE}:${EMAIL_INDEX_KEY}`, email.toLowerCase());
  if (!id) return null;
  return getSubscriberById(id);
}

async function getSubscriberByToken(token: string): Promise<Subscriber | null> {
  const id = await storage.hget<string>(`${NAMESPACE}:${TOKEN_INDEX_KEY}`, token);
  if (!id) return null;
  return getSubscriberById(id);
}

async function saveSubscriber(subscriber: Subscriber): Promise<void> {
  // Save subscriber data
  await storage.hset(`${NAMESPACE}:${SUBSCRIBERS_KEY}`, subscriber.id, subscriber);
  // Index by email
  await storage.hset(`${NAMESPACE}:${EMAIL_INDEX_KEY}`, subscriber.email.toLowerCase(), subscriber.id);
  // Index by token
  await storage.hset(`${NAMESPACE}:${TOKEN_INDEX_KEY}`, subscriber.unsubscribeToken, subscriber.id);
  // Add to frequency set
  await storage.sadd(`${NAMESPACE}:freq:${subscriber.frequency}`, subscriber.id);
  // Track in all subscribers set
  await storage.sadd(`${NAMESPACE}:all`, subscriber.id);
}

async function deleteSubscriber(subscriber: Subscriber): Promise<void> {
  // Remove from all indexes
  await storage.hdel(`${NAMESPACE}:${SUBSCRIBERS_KEY}`, subscriber.id);
  await storage.hdel(`${NAMESPACE}:${EMAIL_INDEX_KEY}`, subscriber.email.toLowerCase());
  await storage.hdel(`${NAMESPACE}:${TOKEN_INDEX_KEY}`, subscriber.unsubscribeToken);
  await storage.srem(`${NAMESPACE}:freq:${subscriber.frequency}`, subscriber.id);
  await storage.srem(`${NAMESPACE}:all`, subscriber.id);
}

// Generate tokens
function generateToken(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function generateId(): string {
  return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Subscribe an email address
 */
export async function subscribe(
  email: string,
  options: {
    frequency?: 'daily' | 'weekly' | 'breaking';
    categories?: string[];
    sources?: string[];
  } = {}
): Promise<{ success: boolean; message: string; subscriber?: Subscriber }> {
  // Validate email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { success: false, message: 'Invalid email address' };
  }

  // Check if already subscribed
  const existing = await getSubscriberByEmail(email);
  if (existing) {
    return { success: false, message: 'Email already subscribed' };
  }

  const subscriber: Subscriber = {
    id: generateId(),
    email,
    frequency: options.frequency || 'daily',
    categories: options.categories || [],
    sources: options.sources || [],
    verified: false, // Require email verification
    createdAt: new Date().toISOString(),
    unsubscribeToken: generateToken(),
  };

  await saveSubscriber(subscriber);

  // Send verification email
  await sendVerificationEmail(subscriber);

  return {
    success: true,
    message: 'Subscribed successfully. Please check your email to verify.',
    subscriber,
  };
}

// App URL for email links
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://free-crypto-news.vercel.app';

/**
 * Send verification email to new subscriber
 */
async function sendVerificationEmail(subscriber: Subscriber): Promise<boolean> {
  const verifyUrl = `${APP_URL}/api/newsletter?action=verify&token=${subscriber.unsubscribeToken}`;

  const email: DigestEmail = {
    to: subscriber.email,
    subject: 'Verify your Crypto News subscription',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #0a0a0a; color: #e5e5e5;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #fbbf24; margin: 0;">Crypto News</h1>
    <p style="color: #737373; margin-top: 5px;">Real-time cryptocurrency updates</p>
  </div>
  
  <div style="background: #171717; border-radius: 12px; padding: 30px; border: 1px solid #262626;">
    <h2 style="margin-top: 0; color: #e5e5e5;">Confirm your subscription</h2>
    <p style="color: #a3a3a3; line-height: 1.6;">
      Thanks for subscribing to our ${subscriber.frequency} crypto news digest! 
      Please click the button below to verify your email address.
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${verifyUrl}" 
         style="background: #fbbf24; color: #0a0a0a; padding: 14px 28px; 
                border-radius: 8px; text-decoration: none; font-weight: 600;
                display: inline-block;">
        Verify Email Address
      </a>
    </div>
    
    <p style="color: #737373; font-size: 14px;">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${verifyUrl}" style="color: #fbbf24; word-break: break-all;">${verifyUrl}</a>
    </p>
  </div>
  
  <div style="text-align: center; margin-top: 30px; color: #525252; font-size: 12px;">
    <p>If you didn't subscribe, you can safely ignore this email.</p>
    <p>© ${new Date().getFullYear()} Crypto News Aggregator</p>
  </div>
</body>
</html>
    `.trim(),
    text: `
Confirm your Crypto News subscription

Thanks for subscribing to our ${subscriber.frequency} crypto news digest!

Click this link to verify your email address:
${verifyUrl}

If you didn't subscribe, you can safely ignore this email.
    `.trim(),
  };

  // Try available email providers in order
  const resendKey = process.env.RESEND_API_KEY;
  const sendgridKey = process.env.SENDGRID_API_KEY;

  if (resendKey) {
    return sendViaResend(email);
  } else if (sendgridKey) {
    return sendViaSendGrid(email);
  } else {
    console.warn('[Newsletter] No email provider configured. Verification email not sent.');
    return false;
  }
}

/**
 * Verify email subscription
 */
export async function verifySubscription(
  token: string
): Promise<{ success: boolean; message: string }> {
  const subscriber = await getSubscriberByToken(token);

  if (!subscriber) {
    return { success: false, message: 'Invalid verification token' };
  }

  subscriber.verified = true;
  await saveSubscriber(subscriber);

  return { success: true, message: 'Email verified successfully' };
}

/**
 * Unsubscribe
 */
export async function unsubscribe(token: string): Promise<{ success: boolean; message: string }> {
  const subscriber = await getSubscriberByToken(token);

  if (!subscriber) {
    return { success: false, message: 'Invalid unsubscribe token' };
  }

  await deleteSubscriber(subscriber);
  return { success: true, message: 'Unsubscribed successfully' };
}

/**
 * Update subscription preferences
 */
export async function updatePreferences(
  token: string,
  options: {
    frequency?: 'daily' | 'weekly' | 'breaking';
    categories?: string[];
    sources?: string[];
  }
): Promise<{ success: boolean; message: string }> {
  const subscriber = await getSubscriberByToken(token);

  if (!subscriber) {
    return { success: false, message: 'Invalid token' };
  }

  // If frequency changed, update the frequency sets
  const oldFrequency = subscriber.frequency;
  
  if (options.frequency) subscriber.frequency = options.frequency;
  if (options.categories) subscriber.categories = options.categories;
  if (options.sources) subscriber.sources = options.sources;

  // Update frequency index if changed
  if (options.frequency && oldFrequency !== options.frequency) {
    await storage.srem(`${NAMESPACE}:freq:${oldFrequency}`, subscriber.id);
    await storage.sadd(`${NAMESPACE}:freq:${options.frequency}`, subscriber.id);
  }

  await saveSubscriber(subscriber);
  return { success: true, message: 'Preferences updated' };
}

/**
 * Get subscribers by frequency
 */
export async function getSubscribersByFrequency(
  frequency: 'daily' | 'weekly' | 'breaking'
): Promise<Subscriber[]> {
  const ids = await storage.smembers(`${NAMESPACE}:freq:${frequency}`);
  
  const subscribers: Subscriber[] = [];
  for (const id of ids) {
    const sub = await getSubscriberById(id);
    if (sub && sub.verified) {
      subscribers.push(sub);
    }
  }
  
  return subscribers;
}

/**
 * Generate digest email HTML
 */
export function generateDigestHtml(
  articles: Array<{
    title: string;
    link: string;
    source: string;
    description?: string;
    timeAgo: string;
  }>,
  subscriber: Subscriber
): string {
  const articlesList = articles
    .map(
      (a) => `
      <tr>
        <td style="padding: 16px 0; border-bottom: 1px solid #eee;">
          <a href="${a.link}" style="color: #1a1a1a; text-decoration: none; font-weight: 600; font-size: 16px;">
            ${a.title}
          </a>
          <p style="margin: 8px 0 0; color: #666; font-size: 14px;">
            ${a.description || ''}
          </p>
          <p style="margin: 8px 0 0; color: #999; font-size: 12px;">
            ${a.source} • ${a.timeAgo}
          </p>
        </td>
      </tr>
    `
    )
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Crypto News Digest</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <!-- Header -->
    <tr>
      <td style="padding: 32px; background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); text-align: center;">
        <h1 style="margin: 0; color: #000; font-size: 24px;">📰 Crypto News Digest</h1>
        <p style="margin: 8px 0 0; color: #333; font-size: 14px;">Your ${subscriber.frequency} crypto news summary</p>
      </td>
    </tr>
    
    <!-- Content -->
    <tr>
      <td style="padding: 24px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          ${articlesList}
        </table>
      </td>
    </tr>
    
    <!-- Footer -->
    <tr>
      <td style="padding: 24px; background-color: #f9f9f9; text-align: center; border-top: 1px solid #eee;">
        <p style="margin: 0; color: #666; font-size: 12px;">
          You're receiving this because you subscribed to Free Crypto News.
        </p>
        <p style="margin: 8px 0 0;">
          <a href="https://free-crypto-news.vercel.app/unsubscribe?token=${subscriber.unsubscribeToken}" 
             style="color: #999; font-size: 12px;">
            Unsubscribe
          </a>
          •
          <a href="https://free-crypto-news.vercel.app/preferences?token=${subscriber.unsubscribeToken}" 
             style="color: #999; font-size: 12px;">
            Update Preferences
          </a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * Generate plain text version
 */
export function generateDigestText(
  articles: Array<{ title: string; link: string; source: string; timeAgo: string }>,
  subscriber: Subscriber
): string {
  const articlesList = articles
    .map((a) => `• ${a.title}\n  ${a.source} • ${a.timeAgo}\n  ${a.link}`)
    .join('\n\n');

  return `
CRYPTO NEWS DIGEST
Your ${subscriber.frequency} crypto news summary

${articlesList}

---
Unsubscribe: https://free-crypto-news.vercel.app/unsubscribe?token=${subscriber.unsubscribeToken}
Update Preferences: https://free-crypto-news.vercel.app/preferences?token=${subscriber.unsubscribeToken}
  `.trim();
}

/**
 * Send email via Resend
 */
export async function sendViaResend(email: DigestEmail): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY not configured');
    return false;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Crypto News <digest@free-crypto-news.vercel.app>',
        to: email.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('Resend error:', error);
    return false;
  }
}

/**
 * Send email via SendGrid
 */
export async function sendViaSendGrid(email: DigestEmail): Promise<boolean> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    console.error('SENDGRID_API_KEY not configured');
    return false;
  }

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: email.to }] }],
        from: { email: 'digest@free-crypto-news.vercel.app', name: 'Crypto News' },
        subject: email.subject,
        content: [
          { type: 'text/plain', value: email.text },
          { type: 'text/html', value: email.html },
        ],
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('SendGrid error:', error);
    return false;
  }
}

/**
 * Get subscriber stats
 */
export async function getSubscriberStats(): Promise<{
  total: number;
  verified: number;
  byFrequency: Record<string, number>;
}> {
  const allIds = await storage.smembers(`${NAMESPACE}:all`);
  
  let verified = 0;
  for (const id of allIds) {
    const sub = await getSubscriberById(id);
    if (sub?.verified) verified++;
  }
  
  const [dailyCount, weeklyCount, breakingCount] = await Promise.all([
    storage.smembers(`${NAMESPACE}:freq:daily`).then(m => m.length),
    storage.smembers(`${NAMESPACE}:freq:weekly`).then(m => m.length),
    storage.smembers(`${NAMESPACE}:freq:breaking`).then(m => m.length),
  ]);

  return {
    total: allIds.length,
    verified,
    byFrequency: {
      daily: dailyCount,
      weekly: weeklyCount,
      breaking: breakingCount,
    },
  };
}
