'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Search, Home, TrendingUp, BarChart3, Wallet, ArrowLeft } from 'lucide-react';

const popularLinks = [
  { label: 'Market Overview', href: '/', icon: BarChart3 },
  { label: 'Trending Coins', href: '/trending', icon: TrendingUp },
  { label: 'Portfolio', href: '/portfolio', icon: Wallet },
  { label: 'Bitcoin', href: '/coin/bitcoin', icon: TrendingUp },
  { label: 'Ethereum', href: '/coin/ethereum', icon: TrendingUp },
];

export default function NotFound() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-16"
      style={{ background: 'var(--bg-primary)' }}
    >
      <div
        className={`max-w-lg w-full text-center space-y-8 transition-all duration-500 ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        {/* 404 Graphic */}
        <div className="relative">
          <div
            className="text-[8rem] sm:text-[10rem] font-extrabold leading-none select-none"
            style={{
              background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              opacity: 0.15,
            }}
          >
            404
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center"
              style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}
            >
              <Search className="w-8 h-8" style={{ color: 'var(--text-muted)' }} />
            </div>
          </div>
        </div>

        {/* Message */}
        <div className="space-y-3">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Page not found
          </h1>
          <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
            Try searching or browse one of the links below.
          </p>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="relative max-w-sm mx-auto">
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: 'var(--text-muted)' }}
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search coins, pages…"
            className="w-full pl-10 pr-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2"
            style={{
              background: 'var(--surface)',
              color: 'var(--text-primary)',
              border: '1px solid var(--surface-border)',
              // focus ring handled by global styles
            }}
            autoFocus
          />
        </form>

        {/* Popular Links */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
            Popular pages
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {popularLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
                  style={{
                    background: 'var(--surface)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--surface-border)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--surface-hover)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--surface)';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{link.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Back / Home buttons */}
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: 'var(--surface)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--surface-border)',
            }}
          >
            <ArrowLeft className="w-4 h-4" />
            Go back
          </button>
          <Link
            href="/"
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: 'var(--primary)',
              color: 'var(--bg-primary)',
            }}
          >
            <Home className="w-4 h-4" />
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
