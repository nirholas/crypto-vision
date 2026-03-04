# Progressive Web App (PWA) Guide

Documentation for PWA features in Crypto Data Aggregator.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Service Worker](#service-worker)
- [Offline Support](#offline-support)
- [Push Notifications](#push-notifications)
- [Configuration](#configuration)
- [Development](#development)

---

## Overview

Crypto Data Aggregator is a fully-featured Progressive Web App that provides:

- **Installable** - Add to home screen on any device
- **Offline-capable** - Browse cached content without internet
- **Push notifications** - Real-time price alerts
- **Background sync** - Queue actions when offline
- **Fast loading** - Aggressive caching strategies

---

## Features

| Feature            | Status | Description             |
| ------------------ | ------ | ----------------------- |
| Install Prompt     | ✅     | Custom install button   |
| Offline Mode       | ✅     | Browse cached content   |
| Push Notifications | ✅     | Price & keyword alerts  |
| Background Sync    | ✅     | Queue offline actions   |
| Periodic Sync      | ✅     | Background data refresh |
| Share Target       | ✅     | Share articles to app   |
| App Shortcuts      | ✅     | Quick actions from icon |

---

## Installation

### Mobile (iOS/Android)

1. Open the app in Safari (iOS) or Chrome (Android)
2. Tap the share button
3. Select "Add to Home Screen"
4. Confirm installation

### Desktop (Chrome/Edge)

1. Open the app in Chrome or Edge
2. Click the install icon in the address bar
3. Or click the "Install App" button in the header

### Programmatic Install

```tsx
import { usePWA } from '@/components/PWAProvider';

function InstallButton() {
  const { isInstallable, installPrompt } = usePWA();

  if (!isInstallable) return null;

  return <button onClick={installPrompt}>Install App</button>;
}
```

---

## Service Worker

### Location

```
public/sw.js
```

### Registration

The service worker is registered in `PWAProvider.tsx`:

```tsx
useEffect(() => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      setRegistration(registration);
      setIsServiceWorkerReady(true);
    });
  }
}, []);
```

### Caching Strategies

| Route Pattern     | Strategy               | TTL     |
| ----------------- | ---------------------- | ------- |
| `/api/market/*`   | Stale-While-Revalidate | 60s     |
| `/api/news/*`     | Network First          | 5min    |
| `/api/trending/*` | Stale-While-Revalidate | 2min    |
| Static assets     | Cache First            | 30 days |
| Images            | Cache First            | 7 days  |
| HTML pages        | Network First          | -       |

### Cache Structure

```javascript
const CACHES = {
  static: 'static-v1', // JS, CSS, fonts
  images: 'images-v1', // Coin logos, article images
  api: 'api-v1', // API responses
  pages: 'pages-v1', // HTML pages
};
```

---

## Offline Support

### Checking Online Status

```tsx
import { usePWA } from '@/components/PWAProvider';

function NetworkStatus() {
  const { isOnline } = usePWA();

  if (!isOnline) {
    return <OfflineBanner />;
  }

  return null;
}
```

### Offline Indicator Component

```tsx
import { OfflineIndicator } from '@/components/OfflineIndicator';

// Shows automatically when offline
<OfflineIndicator />;
```

### Offline Fallback Page

When offline and page isn't cached, shows `/offline.html`:

```html
<!-- public/offline.html -->
<!DOCTYPE html>
<html>
  <head>
    <title>Offline - Crypto Data Aggregator</title>
  </head>
  <body>
    <h1>You're Offline</h1>
    <p>Check your connection and try again.</p>
    <button onclick="location.reload()">Retry</button>
  </body>
</html>
```

### Queuing Offline Actions

```tsx
import { usePWA } from '@/components/PWAProvider';

function OfflineAction() {
  const { isOnline, requestBackgroundSync } = usePWA();

  const handleAction = async () => {
    if (!isOnline) {
      // Queue for later
      await requestBackgroundSync('sync-watchlist');
      toast.info("Action queued for when you're back online");
      return;
    }

    // Perform action immediately
    await performAction();
  };

  return <button onClick={handleAction}>Add to Watchlist</button>;
}
```

---

## Push Notifications

### Requesting Permission

```tsx
import { usePWA } from '@/components/PWAProvider';

function NotificationSettings() {
  const { isPushSupported, isPushEnabled, requestPushPermission } = usePWA();

  if (!isPushSupported) {
    return <p>Push notifications not supported</p>;
  }

  return (
    <button onClick={requestPushPermission} disabled={isPushEnabled}>
      {isPushEnabled ? 'Notifications Enabled' : 'Enable Notifications'}
    </button>
  );
}
```

### Notification Types

| Type             | Trigger            | Priority |
| ---------------- | ------------------ | -------- |
| Price Alert      | Threshold reached  | High     |
| Keyword Alert    | Keyword mentioned  | Normal   |
| Breaking News    | Urgent market news | High     |
| Portfolio Update | Daily summary      | Low      |

### Notification Payload

```typescript
interface PushPayload {
  type: 'price' | 'keyword' | 'news' | 'portfolio';
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: {
    url?: string;
    coinId?: string;
    alertId?: string;
  };
  actions?: Array<{
    action: string;
    title: string;
  }>;
}
```

### Handling Notification Clicks

In `sw.js`:

```javascript
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const { action, data } = event.notification;

  if (action === 'view-coin') {
    clients.openWindow(`/coin/${data.coinId}`);
  } else if (action === 'dismiss') {
    // Just close
  } else {
    // Default: open app
    clients.openWindow(data?.url || '/');
  }
});
```

---

## Configuration

### Web App Manifest

```json
// public/manifest.json
{
  "name": "Crypto Data Aggregator",
  "short_name": "Crypto Data",
  "description": "Real-time cryptocurrency market data",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#000000",
  "theme_color": "#3b82f6",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ],
  "shortcuts": [
    {
      "name": "Trending",
      "url": "/trending",
      "icons": [{ "src": "/icons/trending.png", "sizes": "96x96" }]
    },
    {
      "name": "Portfolio",
      "url": "/portfolio",
      "icons": [{ "src": "/icons/portfolio.png", "sizes": "96x96" }]
    },
    {
      "name": "Watchlist",
      "url": "/watchlist",
      "icons": [{ "src": "/icons/watchlist.png", "sizes": "96x96" }]
    }
  ],
  "share_target": {
    "action": "/share",
    "method": "POST",
    "enctype": "multipart/form-data",
    "params": {
      "title": "title",
      "text": "text",
      "url": "url"
    }
  }
}
```

### App Icons

Required icon sizes:

| Size    | Purpose             |
| ------- | ------------------- |
| 72x72   | Android legacy      |
| 96x96   | Android legacy      |
| 128x128 | Chrome Web Store    |
| 144x144 | Android legacy      |
| 152x152 | iOS                 |
| 192x192 | Android home screen |
| 384x384 | Android splash      |
| 512x512 | Android splash, PWA |

### iOS Meta Tags

```html
<!-- In layout.tsx -->
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="Crypto Data" />
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
```

---

## Development

### Testing Service Worker

```bash
# Build production version
npm run build

# Serve with HTTPS (required for SW)
npx serve out -s -l 3000
```

### Debugging

1. Open Chrome DevTools → Application
2. Check "Service Workers" section
3. Use "Update on reload" during development
4. Check "Cache Storage" for cached assets

### Simulating Offline

1. DevTools → Network tab
2. Select "Offline" from throttling dropdown
3. Or use: DevTools → Application → Service Workers → Offline

### Clear All PWA Data

```tsx
import { usePWA } from '@/components/PWAProvider';

const { clearCache } = usePWA();

// Clear all caches
await clearCache();
```

### Update Flow

When a new service worker is available:

```tsx
import { usePWA } from '@/components/PWAProvider';
import { UpdatePrompt } from '@/components/UpdatePrompt';

function App() {
  const { isUpdateAvailable, updateServiceWorker } = usePWA();

  return (
    <>
      {isUpdateAvailable && <UpdatePrompt onUpdate={updateServiceWorker} />}
      <MainContent />
    </>
  );
}
```

---

## Lighthouse PWA Audit

Run Lighthouse to verify PWA compliance:

```bash
npx lighthouse https://your-app.com --only-categories=pwa
```

### PWA Checklist

- [x] HTTPS enabled
- [x] Service worker registered
- [x] Web app manifest
- [x] Icons (192x192, 512x512)
- [x] Start URL
- [x] Theme color
- [x] Viewport meta tag
- [x] Offline fallback
- [x] Install prompt

---

## Related Documentation

- [Architecture](./ARCHITECTURE.md)
- [Deployment](./DEPLOYMENT.md)
- [Web App Manifest Spec](https://developer.mozilla.org/en-US/docs/Web/Manifest)
