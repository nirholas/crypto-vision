'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import { WS_URL } from '@/lib/constants';
import { getSessionToken } from '@/lib/api-client';

interface SocketContextValue {
  isConnected: boolean;
  subscribe: <T>(event: string, handler: (data: T) => void) => () => void;
  emit: (event: string, data?: unknown) => void;
}

const SocketContext = createContext<SocketContextValue>({
  isConnected: false,
  subscribe: () => () => {},
  emit: () => {},
});

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const token = getSessionToken();
    if (!token) return;

    const socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      reconnectionAttempts: Infinity,
    });

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const subscribe = useCallback(<T,>(event: string, handler: (data: T) => void): (() => void) => {
    const socket = socketRef.current;
    if (!socket) return () => {};
    const wrappedHandler = (data: T) => handler(data);
    socket.on(event, wrappedHandler as (...args: unknown[]) => void);
    return () => {
      socket.off(event, wrappedHandler as (...args: unknown[]) => void);
    };
  }, []);

  const emit = useCallback((event: string, data?: unknown) => {
    socketRef.current?.emit(event, data);
  }, []);

  return (
    <SocketContext.Provider value={{ isConnected, subscribe, emit }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocketContext() {
  return useContext(SocketContext);
}
