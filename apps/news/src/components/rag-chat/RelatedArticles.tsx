/**
 * RelatedArticles Component
 * 
 * Displays related crypto news articles based on conversation context
 */

'use client';

import { memo, useState, useCallback } from 'react';

export interface Article {
  id: string;
  title: string;
  summary?: string;
  url?: string;
  source?: string;
  publishedAt?: string;
  category?: string;
  relevanceScore?: number;
}

interface RelatedArticlesProps {
  articles: Article[];
  isLoading?: boolean;
  onArticleClick?: (article: Article) => void;
  maxDisplay?: number;
}

function RelatedArticlesComponent({
  articles,
  isLoading = false,
  onArticleClick,
  maxDisplay = 4,
}: RelatedArticlesProps) {
  const [expanded, setExpanded] = useState(false);
  const displayedArticles = expanded ? articles : articles.slice(0, maxDisplay);
  const hasMore = articles.length > maxDisplay;

  const handleArticleClick = useCallback(
    (article: Article) => {
      if (onArticleClick) {
        onArticleClick(article);
      } else if (article.url) {
        window.open(article.url, '_blank', 'noopener,noreferrer');
      }
    },
    [onArticleClick]
  );

  const formatDate = (dateString?: string): string => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffHours < 1) return 'Just now';
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const getCategoryColor = (category?: string): string => {
    const colors: Record<string, string> = {
      bitcoin: 'bg-orange-500/20 text-orange-400',
      ethereum: 'bg-purple-500/20 text-purple-400',
      defi: 'bg-blue-500/20 text-blue-400',
      nft: 'bg-pink-500/20 text-pink-400',
      regulation: 'bg-red-500/20 text-red-400',
      market: 'bg-green-500/20 text-green-400',
      default: 'bg-gray-500/20 text-gray-400',
    };
    return colors[category?.toLowerCase() || 'default'] || colors.default;
  };

  if (isLoading) {
    return (
      <div className="space-y-2 animate-pulse" role="status" aria-label="Loading related articles">
        <div className="h-4 w-32 bg-gray-700/50 rounded mb-3" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="p-3 bg-gray-800/30 rounded-lg">
            <div className="h-4 w-full bg-gray-700/40 rounded mb-2" />
            <div className="h-3 w-2/3 bg-gray-700/30 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (articles.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <svg
          className="w-4 h-4 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
          />
        </svg>
        <h4 className="text-sm font-medium text-gray-300">Related Articles</h4>
        <span className="text-xs text-gray-500">({articles.length})</span>
      </div>

      <div className="space-y-2">
        {displayedArticles.map((article) => (
          <button
            key={article.id}
            onClick={() => handleArticleClick(article)}
            className="w-full text-left p-3 bg-gray-800/30 hover:bg-gray-800/50 
                       rounded-lg border border-gray-700/30 hover:border-gray-600/50
                       transition-all duration-200 group"
            aria-label={`Read article: ${article.title}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h5 className="text-sm font-medium text-gray-200 group-hover:text-white 
                               truncate transition-colors">
                  {article.title}
                </h5>
                
                {article.summary && (
                  <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                    {article.summary}
                  </p>
                )}
                
                <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                  {article.category && (
                    <span className={`px-1.5 py-0.5 rounded ${getCategoryColor(article.category)}`}>
                      {article.category}
                    </span>
                  )}
                  
                  {article.source && (
                    <span className="truncate max-w-[100px]">{article.source}</span>
                  )}
                  
                  {article.publishedAt && (
                    <>
                      <span className="text-gray-600">•</span>
                      <span>{formatDate(article.publishedAt)}</span>
                    </>
                  )}
                  
                  {article.relevanceScore !== undefined && (
                    <span 
                      className="ml-auto text-blue-400/70"
                      title={`${Math.round(article.relevanceScore * 100)}% relevant`}
                    >
                      {Math.round(article.relevanceScore * 100)}%
                    </span>
                  )}
                </div>
              </div>
              
              {article.url && (
                <svg
                  className="w-4 h-4 text-gray-500 group-hover:text-gray-300 flex-shrink-0 
                             transition-colors mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              )}
            </div>
          </button>
        ))}
      </div>

      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full text-center py-2 text-xs text-gray-400 hover:text-gray-300
                     transition-colors"
        >
          {expanded ? 'Show less' : `Show ${articles.length - maxDisplay} more articles`}
        </button>
      )}
    </div>
  );
}

export const RelatedArticles = memo(RelatedArticlesComponent);
export default RelatedArticles;
