'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { createSession, getSession, clearSessionToken, getSessionToken } from '@/lib/api-client';

export function useAuth() {
  const { publicKey, connected, disconnect: walletDisconnect } = useWallet();
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = getSessionToken();
    if (token) {
      setSessionToken(token);
      getSession()
        .catch(() => {
          clearSessionToken();
          setSessionToken(null);
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (connected && publicKey && !sessionToken) {
      setIsLoading(true);
      createSession(publicKey.toBase58())
        .then((res) => setSessionToken(res.token))
        .catch(console.error)
        .finally(() => setIsLoading(false));
    }
  }, [connected, publicKey, sessionToken]);

  const disconnect = useCallback(() => {
    clearSessionToken();
    setSessionToken(null);
    walletDisconnect();
  }, [walletDisconnect]);

  return {
    isConnected: connected && !!sessionToken,
    walletAddress: publicKey?.toBase58() ?? null,
    sessionToken,
    disconnect,
    isLoading,
  };
}
