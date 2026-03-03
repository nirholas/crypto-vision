"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount } from "wagmi";
import { WalletConnect } from "./WalletConnect";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/consolidate", label: "Consolidate" },
  { href: "/defi", label: "DeFi" },
  { href: "/subscriptions", label: "Auto-Sweep" },
  { href: "/history", label: "History" },
];

export function Header() {
  const pathname = usePathname();
  const { chain, isConnected } = useAccount();

  return (
    <header className="sticky top-0 z-50 w-full border-b glass">
      <div className="container mx-auto px-4 flex h-16 items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-foreground flex items-center justify-center">
            <span className="text-background text-lg font-bold">S</span>
          </div>
          <span className="text-xl font-semibold tracking-tight hidden sm:inline">
            Sweep
          </span>
        </Link>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                pathname === item.href
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* Network indicator */}
          {isConnected && chain && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse-subtle" />
              <span className="text-muted-foreground">{chain.name}</span>
            </div>
          )}
          
          <WalletConnect />

          {/* Mobile menu button */}
          <button className="md:hidden p-2 rounded-lg hover:bg-muted">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile navigation */}
      <nav className="md:hidden border-t">
        <div className="container mx-auto px-4 py-2 flex gap-2 overflow-x-auto hide-scrollbar">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                pathname === item.href
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
