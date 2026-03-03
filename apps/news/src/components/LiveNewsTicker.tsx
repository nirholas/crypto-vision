'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from '@/i18n/navigation';

interface TickerItem {
  id: string;
  title: string;
  source: string;
  timestamp: string;
  isBreaking: boolean;
  articleSlug?: string;
}

export function LiveNewsTicker() {
  const [items, setItems] = useState<TickerItem[]>([]);
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const retryRef = useRef(1000);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      const es = new EventSource('/api/sse?breaking=true');
      eventSourceRef.current = es;

      es.onopen = () => {
        setConnected(true);
        retryRef.current = 1000;
      };

      es.addEventListener('news', (e) => {
        try {
          const data = JSON.parse(e.data);
          const item: TickerItem = {
            id: data.id || `news-${Date.now()}-${Math.random()}`,
            title: data.title || '',
            source: data.source || '',
            timestamp: data.publishedAt || data.timestamp || new Date().toISOString(),
            isBreaking: false,
            articleSlug: data.slug || data.articleSlug,
          };
          if (item.title) {
            setItems(prev => [item, ...prev].slice(0, 20));
          }
        } catch { /* ignore parse errors */ }
      });

      es.addEventListener('breaking', (e) => {
        try {
          const data = JSON.parse(e.data);
          const item: TickerItem = {
            id: data.id || `breaking-${Date.now()}-${Math.random()}`,
            title: data.title || '',
            source: data.source || '',
            timestamp: data.publishedAt || data.timestamp || new Date().toISOString(),
            isBreaking: true,
            articleSlug: data.slug || data.articleSlug,
          };
          if (item.title) {
            setItems(prev => [item, ...prev].slice(0, 20));
          }
        } catch { /* ignore parse errors */ }
      });

      // Also handle generic message events
      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === 'heartbeat' || data.type === 'ping') return;
          const item: TickerItem = {
            id: data.id || `msg-${Date.now()}-${Math.random()}`,
            title: data.title || '',
            source: data.source || '',
            timestamp: data.publishedAt || data.timestamp || new Date().toISOString(),
            isBreaking: data.isBreaking || data.breaking || false,
            articleSlug: data.slug || data.articleSlug,
          };
          if (item.title) {
            setItems(prev => [item, ...prev].slice(0, 20));
          }
        } catch { /* ignore */ }
      };

      es.onerror = () => {
        setConnected(false);
        es.close();
        // Exponential backoff: 1s, 2s, 4s, 8s, ... max 30s
        const delay = Math.min(retryRef.current, 30000);
        retryTimerRef.current = setTimeout(() => {
          retryRef.current = Math.min(retryRef.current * 2, 30000);
          connect();
        }, delay);
      };
    } catch {
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      eventSourceRef.current?.close();
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [connect]);

  // Format relative time
  const timeAgo = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h`;
  };

  return (
    <div className="bg-gray-900 dark:bg-black text-white h-9 overflow-hidden relative flex items-center">
      {/* Connection indicator */}
      <div className="flex items-center gap-1.5 px-3 flex-shrink-0 border-r border-gray-700 h-full">
        <span className={`h-2 w-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
          {connected ? 'Live' : 'Offline'}
        </span>
      </div>

      {/* Ticker content */}
      <div className="flex-1 overflow-hidden">
        {items.length > 0 ? (
          <div className="animate-marquee flex items-center gap-8 whitespace-nowrap">
            {items.map((item) => {
              const inner = (
                <span className="inline-flex items-center gap-2 text-sm">
                  {item.isBreaking && (
                    <span className="px-1.5 py-0.5 bg-red-600 text-white text-[10px] font-bold uppercase rounded animate-pulse">
                      BREAKING
                    </span>
                  )}
                  <span className="text-gray-400 text-xs font-medium">{item.source}</span>
                  <span className="text-gray-600">•</span>
                  <span className="text-gray-200 font-medium">
                    {item.title.length > 80 ? item.title.slice(0, 80) + '…' : item.title}
                  </span>
                  <span className="text-gray-500 text-xs">{timeAgo(item.timestamp)}</span>
                </span>
              );

              return item.articleSlug ? (
                <Link key={item.id} href={`/article/${item.articleSlug}`} className="hover:text-amber-400 transition-colors">
                  {inner}
                </Link>
              ) : (
                <span key={item.id}>{inner}</span>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 text-sm text-gray-500">
            <span className="animate-pulse">●</span>
            <span>Waiting for live news...</span>
          </div>
        )}
      </div>

      {/* CSS for marquee animation */}
      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 60s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}
