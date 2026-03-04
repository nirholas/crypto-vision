import { NextRequest, NextResponse } from 'next/server';
import * as storage from '@/lib/storage';

export const runtime = 'edge';

// Storage namespace
const NAMESPACE = 'push';
const SUBSCRIPTIONS_KEY = 'subscriptions'; // Hash: id -> subscription
const TOPIC_INDEX_PREFIX = 'topic:'; // Set: topic -> subscription IDs

interface PushSubscriptionData {
  id: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  topics: string[];
  createdAt: string;
  lastNotified?: string;
}

interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
}

// =============================================================================
// STORAGE HELPERS
// =============================================================================

async function getSubscription(id: string): Promise<PushSubscriptionData | null> {
  return storage.hget<PushSubscriptionData>(`${NAMESPACE}:${SUBSCRIPTIONS_KEY}`, id);
}

async function saveSubscription(sub: PushSubscriptionData): Promise<void> {
  // Save subscription data
  await storage.hset(`${NAMESPACE}:${SUBSCRIPTIONS_KEY}`, sub.id, sub);
  // Index by topics
  for (const topic of sub.topics) {
    await storage.sadd(`${NAMESPACE}:${TOPIC_INDEX_PREFIX}${topic}`, sub.id);
  }
}

async function deleteSubscription(sub: PushSubscriptionData): Promise<void> {
  // Remove from subscriptions hash
  await storage.hdel(`${NAMESPACE}:${SUBSCRIPTIONS_KEY}`, sub.id);
  // Remove from topic indexes
  for (const topic of sub.topics) {
    await storage.srem(`${NAMESPACE}:${TOPIC_INDEX_PREFIX}${topic}`, sub.id);
  }
}

async function updateSubscriptionTopics(sub: PushSubscriptionData, oldTopics: string[], newTopics: string[]): Promise<void> {
  // Remove from old topics
  for (const topic of oldTopics) {
    if (!newTopics.includes(topic)) {
      await storage.srem(`${NAMESPACE}:${TOPIC_INDEX_PREFIX}${topic}`, sub.id);
    }
  }
  // Add to new topics
  for (const topic of newTopics) {
    if (!oldTopics.includes(topic)) {
      await storage.sadd(`${NAMESPACE}:${TOPIC_INDEX_PREFIX}${topic}`, sub.id);
    }
  }
}

/**
 * GET /api/push - Get VAPID public key for Web Push subscription
 */
export async function GET() {
  // In production, generate these with web-push library:
  // const vapidKeys = webpush.generateVAPIDKeys();
  // Store private key securely, expose only public key
  
  const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'YOUR_VAPID_PUBLIC_KEY_HERE';
  
  return NextResponse.json({
    success: true,
    publicKey: VAPID_PUBLIC_KEY,
    instructions: {
      step1: 'Use this public key to subscribe to push notifications in your service worker',
      step2: 'POST the subscription object to /api/push to register',
      step3: 'You will receive notifications when news matching your topics is published',
      example: {
        serviceWorkerCode: `
// In your service worker
self.addEventListener('push', function(event) {
  const data = event.data.json();
  self.registration.showNotification(data.title, {
    body: data.body,
    icon: data.icon || '/icon.png',
    badge: data.badge || '/badge.png',
    data: { url: data.url }
  });
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  if (event.notification.data.url) {
    event.waitUntil(clients.openWindow(event.notification.data.url));
  }
});
        `.trim(),
        subscriptionCode: `
// In your main JS
async function subscribeToPush() {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
  });
  
  await fetch('https://free-crypto-news.vercel.app/api/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subscription: subscription,
      topics: ['bitcoin', 'ethereum', 'breaking']
    })
  });
}
        `.trim()
      }
    }
  });
}

/**
 * POST /api/push - Register a push subscription
 * 
 * Body:
 * {
 *   "subscription": { PushSubscription object from browser },
 *   "topics": ["bitcoin", "ethereum", "defi", "breaking"] // optional
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { subscription, topics = ['breaking'] } = body;
    
    if (!subscription || !subscription.endpoint) {
      return NextResponse.json({
        success: false,
        error: 'Invalid subscription',
        message: 'Missing subscription.endpoint'
      }, { status: 400 });
    }
    
    if (!subscription.keys?.p256dh || !subscription.keys?.auth) {
      return NextResponse.json({
        success: false,
        error: 'Invalid subscription',
        message: 'Missing subscription keys (p256dh, auth)'
      }, { status: 400 });
    }
    
    // Validate topics
    const validTopics = ['bitcoin', 'ethereum', 'defi', 'nft', 'regulation', 'exchange', 'altcoin', 'breaking', 'all'];
    const filteredTopics = topics.filter((t: string) => validTopics.includes(t.toLowerCase()));
    
    if (filteredTopics.length === 0) {
      filteredTopics.push('breaking');
    }
    
    // Create subscription ID from endpoint hash
    const subscriptionId = await hashEndpoint(subscription.endpoint);
    
    // Store subscription
    const subscriptionData: PushSubscriptionData = {
      id: subscriptionId,
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth
      },
      topics: filteredTopics,
      createdAt: new Date().toISOString()
    };
    
    await saveSubscription(subscriptionData);
    
    return NextResponse.json({
      success: true,
      message: 'Push subscription registered',
      subscriptionId,
      topics: filteredTopics,
      note: 'You will receive notifications for: ' + filteredTopics.join(', ')
    });
    
  } catch (error) {
    console.error('Push registration error:', error);
    return NextResponse.json({
      success: false,
      error: 'Registration failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * DELETE /api/push - Unsubscribe from push notifications
 * 
 * Body:
 * {
 *   "endpoint": "https://..." // The push subscription endpoint
 * }
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { endpoint } = body;
    
    if (!endpoint) {
      return NextResponse.json({
        success: false,
        error: 'Missing endpoint'
      }, { status: 400 });
    }
    
    const subscriptionId = await hashEndpoint(endpoint);
    const subscription = await getSubscription(subscriptionId);
    
    if (subscription) {
      await deleteSubscription(subscription);
      return NextResponse.json({
        success: true,
        message: 'Unsubscribed from push notifications'
      });
    }
    
    return NextResponse.json({
      success: false,
      error: 'Subscription not found'
    }, { status: 404 });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Unsubscribe failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * PATCH /api/push - Update subscription topics
 * 
 * Body:
 * {
 *   "endpoint": "https://...",
 *   "topics": ["bitcoin", "defi"]
 * }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { endpoint, topics } = body;
    
    if (!endpoint) {
      return NextResponse.json({
        success: false,
        error: 'Missing endpoint'
      }, { status: 400 });
    }
    
    const subscriptionId = await hashEndpoint(endpoint);
    const subscription = await getSubscription(subscriptionId);
    
    if (!subscription) {
      return NextResponse.json({
        success: false,
        error: 'Subscription not found'
      }, { status: 404 });
    }
    
    const validTopics = ['bitcoin', 'ethereum', 'defi', 'nft', 'regulation', 'exchange', 'altcoin', 'breaking', 'all'];
    const filteredTopics = (topics || []).filter((t: string) => validTopics.includes(t.toLowerCase()));
    
    const oldTopics = subscription.topics;
    const newTopics = filteredTopics.length > 0 ? filteredTopics : ['breaking'];
    
    subscription.topics = newTopics;
    await saveSubscription(subscription);
    await updateSubscriptionTopics(subscription, oldTopics, newTopics);
    
    return NextResponse.json({
      success: true,
      message: 'Topics updated',
      topics: subscription.topics
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Update failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Utility: Hash endpoint for ID
async function hashEndpoint(endpoint: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(endpoint);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}

// Helper for use by notification sender (e.g., cron job)
// Note: In production, move this to a separate utility file
async function getSubscriptionsForTopic(topic: string): Promise<PushSubscriptionData[]> {
  // Get subscription IDs for this topic and 'all'
  const topicIds = await storage.smembers(`${NAMESPACE}:${TOPIC_INDEX_PREFIX}${topic}`);
  const allIds = await storage.smembers(`${NAMESPACE}:${TOPIC_INDEX_PREFIX}all`);
  
  const uniqueIds = [...new Set([...topicIds, ...allIds])];
  const results: PushSubscriptionData[] = [];
  
  for (const id of uniqueIds) {
    const sub = await getSubscription(id);
    if (sub) {
      results.push(sub);
    }
  }
  
  return results;
}

// Example notification payload helper
function createNotificationPayload(article: {
  title: string;
  source: string;
  link: string;
}): PushNotificationPayload {
  return {
    title: `📰 ${article.source}`,
    body: article.title,
    icon: 'https://free-crypto-news.vercel.app/icon.png',
    badge: 'https://free-crypto-news.vercel.app/badge.png',
    url: article.link,
    tag: 'crypto-news'
  };
}

// Suppress unused variable warnings - these are utility functions for external use
void getSubscriptionsForTopic;
void createNotificationPayload;
