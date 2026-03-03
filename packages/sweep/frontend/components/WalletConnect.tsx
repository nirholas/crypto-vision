"use client";

import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { useAccount, useConnect, useDisconnect } from "wagmi";

export function WalletConnect() {
  const { address, isConnected, chain } = useAccount();
  const { disconnect } = useDisconnect();
  const { connectors, connect, isPending } = useConnect();

  // Get the injected connector (MetaMask, etc.)
  const injectedConnector = connectors.find((c) => c.id === "injected");
  const coinbaseConnector = connectors.find((c) => c.id === "coinbaseWalletSDK");

  return (
    <div className="flex items-center gap-3">
      {/* Clerk Auth */}
      <SignedOut>
        <SignInButton mode="modal">
          <button className="px-4 py-2.5 bg-foreground text-background rounded-xl font-medium hover:opacity-90 transition-opacity">
            Sign In
          </button>
        </SignInButton>
      </SignedOut>
      
      <SignedIn>
        {/* Wallet Connection */}
        {isConnected && address ? (
          <div className="flex items-center gap-2">
            {chain && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-muted-foreground">{chain.name}</span>
              </div>
            )}
            <div className="flex items-center gap-3 px-4 py-2 border rounded-xl bg-card">
              <span className="w-2 h-2 rounded-full bg-green-500 sm:hidden" />
              <span className="font-mono text-sm">
                {address.slice(0, 6)}...{address.slice(-4)}
              </span>
              <button
                onClick={() => disconnect()}
                className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted"
                title="Disconnect wallet"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {injectedConnector && (
              <button
                onClick={() => connect({ connector: injectedConnector })}
                disabled={isPending}
                className="px-4 py-2.5 bg-foreground text-background rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-2 .9-2 2v4h1.5C4.88 11 6 12.12 6 13.5S4.88 16 3.5 16H2v4c0 1.1.9 2 2 2h4v-1.5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5V22h4c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11z"/>
                </svg>
                {isPending ? "..." : "Connect"}
              </button>
            )}
            {coinbaseConnector && !injectedConnector && (
              <button
                onClick={() => connect({ connector: coinbaseConnector })}
                disabled={isPending}
                className="px-4 py-2.5 border rounded-xl font-medium hover:bg-muted transition-colors disabled:opacity-50"
              >
                {isPending ? "..." : "Connect"}
              </button>
            )}
          </div>
        )}
        
        {/* Clerk User Button */}
        <UserButton 
          appearance={{
            elements: {
              avatarBox: "w-9 h-9",
            },
          }}
        />
      </SignedIn>
    </div>
  );
}

function getChainIcon(chainId: number): string {
  const icons: Record<number, string> = {
    1: "⟠",
    8453: "🔵",
    42161: "🔷",
    137: "🟣",
    56: "🟡",
    10: "🔴",
    59144: "◇",
  };
  return icons[chainId] || "🔗";
}
