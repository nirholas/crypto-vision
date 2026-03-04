'use client';

/**
 * SEO-friendly Article Link Component
 * 
 * Wraps Next.js Link with automatic slug generation for articles
 */

import Link from 'next/link';
import { buildArticleUrl, buildCoinUrl, buildCategoryUrl, buildTopicUrl, buildSourceUrl } from '@/lib/slugs';
import { ReactNode } from 'react';

interface ArticleLinkProps {
  articleId: string;
  title: string;
  children: ReactNode;
  className?: string;
  prefetch?: boolean;
}

/**
 * Article link with SEO-friendly URL
 */
export function ArticleLink({ articleId, title, children, className, prefetch }: ArticleLinkProps) {
  const href = buildArticleUrl(articleId, title);
  
  return (
    <Link href={href} className={className} prefetch={prefetch}>
      {children}
    </Link>
  );
}

interface CoinLinkProps {
  coinId: string;
  name?: string;
  children: ReactNode;
  className?: string;
  prefetch?: boolean;
}

/**
 * Coin link with SEO-friendly URL
 */
export function CoinLink({ coinId, name, children, className, prefetch }: CoinLinkProps) {
  const href = buildCoinUrl(coinId, name);
  
  return (
    <Link href={href} className={className} prefetch={prefetch}>
      {children}
    </Link>
  );
}

interface CategoryLinkProps {
  category: string;
  children: ReactNode;
  className?: string;
  prefetch?: boolean;
}

/**
 * Category link with SEO-friendly URL
 */
export function CategoryLink({ category, children, className, prefetch }: CategoryLinkProps) {
  const href = buildCategoryUrl(category);
  
  return (
    <Link href={href} className={className} prefetch={prefetch}>
      {children}
    </Link>
  );
}

interface TopicLinkProps {
  topic: string;
  children: ReactNode;
  className?: string;
  prefetch?: boolean;
}

/**
 * Topic link with SEO-friendly URL
 */
export function TopicLink({ topic, children, className, prefetch }: TopicLinkProps) {
  const href = buildTopicUrl(topic);
  
  return (
    <Link href={href} className={className} prefetch={prefetch}>
      {children}
    </Link>
  );
}

interface SourceLinkProps {
  source: string;
  children: ReactNode;
  className?: string;
  prefetch?: boolean;
}

/**
 * Source link with SEO-friendly URL
 */
export function SourceLink({ source, children, className, prefetch }: SourceLinkProps) {
  const href = buildSourceUrl(source);
  
  return (
    <Link href={href} className={className} prefetch={prefetch}>
      {children}
    </Link>
  );
}
