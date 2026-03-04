'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, BellOff, X, ExternalLink } from 'lucide-react';

interface PushNotification {
  id: string;
  title: string;
  body: string;
  url?: string;
  timestamp: Date;
}

export function PushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<PushNotification[]>([]);

  useEffect(() => {
    // Check if notifications are supported
    setIsSupported('Notification' in window);
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }

    // Load notification history from localStorage
    const saved = localStorage.getItem('notification-history');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setNotifications(
          parsed.map((n: PushNotification) => ({
            ...n,
            timestamp: new Date(n.timestamp),
          }))
        );
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  const requestPermission = async () => {
    if (!isSupported) return;

    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === 'granted') {
        // Show a test notification
        new Notification('Notifications Enabled! 🎉', {
          body: 'You will now receive breaking crypto news alerts.',
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-72x72.png',
        });

        // Register for push if service worker is available
        if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.ready;
          console.log('Service Worker ready for push:', registration);
        }
      }
    } catch (error) {
      console.error('Failed to request notification permission:', error);
    }
  };

  const showNotification = (title: string, body: string, url?: string) => {
    if (permission !== 'granted') return;

    const notification = new Notification(title, {
      body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      tag: url || 'crypto-news',
      requireInteraction: false,
    });

    notification.onclick = () => {
      if (url) {
        window.open(url, '_blank');
      }
      notification.close();
    };

    // Save to history
    const newNotification: PushNotification = {
      id: Date.now().toString(),
      title,
      body,
      url,
      timestamp: new Date(),
    };

    setNotifications((prev) => {
      const updated = [newNotification, ...prev].slice(0, 50); // Keep last 50
      localStorage.setItem('notification-history', JSON.stringify(updated));
      return updated;
    });
  };

  const clearNotifications = () => {
    setNotifications([]);
    localStorage.removeItem('notification-history');
  };

  // Poll for breaking news and show push notifications
  useEffect(() => {
    if (permission !== 'granted') return;

    // Check for breaking news periodically
    const checkBreakingNews = async () => {
      try {
        const response = await fetch('/api/news?category=breaking&limit=1');
        const data = await response.json();

        if (data.articles && data.articles.length > 0) {
          const article = data.articles[0];
          const lastNotified = localStorage.getItem('last-notified-article');

          if (article.url !== lastNotified) {
            // New breaking article found
            // Auto-notifications are disabled by default to avoid spam
            // Uncomment below to enable automatic push notifications:
            // showNotification(
            //   '🚨 Breaking News',
            //   article.title,
            //   article.url
            // );
            localStorage.setItem('last-notified-article', article.url);
          }
        }
      } catch (error) {
        console.error('Failed to check breaking news:', error);
      }
    };

    const interval = setInterval(checkBreakingNews, 5 * 60 * 1000); // Every 5 minutes
    return () => clearInterval(interval);
  }, [permission]);

  if (!isSupported) {
    return null;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-text-secondary hover:text-amber-600 transition-colors"
        aria-label="Notifications"
      >
        {permission === 'granted' ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
        {notifications.length > 0 && permission === 'granted' && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            {notifications.length > 9 ? '9+' : notifications.length}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 bg-surface rounded-lg shadow-lg border border-surface-border z-50 overflow-hidden animate-fadeIn">
            <div className="p-4 border-b border-surface-border">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Notifications</h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-surface-hover rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {permission !== 'granted' ? (
              <div className="p-4 text-center">
                <BellOff className="w-12 h-12 mx-auto mb-3 text-text-muted" />
                <p className="text-sm text-text-secondary mb-3">
                  Get notified about breaking crypto news
                </p>
                <button
                  onClick={requestPermission}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium"
                >
                  Enable Notifications
                </button>
                {permission === 'denied' && (
                  <p className="mt-2 text-xs text-loss">
                    Notifications are blocked. Please enable them in your browser settings.
                  </p>
                )}
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-text-muted">
                <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No notifications yet</p>
              </div>
            ) : (
              <>
                <div>
                  {notifications.slice(0, 5).map((notification) => (
                    <div
                      key={notification.id}
                      className="p-3 border-b border-surface-border hover:bg-surface-hover"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{notification.title}</p>
                          <p className="text-xs text-text-secondary line-clamp-2">
                            {notification.body}
                          </p>
                          <p className="text-xs text-text-muted mt-1">
                            {notification.timestamp.toLocaleTimeString()}
                          </p>
                        </div>
                        {notification.url && (
                          <a
                            href={notification.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 text-text-muted hover:text-amber-500"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-2 border-t border-surface-border">
                  <button
                    onClick={clearNotifications}
                    className="w-full text-center text-sm text-text-muted hover:text-text-secondary py-1"
                  >
                    Clear all
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
