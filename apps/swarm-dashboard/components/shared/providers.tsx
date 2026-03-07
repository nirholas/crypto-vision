'use client';

import React, { useMemo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { SOLANA_RPC_URL } from '@/lib/constants';
import { SocketProvider } from './socket-provider';

import '@solana/wallet-adapter-react-ui/styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 3000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    [],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ConnectionProvider endpoint={SOLANA_RPC_URL}>
        <WalletProvider wallets={wallets} autoConnect>
          <WalletModalProvider>
            <SocketProvider>{children}</SocketProvider>
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </QueryClientProvider>
  );
}
