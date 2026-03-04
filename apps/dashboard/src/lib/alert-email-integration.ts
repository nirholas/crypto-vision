/**
 * Alert Email Integration
 * 
 * Integrates email notifications with the existing alert system.
 * Sends emails for price alerts, keyword alerts, and advanced rule triggers.
 */

import { 
  sendPriceAlert, 
  sendNewsAlert,
  type PriceAlertData,
  type NewsAlertData,
} from '@/lib/email';
import type { AlertNotification, PriceAlert, KeywordAlert } from '@/lib/alerts';
import type { AlertEvent, AlertRule } from '@/lib/alert-rules';

// Types for user email lookup
interface UserEmailLookup {
  getUserEmail: (userId: string) => Promise<string | null>;
}

// Default implementation (replace with actual user lookup in production)
const defaultEmailLookup: UserEmailLookup = {
  getUserEmail: async (userId: string) => {
    // In production, this would query the database for user email
    // For now, check if userId looks like an email
    if (userId.includes('@')) {
      return userId;
    }
    return null;
  },
};

/**
 * Send email notification for a price alert
 */
export async function sendPriceAlertEmail(
  alert: PriceAlert,
  notification: AlertNotification,
  emailLookup: UserEmailLookup = defaultEmailLookup
): Promise<boolean> {
  // Check if email notification is enabled for this alert
  if (!alert.notifyVia.includes('email')) {
    return false;
  }

  // Get user email
  const email = await emailLookup.getUserEmail(alert.userId);
  if (!email) {
    console.warn(`No email found for user ${alert.userId}`);
    return false;
  }

  const data = notification.data as {
    coin: string;
    symbol: string;
    price: number;
    change24h: number;
    condition: string;
    threshold: number;
  };

  // Map condition to email format
  const condition = mapConditionForEmail(data.condition, data.change24h);

  const alertData: PriceAlertData = {
    coinName: data.coin,
    coinSymbol: data.symbol.toUpperCase(),
    currentPrice: data.price,
    targetPrice: data.threshold,
    condition,
    changePercent: data.change24h,
    alertId: alert.id,
  };

  try {
    const result = await sendPriceAlert(email, alertData);
    return result.success;
  } catch (error) {
    console.error('Failed to send price alert email:', error);
    return false;
  }
}

/**
 * Map alert condition to email format
 */
function mapConditionForEmail(
  condition: string,
  change?: number
): 'above' | 'below' | 'percent_up' | 'percent_down' {
  switch (condition) {
    case 'above':
      return 'above';
    case 'below':
      return 'below';
    case 'percent_up':
      return 'percent_up';
    case 'percent_down':
      return 'percent_down';
    default:
      // Infer from change if available
      if (typeof change === 'number') {
        return change >= 0 ? 'percent_up' : 'percent_down';
      }
      return 'above';
  }
}

/**
 * Send email notification for a keyword alert
 */
export async function sendKeywordAlertEmail(
  alert: KeywordAlert,
  notification: AlertNotification,
  emailLookup: UserEmailLookup = defaultEmailLookup
): Promise<boolean> {
  // Check if email notification is enabled for this alert
  if (!alert.notifyVia.includes('email')) {
    return false;
  }

  // Get user email
  const email = await emailLookup.getUserEmail(alert.userId);
  if (!email) {
    console.warn(`No email found for user ${alert.userId}`);
    return false;
  }

  const data = notification.data as {
    keywords: string[];
    article: {
      title: string;
      link: string;
      source: string;
    };
  };

  const alertData: NewsAlertData = {
    keyword: data.keywords.join(', '),
    articles: [{
      title: data.article.title,
      url: data.article.link,
      source: data.article.source,
      publishedAt: new Date().toISOString(),
    }],
    alertId: alert.id,
  };

  try {
    const result = await sendNewsAlert(email, alertData);
    return result.success;
  } catch (error) {
    console.error('Failed to send keyword alert email:', error);
    return false;
  }
}

/**
 * Send email notification for an advanced alert rule event
 * Note: AlertRule.channels doesn't include 'email' by default.
 * This function can be called directly when email notification is needed.
 */
export async function sendAlertEventEmail(
  rule: AlertRule,
  event: AlertEvent,
  userEmail: string
): Promise<boolean> {
  // Route to appropriate email based on rule type
  try {
    const conditionType = rule.condition.type;
    
    if (isPriceCondition(conditionType)) {
      // Extract price data from event
      const context = event.data.context as Record<string, unknown> | undefined;
      
      const alertData: PriceAlertData = {
        coinName: (context?.coinId as string) || rule.name,
        coinSymbol: (context?.symbol as string) || 'CRYPTO',
        currentPrice: typeof event.data.currentValue === 'number' ? event.data.currentValue : 0,
        targetPrice: typeof event.data.threshold === 'number' ? event.data.threshold : 0,
        condition: mapRuleConditionToEmail(conditionType),
        changePercent: context?.change as number | undefined,
        alertId: event.id,
      };

      const result = await sendPriceAlert(userEmail, alertData);
      return result.success;
    } 

    if (isNewsCondition(conditionType)) {
      // Extract news data from event
      const context = event.data.context as Record<string, unknown> | undefined;
      const articles = (context?.articles as Array<{ title: string; url?: string; source?: string }>) || [];

      if (articles.length === 0) {
        // Fallback to basic notification
        const alertData: PriceAlertData = {
          coinName: rule.name,
          coinSymbol: 'NEWS',
          currentPrice: 0,
          targetPrice: 0,
          condition: 'above',
          alertId: event.id,
        };
        const result = await sendPriceAlert(userEmail, alertData);
        return result.success;
      }

      const alertData: NewsAlertData = {
        keyword: (context?.keywords as string[])?.join(', ') || rule.name,
        articles: articles.map(a => ({
          title: a.title,
          url: a.url || '#',
          source: a.source || 'Unknown',
          publishedAt: new Date().toISOString(),
        })),
        alertId: event.id,
      };

      const result = await sendNewsAlert(userEmail, alertData);
      return result.success;
    }

    // Default: use price alert template for generic alerts
    const alertData: PriceAlertData = {
      coinName: rule.name,
      coinSymbol: 'ALERT',
      currentPrice: typeof event.data.currentValue === 'number' ? event.data.currentValue : 0,
      targetPrice: typeof event.data.threshold === 'number' ? event.data.threshold : 0,
      condition: 'above',
      alertId: event.id,
    };

    const result = await sendPriceAlert(userEmail, alertData);
    return result.success;
  } catch (error) {
    console.error('Failed to send alert event email:', error);
    return false;
  }
}

/**
 * Check if condition type is price-related
 */
function isPriceCondition(type: string): boolean {
  return ['price_above', 'price_below', 'price_change_pct', 'volume_spike', 'whale_movement'].includes(type);
}

/**
 * Check if condition type is news-related
 */
function isNewsCondition(type: string): boolean {
  return ['breaking_news', 'ticker_mention'].includes(type);
}

/**
 * Map rule condition type to email condition format
 */
function mapRuleConditionToEmail(
  type: string
): 'above' | 'below' | 'percent_up' | 'percent_down' {
  switch (type) {
    case 'price_above':
      return 'above';
    case 'price_below':
      return 'below';
    case 'price_change_pct':
      return 'percent_up';
    default:
      return 'above';
  }
}

/**
 * Process all pending email notifications for a batch of alerts
 */
export async function processAlertEmailNotifications(
  notifications: Array<{
    type: 'price' | 'keyword' | 'rule';
    alert?: PriceAlert | KeywordAlert;
    rule?: AlertRule;
    notification?: AlertNotification;
    event?: AlertEvent;
    userEmail?: string;
  }>,
  emailLookup: UserEmailLookup = defaultEmailLookup
): Promise<{ sent: number; failed: number; skipped: number }> {
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const item of notifications) {
    try {
      switch (item.type) {
        case 'price':
          if (item.alert && item.notification && 'coin' in item.alert) {
            const success = await sendPriceAlertEmail(
              item.alert as PriceAlert,
              item.notification,
              emailLookup
            );
            if (success) sent++;
            else skipped++;
          } else {
            skipped++;
          }
          break;

        case 'keyword':
          if (item.alert && item.notification && 'keywords' in item.alert) {
            const success = await sendKeywordAlertEmail(
              item.alert as KeywordAlert,
              item.notification,
              emailLookup
            );
            if (success) sent++;
            else skipped++;
          } else {
            skipped++;
          }
          break;

        case 'rule':
          if (item.rule && item.event && item.userEmail) {
            const success = await sendAlertEventEmail(
              item.rule,
              item.event,
              item.userEmail
            );
            if (success) sent++;
            else failed++;
          } else {
            skipped++;
          }
          break;

        default:
          skipped++;
      }
    } catch (error) {
      console.error('Error processing notification:', error);
      failed++;
    }
  }

  return { sent, failed, skipped };
}

/**
 * Create a scheduled digest email with alert summaries
 */
export async function sendAlertDigestEmail(
  userEmail: string,
  summary: {
    priceAlerts: Array<{ coin: string; condition: string; triggeredAt: string }>;
    newsAlerts: Array<{ keyword: string; articleCount: number; triggeredAt: string }>;
    period: 'daily' | 'weekly';
  }
): Promise<boolean> {
  // For digest emails, we use the news alert template with a summary
  const alertData: NewsAlertData = {
    keyword: `${summary.period === 'daily' ? 'Daily' : 'Weekly'} Alert Summary`,
    articles: [
      ...summary.priceAlerts.map(a => ({
        title: `Price Alert: ${a.coin} - ${a.condition}`,
        url: '#',
        source: 'Price Alerts',
        publishedAt: a.triggeredAt,
      })),
      ...summary.newsAlerts.map(a => ({
        title: `News Alert: "${a.keyword}" - ${a.articleCount} articles`,
        url: '#',
        source: 'News Alerts',
        publishedAt: a.triggeredAt,
      })),
    ],
    alertId: `digest_${Date.now()}`,
  };

  try {
    const result = await sendNewsAlert(userEmail, alertData);
    return result.success;
  } catch (error) {
    console.error('Failed to send alert digest email:', error);
    return false;
  }
}
