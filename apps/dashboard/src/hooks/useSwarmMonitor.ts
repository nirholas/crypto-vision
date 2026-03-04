import { useEffect, useState, useCallback, useRef } from 'react';

interface SwarmMetrics {
  budget: number;
  spent: number;
  pnl: number;
  roi: number;
  trades: number;
  agents: number;
  phase: string;
  elapsed: string;
}

interface SwarmEvent {
  id: string;
  timestamp: number;
  type: string;
  narration: string;
  metrics?: SwarmMetrics;
}

interface SwarmMessage {
  type: 'narration' | 'metrics' | 'event' | 'status' | 'error';
  data: any;
}

/**
 * Hook for real-time swarm monitoring
 * Connects to the swarm event stream via EventSource or WebSocket
 */
export function useSwarmMonitor() {
  const [isConnected, setIsConnected] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [currentNarration, setCurrentNarration] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<SwarmMetrics | null>(null);
  const [events, setEvents] = useState<SwarmEvent[]>([]);

  const eventSourceRef = useRef<EventSource | null>(null);
  const eventIdRef = useRef(0);

  const addEvent = useCallback((type: string, narration: string, eventMetrics?: SwarmMetrics) => {
    const newEvent: SwarmEvent = {
      id: `event-${++eventIdRef.current}`,
      timestamp: Date.now(),
      type,
      narration,
      metrics: eventMetrics,
    };

    setEvents(prev => [...prev, newEvent].slice(-50)); // Keep last 50 events
  }, []);

  useEffect(() => {
    // Try to connect to the swarm event stream
    const connectToSwarmStream = () => {
      try {
        // Check if EventSource is available
        if (typeof EventSource === 'undefined') {
          console.warn('EventSource not available, using polling fallback');
          setupPollingFallback();
          return;
        }

        // Connect to swarm events endpoint
        const eventSource = new EventSource('/api/swarm/events');

        eventSource.addEventListener('narration', (event) => {
          const data = JSON.parse(event.data);
          setCurrentNarration(data.text);
          addEvent('narration', data.text, data.metrics);
        });

        eventSource.addEventListener('metrics', (event) => {
          const data = JSON.parse(event.data);
          setMetrics(data);
        });

        eventSource.addEventListener('event', (event) => {
          const data = JSON.parse(event.data);
          addEvent(data.type, data.narration, data.metrics);
        });

        eventSource.addEventListener('status', (event) => {
          const data = JSON.parse(event.data);
          setIsRunning(data.isRunning);
        });

        eventSource.addEventListener('open', () => {
          setIsConnected(true);
        });

        eventSource.onerror = () => {
          setIsConnected(false);
          eventSource.close();
          eventSourceRef.current = null;

          // Retry connection after 3 seconds
          setTimeout(connectToSwarmStream, 3000);
        };

        eventSourceRef.current = eventSource;
        setIsConnected(true);
      } catch (error) {
        console.error('Failed to connect to swarm stream:', error);
        setupPollingFallback();
      }
    };

    const setupPollingFallback = () => {
      // Fallback: poll for updates every 1 second
      const interval = setInterval(async () => {
        try {
          const response = await fetch('/api/swarm/status');
          if (!response.ok) throw new Error('Failed to fetch status');

          const data = await response.json();
          setIsConnected(true);
          setIsRunning(data.isRunning);
          setMetrics(data.metrics);

          if (data.lastNarration) {
            setCurrentNarration(data.lastNarration);
          }

          if (data.lastEvent) {
            addEvent(data.lastEvent.type, data.lastEvent.narration, data.lastEvent.metrics);
          }
        } catch (error) {
          setIsConnected(false);
        }
      }, 1000);

      return () => clearInterval(interval);
    };

    connectToSwarmStream();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [addEvent]);

  return {
    isConnected,
    isRunning,
    currentNarration,
    metrics,
    events,
    addEvent,
  };
}
