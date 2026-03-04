/**
 * Email Service
 * 
 * Enterprise-grade email delivery using Resend API
 * Supports transactional emails, alerts, and newsletters
 * 
 * @module lib/email
 */

import { getCoinUrl } from '@/lib/urls';

// =============================================================================
// TYPES
// =============================================================================

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  tags?: { name: string; value: string }[];
  headers?: Record<string, string>;
  attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType?: string;
}

export interface EmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

export interface BulkEmailResult {
  sent: number;
  failed: number;
  results: EmailResult[];
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text?: string;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESEND_API_URL = 'https://api.resend.com';
const DEFAULT_FROM = process.env.EMAIL_FROM || 'Crypto News <alerts@cryptonews.app>';
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Crypto Data Aggregator';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://crypto-data-aggregator.vercel.app';

// Rate limiting
const EMAIL_RATE_LIMIT = 100; // per minute
const emailsSentThisMinute = { count: 0, resetAt: Date.now() + 60000 };

// =============================================================================
// CORE EMAIL FUNCTION
// =============================================================================

export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  // Check configuration
  if (!RESEND_API_KEY) {
    console.warn('[Email] Resend API key not configured');
    // In development, log the email instead
    if (process.env.NODE_ENV === 'development') {
      console.log('[Email] Would send:', {
        to: options.to,
        subject: options.subject,
        preview: options.text?.slice(0, 100) || options.html?.slice(0, 100),
      });
      return { success: true, id: `dev_${Date.now()}` };
    }
    return { success: false, error: 'Email service not configured' };
  }

  // Rate limiting
  if (Date.now() > emailsSentThisMinute.resetAt) {
    emailsSentThisMinute.count = 0;
    emailsSentThisMinute.resetAt = Date.now() + 60000;
  }
  if (emailsSentThisMinute.count >= EMAIL_RATE_LIMIT) {
    return { success: false, error: 'Rate limit exceeded' };
  }
  emailsSentThisMinute.count++;

  try {
    const response = await fetch(`${RESEND_API_URL}/emails`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: options.from || DEFAULT_FROM,
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text,
        reply_to: options.replyTo,
        cc: options.cc,
        bcc: options.bcc,
        tags: options.tags,
        headers: options.headers,
        attachments: options.attachments?.map(a => ({
          filename: a.filename,
          content: typeof a.content === 'string' ? a.content : a.content.toString('base64'),
        })),
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[Email] Send failed:', error);
      return { success: false, error: error.message || 'Failed to send email' };
    }

    const data = await response.json();
    return { success: true, id: data.id };
  } catch (error) {
    console.error('[Email] Error:', error);
    return { success: false, error: 'Failed to send email' };
  }
}

export async function sendBulkEmails(emails: EmailOptions[]): Promise<BulkEmailResult> {
  const results: EmailResult[] = [];
  let sent = 0;
  let failed = 0;

  // Process in batches of 10
  const batchSize = 10;
  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(sendEmail));
    
    for (const result of batchResults) {
      results.push(result);
      if (result.success) sent++;
      else failed++;
    }

    // Small delay between batches
    if (i + batchSize < emails.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return { sent, failed, results };
}

// =============================================================================
// EMAIL TEMPLATES
// =============================================================================

const baseStyles = `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
  .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
  .header h1 { color: #fff; margin: 0; font-size: 24px; }
  .header .logo { font-size: 32px; margin-bottom: 10px; }
  .content { background: #fff; padding: 30px; border: 1px solid #e5e7eb; }
  .footer { background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none; }
  .button { display: inline-block; background: #3861FB; color: #fff !important; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
  .button:hover { background: #2a4bd4; }
  .alert-box { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 8px; margin: 15px 0; }
  .price-up { color: #16C784; font-weight: bold; }
  .price-down { color: #EA3943; font-weight: bold; }
  .divider { border-top: 1px solid #e5e7eb; margin: 20px 0; }
  .muted { color: #6b7280; font-size: 14px; }
  .coin-row { display: flex; align-items: center; padding: 10px 0; border-bottom: 1px solid #f3f4f6; }
  .coin-symbol { font-weight: bold; min-width: 80px; }
`;

function wrapTemplate(content: string, preheader?: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${APP_NAME}</title>
  <style>${baseStyles}</style>
</head>
<body>
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;">${preheader}</div>` : ''}
  <div class="container">
    <div class="header">
      <div class="logo">📊</div>
      <h1>${APP_NAME}</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>${APP_NAME} • <a href="${APP_URL}">Visit Dashboard</a></p>
      <p>You're receiving this because you signed up for alerts.</p>
      <p><a href="${APP_URL}/settings/notifications">Manage Preferences</a> • <a href="${APP_URL}/unsubscribe">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>
  `;
}

// =============================================================================
// AUTHENTICATION EMAILS
// =============================================================================

export async function sendMagicLink(email: string, token: string): Promise<EmailResult> {
  const magicLinkUrl = `${APP_URL}/api/auth/verify?token=${token}`;
  
  const html = wrapTemplate(`
    <h2>Sign in to ${APP_NAME}</h2>
    <p>Click the button below to sign in to your account. This link expires in 15 minutes.</p>
    <p style="text-align: center;">
      <a href="${magicLinkUrl}" class="button">Sign In</a>
    </p>
    <p class="muted">Or copy and paste this link:</p>
    <p style="word-break: break-all; font-size: 12px; background: #f3f4f6; padding: 10px; border-radius: 4px;">
      ${magicLinkUrl}
    </p>
    <div class="divider"></div>
    <p class="muted">If you didn't request this email, you can safely ignore it.</p>
  `, 'Sign in to your account');

  return sendEmail({
    to: email,
    subject: `Sign in to ${APP_NAME}`,
    html,
    text: `Sign in to ${APP_NAME}\n\nClick this link to sign in: ${magicLinkUrl}\n\nThis link expires in 15 minutes.`,
    tags: [{ name: 'type', value: 'auth' }, { name: 'action', value: 'magic-link' }],
  });
}

export async function sendWelcomeEmail(email: string, name?: string): Promise<EmailResult> {
  const html = wrapTemplate(`
    <h2>Welcome${name ? `, ${name}` : ''}! 🎉</h2>
    <p>Thanks for joining ${APP_NAME}. Here's what you can do:</p>
    <ul>
      <li><strong>Track prices</strong> - Real-time data for 10,000+ cryptocurrencies</li>
      <li><strong>Set alerts</strong> - Get notified when prices move</li>
      <li><strong>Build your portfolio</strong> - Track your holdings across exchanges</li>
      <li><strong>Stay informed</strong> - Aggregated news from 12+ sources</li>
    </ul>
    <p style="text-align: center;">
      <a href="${APP_URL}/dashboard" class="button">Go to Dashboard</a>
    </p>
    <div class="divider"></div>
    <p class="muted">Questions? Reply to this email and we'll help you out.</p>
  `, 'Welcome to Crypto Data Aggregator!');

  return sendEmail({
    to: email,
    subject: `Welcome to ${APP_NAME}! 🚀`,
    html,
    text: `Welcome to ${APP_NAME}!\n\nThanks for joining. Visit ${APP_URL}/dashboard to get started.`,
    tags: [{ name: 'type', value: 'auth' }, { name: 'action', value: 'welcome' }],
  });
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<EmailResult> {
  const resetUrl = `${APP_URL}/auth/reset-password?token=${token}`;
  
  const html = wrapTemplate(`
    <h2>Reset Your Password</h2>
    <p>We received a request to reset your password. Click the button below to create a new password.</p>
    <p style="text-align: center;">
      <a href="${resetUrl}" class="button">Reset Password</a>
    </p>
    <p class="muted">This link expires in 1 hour.</p>
    <div class="divider"></div>
    <p class="muted">If you didn't request this, please ignore this email or contact support if you're concerned.</p>
  `, 'Reset your password');

  return sendEmail({
    to: email,
    subject: `Reset your ${APP_NAME} password`,
    html,
    text: `Reset Your Password\n\nClick this link to reset: ${resetUrl}\n\nThis link expires in 1 hour.`,
    tags: [{ name: 'type', value: 'auth' }, { name: 'action', value: 'password-reset' }],
  });
}

// =============================================================================
// PRICE ALERT EMAILS
// =============================================================================

export interface PriceAlertData {
  coinName: string;
  coinSymbol: string;
  currentPrice: number;
  targetPrice: number;
  condition: 'above' | 'below' | 'percent_up' | 'percent_down';
  changePercent?: number;
  alertId: string;
}

export async function sendPriceAlert(email: string, alert: PriceAlertData): Promise<EmailResult> {
  const priceClass = alert.condition === 'above' || alert.condition === 'percent_up' ? 'price-up' : 'price-down';
  const emoji = alert.condition === 'above' || alert.condition === 'percent_up' ? '📈' : '📉';
  const direction = alert.condition === 'above' || alert.condition === 'percent_up' ? 'above' : 'below';
  
  let conditionText = '';
  if (alert.condition === 'above' || alert.condition === 'below') {
    conditionText = `${alert.coinSymbol} is now ${direction} $${alert.targetPrice.toLocaleString()}`;
  } else {
    conditionText = `${alert.coinSymbol} has ${alert.changePercent! > 0 ? 'increased' : 'decreased'} by ${Math.abs(alert.changePercent!).toFixed(2)}%`;
  }

  const html = wrapTemplate(`
    <div class="alert-box">
      <h2>${emoji} Price Alert Triggered</h2>
      <p style="font-size: 18px; margin: 0;">${conditionText}</p>
    </div>
    
    <div style="text-align: center; padding: 20px 0;">
      <p style="font-size: 14px; color: #6b7280; margin: 0;">Current Price</p>
      <p class="${priceClass}" style="font-size: 36px; margin: 5px 0;">$${alert.currentPrice.toLocaleString()}</p>
      <p style="font-size: 14px; color: #6b7280; margin: 0;">${alert.coinName} (${alert.coinSymbol})</p>
    </div>
    
    <p style="text-align: center;">
      <a href="${APP_URL}${getCoinUrl(alert.coinSymbol)}" class="button">View ${alert.coinSymbol} Details</a>
    </p>
    
    <div class="divider"></div>
    <p class="muted" style="text-align: center;">
      <a href="${APP_URL}/settings/alerts">Manage Alerts</a> • 
      <a href="${APP_URL}/api/alerts/disable?id=${alert.alertId}">Disable This Alert</a>
    </p>
  `, `${emoji} ${alert.coinSymbol} Price Alert: $${alert.currentPrice.toLocaleString()}`);

  return sendEmail({
    to: email,
    subject: `${emoji} ${alert.coinSymbol} Price Alert: $${alert.currentPrice.toLocaleString()}`,
    html,
    text: `Price Alert: ${conditionText}\n\nCurrent price: $${alert.currentPrice.toLocaleString()}\n\nView details: ${APP_URL}${getCoinUrl(alert.coinSymbol)}`,
    tags: [
      { name: 'type', value: 'alert' },
      { name: 'coin', value: alert.coinSymbol },
      { name: 'alert_id', value: alert.alertId },
    ],
  });
}

// =============================================================================
// NEWS ALERT EMAILS
// =============================================================================

export interface NewsAlertData {
  keyword: string;
  articles: Array<{
    title: string;
    source: string;
    url: string;
    publishedAt: string;
  }>;
  alertId: string;
}

export async function sendNewsAlert(email: string, alert: NewsAlertData): Promise<EmailResult> {
  const articlesList = alert.articles.slice(0, 5).map(article => `
    <div style="padding: 15px 0; border-bottom: 1px solid #e5e7eb;">
      <p style="margin: 0 0 5px 0; font-weight: 600;">
        <a href="${article.url}" style="color: #3861FB; text-decoration: none;">${article.title}</a>
      </p>
      <p class="muted" style="margin: 0;">${article.source} • ${new Date(article.publishedAt).toLocaleDateString()}</p>
    </div>
  `).join('');

  const html = wrapTemplate(`
    <h2>📰 News Alert: "${alert.keyword}"</h2>
    <p>We found ${alert.articles.length} new article${alert.articles.length > 1 ? 's' : ''} matching your keyword.</p>
    
    ${articlesList}
    
    ${alert.articles.length > 5 ? `<p class="muted">...and ${alert.articles.length - 5} more articles</p>` : ''}
    
    <p style="text-align: center;">
      <a href="${APP_URL}/search?q=${encodeURIComponent(alert.keyword)}" class="button">View All Results</a>
    </p>
    
    <div class="divider"></div>
    <p class="muted" style="text-align: center;">
      <a href="${APP_URL}/settings/alerts">Manage Alerts</a>
    </p>
  `, `${alert.articles.length} new articles about "${alert.keyword}"`);

  return sendEmail({
    to: email,
    subject: `📰 ${alert.articles.length} new articles about "${alert.keyword}"`,
    html,
    text: `News Alert: "${alert.keyword}"\n\n${alert.articles.map(a => `${a.title}\n${a.url}`).join('\n\n')}`,
    tags: [
      { name: 'type', value: 'alert' },
      { name: 'alert_type', value: 'news' },
      { name: 'keyword', value: alert.keyword },
    ],
  });
}

// =============================================================================
// PORTFOLIO EMAILS
// =============================================================================

export interface PortfolioSummary {
  totalValue: number;
  change24h: number;
  changePercent24h: number;
  topGainers: Array<{ symbol: string; change: number }>;
  topLosers: Array<{ symbol: string; change: number }>;
  holdings: Array<{ symbol: string; value: number; change24h: number }>;
}

export async function sendPortfolioDigest(email: string, portfolio: PortfolioSummary): Promise<EmailResult> {
  const changeClass = portfolio.changePercent24h >= 0 ? 'price-up' : 'price-down';
  const changeEmoji = portfolio.changePercent24h >= 0 ? '📈' : '📉';
  const changeSign = portfolio.changePercent24h >= 0 ? '+' : '';

  const holdingRows = portfolio.holdings.slice(0, 10).map(h => {
    const hChangeClass = h.change24h >= 0 ? 'price-up' : 'price-down';
    const hSign = h.change24h >= 0 ? '+' : '';
    return `
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; font-weight: bold;">${h.symbol}</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">$${h.value.toLocaleString()}</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; text-align: right;" class="${hChangeClass}">${hSign}${h.change24h.toFixed(2)}%</td>
      </tr>
    `;
  }).join('');

  const html = wrapTemplate(`
    <h2>${changeEmoji} Your Daily Portfolio Update</h2>
    
    <div style="text-align: center; padding: 20px; background: #f9fafb; border-radius: 12px; margin: 20px 0;">
      <p class="muted" style="margin: 0;">Total Portfolio Value</p>
      <p style="font-size: 36px; font-weight: bold; margin: 5px 0;">$${portfolio.totalValue.toLocaleString()}</p>
      <p class="${changeClass}" style="font-size: 18px; margin: 0;">
        ${changeSign}$${Math.abs(portfolio.change24h).toLocaleString()} (${changeSign}${portfolio.changePercent24h.toFixed(2)}%) today
      </p>
    </div>
    
    <h3>Holdings</h3>
    <table style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr>
          <th style="text-align: left; padding: 10px 0; border-bottom: 2px solid #e5e7eb;">Asset</th>
          <th style="text-align: right; padding: 10px 0; border-bottom: 2px solid #e5e7eb;">Value</th>
          <th style="text-align: right; padding: 10px 0; border-bottom: 2px solid #e5e7eb;">24h</th>
        </tr>
      </thead>
      <tbody>
        ${holdingRows}
      </tbody>
    </table>
    
    <p style="text-align: center; margin-top: 30px;">
      <a href="${APP_URL}/portfolio" class="button">View Full Portfolio</a>
    </p>
  `, `Portfolio: $${portfolio.totalValue.toLocaleString()} (${changeSign}${portfolio.changePercent24h.toFixed(2)}%)`);

  return sendEmail({
    to: email,
    subject: `${changeEmoji} Portfolio Update: $${portfolio.totalValue.toLocaleString()} (${changeSign}${portfolio.changePercent24h.toFixed(2)}%)`,
    html,
    text: `Portfolio Update\n\nTotal Value: $${portfolio.totalValue.toLocaleString()}\nChange: ${changeSign}${portfolio.changePercent24h.toFixed(2)}%`,
    tags: [{ name: 'type', value: 'digest' }, { name: 'digest_type', value: 'portfolio' }],
  });
}

// =============================================================================
// WEEKLY MARKET DIGEST
// =============================================================================

export interface MarketDigest {
  marketCap: number;
  marketCapChange: number;
  btcDominance: number;
  fearGreedIndex: number;
  topMovers: Array<{ name: string; symbol: string; change: number }>;
  topNews: Array<{ title: string; source: string; url: string }>;
  weeklyHighlights: string[];
}

export async function sendWeeklyDigest(email: string, digest: MarketDigest): Promise<EmailResult> {
  const moversHtml = digest.topMovers.slice(0, 5).map(m => {
    const mClass = m.change >= 0 ? 'price-up' : 'price-down';
    const sign = m.change >= 0 ? '+' : '';
    return `<li><strong>${m.symbol}</strong>: <span class="${mClass}">${sign}${m.change.toFixed(2)}%</span></li>`;
  }).join('');

  const newsHtml = digest.topNews.slice(0, 5).map(n => `
    <li><a href="${n.url}" style="color: #3861FB;">${n.title}</a> <span class="muted">- ${n.source}</span></li>
  `).join('');

  const highlightsHtml = digest.weeklyHighlights.map(h => `<li>${h}</li>`).join('');

  const fearGreedColor = digest.fearGreedIndex >= 50 ? '#16C784' : '#EA3943';
  const fearGreedLabel = digest.fearGreedIndex >= 75 ? 'Extreme Greed' : 
                         digest.fearGreedIndex >= 50 ? 'Greed' :
                         digest.fearGreedIndex >= 25 ? 'Fear' : 'Extreme Fear';

  const html = wrapTemplate(`
    <h2>📊 Weekly Crypto Market Digest</h2>
    <p class="muted">Here's your weekly summary of the crypto market.</p>
    
    <div style="display: flex; flex-wrap: wrap; gap: 15px; margin: 20px 0;">
      <div style="flex: 1; min-width: 150px; background: #f9fafb; padding: 15px; border-radius: 8px; text-align: center;">
        <p class="muted" style="margin: 0; font-size: 12px;">Total Market Cap</p>
        <p style="font-size: 20px; font-weight: bold; margin: 5px 0;">$${(digest.marketCap / 1e12).toFixed(2)}T</p>
        <p class="${digest.marketCapChange >= 0 ? 'price-up' : 'price-down'}" style="margin: 0; font-size: 14px;">
          ${digest.marketCapChange >= 0 ? '+' : ''}${digest.marketCapChange.toFixed(2)}%
        </p>
      </div>
      <div style="flex: 1; min-width: 150px; background: #f9fafb; padding: 15px; border-radius: 8px; text-align: center;">
        <p class="muted" style="margin: 0; font-size: 12px;">BTC Dominance</p>
        <p style="font-size: 20px; font-weight: bold; margin: 5px 0;">${digest.btcDominance.toFixed(1)}%</p>
      </div>
      <div style="flex: 1; min-width: 150px; background: #f9fafb; padding: 15px; border-radius: 8px; text-align: center;">
        <p class="muted" style="margin: 0; font-size: 12px;">Fear & Greed</p>
        <p style="font-size: 20px; font-weight: bold; margin: 5px 0; color: ${fearGreedColor};">${digest.fearGreedIndex}</p>
        <p style="margin: 0; font-size: 12px;">${fearGreedLabel}</p>
      </div>
    </div>
    
    <h3>🚀 Top Movers This Week</h3>
    <ul>${moversHtml}</ul>
    
    <h3>📰 Top Stories</h3>
    <ul>${newsHtml}</ul>
    
    <h3>📝 Weekly Highlights</h3>
    <ul>${highlightsHtml}</ul>
    
    <p style="text-align: center; margin-top: 30px;">
      <a href="${APP_URL}" class="button">View Full Dashboard</a>
    </p>
  `, 'Your weekly crypto market summary is here!');

  return sendEmail({
    to: email,
    subject: `📊 Weekly Crypto Digest: Market ${digest.marketCapChange >= 0 ? 'Up' : 'Down'} ${Math.abs(digest.marketCapChange).toFixed(1)}%`,
    html,
    text: `Weekly Crypto Digest\n\nMarket Cap: $${(digest.marketCap / 1e12).toFixed(2)}T (${digest.marketCapChange >= 0 ? '+' : ''}${digest.marketCapChange.toFixed(2)}%)\nBTC Dominance: ${digest.btcDominance.toFixed(1)}%\nFear & Greed: ${digest.fearGreedIndex}`,
    tags: [{ name: 'type', value: 'digest' }, { name: 'digest_type', value: 'weekly' }],
  });
}

// =============================================================================
// EXCHANGE CONNECTION EMAILS
// =============================================================================

export async function sendExchangeConnectedEmail(
  email: string, 
  exchangeName: string,
  assetsImported: number
): Promise<EmailResult> {
  const html = wrapTemplate(`
    <h2>✅ ${exchangeName} Connected Successfully</h2>
    <p>Your ${exchangeName} account has been connected to ${APP_NAME}.</p>
    
    <div style="background: #d1fae5; border: 1px solid #10b981; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px; color: #065f46;">Assets Imported</p>
      <p style="margin: 5px 0; font-size: 36px; font-weight: bold; color: #065f46;">${assetsImported}</p>
    </div>
    
    <p>Your portfolio will now automatically sync with your ${exchangeName} holdings every hour.</p>
    
    <p style="text-align: center;">
      <a href="${APP_URL}/portfolio" class="button">View Portfolio</a>
    </p>
    
    <div class="divider"></div>
    <p class="muted">
      Your API credentials are encrypted and stored securely. We only have read access to your account data.
      <a href="${APP_URL}/settings/exchanges">Manage Connections</a>
    </p>
  `, `${exchangeName} connected - ${assetsImported} assets imported`);

  return sendEmail({
    to: email,
    subject: `✅ ${exchangeName} Connected - ${assetsImported} Assets Imported`,
    html,
    text: `${exchangeName} Connected Successfully\n\n${assetsImported} assets have been imported to your portfolio.`,
    tags: [{ name: 'type', value: 'exchange' }, { name: 'exchange', value: exchangeName.toLowerCase() }],
  });
}

export async function sendExchangeSyncErrorEmail(
  email: string,
  exchangeName: string,
  error: string
): Promise<EmailResult> {
  const html = wrapTemplate(`
    <h2>⚠️ ${exchangeName} Sync Issue</h2>
    <p>We encountered an issue syncing your ${exchangeName} account.</p>
    
    <div class="alert-box">
      <p style="margin: 0;"><strong>Error:</strong> ${error}</p>
    </div>
    
    <h3>Possible Solutions:</h3>
    <ul>
      <li>Check that your API keys are still valid</li>
      <li>Ensure the API has read permissions enabled</li>
      <li>Try disconnecting and reconnecting the exchange</li>
    </ul>
    
    <p style="text-align: center;">
      <a href="${APP_URL}/settings/exchanges" class="button">Check Connection</a>
    </p>
  `, `Issue syncing ${exchangeName}`);

  return sendEmail({
    to: email,
    subject: `⚠️ ${exchangeName} Sync Issue - Action Required`,
    html,
    text: `${exchangeName} Sync Issue\n\nError: ${error}\n\nPlease check your API keys at ${APP_URL}/settings/exchanges`,
    tags: [{ name: 'type', value: 'exchange' }, { name: 'exchange', value: exchangeName.toLowerCase() }, { name: 'status', value: 'error' }],
  });
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  sendEmail,
  sendBulkEmails,
  sendMagicLink,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendPriceAlert,
  sendNewsAlert,
  sendPortfolioDigest,
  sendWeeklyDigest,
  sendExchangeConnectedEmail,
  sendExchangeSyncErrorEmail,
};
