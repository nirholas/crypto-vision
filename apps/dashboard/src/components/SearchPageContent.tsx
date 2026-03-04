'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface Article {
  title: string;
  link: string;
  description?: string;
  pubDate: string;
  source: string;
  timeAgo: string;
}

const sourceColors: Record<string, string> = {
  'CoinDesk': 'bg-blue-100 text-blue-800',
  'The Block': 'bg-purple-100 text-purple-800',
  'Decrypt': 'bg-green-100 text-green-800',
  'CoinTelegraph': 'bg-orange-100 text-orange-800',
  'Bitcoin Magazine': 'bg-yellow-100 text-yellow-800',
  'Blockworks': 'bg-indigo-100 text-indigo-800',
  'The Defiant': 'bg-pink-100 text-pink-800',
};

const popularSearches = [
  'Bitcoin ETF',
  'Ethereum upgrade',
  'DeFi hack',
  'SEC regulation',
  'NFT marketplace',
  'Solana',
  'Layer 2',
  'Stablecoin',
];

export function SearchPageContent() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const handleSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    
    setIsLoading(true);
    setHasSearched(true);
    
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}&limit=30`);
      const data = await res.json();
      setResults(data.articles || []);
      setTotalCount(data.totalCount || 0);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(query);
  };

  const handleQuickSearch = (term: string) => {
    setQuery(term);
    handleSearch(term);
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Search Form */}
      <form onSubmit={handleSubmit} className="mb-8">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for crypto news..."
            className="w-full px-6 py-4 pr-14 text-lg border-2 border-surface-border rounded-full focus:outline-none focus:border-primary transition"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-3 bg-background text-text-primary rounded-full hover:bg-surface-hover transition disabled:opacity-50"
          >
            {isLoading ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
          </button>
        </div>
      </form>

      {/* Popular Searches */}
      {!hasSearched && (
        <div className="mb-8">
          <p className="text-sm text-text-muted mb-3">Popular searches:</p>
          <div className="flex flex-wrap gap-2">
            {popularSearches.map((term) => (
              <button
                key={term}
                onClick={() => handleQuickSearch(term)}
                className="px-4 py-2 bg-surface border border-surface-border rounded-full text-sm hover:bg-surface-hover transition"
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {hasSearched && (
        <div>
          {/* Results Count */}
          <div className="mb-4 text-text-secondary">
            {isLoading ? (
              <span>Searching...</span>
            ) : (
              <span>Found {totalCount} results for &quot;{query}&quot;</span>
            )}
          </div>

          {/* Results List */}
          {results.length > 0 ? (
            <div className="space-y-4">
              {results.map((article, i) => (
                <a
                  key={i}
                  href={article.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block bg-surface rounded-lg border border-surface-border p-5 hover:shadow-md transition"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${sourceColors[article.source] || 'bg-surface-alt'}`}>
                      {article.source}
                    </span>
                    <span className="text-xs text-text-muted">{article.timeAgo}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-text-primary mb-2 hover:text-primary">
                    {article.title}
                  </h3>
                  {article.description && (
                    <p className="text-text-secondary text-sm line-clamp-2">{article.description}</p>
                  )}
                </a>
              ))}
            </div>
          ) : !isLoading && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-xl font-semibold text-text-secondary mb-2">No results found</h3>
              <p className="text-text-muted">Try searching for something else</p>
            </div>
          )}
        </div>
      )}

      {/* API Info */}
      <div className="mt-12 p-6 bg-surface-alt rounded-xl">
        <h3 className="font-semibold mb-2">💡 Pro Tip: Use the API</h3>
        <p className="text-text-secondary text-sm mb-3">
          You can also search programmatically using our free API:
        </p>
        <code className="block bg-surface-alt text-gain p-3 rounded text-sm overflow-x-auto">
          GET /api/search?q=bitcoin&limit=10
        </code>
      </div>
    </div>
  );
}
